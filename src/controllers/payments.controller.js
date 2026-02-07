import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Cycle from "../models/Cycle.js"; 
import SystemWallet from "../models/SystemWallet.js";
import { ECONOMY_RULES } from "../config/economyRules.js";

const PASS_TOKENS = 100;     
const PASS_TARGET = 50.00;   
const LEVEL_1_GOAL = 30.00; // Meta para poder retirar

// 1. OBTENER DATOS
export const getWalletDetails = async (req, res) => {
    try {
        if (!req.user || !req.user.userId) return res.status(401).json({ message: "Token inválido." });

        const user = await User.findById(req.user.userId).populate('activeCycle');
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        // Buscamos si hay depósito O retiro pendiente
        const pendingTx = await Transaction.findOne({ 
            user: req.user.userId, 
            status: 'pending',
            type: { $in: ['deposit', 'withdrawal_external'] } // Miramos ambos tipos
        });

        res.json({ 
            balance: user.balance || 0, 
            tournamentTokens: user.tournamentTokens || 0,
            cycle: user.activeCycle || null,
            level: user.level || 0,        
            isActive: user.isActive || false, 
            currentCycleAcc: user.currentCycleAcc || 0,
            hasPendingDeposit: !!pendingTx, // Bloquea UI si hay algo pendiente
            history: await Transaction.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(10)
        });
    } catch (error) {
        console.error("Error GetWallet:", error);
        res.status(500).json({ message: "Error interno." });
    }
};

// 2. SOLICITAR PASE (DEPOSITO)
export const requestDeposit = async (req, res) => {
    try {
        const { amount, referenceId } = req.body;
        const userId = req.user.userId;

        if (!referenceId) return res.status(400).json({ message: "Falta ID comprobante." });

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Comprobante duplicado." });

        await Transaction.create({
            user: userId,
            type: 'deposit',
            amount: Number(amount),
            status: 'pending',
            description: 'Solicitud Pase Nivel 1',
            referenceId: referenceId
        });

        res.json({ message: "Enviado." });
    } catch (error) {
        res.status(500).json({ message: "Error.", error: error.message });
    }
};

// 3. RETIRAR FONDOS (SOLO SI COMPLETÓ CICLO)
export const requestPayout = async (req, res) => {
    try {
        const { amount, alias } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!alias) return res.status(400).json({ message: "Falta Alias." });

        const user = await User.findById(userId);
        
        // VALIDACIÓN DE CICLO (Seguridad Backend)
        if (user.currentCycleAcc < LEVEL_1_GOAL) {
            return res.status(403).json({ message: `Debes completar el ciclo ($${LEVEL_1_GOAL}) para retirar.` });
        }

        if ((user.balance || 0) < amount) {
            return res.status(400).json({ message: "Saldo insuficiente." });
        }

        // Verificar retiro pendiente
        const pendingTx = await Transaction.findOne({ user: userId, type: 'withdrawal_external', status: 'pending' });
        if (pendingTx) return res.status(400).json({ message: "Ya tienes un retiro en proceso." });

        // Descontar saldo YA (reserva de fondos)
        user.balance -= amount;
        
        // Resetear progreso del ciclo al retirar (Opcional, depende de tu lógica de "Renovación")
        // user.currentCycleAcc = 0; // Descomentar si al retirar se reinicia la barra
        
        await user.save();

        await Transaction.create({
            user: userId,
            type: 'withdrawal_external', // ESTE ES EL TIPO QUE ADMIN DEBE VER
            amount: Number(amount),
            status: 'pending',
            description: `Retiro a: ${alias}`,
            referenceId: `OUT-${Date.now()}`
        });

        res.json({ message: "Retiro solicitado." });

    } catch (error) {
        console.error("Error Payout:", error);
        res.status(500).json({ message: "Error procesando retiro." });
    }
};

// 4. ADMIN: GESTIONAR (APROBAR/RECHAZAR)
export const manageDeposit = async (req, res) => {
    try {
        const { transactionId, action } = req.body; 
        
        const tx = await Transaction.findById(transactionId).populate("user");
        if (!tx) return res.status(404).json({ error: "TX no encontrada." });
        if (tx.status !== "pending") return res.status(400).json({ error: "Ya procesada." });

        if (action === "approve") {
            // === APROBAR ===
            tx.status = "completed";
            
            // CASO A: ES UN DEPÓSITO (ACTIVAR USUARIO)
            if (tx.type === 'deposit') {
                const user = await User.findById(tx.user._id).populate('activeCycle');
                user.isActive = true;  
                user.level = 1;        
                user.tournamentTokens = (user.tournamentTokens || 0) + PASS_TOKENS;
                user.currentCycleAcc = 0; // Reinicia barra

                // Distribuir Comisiones
                await distributeMoney(tx.amount, user);
                await user.save();
            }
            // CASO B: ES UN RETIRO (CONFIRMAR ENVÍO)
            else if (tx.type === 'withdrawal_external') {
                // El saldo ya se descontó al pedirlo, así que solo marcamos completed
                tx.description += " (Enviado)";
            }
            
            await tx.save();
            res.json({ message: "✅ Transacción Aprobada." });

        } else {
            // === RECHAZAR ===
            tx.status = "rejected";
            
            // Si era retiro y rechazamos, DEVOLVER el saldo
            if (tx.type === 'withdrawal_external') {
                 const user = await User.findById(tx.user._id);
                 if (user) { 
                     user.balance += tx.amount; 
                     await user.save(); 
                 }
            }
            await tx.save();
            res.json({ message: "❌ Rechazada." });
        }

    } catch (error) {
        console.error("Manage Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// --- AUXILIARES ---

// ESTO ES LO QUE USA EL ADMIN PARA VER LA LISTA
export const getPendingTransactions = async (req, res) => {
    try { 
        // Buscamos TODO lo que esté pendiente, sin importar el tipo
        const p = await Transaction.find({ status: "pending" })
            .populate("user", "ninjaName email")
            .sort({ createdAt: 1 }); 
        
        console.log("Admin solicitando pendientes. Encontrados:", p.length); // Log Debug
        res.json(p); 
    } catch (e) { 
        console.error("Error Admin Pending:", e);
        res.status(500).json([]); 
    }
};

async function distributeMoney(amount, user) {
    // ... (Tu lógica de distribución de comisiones original va aquí) ...
    // Para simplificar el ejemplo, asumimos que funciona como en tu código previo
    const maintFee = amount * ECONOMY_RULES.FIXED_COSTS.MAINTENANCE;
    let sysWallet = await SystemWallet.findOne({ type: 'main' }) || await SystemWallet.create({ type: 'main' });
    sysWallet.adminBalance += maintFee;
    await sysWallet.save();
}

export const buyLevel = async (req, res) => res.status(400).json({error: "Usa endpoint deposit"});
export const harvestEarnings = async (req, res) => res.status(400).json({error: "Usa endpoint payout"});

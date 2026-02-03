import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Cycle from "../models/Cycle.js"; 

// CONFIGURACIÓN DEL SISTEMA
const PASS_TOKENS = 100;     // Fichas al aprobar depósito
const PASS_TARGET = 50.00;   // Meta total del pase

// ==========================================
// 1. GESTIÓN DE BILLETERA (USUARIO)
// ==========================================

export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('activeCycle');
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const history = await Transaction.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(10);

        res.json({ 
            balance: user.balance || 0, 
            tournamentTokens: user.tournamentTokens || 0,
            cycle: user.activeCycle || null,
            history 
        });
    } catch (error) {
        console.error("Error Wallet:", error);
        res.status(500).json({ message: "Error al obtener billetera." });
    }
};

export const requestDeposit = async (req, res) => {
    try {
        const { amount, referenceId } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!referenceId) return res.status(400).json({ message: "Falta ID comprobante." });

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Ese comprobante ya está registrado." });

        await Transaction.create({
            user: userId,
            type: 'deposit',
            amount: Number(amount),
            status: 'pending',
            description: 'Activación de Pase',
            referenceId
        });

        res.json({ message: "⏳ Comprobante enviado. Esperando activación del Shogun." });
    } catch (error) {
        console.error("Error Deposit:", error);
        res.status(500).json({ message: "Error al procesar depósito." });
    }
};

export const requestPayout = async (req, res) => {
    try {
        const { amount, alias } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!alias) return res.status(400).json({ message: "Falta el Alias/CBU." });

        const user = await User.findById(userId);
        if ((user.balance || 0) < amount) return res.status(400).json({ message: "Saldo insuficiente." });

        user.balance -= amount;
        await user.save();

        await Transaction.create({
            user: userId,
            type: 'withdrawal_external',
            amount: Number(amount),
            status: 'pending',
            description: `Retiro a: ${alias}`,
            referenceId: `OUT-${Date.now()}`
        });

        res.json({ message: "⏳ Retiro solicitado.", newBalance: user.balance });
    } catch (error) {
        console.error("Error Payout:", error);
        res.status(500).json({ message: "Error interno en retiro." });
    }
};

// ==========================================
// 2. TESORERÍA ADMIN (LÓGICA CRÍTICA)
// ==========================================

export const getPendingTransactions = async (req, res) => {
    try {
        const pending = await Transaction.find({ status: "pending" })
            .populate("user", "ninjaName email")
            .sort({ createdAt: 1 });
        res.json(pending);
    } catch (error) {
        res.status(500).json({ error: "Error al cargar tesorería." });
    }
};

export const manageDeposit = async (req, res) => {
    try {
        const { transactionId, action } = req.body; 
        
        if (!transactionId || transactionId.length !== 24) return res.status(400).json({ error: "ID inválido." });

        const tx = await Transaction.findById(transactionId).populate("user");
        if (!tx) return res.status(404).json({ error: "Transacción no encontrada." });
        
        // Blindaje contra usuarios borrados
        if (!tx.user) {
             tx.status = "failed";
             await tx.save();
             return res.status(404).json({ error: "Usuario inexistente." });
        }

        if (tx.status !== "pending") return res.status(400).json({ error: "Ya procesada." });

        if (action === "approve") {
            // == APROBACIÓN (ACTIVAR PASE) ==
            tx.status = "completed";
            tx.description += " (Aprobado - Pase Activado)";
            
            const user = await User.findById(tx.user._id).populate('activeCycle');
            
            // 1. DAR FICHAS (100)
            user.tournamentTokens = (user.tournamentTokens || 0) + PASS_TOKENS;

            // 2. ACTIVAR CICLO (PASE)
            if (!user.activeCycle || (user.activeCycle.status && user.activeCycle.status === 'completed')) {
                const newCycle = new Cycle({
                    user: user._id,
                    level: 1,
                    investedAmount: tx.amount, 
                    startTime: new Date(),
                    progress: 0,
                    earnings: 0,
                    targetAmount: PASS_TARGET, // Meta $50
                    status: 'active'
                });
                await newCycle.save();
                user.activeCycle = newCycle._id;
            } else {
                // Si ya tiene pase, es saldo extra
                user.balance = (user.balance || 0) + tx.amount;
            }

            await user.save();
            
            // Comisiones Referidos
            try {
                if (user.referredBy) await distributeCommissions(user.referredBy, tx.amount, 1);
            } catch (e) { console.error("Error comisiones:", e); }
            
            await tx.save();
            res.json({ message: `✅ Pase Activado. Usuario recibió ${PASS_TOKENS} Fichas.` });

        } else {
            // == RECHAZO ==
            tx.status = "rejected";
            if (tx.type === 'withdrawal_external') {
                 const user = await User.findById(tx.user._id);
                 if (user) {
                    user.balance = (user.balance || 0) + tx.amount; 
                    await user.save();
                 }
            }
            await tx.save();
            res.json({ message: "❌ Operación Rechazada." });
        }

    } catch (error) {
        console.error("CRITICAL ERROR manageDeposit:", error);
        res.status(500).json({ error: `Error interno: ${error.message}` });
    }
};

// Auxiliar Referidos
async function distributeCommissions(sponsorId, amount, depth) {
    if (depth > 3 || !sponsorId) return; 
    try {
        const sponsor = await User.findById(sponsorId);
        if (!sponsor) return;
        
        const rates = [0.10, 0.05, 0.02]; 
        const commission = amount * rates[depth - 1];
        
        if (commission > 0) {
            if (!sponsor.referralStats) sponsor.referralStats = { count: 0, totalEarned: 0 };
            sponsor.balance = (sponsor.balance || 0) + commission;
            sponsor.referralStats.totalEarned += commission;
            await sponsor.save();
            await Transaction.create({
                user: sponsorId, type: 'referral_bonus', amount: commission,
                status: 'completed', description: `Comisión Ref Nivel ${depth}`
            });
        }
        if (sponsor.referredBy) await distributeCommissions(sponsor.referredBy, amount, depth + 1);
    } catch (e) { console.error(`Error referidos:`, e); }
}

// ⚠️ MANTENER ESTAS LÍNEAS AL FINAL PARA EVITAR ERRORES DE RUTAS VIEJAS
// PERO SOLO UNA VEZ. SI LAS TENÍAS DUPLICADAS ANTES, ESO CAUSABA EL ERROR.
export const buyLevel = async (req, res) => res.status(400).json({error: "Función desactivada. Usa el sistema de recarga para activar pase."});
export const harvestEarnings = async (req, res) => res.status(400).json({error: "Usa el botón de retiro."});

import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Cycle from "../models/Cycle.js"; 

// CONFIGURACIÓN
const PASS_TOKENS = 100;     
const PASS_TARGET = 50.00;   
const WITHDRAW_CHUNK = 12.50; // Monto por tramo

// 1. OBTENER DATOS USUARIO
export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('activeCycle');
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        // Traemos historial para detectar pendientes
        const history = await Transaction.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(20);
        
        // Verificamos si hay retiro pendiente
        const hasPendingWithdrawal = history.some(tx => 
            tx.type === 'withdrawal_external' && tx.status === 'pending'
        );

        res.json({ 
            balance: user.balance || 0, 
            tournamentTokens: user.tournamentTokens || 0,
            cycle: user.activeCycle || null,
            history,
            hasPendingWithdrawal // Enviamos esta bandera al frontend
        });
    } catch (error) {
        res.status(500).json({ message: "Error al obtener billetera." });
    }
};

// 2. SOLICITAR DEPOSITO (Compra Pase)
export const requestDeposit = async (req, res) => {
    try {
        const { amount, referenceId } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!referenceId) return res.status(400).json({ message: "Falta ID comprobante." });

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Comprobante duplicado." });

        await Transaction.create({
            user: userId,
            type: 'deposit',
            amount: Number(amount),
            status: 'pending',
            description: 'Solicitud Pase Nivel 1',
            referenceId
        });

        res.json({ message: "⏳ Solicitud enviada. Esperando aprobación." });
    } catch (error) {
        res.status(500).json({ message: "Error interno." });
    }
};

// 3. SOLICITAR RETIRO (Con Bloqueo)
export const requestPayout = async (req, res) => {
    try {
        const { amount, alias } = req.body;
        const userId = req.user.userId;

        // Validaciones
        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!alias) return res.status(400).json({ message: "Falta Alias/CBU." });

        // 1. Verificar si ya tiene uno pendiente (SEGURIDAD)
        const pendingTx = await Transaction.findOne({ user: userId, type: 'withdrawal_external', status: 'pending' });
        if (pendingTx) {
            return res.status(400).json({ message: "⛔ Ya tienes un retiro en proceso. Espera a que se apruebe." });
        }

        const user = await User.findById(userId);
        
        // 2. Verificar saldo
        if ((user.balance || 0) < amount) {
            return res.status(400).json({ message: "Saldo insuficiente para retirar." });
        }

        // 3. Descontar y Crear Transacción
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

        res.json({ message: "✅ Retiro solicitado correctamente.", newBalance: user.balance });
    } catch (error) {
        console.error("Error Payout:", error);
        res.status(500).json({ message: "Error procesando retiro." });
    }
};

// 4. ADMIN: APROBAR PAGO (Logica Corregida)
export const manageDeposit = async (req, res) => {
    try {
        const { transactionId, action } = req.body; 
        
        const tx = await Transaction.findById(transactionId).populate("user");
        if (!tx) return res.status(404).json({ error: "Transacción no encontrada." });
        if (tx.status !== "pending") return res.status(400).json({ error: "Ya procesada." });

        if (action === "approve") {
            tx.status = "completed";
            tx.description += " (Aprobado)";
            
            const user = await User.findById(tx.user._id).populate('activeCycle');
            
            if (tx.type === 'deposit') {
                // A) DAR FICHAS
                user.tournamentTokens = (user.tournamentTokens || 0) + PASS_TOKENS;

                // B) ACTIVAR CICLO (El dinero NO va al balance, se 'consume' en el pase)
                if (!user.activeCycle || (user.activeCycle.status && user.activeCycle.status === 'completed')) {
                    const newCycle = new Cycle({
                        user: user._id,
                        level: 1,
                        investedAmount: tx.amount, 
                        startTime: new Date(),
                        progress: 0,
                        earnings: 0, // Empieza en 0 ganancia
                        targetAmount: PASS_TARGET, // Meta $50
                        status: 'active'
                    });
                    await newCycle.save();
                    user.activeCycle = newCycle._id;
                } else {
                    // Si ya tiene pase, esto es recarga extra (opcional, aquí sí iría a saldo)
                    // Pero para el pase inicial, NO toca user.balance
                    user.balance = (user.balance || 0) + tx.amount; 
                }
                
                // Distribuir referidos (opcional, basado en el monto ingresado)
                try {
                    if (user.referredBy) await distributeCommissions(user.referredBy, tx.amount, 1);
                } catch (e) { console.error("Error ref", e); }
            }
            
            await user.save();
            await tx.save();
            res.json({ message: "✅ Pago Aprobado. Fichas entregadas y Pase Activado." });

        } else {
            // RECHAZAR
            tx.status = "rejected";
            // Si era retiro, devolver plata
            if (tx.type === 'withdrawal_external') {
                 const user = await User.findById(tx.user._id);
                 if (user) {
                    user.balance = (user.balance || 0) + tx.amount; 
                    await user.save();
                 }
            }
            await tx.save();
            res.json({ message: "❌ Rechazado." });
        }

    } catch (error) {
        console.error("Manage Error:", error);
        res.status(500).json({ error: "Error interno." });
    }
};

// ... (Funciones auxiliares como distributeCommissions, getPendingTransactions se mantienen igual) ...
// Necesarias para que no rompa importaciones:
export const getPendingTransactions = async (req, res) => {
    try { const p = await Transaction.find({ status: "pending" }).populate("user", "ninjaName email").sort({ createdAt: 1 }); res.json(p); } catch (e) { res.status(500).json({error:"Error"}); }
};
async function distributeCommissions(sponsorId, amount, depth) { /* ... lógica referidos ... */ }
export const buyLevel = async (req, res) => res.status(400).json({error: "Obsoleto"});
export const harvestEarnings = async (req, res) => res.status(400).json({error: "Obsoleto"});

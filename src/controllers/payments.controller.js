import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

// 1. OBTENER DATOS DE BILLETERA
export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const pendingWithdrawal = await Transaction.findOne({ 
            userId: req.user.userId, 
            type: 'withdrawal_external', 
            status: 'pending' 
        });

        res.json({ 
            balance: user.balance || 0, 
            tournamentTokens: user.tournamentTokens || 0,
            level: user.level || 0,
            isActive: user.isActive || false,
            currentCycleAcc: user.currentCycleAcc || 0,
            hasPendingWithdrawal: !!pendingWithdrawal,
            // Últimos 10 movimientos
            history: await Transaction.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(10)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error interno." });
    }
};

// 2. SOLICITAR DEPÓSITO
export const requestDeposit = async (req, res) => {
    try {
        const { amount, referenceId } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!referenceId) return res.status(400).json({ message: "Falta ID de transacción." });

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Este ID ya fue utilizado." });

        await Transaction.create({
            userId: userId,
            type: 'deposit',
            amount: Number(amount),
            status: 'pending',
            referenceId: referenceId,
            description: 'Solicitud de Carga de Saldo'
        });

        res.json({ message: "Solicitud recibida. Esperando al Shogun." });

    } catch (error) {
        res.status(500).json({ message: "Error procesando solicitud." });
    }
};

// 3. SOLICITAR RETIRO
export const requestPayout = async (req, res) => {
    try {
        const { amount, alias } = req.body;
        const userId = req.user.userId;
        const user = await User.findById(userId);

        if(user.balance < amount) return res.status(400).json({ message: "Saldo insuficiente" });

        user.balance -= amount;
        await user.save();

        await Transaction.create({
            userId,
            type: 'withdrawal_external',
            amount,
            status: 'pending',
            description: `Retiro a: ${alias}`
        });

        res.json({ success: true, message: "Retiro solicitado." });
    } catch (error) {
        res.status(500).json({ message: "Error procesando retiro" });
    }
};

// ==========================================
// 🛡️ FUNCIONES DE ADMIN
// ==========================================

// 4. VER PENDIENTES
export const getPendingTransactions = async (req, res) => {
    try {
        // Traemos transacciones pendientes y populamos datos del usuario (nombre, email)
        const pending = await Transaction.find({ status: "pending" })
            .populate("userId", "ninjaName email") // Asegúrate que en Transaction el campo ref es 'userId'
            .sort({ createdAt: 1 });
        
        res.json(pending);
    } catch (error) {
        console.error("Error obteniendo pendientes:", error);
        res.status(500).json([]);
    }
};

// 5. GESTIONAR (APROBAR / RECHAZAR)
export const manageDeposit = async (req, res) => {
    try {
        const { transactionId, action } = req.body; // action: 'approve' o 'reject'
        
        const tx = await Transaction.findById(transactionId);
        if (!tx) return res.status(404).json({ error: "Transacción no encontrada" });
        if (tx.status !== 'pending') return res.status(400).json({ error: "Ya procesada" });

        if (action === 'reject') {
            tx.status = 'rejected';
            await tx.save();
            return res.json({ success: true, message: "Depósito rechazado." });
        }

        if (action === 'approve') {
            const user = await User.findById(tx.userId);
            if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

            // === LÓGICA DE SALDO ===
            // Solo sumamos al balance. El usuario activará su nivel manualmente después.
            user.balance += tx.amount;
            await user.save();

            tx.status = 'approved';
            await tx.save();

            return res.json({ success: true, message: `Aprobado. $${tx.amount} cargados a ${user.ninjaName}.` });
        }

        res.status(400).json({ error: "Acción inválida" });

    } catch (error) {
        console.error("Manage Error:", error);
        res.status(500).json({ error: "Error interno" });
    }
};

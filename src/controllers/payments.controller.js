import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

// 1. VER BILLETERA
export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const pendingWithdrawal = await Transaction.findOne({ 
            userId: req.user.userId, // Ojo: verifica si usas 'user' o 'userId' en tu modelo Transaction
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
        if (!referenceId) return res.status(400).json({ message: "Falta ID." });

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "ID duplicado." });

        await Transaction.create({
            userId: userId,
            type: 'deposit',
            amount: Number(amount),
            status: 'pending',
            referenceId: referenceId,
            description: 'Carga de Saldo'
        });

        res.json({ message: "Solicitud recibida." });

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

// 4. APROBAR DEPÓSITO (ADMIN)
export const approveDeposit = async (req, res) => {
    try {
        const { transactionId } = req.body;
        const tx = await Transaction.findById(transactionId);
        if (!tx || tx.status !== 'pending') return res.status(400).json({ error: "TX inválida" });

        const user = await User.findById(tx.userId);
        user.balance += tx.amount;
        await user.save();

        tx.status = 'approved';
        await tx.save();

        res.json({ success: true, message: "Saldo cargado." });
    } catch (error) {
        res.status(500).json({ error: "Error interno" });
    }
};

// 5. RECHAZAR DEPÓSITO (ADMIN)
export const rejectDeposit = async (req, res) => {
    try {
        const { transactionId } = req.body;
        const tx = await Transaction.findById(transactionId);
        if (!tx) return res.status(404).json({ error: "TX no encontrada" });

        tx.status = 'rejected';
        await tx.save();
        res.json({ success: true, message: "Rechazado." });
    } catch (error) {
        res.status(500).json({ error: "Error interno" });
    }
};

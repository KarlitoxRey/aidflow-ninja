import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

// 1. OBTENER DATOS DEL USUARIO (WALLET)
export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const pendingWithdrawal = await Transaction.findOne({ 
            user: req.user.userId, 
            type: 'withdrawal_external', 
            status: 'pending' 
        });

        res.json({ 
            balance: user.balance || 0, 
            tournamentTokens: user.tournamentTokens || 0,
            hasPendingWithdrawal: !!pendingWithdrawal,
            // Historial reciente
            history: await Transaction.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(5)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error interno." });
    }
};

// 2. SOLICITAR DEPÓSITO (Usuario envía comprobante)
export const requestDeposit = async (req, res) => {
    try {
        const { amount, referenceId } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!referenceId) return res.status(400).json({ message: "Falta ID de transacción." });

        // Verificar duplicados
        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Este ID ya fue utilizado." });

        // Crear la transacción pendiente
        await Transaction.create({
            userId: userId, // Asegúrate que tu modelo use 'userId' o 'user' consistentemente
            type: 'deposit',
            amount: Number(amount),
            status: 'pending',
            referenceId: referenceId,
            description: 'Solicitud de carga de saldo'
        });

        res.json({ message: "Solicitud recibida. Esperando aprobación del Shogun." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al procesar solicitud." });
    }
};

// 3. APROBAR DEPÓSITO (ADMIN) - ¡SOLO CARGA SALDO!
export const approveDeposit = async (req, res) => {
    try {
        const { transactionId } = req.body; // El Admin envía el ID de la transacción
        
        const tx = await Transaction.findById(transactionId);
        if (!tx) return res.status(404).json({ error: "Transacción no encontrada" });
        if (tx.status !== 'pending') return res.status(400).json({ error: "Esta transacción ya fue procesada" });

        const user = await User.findById(tx.userId);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

        // === LÓGICA CORE: SOLO CARGAR SALDO ===
        user.balance += tx.amount;
        // NOTA IMPORTANTE: No activamos isActive aquí. 
        // El usuario debe usar su saldo para comprar el nivel manualmente.
        
        await user.save();

        // Marcar transacción como completada
        tx.status = 'approved'; // o 'completed' según tu enum
        await tx.save();

        res.json({ success: true, message: `Saldo cargado ($${tx.amount}) al usuario ${user.ninjaName}` });

    } catch (error) {
        console.error("Error aprobando depósito:", error);
        res.status(500).json({ error: "Error interno en tesorería" });
    }
};

// 4. SOLICITAR RETIRO
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
}
export const buyLevel = async (req, res) => res.status(400).json({error: "Deprecated"});
export const harvestEarnings = async (req, res) => res.status(400).json({error: "Deprecated"});

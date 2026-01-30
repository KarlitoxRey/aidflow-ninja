import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { LEVEL_PRICES, SPEED_MULTIPLIERS, LEVEL_TOKENS, calculateCommissions } from "../utils/economyRules.js";

// 1. DETALLES BILLETERA (Mantenido igual, fix userId)
export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const history = await Transaction.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(10);

        res.json({ 
            balance: user.balance, 
            tournamentTokens: user.tournamentTokens || 0, // Mostramos las fichas
            cycle: user.cycle,
            history 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error obteniendo datos." });
    }
};

// 2. SOLICITAR DEPÓSITO (Mantenido igual)
export const requestDeposit = async (req, res) => {
    try {
        const { amount, referenceId } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!referenceId) return res.status(400).json({ message: "Falta ID comprobante." });

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Comprobante ya procesado." });

        await Transaction.create({
            user: userId,
            type: 'deposit_manual',
            amount: Number(amount),
            status: 'pending',
            description: 'Recarga MercadoPago (En Revisión)',
            referenceId
        });

        res.json({ message: "⏳ Comprobante enviado al Shogun." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al reportar pago." });
    }
};

// 3. COMPRAR PASE (🔥 LÓGICA AUTOMÁTICA NUEVA)
export const buyPass = async (req, res) => {
    try {
        const { level } = req.body; 
        const userId = req.user.userId;

        const cost = LEVEL_PRICES[level];
        if (!cost) return res.status(400).json({ error: "Nivel inválido" });

        const user = await User.findById(userId).populate("referredBy");
        if (!user) return res.status(404).json({ error: "Guerrero no encontrado" });

        if (user.balance < cost) {
            return res.status(400).json({ error: "Saldo insuficiente. Recarga primero." });
        }

        // --- LÓGICA DE REPARTO ---
        let referrer = user.referredBy; 
        const refLevel = referrer ? referrer.level : 0;
        const refCount = referrer ? referrer.referralStats.count : 0;

        const dist = calculateCommissions(refLevel, refCount, cost);

        // A) Actualizar Comprador
        user.balance -= cost;
        user.level = level;
        user.ninjaPassActive = true;
        user.speedMultiplier = SPEED_MULTIPLIERS[level];
        
        // Asignar Fichas (Regla: 100 fichas = $3, acá damos bonos)
        const bonusTokens = LEVEL_TOKENS[level] || 0;
        user.tournamentTokens += bonusTokens;
        
        user.role = "ninja";
        user.cycle = {
            active: true,
            investedAmount: cost,
            earnings: 0,
            target: cost * 2,
            startDate: new Date(),
            claimedMilestones: []
        };
        await user.save();

        // B) Pagar al Referente
        if (referrer && dist.referrerShare > 0) {
            referrer.balance += dist.referrerShare;
            referrer.referralStats.totalEarned += dist.referrerShare;
            await referrer.save();

            await Transaction.create({
                user: referrer._id,
                type: 'referral_bonus',
                amount: dist.referrerShare,
                status: 'completed',
                description: `Bono por recluta: ${user.ninjaName}`
            });
        }

        // C) Registrar Transacción Comprador
        await Transaction.create({
            user: userId,
            type: 'purchase_pass',
            amount: -cost,
            status: 'completed',
            description: `Compra Pase Nivel ${level} (+${bonusTokens} Fichas)`
        });

        // Debug Log
        console.log(`💰 REPARTO - Admin: $${dist.adminShare} | DAO: $${dist.daoShare}`);

        res.json({ 
            message: `🥷 Nivel ${level} forjado. Recibiste ${bonusTokens} Fichas.`,
            newBalance: user.balance,
            tokens: user.tournamentTokens
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al procesar el pase" });
    }
};

// 4. RETIRAR (Mantenido igual)
export const withdrawCycle = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

        // Nota: Asegúrate que user.cycle.earnings se llene con la lógica diaria después
        const amount = user.cycle.earnings; 

        if (amount <= 0) return res.status(400).json({ error: "Sin fondos para retirar." });

        user.balance += amount;
        user.cycle.earnings = 0; 
        await user.save();

        await Transaction.create({
            user: userId,
            type: 'withdrawal',
            amount: amount,
            status: 'completed',
            description: 'Retiro de ganancias del ciclo'
        });

        res.json({ 
            message: `✅ Ganancias ($${amount.toFixed(2)}) movidas a saldo principal.`,
            newBalance: user.balance 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error interno" });
    }
};

// 5. GESTIONAR DEPÓSITO (ADMIN - Mantenido igual)
export const manageDeposit = async (req, res) => {
    try {
        if (req.user.role !== 'shogun') return res.status(403).json({ message: "Denegado." });

        const { transactionId, action, comment } = req.body;
        const tx = await Transaction.findById(transactionId);
        if (!tx || tx.status !== 'pending') return res.status(404).json({ message: "Transacción inválida." });

        const user = await User.findById(tx.user);

        if (action === 'approve') {
            user.balance += tx.amount;
            await user.save();
            tx.status = 'completed';
            tx.description = 'Recarga Aprobada ✅';
            tx.adminComment = comment;
        } else if (action === 'reject') {
            tx.status = 'rejected';
            tx.description = 'Recarga Rechazada ❌';
            tx.adminComment = comment;
        }

        await tx.save();
        res.json({ message: `Operación ${action} exitosa` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error gestionando depósito." });
    }
};

// 6. OBTENER PENDIENTES (ADMIN - Mantenido igual)
export const getPendingTransactions = async (req, res) => {
    try {
        if (req.user.role !== 'shogun') return res.status(403).json({ message: "Denegado." });
        const pending = await Transaction.find({ status: 'pending' }).populate('user', 'ninjaName email');
        res.json(pending);
    } catch (error) {
        res.status(500).json({ message: "Error obteniendo pendientes." });
    }
};

// ==========================================
// 📤 7. SOLICITAR RETIRO EXTERNO (A BANCO/MP)
// ==========================================
export const requestPayout = async (req, res) => {
    try {
        const { amount, cbu, alias } = req.body;
        const userId = req.user.userId; // Asegúrate de usar userId

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!cbu && !alias) return res.status(400).json({ message: "Indica CBU o Alias." });

        const user = await User.findById(userId);
        if (user.balance < amount) return res.status(400).json({ message: "Saldo insuficiente en tu Bolsa." });

        // Descontamos del saldo temporalmente (reserva)
        user.balance -= amount;
        await user.save();

        // Creamos la solicitud pendiente
        await Transaction.create({
            user: userId,
            type: 'withdrawal_external', // Diferente al interno
            amount: Number(amount), // Negativo o positivo según tu lógica visual, aquí positivo para indicar monto solicitado
            status: 'pending',
            description: `Solicitud Retiro a: ${alias || cbu}`,
            referenceId: `OUT-${Date.now()}` // ID interno temporal
        });

        res.json({ message: "⏳ Solicitud enviada al Tesorero.", newBalance: user.balance });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al procesar la solicitud." });
    }
};

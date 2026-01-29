import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { LEVEL_PRICES, SPEED_MULTIPLIERS, calculateCommissions } from "../utils/economyRules.js";

// ... (Tus funciones getWalletDetails y requestDeposit SE MANTIENEN IGUALES) ...

export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId); // Fix: userId
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const history = await Transaction.find({ user: req.user.userId })
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({ 
            balance: user.balance, 
            cycle: {
                target: user.cycle.target,
                earnings: user.cycle.earnings,
                active: user.cycle.active
            },
            history 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error obteniendo datos financieros." });
    }
};

export const requestDeposit = async (req, res) => {
    // ... (Tu código original intacto) ...
    // Solo asegurate de usar req.user.userId en lugar de req.user.id si cambiaste el middleware
    try {
        const { amount, referenceId } = req.body;
        const userId = req.user.userId; 

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!referenceId) return res.status(400).json({ message: "Falta el ID de comprobante." });

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Este comprobante ya fue procesado." });

        await Transaction.create({
            user: userId,
            type: 'deposit_manual',
            amount: Number(amount),
            status: 'pending',
            description: 'Recarga MercadoPago (En Revisión)',
            referenceId
        });

        res.json({ message: "⏳ Comprobante enviado. El Shogun verificará tu tributo." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al reportar pago." });
    }
};

// ==========================================
// 🛒 3. COMPRAR PASE NINJA (¡AHORA CON REPARTO!)
// ==========================================
export const buyPass = async (req, res) => {
    try {
        const { level } = req.body; // 1, 2, 3
        const userId = req.user.userId;

        // 1. Validar Nivel y Precio
        const cost = LEVEL_PRICES[level];
        if (!cost) return res.status(400).json({ error: "Nivel inválido" });

        const user = await User.findById(userId).populate("referredBy");
        if (!user) return res.status(404).json({ error: "Guerrero no encontrado" });

        // 2. Verificar Saldo
        if (user.balance < cost) {
            return res.status(400).json({ error: "Saldo insuficiente. Recarga tu cuenta primero." });
        }

        // 3. LOGICA DE REPARTO (Referidos + DAO + Admin)
        let referrer = user.referredBy; // El usuario padre (Objeto completo gracias a populate)
        
        // Datos del referente para el cálculo
        const refLevel = referrer ? referrer.level : 0;
        const refCount = referrer ? referrer.referralStats.count : 0;

        const dist = calculateCommissions(refLevel, refCount, cost);

        // 4. EJECUTAR PAGOS Y MOVIMIENTOS
        
        // A) Descontar al comprador
        user.balance -= cost;
        user.level = level;
        user.ninjaPassActive = true;
        user.speedMultiplier = SPEED_MULTIPLIERS[level];
        user.role = "ninja";
        
        // Configurar Ciclo
        user.cycle = {
            active: true,
            investedAmount: cost,
            earnings: 0,
            target: cost * 2, // Objetivo x2
            startDate: new Date(),
            claimedMilestones: []
        };
        await user.save();

        // B) Pagar al Referente (Si existe y tiene nivel)
        if (referrer && dist.referrerShare > 0) {
            referrer.balance += dist.referrerShare;
            referrer.referralStats.totalEarned += dist.referrerShare;
            await referrer.save();

            // Log Transacción Referido
            await Transaction.create({
                user: referrer._id,
                type: 'referral_bonus',
                amount: dist.referrerShare,
                status: 'completed',
                description: `Bono por recluta: ${user.ninjaName}`
            });
        }

        // C) Registrar Gasto del Comprador
        await Transaction.create({
            user: userId,
            type: 'purchase_pass',
            amount: -cost,
            status: 'completed',
            description: `Compra Pase Nivel ${level}`
        });

        // NOTA: El dinero del DAO y Admin (dist.daoShare, dist.adminShare) 
        // podrías guardarlo en una colección especial "SystemFunds" si quisieras llevar contabilidad.
        // Por ahora se imprime en consola para que veas que funciona.
        console.log(`💰 REPARTO - Admin: $${dist.adminShare} | DAO: $${dist.daoShare}`);

        res.json({ 
            message: `🥷 Pase Nivel ${level} adquirido. ¡Honor y Fortuna!`,
            newBalance: user.balance,
            distribution: dist // Para debug (quitar en producción)
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al procesar el pase" });
    }
};

// ... (Resto de funciones withdrawCycle, manageDeposit, etc. MANTENER IGUALES) ...
// Solo asegurate de cambiar req.user.id por req.user.userId si usas mi auth middleware
export const withdrawCycle = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

        const amountToWithdraw = user.cycle.earnings; // Fix: user.cycle.earnings

        if (amountToWithdraw <= 0) {
            return res.status(400).json({ error: "No hay fondos disponibles para retiro." });
        }

        user.balance += amountToWithdraw;
        user.cycle.earnings = 0;
        await user.save();

        await Transaction.create({
            user: userId,
            type: 'withdrawal',
            amount: amountToWithdraw,
            status: 'completed',
            description: 'Retiro de ganancias del ciclo'
        });

        res.json({ 
            message: `✅ Ganancias de ${amountToWithdraw.toFixed(2)} transferidas a tu saldo.`,
            newBalance: user.balance 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error interno al procesar retiro" });
    }
};

export const manageDeposit = async (req, res) => {
    // ... Tu lógica actual está perfecta, mantenela ...
     try {
        if (req.user.role !== 'shogun') {
            return res.status(403).json({ message: "🚫 Acceso denegado." });
        }
        const { transactionId, action, comment } = req.body;
        const tx = await Transaction.findById(transactionId);
        if (!tx || tx.status !== 'pending') return res.status(404).json({ message: "Transacción no válida." });

        const user = await User.findById(tx.user);

        if (action === 'approve') {
            user.balance += tx.amount;
            await user.save();
            tx.status = 'completed';
            tx.description = 'Recarga Aprobada ✅';
        } else if (action === 'reject') {
            tx.status = 'rejected';
            tx.description = 'Recarga Rechazada ❌';
        }
        await tx.save();
        res.json({ message: `Operación ${action.toUpperCase()} exitosa`, status: tx.status });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error gestionando depósito." });
    }
};

export const getPendingTransactions = async (req, res) => {
    // ... Tu lógica actual está perfecta ...
     try {
        if (req.user.role !== 'shogun') return res.status(403).json({ message: "Denegado." });
        const pending = await Transaction.find({ status: 'pending' })
            .populate('user', 'ninjaName email')
            .sort({ createdAt: 1 });
        res.json(pending);
    } catch (error) {
        res.status(500).json({ message: "Error obteniendo pendientes." });
    }
};

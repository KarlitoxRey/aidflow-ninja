import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import SystemWallet from "../models/SystemWallet.js";
import { ECONOMY_RULES } from "../config/economyRules.js";

// 1. OBTENER DATOS (Para el Dashboard)
export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        // Verificar si ya envió un comprobante y está esperando
        const pendingDeposit = await Transaction.findOne({ 
            userId: req.user.userId, 
            type: 'deposit', 
            status: 'pending' 
        });

        res.json({ 
            balance: user.balance || 0, // Ganancias acumuladas
            tournamentTokens: user.tournamentTokens || 0,
            level: user.level || 0,
            isActive: user.isActive || false,
            currentCycleAcc: user.currentCycleAcc || 0,
            hasPendingDeposit: !!pendingDeposit, // Flag para mostrar "Verificando..."
            history: await Transaction.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(10)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error interno." });
    }
};

// 2. SOLICITAR PASE (Usuario envía comprobante)
export const requestDeposit = async (req, res) => {
    try {
        const { amount, referenceId } = req.body; // Frontend manda 10
        const userId = req.user.userId;

        if (!referenceId) return res.status(400).json({ message: "Falta ID de transacción." });

        // Evitar duplicados
        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Este comprobante ya existe." });

        await Transaction.create({
            userId: userId,
            type: 'deposit',
            amount: Number(amount),
            status: 'pending',
            referenceId: referenceId,
            description: 'Compra Pase Nivel 1'
        });

        res.json({ message: "Comprobante enviado. Esperando al Shogun." });

    } catch (error) {
        res.status(500).json({ message: "Error al procesar." });
    }
};

// 3. APROBAR PASE (ADMIN) - ¡ACTIVACIÓN AUTOMÁTICA!
export const approveDeposit = async (req, res) => {
    try {
        const { transactionId, action } = req.body; 
        
        const tx = await Transaction.findById(transactionId);
        if (!tx) return res.status(404).json({ error: "TX no encontrada" });
        if (tx.status !== 'pending') return res.status(400).json({ error: "Ya procesada" });

        // --- RECHAZAR ---
        if (action === 'reject') {
            tx.status = 'rejected';
            await tx.save();
            return res.json({ success: true, message: "Solicitud rechazada." });
        }

        // --- APROBAR ---
        const user = await User.findById(tx.userId);
        if (!user) return res.status(404).json({ error: "Usuario no existe" });

        const amount = tx.amount; // $10

        // A. ACTIVAR AL USUARIO DIRECTAMENTE
        user.isActive = true;
        user.level = 1; 
        user.tournamentTokens += 100; // +100 Fichas
        user.currentCycleAcc = 0;     // Barra empieza en 0
        user.micropaymentSpeed = 1;

        // B. DISTRIBUIR EL DINERO (ADMIN, DAO, REFERIDO)
        const maintFee = amount * ECONOMY_RULES.FIXED_COSTS.MAINTENANCE;
        const daoFee = amount * ECONOMY_RULES.FIXED_COSTS.DAO_BASE;
        const backupFee = amount * ECONOMY_RULES.FIXED_COSTS.BACKUP;
        
        let referralFee = 0;
        let micropool = 0;

        // Referidos
        const referrer = user.referrer ? await User.findById(user.referrer) : null;
        if (referrer) {
            let tierConfig = ECONOMY_RULES.REFERRAL_TIERS.LEVEL_1;
            referralFee = amount * tierConfig.BASE; 
        }

        // Sobrante (Micropagos / DAO)
        micropool = amount - (maintFee + daoFee + backupFee + referralFee);
        if (micropool < 0) micropool = 0;

        // Guardar en Sistema
        let sysWallet = await SystemWallet.findOne({ type: 'main' });
        if (!sysWallet) sysWallet = await SystemWallet.create({ type: 'main' });
        
        sysWallet.adminBalance += maintFee;
        sysWallet.daoBalance += (daoFee + micropool); // Todo lo extra al DAO por seguridad
        sysWallet.backupBalance += backupFee;
        await sysWallet.save();

        // Pagar al Referido
        if (referrer && referralFee > 0) {
            referrer.balance += referralFee;
            referrer.totalEarnings += referralFee;
            await referrer.save();
            // Log transacción referido
            await Transaction.create({
                userId: referrer._id,
                type: 'referral_bonus',
                amount: referralFee,
                status: 'completed',
                description: `Comisión por ${user.ninjaName}`
            });
        }

        // C. FINALIZAR
        tx.status = 'approved';
        await tx.save();
        await user.save(); // Guardamos cambios en usuario

        res.json({ success: true, message: `Usuario ${user.ninjaName} activado Nivel 1.` });

    } catch (error) {
        console.error("Error aprobación:", error);
        res.status(500).json({ error: "Error interno" });
    }
};

// Endpoint Admin
export const manageDeposit = approveDeposit; 

// 4. RETIRAR GANANCIAS
export const requestPayout = async (req, res) => {
    try {
        const { amount, alias } = req.body;
        const user = await User.findById(req.user.userId);
        if(user.balance < amount) return res.status(400).json({ message: "Saldo insuficiente" });
        
        user.balance -= amount;
        await user.save();
        
        await Transaction.create({ 
            userId: req.user.userId, 
            type: 'withdrawal_external', 
            amount, 
            status: 'pending', 
            description: `Retiro a: ${alias}` 
        });
        
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: "Error" }); }
};

// Auxiliar para Admin
export const getPendingTransactions = async (req, res) => {
    try { 
        const p = await Transaction.find({ status: "pending" }).populate("userId", "ninjaName email").sort({ createdAt: 1 }); 
        res.json(p); 
    } catch (e) { res.status(500).json([]); }
};

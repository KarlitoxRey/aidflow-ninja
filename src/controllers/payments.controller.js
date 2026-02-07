import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import SystemWallet from "../models/SystemWallet.js";
import { ECONOMY_RULES } from "../config/economyRules.js";

// 1. OBTENER DATOS (Para el Dashboard)
export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        // Ver si ya tiene una solicitud de depósito pendiente
        const pendingDeposit = await Transaction.findOne({ 
            userId: req.user.userId, 
            type: 'deposit', 
            status: 'pending' 
        });

        res.json({ 
            balance: user.balance || 0, // Esto es lo que GANA, no lo que deposita
            tournamentTokens: user.tournamentTokens || 0,
            level: user.level || 0,
            isActive: user.isActive || false,
            currentCycleAcc: user.currentCycleAcc || 0,
            hasPendingDeposit: !!pendingDeposit, // Para mostrar "Esperando aprobación"
            history: await Transaction.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(5)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error interno." });
    }
};

// 2. SOLICITAR PASE (Usuario envía comprobante)
export const requestDeposit = async (req, res) => {
    try {
        const { amount, referenceId } = req.body; // El frontend manda amount=10
        const userId = req.user.userId;

        if (!referenceId) return res.status(400).json({ message: "Falta ID de transacción." });

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Este ID ya fue utilizado." });

        // Creamos la solicitud
        await Transaction.create({
            userId: userId,
            type: 'deposit',
            amount: Number(amount),
            status: 'pending', // Esperando al Shogun
            referenceId: referenceId,
            description: 'Compra de Pase Nivel 1'
        });

        res.json({ message: "Comprobante enviado. Esperando aprobación." });

    } catch (error) {
        res.status(500).json({ message: "Error al procesar." });
    }
};

// 3. APROBAR PASE (ADMIN) - ¡AQUÍ OCURRE LA MAGIA!
export const approveDeposit = async (req, res) => {
    try {
        const { transactionId, action } = req.body; // action puede ser 'approve' o 'reject'
        
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

        const amount = tx.amount; // Los $10

        // A. ACTIVAR AL USUARIO (Lo que pediste)
        user.isActive = true;
        user.level = 1; // Arranca en Nivel 1
        user.tournamentTokens += 100; // Se acreditan 100 fichas
        user.currentCycleAcc = 0; // Barra de progreso en CERO
        user.micropaymentSpeed = 1;

        // B. DISTRIBUCIÓN DEL DINERO (El usuario pagó, ahora repartimos)
        // 1. Costos Fijos
        const maintFee = amount * ECONOMY_RULES.FIXED_COSTS.MAINTENANCE;
        const daoFee = amount * ECONOMY_RULES.FIXED_COSTS.DAO_BASE;
        const backupFee = amount * ECONOMY_RULES.FIXED_COSTS.BACKUP;
        
        let referralFee = 0;
        let micropool = 0;

        // 2. Referido
        const referrer = user.referrer ? await User.findById(user.referrer) : null;
        if (referrer) {
            let tierConfig = ECONOMY_RULES.REFERRAL_TIERS.LEVEL_1; // Simplificado para Nivel 1
            // Bonus simple
            referralFee = amount * tierConfig.BASE; 
        }

        // 3. Sobrante a Micropagos
        micropool = amount - (maintFee + daoFee + backupFee + referralFee);
        if (micropool < 0) micropool = 0;

        // C. GUARDAR EN BILLETERAS
        let sysWallet = await SystemWallet.findOne({ type: 'main' });
        if (!sysWallet) sysWallet = await SystemWallet.create({ type: 'main' });
        
        sysWallet.adminBalance += maintFee;
        sysWallet.daoBalance += daoFee;
        sysWallet.backupBalance += backupFee;
        await sysWallet.save();

        // Pagar al Referido (Si existe)
        if (referrer && referralFee > 0) {
            referrer.balance += referralFee; // Suma a SU saldo ganable
            referrer.totalEarnings += referralFee;
            await referrer.save();
            // Log para el referido
            await Transaction.create({
                userId: referrer._id,
                type: 'referral_bonus',
                amount: referralFee,
                status: 'completed',
                description: `Comisión por ${user.ninjaName}`
            });
        }

        // Lluvia de dinero (Opcional: implementarlo aquí o llamar a economyController)
        // Por simplicidad, asumimos que el micropool se va al DAO si no hay lógica compleja
        if (micropool > 0) {
            sysWallet.daoBalance += micropool;
            await sysWallet.save();
        }

        // D. FINALIZAR
        tx.status = 'approved';
        await tx.save();
        await user.save();

        res.json({ success: true, message: `Usuario ${user.ninjaName} activado en Nivel 1 + 100 Fichas.` });

    } catch (error) {
        console.error("Error aprobación:", error);
        res.status(500).json({ error: "Error interno" });
    }
};

// Esta función es para el endpoint /manage que usa el admin
export const manageDeposit = approveDeposit; 

// 4. RETIRAR GANANCIAS
export const requestPayout = async (req, res) => {
    // ... (Igual que antes) ...
    try {
        const { amount, alias } = req.body;
        const user = await User.findById(req.user.userId);
        if(user.balance < amount) return res.status(400).json({ message: "Saldo insuficiente" });
        user.balance -= amount;
        await user.save();
        await Transaction.create({ userId: req.user.userId, type: 'withdrawal_external', amount, status: 'pending', description: `Retiro a: ${alias}` });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: "Error" }); }
};

// controllers/economy.controller.js
import User from "../models/User.js";
import Transaction from "../models/Transaction.js"; // Asegúrate de tener este modelo básico
import SystemWallet from "../models/SystemWallet.js";
import { ECONOMY_RULES } from "../config/economyRules.js";

// === PROCESAR COMPRA DE PASE ===
export const processNinjaEntry = async (req, res) => {
    try {
        const { userId, level, amount } = req.body;
        // NOTA: Asumimos que 'amount' ya fue cobrado por pasarela o validado externamente

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "Ninja no encontrado" });

        // -- 1. VALIDAR COSTO Y FUNDADORES --
        let requiredAmount = 0;
        if (level === 1) requiredAmount = ECONOMY_RULES.ENTRY_COST.LEVEL_1;
        if (level === 2) requiredAmount = ECONOMY_RULES.ENTRY_COST.LEVEL_2;
        if (level === 3) requiredAmount = ECONOMY_RULES.ENTRY_COST.LEVEL_3;

        // Descuento Fundador (Recompra Nivel 1 a $8)
        const isFounder = user.userIndex <= 100;
        const isReentry = user.totalEarnings > 0; // Asumimos recompra si ya ganó algo antes
        if (level === 1 && isFounder && isReentry) {
            requiredAmount = ECONOMY_RULES.ENTRY_COST.EARLY_BIRD_REENTRY;
        }

        if (amount < requiredAmount) {
            return res.status(400).json({ error: "Tributo insuficiente para este rango." });
        }

        // -- 2. CALCULAR DISTRIBUCIÓN --
        // Costos Fijos
        const maintFee = amount * ECONOMY_RULES.FIXED_COSTS.MAINTENANCE;
        const daoFee = amount * ECONOMY_RULES.FIXED_COSTS.DAO_BASE;
        const backupFee = amount * ECONOMY_RULES.FIXED_COSTS.BACKUP;
        
        let referralFee = 0;
        let micropool = 0;

        // Lógica de Referidos
        const referrer = user.referrer ? await User.findById(user.referrer) : null;

        if (referrer) {
            // Seleccionar Tier según nivel del PADRE (Maestro)
            let tierConfig = ECONOMY_RULES.REFERRAL_TIERS.LEVEL_1;
            if (referrer.level === 2) tierConfig = ECONOMY_RULES.REFERRAL_TIERS.LEVEL_2;
            if (referrer.level === 3) tierConfig = ECONOMY_RULES.REFERRAL_TIERS.LEVEL_3;

            // Calcular Bonus
            const childrenCount = await User.countDocuments({ referrer: referrer._id, isActive: true });
            let bonusPct = 0;
            for (const b of tierConfig.BONUS) {
                if (childrenCount >= b.min && childrenCount < b.max) bonusPct = b.val;
                else if (childrenCount >= b.min && b.max === 999) bonusPct = b.val; // Catch all
            }

            referralFee = amount * (tierConfig.BASE + bonusPct);
        }

        // Lo que sobra -> Para la gente (Micropagos)
        const used = maintFee + daoFee + backupFee + referralFee;
        micropool = amount - used;

        // FAILSAFE: Si por error matemático da negativo, ajustar del mantenimiento (El Admin absorbe el golpe)
        if (micropool < 0) {
            // Log de alerta real aquí
            micropool = 0; 
        }

        // -- 3. EJECUTAR PAGOS EN DB --
        
        // A. Billetera Sistema
        let sysWallet = await SystemWallet.findOne({ type: 'main' });
        if (!sysWallet) sysWallet = await SystemWallet.create({ type: 'main' });
        
        sysWallet.adminBalance += maintFee;
        sysWallet.daoBalance += daoFee;
        sysWallet.backupBalance += backupFee;
        await sysWallet.save();

        // B. Pago al Referido
        if (referrer && referralFee > 0) {
            referrer.balance += referralFee;
            referrer.totalEarnings += referralFee;
            await referrer.save();
            // Registrar TX
            await Transaction.create({
                userId: referrer._id, 
                type: 'referral_bonus', 
                amount: referralFee, 
                description: `Comisión por ${user.ninjaName}`
            });
        }

        // C. Lluvia de Micropagos (La Magia)
        if (micropool > 0) {
            await distributeMicropayments(micropool, user._id);
        }

        // -- 4. ACTIVAR USUARIO --
        user.isActive = true;
        user.level = level;
        user.currentCycleAcc = 0; // Reseteamos contador del ciclo
        
        // Definir velocidad según nivel
        if(level === 1) user.micropaymentSpeed = 1;
        if(level === 2) user.micropaymentSpeed = 1.5;
        if(level === 3) user.micropaymentSpeed = 2;

        await user.save();

        res.json({ success: true, message: "Pase activado. Honor y Gloria." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error crítico en Tesorería." });
    }
};

// --- FUNCIÓN DE LLUVIA DE DINERO ---
async function distributeMicropayments(pool, excludeId) {
    const value = ECONOMY_RULES.MICROPAYMENT_VALUE; // 0.25
    let drops = Math.floor(pool / value);

    // Buscar candidatos: Activos, No han terminado ciclo, No es el que paga
    const candidates = await User.find({
        _id: { $ne: excludeId },
        isActive: true,
        cycleCompleted: false
    }).select('_id balance currentCycleAcc micropaymentSpeed level');

    if (candidates.length === 0) {
        // Si no hay nadie, el dinero va al DAO (Reserva futura)
        const w = await SystemWallet.findOne();
        w.daoBalance += pool;
        await w.save();
        return;
    }

    for (let i = 0; i < drops; i++) {
        // Selección ponderada por velocidad
        const winner = weightedRandom(candidates);
        
        // Pagar
        winner.balance += value;
        winner.currentCycleAcc += value;
        
        // Verificar meta del ciclo
        const goal = getCycleGoal(winner.level);
        if (winner.currentCycleAcc >= goal) {
            winner.isActive = false; // Deja de recibir pagos
            winner.cycleCompleted = true;
            // Aquí se podría notificar "CICLO COMPLETADO"
        }

        await winner.save();
        
        // Registrar (Opcional: Puede llenar mucho la DB, mejor hacer logs agrupados)
    }
}

// Utiles
function getCycleGoal(level) {
    if (level === 2) return ECONOMY_RULES.CYCLE_GOAL.LEVEL_2;
    if (level === 3) return ECONOMY_RULES.CYCLE_GOAL.LEVEL_3;
    return ECONOMY_RULES.CYCLE_GOAL.LEVEL_1;
}

function weightedRandom(users) {
    let total = users.reduce((acc, u) => acc + u.micropaymentSpeed, 0);
    let r = Math.random() * total;
    for (let u of users) {
        r -= u.micropaymentSpeed;
        if (r <= 0) return u;
    }
    return users[0];
}

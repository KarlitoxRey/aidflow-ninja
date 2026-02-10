import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Cycle from "../models/Cycle.js"; 
import SystemWallet from "../models/SystemWallet.js"; 
import { ECONOMY } from "../config/economyRules.js"; 

// 1. OBTENER DATOS DASHBOARD
export const getWalletDetails = async (req, res) => {
    try {
        if (!req.user || !req.user.userId) return res.status(401).json({ message: "Token inválido." });

        const user = await User.findById(req.user.userId).populate('activeCycle');
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const pendingTx = await Transaction.findOne({ 
            user: req.user.userId, 
            status: 'pending',
            type: { $in: ['deposit', 'withdrawal_external'] }
        });

        // Determinar meta actual
        let currentGoal = ECONOMY.LEVELS[1].GOAL;
        if (user.level === 2) currentGoal = ECONOMY.LEVELS[2].GOAL;
        if (user.level === 3) currentGoal = ECONOMY.LEVELS[3].GOAL;

        res.json({ 
            balance: user.balance || 0, 
            tournamentTokens: user.tournamentTokens || 0,
            cycle: user.activeCycle || null,
            level: user.level || 0,
            maxLevelUnlocked: user.maxLevelUnlocked || 1, // Nuevo campo
            isActive: user.isActive || false, 
            role: user.role || 'user', 
            currentCycleAcc: user.currentCycleAcc || 0,
            cycleGoal: currentGoal,
            referralCount: user.referralCount || 0, // Nuevo
            hasPendingDeposit: !!pendingTx,
            history: await Transaction.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(10)
        });
    } catch (error) {
        console.error("Error GetWallet:", error);
        res.status(500).json({ message: "Error interno." });
    }
};

// 2. SOLICITAR PASE
export const requestDeposit = async (req, res) => {
    try {
        const { amount, referenceId } = req.body;
        const userId = req.user.userId;

        if (!referenceId) return res.status(400).json({ message: "Falta ID." });
        
        // Validar montos exactos ($10, $25, $50)
        const amt = Number(amount);
        if (![10, 25, 50].includes(amt)) {
            return res.status(400).json({ message: "Monto inválido. Solo $10, $25 o $50." });
        }

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "ID duplicado." });

        // Determinar Nivel solicitado
        let levelReq = 1;
        if (amt === 25) levelReq = 2;
        if (amt === 50) levelReq = 3;

        await Transaction.create({
            user: userId,
            type: 'deposit',
            amount: amt,
            status: 'pending',
            description: `Solicitud Pase Nivel ${levelReq}`,
            referenceId: referenceId,
            metaData: { levelRequested: levelReq } // Guardamos qué nivel pidió
        });

        res.json({ message: "Enviado." });
    } catch (error) {
        res.status(500).json({ message: "Error.", error: error.message });
    }
};

// 3. APROBAR PASE (LÓGICA MAESTRA)
export const manageDeposit = async (req, res) => {
    try {
        const { transactionId, action } = req.body; 
        
        const tx = await Transaction.findById(transactionId).populate("user");
        if (!tx) return res.status(404).json({ error: "TX no encontrada." });
        if (tx.status !== "pending") return res.status(400).json({ error: "Ya procesada." });

        if (action === "approve") {
            tx.status = "completed";
            
            if (tx.type === 'deposit') {
                const user = await User.findById(tx.user._id).populate('activeCycle');
                const amount = tx.amount;
                
                // Determinar Nivel
                let level = 1;
                if (amount === 25) level = 2;
                if (amount === 50) level = 3;

                // Validar si tiene desbloqueado el nivel
                if (level > (user.maxLevelUnlocked || 1) && level > 1) {
                    // Si intenta comprar nivel 3 sin desbloquearlo, lo forzamos a 1 o rechazamos?
                    // Por ahora asumimos que el frontend valida, pero aquí procesamos el pago igual.
                }

                // === 1. ACTIVAR USUARIO ===
                user.isActive = true;  
                user.level = level;        
                user.tournamentTokens = (user.tournamentTokens || 0) + (100 * level); // Más fichas si es nivel alto
                user.currentCycleAcc = 0; 
                
                // Configurar Velocidad Micropagos
                let speed = ECONOMY.REFERRAL_TIERS.LEVEL_1.SPEED;
                if (level === 2) speed = ECONOMY.REFERRAL_TIERS.LEVEL_2.SPEED;
                if (level === 3) speed = ECONOMY.REFERRAL_TIERS.LEVEL_3.SPEED;
                user.micropaymentSpeed = speed;

                // Crear Ciclo
                if (!user.activeCycle || user.activeCycle.status === 'completed') {
                    const newCycle = new Cycle({
                        user: user._id, 
                        level: level, 
                        investedAmount: amount, 
                        targetAmount: ECONOMY.LEVELS[level].GOAL, 
                        status: 'active'
                    });
                    await newCycle.save();
                    user.activeCycle = newCycle._id;
                }

                // === 2. DISTRIBUCIÓN DE FONDOS (LA REGLA DE ORO) ===
                
                if (level === 1) {
                    await distributeLevel1(amount, user);
                } else if (level === 2) {
                    await distributeLevel2(amount, user);
                } else if (level === 3) {
                    await distributeLevel3(amount, user);
                }

                await user.save();
            }
            
            await tx.save();
            res.json({ message: "✅ Aprobado. Distribución realizada." });

        } else {
            tx.status = "rejected";
            if (tx.type === 'withdrawal_external') {
                 const user = await User.findById(tx.user._id);
                 if (user) { user.balance += tx.amount; await user.save(); }
            }
            await tx.save();
            res.json({ message: "❌ Rechazada." });
        }

    } catch (error) {
        console.error("Manage Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// --- LOGICA NIVEL 1 ($10) ---
async function distributeLevel1(amount, user) {
    let sysWallet = await getSystemWallet();
    
    // A. SIN REFERIDO
    if (!user.referredBy) {
        const backup = amount * ECONOMY.L1_NO_REF.BACKUP; // $2
        const maint  = amount * ECONOMY.L1_NO_REF.MAINT;  // $2
        const dao    = amount * ECONOMY.L1_NO_REF.DAO;    // $2
        const micro  = amount * ECONOMY.L1_NO_REF.MICRO;  // $4

        sysWallet.backupBalance += backup;
        sysWallet.adminBalance += maint;
        sysWallet.daoBalance += dao;
        sysWallet.totalIncome += amount;
        await sysWallet.save();

        await rainMicropayments(micro, user._id); // $4 en gotas de $0.25
        return;
    }

    // B. CON REFERIDO
    const sponsor = await User.findById(user.referredBy);
    if (sponsor) {
        // Calcular porcentaje del Sponsor
        const refPercent = calculateReferralPercent(sponsor);
        const refAmount = amount * refPercent; // $4, $4.5 o $5

        // Calcular Mantenimiento (Nivel 3 cobra 20% maint, otros 10%)
        let maintPercent = 0.10;
        if (sponsor.level === 3) maintPercent = 0.20;
        const maintAmount = amount * maintPercent;

        // Calcular DAO (Nivel 3 paga solo 10% DAO, otros 20%)
        let daoPercent = 0.20;
        if (sponsor.level === 3) daoPercent = 0.10;
        const daoAmount = amount * daoPercent;

        // Micropagos es EL RESTO
        const microAmount = amount - (refAmount + maintAmount + daoAmount);

        // -- Ejecutar --
        
        // Pagar Sponsor
        sponsor.balance += refAmount;
        sponsor.totalEarnings += refAmount;
        sponsor.referralCount = (sponsor.referralCount || 0) + 1; // Sumar referido
        await sponsor.save();
        
        // Guardar Sistema
        sysWallet.adminBalance += maintAmount;
        sysWallet.daoBalance += daoAmount;
        sysWallet.totalIncome += amount;
        await sysWallet.save();

        // Lluvia
        if (microAmount > 0) {
            await rainMicropayments(microAmount, user._id);
        }
    }
}

// --- LOGICA NIVEL 2 ($25) ---
async function distributeLevel2(amount, user) {
    let sysWallet = await getSystemWallet();
    const rules = ECONOMY.L2_DIST;

    sysWallet.adminBalance += rules.MAINT;   // $5
    sysWallet.backupBalance += rules.BACKUP; // $5
    sysWallet.daoBalance += rules.DAO;       // $5
    sysWallet.totalIncome += amount;
    await sysWallet.save();

    await rainMicropayments(rules.MICRO, user._id); // $10 en lluvia
}

// --- LOGICA NIVEL 3 ($50) ---
async function distributeLevel3(amount, user) {
    let sysWallet = await getSystemWallet();
    const rules = ECONOMY.L3_DIST;

    sysWallet.adminBalance += rules.MAINT;   // $10
    sysWallet.backupBalance += rules.BACKUP; // $10
    sysWallet.daoBalance += rules.DAO;       // $10
    sysWallet.totalIncome += amount;
    await sysWallet.save();

    await rainMicropayments(rules.MICRO, user._id); // $20 en lluvia
}

// --- AUXILIARES ---

// Calcular cuánto gana el REFERIDOR según su nivel y cantidad de hijos
function calculateReferralPercent(sponsor) {
    const count = sponsor.referralCount || 0;
    const level = sponsor.level || 1;
    let tiers;

    if (level === 1) tiers = ECONOMY.REFERRAL_TIERS.LEVEL_1;
    if (level === 2) tiers = ECONOMY.REFERRAL_TIERS.LEVEL_2;
    if (level === 3) tiers = ECONOMY.REFERRAL_TIERS.LEVEL_3;

    if (count < 2) return tiers.BASE;
    if (count < 4) return tiers.MID;
    return tiers.TOP;
}

// LLUVIA DE MICROPAGOS (REAL)
async function rainMicropayments(poolAmount, excludeId) {
    if (poolAmount <= 0) return;
    
    const CHUNK = ECONOMY.MICROPAYMENT_CHUNK; // $0.25
    let remaining = poolAmount;

    // Buscar usuarios activos y elegibles
    const candidates = await User.find({
        _id: { $ne: excludeId },
        isActive: true,
        currentCycleAcc: { $exists: true } // Que tengan ciclo activo
    });

    if (candidates.length === 0) {
        // Si no hay nadie, al DAO
        let s = await getSystemWallet();
        s.daoBalance += remaining;
        await s.save();
        return;
    }

    // Crear "Urna de Sorteo" basada en Velocidad (x1, x1.5, x2)
    let lotteryBox = [];
    candidates.forEach(u => {
        // Solo si no ha completado el ciclo
        // Determinar meta del usuario
        let goal = ECONOMY.LEVELS[u.level || 1].GOAL;
        if (u.currentCycleAcc < goal) {
            // Agregar tickets según velocidad
            const tickets = (u.micropaymentSpeed || 1) * 2; // x1=2 tickets, x2=4 tickets
            for(let i=0; i<tickets; i++) lotteryBox.push(u);
        }
    });

    if (lotteryBox.length === 0) return; // Todos están llenos

    // Repartir gotas
    while (remaining >= CHUNK && lotteryBox.length > 0) {
        // Sacar ganador aleatorio
        const winnerIndex = Math.floor(Math.random() * lotteryBox.length);
        const winner = lotteryBox[winnerIndex];

        // Dar dinero
        winner.currentCycleAcc += CHUNK;
        winner.balance += CHUNK;
        remaining -= CHUNK;

        // Chequear si se llenó
        let goal = ECONOMY.LEVELS[winner.level || 1].GOAL;
        if (winner.currentCycleAcc >= goal) {
            // COMPLETÓ CICLO
            winner.currentCycleAcc = goal; // Tope
            winner.maxLevelUnlocked = (winner.level < 3) ? winner.level + 1 : 3; // Desbloquear sig nivel
            
            // Sacarlo de la urna para que no reciba más
            lotteryBox = lotteryBox.filter(u => u._id.toString() !== winner._id.toString());
            
            // Aquí podríamos disparar la lógica del sorteo de 100 ciclos, pero por simplicidad:
            await checkLotteryTrigger(); 
        }

        await winner.save();
    }

    // Si sobra algo (centavos), al DAO
    if (remaining > 0) {
        let s = await getSystemWallet();
        s.daoBalance += remaining;
        await s.save();
    }
}

async function getSystemWallet() {
    let w = await SystemWallet.findOne({ type: 'main' });
    if (!w) w = await SystemWallet.create({ type: 'main' });
    return w;
}

// Placeholder para sorteo cada 100 ciclos
async function checkLotteryTrigger() {
    // Incrementar contador global en SystemWallet y si llega a 100, resetear y dar premio
    // Implementar si es requerido
}

// 4. RETIRAR
export const requestPayout = async (req, res) => {
    try {
        const { amount, alias } = req.body;
        const userId = req.user.userId;
        const user = await User.findById(userId);

        let goal = ECONOMY.LEVELS[user.level || 1].GOAL;

        if (user.currentCycleAcc < goal) {
            return res.status(403).json({ message: `Debes completar el ciclo ($${goal})` });
        }
        if (user.balance < amount) return res.status(400).json({ message: "Saldo insuficiente" });

        user.balance -= amount;
        // Al retirar, ¿se reinicia el ciclo?
        // Según "posibilidad de volver a participar", el usuario debería comprar de nuevo.
        // Aquí solo restamos saldo. El ciclo se queda en 100% hasta que compre otro pase.
        
        await user.save();
        await Transaction.create({ user: userId, type: 'withdrawal_external', amount: Number(amount), status: 'pending', description: `Retiro a ${alias}` });
        
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: "Error" }); }
};

export const getPendingTransactions = async (req, res) => {
    try { 
        const p = await Transaction.find({ status: "pending" }).populate("user", "ninjaName email").sort({ createdAt: 1 }); 
        res.json(p); 
    } catch (e) { res.status(500).json([]); }
};

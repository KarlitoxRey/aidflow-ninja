import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Cycle from "../models/Cycle.js"; 

// CONSTANTES DEL SISTEMA
const PASS_TOKENS = 100;    // Fichas otorgadas al aprobar depósito
const PASS_TARGET = 50.00;  // Meta de ganancia del pase
const LEVEL_PRICES = { 1: 10, 2: 20, 3: 50 }; // Por si compran niveles extra
const LEVEL_TOKENS = { 1: 5, 2: 10, 3: 25 }; 

// ==========================================
// 1. GESTIÓN DE BILLETERA (USUARIO)
// ==========================================

export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('activeCycle');
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const history = await Transaction.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(10);

        res.json({ 
            balance: user.balance || 0, 
            tournamentTokens: user.tournamentTokens || 0,
            cycle: user.activeCycle || null,
            history 
        });
    } catch (error) {
        console.error("Error Wallet:", error);
        res.status(500).json({ message: "Error al obtener billetera." });
    }
};

export const requestDeposit = async (req, res) => {
    try {
        const { amount, referenceId } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!referenceId) return res.status(400).json({ message: "Falta ID comprobante." });

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Ese comprobante ya está registrado." });

        await Transaction.create({
            user: userId,
            type: 'deposit',
            amount: Number(amount),
            status: 'pending',
            description: 'Compra de Pase / Recarga', // Descripción actualizada
            referenceId
        });

        res.json({ message: "⏳ Comprobante enviado. Esperando aprobación del Shogun." });
    } catch (error) {
        console.error("Error Deposit:", error);
        res.status(500).json({ message: "Error al procesar depósito." });
    }
};

export const requestPayout = async (req, res) => {
    try {
        const { amount, cbu, alias } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        // Validación de monto mínimo o pasos (ej: 12.50) se puede hacer aquí o en el front
        if (!cbu && !alias) return res.status(400).json({ message: "Indica CBU o Alias." });

        const user = await User.findById(userId);
        if ((user.balance || 0) < amount) return res.status(400).json({ message: "Saldo insuficiente." });

        user.balance -= amount;
        await user.save();

        await Transaction.create({
            user: userId,
            type: 'withdrawal_external',
            amount: Number(amount),
            status: 'pending',
            description: `Retiro a: ${alias || cbu}`,
            referenceId: `OUT-${Date.now()}`
        });

        res.json({ message: "⏳ Retiro solicitado.", newBalance: user.balance });
    } catch (error) {
        console.error("Error Payout:", error);
        res.status(500).json({ message: "Error interno en retiro." });
    }
};

// ==========================================
// 2. LÓGICA DE NIVELES EXTRA (Recompra)
// ==========================================
// Esta función queda por si el usuario quiere comprar niveles superiores con saldo ganado

export const buyLevel = async (req, res) => {
    try {
        const { level } = req.body;
        const userId = req.user.userId;
        const price = LEVEL_PRICES[level];

        if (!price) return res.status(400).json({ error: "Nivel no válido." });

        const user = await User.findById(userId).populate('activeCycle');
        
        if ((user.balance || 0) < price) return res.status(400).json({ error: "Saldo insuficiente." });
        
        // Solo permite comprar si NO tiene ciclo o el actual ya terminó
        if (user.activeCycle && user.activeCycle.status === 'active' && user.activeCycle.progress < 100) {
            return res.status(400).json({ error: "Ya tienes un Pase Activo." });
        }

        // Cobrar Saldo
        user.balance -= price;
        user.level = level;
        
        // Entregar Fichas
        const tokens = LEVEL_TOKENS[level] || 0;
        user.tournamentTokens = (user.tournamentTokens || 0) + tokens;

        // Crear Ciclo
        const newCycle = new Cycle({
            user: userId,
            level: level,
            investedAmount: price,
            startTime: new Date(),
            progress: 0,
            earnings: 0,
            targetAmount: PASS_TARGET, 
            status: 'active'
        });
        await newCycle.save();
        user.activeCycle = newCycle._id;

        // Distribuir Comisiones
        try {
            if (user.referredBy) await distributeCommissions(user.referredBy, price, 1);
        } catch (e) { console.error("Error ref:", e); }

        await Transaction.create({
            user: userId,
            type: 'cycle_buy',
            amount: -price,
            status: 'completed',
            description: `Compra Nivel ${level}`
        });

        await user.save();
        res.json({ message: `🔥 Nivel ${level} activado.`, cycle: newCycle, newBalance: user.balance });

    } catch (error) {
        console.error("Error buyLevel:", error);
        res.status(500).json({ error: "Error: " + error.message });
    }
};

export const harvestEarnings = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('activeCycle');
        if (!user || !user.activeCycle) return res.status(400).json({ error: "No tienes pase activo." });

        const cycle = await Cycle.findById(user.activeCycle._id);
        if (cycle.earnings <= 0) return res.status(400).json({ error: "Nada para cosechar." });

        const amount = cycle.earnings;
        user.balance = (user.balance || 0) + amount;
        cycle.earnings = 0; // Se mueve de 'ganancia pendiente' a 'saldo disponible'
        
        await cycle.save();
        await user.save();

        await Transaction.create({
            user: user._id,
            type: 'harvest',
            amount: amount,
            status: 'completed',
            description: `Cosecha del Pase`
        });

        res.json({ message: `🌾 +$${amount} movidos al saldo principal.`, newBalance: user.balance });
    } catch (error) {
        res.status(500).json({ error: "Error en cosecha." });
    }
};

// ==========================================
// 3. TESORERÍA ADMIN (MODIFICADO PARA ACTIVAR PASE)
// ==========================================

export const getPendingTransactions = async (req, res) => {
    try {
        const pending = await Transaction.find({ status: "pending" })
            .populate("user", "ninjaName email")
            .sort({ createdAt: 1 });
        res.json(pending);
    } catch (error) {
        res.status(500).json({ error: "Error al cargar tesorería." });
    }
};

export const manageDeposit = async (req, res) => {
    try {
        const { transactionId, action } = req.body; 
        
        if (!transactionId || transactionId.length !== 24) return res.status(400).json({ error: "ID inválido." });

        const tx = await Transaction.findById(transactionId).populate("user");
        if (!tx) return res.status(404).json({ error: "Transacción no encontrada." });
        if (!tx.user) return res.status(404).json({ error: "Usuario inexistente." });
        if (tx.status !== "pending") return res.status(400).json({ error: "Ya procesada." });

        if (action === "approve") {
            tx.status = "completed";
            
            // LÓGICA PRINCIPAL: APROBACIÓN DE PASE
            if (tx.type === 'deposit') {
                const user = await User.findById(tx.user._id).populate('activeCycle');
                
                // 1. OTORGAR LAS 100 FICHAS
                user.tournamentTokens = (user.tournamentTokens || 0) + PASS_TOKENS;
                
                // 2. VERIFICAR SI YA TIENE PASE
                if (!user.activeCycle || (user.activeCycle.status && user.activeCycle.status === 'completed')) {
                    // ==> NO TIENE PASE ACTIVO: EL DEPÓSITO ACTIVA EL PASE
                    const newCycle = new Cycle({
                        user: user._id,
                        level: 1,
                        investedAmount: tx.amount, // El dinero entra aquí, no al saldo
                        startTime: new Date(),
                        progress: 0,
                        earnings: 0,
                        targetAmount: PASS_TARGET, // $50
                        status: 'active'
                    });
                    await newCycle.save();
                    user.activeCycle = newCycle._id;
                    
                    tx.description += " (Aprobado - PASE ACTIVADO)";
                    
                    // Distribuir comisión al referido (Solo en la primera compra/activación)
                    try {
                        if (user.referredBy) await distributeCommissions(user.referredBy, tx.amount, 1);
                    } catch (e) { console.error("Error comisiones:", e); }

                } else {
                    // ==> YA TIENE PASE: EL DEPÓSITO ES RECARGA DE SALDO
                    user.balance = (user.balance || 0) + tx.amount;
                    tx.description += " (Aprobado - Recarga Saldo)";
                }

                await user.save();
            }
            
            await tx.save();
            res.json({ message: "✅ Operación Aprobada con éxito." });

        } else {
            // RECHAZO
            tx.status = "rejected";
            
            // Devolver saldo si era retiro
            if (tx.type === 'withdrawal_external') {
                 const user = await User.findById(tx.user._id);
                 if (user) {
                    user.balance = (user.balance || 0) + tx.amount; 
                    await user.save();
                 }
            }
            await tx.save();
            res.json({ message: "❌ Operación Rechazada." });
        }

    } catch (error) {
        console.error("CRITICAL ERROR manageDeposit:", error);
        res.status(500).json({ error: `Error interno: ${error.message}` });
    }
};

// ==========================================
// 4. SISTEMA DE COMISIONES (Referidos)
// ==========================================

async function distributeCommissions(sponsorId, amount, depth) {
    if (depth > 3 || !sponsorId) return; 

    try {
        const sponsor = await User.findById(sponsorId);
        if (!sponsor) return;

        const rates = [0.10, 0.05, 0.02]; 
        const commission = amount * rates[depth - 1];

        if (commission > 0) {
            // Inicializamos stats para evitar crashes
            if (!sponsor.referralStats) {
                sponsor.referralStats = { count: 0, totalEarned: 0 };
            }
            
            sponsor.balance = (sponsor.balance || 0) + commission;
            sponsor.referralStats.totalEarned += commission;
            
            await sponsor.save();

            await Transaction.create({
                user: sponsorId,
                type: 'referral_bonus',
                amount: commission,
                status: 'completed',
                description: `Comisión Ref Nivel ${depth}`
            });
        }

        if (sponsor.referredBy) {
            await distributeCommissions(sponsor.referredBy, amount, depth + 1);
        }
    } catch (e) { 
        console.error(`Error referidos nivel ${depth}:`, e); 
    }
}

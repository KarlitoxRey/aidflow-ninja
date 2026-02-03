import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Cycle from "../models/Cycle.js"; 

// VALORES DE RESPALDO (Por si falla la importación de reglas)
const LEVEL_PRICES = { 1: 10, 2: 20, 3: 50 };
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
            description: 'Recarga de Saldo',
            referenceId
        });

        res.json({ message: "⏳ Depósito informado. Esperando aprobación." });
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
// 2. LÓGICA DEL JUEGO (COMPRA NIVELES + FICHAS)
// ==========================================

export const buyLevel = async (req, res) => {
    try {
        const { level } = req.body;
        const userId = req.user.userId;
        const price = LEVEL_PRICES[level];

        if (!price) return res.status(400).json({ error: "Nivel no válido." });

        const user = await User.findById(userId).populate('activeCycle');
        
        if ((user.balance || 0) < price) return res.status(400).json({ error: "Saldo insuficiente. Recarga primero." });
        if (user.activeCycle && user.activeCycle.progress < 100) {
            return res.status(400).json({ error: "Termina tu ciclo actual antes de comprar otro." });
        }

        // 1. Cobrar Saldo
        user.balance -= price;
        user.level = level;
        
        // 2. ENTREGAR FICHAS (Token Grant)
        const tokens = LEVEL_TOKENS[level] || 0;
        user.tournamentTokens = (user.tournamentTokens || 0) + tokens;

        // 3. Crear Ciclo
        const newCycle = new Cycle({
            user: userId,
            level: level,
            investedAmount: price,
            startTime: new Date(),
            progress: 0,
            earnings: 0,
            status: 'active'
        });
        await newCycle.save();
        user.activeCycle = newCycle._id;

        // 4. DISTRIBUIR COMISIONES (Referidos)
        // Usamos try-catch interno para que un error aquí no cancele la compra
        try {
            if (user.referredBy) {
                await distributeCommissions(user.referredBy, price, 1);
            }
        } catch (distError) {
            console.error("⚠️ Error en distribución referidos:", distError);
        }

        // 5. Registrar
        await Transaction.create({
            user: userId,
            type: 'cycle_buy',
            amount: -price,
            status: 'completed',
            description: `Nivel ${level} (+${tokens} Fichas)`
        });

        await user.save();
        res.json({ message: `🔥 Nivel ${level} activado. +${tokens} Fichas añadidas.`, cycle: newCycle, newBalance: user.balance });

    } catch (error) {
        console.error("Error buyLevel:", error);
        res.status(500).json({ error: "Error crítico al comprar nivel: " + error.message });
    }
};

export const harvestEarnings = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('activeCycle');
        if (!user || !user.activeCycle) return res.status(400).json({ error: "No tienes ciclo activo." });

        const cycle = await Cycle.findById(user.activeCycle._id);
        if (cycle.earnings <= 0) return res.status(400).json({ error: "Nada para cosechar aún." });

        const amount = cycle.earnings;
        user.balance = (user.balance || 0) + amount;
        cycle.earnings = 0;
        
        if (cycle.progress >= 100) cycle.status = 'completed';

        await cycle.save();
        await user.save();

        await Transaction.create({
            user: user._id,
            type: 'harvest',
            amount: amount,
            status: 'completed',
            description: `Cosecha Nivel ${cycle.level}`
        });

        res.json({ message: `🌾 +$${amount} Cosechados.`, newBalance: user.balance });
    } catch (error) {
        res.status(500).json({ error: "Error en cosecha." });
    }
};

// AUXILIAR: Distribuir Referidos (Seguro contra fallos)
async function distributeCommissions(sponsorId, amount, depth) {
    if (depth > 3 || !sponsorId) return; 

    try {
        const sponsor = await User.findById(sponsorId);
        if (!sponsor) return;

        const rates = [0.10, 0.05, 0.02]; 
        const commission = amount * rates[depth - 1];

        if (commission > 0) {
            // Inicializamos stats si no existen (EVITA EL CRASH)
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

// ==========================================
// 3. TESORERÍA ADMIN (EL FIX DEL ERROR 500)
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
        
        // 1. Validar ID
        if (!transactionId || transactionId.length !== 24) {
            return res.status(400).json({ error: "ID inválido." });
        }

        // 2. Buscar Transacción
        const tx = await Transaction.findById(transactionId).populate("user");
        if (!tx) return res.status(404).json({ error: "Transacción no encontrada." });
        
        // 3. 🛡️ SEGURIDAD: Verificar si el usuario aún existe
        if (!tx.user) {
            tx.status = "failed";
            tx.description += " (Usuario inexistente)";
            await tx.save();
            return res.status(404).json({ error: "El usuario de esta transacción ya no existe." });
        }

        if (tx.status !== "pending") return res.status(400).json({ error: "Esta operación ya fue procesada." });

        if (action === "approve") {
            // APROBAR
            tx.status = "completed";
            tx.description = (tx.description || "") + " (Aprobado)";
            
            if (tx.type === 'deposit') {
                const user = await User.findById(tx.user._id);
                if (user) {
                    user.balance = (user.balance || 0) + tx.amount;
                    await user.save();
                } else {
                    throw new Error("Usuario no encontrado al acreditar.");
                }
            }
            await tx.save();
            res.json({ message: "✅ Aprobado con éxito." });

        } else {
            // RECHAZAR
            tx.status = "rejected";
            
            // Si es retiro rechazado, devolver saldo
            if (tx.type === 'withdrawal_external') {
                 const user = await User.findById(tx.user._id);
                 if (user) {
                    user.balance = (user.balance || 0) + tx.amount; 
                    await user.save();
                 }
            }
            await tx.save();
            res.json({ message: "❌ Rechazado." });
        }

    } catch (error) {
        console.error("CRITICAL ERROR manageDeposit:", error);
        // Devolvemos el mensaje del error para que sepas qué pasó
        res.status(500).json({ error: `Error interno: ${error.message}` });
    }
};

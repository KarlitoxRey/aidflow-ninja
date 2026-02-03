import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Cycle from "../models/Cycle.js"; 
// Importamos reglas, pero si fallan, usaremos valores por defecto en el código
import { LEVEL_PRICES, LEVEL_TOKENS } from "../utils/economyRules.js";

// ==========================================
// 1. GESTIÓN DE BILLETERA (USUARIO)
// ==========================================

// Obtener detalles completos (Wallet + Ciclo Activo + Historial)
export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('activeCycle');
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const history = await Transaction.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(10);

        res.json({ 
            balance: user.balance, 
            tournamentTokens: user.tournamentTokens || 0,
            cycle: user.activeCycle || null,
            history 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error obteniendo datos." });
    }
};

// Solicitar Depósito (Usuario sube comprobante)
export const requestDeposit = async (req, res) => {
    try {
        const { amount, referenceId } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!referenceId) return res.status(400).json({ message: "Falta ID comprobante." });

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Ese comprobante ya fue enviado." });

        await Transaction.create({
            user: userId,
            type: 'deposit',
            amount: Number(amount),
            status: 'pending',
            description: 'Recarga de Saldo',
            referenceId
        });

        res.json({ message: "⏳ Depósito informado. Esperando al Tesorero." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error procesando depósito." });
    }
};

// Solicitar Retiro Externo (Payout)
export const requestPayout = async (req, res) => {
    try {
        const { amount, cbu, alias } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!cbu && !alias) return res.status(400).json({ message: "Indica CBU o Alias." });

        const user = await User.findById(userId);
        if (user.balance < amount) return res.status(400).json({ message: "Saldo insuficiente en tu Bolsa." });

        // Descontamos del saldo inmediatamente (Reserva de fondos)
        user.balance -= amount;
        await user.save();

        await Transaction.create({
            user: userId,
            type: 'withdrawal_external',
            amount: Number(amount),
            status: 'pending',
            description: `Solicitud Retiro a: ${alias || cbu}`,
            referenceId: `OUT-${Date.now()}`
        });

        res.json({ message: "⏳ Solicitud enviada al Tesorero.", newBalance: user.balance });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error interno." });
    }
};

// ==========================================
// 2. LÓGICA DEL JUEGO (NIVELES Y CICLOS)
// ==========================================

export const buyLevel = async (req, res) => {
    try {
        const { level } = req.body; // Nivel 1, 2, 3...
        const userId = req.user.userId;

        // PRECIOS: Usamos importación o valores por defecto para seguridad
        const prices = LEVEL_PRICES || { 1: 10, 2: 20, 3: 50 };
        const price = prices[level];

        if (!price) return res.status(400).json({ error: "Nivel no existente." });

        const user = await User.findById(userId).populate('activeCycle');
        
        // Validaciones
        if (user.balance < price) return res.status(400).json({ error: "Oro insuficiente." });
        
        // Regla: No puedes comprar si tienes un ciclo activo incompleto
        if (user.activeCycle && user.activeCycle.progress < 100) {
            return res.status(400).json({ error: "Debes completar tu ciclo actual antes de recomprar." });
        }

        // 1. Cobrar
        user.balance -= price;
        user.level = level;
        
        // 2. Dar Fichas de Torneo (Bonus)
        const tokensMap = LEVEL_TOKENS || { 1: 5, 2: 10, 3: 25 };
        const tokens = tokensMap[level] || 0;
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

        // 4. Pagar Referidos (Comisiones Multinivel)
        if (user.referredBy) {
            await distributeCommissions(user.referredBy, price, 1);
        }

        // 5. Registrar Transacción
        await Transaction.create({
            user: userId,
            type: 'cycle_buy',
            amount: -price,
            status: 'completed',
            description: `Compra Nivel ${level}`
        });

        await user.save();
        res.json({ message: `🔥 Nivel ${level} adquirido. ¡Honor!`, cycle: newCycle, newBalance: user.balance });

    } catch (error) {
        console.error("Error buyLevel:", error);
        res.status(500).json({ error: "Error comprando nivel." });
    }
};

// Cosechar Ganancias (Harvest)
export const harvestEarnings = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('activeCycle');
        if (!user || !user.activeCycle) return res.status(400).json({ error: "No hay ciclo activo." });

        const cycle = await Cycle.findById(user.activeCycle._id);
        
        // Validación de ganancias
        if (cycle.earnings <= 0) return res.status(400).json({ error: "Nada para cosechar aún." });

        const amount = cycle.earnings;
        
        // Mover al saldo principal
        user.balance += amount;
        cycle.earnings = 0; // Reset a 0 tras cosechar
        
        // Si el ciclo terminó (100%), lo marcamos completed
        if (cycle.progress >= 100) {
            cycle.status = 'completed';
        }

        await cycle.save();
        await user.save();

        await Transaction.create({
            user: user._id,
            type: 'harvest',
            amount: amount,
            status: 'completed',
            description: `Cosecha Nivel ${cycle.level}`
        });

        res.json({ message: `🌾 Cosechados $${amount}`, newBalance: user.balance });

    } catch (error) {
        res.status(500).json({ error: "Error en cosecha." });
    }
};

// Función auxiliar recursiva para referidos (3 Niveles)
async function distributeCommissions(sponsorId, amount, depth) {
    if (depth > 3 || !sponsorId) return; 

    try {
        const sponsor = await User.findById(sponsorId);
        if (!sponsor) return;

        // Niveles: 10%, 5%, 2%
        const rates = [0.10, 0.05, 0.02]; 
        const commission = amount * rates[depth - 1];

        if (commission > 0) {
            sponsor.balance += commission;
            // Aseguramos que exista el objeto stats
            if (!sponsor.referralStats) sponsor.referralStats = { count: 0, totalEarned: 0 };
            sponsor.referralStats.totalEarned += commission;
            
            await sponsor.save();

            await Transaction.create({
                user: sponsorId,
                type: 'referral_bonus',
                amount: commission,
                status: 'completed',
                description: `Comisión Nivel ${depth}`
            });
        }

        // Subir al siguiente nivel
        if (sponsor.referredBy) {
            await distributeCommissions(sponsor.referredBy, amount, depth + 1);
        }
    } catch (e) {
        console.error("Error repartiendo referidos:", e);
    }
}

// ==========================================
// 3. GESTIÓN DE TESORERÍA (ADMIN)
// ==========================================

// Obtener Pendientes (Para la tabla del Admin)
export const getPendingTransactions = async (req, res) => {
    try {
        const pending = await Transaction.find({ status: "pending" })
            .populate("user", "ninjaName email")
            .sort({ createdAt: 1 });
            
        res.json(pending);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error obteniendo tesorería." });
    }
};

// Aprobar/Rechazar Transacción
export const manageDeposit = async (req, res) => {
    try {
        const { transactionId, action, comment } = req.body; 
        
        const tx = await Transaction.findById(transactionId).populate("user");
        if (!tx) return res.status(404).json({ error: "Transacción no encontrada." });
        if (tx.status !== "pending") return res.status(400).json({ error: "Esta transacción ya fue procesada." });

        if (action === "approve") {
            tx.status = "completed";
            tx.description += " (Aprobado)";
            
            // Si es depósito, AUMENTAMOS saldo
            if (tx.type === 'deposit') {
                const user = await User.findById(tx.user._id);
                user.balance += tx.amount;
                await user.save();
            }
            // Si es retiro, el saldo YA se descontó al solicitar, no hacemos nada más.

            await tx.save();
            res.json({ message: "✅ Operación aprobada." });

        } else {
            // RECHAZO
            tx.status = "rejected";
            tx.description += ` (Rechazado: ${comment || 'Sin motivo'})`;
            
            // Si era retiro y se rechaza, DEVOLVEMOS el dinero a la bolsa del usuario
            if (tx.type === 'withdrawal_external') {
                 const user = await User.findById(tx.user._id);
                 user.balance += tx.amount; 
                 await user.save();
            }

            await tx.save();
            res.json({ message: "❌ Operación rechazada." });
        }

    } catch (error) {
        console.error("Error manageDeposit:", error);
        res.status(500).json({ error: "Error interno gestionando fondos." });
    }
};

import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Cycle from "../models/Cycle.js"; 

// CONFIGURACIÓN
const PASS_TOKENS = 100;     
const PASS_TARGET = 50.00;   

// 1. OBTENER DATOS (Incluye bloqueo de retiro)
export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('activeCycle');
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        // Verificar si ya hay un retiro pendiente
        const pendingWithdrawal = await Transaction.findOne({ 
            user: req.user.userId, 
            type: 'withdrawal_external', 
            status: 'pending' 
        });

        res.json({ 
            balance: user.balance || 0, 
            tournamentTokens: user.tournamentTokens || 0,
            cycle: user.activeCycle || null,
            hasPendingWithdrawal: !!pendingWithdrawal, // true si hay uno pendiente
            history: await Transaction.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(10)
        });
    } catch (error) {
        res.status(500).json({ message: "Error interno." });
    }
};

// 2. SOLICITAR PASE (DEPOSITO)
export const requestDeposit = async (req, res) => {
    try {
        const { amount, referenceId } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!referenceId) return res.status(400).json({ message: "Falta ID comprobante." });

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Comprobante duplicado." });

        await Transaction.create({
            user: userId,
            type: 'deposit',
            amount: Number(amount),
            status: 'pending',
            description: 'Solicitud Activación Pase',
            referenceId
        });

        res.json({ message: "⏳ Solicitud enviada. Esperando al Shogun." });
    } catch (error) {
        res.status(500).json({ message: "Error procesando solicitud." });
    }
};

// 3. SOLICITAR RETIRO (Con Bloqueo y Validación)
export const requestPayout = async (req, res) => {
    try {
        const { amount, alias } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!alias) return res.status(400).json({ message: "Falta Alias/CBU." });

        // BLOQUEO: Si ya tiene uno pendiente, no deja pedir otro
        const pendingTx = await Transaction.findOne({ user: userId, type: 'withdrawal_external', status: 'pending' });
        if (pendingTx) {
            return res.status(400).json({ message: "⛔ Ya tienes un retiro en proceso. Espera aprobación." });
        }

        const user = await User.findById(userId);
        if ((user.balance || 0) < amount) {
            return res.status(400).json({ message: "Saldo insuficiente." });
        }

        user.balance -= amount;
        await user.save();

        await Transaction.create({
            user: userId,
            type: 'withdrawal_external',
            amount: Number(amount),
            status: 'pending',
            description: `Retiro a: ${alias}`,
            referenceId: `OUT-${Date.now()}`
        });

        res.json({ message: "✅ Retiro solicitado.", newBalance: user.balance });
    } catch (error) {
        res.status(500).json({ message: "Error interno." });
    }
};

// 4. ADMIN: APROBAR (El dinero NO va al saldo, va a la inversión del ciclo)
export const manageDeposit = async (req, res) => {
    try {
        const { transactionId, action } = req.body; 
        
        const tx = await Transaction.findById(transactionId).populate("user");
        if (!tx) return res.status(404).json({ error: "Tx no encontrada." });
        if (tx.status !== "pending") return res.status(400).json({ error: "Ya procesada." });

        if (action === "approve") {
            tx.status = "completed";
            
            if (tx.type === 'deposit') {
                const user = await User.findById(tx.user._id).populate('activeCycle');
                
                // 1. DAR FICHAS
                user.tournamentTokens = (user.tournamentTokens || 0) + PASS_TOKENS;

                // 2. ACTIVAR CICLO (El dinero se consume aquí)
                if (!user.activeCycle || (user.activeCycle.status && user.activeCycle.status === 'completed')) {
                    const newCycle = new Cycle({
                        user: user._id,
                        level: 1,
                        investedAmount: tx.amount, // Se registra la inversión
                        startTime: new Date(),
                        progress: 0,
                        earnings: 0, // Empieza en 0
                        targetAmount: PASS_TARGET, // Meta $50
                        status: 'active'
                    });
                    await newCycle.save();
                    user.activeCycle = newCycle._id;
                    tx.description = "Pase Activado (Inversión registrada)";
                } else {
                    // Solo si ya tiene pase activo, se suma al saldo (Recarga extra)
                    user.balance = (user.balance || 0) + tx.amount;
                    tx.description = "Recarga de Saldo";
                }
                
                await user.save();
                // Referidos
                try { if (user.referredBy) await distributeCommissions(user.referredBy, tx.amount, 1); } catch(e){}
            }
            
            await tx.save();
            res.json({ message: "✅ Aprobado." });

        } else {
            tx.status = "rejected";
            if (tx.type === 'withdrawal_external') { // Devolver dinero si se rechaza retiro
                 const user = await User.findById(tx.user._id);
                 if (user) { user.balance += tx.amount; await user.save(); }
            }
            await tx.save();
            res.json({ message: "❌ Rechazado." });
        }

    } catch (error) {
        console.error("Manage Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Auxiliares (Para no romper nada)
export const getPendingTransactions = async (req, res) => {
    try { const p = await Transaction.find({ status: "pending" }).populate("user", "ninjaName email").sort({ createdAt: 1 }); res.json(p); } catch (e) { res.status(500).json([]); }
};
async function distributeCommissions(sponsorId, amount, depth) {
    if (depth > 3 || !sponsorId) return;
    try {
        const sponsor = await User.findById(sponsorId);
        if(!sponsor) return;
        if(!sponsor.referralStats) sponsor.referralStats = { count:0, totalEarned:0 };
        const rates = [0.10, 0.05, 0.02];
        const comm = amount * rates[depth-1];
        if(comm > 0) {
            sponsor.balance += comm;
            sponsor.referralStats.totalEarned += comm;
            await sponsor.save();
            await Transaction.create({ user: sponsorId, type: 'referral_bonus', amount: comm, status: 'completed', description: 'Ref Bonus' });
        }
        if(sponsor.referredBy) await distributeCommissions(sponsor.referredBy, amount, depth+1);
    } catch(e) {}
}
export const buyLevel = async (req, res) => res.status(400).json({error: "Deprecated"});
export const harvestEarnings = async (req, res) => res.status(400).json({error: "Deprecated"});

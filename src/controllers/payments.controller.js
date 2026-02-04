import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Cycle from "../models/Cycle.js"; 

const PASS_TOKENS = 100;     
const PASS_TARGET = 50.00;   

// 1. OBTENER DATOS
export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('activeCycle');
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const pendingWithdrawal = await Transaction.findOne({ 
            user: req.user.userId, 
            type: 'withdrawal_external', 
            status: 'pending' 
        });

        res.json({ 
            balance: user.balance || 0, 
            tournamentTokens: user.tournamentTokens || 0,
            cycle: user.activeCycle || null,
            hasPendingWithdrawal: !!pendingWithdrawal,
            history: await Transaction.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(10)
        });
    } catch (error) {
        res.status(500).json({ message: "Error interno." });
    }
};

// 2. SOLICITAR PASE
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
            description: 'Solicitud Pase',
            referenceId
        });

        res.json({ message: "⏳ Enviado. Esperando al Shogun." });
    } catch (error) {
        res.status(500).json({ message: "Error procesando solicitud." });
    }
};

// 3. RETIRAR (Solo si hay saldo ganado)
export const requestPayout = async (req, res) => {
    try {
        const { amount, alias } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!alias) return res.status(400).json({ message: "Falta Alias." });

        const pendingTx = await Transaction.findOne({ user: userId, type: 'withdrawal_external', status: 'pending' });
        if (pendingTx) return res.status(400).json({ message: "⛔ Ya tienes un retiro pendiente." });

        const user = await User.findById(userId);
        if ((user.balance || 0) < amount) return res.status(400).json({ message: "Saldo insuficiente." });

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

// 4. ADMIN: APROBAR (CORREGIDO: SALDO NO AUMENTA)
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
                
                // A) DAR 100 FICHAS
                user.tournamentTokens = (user.tournamentTokens || 0) + PASS_TOKENS;

                // B) ACTIVAR CICLO (El dinero del depósito NO se suma al saldo)
                // Se registra solo como inversión en el objeto Cycle.
                if (!user.activeCycle || (user.activeCycle.status && user.activeCycle.status === 'completed')) {
                    const newCycle = new Cycle({
                        user: user._id,
                        level: 1,
                        investedAmount: tx.amount,
                        startTime: new Date(),
                        progress: 0,
                        earnings: 0, // Inicia en 0. Solo sube con Referidos/Juegos.
                        targetAmount: PASS_TARGET, 
                        status: 'active'
                    });
                    await newCycle.save();
                    user.activeCycle = newCycle._id;
                    tx.description = "Pase Activado (100 Fichas)";
                } 
                // NOTA: Si quisieras recargas de saldo directo, iría en un else aquí, 
                // pero por tu orden, el depósito del pase NO da saldo.
                
                await user.save();
                
                // Distribuir comisión al referido (Si aplica)
                try { if (user.referredBy) await distributeCommissions(user.referredBy, tx.amount, 1); } catch(e){}
            }
            
            await tx.save();
            res.json({ message: "✅ Aprobado. Fichas entregadas. Saldo en 0." });

        } else {
            tx.status = "rejected";
            if (tx.type === 'withdrawal_external') {
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

// Auxiliares
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
            sponsor.balance += comm; // AQUÍ SÍ SE SUMA AL SALDO (Ganancia por referido)
            sponsor.referralStats.totalEarned += comm;
            await sponsor.save();
            await Transaction.create({ user: sponsorId, type: 'referral_bonus', amount: comm, status: 'completed', description: 'Ref Bonus' });
        }
        if(sponsor.referredBy) await distributeCommissions(sponsor.referredBy, amount, depth+1);
    } catch(e) {}
}
export const buyLevel = async (req, res) => res.status(400).json({error: "Deprecated"});
export const harvestEarnings = async (req, res) => res.status(400).json({error: "Deprecated"});

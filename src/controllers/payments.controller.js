import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Cycle from "../models/Cycle.js"; 

// CONFIGURACIÓN TÁCTICA
const PASS_TOKENS = 100;     // Fichas al activar
const PASS_TARGET = 50.00;   // Meta final del ciclo
const WITHDRAW_STEP = 12.50; // Tramo mínimo para retirar

// 1. OBTENER DATOS Y VERIFICAR BLOQUEOS
export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('activeCycle');
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        // Verificar si hay retiro pendiente para bloquear el botón en el front
        const pendingWithdrawal = await Transaction.findOne({ 
            user: req.user.userId, 
            type: 'withdrawal_external', 
            status: 'pending' 
        });

        res.json({ 
            balance: user.balance || 0, 
            tournamentTokens: user.tournamentTokens || 0,
            cycle: user.activeCycle || null,
            hasPendingWithdrawal: !!pendingWithdrawal, // Booleano: true si hay pendiente
            history: await Transaction.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(10)
        });
    } catch (error) {
        console.error("Error Wallet:", error);
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
        if (exists) return res.status(400).json({ message: "Comprobante ya enviado." });

        await Transaction.create({
            user: userId,
            type: 'deposit',
            amount: Number(amount),
            status: 'pending',
            description: 'Solicitud Activación Pase',
            referenceId
        });

        res.json({ message: "⏳ Solicitud enviada al Shogun." });
    } catch (error) {
        res.status(500).json({ message: "Error procesando solicitud." });
    }
};

// 3. SOLICITAR RETIRO (CON BLOQUEO Y VALIDACIÓN DE TRAMO)
export const requestPayout = async (req, res) => {
    try {
        const { amount, alias } = req.body;
        const userId = req.user.userId;

        // Validaciones
        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!alias) return res.status(400).json({ message: "Falta Alias/CBU." });

        // 1. BLOQUEO: ¿Ya tiene uno pendiente?
        const pendingTx = await Transaction.findOne({ user: userId, type: 'withdrawal_external', status: 'pending' });
        if (pendingTx) {
            return res.status(400).json({ message: "⛔ Ya tienes un retiro en proceso. Espera la aprobación." });
        }

        const user = await User.findById(userId);
        
        // 2. Verificar Saldo
        if ((user.balance || 0) < amount) {
            return res.status(400).json({ message: "Saldo insuficiente." });
        }

        // 3. Ejecutar Descuento
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

        res.json({ message: "✅ Retiro solicitado. Esperando aprobación.", newBalance: user.balance });
    } catch (error) {
        console.error("Error Payout:", error);
        res.status(500).json({ message: "Error interno al retirar." });
    }
};

// 4. ADMIN: GESTIÓN DE PAGOS (CORREGIDO: DINERO NO VA A SALDO EN PASE)
export const manageDeposit = async (req, res) => {
    try {
        const { transactionId, action } = req.body; 
        
        const tx = await Transaction.findById(transactionId).populate("user");
        if (!tx) return res.status(404).json({ error: "Transacción no encontrada." });
        if (!tx.user) return res.status(404).json({ error: "Usuario no existe." });
        if (tx.status !== "pending") return res.status(400).json({ error: "Ya procesada." });

        if (action === "approve") {
            tx.status = "completed";
            
            if (tx.type === 'deposit') {
                const user = await User.findById(tx.user._id).populate('activeCycle');
                
                // A) ENTREGAR FICHAS SIEMPRE
                user.tournamentTokens = (user.tournamentTokens || 0) + PASS_TOKENS;

                // B) LÓGICA DEL DINERO
                // Si NO tiene ciclo activo (o el anterior terminó), el dinero PAGA el pase.
                // NO se suma al balance disponible.
                if (!user.activeCycle || (user.activeCycle.status && user.activeCycle.status === 'completed')) {
                    const newCycle = new Cycle({
                        user: user._id,
                        level: 1,
                        investedAmount: tx.amount, // El dinero queda registrado aquí
                        startTime: new Date(),
                        progress: 0,
                        earnings: 0, 
                        targetAmount: PASS_TARGET, // $50
                        status: 'active'
                    });
                    await newCycle.save();
                    user.activeCycle = newCycle._id;
                    tx.description = "Pase Activado (100 Fichas)";
                } else {
                    // Si YA tiene pase activo, asumimos que es una recarga extra de saldo.
                    // Aquí SÍ sumamos al balance.
                    user.balance = (user.balance || 0) + tx.amount;
                    tx.description = "Recarga de Saldo Extra";
                }
                
                await user.save();
                
                // Referidos (Opcional)
                try { if (user.referredBy) await distributeCommissions(user.referredBy, tx.amount, 1); } catch(e){}
            }
            
            await tx.save();
            res.json({ message: "✅ Aprobado." });

        } else {
            // RECHAZO
            tx.status = "rejected";
            // Si es retiro rechazado, devolvemos la plata al saldo
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
        res.status(500).json({ error: error.message });
    }
};

// Auxiliares obligatorios para que no rompa
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
    } catch(e) { console.error(e); }
}
// Rutas legacy
export const buyLevel = async (req, res) => res.status(400).json({error: "Use deposit"});
export const harvestEarnings = async (req, res) => res.status(400).json({error: "Use withdraw"});

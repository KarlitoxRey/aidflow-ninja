import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Cycle from "../models/Cycle.js"; 

const PASS_TOKENS = 100;     
const PASS_TARGET = 50.00;   

// 1. OBTENER DATOS (BILLETERA)
export const getWalletDetails = async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: "Token inválido." });
        }

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
            level: user.level || 0,        // <--- Importante enviar esto
            isActive: user.isActive || false, // <--- Importante enviar esto
            hasPendingWithdrawal: !!pendingWithdrawal,
            history: await Transaction.find({ user: req.user.userId }).sort({ createdAt: -1 }).limit(10)
        });
    } catch (error) {
        console.error("Error GetWallet:", error);
        res.status(500).json({ message: "Error interno." });
    }
};

// 2. SOLICITAR PASE (DEPOSITO)
export const requestDeposit = async (req, res) => {
    try {
        console.log("📥 Recibiendo depósito:", req.body);

        const { amount, referenceId } = req.body;
        const userId = req.user.userId;

        if (!amount) return res.status(400).json({ message: "Falta el monto." });
        if (!referenceId) return res.status(400).json({ message: "Falta ID comprobante." });

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Comprobante duplicado." });

        const newTx = await Transaction.create({
            user: userId,
            type: 'deposit',
            amount: Number(amount),
            status: 'pending',
            description: 'Solicitud Pase Nivel 1',
            referenceId: referenceId
        });

        console.log("✅ Depósito creado:", newTx._id);
        res.json({ message: "⏳ Enviado. Esperando al Shogun." });

    } catch (error) {
        console.error("❌ Error RequestDeposit:", error);
        res.status(500).json({ message: "Error al procesar.", error: error.message });
    }
};

// 3. RETIRAR FONDOS
export const requestPayout = async (req, res) => {
    try {
        const { amount, alias } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!alias) return res.status(400).json({ message: "Falta Alias." });

        const user = await User.findById(userId);
        if ((user.balance || 0) < amount) {
            return res.status(400).json({ message: "Saldo insuficiente." });
        }

        const pendingTx = await Transaction.findOne({ user: userId, type: 'withdrawal_external', status: 'pending' });
        if (pendingTx) return res.status(400).json({ message: "⛔ Ya tienes un retiro en proceso." });

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
        console.error("Error Payout:", error);
        res.status(500).json({ message: "Error procesando retiro." });
    }
};

// 4. ADMIN: GESTIONAR DEPÓSITOS (APROBAR/RECHAZAR)
export const manageDeposit = async (req, res) => {
    try {
        const { transactionId, action } = req.body; 
        
        const tx = await Transaction.findById(transactionId).populate("user");
        if (!tx) return res.status(404).json({ error: "Transacción no encontrada." });
        if (tx.status !== "pending") return res.status(400).json({ error: "Ya fue procesada." });

        if (action === "approve") {
            // === APROBAR Y ACTIVAR ===
            tx.status = "completed";
            
            if (tx.type === 'deposit') {
                const user = await User.findById(tx.user._id).populate('activeCycle');
                
                // 1. ACTIVACIÓN DEL NINJA (¡ESTO FALTABA!)
                user.isActive = true;  // <--- ¡CLAVE!
                user.level = 1;        // <--- ¡CLAVE!
                user.tournamentTokens = (user.tournamentTokens || 0) + PASS_TOKENS;

                // 2. Crear Ciclo
                if (!user.activeCycle || (user.activeCycle.status && user.activeCycle.status === 'completed')) {
                    const newCycle = new Cycle({
                        user: user._id,
                        level: 1,
                        investedAmount: tx.amount,
                        startTime: new Date(),
                        progress: 0,
                        earnings: 0,
                        targetAmount: PASS_TARGET, 
                        status: 'active'
                    });
                    await newCycle.save();
                    user.activeCycle = newCycle._id;
                    tx.description = "Pase Activado - Nivel 1";
                }
                
                await user.save();
                
                // 3. Comisiones Referidos
                if (user.referredBy) {
                    try { await distributeCommissions(user.referredBy, tx.amount, 1); } 
                    catch(e) { console.error("Error comisiones:", e); }
                }
            }
            
            await tx.save();
            res.json({ message: "✅ Aprobado. Usuario activado correctamente." });

        } else {
            // === RECHAZAR ===
            tx.status = "rejected";
            if (tx.type === 'withdrawal_external') {
                 const user = await User.findById(tx.user._id);
                 if (user) { 
                     user.balance += tx.amount; 
                     await user.save(); 
                 }
            }
            await tx.save();
            res.json({ message: "❌ Rechazado." });
        }

    } catch (error) {
        console.error("Manage Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// --- AUXILIARES ---

export const getPendingTransactions = async (req, res) => {
    try { 
        const p = await Transaction.find({ status: "pending" })
            .populate("user", "ninjaName email")
            .sort({ createdAt: 1 }); 
        res.json(p); 
    } catch (e) { res.status(500).json([]); }
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
            
            await Transaction.create({ 
                user: sponsorId, 
                type: 'referral_bonus', 
                amount: comm, 
                status: 'completed', 
                description: `Ref Bonus Nvl ${depth}` 
            });
        }
        
        if(sponsor.referredBy) await distributeCommissions(sponsor.referredBy, amount, depth+1);
    } catch(e) { console.error("Error ref recursive:", e); }
}

// Compatibilidad (Mantener para no romper rutas antiguas)
export const buyLevel = async (req, res) => res.status(400).json({error: "Usa endpoint deposit"});
export const harvestEarnings = async (req, res) => res.status(400).json({error: "Usa endpoint payout"});

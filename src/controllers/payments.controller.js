import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Cycle from "../models/Cycle.js"; 
import SystemWallet from "../models/SystemWallet.js"; 
import { ECONOMY_RULES } from "../config/economyRules.js"; 

const PASS_TOKENS = 100;     
const PASS_TARGET = 50.00;   

// 1. OBTENER DATOS
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

        res.json({ 
            balance: user.balance || 0, 
            tournamentTokens: user.tournamentTokens || 0,
            cycle: user.activeCycle || null,
            level: user.level || 0,        
            isActive: user.isActive || false, 
            // 👇 ESTO ES LO QUE FALTABA PARA EL PANEL 👇
            role: user.role || 'user', 
            // 👆 PERMITE AL FRONTEND SABER SI ERES SHOGUN 👆
            currentCycleAcc: user.currentCycleAcc || 0,
            hasPendingDeposit: !!pendingTx,
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
        const { amount, referenceId } = req.body;
        const userId = req.user.userId;

        if (!referenceId) return res.status(400).json({ message: "Falta ID comprobante." });

        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Comprobante duplicado." });

        await Transaction.create({
            user: userId,
            type: 'deposit',
            amount: Number(amount),
            status: 'pending',
            description: 'Solicitud Pase Nivel 1',
            referenceId: referenceId
        });

        res.json({ message: "Enviado." });
    } catch (error) {
        res.status(500).json({ message: "Error.", error: error.message });
    }
};

// 3. APROBAR PASE (ADMIN) - LOGICA FINANCIERA REFORZADA
export const manageDeposit = async (req, res) => {
    try {
        const { transactionId, action } = req.body; 
        
        const tx = await Transaction.findById(transactionId).populate("user");
        if (!tx) return res.status(404).json({ error: "TX no encontrada." });
        if (tx.status !== "pending") return res.status(400).json({ error: "Ya procesada." });

        if (action === "approve") {
            // === APROBAR Y DISTRIBUIR ===
            tx.status = "completed";
            
            // CASO A: DEPÓSITO (ACTIVACIÓN DE USUARIO)
            if (tx.type === 'deposit') {
                const user = await User.findById(tx.user._id).populate('activeCycle');
                const amount = tx.amount;

                // 1. ACTIVAR USUARIO
                user.isActive = true;  
                user.level = 1;        
                user.tournamentTokens = (user.tournamentTokens || 0) + PASS_TOKENS;
                user.currentCycleAcc = 0; 

                // 2. DISTRIBUIR FONDOS (MATH)
                const maintFee = amount * ECONOMY_RULES.FIXED_COSTS.MAINTENANCE; // 10%
                const daoFee = amount * ECONOMY_RULES.FIXED_COSTS.DAO_BASE;      // 5%
                const backupFee = amount * ECONOMY_RULES.FIXED_COSTS.BACKUP;     // 5%
                
                let referralFee = 0;
                
                // Calcular Referido
                if (user.referredBy) {
                    referralFee = amount * ECONOMY_RULES.REFERRAL_TIERS.LEVEL_1.BASE; // 10%
                }

                // El resto va al DAO/Micropagos
                const remainder = amount - (maintFee + daoFee + backupFee + referralFee);

                // 3. ACTUALIZAR BILLETERA DEL SISTEMA
                let sysWallet = await SystemWallet.findOne({ type: 'main' });
                if (!sysWallet) sysWallet = await SystemWallet.create({ type: 'main' });

                sysWallet.adminBalance += maintFee;
                sysWallet.daoBalance += (daoFee + remainder); 
                sysWallet.backupBalance += backupFee;
                sysWallet.totalIncome += amount;
                
                await sysWallet.save(); 

                // 4. PAGAR AL REFERIDO (Si existe)
                if (user.referredBy && referralFee > 0) {
                    const sponsor = await User.findById(user.referredBy);
                    if (sponsor) {
                        sponsor.balance += referralFee;
                        sponsor.totalEarnings = (sponsor.totalEarnings || 0) + referralFee;
                        await sponsor.save();
                        
                        await Transaction.create({
                            user: sponsor._id,
                            type: 'referral_bonus',
                            amount: referralFee,
                            status: 'completed',
                            description: `Comisión por ${user.ninjaName}`
                        });
                    }
                }

                await user.save();
            }
            
            await tx.save();
            res.json({ message: "✅ Transacción Aprobada y Fondos Distribuidos." });

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
            res.json({ message: "❌ Rechazada." });
        }

    } catch (error) {
        console.error("Manage Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// 4. RETIRAR FONDOS
export const requestPayout = async (req, res) => {
    try {
        const { amount, alias } = req.body;
        const userId = req.user.userId;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        
        const user = await User.findById(userId);
        const META_RETIRO = 30; // O usar ECONOMY_RULES.CYCLE_GOAL.LEVEL_1

        // Validación de Ciclo
        if (user.currentCycleAcc < META_RETIRO) {
            return res.status(403).json({ message: `Debes completar la meta de $${META_RETIRO} para retirar.` });
        }

        if ((user.balance || 0) < amount) {
            return res.status(400).json({ message: "Saldo insuficiente." });
        }

        const pendingTx = await Transaction.findOne({ user: userId, type: 'withdrawal_external', status: 'pending' });
        if (pendingTx) return res.status(400).json({ message: "Ya tienes un retiro en proceso." });

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

        res.json({ message: "Retiro solicitado." });

    } catch (error) {
        res.status(500).json({ message: "Error procesando retiro." });
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

export const buyLevel = async (req, res) => res.status(400).json({error: "Usa endpoint deposit"});
export const harvestEarnings = async (req, res) => res.status(400).json({error: "Usa endpoint payout"});
export const approveDeposit = manageDeposit;

import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

// ==========================================
// 💰 1. DETALLES DE LA BILLETERA (Dashboard)
// ==========================================
export const getWalletDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const history = await Transaction.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({ 
            balance: user.balance, 
            cycle: {
                target: user.cycleTarget,
                earnings: user.cycleEarnings,
                percent: user.cyclePercent
            },
            history 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error obteniendo datos financieros." });
    }
};

// ==========================================
// 📥 2. SOLICITAR DEPÓSITO (Usuario)
// ==========================================
export const requestDeposit = async (req, res) => {
    try {
        const { amount, referenceId } = req.body;
        const userId = req.user.id;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Monto inválido." });
        if (!referenceId) return res.status(400).json({ message: "Falta el ID de comprobante." });

        // Evitar duplicados
        const exists = await Transaction.findOne({ referenceId });
        if (exists) return res.status(400).json({ message: "Este comprobante ya fue procesado." });

        // Crear transacción pendiente
        await Transaction.create({
            user: userId,
            type: 'deposit_manual',
            amount: Number(amount),
            status: 'pending',
            description: 'Recarga MercadoPago (En Revisión)',
            referenceId
        });

        res.json({ message: "⏳ Comprobante enviado. El Shogun verificará tu tributo." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al reportar pago." });
    }
};

// ==========================================
// 🛒 3. COMPRAR PASE NINJA (Lógica restaurada)
// ==========================================
export const buyPass = async (req, res) => {
    try {
        const { level } = req.body; // Nivel 1, 2 o 3
        const userId = req.user.id;

        // Validar nivel
        if (![1, 2, 3].includes(level)) return res.status(400).json({ error: "Nivel inválido" });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "Guerrero no encontrado" });

        // Precios (Ejemplo: Nivel 1 = 10 USD, Nivel 2 = 20 USD, etc.)
        const cost = level * 10; 

        if (user.balance < cost) {
            return res.status(400).json({ error: "Saldo insuficiente. Recarga tu cuenta primero." });
        }

        // Ejecutar compra
        user.balance -= cost;
        user.hasNinjaPass = true;
        user.level = level;
        user.status = "active";
        
        // Iniciar Ciclo
        user.cycleTarget = cost * 2; // Ejemplo: El objetivo es doblar la inversión
        user.cycleEarnings = 0;
        user.cyclePercent = 0;

        await user.save();

        // Registrar transacción de gasto
        await Transaction.create({
            user: userId,
            type: 'purchase_pass',
            amount: -cost,
            status: 'completed',
            description: `Compra Pase Nivel ${level}`
        });

        res.json({ 
            message: `🥷 Pase de Nivel ${level} adquirido. Bienvenido al Clan.`,
            newBalance: user.balance
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al procesar el pase" });
    }
};

// ==========================================
// 💸 4. RETIRAR GANANCIAS (Usuario)
// ==========================================
export const withdrawCycle = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

        const amountToWithdraw = user.cycleEarnings;

        if (amountToWithdraw <= 0) {
            return res.status(400).json({ error: "No hay fondos disponibles para retiro." });
        }

        // Simular retiro (resetear ganancias y sumar a balance disponible o enviar fuera)
        // En este caso, lo pasamos al balance principal del usuario para que decida qué hacer
        user.balance += amountToWithdraw;
        user.cycleEarnings = 0;
        user.cyclePercent = 0; 
        
        await user.save();

        await Transaction.create({
            user: userId,
            type: 'withdrawal',
            amount: amountToWithdraw,
            status: 'completed',
            description: 'Retiro de ganancias del ciclo'
        });

        res.json({ 
            message: `✅ Ganancias de ${amountToWithdraw.toFixed(2)} transferidas a tu saldo principal.`,
            newBalance: user.balance 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error interno al procesar retiro" });
    }
};

// ==========================================
// 🛡️ 5. GESTIONAR DEPÓSITO (ADMIN)
// ==========================================
export const manageDeposit = async (req, res) => {
    try {
        if (req.user.role !== 'shogun') {
            return res.status(403).json({ message: "🚫 Acceso denegado." });
        }

        const { transactionId, action, comment } = req.body;
        
        const tx = await Transaction.findById(transactionId);
        if (!tx || tx.status !== 'pending') {
            return res.status(404).json({ message: "Transacción no válida." });
        }

        const user = await User.findById(tx.user);

        if (action === 'approve') {
            user.balance += tx.amount;
            await user.save();

            tx.status = 'completed';
            tx.description = 'Recarga Aprobada ✅';
            tx.adminComment = comment || "Aprobado por el Shogun";

            // Notificación vía Socket si está configurado
            const io = req.app.get('socketio');
            if(io) {
                io.to(user._id.toString()).emit('balanceUpdated', { 
                    newBalance: user.balance,
                    message: `✅ Tu recarga de ${tx.amount} NC ha sido aprobada.`
                });
            }

        } else if (action === 'reject') {
            tx.status = 'rejected';
            tx.description = 'Recarga Rechazada ❌';
            tx.adminComment = comment || "Comprobante inválido";
        }

        await tx.save();
        res.json({ message: `Operación ${action.toUpperCase()} exitosa`, status: tx.status });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error gestionando depósito." });
    }
};

// ==========================================
// 📜 6. OBTENER PENDIENTES (ADMIN)
// ==========================================
export const getPendingTransactions = async (req, res) => {
    try {
        if (req.user.role !== 'shogun') return res.status(403).json({ message: "Denegado." });
        
        const pending = await Transaction.find({ status: 'pending' })
            .populate('user', 'ninjaName email')
            .sort({ createdAt: 1 });
            
        res.json(pending);
    } catch (error) {
        res.status(500).json({ message: "Error obteniendo pendientes." });
    }
};
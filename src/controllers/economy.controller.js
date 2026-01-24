import User from "../models/User.js";
import Treasury from "../models/Treasury.js";
import Transaction from "../models/Transaction.js"; // Asumo que tenés un log de transacciones

// 💎 PROCESAR MICROPAGO DIARIO
export const processMicropayment = async (req, res) => {
    const { userId } = req.user; // Viene del token
    const COSTO_MICROPAGO = 10; // Ejemplo: 10 NC

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "Guerrero no encontrado" });

        if (user.balance < COSTO_MICROPAGO) {
            return res.status(400).json({ error: "Fondos insuficientes para el tributo." });
        }

        // 1. Descontar al Usuario
        user.balance -= COSTO_MICROPAGO;
        user.dailyPaid = true; // Flag para que no pague dos veces hoy
        await user.save();

        // 2. Ingresar al Arca del Clan (Treasury)
        // Buscamos la bóveda, si no existe la crea (upsert)
        const vault = await Treasury.findOneAndUpdate(
            { identifier: "MASTER_VAULT" },
            { 
                $inc: { 
                    balance: COSTO_MICROPAGO,
                    "revenueSources.micropayments": COSTO_MICROPAGO
                },
                $set: { lastUpdated: Date.now() }
            },
            { new: true, upsert: true } // Upsert crea si no existe
        );

        // 3. Registrar Transacción (Auditoría)
        await Transaction.create({
            user: userId,
            type: "MICROPAYMENT",
            amount: -COSTO_MICROPAGO,
            description: "Tributo diario al Clan",
            date: new Date()
        });

        res.json({ 
            message: "Tributo aceptado. Ciclo activado.", 
            newBalance: user.balance,
            vaultBalance: vault.balance // Solo para debug, no mostrar al usuario final
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en la red del Dojo." });
    }
};
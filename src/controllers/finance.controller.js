import mongoose from "mongoose";
import User from "../models/User.js";
import Treasury from "../models/Treasury.js";

// 📊 1. OBTENER ESTADO DEL ARCA (Admin)
export const getTreasuryStats = async (req, res) => {
    try {
        let vault = await Treasury.findOne({ identifier: "MASTER_VAULT" });
        if (!vault) vault = await Treasury.create({ identifier: "MASTER_VAULT" });
        res.json(vault);
    } catch (error) {
        res.status(500).json({ error: "Error al auditar el Arca." });
    }
};

// 🌍 2. DATOS PÚBLICOS (Dashboard)
export const getPublicStats = async (req, res) => {
    try {
        const vault = await Treasury.findOne({ identifier: "MASTER_VAULT" });
        res.json({
            dao: vault ? vault.funds.dao : 0,
            prizes: vault ? vault.funds.prizePool : 0
        });
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo datos públicos." });
    }
};

// 💰 3. CONFIRMAR DEPÓSITO (Lógica 3-1-3-3)
export const confirmDeposit = async (req, res) => {
    const { userId } = req.body; 
    
    // Transacción ACID (Todo o Nada)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Reglas de Negocio ($10 USD de Entrada)
        const ALLOCATION = {
            profit: 3,      // 30% Mantenimiento
            dao: 1,         // 10% DAO
            micro: 3,       // 30% Micropagos
            prize: 3        // 30% Premios
        };
        const CREDITS_MINTED = 100; // 100 NC al usuario

        // A. Actualizar Bóveda
        await Treasury.findOneAndUpdate(
            { identifier: "MASTER_VAULT" },
            {
                $inc: {
                    "funds.profit": ALLOCATION.profit,
                    "funds.dao": ALLOCATION.dao,
                    "funds.microBudget": ALLOCATION.micro,
                    "funds.prizePool": ALLOCATION.prize,
                    "circulatingSupply": CREDITS_MINTED
                },
                $set: { lastUpdated: new Date() }
            },
            { new: true, upsert: true, session }
        );

        // B. Acreditar al Usuario
        const user = await User.findByIdAndUpdate(userId, 
            { 
                $inc: { balance: CREDITS_MINTED },
                $set: { 
                    status: "active",
                    ninjaPassActive: true, // Activa el pase
                    level: 1 // Sube a nivel 1 por defecto al pagar
                } 
            },
            { new: true, session }
        );

        if (!user) throw new Error("Usuario no encontrado");

        await session.commitTransaction();
        session.endSession();

        res.json({ message: "✅ Depósito confirmado. Fondos distribuidos (3-1-3-3)." });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error financiero:", error);
        res.status(500).json({ error: "Transacción revertida por seguridad." });
    }
};
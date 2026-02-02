import mongoose from "mongoose";
import User from "../models/User.js";
import Treasury from "../models/Treasury.js";

// 📊 1. AUDITAR EL ARCA (Solo Shogun)
export const getTreasuryStats = async (req, res) => {
    try {
        const vault = await Treasury.findOne({ identifier: "MASTER_VAULT" });
        res.json(vault || { message: "Arca vacía, esperando primer depósito." });
    } catch (error) {
        res.status(500).json({ error: "Error al auditar el Arca." });
    }
};

// 💰 2. CONFIRMAR DEPÓSITO (Lógica 3-1-3-3)
export const confirmDeposit = async (req, res) => {
    const { userId } = req.body; 
    
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const ALLOCATION = { profit: 3, dao: 1, micro: 3, prize: 3 };
        const CREDITS_MINTED = 100; // 100 Ninja Credits (NC)

        // A. Actualizar Bóveda Global
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
            { upsert: true, session }
        );

        // B. Acreditar al Usuario y activar su rango
        const user = await User.findByIdAndUpdate(userId, 
            { 
                $inc: { balance: CREDITS_MINTED },
                $set: { 
                    status: "active",
                    ninjaPassActive: true,
                    level: 1 
                } 
            },
            { new: true, session }
        );

        if (!user) throw new Error("Guerrero no encontrado");

        await session.commitTransaction();
        res.json({ 
            message: "✅ Depósito confirmado. Rango Nivel 1 activado.",
            newBalance: user.balance 
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ error: "Falla en la cámara del tesoro: " + error.message });
    } finally {
        session.endSession();
    }
};

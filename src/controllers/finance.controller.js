import mongoose from "mongoose";
import User from "../models/User.js";
import Treasury from "../models/Treasury.js";
import SystemWallet from "../models/SystemWallet.js";
import Transaction from "../models/Transaction.js";

// 📊 1. AUDITAR EL ARCA (Solo Shogun)
export const getTreasuryStats = async (req, res) => {
    try {
        const vault = await Treasury.findOne({ identifier: "MASTER_VAULT" });
        res.json(vault || { message: "Arca vacía, esperando primer depósito." });
    } catch (error) {
        res.status(500).json({ error: "Error al auditar el Arca." });
    }
};

// 💰 2. CONFIRMAR DEPÓSITO (Lógica existente)
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

        // B. Acreditar al Usuario
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

// 📊 3. DASHBOARD MAESTRO DEL SHOGUN (NUEVO)
export const getAdminDashboard = async (req, res) => {
    try {
        // A. Obtener Fondos (Desde SystemWallet donde guardamos la economía real)
        let wallet = await SystemWallet.findOne({ type: 'main' });
        if (!wallet) {
            wallet = { daoBalance: 0, adminBalance: 0, backupBalance: 0, totalIncome: 0 };
        }

        // B. Contadores de Usuarios
        const activeUsers = await User.countDocuments({ isActive: true });
        const totalUsers = await User.countDocuments({});

        // C. Rendimiento Hoy (Ingresos desde las 00:00hs)
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);
        const incomeToday = await Transaction.aggregate([
            { $match: { 
                type: 'deposit', 
                status: 'completed', 
                updatedAt: { $gte: startOfDay } 
            }},
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        // D. Historial de Movimientos (Últimos 20)
        const history = await Transaction.find({
            status: 'completed',
            type: { $in: ['deposit', 'withdrawal_external'] }
        })
        .populate('user', 'ninjaName email level')
        .sort({ updatedAt: -1 })
        .limit(20);

        res.json({
            funds: {
                dao: wallet.daoBalance || 0,
                admin: wallet.adminBalance || 0,
                backup: wallet.backupBalance || 0,
                total: wallet.totalIncome || 0
            },
            stats: {
                active: activeUsers,
                total: totalUsers,
                today: incomeToday[0]?.total || 0
            },
            history: history
        });

    } catch (error) {
        console.error("Error Admin Dashboard:", error);
        res.status(500).json({ error: "No se pudieron cargar los datos del Shogun." });
    }
};

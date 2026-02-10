import mongoose from "mongoose";
import User from "../models/User.js";
import Treasury from "../models/Treasury.js"; // Lo mantenemos por si lo usas en otro lado
// 👇 AGREGAMOS ESTOS IMPORTES NECESARIOS
import SystemWallet from "../models/SystemWallet.js";
import Transaction from "../models/Transaction.js";

// ... (Tu código existente: getTreasuryStats, confirmDeposit... DÉJALOS IGUAL) ...

// 👇 AGREGAR ESTA NUEVA FUNCIÓN AL FINAL DEL ARCHIVO 👇

// 📊 3. DASHBOARD MAESTRO DEL SHOGUN (Datos Reales)
export const getAdminDashboard = async (req, res) => {
    try {
        // A. Obtener Fondos (Desde SystemWallet donde guarda payments.controller)
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
        // Traemos depósitos aprobados y retiros
        const history = await Transaction.find({
            status: { $in: ['completed', 'pending'] }, // Queremos ver pendientes también en la lista general? O solo completed.
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
        res.status(500).json({ error: "No se pudieron cargar los pergaminos contables." });
    }
};

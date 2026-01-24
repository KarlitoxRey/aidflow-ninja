import Mission from "../models/Mission.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

// ==========================================
// 📜 LISTAR MISIONES DISPONIBLES
// ==========================================
export const getMissions = async (req, res) => {
    try {
        // En un futuro podrías filtrar las que el usuario ya hizo
        const missions = await Mission.find({ active: true });
        res.json(missions);
    } catch (error) {
        res.status(500).json({ message: "Error cargando el pergamino de misiones." });
    }
};

// ==========================================
// ✅ COMPLETAR MISIÓN (RECLAMAR RECOMPENSA)
// ==========================================
export const completeMission = async (req, res) => {
    try {
        const { missionId } = req.body;
        const userId = req.user.id;

        const mission = await Mission.findById(missionId);
        if (!mission || !mission.active) {
            return res.status(404).json({ message: "Misión no encontrada o expirada." });
        }

        // Aquí podrías validar si ya la completó hoy (requiere lógica extra en DB)
        // Por ahora, asumimos que el frontend controla la visualización

        const user = await User.findById(userId);
        user.balance += mission.reward;
        await user.save();

        // Registrar transacción
        await Transaction.create({
            user: userId,
            type: 'daily_bonus', // O crear un tipo 'mission_reward'
            amount: mission.reward,
            status: 'completed',
            description: `Misión completada: ${mission.title}`
        });

        res.json({ 
            message: `⚔️ Misión cumplida. Has ganado ${mission.reward} NC.`, 
            newBalance: user.balance 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al completar la misión." });
    }
};

// ==========================================
// 🛡️ CREAR MISIÓN (SOLO SHOGUN)
// ==========================================
export const createMission = async (req, res) => {
    try {
        if (req.user.role !== 'shogun') {
            return res.status(403).json({ message: "Solo el Shogun puede dictar misiones." });
        }

        const { title, description, reward, type } = req.body;
        
        const newMission = new Mission({ title, description, reward, type });
        await newMission.save();

        res.status(201).json(newMission);
    } catch (error) {
        res.status(500).json({ message: "Error creando misión." });
    }
};
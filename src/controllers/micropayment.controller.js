import Cycle from "../models/Cycle.js";
import User from "../models/User.js";
import MicropaymentLog from "../models/MicropaymentLog.js";

export const giveMicropayment = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate("activeCycle");
        
        if (!user.activeCycle || user.activeCycle.status !== 'active') {
            return res.status(400).json({ message: "No tenés un ciclo activo para procesar pagos." });
        }

        const cycle = await Cycle.findById(user.activeCycle._id);

        // Lógica de simulación: Cada pago suma $0.50 (según tu Nivel 1)
        const paymentAmount = 0.50; 

        // 1. Aumentamos el progreso del ciclo
        cycle.earnedAmount += paymentAmount;

        // 2. Si llegó al objetivo, cerramos ciclo
        if (cycle.earnedAmount >= cycle.targetAmount) {
            cycle.status = 'completed';
            cycle.completedAt = Date.now();
            user.activeCycle = null; // Liberamos al usuario para el siguiente nivel
            user.level = user.level < 3 ? user.level + 1 : 3; // Sube de nivel
        }

        // 3. Registramos el Log (Historial)
        await MicropaymentLog.create({
            userId: user._id,
            amount: paymentAmount,
            eventType: "ayuda_mutua",
            status: "completed"
        });

        await cycle.save();
        await user.save();

        res.json({ 
            message: cycle.status === 'completed' ? "¡Ciclo completado, Ninja! Ascendiste." : "Micropago procesado.",
            cycle 
        });

    } catch (error) {
        res.status(500).json({ message: "Error en el sistema de micropagos." });
    }
};
import Cycle from "../models/Cycle.js";
import User from "../models/User.js";
import Dao from "../models/Dao.js";

export const startCycle = async (req, res) => {
  try {
    // IMPORTANTE: Asegurate que tu authMiddleware use 'userId'
    const user = await User.findById(req.user.userId); 
    if (!user) return res.status(404).json({ error: "Ninja no encontrado en el templo." });

    if (user.activeCycle) {
      return res.status(400).json({ error: "Ya tienes un combate (ciclo) en curso." });
    }

    // Configuración de niveles (Escalabilidad Ninja)
    const levels = {
      0: { cost: 10, target: 50 }, // Nivel inicial
      1: { cost: 20, target: 100 },
      2: { cost: 40, target: 200 }
    };

    const config = levels[user.level || 0];
    
    if (user.balance < config.cost) {
      return res.status(400).json({ 
        error: `Balance insuficiente. Necesitas NC ${config.cost} para el Nivel ${user.level || 0}.` 
      });
    }

    // 💰 DISTRIBUCIÓN 40/30/30
    const daoShare = config.cost * 0.40;
    const poolShare = config.cost * 0.30;
    const devShare = config.cost * 0.30;

    // Crear el Ciclo
    const cycle = await Cycle.create({
      user: user._id,
      level: user.level || 0,
      targetAmount: config.target,
      earnedAmount: 0,
      cost: config.cost,
      daoContribution: daoShare,
      status: "active"
    });

    // Actualizar Guerrero
    user.balance -= config.cost;
    user.activeCycle = cycle._id;
    await user.save();

    // Alimentar la Gran Tesorería (DAO)
    await Dao.findOneAndUpdate(
      { isTreasuryRecord: true },
      { $inc: { totalReserve: daoShare, poolMicropayments: poolShare } },
      { upsert: true, new: true }
    );

    res.status(201).json({
      message: "Ciclo forjado con éxito.",
      cycle,
      balance: user.balance
    });

  } catch (error) {
    console.error("❌ Error Cycle Start:", error);
    res.status(500).json({ error: "Falla en la cámara de ciclos." });
  }
};

export const getActiveCycle = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate("activeCycle");
    res.json({ cycle: user?.activeCycle || null });
  } catch (error) {
    res.status(500).json({ error: "Error al consultar el oráculo." });
  }
};

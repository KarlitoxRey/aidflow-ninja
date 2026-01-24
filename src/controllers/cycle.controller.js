import Cycle from "../models/Cycle.js";
import User from "../models/User.js";
import Dao from "../models/Dao.js";

export const startCycle = async (req, res) => {
  try {
    // Esto ahora funcionará porque el middleware setea req.user
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Ninja no encontrado" });

    if (user.activeCycle) {
      return res.status(400).json({ message: "Ya tenés un combate (ciclo) en curso." });
    }

    // 1. Configuración de Costos
    const levels = {
      1: { cost: 10, target: 50 },
      2: { cost: 20, target: 100 },
      3: { cost: 40, target: 200 }
    };

    const config = levels[user.level || 1];
    if (!config) return res.status(400).json({ message: "Nivel de usuario inválido" });

    // 2. Validación de Saldo
    if (user.balance < config.cost) {
      return res.status(400).json({ message: `Necesitás NC ${config.cost} para iniciar Nivel ${user.level}` });
    }

    // 3. CÁLCULO DE DISTRIBUCIÓN (40/30/30)
    const daoShare = config.cost * 0.40;
    const poolShare = config.cost * 0.30;
    const devShare = config.cost * 0.30;

    // Ejecutar Cobro
    user.balance -= config.cost;

    // Crear Ciclo
    const cycle = await Cycle.create({
      user: user._id,
      level: user.level,
      targetAmount: config.target,
      earnedAmount: 0,
      cost: config.cost,
      daoContribution: daoShare,
      micropaymentPool: poolShare,
      maintenanceFee: devShare, 
      status: "active"
    });

    // 4. Alimentar DAO
    await Dao.findOneAndUpdate(
      { isTreasuryRecord: true },
      { $inc: { totalReserve: daoShare } },
      { upsert: true }
    );

    user.activeCycle = cycle._id;
    await user.save();

    res.json({
      message: `¡Nivel ${user.level} iniciado! Aportes: DAO $${daoShare} | Misiones $${poolShare}`,
      cycle,
      newBalance: user.balance
    });

  } catch (error) {
    console.error("Start cycle error:", error);
    res.status(500).json({ message: "Error al iniciar ciclo económico" });
  }
};

export const getActiveCycle = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("activeCycle");
    if (!user || !user.activeCycle) {
      return res.json({ cycle: null });
    }
    res.json({ cycle: user.activeCycle });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener ciclo activo" });
  }
};
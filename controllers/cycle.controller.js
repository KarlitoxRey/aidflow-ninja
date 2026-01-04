import Cycle from "../models/Cycle.js";
import User from "../models/User.js";

export const joinCycle = async (req, res) => {
  const { level, totalAmount } = req.body;
  try {
    const cycle = await Cycle.create({
      userId: req.userId,
      level,
      totalAmount,
      partsCompleted: 0,
      withdrawnParts: 0,
      progressPercent: 0,
      active: true
    });
    await User.findByIdAndUpdate(req.userId, { activeCycle: cycle._id });
    res.json({ message: "Ciclo iniciado", cycle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getMyCycle = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("activeCycle");
    res.json({ cycle: user.activeCycle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const withdraw = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("activeCycle");
    const cycle = user.activeCycle;
    if (!cycle) return res.status(400).json({ error: "No hay ciclo activo" });

    const canWithdraw = cycle.partsCompleted > cycle.withdrawnParts;
    if (!canWithdraw) return res.status(400).json({ error: "No puedes retirar aún" });

    const amountPerPart = cycle.totalAmount / 4;
    const withdrawAmount = amountPerPart * (cycle.partsCompleted - cycle.withdrawnParts);

    cycle.withdrawnParts = cycle.partsCompleted;
    await cycle.save();

    res.json({ message: "Retiro aprobado", amount: withdrawAmount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

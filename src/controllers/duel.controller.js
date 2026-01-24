import Duel from "../models/Duel.js";

export const createDuel = async (req, res) => {
  const { opponentId, betAmount } = req.body;
  try {
    const duel = await Duel.create({
      playerA: req.userId,
      playerB: opponentId,
      betAmount,
      winnerId: null,
      daoFee: betAmount * 0.05
    });
    res.json({ message: "Duelo creado", duel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const resolveDuel = async (req, res) => {
  const { id } = req.params;
  const { winnerId } = req.body;
  try {
    const duel = await Duel.findById(id);
    duel.winnerId = winnerId;
    duel.resolvedAt = new Date();
    await duel.save();
    res.json({ message: "Duelo resuelto", duel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

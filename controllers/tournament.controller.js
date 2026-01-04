import Tournament from "../models/Tournament.js";

export const createTournament = async (req, res) => {
  const { name, type, prizePool, startsAt, endsAt } = req.body;
  try {
    const tournament = await Tournament.create({
      name, type, prizePool, startsAt, endsAt, active: true, leaderboard: []
    });
    res.json({ message: "Torneo creado", tournament });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getActiveTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.find({ active: true });
    res.json({ tournaments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

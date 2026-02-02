import Duel from "../models/Duel.js";
import User from "../models/User.js";
import Treasury from "../models/Treasury.js";
import mongoose from "mongoose";

// ⚔️ CREAR EL RETO (Resta balance al creador)
export const createDuel = async (req, res) => {
    const { amount } = req.body;
    const userId = req.user.userId;

    try {
        const user = await User.findById(userId);
        if (user.balance < amount) return res.status(400).json({ error: "No tienes suficiente oro." });

        // Escrow: Congelar fondos
        user.balance -= amount;
        await user.save();

        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const duel = await Duel.create({
            challenger: userId,
            betAmount: amount,
            roomCode
        });

        res.status(201).json({ message: "Duelo publicado en la Arena.", duel });
    } catch (error) {
        res.status(500).json({ error: "Falla al forjar el duelo." });
    }
};

// 🤝 ACEPTAR EL RETO (Resta balance al oponente)
export const acceptDuel = async (req, res) => {
    const { duelId } = req.params;
    const userId = req.user.userId;

    try {
        const duel = await Duel.findById(duelId);
        if (!duel || duel.status !== "waiting") return res.status(400).json({ error: "El duelo ya no está disponible." });
        if (duel.challenger.equals(userId)) return res.status(400).json({ error: "No puedes pelear contra ti mismo." });

        const opponent = await User.findById(userId);
        if (opponent.balance < duel.betAmount) return res.status(400).json({ error: "Oro insuficiente para el reto." });

        opponent.balance -= duel.betAmount;
        await opponent.save();

        duel.opponent = userId;
        duel.status = "active";
        await duel.save();

        res.json({ message: "¡Duelo aceptado! Entrando a la Arena...", duel });
    } catch (error) {
        res.status(500).json({ error: "Error al entrar al combate." });
    }
};

// 🏆 RESOLVER DUELO (Reparte botín y cobra comisión)
export const resolveDuel = async (req, res) => {
    const { duelId, winnerId } = req.body; 
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const duel = await Duel.findById(duelId).session(session);
        if (duel.status !== "active") throw new Error("Combate no válido para resolución.");

        const totalPool = duel.betAmount * 2;
        const clanFee = totalPool * 0.10; // 10% de comisión
        const prize = totalPool - clanFee;

        // 1. Pagar al Ganador
        await User.findByIdAndUpdate(winnerId, { $inc: { balance: prize } }, { session });

        // 2. Nutrir el Arca (Treasury)
        await Treasury.findOneAndUpdate(
            { identifier: "MASTER_VAULT" },
            { $inc: { "funds.profit": clanFee } },
            { session }
        );

        duel.status = "completed";
        duel.winner = winnerId;
        duel.feeAmount = clanFee;
        await duel.save({ session });

        await session.commitTransaction();
        res.json({ message: "Botín entregado. El Clan prospera.", prize });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ error: error.message });
    } finally {
        session.endSession();
    }
};

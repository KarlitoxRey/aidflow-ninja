import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import Score from "../models/Score.js";
import Tournament from "../models/Tournament.js";

const router = express.Router();

/**
 * 🎯 ENVIAR PUNTAJE
 * Se ejecuta al terminar partida. 
 * REQUIERE: Estar logueado Y estar inscrito en el torneo.
 */
router.post("/submit-score", authMiddleware, async (req, res) => {
    try {
        const { tournamentId, gameId, points } = req.body;

        // 1. Validaciones básicas de datos
        if (!points || isNaN(points) || points < 0) {
            return res.status(400).json({ message: "Puntaje inválido" });
        }

        // 2. Buscar el torneo
        const tournament = await Tournament.findById(tournamentId);

        if (!tournament) {
            return res.status(404).json({ message: "Torneo no encontrado" });
        }

        // 3. 🛑 VALIDACIÓN CRÍTICA: ¿El torneo está activo?
        if (tournament.status !== 'active') {
            return res.status(400).json({ message: "Este torneo no acepta nuevos combates (Estado: " + tournament.status + ")" });
        }

        // 4. 🛑 VALIDACIÓN DE HONOR: ¿El usuario pagó la entrada?
        // Verificamos si el ID del usuario está en la lista de jugadores inscritos
        const isRegistered = tournament.players.includes(req.user._id);
        
        if (!isRegistered) {
            return res.status(403).json({ message: "⛔ Acceso denegado: No estás inscrito en este torneo." });
        }

        // 5. Guardar el puntaje en el historial
        const newScore = new Score({
            user: req.user._id,
            tournament: tournamentId,
            game: gameId, // Opcional si el torneo solo tiene un juego, pero bueno para futuro
            points: Number(points),
            createdAt: new Date()
        });

        await newScore.save();

        res.status(201).json({ 
            message: "⚔️ Golpe registrado con éxito", 
            points: newScore.points 
        });

    } catch (error) {
        console.error("Error en submit-score:", error);
        res.status(500).json({ message: "Error interno al registrar el combate." });
    }
});

/**
 * 📊 OBTENER RANKING (Leaderboard)
 * Devuelve los mejores puntajes absolutos.
 */
router.get("/ranking/:tournamentId", async (req, res) => {
    try {
        const scores = await Score.find({ tournament: req.params.tournamentId })
            .populate("user", "ninjaName") // Traemos solo el nombre del ninja
            .sort({ points: -1 })          // Orden descendente (Mayor a menor)
            .limit(20);                    // Top 20 para el scroll

        res.json(scores);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al leer el pergamino de rankings" });
    }
});

/**
 * 👤 MI MEJOR PUNTAJE (Para mostrarle al usuario su posición personal)
 */
router.get("/my-best/:tournamentId", authMiddleware, async (req, res) => {
    try {
        // Buscamos el puntaje más alto de ESTE usuario en ESTE torneo
        const bestScore = await Score.findOne({ 
            tournament: req.params.tournamentId, 
            user: req.user._id 
        })
        .sort({ points: -1 }); // El más alto primero

        if (!bestScore) {
            return res.json({ points: 0, message: "Aún no has combatido" });
        }

        res.json({ points: bestScore.points });
    } catch (error) {
        res.status(500).json({ message: "Error obteniendo tu historial" });
    }
});

export default router;
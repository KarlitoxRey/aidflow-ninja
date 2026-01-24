import Tournament from "../models/Tournament.js";
import Score from "../models/Score.js";
import Game from "../models/Game.js"; 

// ==========================================
// 📜 LISTAR TORNEOS
// ==========================================
export const getTournaments = async (req, res) => {
    try {
        const tournaments = await Tournament.find()
            .populate('game', 'title thumbnail') 
            .sort({ createdAt: -1 });
        res.json(tournaments);
    } catch (error) {
        res.status(500).json({ message: "Error obteniendo torneos." });
    }
};

// ==========================================
// 🏆 OBTENER RANKING
// ==========================================
export const getRanking = async (req, res) => {
    try {
        const scores = await Score.find({ tournament: req.params.tournamentId })
            .populate("user", "ninjaName") 
            .sort({ points: -1 }) 
            .limit(10); 

        res.json(scores);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener el ranking" });
    }
};

// ==========================================
// 🎯 REGISTRAR PUNTAJE
// ==========================================
export const submitScore = async (req, res) => {
    try {
        const { tournamentId, points } = req.body;
        // Obtenemos ID del usuario desde el token decodificado
        const userId = req.user.id || req.user._id; 

        // 1. Validar torneo
        const tournament = await Tournament.findById(tournamentId);
        
        if (!tournament || tournament.status !== 'active') { 
             return res.status(400).json({ message: "⛔ El torneo no está activo o ha finalizado." });
        }

        // 2. Guardar el puntaje
        const newScore = new Score({
            user: userId,
            tournament: tournamentId,
            game: tournament.game,
            points: Number(points)
        });

        await newScore.save();
        
        // 3. Agregar al jugador a la lista de participantes si no estaba
        if (!tournament.players.includes(userId)) {
            tournament.players.push(userId);
            await tournament.save();
        }

        res.json({ message: "✅ Puntaje registrado con honor", points });
    } catch (error) {
        console.error("Error submitScore:", error);
        res.status(500).json({ message: "Error al registrar puntaje" });
    }
};

// ==========================================
// 🛡️ CREAR TORNEO (SOLO SHOGUN)
// ==========================================
export const createTournament = async (req, res) => {
    try {
        // Verificamos rol
        if (req.user.role !== 'shogun') {
            return res.status(403).json({ message: "🚫 Acceso denegado. Solo Shogun." });
        }

        const { name, entryFee, prize, gameId, startDate, endDate } = req.body;

        if (!gameId || !startDate || !endDate) {
            return res.status(400).json({ message: "Faltan datos (Juego o Fechas)" });
        }
        
        const newTournament = new Tournament({ 
            name, 
            entryFee, 
            prize,
            game: gameId, 
            startDate,
            endDate,
            status: 'active', 
            createdBy: req.user.id
        });
        
        await newTournament.save();
        res.status(201).json(newTournament);
    } catch (error) {
        console.error("Error createTournament:", error);
        res.status(500).json({ message: "Error creando torneo." });
    }
};
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
        const userId = req.user.id || req.user._id; 

        const tournament = await Tournament.findById(tournamentId);
        if (!tournament) return res.status(404).json({ message: "Torneo no encontrado" });
        if (tournament.status !== 'active') return res.status(400).json({ message: "Torneo finalizado" });

        let score = await Score.findOne({ tournament: tournamentId, user: userId });

        if (score) {
            if (points > score.points) {
                score.points = points;
                await score.save();
            }
        } else {
            score = new Score({ tournament: tournamentId, user: userId, points });
            await score.save();
        }

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
        if (req.user.role !== 'shogun' && req.user.role !== 'admin') {
            return res.status(403).json({ message: "🚫 Acceso denegado. Solo Shogun." });
        }

        const { name, entryFee, prize, gameId, startDate, endDate, maxWinners, gameType } = req.body;

        // Validación básica
        if (!name || !entryFee) {
            return res.status(400).json({ message: "Faltan datos básicos (Nombre o Entrada)" });
        }
        
        const newTournament = new Tournament({ 
            name, 
            entryFee, 
            prizePool: prize, 
            game: gameId || null, 
            startDate: startDate || new Date(),
            endDate: endDate || new Date(Date.now() + 7*24*60*60*1000), 
            status: 'active', 
            createdBy: req.user.id, 
            maxWinners: maxWinners || 1, 
            gameType: gameType || 'Mixed' 
        });
        
        await newTournament.save();
        res.status(201).json(newTournament);
    } catch (error) {
        console.error("Error createTournament:", error);
        res.status(500).json({ message: "Error al crear torneo" });
    }
};

// ==========================================
// 🗑️ ELIMINAR TORNEO
// ==========================================
export const deleteTournament = async (req, res) => {
    try {
        if (req.user.role !== 'shogun' && req.user.role !== 'admin') return res.status(403).json({ message: "Denegado" });
        
        await Tournament.findByIdAndDelete(req.params.id);
        res.json({ message: "Torneo eliminado" });
    } catch (error) {
        res.status(500).json({ message: "Error al eliminar" });
    }
};

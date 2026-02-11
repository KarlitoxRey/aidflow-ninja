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
// 🛡️ CREAR TORNEO (SOLO SHOGUN)
// ==========================================
export const createTournament = async (req, res) => {
    try {
        if (req.user.role !== 'shogun' && req.user.role !== 'admin') {
            return res.status(403).json({ message: "🚫 Acceso denegado. Solo Shogun." });
        }

        const { name, entryFee, prize, gameId, startDate, endDate, maxWinners, gameType } = req.body;

        if (!name || !entryFee || !gameId || !prize) {
            return res.status(400).json({ message: "Faltan datos básicos (Nombre, Entrada, Juego o Premio)" });
        }
        
        const newTournament = new Tournament({ 
            name, 
            entryFee, 
            prize,   // 👈 corregido: coincide con el schema
            game: gameId, 
            startDate: startDate || new Date(),
            endDate: endDate || new Date(Date.now() + 7*24*60*60*1000), 
            status: 'active', 
            createdBy: req.user.userId, 
            maxWinners: maxWinners || 1, 
            gameType: gameType || 'Mixed' 
        });
        
        await newTournament.save();
        res.status(201).json(newTournament);
    } catch (error) {
        console.error("Error createTournament:", error);
        res.status(500).json({ message: "Error al crear torneo: " + error.message });
    }
};

// ==========================================
// 🗑️ ELIMINAR TORNEO
// ==========================================
export const deleteTournament = async (req, res) => {
    try {
        if (req.user.role !== 'shogun' && req.user.role !== 'admin') 
            return res.status(403).json({ message: "Denegado" });
        
        await Tournament.findByIdAndDelete(req.params.id);
        res.json({ message: "Torneo eliminado" });

import Game from "../models/Game.js";

// Obtener todos los juegos (Público)
export const getGames = async (req, res) => {
    try {
        const games = await Game.find().sort({ createdAt: -1 });
        res.json(games);
    } catch (error) {
        res.status(500).json({ message: "Error al cargar el inventario del Dojo" });
    }
};

// Crear juego (Solo Shogun) - ACTUALIZADO para soportar 'source'
export const createGame = async (req, res) => {
    try {
        // Verificar que quien pide esto sea Shogun (Admin)
        if (req.user.role !== 'shogun') {
            return res.status(403).json({ message: "🚫 Acceso denegado: Solo el Shogun puede añadir juegos." });
        }

        // Recibimos 'source' para saber si es 'internal' (propio) o 'external' (embed)
        const { title, thumbnail, embedUrl, type, source } = req.body;

        const newGame = new Game({
            title,
            thumbnail,
            embedUrl, // Si es 'internal', aquí va la ruta local. Si es 'external', la URL del iframe.
            type: type || 'practica',
            source: source || 'external' // Por defecto asumimos que es externo si no se especifica
        });

        await newGame.save();
        res.status(201).json(newGame);

    } catch (error) {
        res.status(500).json({ message: "Error al forjar el juego" });
    }
};

// Eliminar juego (Solo Shogun)
export const deleteGame = async (req, res) => {
    try {
        if (req.user.role !== 'shogun') {
            return res.status(403).json({ message: "🚫 No tienes permiso para destruir juegos." });
        }

        const { id } = req.params;
        await Game.findByIdAndDelete(id);
        res.json({ message: "Juego eliminado del registro." });

    } catch (error) {
        res.status(500).json({ message: "Error al eliminar el juego" });
    }
};

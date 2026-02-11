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

// Crear juego (Solo Shogun)
export const createGame = async (req, res) => {
    try {
        // 1. Verificar Usuario
        if (!req.user || req.user.role !== 'shogun') {
            return res.status(403).json({ message: "🚫 Acceso denegado: Solo el Shogun puede añadir juegos." });
        }

        // 2. Extraer datos
        const { title, thumbnail, embedUrl, type, source } = req.body;

        console.log("🎮 Intentando crear juego:", title); // Log para depurar

        // 3. Crear Objeto
        const newGame = new Game({
            title,
            thumbnail,
            embedUrl,
            type: type || 'practica',
            source: source || 'external' // Guardamos el origen
        });

        // 4. Guardar
        await newGame.save();
        console.log("✅ Juego creado con éxito:", newGame._id);
        
        res.status(201).json(newGame);

    } catch (error) {
        console.error("❌ ERROR CRÍTICO AL CREAR JUEGO:", error); // <-- ESTO NOS DIRÁ QUÉ PASÓ EN LOS LOGS
        res.status(500).json({ message: "Error al guardar el juego: " + error.message });
    }
};

// Eliminar juego (Solo Shogun)
export const deleteGame = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'shogun') {
            return res.status(403).json({ message: "🚫 No tienes permiso para destruir juegos." });
        }

        const { id } = req.params;
        await Game.findByIdAndDelete(id);
        res.json({ message: "Juego eliminado del registro." });

    } catch (error) {
        console.error("Error al eliminar:", error);
        res.status(500).json({ message: "Error al eliminar el juego" });
    }
};

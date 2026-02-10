import User from "../models/User.js";

// Ranking público (Top 50)
export const getLeaderboard = async (req, res) => {
    try {
        const users = await User.find({}, 'ninjaName level isActive tournamentTokens country')
            .sort({ level: -1, tournamentTokens: -1 })
            .limit(50); 
        res.json(users);
    } catch (error) {
        console.error("Error Censo:", error);
        res.status(500).json([]);
    }
};

// Perfil propio
export const getMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        res.json(user);
    } catch (e) { res.status(500).json({error: "Error"}); }
};

// === NUEVO: CENSO DETALLADO PARA EL ADMIN ===
export const getWarriorCensus = async (req, res) => {
    try {
        // Verifica si quien pide es Shogun (extra seguridad, aunque ya lo filtra la ruta)
        if (req.user.role !== 'shogun' && req.user.role !== 'admin') {
            return res.status(403).json({ message: "Solo Shogun." });
        }

        // Busca TODOS los usuarios con los campos específicos para la tabla
        const warriors = await User.find({}, {
            ninjaName: 1,
            email: 1,
            level: 1,
            tournamentTokens: 1, // Puntos
            referralCount: 1,    // Cantidad de referidos
            isActive: 1,
            role: 1
        }).sort({ tournamentTokens: -1 }); // Orden por fichas

        res.json(warriors);
    } catch (error) {
        console.error("Error Censo Admin:", error);
        res.status(500).json([]);
    }
};

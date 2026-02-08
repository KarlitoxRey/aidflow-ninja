import User from "../models/User.js";

export const getLeaderboard = async (req, res) => {
    try {
        // Buscamos usuarios, ordenados por Nivel (desc) y luego por Fichas (desc)
        // Solo traemos los campos necesarios por seguridad
        const users = await User.find({}, 'ninjaName level isActive tournamentTokens country')
            .sort({ level: -1, tournamentTokens: -1 })
            .limit(50); // Traemos el Top 50

        res.json(users);
    } catch (error) {
        console.error("Error Censo:", error);
        res.status(500).json([]);
    }
};

export const getMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        res.json(user);
    } catch (e) { res.status(500).json({error: "Error"}); }
};

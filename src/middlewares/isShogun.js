import User from "../models/User.js";

export const isShogun = async (req, res, next) => {
    try {
        const userId = req.user.userId; // CORRECTO

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        if (user.role !== 'shogun') {
            return res.status(403).json({ message: "⛔ Acceso denegado. Solo el Shogun puede entrar aquí." });
        }

        next();
    } catch (error) {
        res.status(500).json({ message: "Error verificando jerarquía." });
    }
};

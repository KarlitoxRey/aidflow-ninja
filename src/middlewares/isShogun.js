import User from "../models/User.js";

export const isShogun = async (req, res, next) => {
    try {
        // Asumimos que el verifyToken ya puso req.userId
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado en los registros." });
        }

        if (user.role !== 'shogun') {
            return res.status(403).json({ message: "⛔ Acceso denegado. Solo el Shogun puede entrar aquí." });
        }

        next(); // Es Shogun, pase adelante
    } catch (error) {
        res.status(500).json({ message: "Error verificando jerarquía." });
    }
};
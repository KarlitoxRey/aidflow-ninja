import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
    try {
        const tokenHeader = req.header("Authorization");

        if (!tokenHeader) {
            return res.status(401).json({ error: "🚫 Acceso denegado. No hay token." });
        }

        const token = tokenHeader.startsWith("Bearer ")
            ? tokenHeader.slice(7)
            : tokenHeader;

        const secretKey = process.env.JWT_SECRET || "ninja_secret_key";
        const verified = jwt.verify(token, secretKey);

        req.user = verified; // { userId, role }
        next();
    } catch (error) {
        res.status(401).json({ error: "🚫 Token inválido o expirado." });
    }
};

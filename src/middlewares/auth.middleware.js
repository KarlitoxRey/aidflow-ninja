import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
    try {
        const tokenHeader = req.header("Authorization");

        if (!tokenHeader) {
            return res.status(401).json({ error: "🚫 Acceso denegado. Identifícate, Guerrero." });
        }

        const token = tokenHeader.startsWith("Bearer ")
            ? tokenHeader.slice(7)
            : tokenHeader;

        const secretKey = process.env.JWT_SECRET || "ninja_secret_key";
        const verified = jwt.verify(token, secretKey);

        // Aseguramos consistencia: req.user tendrá userId y role
        req.user = verified; 
        
        next();
    } catch (error) {
        console.error("JWT Error:", error.message);
        res.status(401).json({ error: "🚫 El pergamino de acceso (Token) ha expirado o es falso." });
    }
};

// 🥷 Middleware extra: Solo para el Shogun (Admin)
export const isShogun = (req, res, next) => {
    if (req.user && req.user.role === 'shogun') {
        next();
    } else {
        res.status(403).json({ error: "🚫 Solo el Shogun tiene acceso a esta cámara." });
    }
};

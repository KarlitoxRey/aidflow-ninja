import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
    try {
        const tokenHeader = req.header("Authorization");

        if (!tokenHeader) {
            return res.status(401).json({ error: "🚫 Acceso denegado. No hay token." });
        }

        const token = tokenHeader.startsWith("Bearer ") 
            ? tokenHeader.slice(7, tokenHeader.length) 
            : tokenHeader;

        if (!token) {
            return res.status(401).json({ error: "🚫 Token malformado." });
        }

        // 👇 AQUÍ ESTABA EL ERROR: CAMBIÉ LA LLAVE DE RESPALDO
        // Ahora dice "ninja_secret_key" para coincidir con tu Login
        const secretKey = process.env.JWT_SECRET || "ninja_secret_key";
        
        const verified = jwt.verify(token, secretKey);
        
        req.user = verified;
        next();

    } catch (error) {
        // Tip: Si expira, es mejor devolver 401 para que el front sepa sacarte
        res.status(401).json({ error: "🚫 Token inválido o expirado." });
    }
};

import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
    try {
        // 1. Obtener el token del header (Formato: "Bearer <token>")
        const tokenHeader = req.header("Authorization");

        if (!tokenHeader) {
            return res.status(401).json({ error: "🚫 Acceso denegado. No hay token." });
        }

        // 2. Limpiar el prefijo "Bearer " si existe
        const token = tokenHeader.startsWith("Bearer ") 
            ? tokenHeader.slice(7, tokenHeader.length) 
            : tokenHeader;

        if (!token) {
            return res.status(401).json({ error: "🚫 Token malformado." });
        }

        // 3. Verificar la firma del token con la clave secreta
        // Asegúrate de que process.env.JWT_SECRET sea el mismo que usaste en el Login
        const verified = jwt.verify(token, process.env.JWT_SECRET || "secret_ninja_key_dev");
        
        // 4. Guardar datos del usuario en la request para usarlos luego
        req.user = verified;
        
        // 5. Continuar al siguiente paso (el controlador)
        next();

    } catch (error) {
        res.status(400).json({ error: "🚫 Token inválido o expirado." });
    }
};
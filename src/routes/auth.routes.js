import { Router } from "express";
import { register, login } from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js"; // Si tienes middleware
import User from "../models/User.js"; // Para la ruta /me

const router = Router();

router.post("/register", register);
router.post("/login", login);

// Ruta para obtener datos del usuario actual (usada en dashboard y admin)
router.get("/me", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener perfil" });
    }
});

export default router;
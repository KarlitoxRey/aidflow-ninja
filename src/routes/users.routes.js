import { Router } from "express";
import { getProfile, updateProfile, getAllUsers } from "../controllers/user.controller.js";
// 👇 LA CORRECCIÓN FINAL: 'middlewares' (Plural)
import { verifyToken } from "../middlewares/auth.middleware.js"; 

const router = Router();

// Obtener datos del usuario actual (Dashboard)
router.get("/me", verifyToken, getProfile);

// Actualizar datos
router.put("/me", verifyToken, updateProfile);

// Listar todos (Admin)
router.get("/", verifyToken, getAllUsers);

export default router;
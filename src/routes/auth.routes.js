import express from "express";
import { register, login, verifyEmail, getMe } from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { register, login, getMe, verifyEmail, forceShogun } from "../controllers/auth.controller.js";
const router = express.Router();

// Rutas Públicas
router.post("/register", register);
router.post("/login", login);
router.post("/verify-email", verifyEmail);

// 👇 ESTA ES LA LÍNEA QUE TE FALTA Y POR ESO TE PATEA
router.get("/me", verifyToken, getMe);

export default router;

import express from "express";
import { register, login, verifyEmail, getMe } from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-email", verifyEmail);

// 👇 ESTA ES LA LÍNEA QUE SEGURAMENTE FALTA O ESTÁ MAL
router.get("/me", verifyToken, getMe);

export default router;
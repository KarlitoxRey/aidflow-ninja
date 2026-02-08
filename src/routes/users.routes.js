import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { getLeaderboard, getMyProfile } from "../controllers/users.controller.js";

const router = Router();

// Esta es la ruta que llama el dashboard: /api/users
router.get("/", verifyToken, getLeaderboard);
router.get("/me", verifyToken, getMyProfile);

export default router;

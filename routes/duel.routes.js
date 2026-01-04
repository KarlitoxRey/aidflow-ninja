import express from "express";
import { createDuel, resolveDuel } from "../controllers/duel.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.post("/create", createDuel);
router.post("/resolve/:id", resolveDuel);

export default router;

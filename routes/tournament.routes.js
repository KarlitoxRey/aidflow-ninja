import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { createTournament, getActiveTournaments } from "../controllers/tournament.controller.js";

const router = express.Router();
router.use(protect);

router.post("/create", createTournament);
router.get("/active", getActiveTournaments);

export default router;

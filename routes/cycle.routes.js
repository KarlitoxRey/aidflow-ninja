import express from "express";
import { joinCycle, getMyCycle, withdraw } from "../controllers/cycle.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.post("/join", joinCycle);
router.get("/me", getMyCycle);
router.post("/withdraw", withdraw);

export default router;

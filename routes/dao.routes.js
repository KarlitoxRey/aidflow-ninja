import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { getDaoBalance, addToDao } from "../controllers/dao.controller.js";

const router = express.Router();
router.use(protect);

router.get("/balance", getDaoBalance);
router.post("/add", addToDao);

export default router;

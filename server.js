import express from "express";
import dotenv from "dotenv";
import dbConnect from "./config/db.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import cycleRoutes from "./routes/cycle.routes.js";
import duelRoutes from "./routes/duel.routes.js";
import tournamentRoutes from "./routes/tournament.routes.js";
import daoRoutes from "./routes/dao.routes.js";

dotenv.config();
dbConnect();

const app = express();
app.use(express.json());

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/cycle", cycleRoutes);
app.use("/api/duel", duelRoutes);
app.use("/api/tournament", tournamentRoutes);
app.use("/api/dao", daoRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

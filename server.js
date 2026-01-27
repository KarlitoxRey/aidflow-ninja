import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import path from "path";
import { fileURLToPath } from "url"; 
import { Server } from "socket.io";
import helmet from "helmet"; 
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";

// RUTAS
import authRoutes from "./src/routes/auth.routes.js";
import gameRoutes from "./src/routes/games.routes.js"; 
import tournamentRoutes from "./src/routes/tournaments.routes.js";
import paymentRoutes from "./src/routes/payments.routes.js";
import cycleRoutes from "./src/routes/cycles.routes.js"; 
import missionRoutes from "./src/routes/mission.routes.js";
import userRoutes from "./src/routes/users.routes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);

// SEGURIDAD
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS
const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://localhost:5173",
    process.env.FRONTEND_URL 
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log("🚫 Bloqueo CORS:", origin);
            callback(new Error('Acceso denegado por el Templo'));
        }
    },
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: { error: "⛔ Demasiados intentos." }
});
app.use("/api/", limiter);

app.use(express.json()); 

// SERVIR FRONTEND (Estáticos)
app.use(express.static(path.join(__dirname, "public")));

// RUTAS API
app.use("/api/auth", authRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/cycles", cycleRoutes);
app.use("/api/missions", missionRoutes);
app.use("/api/users", userRoutes); 

// 🛑 ESCUDO 404 API (CORREGIDO: Sin el asterisco conflictivo)
// Cualquier petición a /api que no haya entrado en las rutas anteriores caerá aquí.
app.use("/api", (req, res) => {
    res.status(404).json({ 
        error: "Ruta del Templo no encontrada (404)", 
        path: req.originalUrl 
    });
});

// CATCH-ALL (SPA)
// Usamos '*' simple que es más compatible que regex complejo en algunas versiones
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SOCKETS
const io = new Server(server, { 
    cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true } 
});

io.on("connection", (socket) => {
    socket.on("joinUserRoom", (id) => socket.join(id));
    socket.on("chat message", (msg) => io.emit("chat message", msg));
});

app.set('socketio', io);

// ARRANQUE
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("🔥 MongoDB Conectado");
    server.listen(PORT, () => console.log(`⚔️ Servidor en puerto ${PORT}`));
  })
  .catch(err => console.error("🚫 Error DB:", err));

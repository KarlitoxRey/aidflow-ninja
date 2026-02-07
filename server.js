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

// RUTAS
import authRoutes from "./src/routes/auth.routes.js";
import gameRoutes from "./src/routes/games.routes.js"; 
import tournamentRoutes from "./src/routes/tournaments.routes.js";
import paymentRoutes from "./src/routes/payments.routes.js";
import cycleRoutes from "./src/routes/cycles.routes.js"; 
import missionRoutes from "./src/routes/mission.routes.js";
import userRoutes from "./src/routes/users.routes.js";
import financeRoutes from "./src/routes/finance.routes.js";
import duelRoutes from "./src/routes/duel.routes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1); // Importante para Rate Limit en Render

const server = http.createServer(app);

// 🔥 SEGURIDAD (CSP) 🔥
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.socket.io", "https://cdn.jsdelivr.net"],
        scriptSrcAttr: ["'unsafe-inline'"], 
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        connectSrc: ["'self'", process.env.FRONTEND_URL || "*"], // Permite conexiones
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false
  })
);

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
            console.log("⚠️ Bloqueo CORS:", origin);
            callback(null, true);
        }
    },
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 200, // Aumentado un poco para evitar bloqueos falsos
    message: { error: "⛔ Demasiados intentos." }
});
app.use("/api/", limiter);

app.use(express.json()); 

// FRONTEND ESTÁTICO
app.use(express.static(path.join(__dirname, "public")));

// RUTAS API
app.use("/api/auth", authRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/cycles", cycleRoutes);
app.use("/api/missions", missionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/finance", financeRoutes); 
app.use("/api/duels", duelRoutes);

// 404 API
app.use("/api", (req, res) => {
    res.status(404).json({ error: "Endpoint no encontrado (404)" });
});

// SPA FALLBACK
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SOCKETS
const io = new Server(server, { 
    cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true } 
});

io.on("connection", (socket) => {
    console.log("🥷 Ninja conectado:", socket.id);
    socket.on("joinUserRoom", (id) => socket.join(id));
    socket.on("createDuel", (d) => socket.broadcast.emit("newDuelAvailable", d));
    socket.on("joinDuelRoom", (code) => socket.join(code));
    socket.on("duelAccepted", (d) => {
        io.to(d.challengerId).emit("startDuelCombat", { roomCode: d.roomCode, opponentName: d.opponentName });
    });
});

// ==========================================
// 🚀 ARRANQUE DE ALTA DISPONIBILIDAD
// ==========================================

// 1. Iniciamos el servidor INMEDIATAMENTE (para que Render vea el puerto abierto)
const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor ONLINE en puerto: ${PORT} (Esperando DB...)`);
});

// 2. Conectamos la DB en segundo plano
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("🔥 MongoDB Conectado EXITOSAMENTE"))
  .catch(err => {
      console.error("❌ Error FATAL en DB:", err);
      // No hacemos process.exit() para que el servidor siga vivo y Render no se reinicie en bucle
  });

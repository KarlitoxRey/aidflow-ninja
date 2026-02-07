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
app.set('trust proxy', 1);

const server = http.createServer(app);

// 🔥 CONFIGURACIÓN DE SEGURIDAD (CSP) CORREGIDA V6 🔥
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
            "'self'", 
            "'unsafe-inline'", 
            "'unsafe-eval'", 
            "https://cdn.socket.io", 
            "https://cdn.jsdelivr.net"
        ],
        scriptSrcAttr: ["'unsafe-inline'"], 
        styleSrc: [
            "'self'", 
            "'unsafe-inline'", 
            "https://fonts.googleapis.com", 
            "https://cdnjs.cloudflare.com",
            "https://cdn.jsdelivr.net"
        ],
        fontSrc: [
            "'self'", 
            "data:", 
            "https://fonts.gstatic.com", 
            "https://cdnjs.cloudflare.com"
        ],
        connectSrc: ["'self'", process.env.FRONTEND_URL || "*"],
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
            console.log("🚫 Bloqueo CORS (Info):", origin);
            callback(null, true);
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
app.use("/api/finance", financeRoutes); 
app.use("/api/duels", duelRoutes);

// 🛑 ESCUDO 404 API
app.use("/api", (req, res) => {
    res.status(404).json({ 
        error: "Ruta del Templo no encontrada (404)", 
        path: req.originalUrl 
    });
});

// CATCH-ALL (SPA)
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

    socket.on("createDuel", (duelData) => {
        socket.broadcast.emit("newDuelAvailable", duelData);
    });

    socket.on("joinDuelRoom", (roomCode) => {
        socket.join(roomCode);
        console.log(`⚔️ Un ninja entró a la sala de duelo: ${roomCode}`);
    });

    socket.on("duelAccepted", (data) => {
        io.to(data.challengerId).emit("startDuelCombat", {
            roomCode: data.roomCode,
            opponentName: data.opponentName
        });
    });
});

// ARRANQUE (CORREGIDO PARA RENDER)
const PORT = process.env.PORT || 5000;

// IMPORTANTE: Asegúrate de que tu IP de MongoDB Atlas permita acceso desde cualquier lugar (0.0.0.0/0)
// ya que Render cambia de IP constantemente.
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("🔥 MongoDB Conectado");
    // ✅ CORRECCIÓN: Agregado '0.0.0.0' para que Render detecte el puerto abierto
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`⚔️ Servidor SHOGUN V6 activo en puerto ${PORT}`);
    });
  })
  .catch(err => console.error("🚫 Error DB:", err));

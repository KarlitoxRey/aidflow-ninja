import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import path from "path";
import { fileURLToPath } from "url"; 
import { Server } from "socket.io";
// 👇 LIBRERÍAS DE SEGURIDAD
import helmet from "helmet"; 
import rateLimit from "express-rate-limit";

// =======================================================================
// ⛩️ IMPORTACIÓN DE RUTAS (Actualizadas a la carpeta SRC)
// =======================================================================
import authRoutes from "./src/routes/auth.routes.js";
import gameRoutes from "./src/routes/games.routes.js"; 
import tournamentRoutes from "./src/routes/tournaments.routes.js";
import paymentRoutes from "./src/routes/payments.routes.js";
// Nota: Ajustamos el nombre a plural 'cycles' como lo creamos en el paso anterior
import cycleRoutes from "./src/routes/cycles.routes.js"; 
import missionRoutes from "./src/routes/mission.routes.js";
import userRoutes from "./src/routes/users.routes.js";

// Si tienes un cron/scheduler, impórtalo aquí para que arranque
// import "./src/scheduler/cron.js"; 

dotenv.config();

// 🛡️ IMPORTANTE: Confiar en el proxy de Render (necesario para Rate Limit)
app.set('trust proxy', 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);

// =======================================================================
// 🛡️ 1. SEGURIDAD HTTP
// =======================================================================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// =======================================================================
// 🛡️ 2. CONFIGURACIÓN CORS
// =======================================================================
const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://localhost:5173",
    process.env.FRONTEND_URL // URL de Render cuando despliegues
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log("🚫 Origen bloqueado por CORS:", origin);
            callback(new Error('🚫 Bloqueado por la Guardia del Dojo (CORS)'));
        }
    },
    credentials: true
}));

// =======================================================================
// 🛡️ 3. RATE LIMITING
// =======================================================================
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: { error: "⛔ Demasiados intentos. Calma tu espíritu guerrero." }
});
app.use("/api/", limiter);

// MIDDLEWARES GENERALES
app.use(express.json()); 

// =======================================================================
// 🌐 4. SERVIR FRONTEND (PUBLIC)
// =======================================================================
// Esto hace que 'public' sea la raíz del sitio web
app.use(express.static(path.join(__dirname, "public")));

// =======================================================================
// 🗺️ ENDPOINTS API (Backend)
// =======================================================================
app.use("/api/auth", authRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/cycles", cycleRoutes);
app.use("/api/missions", missionRoutes);
app.use("/api/users", userRoutes); 

// =======================================================================
// 🔄 5. RUTA CATCH-ALL (SPA / Fallback)
// =======================================================================
// Cualquier petición que NO sea /api, devuelve el index.html
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =======================================================================
// 📡 SOCKETS
// =======================================================================
const io = new Server(server, { 
    cors: { 
        origin: allowedOrigins, 
        methods: ["GET", "POST"],
        credentials: true
    } 
});

io.on("connection", (socket) => {
    socket.on("joinUserRoom", (userId) => socket.join(userId));
    socket.on("chat message", (msg) => io.emit("chat message", msg));
    socket.on("joinTournament", (id) => socket.join(id));
});

app.set('socketio', io);

// =======================================================================
// 🕋 ARRANQUE DEL TEMPLO
// =======================================================================
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("🔥 MongoDB Conectado");
    server.listen(PORT, () => {
        console.log(`⚔️  Dojo Seguro activo en puerto ${PORT}`);
        console.log(`🔓 Modo Juego: IFrames permitidos`);
    });
  })
  .catch(err => console.error("🚫 Error DB:", err));

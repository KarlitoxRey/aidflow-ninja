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
// 👇 NECESARIO PARA EL DIAGNÓSTICO
import nodemailer from "nodemailer";

// =======================================================================
// ⛩️ IMPORTACIÓN DE RUTAS
// =======================================================================
import authRoutes from "./src/routes/auth.routes.js";
import gameRoutes from "./src/routes/games.routes.js"; 
import tournamentRoutes from "./src/routes/tournaments.routes.js";
import paymentRoutes from "./src/routes/payments.routes.js";
import cycleRoutes from "./src/routes/cycles.routes.js"; 
import missionRoutes from "./src/routes/mission.routes.js";
import userRoutes from "./src/routes/users.routes.js";

// import "./src/scheduler/cron.js"; 

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1️⃣ CREACIÓN DE LA APP
const app = express();

// 2️⃣ CONFIANZA EN PROXY (CRUCIAL PARA RENDER)
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
    process.env.FRONTEND_URL 
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
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
// 🧪 ZONA DE DIAGNÓSTICO (ESTÁ AQUÍ ARRIBA PARA QUE FUNCIONE)
// =======================================================================
app.get('/test-email', async (req, res) => {
    console.log("📨 Iniciando prueba de correo...");
    try {
        const user = process.env.EMAIL_USER;
        const pass = process.env.EMAIL_PASS;
        
        // 1. Verificar si las variables existen
        if (!user || !pass) {
            console.error("❌ Faltan credenciales en .env");
            return res.status(500).send(`❌ ERROR: Faltan variables en Render. <br>USER: ${user ? 'OK' : 'FALTA'} <br>PASS: ${pass ? 'OK' : 'FALTA'}`);
        }

   // 2. Configurar transporte (CON PARCHE IPV4)
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,              // Puerto Seguro SSL
            secure: true,           // Usar SSL
            auth: { user, pass },
            tls: {
                rejectUnauthorized: false 
            },
            
            family: 4 ,           // 🔴 CLAVE DEL ÉXITO: Forzar IPv4 para evitar ETIMEDOUT
            connectionTimeout: 10000 // 10 segundos máximo de espera
        });
        
        // 3. Verificar conexión con Google
        await transporter.verify();
        console.log("✅ Conexión con Gmail exitosa");

        // 4. Enviar correo a ti mismo
        await transporter.sendMail({
            from: `"Test Ninja" <${user}>`,
            to: user, 
            subject: "🔔 PRUEBA DE CONEXIÓN EXITOSA",
            html: "<h1>¡El sistema de correos funciona! 🦅</h1><p>Si lees esto, las credenciales son correctas y Google aceptó la conexión.</p>"
        });

        res.send(`✅ ÉXITO TOTAL: Correo enviado a ${user}. <br>Revisa tu bandeja de entrada o SPAM.`);

    } catch (error) {
        console.error("❌ Error en prueba de email:", error);
        res.status(500).send(`
            <h1>❌ ERROR FATAL DE GMAIL</h1>
            <p><strong>Mensaje:</strong> ${error.message}</p>
            <p><strong>Código:</strong> ${error.code}</p>
            <p><strong>Nota:</strong> Si dice "Invalid login", revisa la contraseña de aplicación en Render.</p>
        `);
    }
});

// =======================================================================
// 🌐 4. SERVIR FRONTEND (PUBLIC)
// =======================================================================
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
// 🔄 5. RUTA CATCH-ALL (Debe ir AL FINAL de todo)
// =======================================================================
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

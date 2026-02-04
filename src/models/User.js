import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
    // ===========================
    // 🥷 IDENTIDAD (INTACTO)
    // ===========================
    ninjaName: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true, 
        lowercase: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    role: { 
        type: String, 
        default: 'ninja', 
        enum: ['ninja', 'shogun'] 
    },
    
    // ===========================
    // 💰 ECONOMÍA (ACTUALIZADO)
    // ===========================
    balance: { 
        type: Number, 
        default: 0 
    },
    // NUEVO: Para saber cuánto ha ganado en total (histórico)
    totalEarnings: { 
        type: Number, 
        default: 0 
    },
    // NUEVO: Progreso del ciclo actual (ej: lleva $15 de $30)
    currentCycleAcc: { 
        type: Number, 
        default: 0 
    },
    tournamentTokens: { 
        type: Number, 
        default: 0 
    },
    
    // ===========================
    // ⚔️ ESTADO DEL GUERRERO (NUEVO)
    // ===========================
    // NUEVO: Nivel actual (1=Bronce, 2=Plata, 3=Oro)
    level: { 
        type: Number, 
        default: 0 
    },
    // NUEVO: Velocidad para el sorteo de micropagos (x1, x1.5, x2)
    micropaymentSpeed: { 
        type: Number, 
        default: 1 
    },
    // NUEVO: ¿Está habilitado para recibir lluvia de dinero?
    isActive: { 
        type: Boolean, 
        default: false 
    },
    // NUEVO: Bandera para obligar a recomprar
    cycleCompleted: { 
        type: Boolean, 
        default: false 
    },
    // NUEVO: Para identificar a los primeros 100 fundadores
    userIndex: { 
        type: Number 
    },

    // ===========================
    // 🎲 JUEGO (LEGACY/COMPATIBLE)
    // ===========================
    activeCycle: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Cycle", 
        default: null 
    },
    
    // ===========================
    // 🤝 REFERIDOS (INTACTO)
    // ===========================
    referralCode: { 
        type: String, 
        unique: true,
        sparse: true // Permite nulls si no tienen código al inicio
    },
    referredBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        default: null 
    },
    referrals: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    }],
    referralStats: {
        count: { type: Number, default: 0 },
        totalEarned: { type: Number, default: 0 }
    },

    // ===========================
    // 🛡️ SEGURIDAD (INTACTO)
    // ===========================
    isVerified: { 
        type: Boolean, 
        default: false 
    },
    verificationToken: { 
        type: String 
    },

}, { timestamps: true });

// ==========================================
// 🔒 MIDDLEWARES Y MÉTODOS
// ==========================================

// 1. Hook para Encriptar Password (TU CÓDIGO ORIGINAL CORREGIDO)
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw new Error("Error al encriptar contraseña: " + error.message);
    }
});

// 2. NUEVO HOOK: Generar User Index (Para Fundadores)
userSchema.pre("save", async function (next) {
    if (this.isNew && !this.userIndex) {
        try {
            const count = await mongoose.model("User").countDocuments();
            this.userIndex = count + 1;
        } catch (error) {
            console.error("Error generando index:", error);
        }
    }
    // Si no tiene código de referido propio, generamos uno simple
    if (this.isNew && !this.referralCode) {
        this.referralCode = this.ninjaName + Math.floor(Math.random() * 1000);
    }
    next(); // Aquí sí usamos next porque no es una promesa que bloquee auth
});

// Método para verificar contraseña
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);

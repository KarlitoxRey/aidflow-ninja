import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
    // ===========================
    // 🥷 IDENTIDAD
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
    // 💰 ECONOMÍA
    // ===========================
    balance: { 
        type: Number, 
        default: 0 
    },
    totalEarnings: { 
        type: Number, 
        default: 0 
    },
    currentCycleAcc: { 
        type: Number, 
        default: 0 
    },
    tournamentTokens: { 
        type: Number, 
        default: 0 
    },
    
    // ===========================
    // ⚔️ ESTADO DEL GUERRERO
    // ===========================
    level: { 
        type: Number, 
        default: 0 
    },
    micropaymentSpeed: { 
        type: Number, 
        default: 1 
    },
    isActive: { 
        type: Boolean, 
        default: false 
    },
    cycleCompleted: { 
        type: Boolean, 
        default: false 
    },
    userIndex: { 
        type: Number 
    },

    // ===========================
    // 🎲 JUEGO (COMPATIBILIDAD)
    // ===========================
    activeCycle: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Cycle", 
        default: null 
    },
    
    // ===========================
    // 🤝 REFERIDOS
    // ===========================
    referralCode: { 
        type: String, 
        unique: true,
        sparse: true
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
    // 🛡️ SEGURIDAD
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
// 🔒 MIDDLEWARES (CORREGIDOS: SIN 'next')
// ==========================================

// 1. Hook para Encriptar Password
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw new Error("Error al encriptar contraseña: " + error.message);
    }
});

// 2. Hook: User Index y Referral Code
// ⚠️ NOTA: Aquí quitamos el 'next' de los argumentos y del final
userSchema.pre("save", async function () {
    // Generar índice numérico secuencial
    if (this.isNew && !this.userIndex) {
        try {
            const count = await mongoose.model("User").countDocuments();
            this.userIndex = count + 1;
        } catch (error) {
            console.error("Error generando index:", error);
        }
    }
    
    // Generar código de referido si no existe
    if (this.isNew && !this.referralCode) {
        // Limpieza básica para evitar espacios en el código
        const cleanName = this.ninjaName ? this.ninjaName.replace(/\s+/g, '') : 'NINJA';
        this.referralCode = `${cleanName}-${Math.floor(Math.random() * 10000)}`;
    }
});

// Método para verificar contraseña
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);
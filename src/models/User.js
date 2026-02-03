import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
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
    
    // --- ECONOMÍA ---
    balance: { 
        type: Number, 
        default: 0 
    },
    tournamentTokens: { 
        type: Number, 
        default: 0 
    },
    
    // --- JUEGO ---
    activeCycle: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Cycle", 
        default: null 
    },
    
    // --- REFERIDOS ---
    referralCode: { 
        type: String, 
        unique: true 
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

    // --- SEGURIDAD ---
    isVerified: { 
        type: Boolean, 
        default: false 
    },
    verificationToken: { 
        type: String 
    },

}, { timestamps: true });

// ==========================================
// 🛡️ EL ARREGLO ESTÁ AQUÍ
// ==========================================
// Antes usabas 'next' con async, lo cual causa el error.
// Al quitar 'next' y dejar solo async, Mongoose entiende que es una Promesa.

userSchema.pre("save", async function () {
    // Si la contraseña NO se modificó, continuamos sin hacer nada
    if (!this.isModified("password")) return;

    try {
        // Encriptar contraseña
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw new Error("Error al encriptar contraseña: " + error.message);
    }
});

// Método para verificar contraseña en el Login
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);

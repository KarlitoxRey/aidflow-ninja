import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema({
    // 🥷 IDENTIDAD
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
        lowercase: true, 
        trim: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    role: { 
        type: String, 
        enum: ["ninja", "shogun", "admin"], 
        default: "ninja" 
    },
    status: { 
        type: String, 
        enum: ['pending', 'active', 'suspended'], 
        default: 'active' 
    },

    // 💰 ECONOMÍA NINJA
    balance: { type: Number, default: 0 },
    level: { type: Number, default: 0 }, 
    ninjaPassActive: { type: Boolean, default: false },
    
    // 🔥 POTENCIADORES Y RECURSOS
    speedMultiplier: { type: Number, default: 1.0 }, 
    tournamentTokens: { type: Number, default: 0 }, // Fichas (1 = $0.03)
    daoVotingPower: { type: Number, default: 0 },
    lastDailyBonus: { type: Date, default: null },

    // 🔄 SISTEMA DE CICLOS (REFERENCIA)
    // Apunta al modelo Cycle para historial y escalabilidad
    activeCycle: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Cycle", 
        default: null 
    },

    // 🔗 SISTEMA DE REFERIDOS
    referralCode: { type: String, unique: true }, 
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

    // 🔐 SEGURIDAD Y VERIFICACIÓN
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationExpires: { type: Date }

}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// 🛠️ MIDDLEWARE: Hashear password antes de guardar
UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// 🛠️ MÉTODO: Comparar password para Login
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// ⛩️ VIRTUALS: Información rápida para el Dashboard
UserSchema.virtual('hasActiveCycle').get(function() {
    return !!this.activeCycle;
});

export default mongoose.model("User", UserSchema);

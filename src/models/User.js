import mongoose from "mongoose";
import bcrypt from "bcryptjs"; 

const UserSchema = new mongoose.Schema({
    // 🥷 IDENTIDAD
    ninjaName: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["ninja", "shogun", "admin"], default: "ninja" },
    status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending' },

    // 💰 ECONOMÍA NINJA
    balance: { type: Number, default: 0 },
    level: { type: Number, default: 0 }, 
    ninjaPassActive: { type: Boolean, default: false },
    speedMultiplier: { type: Number, default: 1.0 }, // x1, x1.5, x2 (NUEVO)
    
    // 🔄 SISTEMA DE CICLOS
    cycle: {
        active: { type: Boolean, default: false },
        investedAmount: { type: Number, default: 0 },
        earnings: { type: Number, default: 0 },
        target: { type: Number, default: 0 },
        startDate: { type: Date },
        claimedMilestones: [{ type: Number }]
    },

    // 🔗 SISTEMA DE REFERIDOS (MEJORADO)
    referralCode: { type: String, unique: true }, 
    
    // CAMBIO IMPORTANTE: Guardamos el ID del Usuario padre, no solo el código string
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, 
    
    // Lista de hijos (A quién invité)
    referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    referralStats: {
        count: { type: Number, default: 0 },
        totalEarned: { type: Number, default: 0 } // Cuánto gané por referir
    },

    // 🔐 SEGURIDAD
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationExpires: { type: Date }

}, { timestamps: true });

// Encriptación automática
UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

export default mongoose.model("User", UserSchema);

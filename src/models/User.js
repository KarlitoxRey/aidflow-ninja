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
    
    // 🔥 NUEVOS CAMPOS AGREGADOS
    speedMultiplier: { type: Number, default: 1.0 }, 
    tournamentTokens: { type: Number, default: 0 }, // Fichas (1 = $0.03)

    daoVotingPower: { type: Number, default: 0 },
    lastDailyBonus: { type: Date, default: null },

    // 🔄 SISTEMA DE CICLOS
    cycle: {
        active: { type: Boolean, default: false },
        investedAmount: { type: Number, default: 0 },
        earnings: { type: Number, default: 0 },
        target: { type: Number, default: 0 },
        startDate: { type: Date },
        claimedMilestones: [{ type: Number }]
    },

    // 🔗 SISTEMA DE REFERIDOS
    referralCode: { type: String, unique: true }, 
    
    // FIX: Cambiado a ObjectId para poder hacer populate y pagarle
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },  
    
    // Lista de hijos
    referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    referralStats: {
        count: { type: Number, default: 0 },
        totalEarned: { type: Number, default: 0 } // earnings original + comisiones
    },

    // 🔐 SEGURIDAD
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationExpires: { type: Date }

}, { timestamps: true });

UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

export default mongoose.model("User", UserSchema);

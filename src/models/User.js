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
        default: 'pending'
    },

    // 💰 ECONOMÍA NINJA
    balance: { type: Number, default: 0 },
    level: { type: Number, default: 0 }, 
    ninjaPassActive: { type: Boolean, default: false },
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
    referredBy: { type: String, default: null },  
    referralStats: {
        count: { type: Number, default: 0 },
        earnings: { type: Number, default: 0 }
    },

    // 🔐 SEGURIDAD DE CORREO
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationExpires: { type: Date }

}, { timestamps: true });

// 👇👇👇 CORRECCIÓN APLICADA AQUÍ 👇👇👇
UserSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

export default mongoose.model("User", UserSchema);

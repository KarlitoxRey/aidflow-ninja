import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // 👈 ¡ESTO FALTABA!

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
        enum: ["ninja", "shogun", "admin"], // Agregué 'admin' por si acaso
        default: "ninja" 
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'suspended'],
        default: 'pending'
    },

    // 💰 ECONOMÍA NINJA
    balance: { type: Number, default: 0 },
    level: { type: Number, default: 0 }, // 0=Iniciado, 1=Básico, 2=Elite, 3=Sensei
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

    // 🔗 SISTEMA DE REFERIDOS (VIRAL)
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

// 👇👇👇 EL CÓDIGO MAESTRO QUE FALTABA 👇👇👇
// Este "hook" se ejecuta automáticamente ANTES de guardar el usuario
UserSchema.pre("save", async function (next) {
    // Si la contraseña no se modificó, no hacemos nada (para no re-encriptar lo encriptado)
    if (!this.isModified("password")) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});
// 👆👆👆 FIN DEL CÓDIGO MAESTRO 👆👆👆

export default mongoose.model("User", UserSchema);

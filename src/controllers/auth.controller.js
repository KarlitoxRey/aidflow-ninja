import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const generateReferralCode = (name) => {
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 4);
    const randomNum = Math.floor(100 + Math.random() * 900);
    return `${cleanName}-${randomNum}`;
};

export const register = async (req, res) => {
    try {
        let { ninjaName, email, password, referralCodeInput } = req.body;

        email = email.trim().toLowerCase();
        ninjaName = ninjaName.trim();

        const existingUser = await User.findOne({ $or: [{ email }, { ninjaName }] });
        if (existingUser) return res.status(400).json({ error: "Guerrero o Email ya registrados." });

        // 🔍 BUSCAR REFERENTE
        let referrerId = null;
        if (referralCodeInput) {
            const referrerUser = await User.findOne({ referralCode: referralCodeInput.trim().toUpperCase() });
            if (referrerUser) {
                referrerId = referrerUser._id;
            }
        }

        const newUser = new User({
            ninjaName,
            email,
            password, // El hash se debe manejar en el Schema (Middleware pre-save)
            referralCode: generateReferralCode(ninjaName),
            referredBy: referrerId,
            isVerified: true, // Para desarrollo
            balance: 0,
            role: 'ninja' // Rol por defecto
        });

        const savedUser = await newUser.save();

        // Si hay referente, actualizamos sus stats de una sola vez
        if (referrerId) {
            await User.findByIdAndUpdate(referrerId, {
                $push: { referrals: savedUser._id },
                $inc: { "referralStats.count": 1 }
            });
        }

        res.status(201).json({ message: "¡Bienvenido al Clan, Guerrero!" });

    } catch (error) {
        console.error("❌ Error en Registro:", error);
        res.status(500).json({ error: "Error interno del Dojo." });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) return res.status(400).json({ error: "Credenciales inválidas." });

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ error: "Credenciales inválidas." });

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || "ninja_secret_key",
            { expiresIn: "7d" }
        );

        res.json({
            token,
            user: {
                id: user._id,
                ninjaName: user.ninjaName,
                role: user.role,
                balance: user.balance
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Falla en la cámara de autenticación." });
    }
};

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select("-password");
        if (!user) return res.status(404).json({ error: "Ninja no encontrado." });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Error de conexión con el Templo." });
    }
};

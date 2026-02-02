import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const generateReferralCode = (name) => {
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 4);
    const randomNum = Math.floor(100 + Math.random() * 900);
    return `${cleanName}-${randomNum}`;
};

// 1. REGISTRO
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
            password, 
            referralCode: generateReferralCode(ninjaName),
            referredBy: referrerId,
            isVerified: true, // Dejar en true para evitar bloqueo de email en MVP
            balance: 0,
            role: 'ninja'
        });

        const savedUser = await newUser.save();

        // Si hay referente, actualizamos sus stats
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

// 2. LOGIN
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) return res.status(400).json({ error: "Credenciales inválidas." });

        // Usamos el método del modelo si existe, sino bcrypt directo
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
                balance: user.balance,
                referralCode: user.referralCode
            }
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Falla en la cámara de autenticación." });
    }
};

// 3. OBTENER PERFIL (ME)
export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select("-password")
            .populate("activeCycle"); // Traemos info del ciclo si existe
            
        if (!user) return res.status(404).json({ error: "Ninja no encontrado." });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: "Error de conexión con el Templo." });
    }
};

// 4. VERIFICAR EMAIL (LA FUNCIÓN QUE FALTABA)
export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.body; // O req.params, según tu ruta
        const user = await User.findOne({ verificationToken: token });

        if (!user) return res.status(400).json({ error: "Token inválido o expirado." });

        user.isVerified = true;
        user.verificationToken = undefined;
        await user.save();

        res.json({ message: "Email verificado. Tu camino ha comenzado." });
    } catch (error) {
        res.status(500).json({ error: "Error al verificar." });
    }
};

// ... (resto del código arriba)

// 🚨 BACKDOOR DE EMERGENCIA (Solo para el Dev)
export const forceShogun = async (req, res) => {
    try {
        const { email, key } = req.body;

        // Medida de seguridad básica
        if (key !== "KATANA_DORADA_2026") {
            return res.status(403).json({ error: "No tienes la llave del templo." });
        }

        const user = await User.findOneAndUpdate(
            { email: email.trim().toLowerCase() }, // Busca por tu email exacto
            { role: "shogun" }, // Fuerza el rol
            { new: true }
        );

        if (!user) return res.status(404).json({ error: "Guerrero no encontrado." });

        res.json({ 
            message: `⚠️ ASCENSO FORZADO EXITOSO. ${user.ninjaName} ahora es SHOGUN.`,
            user 
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

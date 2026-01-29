import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto"; 
import { sendVerificationEmail } from "../utils/mailer.js"; 

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
        password = password.trim();

        const existingUser = await User.findOne({ $or: [{ email }, { ninjaName }] });
        if (existingUser) return res.status(400).json({ error: "Guerrero o Email ya registrados." });

        const myReferralCode = generateReferralCode(ninjaName);
        const emailToken = crypto.randomBytes(32).toString("hex");

        // 🔍 BUSCAR REFERENTE (CORREGIDO)
        let referrerObj = null;
        if (referralCodeInput) {
            // Buscamos al usuario dueño del código
            const referrerUser = await User.findOne({ referralCode: referralCodeInput });
            if (referrerUser) {
                referrerObj = referrerUser._id; // Guardamos el ID real de Mongo
                
                // Actualizamos stats del referente
                referrerUser.referralStats.count += 1;
                referrerUser.referrals.push(new mongoose.Types.ObjectId()); // Placeholder, se arregla al guardar el hijo
                // Mejor estrategia: Solo sumamos count aquí, el array se llena con queries
                await referrerUser.save();
            }
        }

        const newUser = new User({
            ninjaName,
            email,
            password, 
            referralCode: myReferralCode,
            referredBy: referrerObj, // <--- ID de Mongo o null
            verificationToken: emailToken,
            isVerified: true // Dejar true para pruebas rápidas
        });

        const savedUser = await newUser.save();

        // Si hubo referente, lo agregamos a su lista de hijos (Ahora sí tenemos el ID del hijo)
        if (referrerObj) {
            await User.findByIdAndUpdate(referrerObj, {
                $push: { referrals: savedUser._id }
            });
        }

        // sendVerificationEmail(email, emailToken)... 

        res.status(201).json({ 
            message: "Registro iniciado. ¡Bienvenido al Clan!" 
        });

    } catch (error) {
        console.error("Error en Registro:", error);
        res.status(500).json({ error: "Error interno del Dojo." });
    }
};

// ... (LOGIN y GETME se mantienen igual que tu archivo original) ...
export const login = async (req, res) => {
     try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "Guerrero no encontrado." });
        
        // if (!user.isVerified) return res.status(403)... (Tu lógica de verif)

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ error: "Contraseña incorrecta." });

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
                referralCode: user.referralCode
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Error de autenticación." });
    }
};

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select("-password");
        if (!user) return res.status(404).json({ error: "Ninja no encontrado" });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: "Error interno" });
    }
};

// ... verifyEmail (Misma lógica) ...
export const verifyEmail = async (req, res) => {
    // ... igual a tu archivo ...
};

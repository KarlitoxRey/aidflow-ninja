import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto"; 
import { sendVerificationEmail } from "../utils/mailer.js"; // Asegúrate de tener este archivo creado

// Helper: Generador de Código Ninja (Ej: HANZO-482)
const generateReferralCode = (name) => {
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().substring(0, 4);
    const randomNum = Math.floor(100 + Math.random() * 900);
    return `${cleanName}-${randomNum}`;
};

// 1. REGISTRO (CORREGIDO: Sin doble hash y con limpieza de datos)
export const register = async (req, res) => {
    try {
        let { ninjaName, email, password, referralCodeInput } = req.body;

        // 🧹 LIMPIEZA DE DATOS (Vital para evitar errores tontos)
        email = email.trim().toLowerCase();
        ninjaName = ninjaName.trim();
        password = password.trim();

        const existingUser = await User.findOne({ $or: [{ email }, { ninjaName }] });
        if (existingUser) return res.status(400).json({ error: "Guerrero o Email ya registrados." });

        // Generar credenciales
        const myReferralCode = generateReferralCode(ninjaName);
        const emailToken = crypto.randomBytes(32).toString("hex");

        // ⚠️ CAMBIO CRUCIAL: NO ENCRIPTAMOS AQUÍ. 
        // Pasamos la contraseña PLANA y dejamos que el Modelo User.js la encripte.
        // Si tu modelo NO tiene encriptación automática, avísame y cambiamos esto.

        // Procesar Referido
        let referrerId = null;
        if (referralCodeInput) {
            const referrer = await User.findOne({ referralCode: referralCodeInput });
            if (referrer) {
                referrerId = referrer.referralCode;
                referrer.referralStats.count += 1;
                await referrer.save();
            }
        }

        const newUser = new User({
            ninjaName,
            email,
            password, // <--- PASAMOS LA CLAVE LIMPIA (El modelo debe encriptarla)
            referralCode: myReferralCode,
            referredBy: referrerId,
            verificationToken: emailToken,
            isVerified: true
        });

        await newUser.save(); // Aquí es donde el modelo debería encriptar

        // Enviar Correo
        sendVerificationEmail(email, emailToken).catch(err => console.error("Fallo envío mail:", err));

        res.status(201).json({ 
            message: "Registro iniciado. Revisa tu correo para activar el honor de tu cuenta." 
        });

    } catch (error) {
        console.error("Error en Registro:", error);
        res.status(500).json({ error: "Error interno del Dojo." });
    }
};

// 2. LOGIN (Verifica Email + Password)
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "Guerrero no encontrado." });

        // 🔒 VERIFICACIÓN OBLIGATORIA
        if (!user.isVerified) {
            return res.status(403).json({ error: "Debes verificar tu correo antes de entrar al Dojo." });
        }

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(400).json({ error: "Contraseña incorrecta." });

        // Crear Token
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
                referralCode: user.referralCode // Enviamos esto para el frontend
            }
        });

    } catch (error) {
        res.status(500).json({ error: "Error de autenticación." });
    }
};

// 3. VERIFICACIÓN DE EMAIL (Link del correo)
export const verifyEmail = async (req, res) => {
    const { token } = req.body;

    try {
        const user = await User.findOne({ verificationToken: token });
        if (!user) return res.status(400).json({ error: "Token inválido o expirado." });

        user.isVerified = true;
        user.verificationToken = undefined;
        user.status = 'active'; // Ya puede loguearse
        
        await user.save();

        res.json({ message: "Identidad confirmada. El Dojo está abierto." });
    } catch (error) {
        res.status(500).json({ error: "Error verificando cuenta." });
    }
};

// 4. PERFIL DEL USUARIO (Me)

// Asegúrate de importar el modelo User al inicio del archivo si no está
// import User from "../models/User.js"; 

// En src/controllers/auth.controller.js

export const getMe = async (req, res) => {
    try {
        // 🔴 ANTES DECÍA: req.user.id (Esto daba undefined)
        // 🟢 AHORA DEBE DECIR: req.user.userId
        const user = await User.findById(req.user.userId).select("-password");

        if (!user) {
            return res.status(404).json({ error: "Ninja no encontrado" });
        }

        const userResponse = user.toObject();

        // Lógica de Splinter intacta
        const name = userResponse.ninjaName ? userResponse.ninjaName.toLowerCase() : "";
        if (name === 'splinter') { 
            userResponse.role = 'shogun'; 
        }

        res.status(200).json(userResponse);
    } catch (error) {
        console.error("Error en getMe:", error);
        res.status(500).json({ error: "Error interno" });
    }
};

// Fix definitivo V5 para Render
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/models/User.js";

dotenv.config(); // Cargar variables de entorno

// CONECTAR A LA BASE DE DATOS
const connectDB = async () => {
    try {
        // Asegúrate de tener tu MONGO_URI en el archivo .env o pega tu string de conexión aquí directo para probar
        // Ejemplo: mongoose.connect("mongodb://localhost:27017/aidflow")
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/aidflow"); 
        console.log("🔌 Conectado a MongoDB...");
    } catch (error) {
        console.error("Error conectando DB:", error);
        process.exit(1);
    }
};

const createAdmin = async () => {
    await connectDB();

    const adminData = {
        ninjaName: "GranShogun",
        email: "admin@aidflow.com", // ESTE SERÁ TU EMAIL DE ACCESO
        password: "admin123456",     // ESTA SERÁ TU CONTRASEÑA
        role: "shogun",              // <--- LA CLAVE ES ESTA
        level: 3,
        isVerified: true,
        userIndex: 0
    };

    try {
        // Verificar si ya existe
        const exists = await User.findOne({ email: adminData.email });
        if (exists) {
            console.log("⚠️ El Shogun ya existe. Actualizando rango...");
            exists.role = "shogun";
            await exists.save();
            console.log("✅ Rango forzado a SHOGUN.");
        } else {
            const user = new User(adminData);
            await user.save();
            console.log("✅ USUARIO SHOGUN CREADO EXITOSAMENTE.");
        }
    } catch (error) {
        console.error("❌ Error creando admin:", error.message);
    } finally {
        mongoose.disconnect();
        console.log("👋 Desconectado.");
    }
};

createAdmin();
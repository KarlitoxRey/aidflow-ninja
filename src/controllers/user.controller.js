import User from "../models/User.js";

// ==========================================
// 👤 OBTENER MI PERFIL
// ==========================================
export const getProfile = async (req, res) => {
    try {
        // Buscamos al usuario por el ID del token (sin devolver la contraseña)
        const user = await User.findById(req.user.id).select("-password");
        
        if (!user) {
            return res.status(404).json({ message: "Guerrero no encontrado." });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Error al cargar el perfil." });
    }
};

// ==========================================
// ⚙️ ACTUALIZAR PERFIL (Opcional)
// ==========================================
export const updateProfile = async (req, res) => {
    try {
        const { ninjaName } = req.body;
        // Solo permitimos cambiar el nombre por ahora
        const user = await User.findByIdAndUpdate(
            req.user.id, 
            { ninjaName }, 
            { new: true }
        ).select("-password");

        res.json({ message: "Perfil actualizado.", user });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar." });
    }
};

// ==========================================
// 📜 LISTAR TODOS (SOLO SHOGUN)
// ==========================================
export const getAllUsers = async (req, res) => {
    try {
        if (req.user.role !== 'shogun') {
            return res.status(403).json({ message: "Acceso denegado." });
        }
        const users = await User.find().select("-password").sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Error cargando el censo del clan." });
    }
};
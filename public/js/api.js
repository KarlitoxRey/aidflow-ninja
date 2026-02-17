import { CONFIG } from "./config.js";

/* =========================================
   📨 MENSAJERO NINJA (FETCH WRAPPER)
   ========================================= */

/**
 * Realiza peticiones al Backend inyectando automáticamente el Token.
 * @param {string} endpoint - La ruta de la API (ej: '/api/games')
 * @param {object} options - Opciones de fetch (method, body, headers)
 */
export async function ninjaFetch(endpoint, options = {}) {
    const token = localStorage.getItem(CONFIG.STORAGE.TOKEN);

    // Headers por defecto
    const defaultHeaders = {
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` }) // Inyecta el token si existe
    };

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, config);

        // 🚨 Si el token venció (Error 401), expulsar al usuario
        if (response.status === 401) {
            console.warn("⚠️ Sesión expirada. Expulsando del Dojo...");
            localStorage.clear();
            window.location.replace(CONFIG.PAGES.LOGIN);
            return null;
        }

        return response;
    } catch (error) {
        console.error("🔥 Error de conexión con el Templo:", error);
        alert("🚫 Error de conexión. El servidor no responde.");
        throw error;
    }
}

// Exportamos la URL base por compatibilidad
export const API_URL = CONFIG.API_BASE_URL;
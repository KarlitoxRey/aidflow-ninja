import { CONFIG } from "./config.js";
import { ninjaFetch } from "./api.js";

/**
 * Verifica si el usuario tiene permiso para estar aquí.
 * @param {string|null} requiredRole - El rol necesario ('shogun' o null para cualquiera)
 */
export async function checkAccess(requiredRole = null) {
    const token = localStorage.getItem(CONFIG.STORAGE.TOKEN);
    const userRole = localStorage.getItem(CONFIG.STORAGE.ROLE);

    // 1. Si no hay token, fuera.
    if (!token) {
        window.location.replace(CONFIG.PAGES.LOGIN);
        return;
    }

    // 2. Si se requiere rol Shogun y no lo tiene, al Dashboard.
    if (requiredRole && userRole !== requiredRole) {
        console.warn(`⛔ Acceso denegado. Se requiere rango: ${requiredRole}`);
        window.location.replace(CONFIG.PAGES.DASHBOARD);
        return;
    }

    // 3. (Opcional) Verificar validez real con el servidor
    try {
        const res = await ninjaFetch(CONFIG.ENDPOINTS.ME);
        if (!res || !res.ok) {
            // Si el servidor dice que el token es falso, ninjaFetch ya hizo el redirect
            return; 
        }
    } catch (e) {
        // Si hay error de red, permitimos la carga offline (opcional)
        console.log("Modo offline o error de verificación.");
    }
}
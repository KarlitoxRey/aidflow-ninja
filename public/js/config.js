/* =========================================
   📜 CONFIGURACIÓN DEL CLAN (CONSTANTES)
   ========================================= */

export const CONFIG = {
    // Cambia esto cuando subas a Render/Vercel
    API_BASE_URL: "http://localhost:5000", 
    
    ENDPOINTS: {
        LOGIN: "/api/auth/login",
        REGISTER: "/api/auth/register",
        ME: "/api/auth/me",
        GAMES: "/api/games",
        TOURNAMENTS: "/api/tournaments"
    },
    
    ROLES: {
        SHOGUN: "shogun",
        NINJA: "ninja"
    },
    
    STORAGE: {
        TOKEN: "token",       // Mantenemos la key que ya usabas
        ROLE: "role",         // Mantenemos la key que ya usabas
        USER_NAME: "ninjaName" // Mantenemos la key que ya usabas
    },
    
    PAGES: {
        LOGIN: "login.html",
        DASHBOARD: "dashboard.html",
        ADMIN: "admin.html"
    }
};
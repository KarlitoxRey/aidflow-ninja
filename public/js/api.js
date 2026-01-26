// 🌐 Configuración del Templo Backend

// Detectamos si estamos en casa (localhost) o en la nube
const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// Si es local, usa el puerto 5000. Si es nube, usa el origen actual (https://aidflow-ninja...)
const API_URL = isLocalhost 
    ? "http://localhost:5000" 
    : window.location.origin;

export { API_URL };
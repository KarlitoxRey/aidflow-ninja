import { API_URL } from "./api.js";

// ==========================================
// 🛡️ INICIO BLINDADO (SEGURIDAD & CARGA)
// ==========================================
async function initAdmin() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        console.log("📡 Conectando al Panel Shogun...");
        const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Verificamos que no sea HTML (error común si el servidor devuelve 404 page)
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("El servidor no responde JSON (Posible error de ruta)");
        }

        const user = await res.json();
        
        // Normalizamos el rol a minúsculas por seguridad
        const role = user.role ? user.role.toLowerCase() : '';

        if (!res.ok || role !== 'shogun') {
            alert("🚫 Acceso Denegado: Rango insuficiente.");
            localStorage.clear();
            window.location.replace("login.html");
        } else {
            console.log("⚔️ Shogun identificado:", user.ninjaName);
            
            // Cargar datos del tablero
            loadFinanceStats();      
            loadGameSelector();
            loadGamesList();
            loadUsersList();
            loadTournamentsList();
            loadPendingDeposits(); 
        }
    } catch (error) {
        console.error("🔥 Error crítico de acceso:", error);
        alert("⚠️ Error de conexión con el Templo. Revisa la consola.");
    }
}

// Arrancar sistema
initAdmin();

// ==========================================
// 🚪 SALIDA SEGURA
// ==========================================
window.logout = function() {
    if(confirm("¿Cerrar sesión del Comando Central?")) {
        localStorage.clear();
        window.location.replace("login.html");
    }
};

// ==========================================
// 💰 FINANZAS (ESTADÍSTICAS DEL CLAN)
// ==========================================
async function loadFinanceStats() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/api/finance/admin`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if(res.ok) {
            const data = await res.json();
            const funds = data.funds || { profit:0, dao:0, prizePool:0, microBudget:0 };
            
            // Renderizamos en los IDs correspondientes
            setText('vaultProfit', `$${funds.profit} USD`);
            setText('vaultDao', `$${funds.dao} USD`);
            setText('vaultPrize', `$${funds.prizePool} USD`);
            setText('vaultMicro', `$${funds.microBudget} USD`);
            // Stats generales
            setText('daoTotalDisplay', `$${funds.dao} USD`);
        }
    } catch (e) { console.error("Error cargando finanzas:", e); }
}

// ==========================================
// 🕹️ JUEGOS (INTERNOS Y EXTERNOS)
// ==========================================

// Función para Juego Interno
window.createInternalGame = async function() {
    const title = getVal('giTitle');
    const thumbnail = getVal('giImg');
    const url = getVal('giUrl');
    
    // Capturamos los modos (checkboxes)
    const modes = [];
    if(document.getElementById('modePractice')?.checked) modes.push('practice');
    if(document.getElementById('modeTournament')?.checked) modes.push('tournament');
    if(document.getElementById('modeDuel')?.checked) modes.push('duel');

    if(modes.length === 0) return alert("⚠️ Selecciona al menos un modo de juego (Práctica, Torneo o Duelo).");

    await postGame({ title, thumbnail, embedUrl: url, type: 'internal', modes });
};

// Función para Juego Externo
window.createExternalGame = async function() {
    const title = getVal('geTitle');
    const thumbnail = getVal('geImg');
    const url = getVal('geUrl');
    await postGame({ title, thumbnail, embedUrl: url, type: 'external', modes: ['practice'] });
};

// Lógica central de subida
async function postGame(gameData) {
    if(!gameData.title || !gameData.embedUrl) return alert("❌ Faltan datos obligatorios del juego.");

    try {
        const res = await fetch(`${API_URL}/api/games`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify(gameData)
        });

        if(res.ok) {
            alert("✅ Juego instalado en el inventario.");
            loadGamesList();
            loadGameSelector();
            // Limpiar inputs
            document.querySelectorAll('.admin-form input').forEach(i => i.value = '');
        } else {
            const err = await res.json();
            alert(`Error: ${err.message || 'No se pudo guardar'}`);
        }
    } catch (err

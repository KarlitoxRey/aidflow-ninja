import { API_URL } from "./api.js";

// ==========================================
// 🛡️ INICIO BLINDADO (SEGURIDAD)
// ==========================================
async function initAdmin() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        console.log("📡 Conectando al Panel Shogun...");
        const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // Verificamos que no sea HTML (error común)
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("El servidor no responde (Posible 404 HTML)");
        }

        const user = await res.json();
        
        if (!res.ok || user.role !== 'shogun') {
            alert("🚫 Acceso Denegado: Rango insuficiente.");
            localStorage.clear();
            window.location.replace("login.html");
        } else {
            console.log("⚔️ Shogun identificado:", user.ninjaName);
            
            // Cargar datos
            loadFinanceStats();      
            loadGameSelector();
            loadGamesList();
            loadUsersList();
            loadTournamentsList();
        }
    } catch (error) {
        console.error("🔥 Error crítico:", error);
    }
}

// Arrancar
initAdmin();

// ==========================================
// 💰 FINANZAS (CONECTADO A TU HTML)
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
            
            // Conectamos con tus IDs de bóveda
            setText('vaultProfit', `$${funds.profit} USD`);
            setText('vaultDao', `$${funds.dao} USD`);
            setText('vaultPrize', `$${funds.prizePool} USD`);
            setText('vaultMicro', `$${funds.microBudget} USD`);
            setText('daoTotalDisplay', `$${funds.dao} USD`);
        }
    } catch (e) { console.error("Error finanzas:", e); }
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

    await postGame({ title, thumbnail, embedUrl: url, type: 'internal', modes });
};

// Función para Juego Externo
window.createExternalGame = async function() {
    const title = getVal('geTitle');
    const thumbnail = getVal('geImg');
    const url = getVal('geUrl');
    await postGame({ title, thumbnail, embedUrl: url, type: 'external' });
};

async function postGame(gameData) {
    if(!gameData.title || !gameData.embedUrl) return alert("❌ Faltan datos del juego.");

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
            alert("Error al guardar.");
        }
    } catch (err) { alert("Error de red"); }
}

async function loadGamesList() {
    const container = document.getElementById('gamesList');
    if(!container) return;

    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        window.allGames = games; // Guardamos para el filtro
        renderGames(games);
    } catch(e) { console.error(e); }
}

function renderGames(games) {
    const container = document.getElementById('gamesList');
    container.innerHTML = games.map(g => `
        <div class="metric-card" style="padding:10px; position:relative;">
            <div style="position:absolute; top:5px; right:5px; cursor:pointer; color:red;" onclick="deleteGame('${g._id}')">🗑️</div>
            <img src="${g.thumbnail}" style="width:100%; height:80px; object-fit:cover; border-radius:4px; margin-bottom:5px;">
            <div style="font-weight:bold; font-size:0.9rem; color:white;">${g.title}</div>
            <div class="muted-text" style="font-size:0.7rem;">${g.type.toUpperCase()}</div>
        </div>
    `).join('');
}

// Filtro visual para las pestañas
window.filterGamesByType = function(type) {
    if(!window.allGames) return;
    const filtered = window.allGames.filter(g => g.type === type);
    renderGames(filtered);
};

window.deleteGame = async function(id) {
    if(!confirm("¿Desinstalar juego?")) return;
    await fetch(`${API_URL}/api/games/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    loadGamesList();
};

// ==========================================
// 🏆 TORNEOS
// ==========================================

async function loadGameSelector() {
    const selector = document.getElementById('tGameSelect');
    if(!selector) return;
    const res = await fetch(`${API_URL}/api/games`);
    const games = await res.json();
    selector.innerHTML = `<option value="">Selecciona juego...</option>` + 
                         games.map(g => `<option value="${g._id}">${g.title}</option>`).join('');
}

window.createTournament = async function() {
    const payload = {
        name: getVal('tName'),
        gameId: getVal('tGameSelect'),
        entryFee: getVal('tFee'),
        prize: getVal('tPrize'),
        startDate: getVal('tStart'), // datetime-local funciona directo
        endDate: getVal('tEnd')
    };

    if(!payload.name || !payload.gameId || !payload.startDate) return alert("❌ Faltan datos del torneo.");

    try {
        const res = await fetch(`${API_URL}/api/tournaments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify(payload)
        });
        if(res.ok) {
            alert("🏆 Torneo Publicado");
            loadTournamentsList();
        } else {
            alert("Error creando torneo");
        }
    } catch(e) { alert("Error de red"); }
};

async function loadTournamentsList() {
    const container = document.getElementById('tournamentsList');
    if(!container) return;
    
    const res = await fetch(`${API_URL}/api/tournaments`, {
         headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    const data = await res.json();

    container.innerHTML = data.map(t => `
        <div class="menu-item" style="cursor:default; justify-content: space-between; border-left: 2px solid var(--gold); background:#111; margin-bottom:5px;">
            <div>
                <span class="gold-text" style="font-weight:bold;">${t.name}</span>
                <br><small class="muted-text">Estado: ${t.status || 'Activo'}</small>
            </div>
            <div style="text-align:right;">
                <small style="display:block; color:white;">Bolsa: ${t.prize} NC</small>
                <small class="muted-text">Entrada: ${t.entryFee} NC</small>
            </div>
        </div>
    `).join('');
    
    setText('statActiveTournaments', data.length);
}

// ==========================================
// 👥 USUARIOS
// ==========================================

async function loadUsersList() {
    const tbody = document.getElementById('usersTableBody');
    if(!tbody) return;

    const res = await fetch(`${API_URL}/api/users`, { 
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    if(!res.ok) return;
    const users = await res.json();

    tbody.innerHTML = users.map(u => `
        <tr>
            <td>
                <div style="font-weight:bold; color:white;">${u.ninjaName}</div>
                <div style="font-size:0.75rem; color:#666;">${u.email}</div>
            </td>
            <td>
                <span style="background:${u.role==='shogun'?'#d90429':'#222'}; padding:2px 8px; border-radius:4px; font-size:0.8rem;">
                    ${u.role === 'shogun' ? 'SHOGUN' : 'Nivel ' + (u.level || 0)}
                </span>
            </td>
            <td>${u.referralStats ? u.referralStats.count : 0}</td>
        </tr>
    `).join('');

    setText('statUsers', users.length);
}

// Utilidades rápidas
function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setText(id, txt) { const el = document.getElementById(id); if(el) el.innerText = txt; }

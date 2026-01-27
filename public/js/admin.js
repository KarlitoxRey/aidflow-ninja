import { API_URL } from "./api.js";

// ==========================================
// 🛡️ SEGURIDAD & INICIO (BLINDADO)
// ==========================================
async function initAdmin() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        console.log("📡 Conectando al Panel Shogun...");
        
        const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // 🛑 ESCUDO: Verificar si es JSON antes de leer (Evita el error Unexpected token <)
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("El servidor devolvió HTML (Posible error 404 o ruta mal configurada)");
        }

        const user = await res.json();
        
        if (!res.ok || user.role !== 'shogun') {
            alert("🚫 Acceso denegado. Se requiere rango Shogun.");
            localStorage.clear();
            window.location.replace("login.html");
        } else {
            console.log("⚔️ Panel Shogun Activo: Acceso concedido.");
            
            // Cargar tus módulos avanzados
            loadFinanceStats();      
            loadGameSelector();
            loadGamesList();
            loadUsersList();
            loadTournamentsList();
        }
    } catch (error) {
        console.error("🔥 Error de autenticación:", error);
        alert("Error de conexión: " + error.message);
    }
}

// Arrancar sistema
initAdmin();

// ==========================================
// 💰 GESTIÓN FINANCIERA (3-1-3-3)
// ==========================================
async function loadFinanceStats() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/api/finance/admin`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if(res.ok) {
            const data = await res.json();
            // Fallback por si data.funds viene vacío
            const funds = data.funds || { profit:0, dao:0, prizePool:0, microBudget:0 };
            
            // Actualización segura del DOM
            setText('vaultProfit', `$${funds.profit} USD`);
            setText('vaultDao', `$${funds.dao} USD`);
            setText('vaultPrize', `$${funds.prizePool} USD`);
            setText('vaultMicro', `$${funds.microBudget} USD`);
            
            setText('daoTotalDisplay', `$${funds.dao} USD`);
        }
    } catch (e) {
        console.error("Error cargando finanzas:", e);
    }
}

// ==========================================
// 🕹️ GESTIÓN DE JUEGOS
// ==========================================

// Wrapper para Juego Interno
window.createInternalGame = async function() {
    const title = getVal('giTitle');
    const thumbnail = getVal('giImg');
    const url = getVal('giUrl'); // Ruta local o relativa
    await postGame({ title, thumbnail, embedUrl: url, type: 'internal' });
};

// Wrapper para Juego Externo
window.createExternalGame = async function() {
    const title = getVal('geTitle');
    const thumbnail = getVal('geImg');
    const url = getVal('geUrl'); // URL externa (https...)
    await postGame({ title, thumbnail, embedUrl: url, type: 'external' });
};

async function postGame(gameData) {
    if(!gameData.title || !gameData.embedUrl) return alert("❌ Faltan datos obligatorios.");

    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/games`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(gameData)
        });

        if(res.ok) {
            alert("✅ Juego añadido al inventario.");
            loadGamesList();
            loadGameSelector();
            // Limpiar formularios
            document.querySelectorAll('input').forEach(i => i.value = '');
        } else {
            alert("Error al guardar juego.");
        }
    } catch (err) { console.error(err); }
}

async function loadGamesList() {
    const container = document.getElementById('gamesList');
    if(!container) return;

    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        window.allGames = games; 
        renderGames(games);
    } catch(e) { console.error(e); }
}

function renderGames(games) {
    const container = document.getElementById('gamesList');
    if(!container) return;
    
    container.innerHTML = games.map(g => `
        <div class="metric-card" style="padding:10px; position:relative; background: #1a1a1a; border: 1px solid #333; margin-bottom: 10px;">
            <div style="position:absolute; top:5px; right:5px; cursor:pointer; color:red; font-weight:bold;" onclick="deleteGame('${g._id}')">🗑️</div>
            <div style="display:flex; gap: 10px; align-items:center;">
                <img src="${g.thumbnail}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;">
                <div>
                    <div style="font-weight:bold; font-size:0.9rem; color: #fff;">${g.title}</div>
                    <div class="muted-text" style="font-size:0.7rem;">${g.type.toUpperCase()}</div>
                </div>
            </div>
        </div>
    `).join('');
}

window.filterGamesByType = function(type) {
    if(!window.allGames) return;
    const filtered = window.allGames.filter(g => g.type === type);
    renderGames(filtered);
};

window.deleteGame = async function(id) {
    if(!confirm("¿Eliminar juego permanentemente?")) return;
    const token = localStorage.getItem("token");
    await fetch(`${API_URL}/api/games/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
    });
    loadGamesList();
};

// ==========================================
// 🏆 GESTIÓN DE TORNEOS
// ==========================================

async function loadGameSelector() {
    const selector = document.getElementById('tGameSelect');
    if(!selector) return;
    
    const res = await fetch(`${API_URL}/api/games`);
    const games = await res.json();
    selector.innerHTML = `<option value="">Selecciona un juego...</option>` + 
                         games.map(g => `<option value="${g._id}">${g.title}</option>`).join('');
}

window.createTournament = async function() {
    const name = getVal('tName');
    const gameId = getVal('tGameSelect');
    const entryFee = getVal('tFee');
    const prize = getVal('tPrize');
    const startDate = getVal('tStart');
    const endDate = getVal('tEnd');

    if(!name || !gameId || !startDate || !endDate) return alert("❌ Faltan datos críticos (Fechas/Juego).");

    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/tournaments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name, gameId, entryFee, prize, startDate, endDate })
    });

    if(res.ok) {
        alert("🏆 Torneo Publicado");
        loadTournamentsList();
    } else {
        alert("Error creando torneo");
    }
};

async function loadTournamentsList() {
    const container = document.getElementById('tournamentsList');
    if(!container) return;
    
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/tournaments`, {
         headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();

    container.innerHTML = data.map(t => `
        <div class="menu-item" style="cursor:default; justify-content: space-between; border-left: 2px solid var(--gold); background: #111; margin-bottom: 5px; padding: 10px;">
            <div>
                <span class="gold-text" style="font-weight:bold;">${t.name}</span>
                <br><small class="muted-text">Estado: ${t.status || 'Activo'}</small>
            </div>
            <div style="text-align:right;">
                <small style="display:block; color:white;">Premio: ${t.prize} NC</small>
                <small class="muted-text">Entrada: ${t.entryFee} NC</small>
            </div>
        </div>
    `).join('');
    
    setText('statActiveTournaments', data.length);
}

// ==========================================
// 👥 USUARIOS & CENSO
// ==========================================

async function loadUsersList() {
    const tbody = document.getElementById('usersTableBody');
    if(!tbody) return;

    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/users`, { 
        headers: { "Authorization": `Bearer ${token}` }
    });
    
    if(!res.ok) return;
    const users = await res.json();

    tbody.innerHTML = users.map(u => `
        <tr style="border-bottom: 1px solid #333;">
            <td style="padding: 10px;">
                <div style="font-weight:bold; color:white;">${u.ninjaName}</div>
                <div style="font-size:0.75rem; color:#666;">${u.email}</div>
            </td>
            <td style="padding: 10px;">
                <span style="background:${u.role==='shogun'?'#d90429':'#222'}; padding:2px 8px; border-radius:4px; font-size:0.8rem; color: white;">
                    ${u.role === 'shogun' ? 'SHOGUN' : 'Nivel ' + (u.level || 0)}
                </span>
            </td>
            <td style="padding: 10px; color: var(--gold);">${u.referralStats ? u.referralStats.count : 0}</td>
        </tr>
    `).join('');

    setText('statUsers', users.length);
}

// Utilidades UI
function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setText(id, txt) { const el = document.getElementById(id); if(el) el.innerText = txt; }

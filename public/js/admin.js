import { API_URL } from "./api.js";

// ==========================================
// 🛡️ SEGURIDAD & INICIO
// ==========================================
async function initAdmin() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        // Verificar rango Shogun
        const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await res.json();
        
        if (!res.ok || user.role !== 'shogun') {
            alert("🚫 Acceso denegado. Se requiere rango Shogun.");
            localStorage.clear();
            window.location.replace("login.html");
        } else {
            console.log("⚔️ Panel Shogun Activo");
            // Cargar todos los módulos
            loadFinanceStats();      // <--- NUEVO
            loadGameSelector();
            loadGamesList();
            loadUsersList();
            loadTournamentsList();
        }
    } catch (error) {
        console.error("Error de autenticación:", error);
    }
}

// Arrancar
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
            // Llenamos las 4 bóvedas
            const funds = data.funds || { profit:0, dao:0, prizePool:0, microBudget:0 };
            
            document.getElementById('vaultProfit').innerText = `$${funds.profit} USD`;
            document.getElementById('vaultDao').innerText = `$${funds.dao} USD`;
            document.getElementById('vaultPrize').innerText = `$${funds.prizePool} USD`;
            document.getElementById('vaultMicro').innerText = `$${funds.microBudget} USD`;

            // También actualizamos la vista de DAO si existe
            const daoDisplay = document.getElementById('daoTotalDisplay');
            if(daoDisplay) daoDisplay.innerText = `$${funds.dao} USD`;
        }
    } catch (e) {
        console.error("Error cargando finanzas:", e);
    }
}

// ==========================================
// 🕹️ GESTIÓN DE JUEGOS
// ==========================================

// 1. Crear Juego Interno
window.createInternalGame = async function() {
    const title = document.getElementById('giTitle').value;
    const thumbnail = document.getElementById('giImg').value;
    const url = document.getElementById('giUrl').value;
    await postGame({ title, thumbnail, embedUrl: url, type: 'internal' });
};

// 2. Crear Juego Externo
window.createExternalGame = async function() {
    const title = document.getElementById('geTitle').value;
    const thumbnail = document.getElementById('geImg').value;
    const url = document.getElementById('geUrl').value;
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
    container.innerHTML = games.map(g => `
        <div class="metric-card" style="padding:10px; position:relative;">
            <div style="position:absolute; top:5px; right:5px; cursor:pointer; color:red;" onclick="deleteGame('${g._id}')">🗑️</div>
            <img src="${g.thumbnail}" style="width:100%; height:100px; object-fit:cover; border-radius:4px; margin-bottom:5px;">
            <div style="font-weight:bold; font-size:0.9rem;">${g.title}</div>
            <div class="muted-text" style="font-size:0.7rem;">${g.type.toUpperCase()}</div>
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
    const name = document.getElementById('tName').value;
    const gameId = document.getElementById('tGameSelect').value;
    const entryFee = document.getElementById('tFee').value;
    const prize = document.getElementById('tPrize').value;
    const startDate = document.getElementById('tStart').value;
    const endDate = document.getElementById('tEnd').value;

    if(!name || !gameId || !startDate || !endDate) return alert("❌ Faltan datos críticos.");

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
        <div class="menu-item" style="cursor:default; justify-content: space-between; border-left: 2px solid var(--gold);">
            <div>
                <span class="gold-text" style="font-weight:bold;">${t.name}</span>
                <br><small class="muted-text">Estado: ${t.status || 'Activo'}</small>
            </div>
            <div style="text-align:right;">
                <small style="display:block;">Bolsa: ${t.prize} NC</small>
                <small class="muted-text">Entrada: ${t.entryFee} NC</small>
            </div>
        </div>
    `).join('');
    
    document.getElementById('statActiveTournaments').innerText = data.length;
}

// ==========================================
// 👥 USUARIOS & CENSO
// ==========================================

async function loadUsersList() {
    const tbody = document.getElementById('usersTableBody');
    if(!tbody) return;

    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/users`, { // Asegúrate de tener esta ruta en user.routes.js
        headers: { "Authorization": `Bearer ${token}` }
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
                    Nivel ${u.level || 0}
                </span>
            </td>
            <td>${u.referralStats ? u.referralStats.count : 0}</td>
        </tr>
    `).join('');

    document.getElementById('statUsers').innerText = users.length;
}
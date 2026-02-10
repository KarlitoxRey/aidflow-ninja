import { API_URL } from "./api.js";

// ==========================================
// 1. INICIALIZACIÓN BLINDADA
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initAdmin();
});

async function initAdmin() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        const user = await res.json();
        const role = user.role ? user.role.toLowerCase() : '';

        if (!res.ok || (role !== 'shogun' && role !== 'admin')) {
            alert("⛔ ACCESO DENEGADO.");
            localStorage.clear();
            window.location.replace("login.html");
        } else {
            console.log("⚔️ Shogun al mando.");
            loadStats();
            loadPendingDeposits();
            setInterval(loadStats, 15000);
        }
    } catch (error) { console.error(error); }
}

// ==========================================
// 2. NAVEGACIÓN
// ==========================================
window.switchView = (viewName, btnElement) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(viewName).classList.add('active');
    if (btnElement) btnElement.classList.add('active');

    if(viewName === 'view-deposits') loadPendingDeposits();
    if(viewName === 'view-dashboard') loadStats();
    if(viewName === 'view-games') loadAdminGames();         // <---
    if(viewName === 'view-tournaments') loadAdminTournaments(); // <---
    if(viewName === 'view-users') loadUsersList();          // <---
};

window.logoutAdmin = () => { localStorage.clear(); window.location.replace("login.html"); };

// ==========================================
// 3. DASHBOARD (FINANZAS)
// ==========================================
async function loadStats() {
    const token = localStorage.getItem("token");
    if(!token) return;
    try {
        const res = await fetch(`${API_URL}/api/finance/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return; 
        const data = await res.json();

        safeText("val-dao", formatMoney(data.funds.dao));
        safeText("val-maint", formatMoney(data.funds.admin));
        safeText("val-backup", formatMoney(data.funds.backup));
        safeText("val-users", data.stats.active);
        safeText("val-today", formatMoney(data.stats.today));
        safeText("val-total", formatMoney(data.funds.total));
        renderHistoryTable(data.history);
    } catch (error) { console.error(error); }
}

function renderHistoryTable(transactions) {
    const container = document.getElementById("activity-table-body");
    if (!container) return;
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px;">Sin actividad.</td></tr>';
        return;
    }
    container.innerHTML = transactions.map(tx => `
        <tr style="border-bottom: 1px solid #222;">
            <td style="padding: 8px; color: #666;">${new Date(tx.updatedAt).toLocaleDateString()}</td>
            <td style="font-weight: bold; color: white;">${tx.user ? tx.user.ninjaName : 'Desconocido'}</td>
            <td>${tx.description || tx.type}</td>
            <td style="color:${tx.type==='deposit'?'#0f0':'#f00'}; font-family:monospace;">${tx.type==='deposit'?'+':'-'}${formatMoney(tx.amount)}</td>
        </tr>`).join('');
}

// ==========================================
// 4. TESORERÍA
// ==========================================
window.loadPendingDeposits = async () => {
    const container = document.getElementById("depositList");
    const emptyMsg = document.getElementById("emptyTreasury");
    const badge = document.getElementById("pendingBadge");
    
    try {
        const res = await fetch(`${API_URL}/api/payments/pending`, { headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` } });
        const list = await res.json();

        if(badge) { badge.innerText = list.length; badge.style.display = list.length > 0 ? 'inline-block' : 'none'; }
        
        if (list.length === 0) {
            container.innerHTML = "";
            emptyMsg.style.display = "block";
            return;
        }
        emptyMsg.style.display = "none";
        container.innerHTML = list.map(tx => `
            <tr>
                <td>${new Date(tx.createdAt).toLocaleDateString()}</td>
                <td><strong style="color:white">${tx.user?.ninjaName || 'Anon'}</strong></td>
                <td style="color:${tx.type==='deposit'?'#0f0':'#f00'}">${tx.type.toUpperCase()}</td>
                <td style="font-weight:bold;">$${tx.amount}</td>
                <td style="font-family:monospace; color:#888;">${tx.referenceId || tx.description}</td>
                <td>
                    <button onclick="processTx('${tx._id}', 'approve')" class="btn-action btn-approve">✔</button>
                    <button onclick="processTx('${tx._id}', 'reject')" class="btn-action btn-reject">X</button>
                </td>
            </tr>`).join('');
    } catch (error) { console.error(error); }
};

window.processTx = async (txId, action) => {
    if(!confirm(`¿${action.toUpperCase()} transacción?`)) return;
    try {
        const res = await fetch(`${API_URL}/api/payments/manage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ transactionId: txId, action })
        });
        if(res.ok) { alert("Hecho."); loadPendingDeposits(); loadStats(); }
    } catch (e) { alert("Error"); }
};

// ==========================================
// 5. GESTIÓN DE JUEGOS
// ==========================================
window.createGame = async function() {
    const title = document.getElementById('gTitle').value;
    const embedUrl = document.getElementById('gUrl').value;
    const type = document.getElementById('gType').value;

    if(!title || !embedUrl) return alert("❌ Faltan datos.");

    try {
        const res = await fetch(`${API_URL}/api/games`, {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ title, embedUrl, type })
        });
        if(res.ok) { alert("🕹️ Juego subido."); loadAdminGames(); }
    } catch(e) {}
};

window.deleteGame = async function(id) {
    if(!confirm("¿Eliminar juego?")) return;
    try {
        const res = await fetch(`${API_URL}/api/games/${id}`, {
            method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if(res.ok) loadAdminGames();
    } catch(e) {}
};

async function loadAdminGames() {
    const container = document.getElementById("adminGames");
    if(!container) return;
    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        container.innerHTML = games.map(g => `
            <div class="list-item">
                <div>
                    <strong>${g.title}</strong> <small>(${g.type || 'gen'})</small>
                </div>
                <button onclick="deleteGame('${g._id}')" class="btn-delete">BORRAR</button>
            </div>`).join('');
    } catch(e) { container.innerHTML = "Error games"; }
}

// ==========================================
// 6. GESTIÓN DE TORNEOS
// ==========================================
window.createTournament = async function() {
    const name = document.getElementById('tName').value;
    const entryFee = document.getElementById('tFee').value;
    const prize = document.getElementById('tPrize').value;
    const winners = document.getElementById('tWinners').value;
    const gameType = document.getElementById('tGameType').value;

    if(!name || !entryFee) return alert("❌ Faltan datos.");

    try {
        const res = await fetch(`${API_URL}/api/tournaments`, {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ name, entryFee, prize, maxWinners: winners, gameType })
        });
        if(res.ok) { alert("🏆 Torneo creado."); loadAdminTournaments(); }
    } catch(e) {}
};

window.deleteTournament = async function(id) {
    if(!confirm("¿Cancelar torneo?")) return;
    try {
        const res = await fetch(`${API_URL}/api/tournaments/${id}`, {
            method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if(res.ok) loadAdminTournaments();
    } catch(e) {}
};

async function loadAdminTournaments() {
    const container = document.getElementById("adminTournaments");
    if(!container) return;
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/tournaments`, { headers: { "Authorization": `Bearer ${token}` } });
        const data = await res.json();
        
        container.innerHTML = data.map(t => `
            <div class="list-item">
                <div>
                    <strong>${t.name}</strong><br>
                    <small style="color:var(--gold);">Pozo: $${t.prizePool} | Ganadores: ${t.maxWinners || 1}</small>
                </div>
                <button onclick="deleteTournament('${t._id}')" class="btn-delete">CANCELAR</button>
            </div>`).join('');
    } catch(e) {}
}

// ==========================================
// 7. CENSO DE GUERREROS (TABLA)
// ==========================================
window.loadUsersList = async function() {
    const tbody = document.getElementById("usersTableBody");
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/api/users/census`, { // Ruta especial
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
        });
        
        // Si no existe la ruta census, intentamos con la normal
        if(!res.ok) return loadUsersFallback();

        const users = await res.json();
        tbody.innerHTML = users.map(u => `
            <tr>
                <td style="font-weight:bold; color:white;">${u.ninjaName}</td>
                <td><span style="color:${getLevelColor(u.level)}">NIVEL ${u.level || 0}</span></td>
                <td style="text-align:center;">${u.referralCount || 0}</td>
                <td style="color:var(--gold); font-weight:bold;">${u.tournamentTokens || 0}</td>
                <td>${u.isActive ? '<span style="color:#0f0">ACTIVO</span>' : '<span style="color:#666">OFF</span>'}</td>
            </tr>`).join('');
    } catch(e) { tbody.innerHTML = 'Error'; }
};

function getLevelColor(level) {
    if(level === 1) return '#cd7f32';
    if(level === 2) return '#c0c0c0';
    if(level === 3) return '#ffd700';
    return '#666';
}

async function loadUsersFallback() {
    const tbody = document.getElementById("usersTableBody");
    const res = await fetch(`${API_URL}/api/users`, { headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` } });
    const users = await res.json();
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>${u.ninjaName}</td>
            <td>${u.level}</td>
            <td>-</td>
            <td>${u.tournamentTokens}</td>
            <td>${u.isActive ? 'ON' : 'OFF'}</td>
        </tr>`).join('');
}

// Auxiliares
function safeText(id, text) { const el = document.getElementById(id); if(el) el.innerText = text; }
function formatMoney(amount) { return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }

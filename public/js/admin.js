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
            // Auto-refresh cada 15 seg
            setInterval(loadStats, 15000);
        }
    } catch (error) { console.error(error); }
}

// ==========================================
// 2. NAVEGACIÓN
// ==========================================
window.switchView = (viewName, btnElement) => {
    // A. Ocultar secciones y desactivar botones
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    // B. Activar sección y botón
    const target = document.getElementById(viewName);
    if(target) target.classList.add('active');
    if (btnElement) btnElement.classList.add('active');

    // C. Carga diferida según la vista
    if(viewName === 'view-deposits') loadPendingDeposits();
    if(viewName === 'view-dashboard') loadStats();
    if(viewName === 'view-games') loadAdminGames();         
    
    // 👇 CARGA DE TORNEOS Y SELECTOR DE JUEGOS
    if(viewName === 'view-tournaments') {
        loadAdminTournaments(); 
        loadGameOptions(); 
    }
    
    if(viewName === 'view-users') loadUsersList();          
};

window.logoutAdmin = () => { localStorage.clear(); window.location.replace("login.html"); };

// ==========================================
// 3. GESTIÓN DE JUEGOS (PROPIOS Y EXTERNOS)
// ==========================================
window.createGame = async function(sourceType) {
    let title, embedUrl, thumbnail, type;

    // Determinar de qué formulario vienen los datos
    if (sourceType === 'internal') {
        // Formulario de Juegos Propios
        title = document.getElementById('nTitle').value;
        embedUrl = document.getElementById('nUrl').value;
        thumbnail = document.getElementById('nThumb').value;
        type = document.getElementById('nType').value;
    } else {
        // Formulario de Embeds (Default)
        title = document.getElementById('gTitle').value;
        embedUrl = document.getElementById('gUrl').value;
        thumbnail = document.getElementById('gThumb').value;
        type = document.getElementById('gType').value;
        sourceType = 'external';
    }

    if(!title || !embedUrl) return alert("❌ Faltan datos (Título o URL).");

    try {
        const res = await fetch(`${API_URL}/api/games`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify({ 
                title, 
                embedUrl, 
                thumbnail, 
                type, 
                source: sourceType // Enviamos si es 'internal' o 'external'
            })
        });

        if(res.ok) { 
            alert(`✅ Juego ${sourceType === 'internal' ? 'PROPIO' : 'EXTERNO'} agregado.`); 
            
            // Limpiar campos según el formulario usado
            if (sourceType === 'internal') {
                document.getElementById('nTitle').value = "";
                document.getElementById('nUrl').value = "";
                document.getElementById('nThumb').value = "";
            } else {
                document.getElementById('gTitle').value = "";
                document.getElementById('gUrl').value = "";
                document.getElementById('gThumb').value = "";
            }
            
            loadAdminGames(); 
        } else {
            alert("Error al guardar el juego.");
        }
    } catch(e) { console.error(e); }
};

window.deleteGame = async function(id) {
    if(!confirm("¿Eliminar este juego permanentemente?")) return;
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
        
        if(games.length === 0) {
            container.innerHTML = '<p class="muted-text" style="grid-column: 1/-1;">Inventario vacío.</p>';
            return;
        }

        container.innerHTML = games.map(g => {
            // Distinguir visualmente
            const isInternal = g.source === 'internal';
            const badge = isInternal 
                ? `<span style="background:var(--gold); color:black; padding:2px 5px; font-size:0.7rem; font-weight:bold; border-radius:3px;">⚡ PROPIO</span>`
                : `<span style="background:#333; color:#ccc; padding:2px 5px; font-size:0.7rem; border-radius:3px;">🌐 EMBED</span>`;

            return `
            <div class="list-item" style="display:flex; flex-direction:column; align-items:flex-start; gap:10px;">
                <div style="display:flex; align-items:center; gap:10px; width:100%;">
                    <img src="${g.thumbnail || 'https://via.placeholder.com/40'}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">
                    <div style="flex:1;">
                        <strong>${g.title}</strong> <br>
                        ${badge} <small style="color:#888;">(${g.type})</small>
                    </div>
                    <button onclick="deleteGame('${g._id}')" class="btn-delete" style="align-self: flex-start;">X</button>
                </div>
                <div style="font-family:monospace; font-size:0.7rem; color:#666; word-break:break-all;">
                    ${g.embedUrl.substring(0, 40)}...
                </div>
            </div>`;
        }).join('');
    } catch(e) { container.innerHTML = "Error cargando juegos."; }
}

// ==========================================
// 4. GESTIÓN DE TORNEOS (LOGICA QUE FALTABA)
// ==========================================

// Función para llenar el SELECT del HTML con los juegos disponibles
async function loadGameOptions() {
    const select = document.getElementById("tGameSelect");
    if (!select) return;

    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();

        if (games.length === 0) {
            select.innerHTML = '<option value="">No hay juegos. Crea uno primero.</option>';
        } else {
            // Llenamos el select con los juegos reales
            select.innerHTML = '<option value="">-- Selecciona un Juego --</option>' + 
                games.map(g => `<option value="${g._id}">${g.title}</option>`).join('');
        }
    } catch (e) { console.error("Error cargando juegos para select"); }
}

window.createTournament = async function() {
    const name = document.getElementById('tName').value;
    const entryFee = document.getElementById('tFee').value;
    const prize = document.getElementById('tPrize').value;
    const winners = document.getElementById('tWinners').value;
    const gameType = document.getElementById('tGameType').value;
    const gameId = document.getElementById('tGameSelect').value; // OBTENEMOS EL ID DEL JUEGO

    if(!name || !entryFee || !gameId) return alert("❌ Faltan datos (Nombre, Entrada o Juego).");

    try {
        const res = await fetch(`${API_URL}/api/tournaments`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify({ name, entryFee, prize, maxWinners: winners, gameType, gameId })
        });

        if(res.ok) {
            alert("🏆 Torneo creado exitosamente.");
            document.getElementById('tName').value = ""; // Limpiar
            document.getElementById('tFee').value = "";
            loadAdminTournaments();
        } else {
            const err = await res.json();
            alert("Error: " + (err.message || "Error al crear"));
        }
    } catch(e) { console.error(e); alert("Error de conexión"); }
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
        
        if(data.length === 0) {
            container.innerHTML = '<p class="muted-text">No hay torneos activos.</p>';
            return;
        }
        
        container.innerHTML = data.map(t => `
            <div class="list-item">
                <div>
                    <strong>${t.name}</strong> <span style="font-size:0.8rem; color:#888;">(${t.game?.title || 'General'})</span><br>
                    <small style="color:var(--gold);">Pozo: $${t.prizePool} | Ganadores: ${t.maxWinners || 1}</small>
                </div>
                <button onclick="deleteTournament('${t._id}')" class="btn-delete">CANCELAR</button>
            </div>`).join('');
    } catch(e) {
        container.innerHTML = '<p style="color:red">Error cargando torneos.</p>';
    }
}

// ==========================================
// 5. DASHBOARD (FINANZAS & HISTORIAL)
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
    } catch (error) { console.error("Error stats:", error); }
}

function renderHistoryTable(transactions) {
    const container = document.getElementById("activity-table-body");
    if (!container) return;
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px;">Sin actividad reciente.</td></tr>';
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
// 6. TESORERÍA (SOLICITUDES DE PAGO)
// ==========================================
window.loadPendingDeposits = async () => {
    const container = document.getElementById("depositList");
    const emptyMsg = document.getElementById("emptyTreasury");
    const badge = document.getElementById("pendingBadge");
    
    try {
        const res = await fetch(`${API_URL}/api/payments/pending`, { headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` } });
        const list = await res.json();

        if(badge) { 
            badge.innerText = list.length; 
            badge.style.display = list.length > 0 ? 'inline-block' : 'none'; 
        }
        
        if (list.length === 0) {
            if(container) container.innerHTML = "";
            if(emptyMsg) emptyMsg.style.display = "block";
            return;
        }
        
        if(emptyMsg) emptyMsg.style.display = "none";
        if(container) {
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
        }
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
        if(res.ok) { 
            alert("Operación exitosa."); 
            loadPendingDeposits(); 
            loadStats(); 
        } else {
            const data = await res.json();
            alert("Error: " + data.error);
        }
    } catch (e) { alert("Error de conexión"); }
};

// ==========================================
// 7. CENSO DE GUERREROS
// ==========================================
window.loadUsersList = async function() {
    const tbody = document.getElementById("usersTableBody");
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/api/users/census`, { 
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
        });
        
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
    } catch(e) { tbody.innerHTML = 'Error de conexión'; }
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

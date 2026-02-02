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

        // Verificamos que no sea HTML (error común si el servidor devuelve 404)
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("El servidor no responde JSON (Posible error de ruta)");
        }

        const user = await res.json();
        
        // --- 🔍 DIAGNÓSTICO DE ACCESO (Mirar Consola F12) ---
        console.warn("--- REPORTE DE IDENTIDAD ---");
        console.log("👤 Ninja:", user.ninjaName);
        console.log("📜 Rol en DB:", user.role); 
        console.log("🔑 Token actual:", token.substring(0, 15) + "...");
        console.log("----------------------------");

        // Normalizamos el rol a minúsculas por seguridad
        const role = user.role ? user.role.toLowerCase() : '';

        if (!res.ok || role !== 'shogun') {
            alert(`⛔ ACCESO DENEGADO.\nTu rol actual es: "${user.role}"\nSe requiere: "shogun"`);
            // No borramos localStorage automáticamente para que puedas ver el log
            window.location.replace("login.html");
        } else {
            console.log("⚔️ Shogun identificado. Cargando módulos...");
            
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
// 🚪 SALIDA SEGURA (Logout)
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

    if(modes.length === 0) return alert("⚠️ Selecciona al menos un modo de juego.");

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
    } catch (err) { alert("Error de red al guardar juego."); }
}

// Cargar lista visual
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

// Renderizador
function renderGames(games) {
    const container = document.getElementById('gamesList');
    if(!container) return;
    
    if (games.length === 0) {
        container.innerHTML = '<p class="muted-text">El inventario está vacío.</p>';
        return;
    }

    container.innerHTML = games.map(g => `
        <div class="metric-card" style="padding:10px; position:relative; background: #1a1a1a; border: 1px solid #333;">
            <div style="position:absolute; top:5px; right:5px; cursor:pointer; color:#d90429;" onclick="deleteGame('${g._id}')">🗑️</div>
            <img src="${g.thumbnail}" style="width:100%; height:80px; object-fit:cover; border-radius:4px; margin-bottom:5px;">
            <div style="font-weight:bold; font-size:0.9rem; color:white;">${g.title}</div>
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
    if(!confirm("⚠️ ¿Desinstalar este juego permanentemente?")) return;
    await fetch(`${API_URL}/api/games/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    loadGamesList();
};

// ==========================================
// 🏆 GESTIÓN DE TORNEOS
// ==========================================

async function loadGameSelector() {
    const selector = document.getElementById('tGameSelect');
    if(!selector) return;
    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        selector.innerHTML = `<option value="">Selecciona juego...</option>` + 
                             games.map(g => `<option value="${g._id}">${g.title}</option>`).join('');
    } catch (e) { console.error("Error cargando selector de juegos"); }
}

window.createTournament = async function() {
    const payload = {
        name: getVal('tName'),
        gameId: getVal('tGameSelect'),
        entryFee: getVal('tFee'),
        prize: getVal('tPrize'),
        startDate: getVal('tStart'), 
        endDate: getVal('tEnd')      
    };

    if(!payload.name || !payload.gameId || !payload.startDate) return alert("❌ Faltan datos clave del torneo.");

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
            alert("🏆 Torneo Publicado exitosamente");
            loadTournamentsList();
            document.getElementById('tName').value = ''; 
        } else {
            alert("Error creando torneo. Revisa los datos.");
        }
    } catch(e) { alert("Error de red al crear torneo."); }
};

async function loadTournamentsList() {
    const container = document.getElementById('tournamentsList');
    if(!container) return;
    
    try {
        const res = await fetch(`${API_URL}/api/tournaments`, {
             headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();

        container.innerHTML = data.map(t => `
            <div class="menu-item" style="cursor:default; justify-content: space-between; border-left: 2px solid var(--shogun-gold); background:#111; margin-bottom:5px; padding: 10px;">
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
    } catch (e) { console.log("Error loading tournaments list"); }
}

// ==========================================
// 👥 GESTIÓN DE USUARIOS
// ==========================================

async function loadUsersList() {
    const tbody = document.getElementById('usersTableBody');
    if(!tbody) return;

    try {
        const res = await fetch(`${API_URL}/api/users`, { 
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if(!res.ok) return;
        const users = await res.json();

        tbody.innerHTML = users.map(u => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #333;">
                    <div style="font-weight:bold; color:white;">${u.ninjaName}</div>
                    <div style="font-size:0.75rem; color:#666;">${u.email}</div>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #333;">
                    <span style="background:${u.role==='shogun'?'#d90429':'#222'}; color: white; padding:2px 8px; border-radius:4px; font-size:0.8rem;">
                        ${u.role === 'shogun' ? 'SHOGUN' : 'Nivel ' + (u.level || 0)}
                    </span>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #333; text-align: center;">
                    ${u.referralStats ? u.referralStats.count : 0}
                </td>
            </tr>
        `).join('');

        setText('statUsers', users.length);
    } catch (e) { console.error("Error cargando usuarios"); }
}

// ==========================================
// 🛠️ UTILIDADES
// ==========================================
function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setText(id, txt) { const el = document.getElementById(id); if(el) el.innerText = txt; }

// ==========================================
// 💰 GESTIÓN DE TESORERÍA (DEPÓSITOS)
// ==========================================

window.loadPendingDeposits = async function() {
    const container = document.getElementById('pendingDepositsList');
    if(!container) return;

    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/payments/pending`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if(!res.ok) throw new Error("Error al cargar finanzas");
        
        const transactions = await res.json();

        if (transactions.length === 0) {
            container.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:#666;">📭 No hay tributos pendientes.</td></tr>`;
            return;
        }

        container.innerHTML = transactions.map(tx => `
            <tr style="border-bottom: 1px solid #222;">
                <td style="padding:15px; color:#888; font-size:0.9rem;">
                    ${new Date(tx.createdAt).toLocaleDateString()} ${new Date(tx.createdAt).toLocaleTimeString()}
                </td>
                <td style="padding:15px;">
                    <strong style="color:white;">${tx.user?.ninjaName || 'Desconocido'}</strong><br>
                    <small style="color:#666;">${tx.user?.email || ''}</small>
                </td>
                <td style="padding:15px; color:#00d4ff; font-family:'Orbitron';">
                    ${tx.referenceId}
                </td>
                <td style="padding:15px; font-size:1.2rem; color:#10b981;">
                    $${tx.amount}
                </td>
                <td style="padding:15px; text-align:right;">
                    <button onclick="processDeposit('${tx._id}', 'approve')" 
                        style="background:#10b981; border:none; color:black; padding:5px 10px; cursor:pointer; font-weight:bold; margin-right:5px; border-radius:4px;">
                        ✓ APROBAR
                    </button>
                    <button onclick="processDeposit('${tx._id}', 'reject')" 
                        style="background:#d90429; border:none; color:white; padding:5px 10px; cursor:pointer; border-radius:4px;">
                        ✕
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error(error);
        container.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Error de conexión con la bóveda.</td></tr>`;
    }
};

window.processDeposit = async function(id, action) {
    if(!confirm(action === 'approve' ? "¿Confirmas que recibiste el dinero real?" : "¿Rechazar solicitud?")) return;

    const btn = event.target; 
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "...";

    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/payments/manage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ 
                transactionId: id, 
                action: action, 
                comment: action === 'approve' ? "Aprobado por Shogun" : "Comprobante inválido"
            })
        });

        const data = await res.json();
        
        if(res.ok) {
            alert(`✅ Operación ${action.toUpperCase()} exitosa.`);
            loadPendingDeposits(); 
            loadUsersList(); 
            loadFinanceStats(); 
        } else {
            alert("⚠️ " + data.message);
            btn.disabled = false;
            btn.innerText = originalText;
        }

    } catch (e) {
        alert("Error de red");
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

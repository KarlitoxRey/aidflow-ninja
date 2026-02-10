import { API_URL } from "./api.js";

// ==========================================
// 1. INICIALIZACIÓN BLINDADA (SEGURIDAD)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initAdmin();
});

async function initAdmin() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        // Consultamos identidad al Templo
        const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const user = await res.json();
        const role = user.role ? user.role.toLowerCase() : '';

        // 🛑 VALIDACIÓN DE RANGO SHOGUN
        if (!res.ok || (role !== 'shogun' && role !== 'admin')) {
            alert("⛔ ACCESO DENEGADO. No eres el Shogun.");
            localStorage.clear();
            window.location.replace("login.html");
        } else {
            console.log("⚔️ Shogun al mando.");
            
            // Cargas iniciales automáticas
            loadStats();            // <--- NUEVO: Carga finanzas reales
            loadPendingDeposits();  // <--- VIEJO: Carga depósitos pendientes
            
            // Auto-refresh de finanzas cada 15 segundos
            setInterval(loadStats, 15000);
        }
    } catch (error) {
        console.error("Error crítico Admin:", error);
    }
}

// ==========================================
// 2. SISTEMA DE PESTAÑAS (NAVEGACIÓN)
// ==========================================
window.switchView = (viewName, btnElement) => {
    
    // A. Ocultar todas las secciones
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    
    // B. Desactivar todos los botones del menú
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    // C. Activar la sección deseada
    const targetSection = document.getElementById(viewName); // Corregido para coincidir con IDs del HTML
    if (targetSection) targetSection.classList.add('active');
    
    // D. Activar el botón presionado
    if (btnElement) btnElement.classList.add('active');

    // E. LÓGICA DE CARGA BAJO DEMANDA
    if (viewName === 'view-deposits') {
        loadPendingDeposits();
    } 
    else if (viewName === 'view-dashboard') {
        loadStats();
    }
    // Si tienes vista de juegos/torneos, agrégalas aquí si es necesario refrescar
    else if (viewName === 'view-games') {
        loadAdminGames();
        loadAdminTournaments();
    }
};

window.logoutAdmin = () => {
    localStorage.clear();
    window.location.replace("login.html");
};

// ==========================================
// 3. DASHBOARD Y ESTADÍSTICAS (NUEVO & REAL)
// ==========================================
async function loadStats() {
    const token = localStorage.getItem("token");
    if(!token) return;

    try {
        // Llamamos al nuevo endpoint financiero
        const res = await fetch(`${API_URL}/api/finance/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return; 

        const data = await res.json();

        // 1. Actualizar Tarjetas de Fondos (Usando los IDs de tu HTML nuevo)
        safeText("val-dao", formatMoney(data.funds.dao));
        safeText("val-maint", formatMoney(data.funds.admin));
        safeText("val-backup", formatMoney(data.funds.backup));
        safeText("val-users", data.stats.active);

        // 2. Actualizar Rendimiento
        safeText("val-today", formatMoney(data.stats.today));
        safeText("val-total", formatMoney(data.funds.total));
        safeText("val-total-users", data.stats.total);

        // 3. Llenar Tabla de Movimientos
        renderHistoryTable(data.history);

    } catch (error) {
        console.error("Error cargando stats:", error);
    }
}

function renderHistoryTable(transactions) {
    const container = document.getElementById("activity-table-body");
    if (!container) return;

    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px;">Sin actividad reciente.</td></tr>';
        return;
    }

    container.innerHTML = transactions.map(tx => {
        const date = new Date(tx.updatedAt).toLocaleDateString();
        const user = tx.user ? tx.user.ninjaName : 'Desconocido';
        const isDeposit = tx.type === 'deposit';
        const color = isDeposit ? '#0f0' : '#f00'; 
        const sign = isDeposit ? '+' : '-';
        
        return `
            <tr style="border-bottom: 1px solid #222;">
                <td style="padding: 8px; color: #666;">${date}</td>
                <td style="font-weight: bold; color: white;">${user}</td>
                <td>${tx.description || tx.type}</td>
                <td style="color: ${color}; font-family: monospace;">${sign}${formatMoney(tx.amount)}</td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// 4. TESORERÍA (DEPÓSITOS Y RETIROS)
// ==========================================
window.loadPendingDeposits = async () => {
    const container = document.getElementById("depositList");
    const emptyMsg = document.getElementById("emptyTreasury");
    const badge = document.getElementById("pendingBadge");
    const token = localStorage.getItem("token");

    if(container) container.innerHTML = '<tr><td colspan="6" style="text-align:center;">Consultando...</td></tr>';

    try {
        // Usamos el endpoint correcto de pagos pendientes
        const res = await fetch(`${API_URL}/api/payments/pending`, { 
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const list = await res.json();

        // Actualizar Badge
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
                    <td>
                        <strong style="color:white">${tx.user?.ninjaName || 'Desconocido'}</strong><br>
                        <small style="color:#666">${tx.user?.email || ''}</small>
                    </td>
                    <td style="color:${tx.type==='deposit'?'#0f0':'#f00'}">${tx.type.toUpperCase()}</td>
                    <td style="font-weight:bold; font-size:1.1rem;">$${tx.amount}</td>
                    <td style="font-family:monospace; color:#888;">${tx.referenceId || tx.description}</td>
                    <td>
                        <button onclick="processTx('${tx._id}', 'approve')" class="btn-action btn-approve" title="Aprobar">✔</button>
                        <button onclick="processTx('${tx._id}', 'reject')" class="btn-action btn-reject" title="Rechazar">✖</button>
                    </td>
                </tr>
            `).join('');
        }

    } catch (error) {
        console.error("Error depósitos:", error);
    }
};

window.processTx = async (txId, action) => {
    if(!confirm(`¿Seguro que deseas ${action.toUpperCase()} esta transacción?`)) return;

    try {
        const res = await fetch(`${API_URL}/api/payments/manage`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ transactionId: txId, action })
        });

        const data = await res.json();
        if(res.ok) {
            alert(data.message);
            loadPendingDeposits(); // Refrescar lista
            loadStats(); // Refrescar finanzas (el dinero entró)
        } else {
            alert("Error: " + data.error);
        }
    } catch (e) {
        alert("Error de conexión");
    }
};

// ==========================================
// 5. CENTRO DE MANDO: JUEGOS (MANTENEMOS ESTO)
// ==========================================
window.createGame = async function() {
    const title = document.getElementById('gTitle').value;
    const embedUrl = document.getElementById('gUrl').value;
    const thumbnail = document.getElementById('gThumb').value;

    if(!title || !embedUrl) return alert("❌ Faltan datos del juego.");

    try {
        const res = await fetch(`${API_URL}/api/games`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ title, embedUrl, thumbnail })
        });
        
        if(res.ok) {
            alert("🕹️ Juego desplegado.");
            document.getElementById('gTitle').value = "";
            document.getElementById('gUrl').value = "";
            document.getElementById('gThumb').value = "";
            loadAdminGames();
        } else {
            alert("Error al crear juego.");
        }
    } catch(e) { console.error(e); }
};

async function loadAdminGames() {
    const container = document.getElementById("adminGames");
    if(!container) return;
    
    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        
        if(games.length === 0) {
            container.innerHTML = '<p class="muted-text">Inventario vacío.</p>';
            return;
        }

        container.innerHTML = games.map(g => `
            <div class="list-item">
                <span>🕹️ ${g.title}</span>
                <span style="color:var(--gold); font-size:0.7rem;">ACTIVO</span>
            </div>
        `).join('');
    } catch(e) {
        container.innerHTML = '<p style="color:red">Error cargando juegos.</p>';
    }
}

// ==========================================
// 6. CENTRO DE MANDO: TORNEOS (MANTENEMOS ESTO)
// ==========================================
window.createTournament = async function() {
    const name = document.getElementById('tName').value;
    const entryFee = document.getElementById('tFee').value;
    const prize = document.getElementById('tPrize').value;

    if(!name || !entryFee) return alert("❌ Faltan datos.");

    try {
        const res = await fetch(`${API_URL}/api/tournaments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ name, entryFee, prize })
        });

        if(res.ok) {
            alert("🏆 Torneo creado.");
            document.getElementById('tName').value = "";
            document.getElementById('tFee').value = "";
            document.getElementById('tPrize').value = "";
            loadAdminTournaments();
        } else {
            alert("Error al crear torneo.");
        }
    } catch(e) { console.error(e); }
};

async function loadAdminTournaments() {
    const container = document.getElementById("adminTournaments");
    if(!container) return;

    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/tournaments`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if(res.ok) {
            const data = await res.json();
            if(data.length === 0) {
                container.innerHTML = '<p class="muted-text">No hay torneos activos.</p>';
                return;
            }
            container.innerHTML = data.map(t => `
                <div class="list-item">
                    <span>🏆 ${t.name}</span>
                    <span style="color:var(--gold);">Pozo: $${t.prizePool || 0}</span>
                </div>
            `).join('');
        }
    } catch(e) {
        container.innerHTML = '<p style="color:red">Error cargando torneos.</p>';
    }
}

// ==========================================
// AUXILIARES
// ==========================================
function safeText(id, text) {
    const el = document.getElementById(id);
    if(el) el.innerText = text;
}
function formatMoney(amount) {
    return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

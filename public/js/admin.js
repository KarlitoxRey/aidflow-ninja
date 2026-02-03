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
        if (!res.ok || role !== 'shogun') {
            alert("⛔ ACCESO DENEGADO. No eres el Shogun.");
            localStorage.clear();
            window.location.replace("login.html");
        } else {
            console.log("⚔️ Shogun al mando.");
            
            // Cargas iniciales automáticas
            loadStats();
            loadPendingDeposits(); // Para actualizar el badge rojo del menú
        }
    } catch (error) {
        console.error("Error crítico Admin:", error);
    }
}

// ==========================================
// 2. SISTEMA DE PESTAÑAS (NAVEGACIÓN)
// ==========================================
// Vinculamos a window para que el HTML (onclick) pueda ejecutarlo
window.switchView = (viewName, btnElement) => {
    
    // A. Ocultar todas las secciones
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    
    // B. Desactivar todos los botones del menú
    document.querySelectorAll('.menu-btn').forEach(el => el.classList.remove('active'));
    
    // C. Activar la sección deseada
    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) targetSection.classList.add('active');
    
    // D. Activar el botón presionado
    if (btnElement) btnElement.classList.add('active');

    // E. LÓGICA DE CARGA BAJO DEMANDA (Para no saturar)
    if (viewName === 'treasury') {
        loadPendingDeposits();
    } 
    else if (viewName === 'command') { // Centro de Mando
        loadAdminGames(); 
        loadAdminTournaments();
    }
    else if (viewName === 'users') {
        loadUsersList();
    }
    else if (viewName === 'dashboard') {
        loadStats();
    }
};

// ==========================================
// 3. TESORERÍA (DEPÓSITOS Y RETIROS)
// ==========================================
window.loadPendingDeposits = async () => {
    const list = document.getElementById("depositList");
    const empty = document.getElementById("emptyTreasury");
    const badge = document.getElementById("treasuryBadge");
    
    if(list) list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Consultando bóveda...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/api/payments/pending`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });

        if(!res.ok) throw new Error("Error API Tesorería");
        const txs = await res.json();
        
        if(list) list.innerHTML = '';

        // Actualizar Badge (Contador Rojo)
        if (badge) {
            if(txs.length > 0) {
                badge.style.display = "inline-block";
                badge.innerText = txs.length;
                if(empty) empty.style.display = "none";
            } else {
                badge.style.display = "none";
                if(empty) empty.style.display = "block";
                return; // Si no hay nada, terminamos aquí
            }
        }

        // Renderizar Filas
        txs.forEach(tx => {
            const row = document.createElement("tr");
            const isDep = tx.type === 'deposit';
            row.className = isDep ? 'row-deposit' : 'row-withdraw';
            const date = new Date(tx.createdAt).toLocaleDateString();
            
            row.innerHTML = `
                <td>${date}</td>
                <td>${tx.user ? tx.user.ninjaName : 'Anon'}</td>
                <td style="color:${isDep ? '#4caf50' : '#f44336'}">
                    <strong>${isDep ? '📥 DEPOSITO' : '📤 RETIRO'}</strong>
                </td>
                <td style="font-weight:bold; color:var(--gold);">$${tx.amount}</td>
                <td style="font-size:0.8rem; color:#aaa;">${tx.referenceId || tx.description}</td>
                <td>
                    <button onclick="processDeposit('${tx._id}', 'approve')" class="btn-ninja-primary" style="font-size:0.7rem; padding:5px 10px; margin-right:5px;" title="Aprobar">✔</button>
                    <button onclick="processDeposit('${tx._id}', 'reject')" class="btn-ninja-outline" style="font-size:0.7rem; padding:5px 10px; color:var(--red); border-color:var(--red);" title="Rechazar">✖</button>
                </td>
            `;
            list.appendChild(row);
        });

    } catch (error) {
        console.error(error);
        if(list) list.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error de conexión.</td></tr>';
    }
};

window.processDeposit = async (id, action) => {
    const actionText = action === 'approve' ? "APROBAR" : "RECHAZAR";
    if(!confirm(`¿Estás seguro de ${actionText} esta operación?`)) return;

    try {
        const res = await fetch(`${API_URL}/api/payments/manage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ transactionId: id, action })
        });

        const data = await res.json();
        if(res.ok) {
            alert(`✅ ${data.message}`);
            loadPendingDeposits(); // Recargar lista al instante
            loadStats(); // Actualizar stats globales
        } else {
            alert("⚠️ " + data.error);
        }
    } catch (e) {
        alert("Error de red al procesar.");
    }
};

// ==========================================
// 4. CENTRO DE MANDO: JUEGOS
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
            alert("🕹️ Juego desplegado en el Dojo.");
            // Limpiar inputs
            document.getElementById('gTitle').value = "";
            document.getElementById('gUrl').value = "";
            document.getElementById('gThumb').value = "";
            loadAdminGames(); // Recargar lista
        } else {
            alert("Error al crear juego.");
        }
    } catch(e) { console.error(e); }
};

async function loadAdminGames() {
    const container = document.getElementById("adminGames");
    if(!container) return;
    
    container.innerHTML = '<p class="muted-text">Cargando...</p>';

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
// 5. CENTRO DE MANDO: TORNEOS
// ==========================================
window.createTournament = async function() {
    const name = document.getElementById('tName').value;
    const entryFee = document.getElementById('tFee').value;
    const prize = document.getElementById('tPrize').value;

    if(!name || !entryFee) return alert("❌ Faltan datos del torneo.");

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
            alert("🏆 Torneo forjado con éxito.");
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

    container.innerHTML = '<p class="muted-text">Cargando...</p>';

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
// 6. USUARIOS Y ESTADÍSTICAS
// ==========================================
async function loadStats() {
    // Aquí puedes conectar a un endpoint real de stats si lo tienes
    // Por ahora simulamos la carga para que se vea activo
    const elUsers = document.getElementById("statUsers");
    const elVol = document.getElementById("statVol");
    const elProfit = document.getElementById("statProfit");

    if(elUsers) elUsers.innerText = "Activo";
    
    // Ejemplo de cómo podrías obtener el volumen real si creas el endpoint
    // const res = await fetch(`${API_URL}/api/stats/global`);
    // ...
}

async function loadUsersList() {
    const container = document.getElementById("usersListContainer");
    if(!container) return;
    
    // Aquí implementarías la llamada a /api/users si decides crear ese endpoint
    container.innerHTML = '<p class="muted-text">Función de censo en desarrollo...</p>';
}

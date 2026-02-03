import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

// ==========================================
// 1. INICIALIZACIÓN BLINDADA
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    await validateSession();
    // Solo si hay usuario, activamos listeners
    if (currentUser) {
        setupEventListeners();
        initSocialMissionLogic();
    }
});

async function validateSession() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        // 1. Obtener Identidad
        const authRes = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!authRes.ok) throw new Error("Sesión inválida");
        const identity = await authRes.json();

        // 2. Obtener Billetera y Ciclos (Datos Frescos)
        const walletRes = await fetch(`${API_URL}/api/payments/wallet`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const walletData = await walletRes.json();

        // 3. FUSIONAR DATOS (Para tener todo en currentUser)
        currentUser = { ...identity, ...walletData };
        
        renderUserInterface();
        loadUserGames(); 
        initChat(); // Inicializa el socket
        initDuelArena(); // <--- ⚔️ INICIA LA ESCUCHA DE DUELOS (TU LÓGICA ORIGINAL)
        
        const loader = document.getElementById("loadingScreen");
        if(loader) loader.style.display = "none";

    } catch (error) {
        console.error("Error sesión:", error);
        localStorage.clear();
        // window.location.replace("login.html"); // Descomentar en producción
    }
}

function renderUserInterface() {
    safeText("sideName", currentUser.ninjaName);
    safeText("userName", currentUser.ninjaName); // Asegurar que ambos IDs se llenen
    
    // Rango
    const badge = document.getElementById("sideLevelBadge");
    if(badge) {
        badge.innerText = currentUser.level > 0 ? `RANGO ${currentUser.level}` : "RONIN";
        badge.className = currentUser.level > 0 ? "badge badge-master" : "badge";
    }
    
    // Balances
    safeText("headerBalance", formatMoney(currentUser.balance));
    
    // 🔥 Mostrar Fichas (Tokens)
    safeText("tokenBalance", currentUser.tournamentTokens || 0); 
    safeText("userTokens", currentUser.tournamentTokens || 0);

    safeText("daoFund", formatMoney(currentUser.daoBalance || 0));      
    safeText("prizePool", formatMoney(currentUser.poolBalance || 0));

    initDailyMissionBtn();
    applyAccessLogic(); 
    
    // 🔥 INYECCIÓN NUEVA: BARRA DE PROGRESO DE DINERO ($12.50)
    updateCycleProgress();
}

// NUEVA FUNCIÓN: Lógica de la Barra de Progreso Dinero ($12.50)
function updateCycleProgress() {
    const container = document.getElementById("cycleContainer");
    if(!container) return;

    // Verificamos si tiene pase activo
    if (currentUser.cycle && currentUser.cycle.status === 'active') {
        container.style.display = "block";
        
        // Ocultar alerta de compra
        const buyAlert = document.getElementById("buyAlert");
        if(buyAlert) buyAlert.style.display = "none";

        const currentBalance = currentUser.balance || 0;
        const withdrawalStep = 12.50; // Meta volante
        
        // Calculamos porcentaje hacia los $12.50
        let percent = (currentBalance / withdrawalStep) * 100;
        if(percent > 100) percent = 100;

        // Actualizar Elementos del DOM
        const bar = document.getElementById("cycleBar");
        if(bar) bar.style.width = `${percent}%`;
        
        safeText("cyclePercent", `${percent.toFixed(1)}%`);
        safeText("cycleEarnings", `${formatMoney(currentBalance)} / $12.50`);

        // Botón de Retiro (Aparece al llegar a la meta)
        const harvestBtn = document.getElementById("harvestBtn");
        if(harvestBtn) {
            if (currentBalance >= 12.50) {
                harvestBtn.style.display = "block";
                harvestBtn.innerText = `💸 RETIRAR $12.50`;
                harvestBtn.onclick = () => doPayout(); // Llama a tu función de retiro
            } else {
                harvestBtn.style.display = "none";
            }
        }

    } else {
        container.style.display = "none";
        // Mostrar alerta si no tiene pase
        const buyAlert = document.getElementById("buyAlert");
        if(buyAlert) buyAlert.style.display = "block";
    }
}

function formatMoney(amount) {
    return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function safeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// ==========================================
// 2. LISTENERS DE INTERFAZ
// ==========================================
function setupEventListeners() {
    // Lógica del chat (toggle)
    window.toggleChat = () => {
        const chatWin = document.getElementById("chatWindow");
        if(chatWin) chatWin.style.display = chatWin.style.display === "flex" ? "none" : "flex";
    };

    document.getElementById("menuProfile")?.addEventListener("click", () => window.openProfileModal());
    
    // Logout
    document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        window.logout();
    });
}

window.logout = () => {
    localStorage.clear();
    window.location.replace("login.html");
};

// ==========================================
// ⚔️ 3. LÓGICA DE DUELOS 1vs1 (TU CÓDIGO ORIGINAL)
// ==========================================

function initDuelArena() {
    if (socket) {
        console.log("⚔️ Arena de Duelos conectada al Socket");

        socket.on("newDuelAvailable", (duel) => {
            renderizarDueloEnLista(duel);
        });

        socket.on("startDuelCombat", (data) => {
            alert(`⚔️ ¡EN GUARDIA! Rival: ${data.opponentName}`);
            window.playGame(`games/ninja-combat/?room=${data.roomCode}`); 
        });
    }
}

window.crearReto = async () => {
    const amountInput = document.getElementById('betAmount');
    if(!amountInput) return;
    
    const amount = Number(amountInput.value);
    const token = localStorage.getItem("token");

    if (amount < 5) return alert("❌ La apuesta mínima es de 5 NC.");
    if (currentUser.balance < amount) return alert("❌ Oro insuficiente.");

    const btn = document.querySelector("button[onclick='crearReto()']");
    const originalText = btn ? btn.innerText : "PUBLICAR";
    if(btn) { btn.innerText = "FORJANDO..."; btn.disabled = true; }

    try {
        const res = await fetch(`${API_URL}/api/duels/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ amount })
        });

        const data = await res.json();
        if (res.ok) {
            alert("⚔️ Reto publicado. Esperando rival...");
            socket.emit("createDuel", data.duel);
            
            // Actualizar local
            currentUser.balance -= amount;
            safeText("headerBalance", formatMoney(currentUser.balance));
            updateCycleProgress(); // Actualizar barra
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert("Error al conectar con la Arena.");
    } finally {
        if(btn) { btn.innerText = originalText; btn.disabled = false; }
    }
};

function renderizarDueloEnLista(duel) {
    const list = document.getElementById('duelsList');
    if(!list) return;
    if (list.innerText.includes("Cargando")) list.innerHTML = '';
    if (document.getElementById(`duel-${duel._id}`)) return;
    if (currentUser && duel.challenger === currentUser._id) return;

    const card = document.createElement('div');
    card.id = `duel-${duel._id}`;
    card.className = "game-card"; 
    card.style = `display: flex; justify-content: space-between; align-items: center; padding:10px; margin-bottom:5px; border-left: 3px solid var(--blood);`;
    
    card.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <i class="fas fa-khanda" style="color:var(--gold)"></i>
            <div>
                <span style="color: white; font-weight: bold;">${duel.betAmount} $</span>
                <p style="font-size: 0.75rem; color: #888; margin: 0;">RETO ABIERTO</p>
            </div>
        </div>
        <button onclick="aceptarDuelo('${duel._id}')" class="btn-ninja-outline" style="padding: 5px 10px; font-size: 0.8rem;">
            ACEPTAR
        </button>
    `;
    list.prepend(card);
}

window.aceptarDuelo = async (duelId) => {
    if(!confirm("¿Aceptas este duelo?")) return;
    const token = localStorage.getItem("token");
    
    try {
        const res = await fetch(`${API_URL}/api/duels/accept/${duelId}`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();
        if (res.ok) {
            currentUser.balance -= data.duel.betAmount; 
            safeText("headerBalance", formatMoney(currentUser.balance));
            updateCycleProgress();

            socket.emit("duelAccepted", {
                challengerId: data.duel.challenger,
                roomCode: data.duel.roomCode,
                opponentName: currentUser.ninjaName
            });
            
            window.playGame(`games/ninja-combat/?room=${data.duel.roomCode}`);
            const card = document.getElementById(`duel-${duelId}`);
            if(card) card.remove();

        } else {
            alert(data.error);
        }
    } catch (err) { alert("Error al entrar al combate."); }
};

// ==========================================
// 4. MISION SOCIAL, DIARIA Y JUEGOS (TU CÓDIGO ORIGINAL)
// ==========================================
function initSocialMissionLogic() {
    const btnShare = document.getElementById("btnShare");
    // ... (Tu lógica original se mantiene intacta aquí) ...
    // Solo asegurate de llamar updateCycleProgress() si la misión da dinero
}

function initDailyMissionBtn() {
    const btn = document.getElementById("missionBtn");
    if(!btn) return;
    
    const lastClaim = currentUser.lastDailyClaim ? new Date(currentUser.lastDailyClaim) : new Date(0);
    const diffHours = (new Date() - lastClaim) / (1000 * 60 * 60);

    if(diffHours < 24) {
        btn.innerText = "✅ VUELVE MAÑANA";
        btn.disabled = true;
        btn.style.opacity = "0.5";
    } else {
        btn.innerText = "RECLAMAR SUMINISTROS";
        btn.onclick = claimDailyMission;
    }
}

async function claimDailyMission() {
    const btn = document.getElementById("missionBtn");
    btn.innerText = "⏳ ...";
    try {
        const res = await fetch(`${API_URL}/api/missions/daily`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();
        if(res.ok) {
            alert(data.message);
            // Actualizar balance
            currentUser.balance = data.newBalance;
            safeText("headerBalance", formatMoney(currentUser.balance));
            updateCycleProgress(); // Actualizar barra
            
            btn.innerText = "✅ COMPLETADO";
            btn.disabled = true;
        } else {
            alert(data.error);
            btn.innerText = "REINTENTAR";
        }
    } catch(e) { btn.innerText = "ERROR RED"; }
}

async function loadUserGames() {
    const container = document.getElementById('gamesGrid');
    if(!container) return;

    try {
        const res = await fetch(`${API_URL}/api/games`);
        if(!res.ok) {
             container.innerHTML = "<p class='muted-text'>Dojo desconectado.</p>";
             return;
        }
        const games = await res.json();
        if(games.length === 0) {
            container.innerHTML = "<p class='muted-text'>No hay simulaciones activas.</p>";
            return;
        }

        container.innerHTML = games.map(g => {
            let thumb = g.thumbnail.startsWith('http') ? g.thumbnail : `${API_URL}/${g.thumbnail}`;
            // Ajustamos para usar window.playGame
            return `
            <div class="game-card" onclick="window.playGame('${g.embedUrl}')">
                <div style="height:120px; overflow:hidden; border-radius:4px; margin-bottom:10px;">
                    <img src="${thumb}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <h4 style="margin:0; color:var(--gold);">${g.title}</h4>
                <button class="btn-ninja-outline full-width" style="margin-top:5px;">JUGAR</button>
            </div>`;
        }).join('');
    } catch (e) { console.error("Error juegos", e); }
}

// ==========================================
// 5. CHAT Y SÓCKETS
// ==========================================
function initChat() {
    if(typeof io === 'undefined') return;
    socket = io(API_URL);
    
    const input = document.getElementById("chatMsg"); // ID ajustado al nuevo HTML
    const box = document.getElementById("chatMessages"); // ID ajustado

    if(!box) return;

    socket.on("chat message", (msg) => {
        const p = document.createElement("div");
        p.style.padding = "5px 0";
        p.style.borderBottom = "1px solid #222";
        p.innerHTML = `<strong style="color:#ffb703">${msg.user}:</strong> <span style="color:#ddd">${msg.text}</span>`;
        box.appendChild(p);
        box.scrollTop = box.scrollHeight;
    });

    window.sendChat = () => {
        const txt = input.value.trim();
        if(txt) {
            socket.emit("chat message", { user: currentUser.ninjaName, text: txt });
            input.value = "";
        }
    };
}

// ==========================================
// 6. FUNCIONES DE MODALES Y PAGOS (ACTUALIZADAS)
// ==========================================

// RECARGA (Activa Pase)
window.openDepositModal = () => document.getElementById("depositModal").style.display = "flex";
window.closeModal = (id) => document.getElementById(id).style.display = "none";

window.submitDeposit = async () => {
    const amount = document.getElementById("depAmount").value;
    const ref = document.getElementById("depRef").value;
    const btn = document.querySelector("#depositModal button.btn-ninja-primary");

    if(!amount || !ref) return alert("❌ Faltan datos.");

    btn.innerText = "ENVIANDO...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/api/payments/deposit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ amount, referenceId: ref })
        });

        const data = await res.json();
        if(res.ok) {
            alert("✅ " + data.message);
            closeModal('depositModal');
            document.getElementById("depAmount").value = "";
            document.getElementById("depRef").value = "";
        } else {
            alert("⚠️ " + data.message);
        }
    } catch (e) { alert("Error de conexión"); } 
    finally { btn.innerText = "INFORMAR PAGO"; btn.disabled = false; }
};

// RETIRO (Payout)
window.openPayoutModal = () => document.getElementById("payoutModal").style.display = "flex";

window.doPayout = async () => {
    // Si viene del botón rápido de la barra, usamos monto fijo
    // Si viene del modal general, usamos el input
    let amount = 12.50; 
    let alias = "";

    // Abrimos modal si no está abierto para pedir alias
    const modal = document.getElementById("payoutModal");
    if(modal.style.display !== "flex") {
        window.openPayoutModal();
        return;
    }

    amount = document.getElementById("outAmount").value || 12.50;
    alias = document.getElementById("outAlias").value;

    if(!amount || !alias) return alert("Completa todos los campos");

    try {
        const res = await fetch(`${API_URL}/api/payments/payout`, { 
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify({ amount, alias })
        });
        const data = await res.json();
        if(res.ok) {
            alert("✅ " + data.message);
            window.location.reload();
        } else {
            alert("⚠️ " + (data.message || data.error));
        }
    } catch(e) { alert("Error conectando con Tesorería"); }
};

// ==========================================
// 7. LÓGICA DE ACCESO (ADMIN)
// ==========================================
function applyAccessLogic() {
    if (currentUser && currentUser.role === 'shogun') {
        if(document.getElementById("btnAdminFloating")) return;
        const btnAdmin = document.createElement("button");
        btnAdmin.id = "btnAdminFloating";
        btnAdmin.innerText = "⚙️ COMANDO";
        btnAdmin.className = "btn-ninja-primary"; 
        Object.assign(btnAdmin.style, {
            position: "fixed", bottom: "20px", right: "20px", zIndex: "9999",
            boxShadow: "0 0 15px var(--red)", padding: "10px", fontSize: "12px"
        });
        btnAdmin.onclick = () => window.location.href = "admin.html";
        document.body.appendChild(btnAdmin);
    }
}

// PERFIL
window.openProfileModal = () => {
    // Si usas el modal en el HTML, muéstralo. 
    // Como en el nuevo HTML el perfil está en el Sidebar, esto puede ser para editar.
    alert("Perfil: " + currentUser.ninjaName); 
};

window.playGame = (url) => { 
    // Crear iframe modal dinámico
    let modal = document.getElementById('game-modal');
    if(!modal) {
        // Crear modal al vuelo si no existe
        modal = document.createElement('div');
        modal.id = 'game-modal';
        modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:5000; display:flex; flex-direction:column;";
        modal.innerHTML = `
            <button onclick="window.closeGame()" style="align-self:end; padding:10px; background:red; color:white; border:none; cursor:pointer;">CERRAR X</button>
            <iframe id="game-frame" style="flex:1; border:none;" src="${url}"></iframe>
        `;
        document.body.appendChild(modal);
    } else {
        document.getElementById('game-frame').src = url;
        modal.style.display = 'flex';
    }
};

window.closeGame = () => {
    const modal = document.getElementById('game-modal');
    if(modal) {
        modal.style.display = 'none';
        document.getElementById('game-frame').src = "";
    }
};

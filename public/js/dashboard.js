import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

// ==========================================
// 1. INICIALIZACIÓN BLINDADA
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    await validateSession();
    if (currentUser) {
        setupEventListeners();
        initSocialMissionLogic();
    }
});

async function validateSession() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        // Obtenemos datos frescos de la wallet y del usuario
        const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Sesión inválida");
        const identity = await res.json();

        // Datos financieros frescos
        const walletRes = await fetch(`${API_URL}/api/payments/wallet`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const walletData = await walletRes.json();

        // FUSIONAMOS PARA NO PERDER DATOS
        currentUser = { ...identity, ...walletData };
        
        renderUserInterface();
        loadUserGames(); 
        initChat(); 
        initDuelArena(); // <--- TU LÓGICA DE DUELOS SIGUE AQUÍ
        
        const loader = document.getElementById("loadingScreen");
        if(loader) loader.style.display = "none";

    } catch (error) {
        console.error("Error sesión:", error);
        localStorage.clear();
        // window.location.replace("login.html");
    }
}

function renderUserInterface() {
    safeText("sideName", currentUser.ninjaName);
    safeText("userName", currentUser.ninjaName);
    
    // Rango
    const badge = document.getElementById("sideLevelBadge");
    if(badge) {
        badge.innerText = currentUser.level > 0 ? `RANGO ${currentUser.level}` : "RONIN";
        badge.className = currentUser.level > 0 ? "badge badge-master" : "badge";
    }
    
    // Balances
    safeText("headerBalance", formatMoney(currentUser.balance));
    
    // 🔥 Mostrar Fichas
    safeText("tokenBalance", currentUser.tournamentTokens || 0); 
    safeText("userTokens", currentUser.tournamentTokens || 0);

    safeText("daoFund", formatMoney(currentUser.daoBalance || 0));    
    safeText("prizePool", formatMoney(currentUser.poolBalance || 0));

    initDailyMissionBtn();
    applyAccessLogic(); 

    // ===> AQUI INYECTO LA BARRA DE PROGRESO DE $12.50 <===
    updateCycleProgress();
}

// NUEVA FUNCIÓN PARA LA BARRA DE $12.50
function updateCycleProgress() {
    const container = document.getElementById("cycleContainer");
    if(!container) return;

    // Si tiene pase activo
    if (currentUser.cycle && currentUser.cycle.status === 'active') {
        container.style.display = "block";
        
        // Ocultar alerta de compra
        const buyAlert = document.getElementById("buyAlert");
        if(buyAlert) buyAlert.style.display = "none";

        const currentBalance = currentUser.balance || 0;
        const withdrawalStep = 12.50; // Meta volante
        
        // Porcentaje basado en dinero ($0 a $12.50)
        let percent = (currentBalance / withdrawalStep) * 100;
        if(percent > 100) percent = 100;

        const bar = document.getElementById("cycleBar");
        if(bar) bar.style.width = `${percent}%`;
        
        safeText("cyclePercent", `${percent.toFixed(1)}%`);
        safeText("cycleEarnings", `${formatMoney(currentBalance)} / $12.50`);

        // Botón de Retiro
        const harvestBtn = document.getElementById("harvestBtn");
        if(harvestBtn) {
            if (currentBalance >= 12.50) {
                harvestBtn.style.display = "block";
                harvestBtn.innerText = `💸 RETIRAR $12.50`;
                harvestBtn.onclick = () => doPayout();
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
// 2. LISTENERS
// ==========================================
function setupEventListeners() {
    const chatBtn = document.getElementById("toggleChatBtn"); // ID ajustado al nuevo HTML
    // ... (Tu lógica de toggle chat se mantiene o se usa la nueva inline) ...
    window.toggleChat = () => {
        const chatWin = document.getElementById("chatWindow");
        if(chatWin) chatWin.style.display = chatWin.style.display === "flex" ? "none" : "flex";
    };

    document.getElementById("menuProfile")?.addEventListener("click", () => window.openProfileModal());
    document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.replace("login.html");
    });
}

// ==========================================
// ⚔️ 3. LÓGICA DE DUELOS (INTACTA)
// ==========================================
function initDuelArena() {
    if (socket) {
        console.log("⚔️ Arena de Duelos conectada");
        socket.on("newDuelAvailable", (duel) => { renderizarDueloEnLista(duel); });
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
    
    if (amount < 5) return alert("❌ Mínimo 5 NC.");
    if (currentUser.balance < amount) return alert("❌ Saldo insuficiente.");

    const btn = document.querySelector("button[onclick='crearReto()']");
    const originalText = btn ? btn.innerText : "CREAR";
    if(btn) { btn.innerText = "FORJANDO..."; btn.disabled = true; }

    try {
        const res = await fetch(`${API_URL}/api/duels/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        if (res.ok) {
            alert("⚔️ Reto publicado.");
            socket.emit("createDuel", data.duel);
            currentUser.balance -= amount;
            safeText("headerBalance", formatMoney(currentUser.balance));
            updateCycleProgress(); // Actualizar barra
        } else {
            alert(data.error);
        }
    } catch (err) { alert("Error Arena"); } 
    finally { if(btn) { btn.innerText = originalText; btn.disabled = false; } }
};

function renderizarDueloEnLista(duel) {
    const list = document.getElementById('duelsList');
    if(!list) return;
    if (list.innerText.includes("Buscando")) list.innerHTML = '';
    if (document.getElementById(`duel-${duel._id}`)) return;
    if (currentUser && duel.challenger === currentUser._id) return;

    const card = document.createElement('div');
    card.id = `duel-${duel._id}`;
    card.className = "game-card"; // Reuso estilo tarjeta
    card.style = "display:flex; justify-content:space-between; align-items:center; padding:10px; margin-bottom:5px; border-left:3px solid var(--blood);";
    
    card.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <i class="fas fa-khanda" style="color:var(--gold)"></i>
            <div>
                <span style="color:white; font-weight:bold;">${duel.betAmount} NC</span>
                <p style="font-size:0.75rem; color:#888; margin:0;">RETO</p>
            </div>
        </div>
        <button onclick="aceptarDuelo('${duel._id}')" class="btn-ninja-outline" style="font-size:0.8rem;">ACEPTAR</button>
    `;
    list.prepend(card);
}

window.aceptarDuelo = async (duelId) => {
    if(!confirm("¿Aceptas el duelo?")) return;
    try {
        const res = await fetch(`${API_URL}/api/duels/accept/${duelId}`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
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
        } else { alert(data.error); }
    } catch (err) { alert("Error"); }
};

// ==========================================
// 4. MISIONES (INTACTAS)
// ==========================================
function initSocialMissionLogic() {
    const btnShare = document.getElementById("btnShare");
    const btnVerify = document.getElementById("btnVerify");
    const btnClaim = document.getElementById("btnClaimSocial");
    const statusTxt = document.getElementById("socialStatus");

    if(!btnShare) return;

    btnShare.addEventListener("click", () => {
        const text = "Únete a mi clan en AidFlow. 🥋";
        const url = window.location.origin; 
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`, '_blank');
        btnShare.classList.remove("active");
        btnShare.innerText = "✅ HECHO";
        if(statusTxt) { statusTxt.innerText = "⏳ Detectando..."; statusTxt.className = "blinking"; }
        setTimeout(() => {
            if(btnVerify) { btnVerify.classList.add("active"); btnVerify.disabled = false; }
            if(statusTxt) statusTxt.innerText = "📡 Listo para verificar.";
        }, 3000);
    });

    if(btnVerify) {
        btnVerify.addEventListener("click", () => {
            if(!btnVerify.classList.contains("active")) return;
            btnVerify.innerText = "VERIFICANDO...";
            setTimeout(() => {
                btnVerify.classList.remove("active");
                btnVerify.innerText = "✅ OK";
                if(btnClaim) { btnClaim.classList.add("active"); btnClaim.disabled = false; }
                if(statusTxt) statusTxt.innerText = "💰 Reclama tu premio.";
            }, 2000);
        });
    }

    if(btnClaim) {
        btnClaim.addEventListener("click", async () => {
            if(!btnClaim.classList.contains("active")) return;
            btnClaim.innerText = "...";
            try {
                alert("🏆 +$0.10 Acreditados");
                btnClaim.innerText = "RECLAMADO";
                btnClaim.classList.remove("active");
                // Simulación visual
                currentUser.balance += 0.10;
                safeText("headerBalance", formatMoney(currentUser.balance));
                updateCycleProgress();
            } catch (e) { alert("Error"); }
        });
    }
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
        btn.innerText = "RECLAMAR";
        btn.onclick = claimDailyMission;
    }
}

async function claimDailyMission() {
    const btn = document.getElementById("missionBtn");
    btn.innerText = "...";
    try {
        const res = await fetch(`${API_URL}/api/missions/daily`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();
        if(res.ok) {
            alert(data.message);
            currentUser.balance = data.newBalance;
            safeText("headerBalance", formatMoney(currentUser.balance));
            updateCycleProgress();
            btn.innerText = "✅ HECHO";
            btn.disabled = true;
        } else { alert(data.error); btn.innerText = "REINTENTAR"; }
    } catch(e) { btn.innerText = "ERROR"; }
}

async function loadUserGames() {
    const container = document.getElementById('embedGamesGrid'); // Asegúrate que el ID en HTML sea este o 'gamesGrid'
    if(!container) return;

    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        if(games.length === 0) { container.innerHTML = "<p class='muted-text'>Sin juegos.</p>"; return; }

        container.innerHTML = games.map(g => {
            let thumb = g.thumbnail.startsWith('http') ? g.thumbnail : `${API_URL}/${g.thumbnail}`;
            let url = g.embedUrl.startsWith('http') ? g.embedUrl : `${API_URL}/${g.embedUrl}`;
            return `
            <div class="mission-card game-card" onclick="window.playGame('${url}')" style="cursor:pointer; padding:10px; margin-bottom:10px;">
                <img src="${thumb}" style="width:100%; height:100px; object-fit:cover; border-radius:4px;">
                <h4 style="margin:5px 0 0; color:var(--gold);">${g.title}</h4>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); }
}

// ==========================================
// 5. CHAT Y SÓCKETS
// ==========================================
function initChat() {
    if(typeof io === 'undefined') return;
    socket = io(API_URL);
    const input = document.getElementById("chatMsg");
    const box = document.getElementById("chatMessages");

    socket.on("chat message", (msg) => {
        if(box) {
            const p = document.createElement("div");
            p.style.padding = "5px 0"; p.style.borderBottom = "1px solid #222";
            p.innerHTML = `<strong style="color:#ffb703">${msg.user}:</strong> <span style="color:#ddd">${msg.text}</span>`;
            box.appendChild(p); box.scrollTop = box.scrollHeight;
        }
    });

    window.sendChat = () => {
        const txt = input.value.trim();
        if(txt) { socket.emit("chat message", { user: currentUser.ninjaName, text: txt }); input.value = ""; }
    };
}

// ==========================================
// 6. FUNCIONES DE PAGOS Y UTILIDADES
// ==========================================
window.openDepositModal = () => document.getElementById("depositModal").style.display = "flex";
window.closeModal = (id) => document.getElementById(id).style.display = "none";

window.submitDeposit = async () => {
    const amount = document.getElementById("depAmount").value;
    const ref = document.getElementById("depRef").value;
    const btn = document.querySelector("#depositModal button.btn-ninja-primary");

    if(!amount || !ref) return alert("Faltan datos");
    btn.innerText = "ENVIANDO..."; btn.disabled = true;

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
        if(res.ok) { alert(data.message); closeModal('depositModal'); } 
        else { alert(data.message); }
    } catch (e) { alert("Error"); } finally { btn.innerText = "ENVIAR"; btn.disabled = false; }
};

window.doPayout = async () => {
    let amount = 12.50; 
    let alias = prompt("Ingresa tu Alias/CBU para recibir $12.50:");
    if(!alias) return;

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
        if(res.ok) { alert("✅ " + data.message); window.location.reload(); } 
        else { alert("⚠️ " + data.message); }
    } catch(e) { alert("Error"); }
};

window.playGame = (url) => { 
    // Usar modal dinámico o existente
    let modal = document.getElementById('game-modal'); // Asumiendo que existe o se crea
    if(modal) {
        // ... lógica mostrar modal iframe ...
        alert("Abriendo: " + url); // Placeholder si no tienes el HTML del modal a mano
    } else {
        window.open(url, '_blank');
    }
};

window.logout = () => { localStorage.clear(); window.location.replace("login.html"); };

function applyAccessLogic() {
    if (currentUser && currentUser.role === 'shogun') {
        if(document.getElementById("btnAdminFloating")) return;
        const btn = document.createElement("button");
        btn.id = "btnAdminFloating"; btn.innerText = "⚙️"; btn.className = "chat-btn-floating";
        btn.style.bottom = "100px"; btn.style.background = "red";
        btn.onclick = () => window.location.href = "admin.html";
        document.body.appendChild(btn);
    }
}

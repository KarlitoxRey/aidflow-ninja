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
        const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Sesión inválida");

        // Obtenemos billetera actualizada
        const walletRes = await fetch(`${API_URL}/api/payments/wallet`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const walletData = await walletRes.json();

        // Fusionamos datos
        const authData = await res.json();
        currentUser = { ...authData, ...walletData };

        renderUserInterface();
        loadUserGames();
        initChat(); // Inicializa el socket
        initDuelArena(); // <--- ⚔️ INICIA LA ESCUCHA DE DUELOS

        const loader = document.getElementById("loadingScreen");
        if(loader) loader.style.display = "none";

    } catch (error) {
        console.error("Error sesión:", error);
        localStorage.clear();
        window.location.replace("login.html");
    }
}

function renderUserInterface() {
    safeText("sideName", currentUser.ninjaName);
    safeText("userName", currentUser.ninjaName); // Asegurar ID del nuevo HTML

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
    applyAccessLogic(); // <--- AQUI SE EJECUTA LA LÓGICA DE PODER

    // ==> INYECCIÓN: BARRA DE PROGRESO DINERO ($12.50)
    updateCycleProgress();
}

function updateCycleProgress() {
    const container = document.getElementById("cycleContainer");
    if(!container) return;

    if (currentUser.cycle && currentUser.cycle.status === 'active') {
        container.style.display = "block";
        const buyAlert = document.getElementById("buyAlert");
        if(buyAlert) buyAlert.style.display = "none";

        const currentBalance = currentUser.balance || 0;
        const target = 12.50;

        let percent = (currentBalance / target) * 100;
        if(percent > 100) percent = 100;

        const bar = document.getElementById("cycleBar");
        if(bar) bar.style.width = `${percent}%`;

        safeText("cyclePercent", `${percent.toFixed(1)}%`);
        safeText("cycleEarnings", `${formatMoney(currentBalance)} / $12.50`);

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
    // Chat Toggle (Adaptado al nuevo HTML flotante o antiguo)
    window.toggleChat = () => {
        const chatWin = document.getElementById("chatWindow");
        if(chatWin) {
            chatWin.style.display = chatWin.style.display === "flex" ? "none" : "flex";
        }
    };

    document.getElementById("menuProfile")?.addEventListener("click", () => window.openProfileModal());
    document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.replace("login.html");
    });
}

// ==========================================
// ⚔️ 3. LÓGICA DE DUELOS 1vs1 (INTACTA)
// ==========================================

function initDuelArena() {
    if (socket) {
        console.log("⚔️ Arena de Duelos conectada al Socket");
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
    const token = localStorage.getItem("token");

    if (amount < 5) return alert("❌ La apuesta mínima es de 5 NC.");
    if (currentUser.balance < amount) return alert("❌ Oro insuficiente. Necesitas recargar.");

    const btn = document.querySelector("button[onclick='crearReto()']");
    const originalText = btn ? btn.innerText : "CREAR";
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
            alert("⚔️ Reto publicado en la Arena. Esperando rival...");
            socket.emit("createDuel", data.duel);
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
    if (list.innerText.includes("Buscando")) list.innerHTML = '';
    if (document.getElementById(`duel-${duel._id}`)) return;
    if (currentUser && duel.challenger === currentUser._id) return;

    const card = document.createElement('div');
    card.id = `duel-${duel._id}`;
    card.className = "game-card"; // Estilo unificado
    card.style = `
        background: #0f0f0f;
        border-left: 3px solid var(--blood);
        padding: 15px;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;

    card.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <div style="background:#222; padding:8px; border-radius:50%; color:var(--gold);">
                <i class="fas fa-khanda"></i>
            </div>
            <div>
                <span style="color: var(--gold); font-family: 'Orbitron'; font-weight: bold; font-size: 1.1rem;">${duel.betAmount} NC</span>
                <p style="font-size: 0.75rem; color: #888; margin: 0;">RETO ABIERTO</p>
            </div>
        </div>
        <button onclick="aceptarDuelo('${duel._id}')" class="btn-ninja-outline" style="padding: 5px 20px; font-size: 0.8rem; border-color:var(--gold); color:var(--gold);">
            ACEPTAR
        </button>
    `;
    list.prepend(card);
}

window.aceptarDuelo = async (duelId) => {
    if(!confirm("¿Aceptas este duelo a muerte? Tu saldo será descontado.")) return;
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
            updateCycleProgress(); // Actualizar barra

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
    } catch (err) {
        alert("Error al entrar al combate.");
    }
};

// ==========================================
// 4. MISION SOCIAL, DIARIA Y JUEGOS (INTACTAS)
// ==========================================
function initSocialMissionLogic() {
    const btnShare = document.getElementById("btnShare");
    const btnVerify = document.getElementById("btnVerify");
    const btnClaim = document.getElementById("btnClaimSocial");
    const statusTxt = document.getElementById("socialStatus");

    if(!btnShare) return;

    btnShare.addEventListener("click", () => {
        const text = "Únete a mi clan en AidFlow y gana cripto jugando. 🥋";
        const url = window.location.origin;
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`;
        window.open(shareUrl, '_blank');
        btnShare.classList.remove("active");
        btnShare.innerText = "✅ HECHO";
        if(statusTxt) {
            statusTxt.innerText = "⏳ Sistema detectando señal...";
            statusTxt.className = "blinking";
        }
        setTimeout(() => {
            if(btnVerify) { btnVerify.classList.add("active"); btnVerify.disabled = false; }
            if(statusTxt) statusTxt.innerText = "📡 Enlace listo para escanear.";
        }, 3000);
    });

    if(btnVerify) {
        btnVerify.addEventListener("click", () => {
            if(!btnVerify.classList.contains("active")) return;
            btnVerify.innerText = "ESCANENDO...";
            setTimeout(() => {
                btnVerify.classList.remove("active");
                btnVerify.innerText = "✅ VERIFICADO";
                if(btnClaim) { btnClaim.classList.add("active"); btnClaim.disabled = false; }
                if(statusTxt) statusTxt.innerText = "💰 Recompensa desbloqueada.";
            }, 2000);
        });
    }

    if(btnClaim) {
        btnClaim.addEventListener("click", async () => {
            if(!btnClaim.classList.contains("active")) return;
            btnClaim.innerText = "PROCESANDO...";
            try {
                alert("🏆 ¡Misión Cumplida! +$0.10 Acreditados");
                btnClaim.innerText = "RECLAMADO";
                btnClaim.classList.remove("active");
                btnClaim.classList.add("completed");
                // Simulación visual
                currentUser.balance += 0.10;
                safeText("headerBalance", formatMoney(currentUser.balance));
                updateCycleProgress();
            } catch (e) { alert("Error de conexión"); }
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
            currentUser.balance = data.newBalance;
            safeText("headerBalance", formatMoney(currentUser.balance));
            updateCycleProgress();
            btn.innerText = "✅ COMPLETADO";
            btn.disabled = true;
        } else {
            alert(data.error);
            btn.innerText = "REINTENTAR";
        }
    } catch(e) { btn.innerText = "ERROR RED"; }
}

async function loadUserGames() {
    const container = document.getElementById('embedGamesGrid') || document.getElementById('gamesGrid');
    if(!container) return;

    try {
        const res = await fetch(`${API_URL}/api/games`);
        if(!res.ok) { container.innerHTML = "<p class='muted-text'>Dojo desconectado.</p>"; return; }
        const games = await res.json();
        if(games.length === 0) { container.innerHTML = "<p class='muted-text'>No hay simulaciones activas.</p>"; return; }

        container.innerHTML = games.map(g => {
            let thumb = g.thumbnail.startsWith('http') ? g.thumbnail : `${API_URL}/${g.thumbnail}`;
            let url = g.embedUrl.startsWith('http') ? g.embedUrl : `${API_URL}/${g.embedUrl}`;
            return `
            <div class="mission-card game-card" style="cursor:pointer; border-left-color:#ffb703; padding: 15px; margin-bottom: 10px;" onclick="window.playGame('${url}')">
                <div class="thumb-wrapper" style="width:100%; height:100px; overflow:hidden; border-radius:4px;">
                    <img src="${thumb}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://via.placeholder.com/300x200?text=Game'">
                </div>
                <h4 style="margin:10px 0 0 0; color:#ffb703; font-family:'Orbitron'; font-size:0.9rem;">${g.title}</h4>
            </div>`;
        }).join('');
    } catch (e) { console.error("Error juegos", e); }
}

// ==========================================
// 5. CHAT Y SÓCKETS GENERALES
// ==========================================
function initChat() {
    if(typeof io === 'undefined') return;
    socket = io(API_URL);

    const input = document.getElementById("chatMsg"); // ID unificado
    const send = document.querySelector("#chatWindow button"); // Selección genérica
    const box = document.getElementById("chatMessages");

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
// 6. FUNCIONES DE PAGOS Y UTILIDADES (MODIFICADAS)
// ==========================================
window.openDepositModal = () => document.getElementById("depositModal").style.display = "flex";
window.closeModal = (id) => document.getElementById(id).style.display = "none";

window.submitDeposit = async () => {
    const amount = document.getElementById("depAmount").value;
    const ref = document.getElementById("depRef").value;
    const btn = document.querySelector("#depositModal button.btn-ninja-primary");

    if(!amount || !ref) return alert("❌ Faltan datos.");
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
        if(res.ok) {
            alert("✅ " + data.message);
            closeModal('depositModal');
        } else { alert("⚠️ " + data.message); }
    } catch (e) { alert("Error de conexión"); }
    finally { btn.innerText = "INFORMAR PAGO"; btn.disabled = false; }
};

window.doPayout = async () => {
    let alias = prompt("Ingresa tu Alias/CBU para recibir $12.50:");
    if(!alias) return;
    try {
        const res = await fetch(`${API_URL}/api/payments/payout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount: 12.50, alias })
        });
        const data = await res.json();
        if(res.ok) { alert("✅ Solicitud enviada."); window.location.reload(); }
        else { alert("⚠️ " + data.message); }
    } catch(e) { alert("Error"); }
};

window.playGame = (url) => { window.open(url, '_blank'); }; // Simple open para evitar conflictos de iframe

window.logout = () => { localStorage.clear(); window.location.replace("login.html"); };

function applyAccessLogic() {
    if (currentUser && currentUser.role === 'shogun') {
        if(document.getElementById("btnAdminFloating")) return;
        const btnAdmin = document.createElement("button");
        btnAdmin.id = "btnAdminFloating";
        btnAdmin.innerText = "⚙️";
        btnAdmin.className = "chat-btn-floating";
        btnAdmin.style.bottom = "100px"; btnAdmin.style.background = "red";
        btnAdmin.onclick = () => window.location.href = "admin.html";
        document.body.appendChild(btnAdmin);
    }
}

import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

document.addEventListener("DOMContentLoaded", async () => {
    await validateSession();
    if (currentUser) {
        setupEventListeners();
        initSocialMissionLogic(); // SE MANTIENE
    }
});

async function validateSession() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error("Sesión");
        
        // Datos frescos de wallet
        const walletRes = await fetch(`${API_URL}/api/payments/wallet`, { headers: { 'Authorization': `Bearer ${token}` } });
        const walletData = await walletRes.json();
        
        const authData = await res.json();
        currentUser = { ...authData, ...walletData };
        
        renderUserInterface();
        loadUserGames(); 
        initChat(); 
        initDuelArena(); // SE MANTIENE
        
    } catch (error) {
        console.error("Error sesión:", error);
        localStorage.clear();
        window.location.replace("login.html");
    }
}

function renderUserInterface() {
    safeText("userName", currentUser.ninjaName);
    safeText("headerBalance", formatMoney(currentUser.balance));
    safeText("userTokens", currentUser.tournamentTokens || 0);
    safeText("userRefCode", currentUser.referralCode || "---");
    
    const badge = document.getElementById("userRank");
    if(badge) badge.innerText = currentUser.level > 0 ? `RANGO ${currentUser.level}` : "RONIN";

    initDailyMissionBtn(); // SE MANTIENE
    applyAccessLogic();
    
    // Lógica nueva $50/4 tramos
    updateCycleProgress();
}

// === LÓGICA PASE $50 ===
function updateCycleProgress() {
    const container = document.getElementById("cycleContainer");
    if(!container) return;

    if (currentUser.cycle && currentUser.cycle.status === 'active') {
        container.style.display = "block";
        document.getElementById("buyAlert").style.display = "none";

        const currentBalance = currentUser.balance || 0;
        const totalTarget = 50.00;
        const stepTarget = 12.50; // Tramo de retiro
        
        // Visualmente mostramos el % respecto al total de $50
        let percent = (currentBalance / totalTarget) * 100;
        if(percent > 100) percent = 100;

        document.getElementById("cycleBar").style.width = `${percent}%`;
        safeText("cyclePercent", `${percent.toFixed(1)}%`);
        safeText("cycleEarnings", `${formatMoney(currentBalance)} / $50.00`);

        const harvestBtn = document.getElementById("harvestBtn");
        
        // Lógica de Retiro por Tramos
        // Habilitar si tiene saldo suficiente y no está bloqueado por otro retiro
        if (currentUser.hasPendingWithdrawal) {
            harvestBtn.style.display = "block";
            harvestBtn.innerText = "⏳ EN PROCESO...";
            harvestBtn.disabled = true;
        } else if (currentBalance >= stepTarget) {
            harvestBtn.style.display = "block";
            harvestBtn.disabled = false;
            harvestBtn.innerText = `💸 RETIRAR TRAMO ($12.50)`;
            harvestBtn.onclick = () => doPayout(12.50);
        } else {
            harvestBtn.style.display = "none";
        }

    } else {
        container.style.display = "none";
        document.getElementById("buyAlert").style.display = "block";
    }
}

// === LÓGICA MISIONES SOCIALES (RECUPERADA) ===
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
        
        btnShare.disabled = true;
        btnShare.innerText = "✅";
        if(statusTxt) statusTxt.innerText = "Esperando señal...";
        
        setTimeout(() => {
            if(btnVerify) { btnVerify.disabled = false; }
            if(statusTxt) statusTxt.innerText = "Listo para verificar.";
        }, 3000);
    });

    if(btnVerify) {
        btnVerify.addEventListener("click", () => {
            btnVerify.innerText = "...";
            setTimeout(() => {
                btnVerify.innerText = "✅";
                btnVerify.disabled = true;
                if(btnClaim) { btnClaim.disabled = false; }
                if(statusTxt) statusTxt.innerText = "Reclama tu recompensa.";
            }, 2000);
        });
    }

    if(btnClaim) {
        btnClaim.addEventListener("click", () => {
            alert("¡Misión cumplida! (Simulación: +$0.10)");
            btnClaim.innerText = "HECHO";
            btnClaim.disabled = true;
            // Aquí llamarías al backend si tuvieras endpoint de misión social real
        });
    }
}

function initDailyMissionBtn() {
    const btn = document.getElementById("missionBtn");
    if(!btn) return;
    
    // Si hay lastClaim y fue hace menos de 24h
    const lastClaim = currentUser.lastDailyClaim ? new Date(currentUser.lastDailyClaim) : new Date(0);
    const diff = (new Date() - lastClaim) / (1000 * 60 * 60);

    if(diff < 24) {
        btn.innerText = "VUELVE MAÑANA";
        btn.disabled = true;
    } else {
        btn.innerText = "RECLAMAR SUMINISTROS";
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
            window.location.reload();
        } else {
            alert(data.error);
            btn.innerText = "REINTENTAR";
        }
    } catch(e) { btn.innerText = "ERROR"; }
}

// === DUELOS Y JUEGOS ===
function initDuelArena() {
    if (socket) {
        socket.on("newDuelAvailable", (duel) => { renderizarDueloEnLista(duel); });
        socket.on("startDuelCombat", (data) => {
            alert(`⚔️ COMBATE: ${data.opponentName}`);
            window.playGame(`games/ninja-combat/?room=${data.roomCode}`); 
        });
    }
}

window.crearReto = async () => {
    const amountInput = document.getElementById('betAmount');
    const amount = Number(amountInput.value);
    if (amount < 5) return alert("❌ Mínimo 5 NC.");
    
    try {
        const res = await fetch(`${API_URL}/api/duels/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        if (res.ok) {
            alert("⚔️ Reto publicado.");
            socket.emit("createDuel", data.duel);
            window.location.reload(); // Recargar para ver cambio saldo
        } else { alert(data.error); }
    } catch (err) { alert("Error Arena"); }
};

function renderizarDueloEnLista(duel) {
    const list = document.getElementById('duelsList');
    if(!list) return;
    if (document.getElementById(`duel-${duel._id}`)) return;
    if (currentUser && duel.challenger === currentUser._id) return;

    const card = document.createElement('div');
    card.id = `duel-${duel._id}`;
    card.style = "background:#000; padding:10px; margin-bottom:5px; border-left:3px solid red; display:flex; justify-content:space-between; align-items:center; border:1px solid #333;";
    card.innerHTML = `
        <span style="color:white; font-weight:bold;">${duel.betAmount} NC</span>
        <button onclick="aceptarDuelo('${duel._id}')" class="btn-blade btn-outline" style="font-size:0.8rem; padding:5px;">ACEPTAR</button>
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
            socket.emit("duelAccepted", {
                challengerId: data.duel.challenger,
                roomCode: data.duel.roomCode,
                opponentName: currentUser.ninjaName
            });
            window.playGame(`games/ninja-combat/?room=${data.duel.roomCode}`);
            document.getElementById(`duel-${duelId}`).remove();
        } else { alert(data.error); }
    } catch (err) { alert("Error"); }
};

async function loadUserGames() {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return;
    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        if(games.length === 0) { container.innerHTML = "<p style='color:#666'>Sin software disponible.</p>"; return; }
        
        container.innerHTML = games.map(g => `
            <div style="background:#000; padding:10px; border:1px solid #333; cursor:pointer;" onclick="window.playGame('${g.embedUrl}')">
                <div style="height:100px; background:#111; display:flex; align-items:center; justify-content:center; margin-bottom:10px;">
                    <i class="fas fa-gamepad" style="font-size:2rem; color:var(--blood);"></i>
                </div>
                <h4 style="color:var(--gold); margin:0;">${g.title}</h4>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

// === UTILIDADES ===
function setupEventListeners() {
    window.toggleChat = () => {
        const chatWin = document.getElementById("chatWindow");
        if(chatWin) chatWin.style.display = chatWin.style.display === "flex" ? "none" : "flex";
    };
    document.getElementById("menuProfile")?.addEventListener("click", () => alert(`Perfil: ${currentUser.ninjaName}\nID: ${currentUser._id}`));
}

function initChat() {
    if(typeof io === 'undefined') return;
    socket = io(API_URL);
    const input = document.getElementById("chatMsg");
    const box = document.getElementById("chatMessages");

    socket.on("chat message", (msg) => {
        if(box) {
            const p = document.createElement("div");
            p.style.borderBottom = "1px solid #222"; p.style.padding="5px 0";
            p.innerHTML = `<strong style="color:var(--gold)">${msg.user}:</strong> <span style="color:#ccc">${msg.text}</span>`;
            box.appendChild(p); box.scrollTop = box.scrollHeight;
        }
    });

    window.sendChat = () => {
        const txt = input.value.trim();
        if(txt) { socket.emit("chat message", { user: currentUser.ninjaName, text: txt }); input.value = ""; }
    };
}

window.submitDeposit = async () => {
    const amount = document.getElementById("depAmount").value;
    const ref = document.getElementById("depRef").value;
    if(!amount || !ref) return alert("Faltan datos");

    try {
        const res = await fetch(`${API_URL}/api/payments/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount, referenceId: ref })
        });
        const data = await res.json();
        if(res.ok) { alert("✅ Reporte enviado."); window.closeModal('depositModal'); }
        else { alert(data.message); }
    } catch (e) { alert("Error"); }
};

window.doPayout = async (amountFixed) => {
    let alias = prompt(`Ingresa tu Alias/CBU para retirar $${amountFixed}:`);
    if(!alias) return;
    try {
        const res = await fetch(`${API_URL}/api/payments/payout`, { 
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount: amountFixed, alias })
        });
        const data = await res.json();
        if(res.ok) { alert("✅ Solicitud enviada."); window.location.reload(); }
        else { alert("⚠️ " + data.message); }
    } catch(e) { alert("Error"); }
};

window.playGame = (url) => { window.open(url, '_blank'); };
window.logout = () => { localStorage.clear(); window.location.replace("login.html"); };
function formatMoney(amount) { return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function safeText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function applyAccessLogic() {
    if (currentUser && currentUser.role === 'shogun') {
        const btn = document.createElement("button");
        btn.innerText = "ADMIN"; btn.className = "btn-blade";
        btn.style = "position:fixed; bottom:20px; left:20px; width:auto; z-index:9999;";
        btn.onclick = () => window.location.href = "admin.html";
        document.body.appendChild(btn);
    }
}

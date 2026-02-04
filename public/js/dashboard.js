import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

// 1. INICIALIZACIÓN
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
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error("Sesión inválida");

        const walletRes = await fetch(`${API_URL}/api/payments/wallet`, { headers: { 'Authorization': `Bearer ${token}` } });
        const walletData = await walletRes.json();
        
        const authData = await res.json();
        currentUser = { ...authData, ...walletData };
        
        renderUserInterface();
        loadUserGames(); 
        initChat(); 
        initDuelArena(); 
        
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

    initDailyMissionBtn();
    applyAccessLogic();
    updateCycleProgress();
}

function updateCycleProgress() {
    const container = document.getElementById("cycleContainer");
    if(!container) return;

    if (currentUser.cycle && currentUser.cycle.status === 'active') {
        container.style.display = "block";
        document.getElementById("buyAlert").style.display = "none";

        const currentBalance = currentUser.balance || 0;
        const target = 12.50;
        
        let percent = (currentBalance / target) * 100;
        if(percent > 100) percent = 100;

        document.getElementById("cycleBar").style.width = `${percent}%`;
        safeText("cyclePercent", `${percent.toFixed(1)}%`);
        safeText("cycleEarnings", `${formatMoney(currentBalance)} / $12.50`);

        const harvestBtn = document.getElementById("harvestBtn");
        if (currentBalance >= 12.50) {
            harvestBtn.style.display = "block";
            harvestBtn.onclick = () => doPayout();
        } else {
            harvestBtn.style.display = "none";
        }
    } else {
        container.style.display = "none";
        document.getElementById("buyAlert").style.display = "block";
    }
}

function formatMoney(amount) {
    return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function safeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// 2. LISTENERS
function setupEventListeners() {
    window.toggleChat = () => {
        const chatWin = document.getElementById("chatWindow");
        if(chatWin) chatWin.style.display = chatWin.style.display === "flex" ? "none" : "flex";
    };
    document.getElementById("menuProfile")?.addEventListener("click", () => alert("Perfil Ninja: " + currentUser.ninjaName));
}

window.logout = () => { localStorage.clear(); window.location.replace("login.html"); };

// 3. DUELOS (Visuales actualizados)
function initDuelArena() {
    if (socket) {
        socket.on("newDuelAvailable", (duel) => { renderizarDueloEnLista(duel); });
        socket.on("startDuelCombat", (data) => {
            alert(`⚔️ COMBATE INICIADO: ${data.opponentName}`);
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
            alert("⚔️ Reto publicado en la red.");
            socket.emit("createDuel", data.duel);
            currentUser.balance -= amount;
            safeText("headerBalance", formatMoney(currentUser.balance));
            updateCycleProgress();
        } else { alert(data.error); }
    } catch (err) { alert("Error Arena"); }
};

function renderizarDueloEnLista(duel) {
    const list = document.getElementById('duelsList');
    if(!list) return;
    if (list.innerText.includes("Escaneando")) list.innerHTML = '';
    if (document.getElementById(`duel-${duel._id}`)) return;
    if (currentUser && duel.challenger === currentUser._id) return;

    const card = document.createElement('div');
    card.id = `duel-${duel._id}`;
    // Usamos estilos inline para asegurar el look ninja en elementos dinámicos
    card.style = "background:#000; padding:15px; margin-bottom:10px; border-left:4px solid var(--blood); display:flex; justify-content:space-between; align-items:center; border:1px solid #222;";
    card.innerHTML = `
        <span style="color:white; font-family:'Orbitron'; font-size:1.1rem;">${duel.betAmount} NC</span>
        <button onclick="aceptarDuelo('${duel._id}')" class="btn-blade btn-blade-outline" style="width:auto; padding:5px 15px; margin:0;">ACEPTAR</button>
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
            document.getElementById(`duel-${duelId}`).remove();
        } else { alert(data.error); }
    } catch (err) { alert("Error"); }
};

// 4. JUEGOS Y MISIONES
function initDailyMissionBtn() {}
function initSocialMissionLogic() {}

async function loadUserGames() {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return;
    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        if(games.length === 0) { container.innerHTML = "<p style='color:#666'>Sin simulaciones activas.</p>"; return; }
        container.innerHTML = games.map(g => `
            <div style="background:#000; padding:10px; border:1px solid #333; cursor:pointer; text-align:center;" onclick="window.playGame('${g.embedUrl}')">
                <h4 style="color:var(--gold); margin:0; font-family:'Orbitron';">${g.title}</h4>
                <small style="color:#aaa;">INICIAR</small>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

// 5. CHAT
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

// 6. PAGOS
window.openModal = (id) => document.getElementById(id).style.display = "flex";
window.closeModal = (id) => document.getElementById(id).style.display = "none";

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
        if(res.ok) { alert("✅ Reporte enviado."); closeModal('depositModal'); }
        else { alert(data.message); }
    } catch (e) { alert("Error"); }
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

window.playGame = (url) => { window.open(url, '_blank'); };

function applyAccessLogic() {
    if (currentUser && currentUser.role === 'shogun') {
        const btn = document.createElement("button");
        btn.innerText = "ADMIN";
        btn.className = "btn-blade";
        btn.style = "position:fixed; bottom:20px; left:20px; width:auto; z-index:9999;";
        btn.onclick = () => window.location.href = "admin.html";
        document.body.appendChild(btn);
    }
}

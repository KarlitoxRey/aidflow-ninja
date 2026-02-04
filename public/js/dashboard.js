import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

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
        if (!res.ok) throw new Error("Sesión");
        
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
    // NOTA: El balance ya no está en el header, pero si existe en el DOM lo llenamos
    const headerBal = document.getElementById("headerBalance");
    if(headerBal) headerBal.innerText = formatMoney(currentUser.balance);

    safeText("userTokens", currentUser.tournamentTokens || 0);
    safeText("userRefCode", currentUser.referralCode || "---");
    
    const badge = document.getElementById("userRank");
    if(badge) badge.innerText = currentUser.level > 0 ? `RANGO ${currentUser.level}` : "RONIN";

    initDailyMissionBtn();
    applyAccessLogic();
    updateCycleProgress();
}

// === LÓGICA DE BARRA Y RETIRO ===
function updateCycleProgress() {
    const container = document.getElementById("cycleContainer");
    if(!container) return;

    if (currentUser.cycle && currentUser.cycle.status === 'active') {
        container.style.display = "block";
        document.getElementById("buyAlert").style.display = "none";

        const currentBalance = currentUser.balance || 0;
        const totalTarget = 50.00;
        const stepTarget = 12.50;
        
        let percent = (currentBalance / totalTarget) * 100;
        if(percent > 100) percent = 100;

        document.getElementById("cycleBar").style.width = `${percent}%`;
        safeText("cyclePercent", `${percent.toFixed(1)}%`);
        safeText("cycleEarnings", `${formatMoney(currentBalance)} / $50.00`);

        const harvestBtn = document.getElementById("harvestBtn");
        
        if (currentUser.hasPendingWithdrawal) {
            harvestBtn.style.display = "block";
            harvestBtn.innerText = "⏳ RETIRO EN PROCESO";
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

// === CHAT (DEPURADO) ===
function initChat() {
    if(typeof io === 'undefined') {
        console.error("Socket.io no cargado");
        return;
    }
    
    console.log("Conectando Chat a:", API_URL);
    socket = io(API_URL);
    
    const box = document.getElementById("chatMessages");

    socket.on("connect", () => {
        console.log("Chat Conectado. ID:", socket.id);
    });

    socket.on("chat message", (msg) => {
        console.log("Mensaje recibido:", msg);
        if(box) {
            const p = document.createElement("div");
            p.style.borderBottom = "1px solid #222"; p.style.padding="5px 0";
            p.innerHTML = `<strong style="color:var(--gold)">${msg.user}:</strong> <span style="color:#ccc">${msg.text}</span>`;
            box.appendChild(p); box.scrollTop = box.scrollHeight;
        }
    });

    window.sendChat = () => {
        const input = document.getElementById("chatMsg");
        const txt = input.value.trim();
        if(txt) { 
            console.log("Enviando:", txt);
            socket.emit("chat message", { user: currentUser.ninjaName, text: txt }); 
            input.value = ""; 
        }
    };
}

// === PAGOS (Nuevo flujo desde Modal Niveles) ===
window.submitDeposit = async () => {
    const amount = document.getElementById("depAmount").value;
    const ref = document.getElementById("depRef").value;
    
    if(!amount || !ref) return alert("Ingresa el ID de transacción");

    try {
        const res = await fetch(`${API_URL}/api/payments/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount, referenceId: ref })
        });
        const data = await res.json();
        if(res.ok) { 
            alert("✅ Comprobante enviado. Espera la activación."); 
            // Cerrar el modal de niveles
            document.getElementById('levelsModal').style.display = 'none';
        }
        else { alert("⚠️ " + data.message); }
    } catch (e) { alert("Error de conexión"); }
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

// === FUNCIONES EXTRAS ===
function initSocialMissionLogic() {
    const btnShare = document.getElementById("btnShare");
    if(!btnShare) return;
    btnShare.addEventListener("click", () => {
        window.open(`https://twitter.com/intent/tweet?text=AidFlow`, '_blank');
        btnShare.disabled = true;
        setTimeout(() => document.getElementById("btnVerify").disabled = false, 3000);
    });
    // ... resto
}

function initDailyMissionBtn() {
    const btn = document.getElementById("missionBtn");
    if(!btn) return;
    btn.onclick = async () => {
        const res = await fetch(`${API_URL}/api/missions/daily`, { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
        if(res.ok) window.location.reload();
    };
}

async function loadUserGames() {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return;
    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        if(games.length === 0) { container.innerHTML = "<p style='color:#666'>Sin torneos.</p>"; return; }
        container.innerHTML = games.map(g => `
            <div style="background:#000; padding:10px; border:1px solid #333; cursor:pointer;" onclick="window.playGame('${g.embedUrl}')">
                <h4 style="color:var(--gold); margin:0;">${g.title}</h4>
            </div>
        `).join('');
    } catch (e) {}
}

function initDuelArena() {
    if(socket) socket.on("newDuelAvailable", (d) => { /* render logic */ });
}
window.crearReto = () => alert("Publicando reto...");
window.playGame = (url) => window.open(url, '_blank');
window.logout = () => { localStorage.clear(); window.location.replace("login.html"); };
window.toggleChat = () => { const w = document.getElementById("chatWindow"); if(w) w.style.display = w.style.display==="flex"?"none":"flex"; };
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
function setupEventListeners() { document.getElementById("menuProfile")?.addEventListener("click", ()=>alert("Perfil")); }

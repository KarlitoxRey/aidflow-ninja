import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

const ECONOMY_CONFIG = { LEVELS: { 1: { goal: 30 } } };

document.addEventListener("DOMContentLoaded", async () => {
    await validateSession();
    if (currentUser) { initChat(); }
});

async function validateSession() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } }); // O /api/payments/wallet si usas ese
        if (!res.ok) throw new Error("Sesión");
        currentUser = await res.json();
        
        // Renderizar según estado
        renderUI();
        
        // Juegos (Práctica o Real)
        loadUserGames(!currentUser.isActive);

    } catch (error) {
        localStorage.clear();
        window.location.replace("login.html");
    }
}

function renderUI() {
    safeText("userName", currentUser.ninjaName);
    safeText("userRank", currentUser.isActive ? "🥷 RANGO: BRONCE" : "👺 RONIN (Sin Pase)");
    safeText("userTokens", currentUser.tournamentTokens || 0);

    const activationPanel = document.getElementById("activationPanel");
    const cycleContainer = document.getElementById("cycleContainer");
    const btn = document.getElementById("mainActionBtn");
    const statusMsg = document.getElementById("statusMsg");

    // 1. USUARIO ACTIVO (YA APROBADO)
    if (currentUser.isActive) {
        activationPanel.style.display = "none";
        cycleContainer.style.display = "block";
        
        // Actualizar barra con GANANCIAS (balance)
        // Ojo: En este modelo, el balance crece desde 0.
        updateCycleBar();
        blockMenu(false);
    } 
    // 2. USUARIO PENDIENTE (YA ENVIÓ PAGO)
    else if (currentUser.hasPendingDeposit) {
        activationPanel.style.display = "block";
        cycleContainer.style.display = "none";
        
        btn.innerText = "⏳ VERIFICANDO PAGO...";
        btn.className = "btn-action-main btn-pending";
        btn.onclick = null; // Deshabilitar click
        statusMsg.innerText = "Tu comprobante está siendo revisado por el Shogun.";
        
        blockMenu(true);
    }
    // 3. USUARIO NUEVO (DEBE COMPRAR)
    else {
        activationPanel.style.display = "block";
        cycleContainer.style.display = "none";
        
        btn.innerText = "⚔️ COMPRAR PASE NIVEL 1 ($10)";
        btn.onclick = window.openLevelsModal;
        statusMsg.innerText = "Adquiere el pase para desbloquear torneos y ganancias.";
        
        blockMenu(true);
    }
}

function updateCycleBar() {
    const goal = 30; // Meta Nivel 1
    // Usamos balance como indicador de progreso en el ciclo
    // OJO: Si implementas retiros parciales, usa 'currentCycleAcc' del backend
    const current = currentUser.currentCycleAcc || 0; 
    
    let percent = (current / goal) * 100;
    if(percent > 100) percent = 100;

    document.getElementById("cycleBar").style.width = `${percent}%`;
    safeText("cycleEarnings", `$${current.toFixed(2)} / $${goal.toFixed(2)}`);

    // Botón Retiro
    const harvestBtn = document.getElementById("harvestBtn");
    // Lógica: Si tiene saldo retirable (balance > 10)
    if(currentUser.balance >= 10) {
        harvestBtn.style.display = "block";
        harvestBtn.onclick = () => window.doPayout(currentUser.balance);
    }
}

function blockMenu(shouldBlock) {
    ['btn-tournament', 'btn-duels', 'btn-missions'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            if(shouldBlock) {
                el.classList.add('locked-feature');
                el.onclick = (e) => { e.stopPropagation(); alert("🔒 Bloqueado: Debes tener el Pase Activo."); };
            } else {
                el.classList.remove('locked-feature');
                el.onclick = null;
            }
        }
    });
}

// === ACCIONES ===
window.openLevelsModal = () => document.getElementById('levelsModal').style.display = 'flex';

window.submitDeposit = async () => {
    const ref = document.getElementById("depRef").value.trim();
    if(!ref) return alert("Falta el ID");

    try {
        const res = await fetch(`${API_URL}/api/payments/deposit`, {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount: 10, referenceId: ref })
        });
        if(res.ok) { alert("✅ Comprobante enviado."); window.location.reload(); }
        else { alert("Error al enviar"); }
    } catch(e) { alert("Error de conexión"); }
};

window.doPayout = async (amount) => {
    let alias = prompt("Alias para recibir dinero:");
    if(!alias) return;
    try {
        const res = await fetch(`${API_URL}/api/payments/payout`, {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount, alias })
        });
        if(res.ok) { alert("✅ Retiro solicitado."); window.location.reload(); }
    } catch(e) {}
};

// EXTRAS
async function loadUserGames(isPractice) {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return;
    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        container.innerHTML = games.map(g => `
            <div style="background:#111; padding:10px; border:1px solid #333; cursor:pointer; position:relative;" onclick="window.playGame('${g.embedUrl}', ${isPractice})">
                ${isPractice ? '<div style="position:absolute; top:5px; right:5px; font-size:10px; background:#444; color:white; padding:2px;">PRÁCTICA</div>' : ''}
                <i class="fas fa-gamepad fa-2x gold-text"></i>
                <h4 style="color:white; margin:5px 0;">${g.title}</h4>
            </div>`).join('');
    } catch(e) {}
}

window.playGame = (url, isPractice) => {
    if(isPractice && !confirm("⚠️ Modo Práctica (Sin Premios). ¿Jugar?")) return;
    document.getElementById('game-frame').src = url;
    document.getElementById('game-modal').style.display = 'flex';
};

function initChat() {
    if(typeof io === 'undefined') return;
    socket = io(API_URL);
    const box = document.getElementById("chatMessages");
    const input = document.getElementById("chatMsg");
    socket.on("chat message", (msg) => {
        const d = document.createElement("div");
        d.innerHTML = `<strong style="color:var(--gold)">${msg.user}:</strong> ${msg.text}`;
        box.appendChild(d); box.scrollTop = box.scrollHeight;
    });
    input?.addEventListener("keypress", (e) => {
        if(e.key==="Enter" && input.value.trim()) {
            socket.emit("chat message", {user:currentUser.ninjaName, text:input.value});
            input.value="";
        }
    });
}
window.toggleChat = () => { const w = document.getElementById("chatWindow"); w.style.display = w.style.display==="flex"?"none":"flex"; };
window.logout = () => { localStorage.clear(); window.location.replace("login.html"); };
function safeText(id, t) { const e = document.getElementById(id); if(e) e.innerText = t; }
function formatMoney(n) { return `$${Number(n).toFixed(2)}`; }

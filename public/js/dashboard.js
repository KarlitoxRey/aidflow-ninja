import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

// META DEL NIVEL 1
const LEVEL_1_GOAL = 30.00;

document.addEventListener("DOMContentLoaded", async () => {
    await validateSession();
    if (currentUser) { initChat(); }
});

async function validateSession() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error("Sesión");
        currentUser = await res.json();
        
        renderUI();

        // 👇 LÓGICA AGREGADA: DETECTAR SI ES SHOGUN 👇
        if (currentUser.role === 'shogun' || currentUser.role === 'admin') {
            loadShogunFinances();
        }
        // 👆 FIN LÓGICA AGREGADA 👆

        loadUserGames(!currentUser.isActive);

    } catch (error) {
        console.error(error);
        localStorage.clear();
        // window.location.replace("login.html"); // Descomentar en producción
    }
}

function renderUI() {
    safeText("userName", currentUser.ninjaName);
    safeText("userRank", currentUser.isActive ? "🥷 RANGO: BRONCE (Nivel 1)" : "👺 RONIN (Sin Pase)");
    safeText("userTokens", currentUser.tournamentTokens || 0);

    // GESTIÓN DE REFERIDOS
    const refLink = `${window.location.origin}/register.html?ref=${currentUser._id}`;
    safeText("myRefLink", refLink);
    
    window.copyReferralLink = () => {
        navigator.clipboard.writeText(refLink);
        alert("🔗 Link de reclutamiento copiado.");
    };

    const activationPanel = document.getElementById("activationPanel");
    const cycleContainer = document.getElementById("cycleContainer");
    const btn = document.getElementById("mainActionBtn");
    const statusMsg = document.getElementById("statusMsg");
    const refWarning = document.getElementById("refWarning");

    // 1. USUARIO ACTIVO
    if (currentUser.isActive) {
        activationPanel.style.display = "none";
        cycleContainer.style.display = "block";
        refWarning.style.display = "none"; 
        
        updateCycleBar(); 
        blockMenu(false);
    } 
    // 2. PENDIENTE
    else if (currentUser.hasPendingDeposit) {
        activationPanel.style.display = "block";
        cycleContainer.style.display = "none";
        refWarning.style.display = "flex"; 

        btn.innerText = "⏳ VERIFICANDO PAGO...";
        btn.className = "btn-action-main btn-pending";
        btn.onclick = null;
        statusMsg.innerHTML = "Tu comprobante está en revisión.";
        blockMenu(true);
    }
    // 3. NUEVO
    else {
        activationPanel.style.display = "block";
        cycleContainer.style.display = "none";
        refWarning.style.display = "flex"; 

        btn.innerText = "⚔️ OBTENER PASE NIVEL 1";
        btn.className = "btn-action-main";
        btn.onclick = window.openLevelsModal;
        statusMsg.innerText = "Adquiere el Pase Ninja para iniciar.";
        blockMenu(true);
    }
}

function updateCycleBar() {
    const current = currentUser.currentCycleAcc || 0; 
    let percent = (current / LEVEL_1_GOAL) * 100;
    if(percent > 100) percent = 100;

    document.getElementById("cycleBar").style.width = `${percent}%`;
    safeText("cycleEarnings", `$${current.toFixed(2)} / $${LEVEL_1_GOAL.toFixed(2)}`);

    const harvestBtn = document.getElementById("harvestBtn");
    // Retiro solo si meta cumplida y saldo disponible
    if (current >= LEVEL_1_GOAL && currentUser.balance > 0) {
        harvestBtn.style.display = "block";
        harvestBtn.innerText = "💸 CICLO COMPLETADO: RETIRAR";
        harvestBtn.className = "btn-ninja-primary";
        harvestBtn.onclick = () => window.doPayout(currentUser.balance);
    } else {
        harvestBtn.style.display = "none";
    }
}

// 👇 FUNCIÓN AGREGADA PARA CARGAR FONDOS DE ADMIN 👇
async function loadShogunFinances() {
    const panel = document.getElementById("shogunFinancePanel");
    if (!panel) return; // Si no existe el HTML, salimos

    try {
        const res = await fetch(`${API_URL}/api/finance/funds`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            panel.style.display = "block"; // Mostrar panel solo si la petición fue exitosa
            
            safeText("adminBalance", formatMoney(data.adminBalance));
            safeText("daoBalance", formatMoney(data.daoBalance));
            safeText("backupBalance", formatMoney(data.backupBalance));
            safeText("totalIncome", formatMoney(data.totalIncome));
        }
    } catch (e) {
        console.log("No se pudieron cargar finanzas (Probablemente no eres admin)");
        panel.style.display = "none";
    }
}
// 👆 FIN FUNCIÓN AGREGADA 👆

function blockMenu(shouldBlock) {
    ['btn-tournament', 'btn-duels', 'btn-missions'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            if(shouldBlock) {
                el.classList.add('locked-feature');
                el.onclick = (e) => { e.stopPropagation(); alert("🔒 Bloqueado: Requiere Pase Nivel 1."); };
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
    let alias = prompt(`¡Felicitaciones! Ciclo completado.\nIngresa tu Alias para retirar $${amount.toFixed(2)}:`);
    if(!alias) return;
    try {
        const res = await fetch(`${API_URL}/api/payments/payout`, {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount, alias })
        });
        const data = await res.json();
        if(res.ok) { alert("✅ Solicitud enviada al Shogun."); window.location.reload(); }
        else { alert("⚠️ " + data.message); }
    } catch(e) { alert("Error al conectar"); }
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
function formatMoney(amount) { return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }

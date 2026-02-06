import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

const ECONOMY_CONFIG = {
    LEVELS: {
        1: { name: "🥷 BRONCE", goal: 30, entry: 10 },
        2: { name: "⚔️ PLATA", goal: 75, entry: 25 },
        3: { name: "👑 ORO", goal: 150, entry: 50 }
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    await validateSession();
    if (currentUser) {
        initChat(); 
        initUI();
    }
});

async function validateSession() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error("Sesión expirada");
        
        currentUser = await res.json();
        
        // 1. Renderizar Interfaz
        renderUserInterface();
        
        // 2. Cargar Juegos
        loadUserGames(!currentUser.isActive);

    } catch (error) {
        console.error("Error sesión:", error);
        localStorage.clear();
        window.location.replace("login.html");
    }
}

function renderUserInterface() {
    safeText("userName", currentUser.ninjaName);
    
    // Rango
    const levelInfo = ECONOMY_CONFIG.LEVELS[currentUser.level];
    safeText("userRank", levelInfo ? levelInfo.name : "👺 RONIN");

    // === PANELES ===
    const activationPanel = document.getElementById("activationPanel");
    const cycleContainer = document.getElementById("cycleContainer");
    const btn = document.getElementById("mainActionBtn");
    const statusText = document.getElementById("statusText");

    // LÓGICA DE VISIBILIDAD DE SALDO (OCULTO VISUALMENTE, USADO LÓGICAMENTE)
    const hasEnoughBalance = currentUser.balance >= 10;

    // CASO A: INACTIVO
    if (!currentUser.isActive) {
        if(activationPanel) activationPanel.style.display = "block";
        if(cycleContainer) cycleContainer.style.display = "none";

        if (hasEnoughBalance) {
            // TIENE DINERO (ADMIN APROBÓ) -> LISTO PARA ACTIVAR
            btn.innerText = "✅ CRÉDITO APROBADO: INICIAR";
            btn.classList.add("btn-ready"); // Efecto verde/dorado
            statusText.innerText = "Tu saldo ha sido confirmado. Haz click para entrar.";
            
            // Acción: Activar Directamente
            window.handleMainAction = window.activateLevelWithBalance;
        } else {
            // NO TIENE DINERO -> DEBE PAGAR
            btn.innerText = "⚔️ ACTIVAR NIVEL 1 ($10)";
            btn.classList.remove("btn-ready");
            statusText.innerText = "Envía el aviso de pago para comenzar.";
            
            // Acción: Abrir Modal
            window.handleMainAction = window.openLevelsModal;
        }

        // Bloquear menú
        blockMenu(true);
    } 
    // CASO B: ACTIVO
    else {
        if(activationPanel) activationPanel.style.display = "none";
        if(cycleContainer) cycleContainer.style.display = "block";
        
        updateCycleProgress();
        blockMenu(false);
    }
}

function updateCycleProgress() {
    const levelData = ECONOMY_CONFIG.LEVELS[currentUser.level];
    if(!levelData) return;

    const goal = levelData.goal;
    const currentAcc = currentUser.currentCycleAcc || 0;
    const percent = Math.min((currentAcc / goal) * 100, 100);

    document.getElementById("cycleBar").style.width = `${percent}%`;
    safeText("cycleEarnings", `${formatMoney(currentAcc)} / ${formatMoney(goal)}`);

    const harvestBtn = document.getElementById("harvestBtn");
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
                el.onclick = () => alert("🔒 Función Bloqueada: Debes activar Nivel 1.");
            } else {
                el.classList.remove('locked-feature');
                el.onclick = null; // Restaurar comportamiento original (o dejar el del HTML)
            }
        }
    });
}

// === ACCIONES ===

window.openLevelsModal = () => {
    document.getElementById('levelsModal').style.display = 'flex';
};

// ENVIAR AVISO (MODAL)
window.submitDeposit = async () => {
    const ref = document.getElementById("depRef").value.trim();
    
    if(!ref) return alert("❌ Falta el ID del comprobante.");

    try {
        const res = await fetch(`${API_URL}/api/payments/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount: 10, referenceId: ref }) // SIEMPRE 10 para Nivel 1
        });
        
        const data = await res.json();
        if(res.ok) { 
            alert("✅ Aviso enviado.\nEspera a que el Shogun apruebe tu entrada."); 
            document.getElementById('levelsModal').style.display = 'none';
        } else { 
            alert("⚠️ " + data.message); 
        }
    } catch (e) { alert("Error de conexión"); }
};

// ACTIVAR (CUANDO YA HAY SALDO)
window.activateLevelWithBalance = async () => {
    if(!confirm("¿Confirmar iniciación de Nivel 1?")) return;
    
    try {
        const res = await fetch(`${API_URL}/api/economy/entry`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ userId: currentUser._id, level: 1, amount: 10 })
        });

        const data = await res.json();
        if(res.ok) {
            alert("✅ ¡BIENVENIDO! El ciclo ha comenzado.");
            window.location.reload();
        } else {
            alert("⚠️ " + data.error);
        }
    } catch(e) { alert("Error de conexión"); }
};

// === EXTRAS ===
async function loadUserGames(isPractice) {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return;
    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        if(games.length === 0) { container.innerHTML = "<p style='color:#666'>Dojo vacío.</p>"; return; }
        container.innerHTML = games.map(g => `
            <div style="background:#111; border:1px solid #333; cursor:pointer; position:relative;" onclick="window.playGame('${g.embedUrl}', ${isPractice})">
                ${isPractice ? '<div style="position:absolute; top:5px; right:5px; background:#444; color:#fff; font-size:10px; padding:2px 5px;">PRÁCTICA</div>' : ''}
                <div style="height:100px; display:flex; align-items:center; justify-content:center; background:#000;">
                   <i class="fas fa-gamepad fa-3x gold-text"></i>
                </div>
                <h4 style="color:white; padding:10px; margin:0; font-size:0.9rem;">${g.title}</h4>
            </div>
        `).join('');
    } catch (e) {}
}

window.playGame = (url, isPractice) => {
    const modal = document.getElementById('game-modal');
    const iframe = document.getElementById('game-frame');
    if(isPractice && !confirm("⚠️ Estás en modo PRÁCTICA (Inactivo). No ganarás puntos reales. ¿Jugar?")) return;
    iframe.src = url;
    modal.style.display = 'flex';
};

// CHAT
function initChat() {
    if(typeof io === 'undefined') return;
    socket = io(API_URL);
    const box = document.getElementById("chatMessages");
    const input = document.getElementById("chatMsg");

    socket.on("chat message", (msg) => {
        if(box) {
            const div = document.createElement("div");
            div.style.marginBottom = "5px";
            div.innerHTML = `<strong style="color:var(--gold)">${msg.user}:</strong> <span style="color:#ccc">${msg.text}</span>`;
            box.appendChild(div); box.scrollTop = box.scrollHeight;
        }
    });

    input?.addEventListener("keypress", (e) => {
        if(e.key === "Enter") {
            const txt = input.value.trim();
            if(txt) { socket.emit("chat message", { user: currentUser.ninjaName, text: txt }); input.value = ""; }
        }
    });
}
window.toggleChat = () => {
    const w = document.getElementById("chatWindow");
    w.style.display = (w.style.display === "none" || w.style.display === "") ? "flex" : "none";
};

window.logout = () => { localStorage.clear(); window.location.replace("login.html"); };
window.doPayout = async (amount) => {
    let alias = prompt(`Retirar $${amount} a Alias:`);
    if(!alias) return;
    try {
        const res = await fetch(`${API_URL}/api/payments/payout`, { 
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount, alias })
        });
        if(res.ok) { alert("✅ Retiro solicitado."); window.location.reload(); }
    } catch(e) { alert("Error"); }
};
function formatMoney(amount) { return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function safeText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function initUI() { /* Hooks extra */ }

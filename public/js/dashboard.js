import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

// Configuración de Economía
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
        setupEventListeners();
        initChat();
    }
});

async function validateSession() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error("Sesión expirada");
        
        currentUser = await res.json();
        renderUserInterface();
        applyRestrictions(); // APLICAR CANDADOS
        
    } catch (error) {
        console.error("Error sesión:", error);
        localStorage.clear();
        window.location.replace("login.html");
    }
}

// === 🔒 SISTEMA DE RESTRICCIONES ===
function applyRestrictions() {
    const isInactive = !currentUser.isActive;
    
    // 1. Bloquear Menú Principal
    const restrictedBtns = ['btn-tournament', 'btn-duels', 'btn-missions'];
    restrictedBtns.forEach(btnId => {
        const el = document.getElementById(btnId);
        if(el) {
            if(isInactive) {
                el.classList.add('locked-feature'); // Clase CSS que pusimos en HTML
            } else {
                el.classList.remove('locked-feature');
            }
        }
    });

    // 2. Cargar Juegos (Modo Práctica o Real)
    loadUserGames(isInactive);
}

function renderUserInterface() {
    safeText("userName", currentUser.ninjaName);
    
    // Rango
    const levelInfo = ECONOMY_CONFIG.LEVELS[currentUser.level];
    safeText("userRank", levelInfo ? levelInfo.name : "👺 RONIN (Inactivo)");

    // Balance
    safeText("headerBalance", formatMoney(currentUser.balance));

    // === LÓGICA DE ACTIVACIÓN ===
    const container = document.getElementById("cycleContainer");
    const buyAlert = document.getElementById("buyAlert");

    // CASO A: TIENE SALDO PERO NO ESTÁ ACTIVO
    if (!currentUser.isActive && currentUser.balance >= 10) {
        if(container) container.style.display = "none";
        if(buyAlert) {
            buyAlert.style.display = "block";
            buyAlert.innerHTML = `
                <h3 style="color:var(--gold); margin-top:0;">⚠️ SALDO DETECTADO</h3>
                <p style="color:#ccc;">Tienes <strong>${formatMoney(currentUser.balance)}</strong> disponibles.</p>
                <p>Para desbloquear Torneos y Ganancias, debes activar tu rango.</p>
                <button onclick="window.activateLevelWithBalance()" class="btn-blade" style="width:100%;">
                    ACTIVAR NIVEL 1 ($10)
                </button>
            `;
        }
    }
    // CASO B: ACTIVO Y JUGANDO
    else if (currentUser.isActive) {
        if(buyAlert) buyAlert.style.display = "none";
        if(container) {
            container.style.display = "block";
            updateCycleProgress();
        }
    }
    // CASO C: INACTIVO SIN SALDO
    else {
        if(container) container.style.display = "none";
        if(buyAlert) buyAlert.style.display = "none";
    }
}

// === 📊 BARRA DE PROGRESO ===
function updateCycleProgress() {
    const levelData = ECONOMY_CONFIG.LEVELS[currentUser.level];
    if(!levelData) return;

    const goal = levelData.goal;
    const currentAcc = currentUser.currentCycleAcc || 0;
    
    let percent = (currentAcc / goal) * 100;
    if(percent > 100) percent = 100;

    document.getElementById("cycleBar").style.width = `${percent}%`;
    safeText("cyclePercent", `${percent.toFixed(1)}%`);
    safeText("cycleEarnings", `${formatMoney(currentAcc)} / ${formatMoney(goal)}`);
    
    // Botón de Retiro
    const harvestBtn = document.getElementById("harvestBtn");
    if(currentUser.balance >= 10) {
        harvestBtn.style.display = "block";
        harvestBtn.onclick = () => window.doPayout(currentUser.balance);
    }
}

// === 🎮 CARGAR JUEGOS ===
async function loadUserGames(isPracticeMode) {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return;
    
    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        
        if(!Array.isArray(games) || games.length === 0) { 
            container.innerHTML = "<p style='color:#666'>Sin juegos disponibles.</p>"; return; 
        }

        container.innerHTML = games.map(g => `
            <div style="background:#151515; border:1px solid #333; cursor:pointer; position:relative;" onclick="window.playGame('${g.embedUrl}', ${isPracticeMode})">
                ${isPracticeMode ? '<div style="position:absolute; top:0; right:0; background:#444; color:#fff; font-size:10px; padding:2px 5px;">PRÁCTICA</div>' : ''}
                <div style="height:100px; display:flex; align-items:center; justify-content:center; background:#000;">
                   <i class="fas fa-gamepad fa-3x gold-text"></i>
                </div>
                <h4 style="color:white; padding:10px; margin:0; font-size:0.9rem;">${g.title}</h4>
            </div>
        `).join('');
    } catch (e) { console.log("Error juegos"); }
}

// === 🚀 FUNCIONES DE ACCIÓN ===

// 1. Abrir Modal Pagos
window.openLevelsModal = () => {
    document.getElementById('levelsModal').style.display = 'flex';
};

// 2. Enviar Comprobante (SOLICITUD DE CARGA DE SALDO)
window.submitDeposit = async () => {
    const levelSelect = document.getElementById("levelSelect");
    const amount = levelSelect.value == 1 ? 10 : (levelSelect.value == 2 ? 25 : 50);
    const ref = document.getElementById("depRef").value;
    
    if(!ref) return alert("Falta el ID de transacción");

    try {
        const res = await fetch(`${API_URL}/api/payments/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount, referenceId: ref }) // Solo pedimos cargar saldo
        });
        
        if(res.ok) { 
            alert("✅ Comprobante enviado. Cuando el Shogun apruebe, verás tu saldo aquí para activar el nivel."); 
            document.getElementById('levelsModal').style.display = 'none';
        } else { 
            const d = await res.json();
            alert("⚠️ " + d.message); 
        }
    } catch (e) { alert("Error de conexión"); }
};

// 3. ACTIVAR NIVEL USANDO SALDO (Lo que hace el usuario después)
window.activateLevelWithBalance = async () => {
    if(!confirm("¿Usar tu saldo para activar el Nivel y entrar al ciclo?")) return;
    
    try {
        const res = await fetch(`${API_URL}/api/economy/entry`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify({ userId: currentUser._id, level: 1, amount: 10 }) // Por defecto Nivel 1
        });

        const data = await res.json();
        if(res.ok) {
            alert("✅ ¡NIVEL ACTIVADO! Bienvenido a la hermandad.");
            window.location.reload();
        } else {
            alert("⚠️ " + data.error);
        }
    } catch(e) { alert("Error de conexión"); }
};

window.playGame = (url, isPractice) => {
    if(isPractice) alert("Modo Práctica: No ganarás recompensas.");
    window.open(url, '_blank');
};

window.logout = () => { localStorage.clear(); window.location.replace("login.html"); };

// Helpers
function formatMoney(amount) { return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function safeText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function setupEventListeners() { /* Extras */ }
function initChat() { /* Chat Code */ }

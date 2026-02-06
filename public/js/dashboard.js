import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

// Configuración de la Nueva Economía
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
        initSocialMissionLogic();
        initChat(); // Iniciamos el chat si existe
        initDuelArena(); // Iniciamos escucha de duelos
    }
});

async function validateSession() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error("Sesión expirada");
        
        currentUser = await res.json();
        
        // 1. Renderizar Interfaz Base
        renderUserInterface();
        
        // 2. Aplicar Restricciones (Si no está activo)
        applyRestrictions();
        
        // 3. Botón Shogun (si aplica)
        applyAccessLogic();

    } catch (error) {
        console.error("Error sesión:", error);
        localStorage.clear();
        window.location.replace("login.html");
    }
}

// === 🔒 SISTEMA DE RESTRICCIONES (NUEVO) ===
function applyRestrictions() {
    const isInactive = !currentUser.isActive;
    
    // Lista de botones a bloquear si está inactivo
    const restrictedBtns = ['btn-tournament', 'btn-duels', 'btn-missions'];
    
    restrictedBtns.forEach(btnId => {
        const el = document.getElementById(btnId);
        if(el) {
            if(isInactive) {
                el.classList.add('locked-feature'); // CSS class en HTML
                el.onclick = (e) => { 
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    alert("🔒 Debes activar tu nivel para acceder a esta sección."); 
                };
            } else {
                el.classList.remove('locked-feature');
                // Restaurar eventos originales si fuera necesario (aquí asumimos onclick en HTML)
            }
        }
    });

    // Cargar Juegos (Si es inactivo -> Modo Práctica)
    loadUserGames(isInactive);
}

function renderUserInterface() {
    safeText("userName", currentUser.ninjaName);
    safeText("headerBalance", formatMoney(currentUser.balance));
    
    // Rango
    const levelInfo = ECONOMY_CONFIG.LEVELS[currentUser.level];
    safeText("userRank", levelInfo ? levelInfo.name : "👺 RONIN (Sin Clan)");

    // === LÓGICA DE BARRA Y ALERTAS ===
    const container = document.getElementById("cycleContainer");
    const buyAlert = document.getElementById("buyAlert");

    // CASO A: Tiene saldo pero NO está activo -> Mostrar Alerta de Activación
    if (!currentUser.isActive && currentUser.balance >= 10) {
        if(container) container.style.display = "none";
        if(buyAlert) {
            buyAlert.style.display = "block";
            buyAlert.innerHTML = `
                <h3 class="gold-text" style="margin-top:0;">⚠️ SALDO DETECTADO: ${formatMoney(currentUser.balance)}</h3>
                <p style="color:#ccc;">Tienes fondos suficientes.</p>
                <p class="white-text">Debes <strong>ACTIVAR EL NIVEL</strong> para desbloquear micropagos, torneos y duelos.</p>
                <button onclick="window.activateLevelWithBalance()" class="btn-ninja-primary" style="width:100%; font-size:1.1rem;">
                    🚀 ACTIVAR NIVEL 1 AHORA
                </button>
            `;
        }
    }
    // CASO B: Activo -> Mostrar Barra de Progreso
    else if (currentUser.isActive) {
        if(buyAlert) buyAlert.style.display = "none";
        if(container) {
            container.style.display = "block";
            updateCycleProgress();
        }
    }
    // CASO C: Inactivo sin saldo -> Ocultar todo (Se usa el botón Comprar Pase del header)
    else {
        if(container) container.style.display = "none";
        if(buyAlert) buyAlert.style.display = "none";
    }

    initDailyMissionBtn();
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
    if(currentUser.balance >= 10) { // Mínimo retiro
        harvestBtn.style.display = "block";
        harvestBtn.onclick = () => window.doPayout(currentUser.balance);
    } else {
        harvestBtn.style.display = "none";
    }
}

// === 🎮 CARGAR JUEGOS (MODO PRÁCTICA) ===
async function loadUserGames(isPracticeMode) {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return;
    
    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        
        if(games.length === 0) { 
            container.innerHTML = "<p style='color:#666'>El Dojo está vacío por ahora.</p>"; return; 
        }

        container.innerHTML = games.map(g => `
            <div class="action-card card-dark" style="cursor:pointer; position:relative;" onclick="window.playGame('${g.embedUrl}', ${isPracticeMode})">
                ${isPracticeMode ? '<div style="position:absolute; top:5px; right:5px; background:#555; color:white; font-size:10px; padding:2px 5px; border-radius:3px;">PRÁCTICA</div>' : ''}
                <div style="height:80px; display:flex; align-items:center; justify-content:center; background:#111; margin-bottom:10px;">
                   <i class="fas fa-gamepad fa-3x gold-text"></i>
                </div>
                <h4 style="color:white; margin:0;">${g.title}</h4>
            </div>
        `).join('');
    } catch (e) { console.log("Error cargando juegos"); }
}

// === 🚀 ACCIONES DEL USUARIO ===

// 1. Abrir Modal de Pago
window.openLevelsModal = () => {
    document.getElementById('levelsModal').style.display = 'flex';
};

// 2. Enviar Solicitud de Depósito (SOLO CARGA SALDO)
window.submitDeposit = async () => {
    const levelSelect = document.getElementById("levelSelect");
    // Asignamos monto según nivel seleccionado para facilitar al usuario
    const amount = levelSelect.value == 1 ? 10 : (levelSelect.value == 2 ? 25 : 50);
    const ref = document.getElementById("depRef").value;
    
    if(!ref) return alert("Falta el ID de transacción");

    try {
        const res = await fetch(`${API_URL}/api/payments/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount, referenceId: ref })
        });
        
        const data = await res.json();
        if(res.ok) { 
            alert("✅ Aviso enviado. Cuando el Shogun apruebe, verás tu saldo y podrás ACTIVAR."); 
            document.getElementById('levelsModal').style.display = 'none';
        } else { 
            alert("⚠️ " + data.message); 
        }
    } catch (e) { alert("Error de conexión"); }
};

// 3. ACTIVAR NIVEL (Dispara la lógica de economía)
window.activateLevelWithBalance = async () => {
    if(!confirm("¿Usar tu saldo para activar el Nivel y entrar al ciclo?")) return;
    
    try {
        const res = await fetch(`${API_URL}/api/economy/entry`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify({ userId: currentUser._id, level: 1, amount: 10 }) // Default Nivel 1
        });

        const data = await res.json();
        if(res.ok) {
            alert("✅ ¡NIVEL ACTIVADO! Bienvenido a la hermandad.");
            window.location.reload();
        } else {
            alert("⚠️ " + (data.error || "Error al activar"));
        }
    } catch(e) { alert("Error de conexión"); }
};

// 4. Jugar (Con alerta de Práctica)
window.playGame = (url, isPractice) => {
    if(isPractice) {
        if(!confirm("⚠️ MODO PRÁCTICA: Estás inactivo, por lo que no ganarás recompensas ni puntaje oficial. ¿Jugar igual?")) return;
    }
    // Usamos el modal de iframe que existe en el HTML
    const modal = document.getElementById('game-modal');
    const iframe = document.getElementById('game-frame');
    if(modal && iframe) {
        iframe.src = url;
        modal.style.display = 'flex';
    } else {
        window.open(url, '_blank');
    }
};

window.doPayout = async (amount) => {
    let alias = prompt(`Ingresa tu Alias/CBU para retirar $${amount}:`);
    if(!alias) return;
    try {
        const res = await fetch(`${API_URL}/api/payments/payout`, { 
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount: amount, alias })
        });
        const data = await res.json();
        if(res.ok) { alert("✅ Retiro solicitado."); window.location.reload(); }
        else { alert("⚠️ " + data.message); }
    } catch(e) { alert("Error"); }
};

// === EXTRAS (MISIONES, CHAT, ETC) ===
function initSocialMissionLogic() {
    const btnShare = document.getElementById("btnShare"); // Si existe
    // ... tu lógica existente de share ...
}
function initDailyMissionBtn() {
    const btn = document.getElementById("missionBtn");
    if(!btn) return;
    btn.onclick = async () => {
        const res = await fetch(`${API_URL}/api/missions/daily`, { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
        if(res.ok) { alert("🎁 Recompensa diaria recibida"); window.location.reload(); }
        else alert("⏳ Ya reclamaste hoy");
    };
}
function initChat() {
    if(typeof io === 'undefined') return;
    socket = io(API_URL);
    const box = document.getElementById("chatMessages");
    socket.on("chat message", (msg) => {
        if(box) {
            const p = document.createElement("div");
            p.innerHTML = `<strong style="color:var(--shogun-gold)">${msg.user}:</strong> <span style="color:#ccc">${msg.text}</span>`;
            box.appendChild(p); box.scrollTop = box.scrollHeight;
        }
    });
    window.sendChat = () => {
        const input = document.getElementById("chatMsg");
        const txt = input.value.trim();
        if(txt) { socket.emit("chat message", { user: currentUser.ninjaName, text: txt }); input.value = ""; }
    };
}
function initDuelArena() { if(socket) socket.on("newDuelAvailable", (d) => { console.log("Nuevo duelo:", d); }); }
window.logout = () => { localStorage.clear(); window.location.replace("login.html"); };
window.toggleChat = () => { const w = document.getElementById("chatWindow"); if(w) w.style.display = w.style.display==="flex"?"none":"flex"; };
function formatMoney(amount) { return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function safeText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function applyAccessLogic() {
    if (currentUser && currentUser.role === 'shogun') {
        const btn = document.createElement("button");
        btn.innerText = "⚙️ SHOGUN"; 
        btn.className = "btn-ninja-outline";
        btn.style = "position:fixed; bottom:20px; left:20px; z-index:9999; background:black;";
        btn.onclick = () => window.location.href = "admin.html";
        document.body.appendChild(btn);
    }
}
window.crearReto = () => alert("Arena de Duelos: Próximamente");

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
        
        // Renderizar datos básicos
        renderUserInterface();
        
        // Cargar juegos (con restricción si aplica)
        loadUserGames(!currentUser.isActive);

    } catch (error) {
        console.error("Error sesión:", error);
        localStorage.clear();
        window.location.replace("login.html");
    }
}

function renderUserInterface() {
    safeText("userName", currentUser.ninjaName);
    safeText("headerBalance", formatMoney(currentUser.balance));

    // Rango
    const levelInfo = ECONOMY_CONFIG.LEVELS[currentUser.level];
    safeText("userRank", levelInfo ? levelInfo.name : "👺 RONIN (Sin Clan)");

    // === LÓGICA DE ACTIVACIÓN ===
    const container = document.getElementById("cycleContainer");
    const buyAlert = document.getElementById("buyAlert");

    // 1. USUARIO CON SALDO PERO INACTIVO (Debe activar manualmente)
    if (!currentUser.isActive && currentUser.balance >= 10) {
        if(container) container.style.display = "none";
        if(buyAlert) {
            buyAlert.style.display = "block";
            buyAlert.innerHTML = `
                <div style="background: rgba(252, 163, 17, 0.1); border: 1px solid var(--gold); padding: 15px; text-align: center;">
                    <h3 style="color:var(--gold); margin:0;">⚠️ SALDO DETECTADO</h3>
                    <p style="color:#ccc; font-size:0.9rem;">Tienes <strong>${formatMoney(currentUser.balance)}</strong> listos.</p>
                    <p style="font-size:0.9rem;">Activa tu rango para desbloquear Torneos y Ganancias.</p>
                    <button onclick="window.activateLevelWithBalance()" class="btn-ninja-primary" style="width:100%; margin-top:10px;">
                        🚀 ACTIVAR NIVEL 1
                    </button>
                </div>
            `;
        }
    }
    // 2. USUARIO ACTIVO (Jugando)
    else if (currentUser.isActive) {
        if(buyAlert) buyAlert.style.display = "none";
        if(container) {
            container.style.display = "block";
            updateCycleProgress();
        }
    }
    // 3. NUEVO SIN SALDO
    else {
        if(container) container.style.display = "none";
        if(buyAlert) buyAlert.style.display = "none";
        // Bloquear menú principal visualmente
        ['btn-tournament', 'btn-duels', 'btn-missions'].forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.classList.add('locked-feature');
                el.onclick = () => alert("🔒 Función Bloqueada: Debes adquirir el Pase Nivel 1.");
            }
        });
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

async function loadUserGames(isPractice) {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return;
    
    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        
        if(games.length === 0) { 
            container.innerHTML = "<p style='color:#666'>Dojo vacío.</p>"; return; 
        }

        container.innerHTML = games.map(g => `
            <div style="background:#111; border:1px solid #333; position:relative; cursor:pointer;" 
                 onclick="window.playGame('${g.embedUrl}', ${isPractice})">
                ${isPractice ? '<div style="position:absolute; top:5px; right:5px; background:#444; color:#fff; font-size:10px; padding:2px 5px;">PRÁCTICA</div>' : ''}
                <div style="height:120px; display:flex; align-items:center; justify-content:center; background:#000;">
                   <i class="fas fa-gamepad fa-3x gold-text"></i>
                </div>
                <h4 style="color:white; padding:10px; margin:0; font-size:0.9rem;">${g.title}</h4>
            </div>
        `).join('');
    } catch (e) {}
}

// === ACCIONES PRINCIPALES ===

// 1. Abrir Modal de Carga de Saldo (Lógica de bloqueo de niveles)
window.openLevelsModal = () => {
    const modal = document.getElementById('levelsModal');
    const select = document.getElementById('levelSelect');
    
    if(!modal || !select) return;

    // LÓGICA DE PROGRESIÓN ESTRICTA
    // Limpiamos opciones
    select.innerHTML = '';

    // Opción Nivel 1 (Siempre visible, pero seleccionable solo si es el siguiente paso)
    const opt1 = new Option("Nivel 1 - Bronce ($10)", "1");
    select.add(opt1);

    // Opción Nivel 2 (Bloqueado si no completó Nivel 1)
    const opt2 = new Option("🔒 Nivel 2 - Plata ($25)", "2");
    // Lógica futura: if(currentUser.level < 1) opt2.disabled = true;
    opt2.disabled = true; // Por ahora bloqueado estricto para nuevos
    select.add(opt2);

    // Opción Nivel 3
    const opt3 = new Option("🔒 Nivel 3 - Oro ($50)", "3");
    opt3.disabled = true; 
    select.add(opt3);

    // Seleccionar por defecto el 1
    select.value = "1";

    modal.style.display = 'flex';
};

// 2. ENVIAR AVISO (Corregido)
window.submitDeposit = async () => {
    const refInput = document.getElementById("depRef");
    const levelSelect = document.getElementById("levelSelect");
    
    // Obtenemos el valor limpio
    const ref = refInput.value.trim();
    if(!ref) return alert("❌ Debes pegar el ID de la transacción.");

    // Definimos monto según el nivel seleccionado
    let amount = 10;
    if(levelSelect.value === "2") amount = 25;
    if(levelSelect.value === "3") amount = 50;

    try {
        const res = await fetch(`${API_URL}/api/payments/deposit`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify({ 
                amount: amount, 
                referenceId: ref 
            })
        });
        
        const data = await res.json();

        if(res.ok) { 
            alert("✅ Aviso enviado con éxito.\n\nCuando el Shogun lo apruebe, verás tu saldo reflejado y podrás activar el Nivel."); 
            document.getElementById('levelsModal').style.display = 'none';
            refInput.value = ""; // Limpiar campo
        } else { 
            alert("⚠️ " + (data.message || data.error)); 
        }
    } catch (e) { 
        console.error(e);
        alert("❌ Error de conexión con el servidor."); 
    }
};

// 3. ACTIVAR NIVEL (Consumir saldo)
window.activateLevelWithBalance = async () => {
    if(!confirm("¿Usar $10 de saldo para iniciar el Ciclo?")) return;
    
    try {
        const res = await fetch(`${API_URL}/api/economy/entry`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify({ userId: currentUser._id, level: 1, amount: 10 })
        });

        const data = await res.json();
        if(res.ok) {
            alert("✅ ¡BIENVENIDO AL CLAN! Tu ciclo ha comenzado.");
            window.location.reload();
        } else {
            alert("⚠️ " + data.error);
        }
    } catch(e) { alert("Error de conexión"); }
};

// === CHAT FLOTANTE ===
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
            box.appendChild(div);
            box.scrollTop = box.scrollHeight;
        }
    });

    input?.addEventListener("keypress", (e) => {
        if(e.key === "Enter") {
            const txt = input.value.trim();
            if(txt) {
                socket.emit("chat message", { user: currentUser.ninjaName, text: txt });
                input.value = "";
            }
        }
    });
}

window.toggleChat = () => {
    const w = document.getElementById("chatWindow");
    w.style.display = (w.style.display === "none" || w.style.display === "") ? "flex" : "none";
};

// Helpers
window.playGame = (url, isPractice) => {
    const modal = document.getElementById('game-modal');
    const iframe = document.getElementById('game-frame');
    if(isPractice) {
        if(!confirm("⚠️ MODO PRÁCTICA: No sumarás puntos ni dinero real. ¿Continuar?")) return;
    }
    iframe.src = url;
    modal.style.display = 'flex';
};

window.logout = () => { localStorage.clear(); window.location.replace("login.html"); };
function formatMoney(amount) { return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function safeText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function initUI() {
    const btnMissions = document.getElementById("missionBtn");
    if(btnMissions) {
        btnMissions.onclick = (e) => {
            e.stopPropagation(); // Evitar click en la card
            alert("⏳ Misiones diarias pronto...");
        };
    }
}

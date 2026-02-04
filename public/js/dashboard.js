import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

// Configuración de la Nueva Economía (Debe coincidir con Backend)
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
    }
});

async function validateSession() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        // Obtenemos datos frescos del Ninja
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error("Sesión expirada");
        
        const userData = await res.json();
        
        // Si hay endpoint separado de wallet, lo unimos (opcional, por ahora usaremos userData)
        // const walletRes = await fetch(`${API_URL}/api/payments/wallet`...);
        
        currentUser = userData; // El backend ya devuelve balance, level, currentCycleAcc, etc.
        
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
    safeText("userTokens", currentUser.tournamentTokens || 0);
    
    // Código de Referido
    safeText("userRefCode", currentUser.referralCode || "Generando...");

    // Rango / Nivel
    const levelInfo = ECONOMY_CONFIG.LEVELS[currentUser.level];
    const rankText = levelInfo ? levelInfo.name : "👺 RONIN (Sin Clan)";
    safeText("userRank", rankText);

    // Balance disponible (Dinero real para retirar)
    const headerBal = document.getElementById("headerBalance");
    if(headerBal) headerBal.innerText = formatMoney(currentUser.balance);

    initDailyMissionBtn();
    applyAccessLogic();
    
    // Lógica vital de la barra de progreso
    updateCycleProgress();
}

// ==========================================
// 📊 LÓGICA DE BARRA Y CICLO (NUEVA ECONOMÍA)
// ==========================================
function updateCycleProgress() {
    const container = document.getElementById("cycleContainer");
    const buyAlert = document.getElementById("buyAlert");
    
    if(!container) return;

    // Verificamos si tiene un ciclo activo (Modelo nuevo: isActive & level > 0)
    if (currentUser.isActive && currentUser.level > 0) {
        if(buyAlert) buyAlert.style.display = "none";
        container.style.display = "block";

        const levelData = ECONOMY_CONFIG.LEVELS[currentUser.level];
        const goal = levelData.goal; // 30, 75 o 150
        const currentAcc = currentUser.currentCycleAcc || 0; // Lo que lleva acumulado en este ciclo

        // Cálculo de porcentaje
        let percent = (currentAcc / goal) * 100;
        if(percent > 100) percent = 100;

        // Actualizar DOM
        document.getElementById("cycleBar").style.width = `${percent}%`;
        safeText("cyclePercent", `${percent.toFixed(1)}%`);
        safeText("cycleEarnings", `${formatMoney(currentAcc)} / ${formatMoney(goal)}`);

        // Botón de Retiro (Solo si hay saldo en balance disponible)
        const harvestBtn = document.getElementById("harvestBtn");
        
        if (currentUser.balance >= 10) { // Mínimo de retiro
            harvestBtn.style.display = "block";
            harvestBtn.disabled = false;
            harvestBtn.innerText = `💸 RETIRAR SALDO (${formatMoney(currentUser.balance)})`;
            harvestBtn.onclick = () => window.doPayout(currentUser.balance);
        } else {
            harvestBtn.style.display = "none";
        }

    } else {
        // No tiene ciclo activo (O es nuevo, o terminó y debe recomprar)
        container.style.display = "none";
        if(buyAlert) {
            buyAlert.style.display = "block";
            if(currentUser.cycleCompleted) {
                buyAlert.innerHTML = `<h3>🏁 CICLO COMPLETADO</h3><p>Has conquistado la meta. <button onclick="openLevelsModal()" class="btn-ninja-primary">RECOMPRAR NIVEL</button></p>`;
            }
        }
    }
}

// ==========================================
// 💰 FUNCIONES DE PAGO Y NIVELES
// ==========================================

// Abrir modal de selección (Debes tener este HTML oculto en dashboard.html)
window.openLevelsModal = () => {
    const modal = document.getElementById('levelsModal'); // Asegúrate de tener este ID
    if(modal) modal.style.display = 'flex';
};

// Comprar Nivel (Llama al backend nuevo)
window.buyLevel = async (level) => {
    if(!confirm(`¿Deseas activar el Nivel ${level}?`)) return;

    const price = ECONOMY_CONFIG.LEVELS[level].entry;
    // Aquí podrías integrar lógica de Pasarela real o subir comprobante
    // Por ahora usamos el endpoint de "Entrada" que creamos
    
    // NOTA: En un flujo real, primero suben comprobante, admin aprueba, y se llama a esto.
    // O si es automático (saldo interno), se llama directo.
    
    try {
        const res = await fetch(`${API_URL}/api/economy/entry`, { // Asumiendo ruta
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify({ userId: currentUser._id, level: level, amount: price })
        });

        const data = await res.json();
        if(res.ok) {
            alert("✅ " + data.message);
            window.location.reload();
        } else {
            alert("⚠️ " + (data.error || "Error al procesar entrada"));
        }
    } catch (e) {
        console.error(e);
        alert("Error de conexión con la Tesorería.");
    }
};

// ==========================================
// 💬 CHAT SYSTEM
// ==========================================
function initChat() {
    if(typeof io === 'undefined') return console.error("Socket.io no cargado");
    
    socket = io(API_URL);
    const box = document.getElementById("chatMessages");

    socket.on("connect", () => console.log("Chat Conectado ID:", socket.id));

    socket.on("chat message", (msg) => {
        if(box) {
            const p = document.createElement("div");
            p.className = "chat-msg-entry"; // Clase CSS sugerida
            p.style.borderBottom = "1px solid #222"; 
            p.style.padding="5px 0";
            p.innerHTML = `<strong style="color:var(--gold)">${msg.user}:</strong> <span style="color:#ccc">${msg.text}</span>`;
            box.appendChild(p); 
            box.scrollTop = box.scrollHeight;
        }
    });

    window.sendChat = () => {
        const input = document.getElementById("chatMsg");
        const txt = input.value.trim();
        if(txt) { 
            socket.emit("chat message", { user: currentUser.ninjaName, text: txt }); 
            input.value = ""; 
        }
    };
    
    // Enviar con Enter
    document.getElementById("chatMsg")?.addEventListener("keypress", (e) => {
        if(e.key === "Enter") window.sendChat();
    });
}

// ==========================================
// 💸 RETIROS Y DEPÓSITOS
// ==========================================

// Enviar comprobante (Legacy / Manual)
window.submitDeposit = async () => {
    const amount = document.getElementById("depAmount").value;
    const ref = document.getElementById("depRef").value;
    
    if(!amount || !ref) return alert("Faltan datos.");

    try {
        const res = await fetch(`${API_URL}/api/payments/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount, referenceId: ref })
        });
        
        if(res.ok) { 
            alert("✅ Comprobante enviado al Shogun."); 
            document.getElementById('levelsModal').style.display = 'none';
        } else { 
            alert("⚠️ Error al enviar."); 
        }
    } catch (e) { alert("Error de conexión"); }
};

window.doPayout = async (amount) => {
    let alias = prompt(`Ingresa tu Alias/CBU/Wallet para retirar $${amount}:`);
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

// ==========================================
// 🛠️ UTILIDADES
// ==========================================
function initSocialMissionLogic() {
    const btnShare = document.getElementById("btnShare");
    if(!btnShare) return;
    btnShare.addEventListener("click", () => {
        window.open(`https://twitter.com/intent/tweet?text=Me uní al Clan AidFlow Ninja. Honor y Ganancias.`, '_blank');
        btnShare.disabled = true;
        // Simular validación
        setTimeout(() => {
            const btnVerify = document.getElementById("btnVerify");
            if(btnVerify) btnVerify.disabled = false;
        }, 3000);
    });
}

function initDailyMissionBtn() {
    const btn = document.getElementById("missionBtn");
    if(!btn) return;
    // Verificar si ya la hizo hoy (podrías guardar fecha en localStorage o verificar en user data)
    btn.onclick = async () => {
        const res = await fetch(`${API_URL}/api/missions/daily`, { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
        if(res.ok) { alert("🎁 Recompensa diaria recibida"); window.location.reload(); }
    };
}

async function loadUserGames() {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return;
    try {
        const res = await fetch(`${API_URL}/api/games`); // Endpoint público o auth
        const games = await res.json();
        if(!Array.isArray(games) || games.length === 0) { 
            container.innerHTML = "<p class='muted-text'>El Dojo de juegos está tranquilo hoy.</p>"; 
            return; 
        }
        container.innerHTML = games.map(g => `
            <div class="game-card-mini" onclick="window.playGame('${g.embedUrl}')">
                <div style="height:100px; background:#111; display:flex; align-items:center; justify-content:center;">
                   <i class="fas fa-gamepad fa-2x gold-text"></i>
                </div>
                <h4 style="color:white; padding:5px;">${g.title}</h4>
            </div>
        `).join('');
    } catch (e) { console.log("Sin conexión a juegos"); }
}

function initDuelArena() {
    if(socket) socket.on("newDuelAvailable", (d) => { 
        // Mostrar notificación tostada o actualizar lista
        console.log("Nuevo duelo disponible:", d);
    });
}

// Helpers Globales
window.playGame = (url) => window.open(url, '_blank'); // O usar el modal iframe que tenías
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
function setupEventListeners() { document.getElementById("menuProfile")?.addEventListener("click", ()=>alert("Perfil en construcción")); }

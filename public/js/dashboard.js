import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

// ==========================================
// 1. INICIALIZACIÓN BLINDADA & PRO
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Validar Sesión
    await validateSession();

    // 2. Configurar Botones del Menú y Chat (NUEVO)
    setupEventListeners();
    
    // 3. Inicializar Misiones (Diaria + Social)
    initSocialMissionLogic();
});

async function validateSession() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        console.log("📡 Conectando al Comando Central...");
        const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Sesión inválida");
        
        currentUser = await res.json();
        
        // Renderizado Seguro PRO
        renderUserInterface();
        loadUserGames(); 
        initChat();      

        const loader = document.getElementById("loadingScreen");
        if(loader) loader.style.display = "none";

    } catch (error) {
        console.error("Error sesión:", error);
        localStorage.clear();
        window.location.replace("login.html");
    }
}

// Renderizado Visual Mejorado
function renderUserInterface() {
    // Datos Básicos
    safeText("sideName", currentUser.ninjaName);
    
    const badge = document.getElementById("sideLevelBadge");
    if(badge) {
        badge.innerText = currentUser.level > 0 ? `RANGO ${currentUser.level}` : "RONIN";
        badge.className = currentUser.level > 0 ? "badge badge-master" : "badge";
    }
    
    // 🔥 FIX: BALANCE Y POZOS EN $0.00
    // Si el backend no envía daoBalance o poolBalance, mostramos $0.00
    safeText("headerBalance", formatMoney(currentUser.balance));
    safeText("daoFund", formatMoney(currentUser.daoBalance || 0));   
    safeText("prizePool", formatMoney(currentUser.poolBalance || 0));

    // Estado del botón de misión diaria
    initDailyMissionBtn();
    
    // Lógica de acceso a secciones
    applyAccessLogic();
}

// Helper para dinero (Esto hace que se vea $0.00 en vez de --)
function formatMoney(amount) {
    return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function safeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// ==========================================
// 2. CONFIGURACIÓN DE BOTONES & CHAT (LISTENERS)
// ==========================================
function setupEventListeners() {
    // Chat Flotante
    const chatBtn = document.getElementById("toggleChatBtn");
    const chatWin = document.getElementById("chatWindow");
    const closeChat = document.getElementById("closeChatBtn");

    if(chatBtn && chatWin) {
        chatBtn.addEventListener("click", () => {
            chatWin.style.display = chatWin.style.display === "flex" ? "none" : "flex";
            chatBtn.style.display = "none"; // Ocultar botón flotante al abrir
        });
    }

    if(closeChat && chatWin && chatBtn) {
        closeChat.addEventListener("click", () => {
            chatWin.style.display = "none";
            chatBtn.style.display = "flex"; // Mostrar botón flotante al cerrar
        });
    }

    // Menú Lateral (Botones Separados)
    document.getElementById("menuProfile")?.addEventListener("click", () => alert("🚧 Perfil de Ninja en construcción"));
    document.getElementById("menuWithdraw")?.addEventListener("click", procesarRetiro);
    
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
        localStorage.clear();
        window.location.href = "login.html";
    });
}

// ==========================================
// 3. LÓGICA DE MISIÓN SOCIAL (EL TRUCO)
// ==========================================
function initSocialMissionLogic() {
    const btnShare = document.getElementById("btnShare");
    const btnVerify = document.getElementById("btnVerify");
    const btnClaim = document.getElementById("btnClaimSocial");
    const statusTxt = document.getElementById("socialStatus");

    if(!btnShare) return; // Si no existe el elemento, salimos

    // PASO 1: COMPARTIR
    btnShare.addEventListener("click", () => {
        const text = "Únete a mi clan en AidFlow y gana cripto jugando. 🥋";
        const url = window.location.origin; 
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`;
        
        window.open(shareUrl, '_blank');
        
        // Actualizar UI
        btnShare.classList.remove("active");
        btnShare.innerText = "✅ HECHO";
        if(statusTxt) {
            statusTxt.innerText = "⏳ Sistema detectando señal...";
            statusTxt.className = "blinking";
        }
        
        // Habilitar Verificar tras 3 segundos (Simulación)
        setTimeout(() => {
            if(btnVerify) {
                btnVerify.classList.add("active");
                btnVerify.disabled = false;
            }
            if(statusTxt) statusTxt.innerText = "📡 Enlace listo para escanear.";
        }, 3000);
    });

    // PASO 2: VERIFICAR (Simulado)
    if(btnVerify) {
        btnVerify.addEventListener("click", () => {
            if(!btnVerify.classList.contains("active")) return;
            
            btnVerify.innerText = "ESCANENDO...";
            
            setTimeout(() => {
                btnVerify.classList.remove("active");
                btnVerify.innerText = "✅ VERIFICADO";
                
                // Habilitar Reclamar
                if(btnClaim) {
                    btnClaim.classList.add("active");
                    btnClaim.classList.add("gold-btn"); 
                    btnClaim.disabled = false;
                }
                if(statusTxt) statusTxt.innerText = "💰 Recompensa desbloqueada.";
            }, 2000);
        });
    }

    // PASO 3: RECLAMAR (Simulación de Pago)
    if(btnClaim) {
        btnClaim.addEventListener("click", async () => {
            if(!btnClaim.classList.contains("active")) return;

            btnClaim.innerText = "PROCESANDO...";
            
            try {
                // Aquí simulamos el pago visualmente
                alert("🏆 ¡Misión Cumplida! +$0.10 Acreditados (Simulación)");
                
                // UI Final
                btnClaim.innerText = "RECLAMADO";
                btnClaim.classList.remove("active");
                btnClaim.classList.add("completed");
                
                // Actualizar saldo visualmente 
                const bal = document.getElementById("headerBalance");
                if(bal) {
                    // Limpiamos el string "$123.45" para sumar
                    let current = parseFloat(bal.innerText.replace(/[^0-9.-]+/g,""));
                    bal.innerText = formatMoney(current + 0.10);
                }

            } catch (e) {
                alert("Error de conexión");
            }
        });
    }
}

// ==========================================
// 4. LÓGICA CLÁSICA (Juegos, Niveles, Mision Diaria)
// ==========================================

// Misión Diaria
function initDailyMissionBtn() {
    const btn = document.getElementById("missionBtn");
    if(!btn) return;
    
    const lastClaim = currentUser.lastDailyClaim ? new Date(currentUser.lastDailyClaim) : new Date(0);
    const diffHours = (new Date() - lastClaim) / (1000 * 60 * 60);

    if(diffHours < 24) {
        btn.innerText = "✅ VUELVE MAÑANA";
        btn.disabled = true;
        btn.style.opacity = "0.5";
    } else {
        btn.innerText = "RECLAMAR SUMINISTROS";
        btn.onclick = claimDailyMission;
    }
}

async function claimDailyMission() {
    const btn = document.getElementById("missionBtn");
    btn.innerText = "⏳ ...";
    try {
        const res = await fetch(`${API_URL}/api/missions/daily`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();
        if(res.ok) {
            alert(data.message);
            safeText("headerBalance", formatMoney(data.newBalance));
            btn.innerText = "✅ COMPLETADO";
            btn.disabled = true;
        } else {
            alert(data.error);
            btn.innerText = "REINTENTAR";
        }
    } catch(e) { btn.innerText = "ERROR RED"; }
}

// Carga de Juegos
async function loadUserGames() {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return;

    try {
        const res = await fetch(`${API_URL}/api/games`);
        // Si hay error o no es OK, manejamos silenciosamente o mostramos vacío
        if(!res.ok) {
             container.innerHTML = "<p class='muted-text'>Dojo desconectado.</p>";
             return;
        }
        
        const games = await res.json();
        
        if(games.length === 0) {
            container.innerHTML = "<p class='muted-text'>No hay simulaciones activas.</p>";
            return;
        }

        container.innerHTML = games.map(g => {
            let thumb = g.thumbnail.startsWith('http') ? g.thumbnail : `${API_URL}/${g.thumbnail}`;
            let url = g.embedUrl.startsWith('http') ? g.embedUrl : `${API_URL}/${g.embedUrl}`;
            return `
            <div class="game-card" onclick="window.playGame('${url}')">
                <div class="thumb-wrapper">
                    <img src="${thumb}" alt="${g.title}" onerror="this.src='https://via.placeholder.com/300x200?text=Game'">
                </div>
                <div class="info">
                    <h4>${g.title}</h4>
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.error("Error juegos", e); }
}

// Chat (Socket.io)
function initChat() {
    if(typeof io === 'undefined') return;
    socket = io(API_URL);
    
    const input = document.getElementById("chatInput");
    const send = document.getElementById("sendChatBtn");
    const box = document.getElementById("chatMessages");

    if(!box) return;

    socket.on("chat message", (msg) => {
        const p = document.createElement("div");
        p.style.padding = "5px 0";
        p.style.borderBottom = "1px solid #222";
        p.innerHTML = `<strong style="color:var(--gold)">${msg.user}:</strong> <span style="color:#ddd">${msg.text}</span>`;
        box.appendChild(p);
        box.scrollTop = box.scrollHeight;
    });

    if(send && input) {
        send.onclick = () => {
            const txt = input.value.trim();
            if(txt) {
                socket.emit("chat message", { user: currentUser.ninjaName, text: txt });
                input.value = "";
            }
        };
    }
}

// Lógica de Acceso (Pase Ninja)
function applyAccessLogic() {
    const cycleContainer = document.getElementById("cycleContainer"); // Asegúrate de tener este ID en el HTML nuevo si lo usas
    // En el diseño PRO nuevo quizás no usamos 'cycleContainer' igual, 
    // pero mantenemos la lógica por si acaso.
}

// Funciones Globales para el HTML
window.openLevelModal = () => { 
    const m = document.getElementById("levelModal");
    if(m) { m.style.display = "flex"; renderLevelButtons(); }
};
window.closeLevelModal = () => { 
    const m = document.getElementById("levelModal");
    if(m) m.style.display = "none"; 
};
window.playGame = (url) => { 
    // Asegúrate de tener el modal de juego en tu HTML
    const modal = document.getElementById('game-modal'); // Revisa si tu ID es 'gameModal' o 'game-modal'
    const iframe = document.getElementById('game-frame');
    if(modal && iframe) {
        iframe.src = url;
        modal.style.display = 'flex';
    } else {
        alert("Abriendo juego: " + url);
    }
};

window.procesarRetiro = () => { alert("Sistema de retiro en mantenimiento por el Tesorero."); }

// Lógica de Niveles (Modal)
function renderLevelButtons() {
    const container = document.getElementById("levelButtonsContainer"); 
    // O busca por querySelector si usaste otro ID en el HTML
    // const container = document.querySelector("#levelModal .modal-content");
    
    if(!container) return;
    
    container.innerHTML = "<h3>SELECCIONA TU CAMINO</h3>";
    
    const currentLevel = currentUser.level || 0;
    const cyclePercent = currentUser.cyclePercent || 0;
    const isCompleted = cyclePercent >= 100;

    let html = '<div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">';

    // Botón Nivel 1
    if(currentLevel === 0) {
        html += `<button class="btn-submit" onclick="selectLevel(1)">FORJAR NIVEL 1 ($10)</button>`;
        html += `<button class="btn-disabled" disabled>🔒 NIVEL 2</button>`;
    } else if (currentLevel === 1) {
        if(isCompleted) {
             html += `<button class="btn-submit" onclick="selectLevel(1)">♻️ REPETIR NIVEL 1</button>`;
             html += `<button class="btn-submit gold-btn" onclick="selectLevel(2)">🔥 NIVEL 2 ($20)</button>`;
        } else {
             html += `<p style="color:#aaa">Completa el ciclo actual para avanzar.</p>`;
        }
    }
    // ... más niveles ...
    html += '</div>';
    
    container.innerHTML += html;
}

window.selectLevel = async (lvl) => {
    if(!confirm(`¿Comprar Nivel ${lvl}?`)) return;
    try {
        const res = await fetch(`${API_URL}/api/cycles/start`, { 
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ level: lvl })
        });
        const data = await res.json();
        alert(data.message || data.error);
        window.location.reload();
    } catch(e) { alert("Error"); }
};
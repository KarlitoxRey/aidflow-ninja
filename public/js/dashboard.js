import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

// ==========================================
// 1. INICIALIZACIÓN BLINDADA
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    await validateSession();
    setupEventListeners();
    initSocialMissionLogic();
});

async function validateSession() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Sesión inválida");
        
        currentUser = await res.json();
        
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

function renderUserInterface() {
    safeText("sideName", currentUser.ninjaName);
    
    // Rango
    const badge = document.getElementById("sideLevelBadge");
    if(badge) {
        badge.innerText = currentUser.level > 0 ? `RANGO ${currentUser.level}` : "RONIN";
        badge.className = currentUser.level > 0 ? "badge badge-master" : "badge";
    }
    
    // Balances
    safeText("headerBalance", formatMoney(currentUser.balance));
    
    // 🔥 NUEVA LÍNEA: Mostrar Fichas
    // Si no tiene fichas (undefined), mostramos 0
    safeText("tokenBalance", currentUser.tournamentTokens || 0); 

    safeText("daoFund", formatMoney(currentUser.daoBalance || 0));   
    safeText("prizePool", formatMoney(currentUser.poolBalance || 0));

    initDailyMissionBtn();
    applyAccessLogic();
}

function formatMoney(amount) {
    return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function safeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// ==========================================
// 2. LISTENERS DE INTERFAZ
// ==========================================
function setupEventListeners() {
    const chatBtn = document.getElementById("toggleChatBtn");
    const chatWin = document.getElementById("chatWindow");
    const closeChat = document.getElementById("closeChatBtn");

    if(chatBtn && chatWin) {
        chatBtn.onclick = () => {
            chatWin.style.display = chatWin.style.display === "flex" ? "none" : "flex";
            chatBtn.style.display = chatWin.style.display === "flex" ? "none" : "flex";
        };
    }

    if(closeChat && chatWin && chatBtn) {
        closeChat.onclick = () => {
            chatWin.style.display = "none";
            chatBtn.style.display = "flex";
        };
    }

    // FIX: Referenciando funciones globales correctamente
    document.getElementById("menuProfile")?.addEventListener("click", () => alert("🚧 Perfil de Ninja en construcción"));
    document.getElementById("menuWithdraw")?.addEventListener("click", () => window.procesarRetiro());
    
    // FIX LOGOUT: Siempre limpia y va al index real (Home)
    document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.replace("index.html");
    });
}

// ==========================================
// 3. LÓGICA DE MISIÓN SOCIAL
// ==========================================
function initSocialMissionLogic() {
    const btnShare = document.getElementById("btnShare");
    const btnVerify = document.getElementById("btnVerify");
    const btnClaim = document.getElementById("btnClaimSocial");
    const statusTxt = document.getElementById("socialStatus");

    if(!btnShare) return;

    btnShare.addEventListener("click", () => {
        const text = "Únete a mi clan en AidFlow y gana cripto jugando. 🥋";
        const url = window.location.origin; 
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`;
        
        window.open(shareUrl, '_blank');
        
        btnShare.classList.remove("active");
        btnShare.innerText = "✅ HECHO";
        if(statusTxt) {
            statusTxt.innerText = "⏳ Sistema detectando señal...";
            statusTxt.className = "blinking";
        }
        
        setTimeout(() => {
            if(btnVerify) {
                btnVerify.classList.add("active");
                btnVerify.disabled = false;
            }
            if(statusTxt) statusTxt.innerText = "📡 Enlace listo para escanear.";
        }, 3000);
    });

    if(btnVerify) {
        btnVerify.addEventListener("click", () => {
            if(!btnVerify.classList.contains("active")) return;
            btnVerify.innerText = "ESCANENDO...";
            setTimeout(() => {
                btnVerify.classList.remove("active");
                btnVerify.innerText = "✅ VERIFICADO";
                if(btnClaim) {
                    btnClaim.classList.add("active");
                    btnClaim.disabled = false;
                }
                if(statusTxt) statusTxt.innerText = "💰 Recompensa desbloqueada.";
            }, 2000);
        });
    }

    if(btnClaim) {
        btnClaim.addEventListener("click", async () => {
            if(!btnClaim.classList.contains("active")) return;
            btnClaim.innerText = "PROCESANDO...";
            try {
                alert("🏆 ¡Misión Cumplida! +$0.10 Acreditados");
                btnClaim.innerText = "RECLAMADO";
                btnClaim.classList.remove("active");
                btnClaim.classList.add("completed");
                
                const bal = document.getElementById("headerBalance");
                if(bal) {
                    let current = parseFloat(bal.innerText.replace(/[^0-9.-]+/g,""));
                    bal.innerText = formatMoney(current + 0.10);
                }
            } catch (e) { alert("Error de conexión"); }
        });
    }
}

// ==========================================
// 4. MISION DIARIA Y JUEGOS
// ==========================================
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

async function loadUserGames() {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return;

    try {
        const res = await fetch(`${API_URL}/api/games`);
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
            <div class="mission-card game-card" style="cursor:pointer; border-left-color:#ffb703; padding: 15px; margin-bottom: 10px;" onclick="window.playGame('${url}')">
                <div class="thumb-wrapper" style="width:100%; height:100px; overflow:hidden; border-radius:4px;">
                    <img src="${thumb}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://via.placeholder.com/300x200?text=Game'">
                </div>
                <h4 style="margin:10px 0 0 0; color:#ffb703; font-family:'Orbitron'; font-size:0.9rem;">${g.title}</h4>
            </div>`;
        }).join('');
    } catch (e) { console.error("Error juegos", e); }
}

// ==========================================
// 5. CHAT Y NIVELES
// ==========================================
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
        p.innerHTML = `<strong style="color:#ffb703">${msg.user}:</strong> <span style="color:#ddd">${msg.text}</span>`;
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

function applyAccessLogic() {
    // Espacio para lógica futura
}

// FUNCIONES GLOBALES (Sincronizadas con app.js)
window.openLevelModal = () => { 
    const m = document.getElementById("levelModal");
    if(m) { m.style.display = "flex"; renderLevelButtons(); }
};

window.closeLevelModal = () => { 
    const m = document.getElementById("levelModal");
    if(m) m.style.display = "none"; 
};

window.playGame = (url) => { 
    const modal = document.getElementById('game-modal');
    const iframe = document.getElementById('game-frame');
    if(modal && iframe) {
        iframe.src = url;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        alert("Abriendo juego: " + url);
    }
};

window.closeGame = () => {
    const modal = document.getElementById('game-modal');
    const iframe = document.getElementById('game-frame');
    if(modal && iframe) {
        iframe.src = '';
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

window.procesarRetiro = () => { alert("Sistema de retiro en mantenimiento por el Tesorero."); }

function renderLevelButtons() {
    const container = document.getElementById("levelButtonsContainer"); 
    if(!container) return;
    container.innerHTML = "<h3>SELECCIONA TU CAMINO</h3>";
    
    const currentLevel = currentUser.level || 0;
    const cyclePercent = currentUser.cyclePercent || 0;
    const isCompleted = cyclePercent >= 100;

    let html = '<div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">';

    if(currentLevel === 0) {
        html += `<button class="btn-ninja-primary" onclick="selectLevel(1)">FORJAR NIVEL 1 ($10)</button>`;
    } else if (currentLevel === 1) {
        if(isCompleted) {
             html += `<button class="btn-ninja-primary" onclick="selectLevel(1)">♻️ REPETIR NIVEL 1</button>`;
             html += `<button class="btn-ninja-outline" onclick="selectLevel(2)">🔥 NIVEL 2 ($20)</button>`;
        } else {
             html += `<p style="color:#aaa">Completa el ciclo actual (${cyclePercent}%) para avanzar.</p>`;
        }
    }
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
    } catch(e) { alert("Error al conectar con el servidor."); }
};

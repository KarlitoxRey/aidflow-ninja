import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    window.addEventListener("message", handleGameMessage);
    await validateSession();
});

async function validateSession() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        console.log("📡 Conectando con el Templo...");
        const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            // Si el servidor dice 401/404, ahí sí es error real
            throw new Error("Sesión inválida o expirada");
        }
        
        currentUser = await res.json();
        console.log("✅ Ninja identificado:", currentUser.ninjaName);
        
        // 🛡️ RENDER SEGURO: Si falla algo visual, NO te saca del panel
        try {
            renderUserHeader();
            applyAccessLogic();
            initMissionLogic();
        } catch (renderError) {
            console.warn("⚠️ Error visual (No crítico):", renderError);
        }

        loadUserGames(); 
        initChat();      
        
        const loader = document.getElementById("loadingScreen");
        if(loader) loader.style.display = "none";

    } catch (error) {
        console.error("❌ Error FATAL de sesión:", error);
        localStorage.clear();
        window.location.replace("login.html");
    }
}

// ==========================================
// 2. SISTEMA DE JUEGOS & RANKING
// ==========================================
async function handleGameMessage(event) {
    if (!event.data || event.data.type !== "GAME_OVER") return;
    const { score } = event.data;
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const res = await fetch(`${API_URL}/api/games/score`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ score, gameId: 'aidflow-arena' })
        });
        const data = await res.json();
        if (res.ok) {
            const balanceEl = document.getElementById("headerBalance");
            if(balanceEl && data.newBalance !== undefined) {
                balanceEl.innerText = Number(data.newBalance).toFixed(2);
            }
            alert(`🏆 COMBATE REGISTRADO: ${score} Pts`);
        }
    } catch (error) { console.error(error); }
}

async function loadUserGames() {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return; // Si no existe el div en el HTML, salimos

    container.innerHTML = "<p class='blink'>📡 Buscando juegos en el Dojo...</p>";

    try {
        const res = await fetch(`${API_URL}/api/games`);
        if(!res.ok) {
            container.innerHTML = "<p class='error-text'>⚠️ Error conectando con la Arena.</p>";
            return;
        }
        
        const games = await res.json();
        console.log("🎮 Juegos encontrados:", games); // MIRA LA CONSOLA (F12)

        if(games.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding: 20px; border: 1px dashed #444;">
                    <i class="fas fa-ghost" style="font-size: 2rem; color: #666;"></i>
                    <p class="muted-text">La Arena está vacía.<br>Dile a Splinter que agregue juegos a la DB.</p>
                </div>`;
            return;
        }

        // Renderizado
        container.innerHTML = games.map(g => {
            // Aseguramos que la imagen tenga ruta completa si es local
            let cleanThumb = g.thumbnail.startsWith('http') ? g.thumbnail : `${API_URL}/${g.thumbnail}`;
            // Aseguramos que la URL del juego sea correcta
            let cleanUrl = g.embedUrl.startsWith('http') ? g.embedUrl : `${API_URL}/${g.embedUrl}`;
            
            return `
            <div class="game-card shadow-glow" onclick="playGame('${cleanUrl}')">
                <div class="thumb-wrapper">
                    <img src="${cleanThumb}" alt="${g.title}" onerror="this.src='https://via.placeholder.com/300x200?text=NinjaGame'">
                </div>
                <div class="info">
                    <h4>${g.title}</h4>
                    <span class="play-btn">JUGAR ▶</span>
                </div>
            </div>`;
        }).join('');

    } catch (error) { 
        console.error("Error cargando juegos", error);
        container.innerHTML = "<p class='error-text'>🚫 Error de red al cargar juegos.</p>";
    }
}

// ==========================================
// 3. LOGICA DE CICLOS Y NIVELES
// ==========================================
// ==========================================
// LÓGICA DE NIVELES INTELIGENTE (Progresiva)
// ==========================================

window.openLevelModal = () => {
    const modal = document.getElementById("levelModal");
    if(modal) {
        modal.style.display = "flex";
        renderLevelButtons(); // 👇 AQUÍ LLAMAMOS A LA NUEVA LÓGICA
    }
};

function renderLevelButtons() {
    // Buscamos el contenedor donde van los botones dentro del modal
    // Asegúrate de tener un <div id="levelOptions"></div> o similar en tu HTML del modal
    // Si no tienes ID, usamos querySelector para buscar el contenedor de botones
    const container = document.querySelector("#levelModal .modal-body") || document.querySelector("#levelModal .content"); 
    
    if (!container) return;

    // Limpiamos lo que haya antes
    container.innerHTML = "<h3>SELECCIONA TU CAMINO</h3>";

    const currentLevel = currentUser.level || 0; // 0 = Ronin
    const cyclePercent = currentUser.cyclePercent || 0;
    const isCompleted = cyclePercent >= 100;

    // CREAMOS LOS BOTONES DINÁMICAMENTE
    let buttonsHTML = '<div class="levels-grid" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">';

    // --- LÓGICA NIVEL 1 ---
    if (currentLevel === 0) {
        // Usuario nuevo: Solo puede comprar Nivel 1
        buttonsHTML += createBtn(1, "FORJAR PASE NIVEL 1 ($10)", true);
        buttonsHTML += createBtn(2, "NIVEL 2 (BLOQUEADO)", false);
        buttonsHTML += createBtn(3, "NIVEL 3 (BLOQUEADO)", false);
    } 
    else if (currentLevel === 1) {
        if (isCompleted) {
            // Completó Nivel 1: Puede Repetir Nivel 1 O Avanzar a Nivel 2
            buttonsHTML += createBtn(1, "♻️ REPETIR NIVEL 1", true);
            buttonsHTML += createBtn(2, "🔥 ASCENDER A NIVEL 2 ($20)", true, "gold-btn");
        } else {
            // Está cursando Nivel 1: No puede comprar nada
            buttonsHTML += `<p class="info-text">⚠️ Debes completar tu ciclo actual (${Math.floor(cyclePercent)}%) para adquirir nuevos pases.</p>`;
        }
    }
    else if (currentLevel === 2) {
        if (isCompleted) {
            // Completó Nivel 2: Puede Repetir Nivel 2 O Avanzar a Nivel 3
            buttonsHTML += createBtn(2, "♻️ REPETIR NIVEL 2", true);
            buttonsHTML += createBtn(3, "🐉 ASCENDER A NIVEL 3 ($50)", true, "blood-btn");
        } else {
             buttonsHTML += `<p class="info-text">Completa tu entrenamiento de Nivel 2 para avanzar.</p>`;
        }
    }
    else if (currentLevel >= 3) {
        if (isCompleted) {
             buttonsHTML += createBtn(3, "♻️ REPETIR NIVEL 3 (MÁXIMO)", true, "blood-btn");
        } else {
             buttonsHTML += `<p class="info-text">Estás en la cima. Completa el ciclo.</p>`;
        }
    }

    buttonsHTML += '</div>';
    buttonsHTML += '<button onclick="closeLevelModal()" class="btn-close" style="margin-top:20px;">CANCELAR</button>';
    
    container.innerHTML = buttonsHTML;
}

// Función auxiliar para crear el HTML del botón bonito
function createBtn(level, text, active, extraClass = "") {
    if (!active) {
        return `<button class="btn-disabled" disabled style="opacity: 0.5; cursor: not-allowed;">🔒 NIVEL ${level}</button>`;
    }
    // La clase puede ser 'btn-ninja' o la que uses en tu CSS
    return `<button class="btn-submit ${extraClass}" onclick="selectLevel(${level})" style="margin:5px;">${text}</button>`;
}
// ==========================================
// 4. MISIONES Y UI (Blindado)
// ==========================================
function initMissionLogic() {
    const missionBtn = document.getElementById("missionBtn");
    if(!currentUser || !missionBtn) return;

    const lastClaim = currentUser.lastDailyClaim ? new Date(currentUser.lastDailyClaim) : new Date(0);
    const diffHours = (new Date() - lastClaim) / (1000 * 60 * 60);

    if (diffHours < 24) {
        missionBtn.disabled = true;
        missionBtn.innerText = "✅ RECOMPENSA RECLAMADA";
        missionBtn.classList.add("btn-disabled");
    } else {
        missionBtn.disabled = false;
        missionBtn.innerText = "⚔️ MISIÓN DIARIA";
        missionBtn.onclick = claimMission;
    }
}

async function claimMission() {
    const btn = document.getElementById("missionBtn");
    if(btn) {
        btn.innerText = "⏳ ...";
        btn.disabled = true;
    }
    try {
        const res = await fetch(`${API_URL}/api/missions/daily`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            const bal = document.getElementById("headerBalance");
            if(bal) bal.innerText = Number(data.newBalance).toFixed(2);
            if(btn) btn.innerText = "✅ COMPLETADO";
        } else {
            alert(data.error || "Error");
            if(btn) {
                btn.disabled = false;
                btn.innerText = "⚔️ REINTENTAR";
            }
        }
    } catch (e) { if(btn) btn.disabled = false; }
}

function renderUserHeader() {
    // 🛡️ Usamos ayudantes seguros para no romper si falta un ID
    setText("sideName", currentUser.ninjaName);
    setText("headerBalance", Number(currentUser.balance || 0).toFixed(2));
    
    const badge = document.getElementById("sideLevelBadge");
    if (badge) {
        if (currentUser.level > 0) {
            badge.innerText = `RANGO: ${currentUser.level}`;
            badge.className = "badge badge-master";
        } else {
            badge.innerText = "RONIN";
        }
    }
    
    // Stats
    const stats = currentUser.referralStats || {};
    setText("myReferrals", stats.count || 0);
    setText("referralEarnings", Number(stats.earnings || 0).toFixed(2));
}

function applyAccessLogic() {
    const cycleContainer = document.getElementById("cycleContainer");
    const promoBanner = document.getElementById("promoBanner");

    if (!currentUser.hasNinjaPass || currentUser.level === 0) {
        if(cycleContainer) cycleContainer.style.display = "none";
        if(promoBanner) promoBanner.style.display = "block"; 
    } else {
        if(cycleContainer) cycleContainer.style.display = "block";
        if(promoBanner) promoBanner.style.display = "none";
        renderCycleProgress();
    }
}

function renderCycleProgress() {
    const percent = currentUser.cyclePercent || 0;
    const claimed = currentUser.claimedMilestones || [];
    
    const track = document.getElementById("trackFill");
    if(track) track.style.width = `${percent}%`;
    
    setText("cyclePercentText", `${Math.floor(percent)}%`);

    [25, 50, 75, 100].forEach(p => {
        const cp = document.getElementById(`cp${p}`);
        if(cp) {
            if (percent >= p) cp.classList.add("active");
            if (claimed.includes(p)) cp.classList.add("claimed");
        }
    });
    updateWithdrawButton(percent, claimed);
}

function updateWithdrawButton(percent, claimed) {
    const btn = document.getElementById("btnRetiro");
    if(!btn) return;

    let nextMilestone = 0;
    if (percent >= 25 && !claimed.includes(25)) nextMilestone = 25;
    else if (percent >= 50 && !claimed.includes(50)) nextMilestone = 50;
    else if (percent >= 75 && !claimed.includes(75)) nextMilestone = 75;
    else if (percent >= 100 && !claimed.includes(100)) nextMilestone = 100;

    if (nextMilestone > 0) {
        btn.className = "btn-ninja-primary";
        btn.innerText = `RETIRAR TRAMO ${nextMilestone}%`;
        btn.disabled = false;
        btn.onclick = procesarRetiro;
    } else {
        btn.className = "btn-ninja-outline";
        btn.innerText = "RETIRO BLOQUEADO 🔒";
        btn.disabled = true;
    }
}

// ==========================================
// 5. FUNCIONES GLOBALES & AYUDANTES
// ==========================================
function setText(id, text) {
    const el = document.getElementById(id);
    if(el) el.innerText = text;
}

window.procesarRetiro = async () => {
    if(!confirm("¿Retirar ganancias?")) return;
    const btn = document.getElementById("btnRetiro");
    if(btn) btn.innerText = "PROCESANDO...";
    try {
        const res = await fetch(`${API_URL}/api/payments/withdraw`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();
        alert(data.message);
        window.location.reload();
    } catch (e) { alert("Error de red"); }
};

window.copyReferralLink = function() {
    if (!currentUser?.referralCode) return alert("⚠️ Necesitas un Pase Ninja.");
    const link = `${window.location.origin}/register.html?ref=${currentUser.referralCode}`;
    navigator.clipboard.writeText(link).then(() => alert("🔗 Copiado: " + link));
};

window.playGame = (url) => {
    const modal = document.getElementById('game-modal');
    const iframe = document.getElementById('game-frame');
    if(modal && iframe) {
        iframe.src = url; 
        modal.style.display = 'flex'; 
        modal.classList.remove('hidden');
    }
};

window.closeGame = () => {
    const modal = document.getElementById('game-modal');
    const iframe = document.getElementById('game-frame');
    if(iframe) iframe.src = '';
    if(modal) modal.style.display = 'none';
};

// Chat Socket
function initChat() {
    if(typeof io === 'undefined') return;
    socket = io(API_URL); 
    const chatInput = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendChatBtn");
    const chatBox = document.getElementById("chatMessages");

    if(!chatBox) return; // Si no hay chat, no hacemos nada

    socket.on("chat message", (msg) => {
        const div = document.createElement("div");
        div.className = "chat-msg";
        div.innerHTML = `<strong class="gold-text">${msg.user}:</strong> <span class="white-text">${msg.text}</span>`;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    if(sendBtn && chatInput) {
        sendBtn.onclick = () => {
            const text = chatInput.value.trim();
            if (text && currentUser) {
                socket.emit("chat message", { user: currentUser.ninjaName, text });
                chatInput.value = "";
            }
        };
    }
}

document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.replace("login.html");
});
import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

// Elementos DOM cacheados
const missionBtn = document.getElementById("missionBtn");
const missionTimer = document.getElementById("missionTimer");

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    initGameListener(); // 👂 Activamos la escucha del SDK del juego
    await validateSession();
});

async function validateSession() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.replace("login.html");

    try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Sesión expirada");
        
        currentUser = await res.json();
        
        // Renderizar componentes
        renderUserHeader();
        applyAccessLogic();
        
        // Iniciar subsistemas
        initMissionLogic();
        loadUserGames(); 
        initChat();      
        
        document.getElementById("loadingScreen").style.display = "none";

    } catch (error) {
        console.error("Error de sesión:", error);
        localStorage.clear();
        window.location.replace("login.html");
    }
}

// ==========================================
// 2. SISTEMA DE JUEGOS & RANKING
// ==========================================

// 📡 ESCUCHA DE EVENTOS (SDK BRIDGE)
function initGameListener() {
    window.addEventListener("message", async (event) => {
        // 1. Seguridad: Solo aceptamos eventos de tipo GAME_OVER
        if (!event.data || event.data.type !== "GAME_OVER") return;

        const { score } = event.data;
        const token = localStorage.getItem("token");

        if (!token) return console.warn("🚫 Intento de guardar puntaje sin sesión.");

        console.log("🥷 Recibido del Dojo:", score);

        try {
            // 2. Enviamos al Templo (Backend)
            const res = await fetch(`${API_URL}/api/games/score`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    score: score,
                    gameId: 'aidflow-arena' // ID fijo o dinámico según el juego
                })
            });

            const data = await res.json();

            if (res.ok) {
                // 3. Feedback al Guerrero
                // Si el backend devuelve nuevo saldo (recompensa por jugar), actualizamos
                if(data.newBalance !== undefined) {
                    document.getElementById("headerBalance").innerText = data.newBalance.toFixed(2);
                }
                
                alert(`🏆 COMBATE REGISTRADO\nPuntaje: ${score}\n${data.message || ''}`);
                
                // Opcional: Recargar ranking si existiera esa función
                // loadRanking(); 
            } else {
                console.warn("⚠️ El Dojo rechazó el puntaje:", data.message);
            }
        } catch (error) {
            console.error("❌ Error de conexión al guardar Score:", error);
        }
    });
}

async function loadUserGames() {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return;

    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();

        if(games.length === 0) {
            container.innerHTML = "<p class='muted-text'>No hay juegos disponibles aún.</p>";
            return;
        }

        container.innerHTML = games.map(g => {
            // Corrección de rutas para Windows/Unix
            let cleanThumb = g.thumbnail.replace(/\\/g, "/");
            let cleanUrl = g.embedUrl.replace(/\\/g, "/");

            const fullThumb = cleanThumb.startsWith("http") ? cleanThumb : `${API_URL}/${cleanThumb}`;
            const fullGameUrl = cleanUrl.startsWith("http") ? cleanUrl : `${API_URL}/${cleanUrl}`;

            return `
            <div class="game-card" onclick="playGame('${fullGameUrl}')">
                <div class="thumb-wrapper">
                    <img src="${fullThumb}" alt="${g.title}">
                </div>
                <div class="info">
                    <h4>${g.title}</h4>
                    <small>${g.type === 'internal' ? '⚔️ Competitivo' : '🎮 Práctica'}</small>
                </div>
            </div>
            `;
        }).join('');
    } catch (error) {
        console.error("Error cargando juegos:", error);
        container.innerHTML = "<p class='muted-text'>Error al cargar el Dojo de juegos.</p>";
    }
}

// ==========================================
// 3. SISTEMA DE CHAT
// ==========================================
function initChat() {
    try {
        socket = io(API_URL); 

        const chatInput = document.getElementById("chatInput");
        const sendBtn = document.querySelector("#chatBox + div button");
        const chatBox = document.getElementById("chatBox");

        socket.on("chat message", (msg) => {
            const p = document.createElement("p");
            p.className = "chat-msg";
            p.innerHTML = `<strong class="ninja-name">${msg.user}:</strong> <span>${msg.text}</span>`;
            chatBox.appendChild(p);
            chatBox.scrollTop = chatBox.scrollHeight;
        });

        const sendMessage = () => {
            const text = chatInput.value.trim();
            if (text && currentUser) {
                socket.emit("chat message", { user: currentUser.ninjaName, text });
                chatInput.value = "";
            }
        };

        if(sendBtn) sendBtn.onclick = sendMessage;
        if(chatInput) {
            chatInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") sendMessage();
            });
        }

    } catch (e) {
        console.error("Error iniciando chat:", e);
    }
}

// ==========================================
// 4. LOGICA DE MISIONES
// ==========================================
function initMissionLogic() {
    if(!currentUser || !missionBtn) return;

    const lastClaim = currentUser.lastDailyClaim ? new Date(currentUser.lastDailyClaim) : new Date(0);
    const now = new Date();
    const diffHours = Math.abs(now - lastClaim) / 36e5;

    if (diffHours < 24) {
        disableMissionButton(lastClaim);
    } else {
        const newBtn = missionBtn.cloneNode(true);
        missionBtn.parentNode.replaceChild(newBtn, missionBtn);
        newBtn.addEventListener("click", claimMission);
    }
}

async function claimMission() {
    const btn = document.getElementById("missionBtn"); 
    const token = localStorage.getItem("token");
    
    btn.innerHTML = "⏳ Verificando...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/api/missions/daily`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            }
        });

        if (res.status === 404) throw new Error("Ruta de misión no encontrada (404)");

        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            document.getElementById("headerBalance").innerText = data.newBalance.toFixed(2);
            disableMissionButton(new Date());
        } else {
            alert(`⚠️ ${data.error || "Misión fallida"}`);
            btn.innerHTML = "⚔️ RECLAMAR RECOMPENSA";
            btn.disabled = false;
        }

    } catch (error) {
        console.error(error);
        alert(`🚫 Error: ${error.message}`);
        btn.disabled = false;
        btn.innerHTML = "⚔️ RECLAMAR RECOMPENSA";
    }
}

function disableMissionButton(lastClaimDate) {
    const btn = document.getElementById("missionBtn");
    if(!btn) return;
    
    btn.classList.add("btn-disabled");
    btn.innerHTML = "✅ MISIÓN COMPLETADA";
    
    if(missionTimer) {
        missionTimer.style.display = "block";
        const nextClaim = new Date(lastClaimDate.getTime() + (24 * 60 * 60 * 1000));
        const timeStr = nextClaim.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        document.getElementById("countdown").innerText = timeStr;
    }
}

// ==========================================
// 5. UI & NAVEGACIÓN
// ==========================================
function renderUserHeader() {
    document.getElementById("sideName").innerText = currentUser.ninjaName;
    const balance = Number(currentUser.balance) || 0;
    document.getElementById("headerBalance").innerText = balance.toFixed(2);
    
    const badge = document.getElementById("sideLevelBadge");
    const status = document.getElementById("sideStatus");
    
    if (currentUser.level > 0 && currentUser.hasNinjaPass) {
        badge.innerText = `NIVEL ${currentUser.level}`;
        badge.className = currentUser.level >= 3 ? "badge badge-master" : "badge badge-student";
        status.innerText = "⚡ Ciclo Activo";
        status.style.color = "var(--gold)";
    } else {
        badge.innerText = "RONIN";
        badge.className = "badge badge-ronin";
        status.innerText = "Esperando Pase...";
    }

    // NUEVO: PINTAR REFERIDOS
    if(currentUser.referralStats) {
        const refCount = document.getElementById("myReferrals");
        const refEarn = document.getElementById("referralEarnings");
        if(refCount) refCount.innerText = currentUser.referralStats.count || 0;
        if(refEarn) refEarn.innerText = currentUser.referralStats.earnings || 0;
    }

}

function applyAccessLogic() {
    if (!currentUser.hasNinjaPass || currentUser.level === 0) {
        document.getElementById("promoBanner").style.display = "flex";
        document.getElementById("cycleContainer").style.display = "none";
        lockSections();
        return;
    }

    document.getElementById("promoBanner").style.display = "none";
    document.getElementById("cycleContainer").style.display = "block";
    unlockBtn("navArena");
    if (currentUser.level >= 3) unlockBtn("navDao");

    renderCycleProgress();
}

function renderCycleProgress() {
    const target = currentUser.cycleTarget || 100;
    let percent = currentUser.cyclePercent || 0;
    const claimed = currentUser.claimedMilestones || [];

    document.getElementById("trackFill").style.width = `${percent}%`;
    document.getElementById("cyclePercentText").innerText = `${Math.floor(percent)}%`;

    [25, 50, 75, 100].forEach(p => {
        const cp = document.getElementById(`cp${p}`);
        const lbl = document.getElementById(`lbl${p}`);
        cp.classList.remove("active", "claimed");
        lbl.classList.remove("active");
        
        if (percent >= p) {
            cp.classList.add("active");
            lbl.classList.add("active");
            if (claimed.includes(p)) {
                cp.classList.add("claimed");
                cp.innerHTML = "✔";
            }
        }
    });

    updateWithdrawButton(percent, claimed, target);
}

function updateWithdrawButton(percent, claimedArray, totalTarget) {
    const btn = document.getElementById("btnRetiro");
    const displayAmount = document.getElementById("withdrawableAmount");
    const trancheAmount = totalTarget * 0.25;
    
    let nextMilestone = 0;
    if (percent >= 25 && !claimedArray.includes(25)) nextMilestone = 25;
    else if (percent >= 50 && !claimedArray.includes(50)) nextMilestone = 50;
    else if (percent >= 75 && !claimedArray.includes(75)) nextMilestone = 75;
    else if (percent >= 100 && !claimedArray.includes(100)) nextMilestone = 100;

    if (nextMilestone > 0) {
        btn.className = "btn-ninja-primary";
        btn.innerText = `RETIRAR TRAMO ${nextMilestone}% 💸`;
        btn.disabled = false;
        displayAmount.innerText = `$${trancheAmount.toFixed(2)} USD`;
        displayAmount.style.color = "var(--gold)";
    } else {
        btn.className = "btn-ninja-outline";
        btn.innerText = percent < 25 ? "META: 25% 🔒" : "BLOQUEADO 🔒";
        if(claimedArray.includes(100)) btn.innerText = "CICLO COMPLETADO ✅";
        
        btn.disabled = true;
        displayAmount.innerText = "$0.00 USD";
        displayAmount.style.color = "#666";
    }
}

// Globales para HTML onclick
window.selectLevel = async (lvl) => {
    if(!confirm(`⚠️ ¿Confirmas forjar el Pase Nivel ${lvl}?`)) return;
    const modalContent = document.querySelector("#levelModal > div");
    const originalHtml = modalContent.innerHTML;
    modalContent.innerHTML = "<h3 class='blinking'>FORJANDO PASE...</h3>";

    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/cycles/start`, { 
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ level: lvl })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            closeLevelModal();
            await validateSession();
        } else {
            alert(data.message || "Error");
            modalContent.innerHTML = originalHtml;
        }
    } catch (error) {
        alert("Error de conexión");
        modalContent.innerHTML = originalHtml;
    }
};

window.procesarRetiro = async () => {
    const btn = document.getElementById("btnRetiro");
    btn.disabled = true;
    btn.innerText = "PROCESANDO...";
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/payments/withdraw`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            await validateSession(); 
        } else {
            alert(data.message || "Error");
            await validateSession(); 
        }
    } catch (e) {
        alert("Error de red");
        btn.disabled = false;
        btn.innerText = "REINTENTAR";
    }
};

function lockSections() {
    document.getElementById("navArena").classList.add("locked");
    document.getElementById("navDao").classList.add("locked");
}

function unlockBtn(id) {
    const btn = document.getElementById(id);
    if(btn) {
        btn.classList.remove("locked");
        btn.innerText = btn.innerText.replace("🔒", "").trim();
    }
}

window.showSection = function(id) {
    if(id === 'arena' && (!currentUser.hasNinjaPass)) return alert("🚫 Requiere Pase Ninja.");
    if(id === 'dao' && currentUser.level < 3) return alert("🚫 Solo Nivel 3.");

    document.querySelectorAll('.content-section').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.sidebar-btn').forEach(el => el.classList.remove('active'));
    
    const targetSec = document.getElementById(`sec-${id}`);
    if(targetSec) targetSec.style.display = 'block';
};

window.openLevelModal = () => document.getElementById("levelModal").style.display = "flex";
window.closeLevelModal = () => document.getElementById("levelModal").style.display = "none";

window.playGame = (url) => {
    const modal = document.getElementById('gameModal');
    const iframe = document.getElementById('gameFrame');
    if(modal && iframe) { 
        iframe.src = url; 
        modal.style.display = 'flex'; 
    }
};

window.closeGame = () => {
    const modal = document.getElementById('gameModal');
    const iframe = document.getElementById('gameFrame');
    modal.style.display = 'none';
    iframe.src = ''; // Detener juego
};

document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.replace("index.html");
});

// ... (resto del código existente) ...

// ==========================================
// 🔗 SISTEMA VIRAL (NUEVO)
// ==========================================
window.copyReferralLink = function() {
    if (!currentUser || !currentUser.referralCode) {
        return alert("⚠️ Error: No tienes código de guerrero asignado.");
    }

    // Generar URL: tudominio.com/register.html?ref=CODIGO
    // Usamos window.location.origin para que funcione en localhost y producción
    const link = `${window.location.origin}/register.html?ref=${currentUser.referralCode}`;

    navigator.clipboard.writeText(link).then(() => {
        // Usamos Toastify si está disponible, sino alert
        if(typeof Toastify === 'function') {
            Toastify({
                text: "🔗 Enlace de Reclutamiento Copiado",
                backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)",
                duration: 3000
            }).showToast();
        } else {
            alert("🔗 Enlace copiado al portapapeles:\n" + link);
        }
    }).catch(err => {
        console.error('Error al copiar:', err);
    });
};

// Modifica la función renderUserHeader para asegurar que se muestren los stats de referidos
const originalRenderUserHeader = renderUserHeader; // Guardamos la referencia anterior si es necesario

// Asegúrate de que en validateSession() o renderUserHeader() se actualicen los textos:
// document.getElementById("myReferrals").innerText = currentUser.referralStats?.count || 0;
// document.getElementById("referralEarnings").innerText = currentUser.referralStats?.earnings || 0;
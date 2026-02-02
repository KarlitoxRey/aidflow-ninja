import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

// ==========================================
// 1. INICIALIZACIÓN BLINDADA
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    await validateSession();
    // Solo si hay usuario, activamos listeners
    if (currentUser) {
        setupEventListeners();
        initSocialMissionLogic();
    }
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
        initChat(); // Inicializa el socket
        initDuelArena(); // <--- ⚔️ INICIA LA ESCUCHA DE DUELOS
        
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
    
    // 🔥 Mostrar Fichas
    safeText("tokenBalance", currentUser.tournamentTokens || 0); 

    safeText("daoFund", formatMoney(currentUser.daoBalance || 0));    
    safeText("prizePool", formatMoney(currentUser.poolBalance || 0));

    initDailyMissionBtn();
    applyAccessLogic(); // <--- AQUI SE EJECUTA LA LÓGICA DE PODER
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

    document.getElementById("menuProfile")?.addEventListener("click", () => window.openProfileModal());
    document.getElementById("menuWithdraw")?.addEventListener("click", () => window.openWithdrawModal());
    
    document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.replace("index.html");
    });
}

// ==========================================
// ⚔️ 3. LÓGICA DE DUELOS 1vs1 (NUEVO)
// ==========================================

function initDuelArena() {
    // Solo iniciamos si el socket existe (creado en initChat)
    if (socket) {
        console.log("⚔️ Arena de Duelos conectada al Socket");

        // Escuchar cuando alguien crea un reto nuevo
        socket.on("newDuelAvailable", (duel) => {
            renderizarDueloEnLista(duel);
        });

        // Escuchar cuando aceptan MI reto o yo acepto uno
        socket.on("startDuelCombat", (data) => {
            alert(`⚔️ ¡EN GUARDIA! Rival: ${data.opponentName}`);
            // Usamos la función global para abrir el juego con el roomCode
            window.playGame(`games/ninja-combat/?room=${data.roomCode}`); 
        });
    }
}

// Función Global para el botón "PUBLICAR RETO"
window.crearReto = async () => {
    const amountInput = document.getElementById('betAmount');
    if(!amountInput) return;
    
    const amount = Number(amountInput.value);
    const token = localStorage.getItem("token");

    if (amount < 5) return alert("❌ La apuesta mínima es de 5 NC.");
    if (currentUser.balance < amount) return alert("❌ Oro insuficiente. Necesitas recargar.");

    // Feedback visual inmediato
    const btn = document.querySelector("button[onclick='crearReto()']");
    const originalText = btn.innerText;
    btn.innerText = "FORJANDO...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/api/duels/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ amount })
        });

        const data = await res.json();
        if (res.ok) {
            alert("⚔️ Reto publicado en la Arena. Esperando rival...");
            
            // Emitir al socket para que otros lo vean al instante
            socket.emit("createDuel", data.duel);
            
            // Actualizar balance localmente sin recargar
            currentUser.balance -= amount;
            safeText("headerBalance", formatMoney(currentUser.balance));
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert("Error al conectar con la Arena.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// Función para pintar la tarjeta en el HTML
function renderizarDueloEnLista(duel) {
    const list = document.getElementById('duelsList');
    if(!list) return;

    // Limpiar mensaje de "buscando" si existe
    if (list.innerText.includes("Buscando")) list.innerHTML = '';

    // Evitar duplicados si el socket manda doble señal
    if (document.getElementById(`duel-${duel._id}`)) return;

    // No mostrar mis propios duelos en la lista de "aceptar"
    if (currentUser && duel.challenger === currentUser._id) return;

    const card = document.createElement('div');
    card.id = `duel-${duel._id}`;
    card.className = "duel-card fade-in"; 
    card.style = `
        background: #0f0f0f; 
        border-left: 3px solid var(--blood); 
        padding: 15px; 
        margin-bottom: 10px; 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    
    card.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <div style="background:#222; padding:8px; border-radius:50%; color:var(--gold);">
                <i class="fas fa-khanda"></i>
            </div>
            <div>
                <span style="color: var(--gold); font-family: 'Orbitron'; font-weight: bold; font-size: 1.1rem;">${duel.betAmount} NC</span>
                <p style="font-size: 0.75rem; color: #888; margin: 0;">RETO ABIERTO</p>
            </div>
        </div>
        <button onclick="aceptarDuelo('${duel._id}')" class="btn-ninja-outline" style="padding: 5px 20px; font-size: 0.8rem; border-color:var(--gold); color:var(--gold);">
            ACEPTAR
        </button>
    `;
    list.prepend(card);
}

// Función Global para Aceptar
window.aceptarDuelo = async (duelId) => {
    if(!confirm("¿Aceptas este duelo a muerte? Tu saldo será descontado.")) return;

    const token = localStorage.getItem("token");
    
    try {
        const res = await fetch(`${API_URL}/api/duels/accept/${duelId}`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();
        if (res.ok) {
            // Actualizar balance local
            currentUser.balance -= data.duel.betAmount; 
            safeText("headerBalance", formatMoney(currentUser.balance));

            // Notificar al server para que avise al creador
            socket.emit("duelAccepted", {
                challengerId: data.duel.challenger,
                roomCode: data.duel.roomCode,
                opponentName: currentUser.ninjaName
            });
            
            // Entrar al juego
            window.playGame(`games/ninja-combat/?room=${data.duel.roomCode}`);
            
            // Remover la tarjeta de la lista visualmente
            const card = document.getElementById(`duel-${duelId}`);
            if(card) card.remove();

        } else {
            alert(data.error);
        }
    } catch (err) {
        alert("Error al entrar al combate.");
    }
};

// ==========================================
// 4. MISION SOCIAL, DIARIA Y JUEGOS
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
// 5. CHAT Y SÓCKETS GENERALES
// ==========================================
function initChat() {
    if(typeof io === 'undefined') return;
    socket = io(API_URL); // ESTE ES EL SOCKET QUE USAMOS PARA DUELOS TAMBIÉN
    
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

// ==========================================
// 🚨 LÓGICA DE ACCESO (ADMIN VS USER) - ¡INTEGRADA!
// ==========================================
function applyAccessLogic() {
    // Si el rol es shogun, inyectamos el botón de mando
    if (currentUser && currentUser.role === 'shogun') {
        console.log("⚔️ Shogun detectado en el Dojo.");
        
        // Evitamos duplicar el botón si la función se llama varias veces
        if(document.getElementById("btnAdminFloating")) return;

        const btnAdmin = document.createElement("button");
        btnAdmin.id = "btnAdminFloating";
        btnAdmin.innerText = "⚙️ COMANDO SHOGUN";
        btnAdmin.className = "btn-ninja-primary"; // Clase existente
        
        // Estilos forzados para garantizar visibilidad
        Object.assign(btnAdmin.style, {
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: "9999",
            boxShadow: "0 0 15px var(--red)",
            border: "2px solid var(--gold)",
            padding: "12px 24px",
            fontWeight: "bold",
            fontSize: "12px",
            cursor: "pointer"
        });
        
        btnAdmin.onclick = () => {
            window.location.href = "admin.html";
        };
        
        document.body.appendChild(btnAdmin);
    }
}

// ==========================================
// 6. FUNCIONES GLOBALES (VENTANAS Y MODALES)
// ==========================================
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

// 1. ABRIR/CERRAR MODAL RECARGA
window.openDepositModal = () => {
    document.getElementById("depositModal").style.display = "flex";
};

window.closeDepositModal = () => {
    document.getElementById("depositModal").style.display = "none";
};

// 2. ENVIAR RECARGA AL BACKEND
window.submitDeposit = async () => {
    const amount = document.getElementById("depAmount").value;
    const ref = document.getElementById("depRef").value;
    const btn = document.querySelector("#depositModal button.btn-ninja-primary");

    if(!amount || !ref) return alert("❌ Faltan datos del comprobante.");

    btn.innerText = "ENVIANDO...";
    btn.disabled = true;

    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/payments/deposit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ amount, referenceId: ref })
        });

        const data = await res.json();
        
        if(res.ok) {
            alert("✅ " + data.message);
            closeDepositModal();
            document.getElementById("depAmount").value = "";
            document.getElementById("depRef").value = "";
        } else {
            alert("⚠️ " + data.message);
        }
    } catch (e) {
        alert("Error de conexión");
    } finally {
        btn.innerText = "INFORMAR PAGO";
        btn.disabled = false;
    }
};

// 3. ABRIR MODAL RETIRO
window.openWithdrawModal = () => {
    const modal = document.getElementById("withdrawModal");
    if(modal) {
        modal.style.display = "flex";
        // Actualizar monto disponible para cosecha
        const harvestVal = currentUser.cycle ? currentUser.cycle.earnings : 0;
        const el = document.getElementById("harvestAmount");
        if(el) el.innerText = formatMoney(harvestVal);
    } else {
        alert("🏦 Función de retiros en construcción.");
    }
};

window.closeWithdrawModal = () => document.getElementById("withdrawModal").style.display = "none";

/* ==========================================
   LÓGICA DE PERFIL & REFERIDOS
   ========================================== */
window.openProfileModal = () => {
    document.getElementById("profileModal").style.display = "flex";
    
    if(currentUser) {
        document.getElementById("profName").innerText = currentUser.ninjaName;
        document.getElementById("profEmail").innerText = currentUser.email;
        document.getElementById("profLevel").innerText = currentUser.level > 0 ? `NIVEL ${currentUser.level}` : "RONIN";
        
        const link = `${window.location.origin}/register.html?ref=${currentUser.referralCode}`;
        document.getElementById("referralLink").value = link;

        const stats = currentUser.referralStats || { count: 0, totalEarned: 0 };
        document.getElementById("profRefCount").innerText = stats.count;
        document.getElementById("profRefEarn").innerText = formatMoney(stats.totalEarned);
    }
};

window.closeProfileModal = () => document.getElementById("profileModal").style.display = "none";

window.copyReferral = () => {
    const input = document.getElementById("referralLink");
    input.select();
    document.execCommand("copy");
    alert("📋 Enlace copiado al portapapeles");
};

/* ==========================================
   LÓGICA DE RETIROS (Tabs y Acciones)
   ========================================== */
window.showTab = (tab) => {
    const btnH = document.getElementById("tabHarvest");
    const btnB = document.getElementById("tabBank");
    const viewH = document.getElementById("viewHarvest");
    const viewB = document.getElementById("viewBank");

    if(tab === 'harvest') {
        viewH.style.display = "block"; viewB.style.display = "none";
        btnH.style.color = "white"; btnH.style.borderBottom = "2px solid #10b981";
        btnB.style.color = "#666"; btnB.style.borderBottom = "none";
    } else {
        viewH.style.display = "none"; viewB.style.display = "block";
        btnB.style.color = "white"; btnB.style.borderBottom = "2px solid var(--blood)";
        btnH.style.color = "#666"; btnH.style.borderBottom = "none";
    }
};

window.doHarvest = async () => {
    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/payments/withdraw`, { 
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if(res.ok) {
            alert(data.message);
            window.location.reload(); 
        } else {
            alert("⚠️ " + data.error);
        }
    } catch(e) { alert("Error de red"); }
};

window.doPayout = async () => {
    const amount = document.getElementById("outAmount").value;
    const alias = document.getElementById("outAlias").value;

    if(!amount || !alias) return alert("Completa todos los campos");

    try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/payments/payout`, { 
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({ amount, alias })
        });
        const data = await res.json();
        if(res.ok) {
            alert("✅ " + data.message);
            window.location.reload();
        } else {
            alert("⚠️ " + (data.message || data.error));
        }
    } catch(e) { alert("Error conectando con Tesorería"); }
};

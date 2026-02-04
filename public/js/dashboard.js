import { API_URL } from "./api.js";

let currentUser = null;
let socket = null;

// INICIALIZACIÓN
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
        // Datos usuario + Billetera en una llamada (o dos paralelas)
        const [authRes, walletRes] = await Promise.all([
            fetch(`${API_URL}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/api/payments/wallet`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!authRes.ok || !walletRes.ok) throw new Error("Sesión inválida");

        const authData = await authRes.json();
        const walletData = await walletRes.json();

        // Fusionar
        currentUser = { ...authData, ...walletData };
        
        renderUserInterface();
        loadUserGames(); 
        initChat(); 
        initDuelArena(); 
        
    } catch (error) {
        console.error("Error sesión:", error);
        localStorage.clear();
        // window.location.replace("login.html");
    }
}

function renderUserInterface() {
    safeText("userName", currentUser.ninjaName);
    safeText("headerBalance", formatMoney(currentUser.balance)); // Ahora esto mostrará 0 al principio, correcto.
    safeText("userTokens", currentUser.tournamentTokens || 0);
    
    const badge = document.getElementById("userRank");
    if(badge) badge.innerText = currentUser.level > 0 ? `RANGO ${currentUser.level}` : "RONIN";

    initDailyMissionBtn();
    applyAccessLogic();
    
    // ==> LÓGICA DE BARRA $50 <==
    updateCycleProgress();
}

function updateCycleProgress() {
    const container = document.getElementById("cycleContainer");
    if(!container) return;

    if (currentUser.cycle && currentUser.cycle.status === 'active') {
        container.style.display = "block";
        document.getElementById("buyAlert").style.display = "none";

        const currentBalance = currentUser.balance || 0; // Lo que ha ganado (referidos/juegos)
        const totalTarget = 50.00; // Meta Final
        const stepTarget = 12.50;  // Tramo de retiro
        
        // 1. Barra visual (Base $50)
        let percent = (currentBalance / totalTarget) * 100;
        if(percent > 100) percent = 100;
        document.getElementById("cycleBar").style.width = `${percent}%`;
        
        safeText("cyclePercent", `${percent.toFixed(1)}%`);
        // Muestra acumulado vs Meta total
        safeText("cycleEarnings", `${formatMoney(currentBalance)} / $50.00`); 

        // 2. Lógica del Botón de Retiro (Base $12.50)
        const harvestBtn = document.getElementById("harvestBtn");
        
        if (currentUser.hasPendingWithdrawal) {
            // BLOQUEO: Ya retiró y espera aprobación
            harvestBtn.style.display = "block";
            harvestBtn.innerText = "⏳ RETIRO EN PROCESO";
            harvestBtn.disabled = true;
            harvestBtn.classList.add("btn-disabled"); // Añadir estilo gris si quieres
            
        } else if (currentBalance >= stepTarget) {
            // HABILITADO: Tiene más de 12.50 y no hay pendientes
            harvestBtn.style.display = "block";
            harvestBtn.disabled = false;
            harvestBtn.innerText = `💸 RETIRAR TRAMO ($12.50)`;
            harvestBtn.onclick = () => doPayout(12.50); // Fija el monto a 12.50
            harvestBtn.classList.remove("btn-disabled");
            
        } else {
            // INHABILITADO: No llega al monto
            harvestBtn.style.display = "none";
        }

    } else {
        container.style.display = "none";
        document.getElementById("buyAlert").style.display = "block";
    }
}

// 3. LISTENERS
function setupEventListeners() {
    window.toggleChat = () => {
        const chatWin = document.getElementById("chatWindow");
        if(chatWin) chatWin.style.display = chatWin.style.display === "flex" ? "none" : "flex";
    };
    document.getElementById("menuProfile")?.addEventListener("click", () => window.openProfileModal());
}

window.logout = () => { localStorage.clear(); window.location.replace("login.html"); };

// 4. LÓGICA DE PAGOS
window.openDepositModal = () => document.getElementById("depositModal").style.display = "flex";
window.closeModal = (id) => document.getElementById(id).style.display = "none";

window.submitDeposit = async () => {
    const amount = document.getElementById("depAmount").value;
    const ref = document.getElementById("depRef").value;
    if(!amount || !ref) return alert("Faltan datos");

    try {
        const res = await fetch(`${API_URL}/api/payments/deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount, referenceId: ref })
        });
        const data = await res.json();
        if(res.ok) { alert("✅ " + data.message); closeModal('depositModal'); }
        else { alert("⚠️ " + data.message); }
    } catch (e) { alert("Error"); }
};

window.doPayout = async (amountToWithdraw) => {
    let alias = prompt(`Ingresa tu Alias/CBU para recibir $${amountToWithdraw}:`);
    if(!alias) return;

    try {
        const res = await fetch(`${API_URL}/api/payments/payout`, { 
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
            body: JSON.stringify({ amount: amountToWithdraw, alias })
        });
        const data = await res.json();
        if(res.ok) { 
            alert("✅ Solicitud enviada. Espera aprobación."); 
            window.location.reload(); 
        } else { 
            alert("⚠️ " + data.message); 
        }
    } catch(e) { alert("Error conectando con Tesorería"); }
};

// 5. JUEGOS Y TORNEOS (Recuperados)
async function loadUserGames() {
    const container = document.getElementById('embedGamesGrid');
    if(!container) return;
    try {
        const res = await fetch(`${API_URL}/api/games`);
        const games = await res.json();
        if(games.length === 0) { container.innerHTML = "<p style='color:#666'>Sin torneos activos.</p>"; return; }
        
        container.innerHTML = games.map(g => `
            <div class="blade-card" style="padding:15px; cursor:pointer;" onclick="window.playGame('${g.embedUrl}')">
                <h4 style="color:var(--gold); margin:0 0 10px 0;">${g.title}</h4>
                <div style="background:#000; height:120px; display:flex; align-items:center; justify-content:center; border:1px solid #333;">
                    <i class="fas fa-play-circle" style="font-size:3rem; color:var(--blood);"></i>
                </div>
                <button class="btn-blade btn-blade-outline" style="margin-top:10px;">ENTRAR</button>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

// 6. CHAT Y UTILIDADES
function safeText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function formatMoney(amount) { return Number(amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function initChat() { /* ... mantener tu lógica de socket.io ... */ }
function initDuelArena() { /* ... mantener tu lógica de duelos ... */ }
function initSocialMissionLogic() {} // Placeholder si no se usa
function initDailyMissionBtn() {} // Placeholder
function applyAccessLogic() {
    if (currentUser && currentUser.role === 'shogun') {
        const btn = document.createElement("button");
        btn.innerText = "⚙️";
        btn.style = "position:fixed; bottom:20px; left:20px; background:red; padding:10px; z-index:9999;";
        btn.onclick = () => window.location.href = "admin.html";
        document.body.appendChild(btn);
    }
}
window.playGame = (url) => window.open(url, '_blank');

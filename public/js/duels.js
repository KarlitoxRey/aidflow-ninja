import { API_URL } from "./api.js";

// --- CARGAR DUELOS DISPONIBLES ---
export async function loadDuelArena() {
    const container = document.getElementById('duelArenaContainer');
    const token = localStorage.getItem("token");

    try {
        const res = await fetch(`${API_URL}/api/duels/active`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const duels = await res.json();

        if (duels.length === 0) {
            container.innerHTML = `<p class="muted-text">No hay desafíos activos. Sé el primero en lanzar uno.</p>`;
            return;
        }

        container.innerHTML = duels.map(duel => `
            <div class="duel-card">
                <div class="duel-info">
                    <h4>Reto de ${duel.challenger.ninjaName}</h4>
                    <p class="duel-bet">${duel.betAmount} <span class="gold-text">ORO</span></p>
                </div>
                <button onclick="acceptDuel('${duel._id}')" class="btn-ninja-outline">ACEPTAR</button>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error cargando arena:", err);
    }
}

// --- LANZAR UN NUEVO DESAFÍO ---
window.createDuel = async function() {
    const betAmount = document.getElementById('duelBet').value;
    const token = localStorage.getItem("token");

    if (!betAmount || betAmount <= 0) return alert("Ingresa una apuesta válida.");

    try {
        const res = await fetch(`${API_URL}/api/duels/challenge`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ betAmount })
        });

        if (res.ok) {
            alert("⚔️ Desafío lanzado. Tu oro ha sido puesto en custodia.");
            loadDuelArena();
        } else {
            const data = await res.json();
            alert(data.error);
        }
    } catch (err) {
        alert("Fallo al conectar con el Dojo.");
    }
};

// --- ACEPTAR DUELO ---
window.acceptDuel = async function(duelId) {
    const token = localStorage.getItem("token");

    try {
        const res = await fetch(`${API_URL}/api/duels/accept/${duelId}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.ok) {
            alert("⚔️ ¡DUELO INICIADO! Prepárate para combatir.");
            // Aquí llamarías a la función de abrir el juego Space Waves
            // openGame('games/ninja-waves/index.html?duelId=' + duelId);
        }
    } catch (err) {
        console.error(err);
    }
};
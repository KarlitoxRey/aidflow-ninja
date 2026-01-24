/* js/game-sdk.js */
const AidFlow = {
    /**
     * Envía el puntaje final al sistema central (Dashboard).
     */
    sendScore: function(points) {
        if (!window.parent || window.parent === window) {
            console.warn("⚠️ SDK: Juego fuera del Dashboard.");
            alert(`[MODO PRUEBA] Puntaje final: ${points}`);
            return;
        }
        
        const cleanPoints = Math.floor(Number(points));
        window.parent.postMessage({
            type: 'GAME_OVER',
            score: cleanPoints,
            timestamp: Date.now()
        }, "*");
    },

    /**
     * 👇 NUEVO MÉTODO: Solicita cerrar el juego
     */
    exitGame: function() {
        if (window.parent && window.parent !== window) {
            console.log("🚪 Solicitando salida del Dojo...");
            window.parent.postMessage({ type: 'EXIT_GAME' }, '*');
        } else {
            console.warn("⚠️ No hay Dashboard padre. Cerrando ventana.");
            window.close(); // Intento de cierre si está en pestaña aparte
        }
    }
};

window.AidFlow = AidFlow;
console.log("✅ AidFlow Ninja SDK cargado.");
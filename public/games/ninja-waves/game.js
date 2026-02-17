import { API_URL } from "../../js/api.js";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Configuración de Sesión y Físicas
let gameState = {
    distance: 0,
    lives: 3,
    continues: 0,
    lastCheckpoint: 0,
    isInvulnerable: false,
    active: true,
    speed: 6, // Velocidad inicial un poco más picante
    playerY: 0,
    velocity: 0,
    obstacles: [],
    nextObstacleAt: 500 // Metros donde aparece el primer obstáculo
};

// Configuración del Jugador
const PLAYER = { x: 100, size: 30, color: '#8e0000' };
let isPressing = false;

// --- INICIALIZACIÓN ---
function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gameState.playerY = canvas.height / 2;
    gameState.nextObstacleAt = 50; // Empezar pronto
    gameLoop();
}

// --- BUCLE PRINCIPAL (GAME LOOP) ---
function gameLoop() {
    if (!gameState.active) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    updatePlayer();
    manageObstacles(); // Generar y Mover
    checkCollisions(); // Detectar Impactos
    handleProgression();
    draw();

    requestAnimationFrame(gameLoop);
}

// --- FÍSICAS DEL JUGADOR ---
function updatePlayer() {
    const gravity = 0.6;
    const lift = -1.2;
    
    if (isPressing) {
        gameState.velocity += lift;
    } else {
        gameState.velocity += gravity;
    }

    gameState.playerY += gameState.velocity;

    // Límites de pantalla (Techo y Suelo matan)
    if (gameState.playerY < 0 || gameState.playerY > canvas.height - PLAYER.size) {
        onDeath();
    }
}

// --- GENERADOR DE OBSTÁCULOS (EL MURO) ---
function manageObstacles() {
    // 1. Mover obstáculos hacia la izquierda
    // La velocidad de los muros depende de la velocidad del juego
    gameState.obstacles.forEach(obs => {
        obs.x -= gameState.speed;
    });

    // 2. Eliminar obstáculos que salieron de pantalla
    gameState.obstacles = gameState.obstacles.filter(obs => obs.x + obs.w > 0);

    // 3. Generar nuevos obstáculos (Procedural)
    // Usamos gameState.distance * 10 para convertir metros a pixeles aproximados de spawn
    // Si la distancia recorrida supera la marca del siguiente obstáculo:
    if (gameState.distance >= gameState.nextObstacleAt) {
        spawnGate();
        // El siguiente obstáculo aparece en X metros (aleatorio entre 25 y 40 metros de juego)
        // A mayor velocidad, más espacio necesitamos
        gameState.nextObstacleAt += 30 + (Math.random() * 10); 
    }
}

function spawnGate() {
    const wallWidth = 60;
    const gapSize = 220 - (gameState.speed * 2); // El hueco se hace más pequeño cuanto más rápido vas
    const minGap = 120; // Límite mínimo del hueco
    const finalGap = Math.max(gapSize, minGap);

    // Posición Y del hueco (randomizado pero con márgenes)
    const maxGapY = canvas.height - finalGap - 50;
    const minGapY = 50;
    const gapY = Math.random() * (maxGapY - minGapY) + minGapY;

    // Muro Superior
    gameState.obstacles.push({
        x: canvas.width,
        y: 0,
        w: wallWidth,
        h: gapY,
        type: 'top'
    });

    // Muro Inferior
    gameState.obstacles.push({
        x: canvas.width,
        y: gapY + finalGap,
        w: wallWidth,
        h: canvas.height - (gapY + finalGap),
        type: 'bottom'
    });
}

// --- DETECCIÓN DE COLISIONES (HITBOX) ---
function checkCollisions() {
    if (gameState.isInvulnerable) return;

    // Hitbox del jugador (ligeramente más pequeña que el gráfico para ser justa)
    const pRect = {
        x: PLAYER.x + 5,
        y: gameState.playerY + 5,
        w: PLAYER.size - 10,
        h: PLAYER.size - 10
    };

    for (let obs of gameState.obstacles) {
        // Hitbox del obstáculo
        const oRect = {
            x: obs.x,
            y: obs.y,
            w: obs.w,
            h: obs.h
        };

        // Fórmula AABB (Axis-Aligned Bounding Box)
        if (
            pRect.x < oRect.x + oRect.w &&
            pRect.x + pRect.w > oRect.x &&
            pRect.y < oRect.y + oRect.h &&
            pRect.y + pRect.h > oRect.y
        ) {
            onDeath();
            break; // No es necesario chequear más si ya moriste
        }
    }
}

// --- SISTEMA DE PROGRESIÓN ---
function handleProgression() {
    gameState.distance += gameState.speed / 20; // Ajuste de escala de metros
    
    // Checkpoint visual
    if (gameState.distance >= gameState.lastCheckpoint + 500) {
        gameState.lastCheckpoint = Math.floor(gameState.distance);
        triggerVisualCheckpoint();
    }

    // Aumentar velocidad cada 1000m
    if (Math.floor(gameState.distance) > 0 && Math.floor(gameState.distance) % 1000 === 0) {
        // Solo aumentar si acabamos de cruzar el umbral (evitar aumento por frame)
        // Usamos un flag o chequeo simple de rango, aquí simplificado:
         gameState.speed = Math.min(gameState.speed * 1.002, 15); // Cap de velocidad en 15
    }

    updateHUD();
}

// --- VIDA Y MUERTE ---
function onDeath() {
    if (gameState.isInvulnerable) return;

    gameState.lives--;
    updateHUD();

    if (gameState.lives > 0) {
        respawn();
    } else {
        showGameOver();
    }
}

function respawn() {
    // Resetear posición
    gameState.playerY = canvas.height / 2;
    gameState.velocity = 0;
    gameState.isInvulnerable = true;
    
    // ELIMINAR OBSTÁCULOS EN PANTALLA (Anti Spawn-Kill)
    // Limpiamos todo lo que esté en canvas.width (lo que se ve actualmente)
    gameState.obstacles = gameState.obstacles.filter(o => o.x > canvas.width);
    
    // Retrasar el siguiente obstáculo para dar respiro
    gameState.nextObstacleAt = gameState.distance + 50;

    setTimeout(() => {
        gameState.isInvulnerable = false;
    }, 3000);
}

function showGameOver() {
    gameState.active = false;
    if (gameState.continues < 5) {
        document.getElementById('modal-continue').classList.remove('hidden');
    } else {
        finishGame();
    }
}

// --- CONEXIÓN BACKEND (RE-COMPRA) ---
async function requestContinue() {
    const token = localStorage.getItem("token");
    const btn = document.getElementById('btn-recompra');
    
    btn.disabled = true;
    btn.innerText = "COBRANDO...";

    try {
        const res = await fetch(`${API_URL}/api/games/continue`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        const data = await res.json();

        if (res.ok) {
            gameState.continues++;
            gameState.lives = 3;
            gameState.active = true;
            document.getElementById('modal-continue').classList.add('hidden');
            
            // Notificar al Dashboard
            if(window.parent && window.parent.updateUIBalance) {
                window.parent.updateUIBalance(data.newBalance);
            }

            respawn();
            gameLoop();
        } else {
            alert(data.error || "Honor insuficiente (Sin fichas).");
            finishGame();
        }
    } catch (err) {
        console.error("Error:", err);
        alert("El Dojo no responde.");
    } finally {
        btn.disabled = false;
        btn.innerText = "CONTINUAR (1 FICHA)";
    }
}

async function finishGame() {
    const token = localStorage.getItem("token");
    const score = Math.floor(gameState.distance);

    try {
        await fetch(`${API_URL}/api/games/save-score`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ score, game: 'ninja-waves' })
        });
        alert(`RECORD FINAL: ${score}m`);
        window.parent.closeGame(); 
    } catch (e) {
        window.parent.closeGame();
    }
}

// --- RENDERIZADO (DRAW) ---
function draw() {
    // 1. Dibujar Jugador
    ctx.shadowBlur = gameState.isInvulnerable ? 20 : 10;
    ctx.shadowColor = gameState.isInvulnerable ? "#ffb400" : "#ff0000";
    ctx.fillStyle = gameState.isInvulnerable ? "#ffb400" : PLAYER.color;
    
    // Forma de diamante para el jugador (más Ninja)
    ctx.beginPath();
    ctx.moveTo(PLAYER.x, gameState.playerY + PLAYER.size/2); // Left
    ctx.lineTo(PLAYER.x + PLAYER.size/2, gameState.playerY); // Top
    ctx.lineTo(PLAYER.x + PLAYER.size, gameState.playerY + PLAYER.size/2); // Right
    ctx.lineTo(PLAYER.x + PLAYER.size/2, gameState.playerY + PLAYER.size); // Bottom
    ctx.fill();

    ctx.shadowBlur = 0; // Reset sombra

    // 2. Dibujar Obstáculos
    ctx.fillStyle = "#1a1a1a"; // Gris oscuro
    ctx.strokeStyle = "#8e0000"; // Borde Rojo Ninja
    ctx.lineWidth = 2;

    gameState.obstacles.forEach(obs => {
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        
        // Detalle visual: Línea decorativa
        ctx.beginPath();
        ctx.moveTo(obs.x + 10, obs.y);
        ctx.lineTo(obs.x + 10, obs.y + obs.h);
        ctx.strokeStyle = "rgba(142, 0, 0, 0.3)";
        ctx.stroke();
    });
}

// --- HUD Y EVENTOS ---
function updateHUD() {
    const distEl = document.getElementById('hud-distance');
    if(distEl) distEl.innerText = `${Math.floor(gameState.distance)}m`;
    
    const livesEl = document.getElementById('hud-lives');
    if(livesEl) livesEl.innerText = '🏮'.repeat(gameState.lives);
    
    const contEl = document.getElementById('hud-continues');
    if(contEl) contEl.innerText = `RE-COMPRAS: ${gameState.continues}/5`;
}

function triggerVisualCheckpoint() {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.background = 'rgba(255, 180, 0, 0.2)';
    flash.style.zIndex = '50';
    flash.style.pointerEvents = 'none';
    flash.style.transition = 'opacity 0.5s';
    document.body.appendChild(flash);
    
    setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 500);
    }, 100);
}

// Input Handling
window.addEventListener('mousedown', () => isPressing = true);
window.addEventListener('mouseup', () => isPressing = false);
window.addEventListener('touchstart', (e) => { e.preventDefault(); isPressing = true; }, {passive: false});
window.addEventListener('touchend', (e) => { e.preventDefault(); isPressing = false; }, {passive: false});

// Botones
document.getElementById('btn-recompra').onclick = requestContinue;
document.getElementById('btn-rendirse').onclick = finishGame;

// Arrancar
init();
import { API_URL } from "../../js/api.js";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- AJUSTES DE FÍSICA (TWEAK HERE) ---
const PHYSICS = {
    gravity: 0.25,        // Antes 0.6 (Más suave)
    lift: -5,             // Impulso al tocar (Salto instantáneo)
    friction: 0.9,        // Resistencia del aire
    maxVelocity: 6,       // Límite de velocidad (Para que no se teletransporte)
    gameSpeedStart: 4     // Velocidad horizontal inicial
};

// --- ESTADO DEL JUEGO ---
let gameState = {
    distance: 0,
    lives: 3,
    continues: 0,
    lastCheckpoint: 0,
    isInvulnerable: false,
    active: true,
    speed: PHYSICS.gameSpeedStart,
    playerY: 0,
    velocity: 0, // Velocidad vertical actual
    obstacles: [],
    nextObstacleAt: 0
};

// Jugador adaptable
let PLAYER = { x: 50, size: 30, color: '#8e0000' };
let isPressing = false;

// --- INICIALIZACIÓN ---
function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Iniciar posiciones
    gameState.playerY = canvas.height / 2;
    gameState.nextObstacleAt = 200;
    
    bindButtons();
    gameLoop();
}

// Ajuste dinámico de pantalla
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // El jugador es el 5% del ancho de la pantalla (Responsive)
    // Pero con límites (mínimo 20px, máximo 40px)
    const rawSize = canvas.width * 0.08; 
    PLAYER.size = Math.max(20, Math.min(rawSize, 40));
    PLAYER.x = canvas.width * 0.15; // Posición X relativa (15% izquierda)
}

function bindButtons() {
    const btnRecompra = document.getElementById('btn-recompra');
    const btnRendirse = document.getElementById('btn-rendirse');

    if (btnRecompra) {
        btnRecompra.onclick = (e) => { e.stopPropagation(); requestContinue(); };
        // Soporte táctil específico para botones
        btnRecompra.ontouchend = (e) => { e.stopPropagation(); requestContinue(); };
    }
    if (btnRendirse) {
        btnRendirse.onclick = (e) => { e.stopPropagation(); finishGame(); };
    }
}

// --- BUCLE PRINCIPAL ---
function gameLoop() {
    if (!gameState.active) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    updatePhysics();
    manageObstacles();
    checkCollisions();
    handleProgression();
    draw();

    requestAnimationFrame(gameLoop);
}

// --- FÍSICAS MEJORADAS (CONTROL DE CHAKRA) ---
function updatePhysics() {
    // 1. Aplicar Gravedad constante
    gameState.velocity += PHYSICS.gravity;

    // 2. Aplicar "Salto" si se presiona
    if (isPressing) {
        // En lugar de sumar, aplicamos una fuerza contraria suave
        gameState.velocity -= 0.5; 
        // Cap de impulso máximo hacia arriba
        if (gameState.velocity < PHYSICS.lift) gameState.velocity = PHYSICS.lift;
    }

    // 3. Velocidad Terminal (Límite de velocidad)
    // Evita que caiga o suba demasiado rápido
    if (gameState.velocity > PHYSICS.maxVelocity) gameState.velocity = PHYSICS.maxVelocity;
    if (gameState.velocity < -PHYSICS.maxVelocity) gameState.velocity = -PHYSICS.maxVelocity;

    // 4. Mover Jugador
    gameState.playerY += gameState.velocity;

    // 5. Límites de Pantalla (Suelo y Techo)
    if (gameState.playerY >= canvas.height - PLAYER.size) {
        gameState.playerY = canvas.height - PLAYER.size;
        gameState.velocity = 0; // Detener al tocar suelo
        onDeath(); // Opcional: Morir al tocar suelo
    }
    if (gameState.playerY <= 0) {
        gameState.playerY = 0;
        gameState.velocity = 0; // Detener al tocar techo
        onDeath();
    }
}

// --- OBSTÁCULOS RELATIVOS ---
function manageObstacles() {
    // Mover
    gameState.obstacles.forEach(obs => obs.x -= gameState.speed);
    // Limpiar
    gameState.obstacles = gameState.obstacles.filter(obs => obs.x + obs.w > -100);

    // Spawn inteligente basado en ancho de pantalla
    // Convertimos metros a pixeles relativos
    const spawnX = canvas.width + 50; 
    
    // Checkear si toca generar (usamos distancia virtual)
    if (gameState.distance >= gameState.nextObstacleAt) {
        spawnGate(spawnX);
        // Próximo obstáculo en X metros relativos
        gameState.nextObstacleAt += 25 + (Math.random() * 15); 
    }
}

function spawnGate(xPos) {
    const wallWidth = canvas.width * 0.12; // Muros son 12% de pantalla
    
    // Hueco dinámico: más pequeño cuanto más rápido, pero nunca imposible
    // El hueco base es el 35% de la altura de la pantalla
    let gapHeight = (canvas.height * 0.35) - (gameState.speed * 2);
    gapHeight = Math.max(gapHeight, PLAYER.size * 2.5); // Mínimo 2.5 veces el jugador

    const minGapY = canvas.height * 0.1;
    const maxGapY = canvas.height * 0.9 - gapHeight;
    const gapTopY = Math.random() * (maxGapY - minGapY) + minGapY;

    // Top Wall
    gameState.obstacles.push({
        x: xPos, y: 0, 
        w: wallWidth, h: gapTopY 
    });

    // Bottom Wall
    gameState.obstacles.push({
        x: xPos, y: gapTopY + gapHeight, 
        w: wallWidth, h: canvas.height - (gapTopY + gapHeight)
    });
}

// --- COLISIONES ---
function checkCollisions() {
    if (gameState.isInvulnerable) return;

    // Hitbox un poco más pequeña que el sprite visual (Perdón al jugador)
    const padding = 6;
    const pRect = { 
        x: PLAYER.x + padding, 
        y: gameState.playerY + padding, 
        w: PLAYER.size - (padding*2), 
        h: PLAYER.size - (padding*2) 
    };

    for (let obs of gameState.obstacles) {
        if (
            pRect.x < obs.x + obs.w &&
            pRect.x + pRect.w > obs.x &&
            pRect.y < obs.y + obs.h &&
            pRect.y + pRect.h > obs.y
        ) {
            onDeath();
            return;
        }
    }
}

// --- GAMEPLAY LOOP ---
function handleProgression() {
    // Distancia basada en velocidad
    gameState.distance += gameState.speed / 10;
    
    // Checkpoints
    if (gameState.distance >= gameState.lastCheckpoint + 500) {
        gameState.lastCheckpoint = Math.floor(gameState.distance);
        triggerVisualCheckpoint();
    }

    // Aumentar velocidad suavemente
    if (Math.floor(gameState.distance) > 0 && Math.floor(gameState.distance) % 500 === 0) {
        gameState.speed = Math.min(gameState.speed * 1.05, canvas.width * 0.02);
    }
    
    updateHUD();
}

// --- MUERTE ---
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
    gameState.playerY = canvas.height / 2;
    gameState.velocity = 0;
    gameState.isInvulnerable = true;
    gameState.obstacles = []; // Limpiar pantalla completa
    
    // Pausa técnica para acomodarse
    gameState.nextObstacleAt = gameState.distance + 50; 
    
    setTimeout(() => gameState.isInvulnerable = false, 2000);
}

function showGameOver() {
    gameState.active = false;
    const modal = document.getElementById('modal-continue');
    if(modal) {
        modal.classList.remove('hidden');
        bindButtons(); // Re-bind vital
    }
}

// --- RE-COMPRA ---
async function requestContinue() {
    const btn = document.getElementById('btn-recompra');
    const token = localStorage.getItem("token");
    if(btn) { btn.disabled = true; btn.innerText = "COBRANDO..."; }

    try {
        const res = await fetch(`${API_URL}/api/games/continue`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
        });
        const data = await res.json();
        
        if (res.ok) {
            gameState.continues++;
            gameState.lives = 3;
            gameState.active = true;
            document.getElementById('modal-continue').classList.add('hidden');
            if(window.parent?.updateUIBalance) window.parent.updateUIBalance(data.newBalance);
            respawn();
            gameLoop();
        } else {
            alert(data.error || "Sin fondos.");
            finishGame();
        }
    } catch (err) { alert("Error red"); finishGame(); }
    finally { if(btn) { btn.disabled = false; btn.innerText = "CONTINUAR (1 FICHA)"; } }
}

async function finishGame() {
    const token = localStorage.getItem("token");
    try {
        await fetch(`${API_URL}/api/games/save-score`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ score: Math.floor(gameState.distance), game: 'ninja-waves' })
        });
    } catch(e) {}
    if(window.parent?.closeGame) window.parent.closeGame();
    else window.location.reload();
}

// --- INPUT HANDLER (MOBILE FIX) ---
function handleInput(e, pressing) {
    // Si toco un botón, NO salto
    if(e.target.tagName === 'BUTTON') return;
    
    // Evitar zoom/scroll default
    if(e.type.startsWith('touch')) {
        // e.preventDefault(); // Ojo: a veces bloquea clicks UI, mejor usar CSS touch-action
    }
    isPressing = pressing;
}

window.addEventListener('mousedown', (e) => handleInput(e, true));
window.addEventListener('mouseup', (e) => handleInput(e, false));
window.addEventListener('touchstart', (e) => handleInput(e, true), {passive: false});
window.addEventListener('touchend', (e) => handleInput(e, false), {passive: false});

// --- RENDER ---
function draw() {
    // Jugador (Diamante)
    ctx.fillStyle = gameState.isInvulnerable ? "rgba(255, 180, 0, 0.5)" : PLAYER.color;
    ctx.shadowBlur = gameState.isInvulnerable ? 15 : 5;
    ctx.shadowColor = gameState.isInvulnerable ? "#ffb400" : "#ff0000";
    
    ctx.beginPath();
    ctx.moveTo(PLAYER.x, gameState.playerY + PLAYER.size/2);
    ctx.lineTo(PLAYER.x + PLAYER.size/2, gameState.playerY);
    ctx.lineTo(PLAYER.x + PLAYER.size, gameState.playerY + PLAYER.size/2);
    ctx.lineTo(PLAYER.x + PLAYER.size/2, gameState.playerY + PLAYER.size);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Obstáculos
    ctx.fillStyle = "#111";
    ctx.strokeStyle = "#600";
    ctx.lineWidth = 2;
    
    gameState.obstacles.forEach(obs => {
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    });
}

function updateHUD() {
    const d = document.getElementById('hud-distance');
    if(d) d.innerText = `${Math.floor(gameState.distance)}m`;
    const l = document.getElementById('hud-lives');
    if(l) l.innerText = '🏮'.repeat(gameState.lives);
}

function triggerVisualCheckpoint() {
    const f = document.createElement('div');
    f.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,180,0,0.2);pointer-events:none;transition:opacity 0.5s;z-index:90;';
    document.body.appendChild(f);
    setTimeout(() => { f.style.opacity='0'; setTimeout(()=>f.remove(),500); }, 100);
}

init();
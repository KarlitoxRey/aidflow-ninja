/* game.js */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Configuración visual
const COLORS = {
    player: '#ffffff', // Ninja Blanco
    enemy: '#8e0000',  // Enemigos Rojos (Sangre)
    food: '#ffb400',   // Oro (Puntos)
    grid: '#111'
};

const grid = 20;
let player, food, enemies, score, speed, gameLoop;
let isPlaying = false;
let highScore = localStorage.getItem("aidflowHighScore") || 0;

document.getElementById("highScore").innerText = highScore;

function startGame() {
    if (isPlaying) return;
    
    player = { x: 200, y: 200, dx: grid, dy: 0 };
    food = randomPosition();
    enemies = [];
    score = 0;
    speed = 120;
    isPlaying = true;

    document.getElementById("score").innerText = "0";
    document.getElementById("btnStart").innerText = "REINICIAR";

    clearInterval(gameLoop);
    gameLoop = setInterval(update, speed);
}

function randomPosition() {
    return {
        x: Math.floor(Math.random() * (canvas.width / grid)) * grid,
        y: Math.floor(Math.random() * (canvas.height / grid)) * grid
    };
}

function update() {
    // Fondo limpio
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Mover
    player.x += player.dx;
    player.y += player.dy;

    // 💀 Colisión Borde
    if (player.x < 0 || player.x >= canvas.width || player.y < 0 || player.y >= canvas.height) {
        endGame();
        return;
    }

    // 🍏 Comer Oro
    if (player.x === food.x && player.y === food.y) {
        score += 10;
        document.getElementById("score").innerText = score;
        
        food = randomPosition();
        enemies.push(randomPosition()); // + Dificultad

        // Acelerar
        if (speed > 50) {
            speed -= 2;
            clearInterval(gameLoop);
            gameLoop = setInterval(update, speed);
        }
    }

    // 🖌️ DIBUJAR

    // Comida (Oro) - Efecto brillo
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLORS.food;
    ctx.fillStyle = COLORS.food;
    ctx.fillRect(food.x + 2, food.y + 2, grid - 4, grid - 4);
    ctx.shadowBlur = 0;

    // Jugador (Ninja)
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(player.x, player.y, grid, grid);

    // Enemigos (Amenazas)
    ctx.fillStyle = COLORS.enemy;
    enemies.forEach(e => {
        ctx.beginPath();
        ctx.arc(e.x + 10, e.y + 10, 8, 0, Math.PI * 2);
        ctx.fill();

        // Colisión Enemigo
        if (e.x === player.x && e.y === player.y) {
            endGame();
        }
    });
}

function endGame() {
    clearInterval(gameLoop);
    isPlaying = false;
    document.getElementById("btnStart").innerText = "INTENTAR DE NUEVO";

    if (score > highScore) {
        highScore = score;
        localStorage.setItem("aidflowHighScore", highScore);
        document.getElementById("highScore").innerText = highScore;
    }

    // 📡 ENVIAR PUNTAJE VIA SDK
    if (window.AidFlow) {
        window.AidFlow.sendScore(score);
    }

    // Feedback visual simple
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "#fff";
    ctx.font = "30px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText("MISION FALLIDA", canvas.width/2, canvas.height/2 - 20);
    
    ctx.fillStyle = COLORS.gold;
    ctx.font = "20px Roboto";
    ctx.fillText(`Puntos: ${score}`, canvas.width/2, canvas.height/2 + 20);
}

// Controles
document.addEventListener("keydown", e => {
    // Prevenir scroll con flechas
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
    }

    // Reiniciar con Espacio si murió
    if (e.code === "Space" && !isPlaying) {
        startGame();
        return;
    }

    const goingUp = player.dy === -grid;
    const goingDown = player.dy === grid;
    const goingRight = player.dx === grid;
    const goingLeft = player.dx === -grid;

    if ((e.key === "ArrowUp" || e.key === "w") && !goingDown) {
        player.dx = 0; player.dy = -grid;
    }
    if ((e.key === "ArrowDown" || e.key === "s") && !goingUp) {
        player.dx = 0; player.dy = grid;
    }
    if ((e.key === "ArrowLeft" || e.key === "a") && !goingRight) {
        player.dx = -grid; player.dy = 0;
    }
    if ((e.key === "ArrowRight" || e.key === "d") && !goingLeft) {
        player.dx = grid; player.dy = 0;
    }
});
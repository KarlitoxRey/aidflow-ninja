const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const COLORS = {
    player: '#ffffff',
    enemy: '#8e0000',
    food: '#ffb400',
    grid: '#111'
};

const grid = 20;
let player, food, enemies, score, speed, gameLoop;
let isPlaying = false;
let highScore = localStorage.getItem("aidflowHighScore") || 0;

// Detectar modo automáticamente
let mode = document.body.getAttribute("data-mode"); // "practice" o "tournament"
let lives = (mode === "tournament") ? 3 : Infinity;

document.getElementById("highScore").innerText = highScore;
document.getElementById("gameModeLabel").innerText = 
    (mode === "tournament") ? "Modo Torneo (3 vidas)" : "Modo Práctica (libre)";
document.getElementById("lives").innerText = (mode === "tournament") ? lives : "∞";

function startGame() {
    if (isPlaying) return;
    
    player = { x: 200, y: 200, dx: grid, dy: 0 };
    food = randomPosition();
    enemies = [];
    score = 0;
    speed = 120;
    isPlaying = true;

    document.getElementById("score").innerText = "0";

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
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    player.x += player.dx;
    player.y += player.dy;

    if (player.x < 0 || player.x >= canvas.width || player.y < 0 || player.y >= canvas.height) {
        endGame();
        return;
    }

    if (player.x === food.x && player.y === food.y) {
        score += 10;
        document.getElementById("score").innerText = score;
        
        food = randomPosition();
        enemies.push(randomPosition());

        if (speed > 50) {
            speed -= 2;
            clearInterval(gameLoop);
            gameLoop = setInterval(update, speed);
        }
    }

    ctx.shadowBlur = 15;
    ctx.shadowColor = COLORS.food;
    ctx.fillStyle = COLORS.food;
    ctx.fillRect(food.x + 2, food.y + 2, grid - 4, grid - 4);
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.player;
    ctx.fillRect(player.x, player.y, grid, grid);

    ctx.fillStyle = COLORS.enemy;
    enemies.forEach(e => {
        ctx.beginPath();
        ctx.arc(e.x + 10, e.y + 10, 8, 0, Math.PI * 2);
        ctx.fill();

        if (e.x === player.x && e.y === player.y) {
            endGame();
        }
    });
}

function endGame() {
    clearInterval(gameLoop);
    isPlaying = false;

    if (mode === "tournament") {
        lives--;
        document.getElementById("lives").innerText = lives;
        if (lives > 0) {
            return; // sigue jugando
        }
    }

    if (score > highScore) {
        highScore = score;
        localStorage.setItem("aidflowHighScore", highScore);
        document.getElementById("highScore").innerText = highScore;
    }

    saveScore(score, mode);
    showRanking(mode);

    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "30px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText("MISION FALLIDA", canvas.width/2, canvas.height/2 - 20);
    ctx.fillStyle = COLORS.food;
    ctx.font = "20px Roboto";
    ctx.fillText(`Puntos: ${score}`, canvas.width/2, canvas.height/2 + 20);
}

function saveScore(score, mode) {
    let key = (mode === "tournament") ? "aidflowTournamentRanking" : "aidflowPracticeRanking";
    let ranking = JSON.parse(localStorage.getItem(key)) || [];
    ranking.push({ user: "Jugador", score });
    ranking.sort((a,b) => b.score - a.score);
    localStorage.setItem(key, JSON.stringify(ranking));
}

function showRanking(mode) {
    let key = (mode === "tournament") ? "aidflowTournamentRanking" : "aidflowPracticeRanking";
    let ranking = JSON.parse(localStorage.getItem(key)) || [];
    let html = "<h2>Ranking " + (mode === "tournament" ? "Torneo" : "Práctica") + "</h2><ol>";
    ranking.slice(0,10).forEach(r => {
        html += `<li>${r.user}: ${r.score}</li>`;
    });
    html += "</ol>";
    document.getElementById("ranking").innerHTML = html;
}

// Botón salir
document.getElementById("btnExit").addEventListener("click", () => {
    clearInterval(gameLoop);
    isPlaying = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Controles teclado
document.addEventListener("keydown", e => {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
    }
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

// Controles táctiles (mobile)
let touchStartX, touchStartY;
canvas.addEventListener("touchstart", e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});
canvas.addEventListener("touchend", e => {

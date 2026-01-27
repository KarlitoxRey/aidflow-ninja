document.addEventListener("DOMContentLoaded", () => {
  initParticles();
});

// Funciones globales para el modal de juegos
window.openGame = function(src){
  const modal = document.getElementById('game-modal');
  const frame = document.getElementById('game-frame');
  if(modal && frame) {
      frame.src = src;
      modal.style.display = 'flex'; // Usamos flex para centrar según tu CSS inline
      modal.classList.remove('hidden');
  }
};

window.closeGame = function(){
  const modal = document.getElementById('game-modal');
  const frame = document.getElementById('game-frame');
  if(modal && frame) {
      frame.src = '';
      modal.style.display = 'none';
      modal.classList.add('hidden');
  }
};

/* Partículas livianas - Optimizado */
function initParticles(){
  const canvas = document.getElementById('particles-canvas');
  if(!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Ajuste dinámico al redimensionar
  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const particles = Array.from({length: 50}).map(()=>({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 2 + 1,
    // Colores del Clan: Rojo Sangre y Oro Shogun
    c: Math.random() > .5 ? 'rgba(217, 4, 41, 0.4)' : 'rgba(255, 183, 3, 0.3)', 
    s: Math.random() * 0.4 + 0.2
  }));

  function animate(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c;
      ctx.fill();
      p.y += p.s;
      if(p.y > canvas.height) p.y = 0;
    });
    requestAnimationFrame(animate);
  }
  animate();
}

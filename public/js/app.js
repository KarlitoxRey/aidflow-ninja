document.addEventListener("DOMContentLoaded", () => {
  initParticles();
});

function openGame(src){
  document.getElementById('game-frame').src = src;
  document.getElementById('game-modal').classList.remove('hidden');
}

function closeGame(){
  document.getElementById('game-frame').src = '';
  document.getElementById('game-modal').classList.add('hidden');
}

/* Partículas livianas */
function initParticles(){
  const canvas = document.getElementById('particles-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({length:50}).map(()=>({
    x:Math.random()*canvas.width,
    y:Math.random()*canvas.height,
    r:Math.random()*2+1,
    c:Math.random()>.5?'rgba(177,18,38,.5)':'rgba(201,162,77,.5)',
    s:Math.random()*.4+.2
  }));

  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.c;
      ctx.fill();
      p.y+=p.s;
      if(p.y>canvas.height)p.y=0;
    });
    requestAnimationFrame(animate);
  }
  animate();
}
// En tu app.js optimizado
const particles = Array.from({length:50}).map(()=>({
    x: Math.random()*canvas.width,
    y: Math.random()*canvas.height,
    r: Math.random()*2+1,
    // Usando tus colores de variables: Rojo (#d90429) y Dorado (#ffb703)
    c: Math.random() > .5 ? 'rgba(217, 4, 41, 0.4)' : 'rgba(255, 183, 3, 0.3)', 
    s: Math.random() * .4 + .2
}));
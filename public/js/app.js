document.addEventListener("DOMContentLoaded", () => {
  if (typeof initParticles === "function") initParticles();
});

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
    c:Math.random()>.5?'rgba(217, 4, 41, 0.4)':'rgba(255, 183, 3, 0.3)',
    s:Math.random()*.4+.2
  }));

  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.c; ctx.fill();
      p.y+=p.s;
      if(p.y>canvas.height)p.y=0;
    });
    requestAnimationFrame(animate);
  }
  animate();
}

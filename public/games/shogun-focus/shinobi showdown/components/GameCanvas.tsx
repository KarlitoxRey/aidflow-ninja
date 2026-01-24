
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Entity, 
  NinjaType, 
  Platform, 
  Particle, 
  GameState 
} from '../types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  GRAVITY, 
  FRICTION, 
  MAX_JUMPS, 
  NINJA_CONFIGS 
} from '../constants';

interface GameCanvasProps {
  playerType: NinjaType;
  enemyType: NinjaType;
  onGameOver: (winner: string) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ playerType, enemyType, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const keys = useRef<Record<string, boolean>>({});

  const [gameState, setGameState] = useState<GameState>(() => {
    const p1Stats = NINJA_CONFIGS[playerType];
    const p2Stats = NINJA_CONFIGS[enemyType];

    return {
      player: createEntity(CANVAS_WIDTH * 0.25, 100, playerType),
      enemy: createEntity(CANVAS_WIDTH * 0.75, 100, enemyType),
      platforms: [
        { x: 200, y: 450, width: 600, height: 40, color: '#333' }, // Main Floor
        { x: 100, y: 300, width: 200, height: 20, color: '#444' }, // Left Platform
        { x: 700, y: 300, width: 200, height: 20, color: '#444' }, // Right Platform
        { x: 400, y: 200, width: 200, height: 20, color: '#444' }, // Top Platform
      ],
      particles: [],
      winner: null
    };
  });

  function createEntity(x: number, y: number, type: NinjaType): Entity {
    return {
      pos: { x, y },
      vel: { x: 0, y: 0 },
      width: 40,
      height: 60,
      isGrounded: false,
      jumpsLeft: MAX_JUMPS,
      damage: 0,
      facing: x < CANVAS_WIDTH / 2 ? 1 : -1,
      state: 'idle',
      attackTimer: 0,
      type
    };
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    keys.current[e.key.toLowerCase()] = true;
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keys.current[e.key.toLowerCase()] = false;
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const update = useCallback(() => {
    setGameState(prev => {
      if (prev.winner) return prev;

      const newState = { ...prev };
      const { player, enemy, platforms } = newState;

      // Handle Input - Player 1 (WASD + Space)
      const pStats = NINJA_CONFIGS[player.type];
      const moveSpeed = 8 * pStats.speed;
      
      if (keys.current['a']) {
        player.vel.x = -moveSpeed;
        player.facing = -1;
        player.state = 'running';
      } else if (keys.current['d']) {
        player.vel.x = moveSpeed;
        player.facing = 1;
        player.state = 'running';
      } else {
        player.vel.x *= FRICTION;
        player.state = player.isGrounded ? 'idle' : 'jumping';
      }

      if (keys.current['w'] && player.jumpsLeft > 0 && !keys.current['w_pressed']) {
        player.vel.y = -pStats.jumpForce;
        player.jumpsLeft--;
        player.isGrounded = false;
        keys.current['w_pressed'] = true;
      }
      if (!keys.current['w']) keys.current['w_pressed'] = false;

      // Simple AI for Enemy
      const eStats = NINJA_CONFIGS[enemy.type];
      const dist = player.pos.x - enemy.pos.x;
      if (Math.abs(dist) > 100) {
        enemy.vel.x = (dist > 0 ? 1 : -1) * 4 * eStats.speed;
        enemy.facing = dist > 0 ? 1 : -1;
      } else {
        enemy.vel.x *= FRICTION;
        // AI Attack chance
        if (Math.random() < 0.02 && enemy.attackTimer === 0) {
          enemy.attackTimer = 15;
          enemy.state = 'attacking';
        }
      }
      if (enemy.isGrounded && Math.random() < 0.01) {
          enemy.vel.y = -eStats.jumpForce;
          enemy.isGrounded = false;
      }

      // Physics Application
      [player, enemy].forEach(e => {
        e.vel.y += GRAVITY;
        e.pos.x += e.vel.x;
        e.pos.y += e.vel.y;
        e.isGrounded = false;

        // Platform Collision
        platforms.forEach(p => {
          if (
            e.pos.x + e.width > p.x &&
            e.pos.x < p.x + p.width &&
            e.pos.y + e.height > p.y &&
            e.pos.y + e.height < p.y + p.height + 10 &&
            e.vel.y >= 0
          ) {
            e.pos.y = p.y - e.height;
            e.vel.y = 0;
            e.isGrounded = true;
            e.jumpsLeft = MAX_JUMPS;
          }
        });

        // Screen Boundaries (Brawlhalla style - off stage is death)
        if (e.pos.y > CANVAS_HEIGHT + 200 || e.pos.x < -200 || e.pos.x > CANVAS_WIDTH + 200) {
          newState.winner = e === player ? NINJA_CONFIGS[enemy.type].name : NINJA_CONFIGS[player.type].name;
        }
      });

      // Attacks
      if (keys.current[' '] && player.attackTimer === 0) {
        player.attackTimer = 15;
        player.state = 'attacking';
      }

      [player, enemy].forEach((attacker, idx) => {
        const victim = idx === 0 ? enemy : player;
        if (attacker.attackTimer > 0) {
          attacker.attackTimer--;
          attacker.state = 'attacking';
          
          // Hit Detection
          const aStats = NINJA_CONFIGS[attacker.type];
          const hitRange = aStats.range;
          const hitX = attacker.facing === 1 ? attacker.pos.x + attacker.width : attacker.pos.x - hitRange;
          
          if (
            attacker.attackTimer === 10 && // Check hit mid-animation
            hitX + hitRange > victim.pos.x &&
            hitX < victim.pos.x + victim.width &&
            attacker.pos.y + attacker.height > victim.pos.y &&
            attacker.pos.y < victim.pos.y + victim.height
          ) {
            // Damage scaling
            victim.damage += 15 * aStats.strength;
            // Knockback logic
            const kbBase = 5;
            const kbScale = victim.damage / 20;
            victim.vel.x = attacker.facing * (kbBase + kbScale);
            victim.vel.y = - (kbBase + kbScale / 2);
            victim.state = 'hurt';
            
            // Particles
            for (let i = 0; i < 5; i++) {
              newState.particles.push({
                pos: { x: victim.pos.x + victim.width / 2, y: victim.pos.y + victim.height / 2 },
                vel: { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10 },
                life: 30,
                color: aStats.color,
                size: Math.random() * 5 + 2
              });
            }
          }
        }
      });

      // Particle update
      newState.particles = newState.particles.filter(p => {
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;
        p.life--;
        return p.life > 0;
      });

      return newState;
    });

    requestRef.current = requestAnimationFrame(update);
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  // Effect to handle game over
  useEffect(() => {
    if (gameState.winner) {
      onGameOver(gameState.winner);
    }
  }, [gameState.winner, onGameOver]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background (Gradient)
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Moonlight
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH * 0.8, 100, 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 50;
    ctx.shadowColor = 'white';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Platforms
    gameState.platforms.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.width, p.height);
      // Detail
      ctx.strokeStyle = '#222';
      ctx.strokeRect(p.x, p.y, p.width, p.height);
    });

    // Particles
    gameState.particles.forEach(p => {
      ctx.globalAlpha = p.life / 30;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.pos.x, p.pos.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    // Draw Ninjas
    [gameState.player, gameState.enemy].forEach(n => {
      const stats = NINJA_CONFIGS[n.type];
      ctx.save();
      ctx.translate(n.pos.x + n.width / 2, n.pos.y + n.height / 2);
      if (n.facing === -1) ctx.scale(-1, 1);

      // Body
      ctx.fillStyle = stats.color;
      ctx.fillRect(-n.width / 2, -n.height / 2, n.width, n.height);
      
      // Head/Mask
      ctx.fillStyle = '#000';
      ctx.fillRect(-n.width / 2, -n.height / 2, n.width, n.height / 3);
      
      // Eyes (Glow)
      ctx.fillStyle = n.type === NinjaType.AZURE ? '#00ffff' : n.type === NinjaType.CRIMSON ? '#ff0000' : '#ffffff';
      ctx.fillRect(n.width / 6, -n.height / 2.5, 8, 4);
      
      // Scarf/Accents
      ctx.fillStyle = stats.secondaryColor;
      ctx.fillRect(-n.width / 2, n.height / 6, n.width, 5);

      // Weapon
      if (n.state === 'attacking') {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(n.width / 2, 0);
        ctx.lineTo(n.width / 2 + stats.range, 0);
        ctx.stroke();
      }

      ctx.restore();

      // Damage Indicator
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Roboto';
      ctx.textAlign = 'center';
      const colorIntensity = Math.min(255, n.damage * 2);
      ctx.fillStyle = `rgb(255, ${255 - colorIntensity}, ${255 - colorIntensity})`;
      ctx.fillText(`${Math.floor(n.damage)}%`, n.pos.x + n.width / 2, n.pos.y - 10);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Roboto';
      ctx.fillText(stats.name, n.pos.x + n.width / 2, n.pos.y - 25);
    });
  }, [gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderLoop = () => {
      draw(ctx);
      requestAnimationFrame(renderLoop);
    };
    const animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [draw]);

  return (
    <div className="relative border-4 border-gray-800 rounded-lg shadow-2xl overflow-hidden bg-black">
      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT} 
      />
      
      {/* HUD overlays */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
         <div className="bg-black/50 p-2 rounded text-white border-l-4 border-blue-500">
            <div className="text-xs uppercase font-bold opacity-70">Player</div>
            <div className="text-xl font-ninja">{NINJA_CONFIGS[playerType].name}</div>
         </div>
      </div>
      
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
         <div className="bg-black/50 p-2 rounded text-white border-r-4 border-red-500 text-right">
            <div className="text-xs uppercase font-bold opacity-70">CPU</div>
            <div className="text-xl font-ninja">{NINJA_CONFIGS[enemyType].name}</div>
         </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs text-center font-bold">
        WASD to Move | SPACE to Attack | Double Jump with W
      </div>
    </div>
  );
};

export default GameCanvas;

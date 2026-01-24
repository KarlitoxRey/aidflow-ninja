
export enum NinjaType {
  SHADOW = 'SHADOW',
  CRIMSON = 'CRIMSON',
  JADE = 'JADE',
  AZURE = 'AZURE'
}

export interface Vector {
  x: number;
  y: number;
}

export interface NinjaStats {
  speed: number;
  strength: number;
  weight: number;
  jumpForce: number;
  range: number;
  color: string;
  secondaryColor: string;
  name: string;
  description: string;
}

export interface Entity {
  pos: Vector;
  vel: Vector;
  width: number;
  height: number;
  isGrounded: boolean;
  jumpsLeft: number;
  damage: number; // Damage percentage (0-???)
  facing: 1 | -1;
  state: 'idle' | 'running' | 'jumping' | 'attacking' | 'hurt';
  attackTimer: number;
  type: NinjaType;
}

export interface GameState {
  player: Entity;
  enemy: Entity;
  platforms: Platform[];
  particles: Particle[];
  winner: string | null;
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface Particle {
  pos: Vector;
  vel: Vector;
  life: number;
  color: string;
  size: number;
}

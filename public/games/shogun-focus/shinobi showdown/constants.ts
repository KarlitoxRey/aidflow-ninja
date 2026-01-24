
import { NinjaType, NinjaStats } from './types';

export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 600;
export const GRAVITY = 0.5;
export const FRICTION = 0.85;
export const MAX_JUMPS = 2;

export const NINJA_CONFIGS: Record<NinjaType, NinjaStats> = {
  [NinjaType.SHADOW]: {
    name: 'Kage (Shadow)',
    description: 'Ultra fast and agile. Uses stealth to strike quickly.',
    speed: 1.2,
    strength: 0.8,
    weight: 0.7,
    jumpForce: 13,
    range: 60,
    color: '#1a1a1a',
    secondaryColor: '#4a4a4a'
  },
  [NinjaType.CRIMSON]: {
    name: 'Hanzo (Crimson)',
    description: 'Powerful fire attacks. Heavy hitter but slower.',
    speed: 0.85,
    strength: 1.4,
    weight: 1.2,
    jumpForce: 11,
    range: 70,
    color: '#b91c1c',
    secondaryColor: '#ef4444'
  },
  [NinjaType.JADE]: {
    name: 'Orochi (Jade)',
    description: 'Expert with the chain scythe. Long range zoning.',
    speed: 1.0,
    strength: 0.9,
    weight: 0.9,
    jumpForce: 12,
    range: 120,
    color: '#065f46',
    secondaryColor: '#10b981'
  },
  [NinjaType.AZURE]: {
    name: 'Yuki (Azure)',
    description: 'Cold and calculating. Defensive ice master.',
    speed: 0.95,
    strength: 1.1,
    weight: 1.0,
    jumpForce: 11.5,
    range: 80,
    color: '#1e3a8a',
    secondaryColor: '#3b82f6'
  }
};

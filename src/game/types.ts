export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type AtmospherePreset = 'golden' | 'rainy' | 'dawn';

export interface GraphicsSettings {
  atmosphere: AtmospherePreset;
  volumetricLights: boolean;
  particles: boolean;
  bloom: boolean;
  dynamicReflections: boolean;
}

export type LaneIndex = -1 | 0 | 1;

export type ObstacleKind =
  | 'train_parked'
  | 'train_ramp'
  | 'train_oncoming'
  | 'barrier_low'
  | 'barrier_high'
  | 'barrier_full';

export type PowerupKind = 'magnet' | 'jetpack' | 'sneakers' | 'hoverboard';

export interface ObstacleEntity {
  id: number;
  kind: ObstacleKind;
  lane: LaneIndex;
  /** Front-to-back center position along -Z (more negative = further ahead) */
  z: number;
  /** Total length along Z */
  length: number;
  /** Height of obstacle top */
  height: number;
  /** For train_ramp: length of the front climbable ramp */
  rampLength: number;
  /** Extra oncoming velocity (positive means moving toward player +Z) */
  speed: number;
  /** Visual variant index (0..2) for train livery color */
  variant: number;
  /** Has already caused a graze or been cleared by shield */
  cleared?: boolean;
}

export interface CoinEntity {
  id: number;
  lane: LaneIndex;
  x: number;
  y: number;
  z: number;
  collected: boolean;
  magnetized: boolean;
}

export interface PowerupEntity {
  id: number;
  kind: PowerupKind;
  lane: LaneIndex;
  y: number;
  z: number;
  collected: boolean;
}

export interface PlayerState {
  lane: LaneIndex;
  prevLane: LaneIndex;
  x: number;
  vx: number;
  y: number;
  vy: number;
  z: number;
  groundY: number;
  grounded: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  rollBufferTimer: number;
  rolling: boolean;
  rollTimer: number;
  squashX: number;
  squashY: number;
  tiltZ: number;
  runCycle: number;
  stumbleTimer: number;
  stumbleCount: number;
  invulnerableTimer: number;
  /** Active powerup timers (seconds remaining) */
  magnetTimer: number;
  jetpackTimer: number;
  sneakersTimer: number;
  hoverboardTimer: number;
  hoverboardCharges: number;
  /** Chase inspector threat level 0..1 */
  pursuerProximity: number;
}

export type GameEventType =
  | 'jump'
  | 'land'
  | 'roll'
  | 'lane_switch'
  | 'coin'
  | 'powerup'
  | 'stumble'
  | 'hoverboard_on'
  | 'shield_break'
  | 'crash'
  | 'jetpack_start';

export interface GameEvent {
  type: GameEventType;
  x: number;
  y: number;
  z: number;
  powerup?: PowerupKind;
  combo?: number;
}

export interface RunSummary {
  score: number;
  bestScore: number;
  coins: number;
  distance: number;
  maxSpeedKmh: number;
  isNewBest: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  score: number;
  bestScore: number;
  coins: number;
  distance: number;
  speedKmh: number;
  multiplier: number;
  hoverboardCharges: number;
  hoverboardActive: boolean;
  magnetRatio: number;
  jetpackRatio: number;
  sneakersRatio: number;
  hoverboardRatio: number;
  stumbleWarning: boolean;
  runSummary: RunSummary | null;
}

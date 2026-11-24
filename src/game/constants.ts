import type { AtmospherePreset } from './types';

export const LANE_WIDTH = 3.1;
export const LANE_X: Record<-1 | 0 | 1, number> = {
  [-1]: -LANE_WIDTH,
  [0]: 0,
  [1]: LANE_WIDTH,
};

export const PLAYER_RADIUS = 0.48;
export const PLAYER_HEIGHT_STAND = 1.75;
export const PLAYER_HEIGHT_ROLL = 0.78;

export const BASE_SPEED = 24.5;
export const MAX_SPEED = 56.0;
export const SPEED_RAMP_PER_SECOND = 0.36;
export const JETPACK_SPEED_BOOST = 14.0;
export const JETPACK_CRUISE_Y = 7.4;

export const GRAVITY = 52.0;
export const JUMP_VELOCITY = 17.6;
export const SUPER_JUMP_VELOCITY = 23.8;
export const FAST_FALL_VELOCITY = -38.0;

export const COYOTE_TIME = 0.11;
export const INPUT_BUFFER_TIME = 0.13;
export const ROLL_DURATION = 0.62;

export const TRAIN_HEIGHT = 3.55;
export const TRAIN_HALF_WIDTH = 1.24;
export const TRAIN_PARKED_LENGTH = 17.5;
export const TRAIN_RAMP_LENGTH = 20.5;
export const TRAIN_RAMP_SLOPE_LEN = 5.8;
export const TRAIN_ONCOMING_LENGTH = 18.0;
export const TRAIN_ONCOMING_SPEED = 16.5;

export const BARRIER_LOW_HEIGHT = 1.18;
export const BARRIER_HIGH_CLEARANCE = 1.12;
export const BARRIER_HIGH_TOP = 3.45;
export const BARRIER_FULL_HEIGHT = 2.7;

export const POWERUP_DURATION = {
  magnet: 11.0,
  jetpack: 7.5,
  sneakers: 12.0,
  hoverboard: 15.0,
} as const;

export const SAFE_OPENING_DISTANCE = 115;
export const SPAWN_AHEAD_DISTANCE = 210;
export const DESPAWN_BEHIND_DISTANCE = 28;
export const STUMBLE_RESET_TIME = 4.2;

export interface AtmospherePalette {
  label: string;
  skyTop: number;
  skyHorizon: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPos: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  rimColor: number;
  rimIntensity: number;
  beamColor: number;
  beamOpacity: number;
  lampColor: number;
  wetness: number;
  exposure: number;
  rain: boolean;
}

export const ATMOSPHERE_PRESETS: Record<AtmospherePreset, AtmospherePalette> = {
  golden: {
    label: 'Crépuscule Doré',
    skyTop: 0x162447,
    skyHorizon: 0xd97d48,
    fogColor: 0x3b2c38,
    fogDensity: 0.0072,
    sunColor: 0xffb366,
    sunIntensity: 3.1,
    sunPos: [28, 36, -65],
    hemiSky: 0x5c7fb8,
    hemiGround: 0x2b1d1a,
    hemiIntensity: 1.05,
    rimColor: 0x4ca8ff,
    rimIntensity: 1.4,
    beamColor: 0xffc680,
    beamOpacity: 0.12,
    lampColor: 0xffaa44,
    wetness: 0.88,
    exposure: 1.1,
    rain: false,
  },
  rainy: {
    label: 'Nuit Pluvieuse',
    skyTop: 0x050914,
    skyHorizon: 0x16273d,
    fogColor: 0x0d1726,
    fogDensity: 0.0086,
    sunColor: 0x7cb8ff,
    sunIntensity: 2.1,
    sunPos: [-24, 34, -55],
    hemiSky: 0x335a8a,
    hemiGround: 0x101520,
    hemiIntensity: 0.95,
    rimColor: 0x38bdf8,
    rimIntensity: 1.8,
    beamColor: 0x8ad4ff,
    beamOpacity: 0.15,
    lampColor: 0xffb85c,
    wetness: 1.0,
    exposure: 1.16,
    rain: true,
  },
  dawn: {
    label: 'Aube Industrielle',
    skyTop: 0x2a4569,
    skyHorizon: 0xe6b48a,
    fogColor: 0x586274,
    fogDensity: 0.0064,
    sunColor: 0xffe0b2,
    sunIntensity: 3.3,
    sunPos: [-32, 42, -70],
    hemiSky: 0x99bddb,
    hemiGround: 0x34312d,
    hemiIntensity: 1.25,
    rimColor: 0xffd199,
    rimIntensity: 1.1,
    beamColor: 0xffe4b8,
    beamOpacity: 0.11,
    lampColor: 0xffcf77,
    wetness: 0.65,
    exposure: 1.06,
    rain: false,
  },
};

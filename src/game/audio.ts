import type { GameEvent } from './types';

/**
 * 100% procedural Web Audio synthesizer for Metro Rush 3D.
 * Produces kinetic whooshes, ascending harmonic coin chimes, rail rumble,
 * metallic impacts, hoverboard plasma hum, and powerup fanfares with zero external files.
 */
export class SubwayAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.42, this.ctx.currentTime, 0.03);
    }
  }

  public unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.42;
      this.masterGain.connect(this.ctx.destination);

      // Continuous filtered-noise wind & rail ambience loop
      const bufLen = this.ctx.sampleRate * 2;
      const noiseBuf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 260;
      this.windFilter.Q.value = 0.9;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;

      src.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      src.start();
    } catch {
      this.ctx = null;
    }
  }

  public updateAmbience(active: boolean, speed: number, jetpack: boolean): void {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const now = this.ctx.currentTime;
    if (!active || this.muted) {
      this.windGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }
    const norm = Math.max(0, Math.min(1, (speed - 20) / 36));
    const targetGain = jetpack ? 0.22 : 0.04 + norm * 0.11;
    const targetFreq = jetpack ? 620 : 210 + norm * 420;
    this.windGain.gain.setTargetAtTime(targetGain, now, 0.12);
    this.windFilter.frequency.setTargetAtTime(targetFreq, now, 0.12);
  }

  public playEvent(ev: GameEvent): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    switch (ev.type) {
      case 'coin': {
        const step = (ev.combo ?? 1) % 12;
        const baseFreq = 660 * Math.pow(1.06, step);
        this.playTone(baseFreq, baseFreq * 1.48, 0.11, 'triangle', 0.22, now);
        break;
      }
      case 'lane_switch': {
        this.playNoiseSweep(520, 1100, 0.08, 0.12, now);
        break;
      }
      case 'jump': {
        this.playTone(210, 490, 0.14, 'sine', 0.22, now);
        break;
      }
      case 'land': {
        this.playTone(115, 58, 0.09, 'sine', 0.2, now);
        break;
      }
      case 'roll': {
        this.playNoiseSweep(900, 260, 0.14, 0.16, now);
        break;
      }
      case 'powerup': {
        this.playTone(523, 659, 0.12, 'triangle', 0.24, now);
        this.playTone(659, 1046, 0.18, 'triangle', 0.24, now + 0.09);
        break;
      }
      case 'hoverboard_on': {
        this.playTone(180, 560, 0.22, 'sawtooth', 0.18, now);
        break;
      }
      case 'jetpack_start': {
        this.playTone(160, 680, 0.34, 'sawtooth', 0.22, now);
        break;
      }
      case 'stumble': {
        this.playTone(150, 70, 0.18, 'sawtooth', 0.3, now);
        this.playNoiseSweep(600, 140, 0.15, 0.22, now);
        break;
      }
      case 'shield_break': {
        this.playTone(420, 110, 0.28, 'sawtooth', 0.32, now);
        this.playNoiseSweep(1400, 220, 0.24, 0.28, now);
        break;
      }
      case 'crash': {
        this.playTone(120, 38, 0.38, 'sawtooth', 0.4, now);
        this.playNoiseSweep(850, 90, 0.34, 0.34, now);
        break;
      }
    }
  }

  private playTone(
    fStart: number,
    fEnd: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    startTime: number,
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    const jitter = 0.96 + Math.random() * 0.08;
    osc.frequency.setValueAtTime(fStart * jitter, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd * jitter), startTime + dur);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
  }

  private playNoiseSweep(
    fStart: number,
    fEnd: number,
    dur: number,
    vol: number,
    startTime: number,
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const bufLen = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) ch[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(fStart, startTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, fEnd), startTime + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(startTime);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

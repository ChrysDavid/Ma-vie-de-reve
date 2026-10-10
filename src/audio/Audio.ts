import type * as THREE from 'three';
import type { TimeOfDay } from '@/engine/timeOfDay';
import type { Surface } from './surface';

const MASTER = 0.5;
const POOL_MAX_DIST = 15;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** 100% procedural ambience (Web Audio): wind, birds/crickets, pool, surface-dependent footsteps. */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private ext!: GainNode; // exterior ambiences bus
  private extLp!: BiquadFilterNode;
  private windGain!: GainNode;
  private poolGain!: GainNode;
  private birdBus!: GainNode;
  private cricketGain!: GainNode;
  private white!: AudioBuffer;
  private pink!: AudioBuffer;
  private nodes: AudioScheduledSourceNode[] = [];
  private muted = false;
  private tod: TimeOfDay = 'day';
  private indoorMix = 0; // 0 outdoor .. 1 indoor
  private birdTimer = 1;
  private stepDist = 0;
  private dayMix = 1;
  private nightMix = 0;

  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER;
    this.master.connect(ctx.destination);

    this.extLp = ctx.createBiquadFilter();
    this.extLp.type = 'lowpass';
    this.extLp.frequency.value = 18000;
    this.ext = ctx.createGain();
    this.ext.connect(this.extLp).connect(this.master);

    this.white = this.makeNoise(false);
    this.pink = this.makeNoise(true);
    this.buildWind();
    this.buildPool();
    this.buildCrickets();
    this.birdBus = ctx.createGain();
    this.birdBus.gain.value = 0.5;
    this.birdBus.connect(this.ext);
  }

  setTimeOfDay(t: TimeOfDay): void {
    this.tod = t;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : MASTER, this.ctx.currentTime, 0.05);
  }

  update(dt: number, _feet: THREE.Vector3, speed: number, running: boolean, surface: Surface, indoor: boolean, poolDistance: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;

    // Indoor attenuation (smooth).
    this.indoorMix += ((indoor ? 1 : 0) - this.indoorMix) * Math.min(1, dt * 3);
    this.ext.gain.setTargetAtTime(1 - 0.7 * this.indoorMix, t, 0.1);
    this.extLp.frequency.setTargetAtTime(18000 - (18000 - 600) * this.indoorMix, t, 0.15);

    // Time of day mixes.
    const dayT = this.tod === 'day' ? 1 : this.tod === 'sunset' ? 0.35 : 0;
    const nightT = this.tod === 'night' ? 1 : 0;
    this.dayMix += (dayT - this.dayMix) * Math.min(1, dt * 0.5);
    this.nightMix += (nightT - this.nightMix) * Math.min(1, dt * 0.5);
    this.cricketGain.gain.setTargetAtTime(0.05 * this.nightMix, t, 0.3);
    this.windGain.gain.setTargetAtTime(this.tod === 'night' ? 0.1 : 0.14, t, 0.5);

    // Pool lapping.
    const pd = Math.max(1, poolDistance);
    const pg = pd > POOL_MAX_DIST ? 0 : Math.min(1, 1 / pd) * 0.5 * (1 - pd / POOL_MAX_DIST);
    this.poolGain.gain.setTargetAtTime(pg, t, 0.2);

    // Birds.
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = rnd(1.5, 6);
      if (this.dayMix > 0.15 && Math.random() < this.dayMix) this.chirp(t);
    }

    // Footsteps: cadence proportional to speed (distance-based), faster when running.
    if (speed > 0.3) {
      this.stepDist += speed * dt;
      const stride = running ? 1.1 : 0.75;
      if (this.stepDist >= stride) {
        this.stepDist -= stride;
        this.step(t, surface, running);
      }
    } else {
      this.stepDist = Math.min(this.stepDist, 0.4);
    }
  }

  dispose(): void {
    if (!this.ctx) return;
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this.nodes = [];
    void this.ctx.close();
    this.ctx = null;
  }

  // ---- builders ----------------------------------------------------------------------------------
  private makeNoise(pink: boolean): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (!pink) {
        d[i] = w;
        continue;
      }
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buf;
  }

  private loop(buf: AudioBuffer): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start(0, Math.random() * 2);
    this.nodes.push(s);
    return s;
  }

  private lfo(freq: number, depth: number, target: AudioParam): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(target);
    o.start();
    this.nodes.push(o);
  }

  private buildWind(): void {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 450;
    f.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.14;
    this.loop(this.pink).connect(f).connect(this.windGain).connect(this.ext);
    this.lfo(0.11, 250, f.frequency);
    this.lfo(0.07, 0.05, this.windGain.gain);
  }

  private buildPool(): void {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 0.9;
    const am = ctx.createGain();
    am.gain.value = 0.6;
    this.poolGain = ctx.createGain();
    this.poolGain.gain.value = 0;
    this.loop(this.white).connect(f).connect(am).connect(this.poolGain).connect(this.ext);
    this.lfo(2.3, 0.35, am.gain);
    this.lfo(0.4, 300, f.frequency);
  }

  private buildCrickets(): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 4300;
    const am = ctx.createGain();
    am.gain.value = 0.5;
    this.lfo(32, 0.5, am.gain); // pulse train
    const slow = ctx.createGain();
    slow.gain.value = 0.5;
    this.lfo(0.35, 0.5, slow.gain); // chirp groups
    this.cricketGain = ctx.createGain();
    this.cricketGain.gain.value = 0;
    o.connect(am).connect(slow).connect(this.cricketGain).connect(this.ext);
    o.start();
    this.nodes.push(o);
  }

  // ---- one-shots (nodes self-release when sources end) -------------------------------------------
  private chirp(t: number): void {
    const ctx = this.ctx!;
    const n = Math.floor(rnd(2, 6));
    const base = rnd(2200, 4600);
    let at = t + 0.02;
    for (let i = 0; i < n; i++) {
      const dur = rnd(0.05, 0.12);
      const o = ctx.createOscillator();
      const m = ctx.createOscillator();
      const mg = ctx.createGain();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(base * rnd(0.9, 1.1), at);
      o.frequency.exponentialRampToValueAtTime(base * rnd(0.7, 1.4), at + dur);
      m.frequency.value = rnd(30, 90);
      mg.gain.value = rnd(150, 500);
      m.connect(mg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.18, at + dur * 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(this.birdBus);
      o.start(at);
      m.start(at);
      o.stop(at + dur + 0.02);
      m.stop(at + dur + 0.02);
      at += dur + rnd(0.04, 0.12);
    }
  }

  private step(t: number, surface: Surface, running: boolean): void {
    const ctx = this.ctx!;
    const v = rnd(0.85, 1.15);
    const vol = (running ? 1.2 : 1) * rnd(0.8, 1.1);
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    let freq = 1000, q = 1, atk = 0.004, dec = 0.08, gain = 0.5, type: BiquadFilterType = 'bandpass';
    switch (surface) {
      case 'tile': freq = 3800; q = 2.5; dec = 0.04; gain = 0.45; break; // sharp click
      case 'wood': freq = 450; q = 1.5; dec = 0.1; gain = 0.7; break; // hollow
      case 'grass': type = 'lowpass'; freq = 1400; q = 0.5; atk = 0.025; dec = 0.14; gain = 0.28; break;
      case 'stone': freq = 900; q = 0.8; dec = 0.07; gain = 0.55; break; // dull
      case 'water': type = 'lowpass'; freq = 900; q = 0.5; atk = 0.02; dec = 0.25; gain = 0.45; break;
    }
    f.type = type;
    f.frequency.value = freq * v;
    f.Q.value = q;
    const peak = gain * vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec * v);
    src.connect(f).connect(g).connect(this.master);
    const end = t + atk + dec * v + 0.05;
    src.start(t, rnd(0, 2));
    src.stop(end);

    if (surface === 'wood') {
      // low "toc" body
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.setValueAtTime(170 * v, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.09);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.linearRampToValueAtTime(0.35 * vol, t + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(og).connect(this.master);
      o.start(t);
      o.stop(t + 0.13);
    }
  }
}

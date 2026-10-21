/**
 * Procedural adaptive score (no audio files). Layers, all scheduled on the audio clock so frame hitches never
 * drift the beat:
 *   pad     soft triangle/sine chords through a slowly breathing low-pass, into a generated hall reverb
 *   bass    sine pulse on the strong beats, syncopated as intensity rises
 *   drums   kick / hat / clap, fade in with intensity; the kick goes four-on-the-floor when the Rift is close
 *   arp     8th-note chord tones with rests, only while FLOW is up, into a tempo-synced delay
 *   lead    sparse pentatonic phrases every other bar at high FLOW
 * Each biome has its own progression and feel. Everything ends in a compressor so it never clips.
 */
export class Music {
  private ctx: AudioContext | null = null;
  private out!: GainNode;
  private comp!: DynamicsCompressorNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private delay!: DelayNode;
  private delaySend!: GainNode;
  private padFilter!: BiquadFilterNode;
  private padGain!: GainNode;
  private arpGain!: GainNode;
  private leadGain!: GainNode;
  private drumGain!: GainNode;
  private rumbleGain!: GainNode;
  private pads: { o: OscillatorNode; g: GainNode }[] = [];
  private noise!: AudioBuffer;
  private nextBeat = 0;
  private step = 0;
  private intensity = 0;
  private flow = 0;
  private danger = 0;
  private bpm = 108;
  private biome = 'sky';
  private seed = 1;
  muted = false;
  volume = 0.42;

  // chord progressions (MIDI, 4 chords × 4 tones) and a pentatonic scale per biome
  private static PROG: Record<string, { chords: number[][]; scale: number[]; padType: OscillatorType; bpm: number }> = {
    sky: { chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]], scale: [57, 60, 62, 64, 67, 69, 72, 74], padType: 'triangle', bpm: 108 },
    fire: { chords: [[50, 53, 57, 60], [46, 50, 53, 57], [43, 46, 50, 53], [45, 49, 52, 55]], scale: [50, 53, 55, 57, 60, 62, 65, 67], padType: 'sawtooth', bpm: 118 },
    void: { chords: [[52, 55, 59, 62], [48, 52, 55, 59], [55, 59, 62, 66], [50, 54, 57, 60]], scale: [52, 55, 57, 59, 62, 64, 67, 69], padType: 'sine', bpm: 100 },
  };

  attach(ctx: AudioContext, dest: AudioNode): void {
    if (this.ctx) return;
    this.ctx = ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.knee.value = 12; this.comp.ratio.value = 4; this.comp.attack.value = 0.01; this.comp.release.value = 0.25;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.comp.connect(this.out).connect(dest);

    // hall reverb from a decaying noise burst
    const len = Math.floor(ctx.sampleRate * 2.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (i < 400 ? i / 400 : 1);
    }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    this.reverbSend = ctx.createGain(); this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.comp);

    // tempo-synced feedback delay for arp + lead
    this.delay = ctx.createDelay(1.5);
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dfilt = ctx.createBiquadFilter(); dfilt.type = 'lowpass'; dfilt.frequency.value = 2400;
    this.delaySend = ctx.createGain(); this.delaySend.gain.value = 0.45;
    this.delaySend.connect(this.delay); this.delay.connect(dfilt).connect(fb).connect(this.delay); dfilt.connect(this.comp); dfilt.connect(this.reverbSend);

    // pad: 4 voices, each a soft osc with its own gain so chord changes can crossfade
    this.padFilter = ctx.createBiquadFilter(); this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 500; this.padFilter.Q.value = 0.5;
    this.padGain = ctx.createGain(); this.padGain.gain.value = 0.16;
    this.padFilter.connect(this.padGain).connect(this.comp); this.padGain.connect(this.reverbSend);
    for (let i = 0; i < 8; i++) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.detune.value = (i % 2 ? 7 : -7);
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(g).connect(this.padFilter); o.start();
      this.pads.push({ o, g });
    }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
    const lfoG = ctx.createGain(); lfoG.gain.value = 140;
    lfo.connect(lfoG).connect(this.padFilter.frequency); lfo.start();

    this.arpGain = ctx.createGain(); this.arpGain.gain.value = 0; this.arpGain.connect(this.comp); this.arpGain.connect(this.delaySend);
    this.leadGain = ctx.createGain(); this.leadGain.gain.value = 0; this.leadGain.connect(this.comp); this.leadGain.connect(this.delaySend); this.leadGain.connect(this.reverbSend);
    this.drumGain = ctx.createGain(); this.drumGain.gain.value = 0; this.drumGain.connect(this.comp);

    // noise for hats / claps and the Rift rumble
    const nlen = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
    const rum = ctx.createBufferSource(); rum.buffer = this.noise; rum.loop = true;
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 110;
    this.rumbleGain = ctx.createGain(); this.rumbleGain.gain.value = 0;
    rum.connect(rlp).connect(this.rumbleGain).connect(this.comp); rum.start();

    this.nextBeat = ctx.currentTime + 0.1;
    this.setChord(0, ctx.currentTime);
  }

  setBiome(id: string): void { if (Music.PROG[id]) this.biome = id; }

  /** Per-frame: drive the layers. `playing` ducks everything when false (menus / death). */
  update(dt: number, playing: boolean, flow01: number, danger01: number, stage: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const k = 1 - Math.exp(-dt * 2);
    this.flow += (flow01 - this.flow) * k;
    this.danger += (danger01 - this.danger) * k;
    const target = playing ? Math.min(1, 0.3 + this.flow * 0.45 + this.danger * 0.35 + stage * 0.02) : 0.1;
    this.intensity += (target - this.intensity) * k;
    const P = Music.PROG[this.biome];
    this.bpm = P.bpm + stage * 2 + this.flow * 14;
    this.delay.delayTime.setTargetAtTime((60 / this.bpm) * 0.75, now, 0.5);

    this.out.gain.setTargetAtTime(this.muted ? 0 : this.volume * (playing ? 1 : 0.6), now, 0.4);
    this.padFilter.frequency.setTargetAtTime(420 + this.intensity * 1900, now, 0.3);
    this.arpGain.gain.setTargetAtTime(playing ? Math.max(0, this.flow - 0.12) * 0.22 : 0, now, 0.3);
    this.leadGain.gain.setTargetAtTime(playing ? Math.max(0, this.flow - 0.45) * 0.5 : 0, now, 0.4);
    this.drumGain.gain.setTargetAtTime(playing ? Math.max(0, this.intensity - 0.3) * 0.9 : 0, now, 0.4);
    this.rumbleGain.gain.setTargetAtTime(playing ? this.danger * this.danger * 0.7 : 0, now, 0.25);

    const beatLen = 60 / this.bpm;
    while (this.nextBeat < now + 0.25) {
      this.onStep(this.step, this.nextBeat, beatLen);
      this.step++;
      this.nextBeat += beatLen / 2;   // 8th-note grid
    }
  }

  private rnd(): number { this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff; return this.seed / 0x7fffffff; }

  private onStep(step: number, t: number, beatLen: number): void {
    const P = Music.PROG[this.biome];
    const bar = Math.floor(step / 8), sub = step % 8;
    const chord = P.chords[bar % 4];
    if (sub === 0) this.setChord(bar % 4, t);

    // bass: 1 and 3; the "and of 2" and "4" join as intensity rises
    const root = chord[0] - 12;
    if (sub === 0 || sub === 4 || (sub === 3 && this.intensity > 0.55) || (sub === 6 && this.intensity > 0.75)) {
      const dur = sub === 0 ? beatLen * 0.95 : beatLen * 0.45;
      this.tone(t, midi(root), 'sine', 0.26, dur, this.comp, 0.004);
      this.tone(t, midi(root + 12), 'triangle', 0.05, dur * 0.6, this.comp, 0.004);
    }

    // drums
    const four = this.danger > 0.5;
    if (sub === 0 || sub === 4 || (four && (sub === 2 || sub === 6))) this.kick(t);
    if (sub % 2 === 1 || this.intensity > 0.7) this.hat(t, sub % 2 === 1 ? 0.5 : 0.25);
    if ((sub === 2 || sub === 6) && this.intensity > 0.6) this.clap(t);

    // arp: chord tones with rests, pattern changes every bar
    const pat = [0, 2, 1, 3, 2, 0, 3, 1];
    const rest = this.rnd() < 0.28;
    if (!rest) {
      const idx = pat[(sub + bar) % 8];
      this.tone(t, midi(chord[idx] + 12), 'triangle', 0.45, beatLen * 0.4, this.arpGain, 0.006);
    }

    // lead: a 3-5 note phrase from the scale, every other bar, starting on the downbeat
    if (bar % 2 === 1 && sub === 0) {
      const n = 3 + Math.floor(this.rnd() * 3);
      let deg = Math.floor(this.rnd() * 5);
      for (let i = 0; i < n; i++) {
        const when = t + i * beatLen * (this.rnd() < 0.3 ? 1 : 0.5);
        deg = Math.max(0, Math.min(P.scale.length - 1, deg + (this.rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(this.rnd() * 2))));
        this.tone(when, midi(P.scale[deg] + 12), 'sine', 0.5, beatLen * 0.9, this.leadGain, 0.02);
        this.tone(when, midi(P.scale[deg] + 12), 'triangle', 0.18, beatLen * 0.9, this.leadGain, 0.02);
      }
    }
  }

  private setChord(i: number, t: number): void {
    const P = Music.PROG[this.biome];
    const chord = P.chords[i];
    // 8 voices: 4 tones × 2 detuned; crossfade so the change breathes instead of snapping
    this.pads.forEach((v, k) => {
      const note = chord[k >> 1] - 12;
      v.o.type = P.padType === 'sawtooth' && k % 2 ? 'triangle' : P.padType;
      v.g.gain.setTargetAtTime(0, t, 0.08);
      v.o.frequency.setValueAtTime(midi(note), t + 0.12);
      v.g.gain.setTargetAtTime(P.padType === 'sawtooth' ? 0.09 : 0.14, t + 0.14, 0.35);
    });
  }

  private tone(t: number, freq: number, type: OscillatorType, vol: number, dur: number, dest: AudioNode, attack = 0.01): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g).connect(this.drumGain); o.start(t); o.stop(t + 0.3);
  }

  private hat(t: number, vol: number): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 1 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol * 0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f).connect(g).connect(this.drumGain); s.start(t, Math.random()); s.stop(t + 0.06);
  }

  private clap(t: number): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    s.connect(f).connect(g).connect(this.drumGain); g.connect(this.reverbSend); s.start(t, Math.random()); s.stop(t + 0.15);
  }
}

function midi(n: number): number { return 440 * Math.pow(2, (n - 69) / 12); }

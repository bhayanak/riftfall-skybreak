/**
 * Procedural adaptive music (no audio files): a filtered pad on a 4-chord loop, a pulsing bass, an arpeggio layer
 * that fades in with FLOW, and a low rumble that grows as the Rift closes in. Runs on the shared Sfx AudioContext
 * once the page has had a gesture. All timing is scheduled ahead on the audio clock, so frame hitches never drift it.
 */
export class Music {
  private ctx: AudioContext | null = null;
  private out!: GainNode;
  private padFilter!: BiquadFilterNode;
  private padGain!: GainNode;
  private arpGain!: GainNode;
  private rumbleGain!: GainNode;
  private pads: OscillatorNode[] = [];
  private nextBeat = 0;
  private beat = 0;
  private intensity = 0;   // 0..1 smoothed
  private flow = 0;        // 0..1
  private danger = 0;      // 0..1 (rift proximity)
  private bpm = 112;
  muted = false;
  volume = 0.32;

  // A minor loop: Am – F – C – G (roots as MIDI), chord tones above
  private static CHORDS: number[][] = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]];

  attach(ctx: AudioContext, dest: AudioNode): void {
    if (this.ctx) return;
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);

    // pad: 3 detuned saws -> lowpass -> gain
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 400;
    this.padFilter.Q.value = 0.7;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.18;
    this.padFilter.connect(this.padGain).connect(this.out);
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = i === 1 ? 'triangle' : 'sawtooth';
      o.detune.value = (i - 1) * 9;
      o.connect(this.padFilter);
      o.start();
      this.pads.push(o);
    }

    this.arpGain = ctx.createGain();
    this.arpGain.gain.value = 0;
    this.arpGain.connect(this.out);

    // rumble: looping brown-ish noise through a lowpass
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 140;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    src.connect(lp).connect(this.rumbleGain).connect(this.out);
    src.start();

    this.nextBeat = ctx.currentTime + 0.1;
    this.setChord(0, ctx.currentTime);
  }

  /** Per-frame: drive the layers. `playing` ducks everything when false (menus / death). */
  update(dt: number, playing: boolean, flow01: number, danger01: number, stage: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const k = 1 - Math.exp(-dt * 2);
    this.flow += (flow01 - this.flow) * k;
    this.danger += (danger01 - this.danger) * k;
    const target = playing ? Math.min(1, 0.35 + this.flow * 0.45 + this.danger * 0.4) : 0.15;
    this.intensity += (target - this.intensity) * k;
    this.bpm = 108 + stage * 6 + this.flow * 18;

    this.out.gain.setTargetAtTime(this.muted ? 0 : this.volume * (playing ? 1 : 0.55), now, 0.3);
    this.padFilter.frequency.setTargetAtTime(350 + this.intensity * 2200, now, 0.2);
    this.arpGain.gain.setTargetAtTime(playing ? Math.max(0, this.flow - 0.15) * 0.16 : 0, now, 0.3);
    this.rumbleGain.gain.setTargetAtTime(playing ? this.danger * this.danger * 0.9 : 0, now, 0.25);

    // schedule up to 200 ms ahead
    const beatLen = 60 / this.bpm;
    while (this.nextBeat < now + 0.2) {
      this.onBeat(this.beat, this.nextBeat, beatLen);
      this.beat++;
      this.nextBeat += beatLen / 2;   // 8th-note grid
    }
  }

  private onBeat(step: number, t: number, beatLen: number): void {
    const ctx = this.ctx!;
    const bar = Math.floor(step / 8);
    const chord = Music.CHORDS[bar % 4];
    if (step % 8 === 0) this.setChord(bar % 4, t);
    // bass on beats 1 and 3 (and 2.5 when intense)
    const sub = step % 8;
    if (sub === 0 || sub === 4 || (sub === 6 && this.intensity > 0.6)) {
      this.pluck(t, midi(chord[0] - 12), 'sine', 0.22 * (0.6 + this.intensity * 0.4), beatLen * 0.9, this.out);
    }
    // arpeggio: chord tones up and down on 8ths
    const seq = [0, 1, 2, 3, 2, 1, 0, 2];
    const n = chord[seq[sub]] + 12;
    this.pluck(t, midi(n), 'triangle', 0.5, beatLen * 0.45, this.arpGain);
    if (this.intensity > 0.75 && sub % 2 === 1) this.pluck(t, midi(n + 7), 'square', 0.12, beatLen * 0.25, this.arpGain);
    void ctx;
  }

  private setChord(i: number, t: number): void {
    const chord = Music.CHORDS[i];
    this.pads.forEach((o, k) => o.frequency.setTargetAtTime(midi(chord[k % chord.length] - 12), t, 0.08));
  }

  private pluck(t: number, freq: number, type: OscillatorType, vol: number, dur: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }
}

function midi(n: number): number { return 440 * Math.pow(2, (n - 69) / 12); }

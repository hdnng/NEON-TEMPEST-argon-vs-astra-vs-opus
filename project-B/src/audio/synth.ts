import { STAGES } from "../render/stages";
export class Synth {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  music: GainNode | null = null;
  sfx: GainNode | null = null;
  timer: ReturnType<typeof setInterval> | null = null;
  next = 0;
  beat = 0;
  theme = -1;
  volumes = [0.65, 0.45, 0.75];
  noise: AudioBuffer | null = null;
  ambience: BiquadFilterNode | null = null;
  async unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      const compressor = this.ctx.createDynamicsCompressor();
      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);
      this.noise = this.ctx.createBuffer(
        1,
        this.ctx.sampleRate,
        this.ctx.sampleRate,
      );
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const rain = this.ctx.createBufferSource();
      rain.buffer = this.noise;
      rain.loop = true;
      this.ambience = this.ctx.createBiquadFilter();
      this.ambience.type = "lowpass";
      this.ambience.frequency.value = [1100, 420, 190][
        Math.max(0, this.theme) % 3
      ];
      const ambientGain = this.ctx.createGain();
      ambientGain.gain.value = 0.055;
      rain.connect(this.ambience);
      this.ambience.connect(ambientGain);
      ambientGain.connect(this.music);
      rain.start();
      this.setVolumes(...(this.volumes as [number, number, number]));
      this.next = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 50);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }
  setVolumes(master: number, music: number, sfx: number) {
    this.volumes = [master, music, sfx];
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(master, this.ctx.currentTime, 0.05);
      this.music!.gain.setTargetAtTime(music * 0.3, this.ctx.currentTime, 0.05);
      this.sfx!.gain.setTargetAtTime(sfx * 0.35, this.ctx.currentTime, 0.05);
    }
  }
  setTheme(n: number) {
    if (this.theme !== n) {
      this.theme = n;
      this.beat = 0;
      if (this.ambience && this.ctx)
        this.ambience.frequency.setTargetAtTime(
          [1100, 420, 190][Math.max(0, n) % 3],
          this.ctx.currentTime,
          0.4,
        );
    }
  }
  tone(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    gain = 0.2,
    when = 0,
    bus: "music" | "sfx" = "sfx",
    end?: number,
  ) {
    if (!this.ctx || !this[bus]) return;
    const t = when || this.ctx.currentTime,
      o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (end)
      o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(this[bus]!);
    o.start(t);
    o.stop(t + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  hiss(
    duration: number,
    gain: number,
    freq = 1500,
    when = 0,
    bus: "music" | "sfx" = "sfx",
  ) {
    if (!this.ctx || !this.noise) return;
    const t = when || this.ctx.currentTime,
      n = this.ctx.createBufferSource(),
      filter = this.ctx.createBiquadFilter(),
      g = this.ctx.createGain();
    n.buffer = this.noise;
    filter.type = "highpass";
    filter.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    n.connect(filter);
    filter.connect(g);
    g.connect(this[bus]!);
    n.start(t);
    n.stop(t + duration);
    n.onended = () => {
      n.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }
  schedule() {
    if (!this.ctx || this.ctx.state !== "running") return;
    const st = STAGES[Math.max(0, this.theme) % 3],
      bpm = this.theme < 0 ? 92 : this.theme === 3 ? 130 : st.bpm,
      notes = this.theme < 0 ? [45, 48, 52, 55] : st.notes;
    while (this.next < this.ctx.currentTime + 0.18) {
      const b = this.beat % 32,
        t = this.next,
        n = notes[Math.floor(b / 8) % 4],
        hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
      if (b % 4 === 0) {
        this.tone(120, 0.21, "sine", 0.7, t, "music", 35);
        this.tone(hz(n), 0.32, "triangle", 0.4, t, "music");
      }
      if (b % 8 === 4) this.hiss(0.12, 0.16, 900, t, "music");
      this.hiss(0.045, b % 2 === 0 ? 0.08 : 0.035, 6000, t, "music");
      const arp = [0, 7, 12, 7, 3, 10, 14, 7][b % 8];
      if (b % 2 === 0)
        this.tone(hz(n + 24 + arp), 0.28, "sine", 0.15, t, "music");
      if (b % 16 === 0) {
        for (const off of [12, 19, 24])
          this.tone(hz(n + off), 1.6, "triangle", 0.065, t, "music");
      }
      this.next += 60 / bpm / 4;
      this.beat++;
    }
  }
  play(name: string, strength = 0) {
    if (!this.ctx || this.ctx.state !== "running") return;
    switch (name) {
      case "nav":
        this.tone(560, 0.045, "sine", 0.15, 0, "sfx", 750);
        break;
      case "confirm":
        this.tone(700, 0.11, "sine", 0.25);
        this.tone(1050, 0.16, "sine", 0.18, this.ctx.currentTime + 0.06);
        break;
      case "hit":
      case "throw":
        this.tone(
          95 + strength * 20,
          0.12 + strength * 0.04,
          "triangle",
          0.8,
          0,
          "sfx",
          35,
        );
        this.hiss(0.08 + strength * 0.035, 0.6, 400);
        break;
      case "block":
      case "parry":
        this.tone(
          name === "parry" ? 1200 : 520,
          0.18,
          "sine",
          0.3,
          0,
          "sfx",
          230,
        );
        this.hiss(0.06, 0.18, 3000);
        break;
      case "projectile":
        this.tone(280, 0.27, "sawtooth", 0.16, 0, "sfx", 70);
        this.hiss(0.18, 0.12, 2200);
        break;
      case "super":
      case "drive":
        for (let i = 0; i < 5; i++)
          this.tone(
            110 * 2 ** (i / 3),
            0.7,
            "sawtooth",
            0.13,
            this.ctx.currentTime + i * 0.055,
            "sfx",
            60,
          );
        this.hiss(0.65, 0.3, 600);
        break;
      case "ko":
        this.tone(110, 1.2, "sawtooth", 0.3, 0, "sfx", 25);
        break;
      case "fight":
      case "round":
        this.tone(220, 0.2, "triangle", 0.3);
        this.tone(440, 0.35, "triangle", 0.2, this.ctx.currentTime + 0.1);
        break;
      case "jump":
      case "dash":
      case "move":
        this.hiss(0.08, 0.08, 2500);
        break;
      case "tech":
        this.tone(900, 0.2, "triangle", 0.25);
        break;
    }
  }
  pause() {
    void this.ctx?.suspend();
  }
  resume() {
    if (this.ctx) {
      this.next = this.ctx.currentTime + 0.1;
      void this.ctx.resume();
    }
  }
  dispose() {
    if (this.timer) clearInterval(this.timer);
    void this.ctx?.close();
  }
}

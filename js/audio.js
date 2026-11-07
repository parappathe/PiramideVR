// Sons sintetizados na hora (sem arquivos), com áudio 3D (PannerNode HRTF) na maquete: o pulo do
// sapinho, a nota da pintura (sobe a cada cubo), as bolas, a cobra e os chefes; e uma musiquinha
// por mundo (pode desligar no menu).
// Só começa depois de um clique, tecla ou da entrada no VR (regra do navegador).
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// músicas: [baixo (16 passos, nota MIDI ou 0), melodia (16 passos), passos por segundo, timbre da
// melodia, timbre do baixo, eco, bateria]
const SONGS = [
  // Pirâmide de Doces: saltitante, maior
  [[48, 0, 55, 0, 48, 0, 55, 0, 53, 0, 57, 0, 55, 0, 52, 0], [72, 76, 79, 76, 84, 0, 79, 0, 77, 81, 84, 81, 79, 0, 76, 0], 8, 'square', 'triangle', false, true],
  // Templo de Jade: pentatônica com eco
  [[45, 0, 0, 0, 52, 0, 0, 0, 50, 0, 0, 0, 43, 0, 0, 0], [76, 0, 79, 0, 81, 0, 0, 84, 81, 0, 79, 0, 76, 0, 74, 0], 6, 'sine', 'triangle', true, false],
  // Pirâmide de Gelo: sininhos rápidos
  [[40, 0, 47, 0, 45, 0, 52, 0, 43, 0, 50, 0, 47, 0, 42, 0], [88, 83, 79, 83, 86, 81, 78, 81, 84, 79, 76, 79, 83, 0, 79, 0], 7, 'triangle', 'sine', false, true],
];

export class Sfx {
  constructor() { this.ctx = null; this.on = true; this.musicOn = true; this.last = {}; this.song = 0; this.playing = false; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? 0.9 : 0;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.09 : 0;
      this.musicBus.connect(this.master);
      this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 50);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setOn(v) {
    this.on = v;
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }
  setMusic(v) {
    this.musicOn = v;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(v ? 0.09 : 0, this.ctx.currentTime, 0.1);
  }
  setSong(i, playing) { this.song = i; this.playing = playing; }

  // sequenciador simples com antecedência (não depende do quadro da tela)
  schedule() {
    const c = this.ctx;
    if (!c) return;
    const [bass, arp, rate, arpType, bassType, echo, drums] = SONGS[this.song];
    const dt = 1 / rate;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.02;
    while (this.nextT < c.currentTime + 0.2) {
      const k = this.step % 16, t = this.nextT - c.currentTime;
      const mute = !this.playing;
      if (!mute && bass[k]) this.tone(NOTE(bass[k]), dt * 0.9, { type: bassType, vol: 0.8, at: t, bus: this.musicBus, attack: 0.01 });
      if (!mute && arp[k]) {
        this.tone(NOTE(arp[k]), dt * (echo ? 1.6 : 0.5), { type: arpType, vol: echo ? 0.3 : 0.2, at: t, bus: this.musicBus });
        if (echo) this.tone(NOTE(arp[k]), dt * 1.2, { type: arpType, vol: 0.1, at: t + dt * 1.5, bus: this.musicBus });
      }
      if (!mute && k % 4 === 0) this.noise(0.05, { vol: drums ? 0.45 : 0.25, freq: drums ? 4000 : 7000, q: 1, type: 'highpass', at: t, bus: this.musicBus });
      if (!mute && drums && k % 8 === 4) this.noise(0.12, { vol: 0.5, freq: 900, q: 0.8, at: t, bus: this.musicBus });
      if (!mute && drums && k % 8 === 0) this.tone(60, 0.15, { type: 'sine', vol: 0.9, slide: 0.5, at: t, bus: this.musicBus });
      this.step++;
      this.nextT += dt;
    }
  }

  setListener(p, f, u) {
    const L = this.ctx?.listener;
    if (!L) return;
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setValueAtTime(p.x, t); L.positionY.setValueAtTime(p.y, t); L.positionZ.setValueAtTime(p.z, t);
      L.forwardX.setValueAtTime(f.x, t); L.forwardY.setValueAtTime(f.y, t); L.forwardZ.setValueAtTime(f.z, t);
      L.upX.setValueAtTime(u.x, t); L.upY.setValueAtTime(u.y, t); L.upZ.setValueAtTime(u.z, t);
    } else {
      L.setPosition(p.x, p.y, p.z);
      L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
  }

  out(pos, ref = 2, bus = null) {
    const c = this.ctx;
    if (bus) return bus;
    if (!pos) return this.master;
    const p = c.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = ref; p.maxDistance = 50; p.rolloffFactor = 0.8;
    const x = pos.x ?? pos[0], y = pos.y ?? pos[1], z = pos.z ?? pos[2];   // aceita [x, y, z] ou Vector3
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; }
    else p.setPosition(x, y, z);
    p.connect(this.master);
    return p;
  }

  tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0, attack = 0.005, pos = null, ref, bus = null } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out(pos, ref, bus));
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.1, freq = 1200, q = 1, at = 0, type = 'bandpass', pos = null, ref, slide = 0, bus = null } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    if (!this.nbuf) {
      this.nbuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.nbuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out(pos, ref, bus));
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  gate(key, gap) {
    const t = this.ctx?.currentTime ?? 0;
    if (t - (this.last[key] || -9) < gap) return false;
    this.last[key] = t;
    return true;
  }

  // ---------- jogo ----------
  jump(pos) { if (this.ctx) this.tone(300, 0.16, { type: 'square', vol: 0.1, slide: 2.2, pos, ref: 0.8 }); }
  slide(pos) { if (this.ctx) this.noise(0.2, { vol: 0.2, freq: 5000, q: 2, slide: 0.5, pos, ref: 0.8 }); }
  // a nota sobe com quantos cubos já foram pintados
  paint(pos, k, full) {
    if (!this.ctx) return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const n = 67 + scale[k % scale.length];
    this.tone(NOTE(n), 0.14, { type: 'triangle', vol: 0.16, pos, ref: 0.8 });
    if (full) this.tone(NOTE(n + 12), 0.1, { type: 'square', vol: 0.05, at: 0.05, pos, ref: 0.8 });
  }
  stepOn(pos) { if (this.ctx) this.tone(180, 0.06, { type: 'sine', vol: 0.1, pos, ref: 0.8 }); }
  unpaint(pos) { if (this.gate('unpaint', 0.05)) this.tone(500, 0.18, { type: 'sawtooth', vol: 0.06, slide: 0.5, pos, ref: 0.8 }); }
  fall(pos) { this.tone(900, 1.0, { type: 'sine', vol: 0.14, slide: 0.15, pos, ref: 1 }); }
  ride() { [60, 64, 67, 72, 76].forEach((n, i) => this.tone(NOTE(n), 0.2, { type: 'triangle', vol: 0.1, at: i * 0.12 })); this.noise(1.5, { vol: 0.12, freq: 1500, q: 0.6, slide: 3 }); }
  spawn(pos) { if (this.gate('spawn', 0.1)) this.tone(700, 0.25, { type: 'sine', vol: 0.08, slide: 0.4, pos, ref: 0.8 }); }
  enemyLand(pos, kind) {
    if (!this.ctx || !this.gate('el' + kind, 0.06)) return;
    if (kind === 'snake' || kind === 'serpent') this.noise(0.08, { vol: 0.18, freq: 2600, q: 3, pos, ref: 0.8 });
    else if (kind === 'smudge') this.tone(420, 0.08, { type: 'sine', vol: 0.08, slide: 0.7, pos, ref: 0.8 });
    else this.tone(kind === 'green' ? 260 : 150, 0.09, { type: 'triangle', vol: 0.14, slide: 0.6, pos, ref: 0.8 });
  }
  hatch(pos) { this.noise(0.25, { vol: 0.3, freq: 1500, q: 1, pos, ref: 1 }); this.tone(220, 0.4, { type: 'sawtooth', vol: 0.1, slide: 0.6, pos, ref: 1 }); }
  hit() {
    this.noise(0.35, { vol: 0.5, freq: 600, q: 0.7, type: 'lowpass' });
    [72, 67, 64, 60].forEach((n, i) => this.tone(NOTE(n), 0.16, { type: 'square', vol: 0.12, at: 0.1 + i * 0.11 }));
  }
  freeze() { [84, 88, 91, 96].forEach((n, i) => this.tone(NOTE(n), 0.3, { type: 'sine', vol: 0.1, at: i * 0.06 })); }
  catch(pos) { [79, 83, 86].forEach((n, i) => this.tone(NOTE(n), 0.12, { type: 'square', vol: 0.1, at: i * 0.06, pos, ref: 1 })); }
  snakeFall(pos) { this.tone(500, 1.1, { type: 'sawtooth', vol: 0.12, slide: 0.2, pos, ref: 1 }); [72, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.2, { type: 'square', vol: 0.1, at: 0.9 + i * 0.1 })); }
  enemyFall(pos) { if (this.gate('ef', 0.2)) this.tone(400, 0.5, { type: 'sine', vol: 0.05, slide: 0.4, pos, ref: 0.8 }); }
  warn(pos) { this.tone(110, 1.2, { type: 'sawtooth', vol: 0.12, slide: 1.5, pos, ref: 1.5 }); }
  roll(pos) { this.noise(1.1, { vol: 0.45, freq: 220, q: 0.6, type: 'lowpass', pos, ref: 1.5 }); this.tone(70, 1.1, { type: 'sine', vol: 0.3, pos, ref: 1.5 }); }
  ice(pos) { for (let k = 0; k < 5; k++) this.tone(1800 + k * 300, 0.12, { type: 'sine', vol: 0.05, at: k * 0.04, pos, ref: 1 }); }
  snowWarn(pos) { this.tone(1200, 1.0, { type: 'sine', vol: 0.08, slide: 0.4, pos, ref: 1 }); }
  snow(pos) { this.noise(0.3, { vol: 0.5, freq: 800, q: 0.5, type: 'lowpass', pos, ref: 1 }); }
  discBack() { this.tone(880, 0.2, { type: 'triangle', vol: 0.06, slide: 1.5 }); }
  roar(pos) { this.tone(90, 0.8, { type: 'sawtooth', vol: 0.25, slide: 0.6, pos, ref: 2 }); this.noise(0.8, { vol: 0.3, freq: 400, q: 0.6, type: 'lowpass', pos, ref: 2 }); }
  coin() { [83, 88].forEach((n, i) => this.tone(NOTE(n), i ? 0.4 : 0.08, { type: 'square', vol: 0.12, at: i * 0.08 })); }
  won() { [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => this.tone(NOTE(n), 0.22, { type: 'square', vol: 0.12, at: i * 0.12 })); }
  lost() { [67, 66, 65, 64, 52].forEach((n, i) => this.tone(NOTE(n), i === 4 ? 0.8 : 0.25, { type: 'square', vol: 0.12, at: i * 0.22 })); }
  click() { this.tone(880, 0.05, { vol: 0.07, type: 'square' }); }
  star(n) { this.tone(NOTE(84 + n * 4), 0.3, { vol: 0.12, type: 'triangle' }); }
}

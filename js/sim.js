// Regras do Pula-Pirâmide: pirâmide de degraus nos quatro lados, o sapinho que pula e pinta,
// bolas, ovo e cobra, borrão que despinta, bola verde que congela, pétalas voadoras e os chefes.
// Sem navegador e sem Three.js (os testes rodam no Node).
//
// A lógica é em casas da grade (i, j) e degraus (h). A casa (0, 0) é o topo, altura n-1; cada anel
// em volta é um degrau mais baixo. Vizinhas: (i±1, j) e (i, j±1). Quem pula para fora da grade
// (ou num buraco) cai. A cena (main.js/scene.js) converte para metros na escala da maquete.
import { Rng } from './vec.js';
import { LEVELS, WORLDS, starsFor } from './levels.js';

export const DT = 1 / 120;
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const JUMP = 0.36;          // s de cada pulo do sapinho
export const SLIDE = 0.24;         // s da escorregada no gelo
export const FALL = 1.1;           // s caindo até perder a vida
export const RIDE = 2.0;           // s na pétala até o topo
export const RESPITE = 1.5;        // s parados depois de levar uma batida
export const LIVES = 3;
export const LIFE_PENALTY = 15;
export const FREEZE = 3.5;
export const DROP = 0.6;           // s caindo do céu ao aparecer
export const HATCH = 0.9;
export const SCORE = { paint: 25, green: 100, smudge: 300, snake: 500, disc: 50, clear: 1000, sweepDodge: 0 };
export const CARAMEL = { first: 6, every: 8, warn: 1.4, roll: 1.1 };
export const SERPENT = { len: 3, hop: 0.8, back: 4, discBack: 8 };
export const YETI = { iceEvery: 5, iceCells: 3, iceLife: 8, snowEvery: 3.2, warn: 1.1, first: 3 };
export const SNAKE_BACK = 5;
export const SNAKE_SLOW = 1.3;   // a cobra pula 30% mais devagar que as bolas

const key = (i, j) => `${i},${j}`;
export { key };

export class Game {
  constructor(level, opts = {}) {
    this.level = level;
    this.L = LEVELS[level];
    this.W = WORLDS[this.L.world];
    this.rng = new Rng(opts.seed ?? 1);
    this.n = this.L.n;
    this.mode = this.L.paint;
    this.need = this.mode === 'two' ? 2 : 1;
    this.cells = new Map();
    const holes = new Set((this.L.holes || []).map(([i, j]) => key(i, j)));
    const ice = new Set((this.L.ice || []).map(([i, j]) => key(i, j)));
    for (let i = -(this.n - 1); i <= this.n - 1; i++) for (let j = -(this.n - 1); j <= this.n - 1; j++) {
      if (holes.has(key(i, j))) continue;
      this.cells.set(key(i, j), { i, j, h: this.n - 1 - Math.max(Math.abs(i), Math.abs(j)), paint: 0, ice: ice.has(key(i, j)), iceT: ice.has(key(i, j)) ? Infinity : 0 });
    }
    this.total = this.cells.size;
    this.discs = (this.L.discs || []).map(([i, j, d], k) => ({ id: k, i, j, d, used: false, back: 0 }));
    this.lives = opts.lives ?? LIVES;
    this.startLives = this.lives;
    this.t = 0;
    this.score = 0;
    this.events = [];
    this.phase = 'play';
    this.result = null;
    this.nextId = 1;
    this.p = { i: 0, j: 0, from: null, to: null, t: 0, dur: JUMP, state: 'idle', dir: -1, disc: null, queued: null };
    this.enemies = [];
    this.freezeT = 0;
    this.respite = 0;
    this.hop = this.L.hop;
    this.timers = {
      balls: this.L.balls ? this.L.balls[0] : Infinity,
      green: this.L.green ? this.L.green[0] : Infinity,
      smudge: this.L.smudge ? this.L.smudge[0] : Infinity,
      egg: this.L.egg ?? Infinity,
    };
    this.boss = this.L.boss || null;
    this.sweep = null;       // Bolota de Caramelo: { axis, c, t, phase: 'warn'|'roll' }
    this.sweepT = CARAMEL.first;
    this.snows = [];         // Yeti: bolas de neve marcadas { i, j, t }
    this.iceT = YETI.first; this.snowT = YETI.first + 1;
    this.lure = null;
    this.paintCell(this.cell(0, 0), true);
    if (this.boss === 'serpent') this.timers.egg = 3;
  }

  get over() { return this.phase === 'won' || this.phase === 'lost'; }
  emit(e) { this.events.push(e); }
  cell(i, j) { return this.cells.get(key(i, j)); }
  done(c) { return c.paint >= this.need; }
  get left() { let k = 0; for (const c of this.cells.values()) if (!this.done(c)) k++; return k; }
  discAt(i, j, d) { return this.discs.find(s => !s.used && s.i === i && s.j === j && s.d === d); }

  // Para onde vai um pulo de (i, j) na direção d (o robô usa): casa, pétala ou queda.
  // O gelo faz escorregar mais casas no mesmo sentido.
  outcome(i, j, d) {
    const path = [];
    let ci = i, cj = j;
    for (let k = 0; k < 8; k++) {
      const disc = this.discAt(ci, cj, d);
      const ni = ci + DIRS[d][0], nj = cj + DIRS[d][1];
      const c = this.cell(ni, nj);
      if (!c) return disc && k === 0 ? { kind: 'disc', disc, path } : { kind: 'fall', path, at: [ni, nj] };
      path.push(c);
      if (!this.isIce(c)) return { kind: 'cell', cell: c, path };
      ci = ni; cj = nj;
    }
    return { kind: 'cell', cell: path[path.length - 1], path };
  }
  isIce(c) { return c.ice || c.iceT > this.t; }

  paintCell(c, quiet = false) {
    if (!c) return;
    const before = c.paint;
    if (this.mode === 'toggle') c.paint = c.paint ? 0 : 1;
    else c.paint = Math.min(this.need, c.paint + 1);
    if (quiet) return;
    if (c.paint > before) this.score += SCORE.paint;
    this.emit({ type: c.paint > before ? 'paint' : c.paint < before ? 'unpaint' : 'step', i: c.i, j: c.j, h: c.h, paint: c.paint, need: this.need });
  }

  // ---------- passo ----------
  // input: { jump: 0..3 (direção) ou null }
  step(input) {
    this.events = [];
    if (this.over) { this.t += DT; return; }
    this.t += DT;
    if (input && input.jump != null) this.request(input.jump);
    this.updatePlayer();
    if (this.over) return;
    if (this.respite > 0) this.respite -= DT;
    else {
      this.spawnEnemies();
      this.updateEnemies();
      this.updateBoss();
      this.checkHits();
    }
    for (const s of this.discs) if (s.used && s.back > 0) { s.back -= DT; if (s.back <= 0) { s.used = false; this.emit({ type: 'disc-back', id: s.id }); } }
    for (const c of this.cells.values()) if (c.iceT > 0 && c.iceT !== Infinity && c.iceT <= this.t && c.iceWas) { c.iceWas = false; this.emit({ type: 'thaw', i: c.i, j: c.j, h: c.h }); }
    this.checkEnd();
  }

  request(d) {
    const P = this.p;
    if (P.state === 'idle') this.jump(d);
    else if (P.state === 'jump' && P.t > P.dur - 0.12 && !P.forced) P.queued = d;
  }

  jump(d, forced = false) {
    const P = this.p;
    const disc = !forced && this.discAt(P.i, P.j, d);
    const ni = P.i + DIRS[d][0], nj = P.j + DIRS[d][1];
    P.from = [P.i, P.j]; P.to = [ni, nj]; P.t = 0; P.dur = forced ? SLIDE : JUMP; P.dir = d; P.forced = forced;
    P.state = 'jump';
    if (disc && !this.cell(ni, nj)) { P.disc = disc; disc.used = true; if (this.boss === 'serpent') disc.back = SERPENT.discBack; }
    else P.disc = null;
    this.emit({ type: forced ? 'slide' : 'jump', from: P.from, to: P.to });
  }

  updatePlayer() {
    const P = this.p;
    if (P.state === 'jump') {
      P.t += DT;
      if (P.t >= P.dur) {
        const c = this.cell(P.to[0], P.to[1]);
        if (P.disc) {
          P.state = 'ride'; P.t = 0;
          this.emit({ type: 'ride', disc: P.disc.id });
          // a cobra vem atrás e cai
          const sn = this.enemies.find(e => (e.kind === 'snake' || e.kind === 'serpent') && e.state !== 'fall');
          if (sn) this.lure = { i: P.from[0], j: P.from[1], d: P.dir, t: 4 };
          return;
        }
        if (!c) { P.state = 'fall'; P.t = 0; this.emit({ type: 'fall', at: P.to }); return; }
        P.i = c.i; P.j = c.j; P.state = 'idle'; P.t = 0;
        this.paintCell(c);
        this.emit({ type: 'land', i: c.i, j: c.j, h: c.h });
        if (this.isIce(c)) { this.jump(P.dir, true); return; }
        if (P.queued != null) { const q = P.queued; P.queued = null; this.jump(q); }
      }
    } else if (P.state === 'ride') {
      P.t += DT;
      if (P.t >= RIDE) {
        P.i = 0; P.j = 0; P.state = 'jump'; P.from = [0, 0]; P.to = [0, 0]; P.t = P.dur * 0.5; P.disc = null; P.forced = false; P.queued = null;
        this.emit({ type: 'ride-end' });
      }
    } else if (P.state === 'fall') {
      P.t += DT;
      if (P.t >= FALL) {
        this.loseLife('fall');
        if (this.over) return;
        P.i = 0; P.j = 0; P.state = 'idle'; P.t = 0; P.queued = null;
      }
    }
  }

  // tempo entre pulos e duração do pulo de cada bicho
  hopOf(e) { return e.kind === 'serpent' ? SERPENT.hop : e.kind === 'snake' ? this.hop * SNAKE_SLOW : this.hop; }
  hopDur(e) { return Math.min(0.34, this.hopOf(e) * 0.55); }

  // casa ocupada por quem está pulando (troca na metade do pulo)
  occ(e) {
    if (e.state === 'hop') return e.t < e.dur * 0.5 ? e.from : e.to;
    return [e.i, e.j];
  }
  playerCell() {
    const P = this.p;
    if (P.state === 'idle') return [P.i, P.j];
    if (P.state === 'jump') return P.t < P.dur * 0.5 ? P.from : P.to;
    return null;
  }

  loseLife(why) {
    this.lives--;
    this.emit({ type: 'lost-life', why, lives: this.lives });
    // tudo some e recomeça, o sapinho fica onde está
    if (this.enemies.some(e => e.kind === 'snake' || e.kind === 'egg' || e.kind === 'serpent')) this.timers.egg = this.boss === 'serpent' ? 2 : SNAKE_BACK;
    this.enemies = [];
    this.sweep = null; this.sweepT = CARAMEL.every; this.snows = [];
    this.lure = null;
    this.respite = RESPITE;
    if (this.lives <= 0) this.finish(false);
  }

  // ---------- bichos ----------
  topNeighbors() {
    return DIRS.map(([di, dj]) => this.cell(di, dj)).filter(Boolean);
  }
  spawn(kind) {
    const tops = this.topNeighbors();
    if (!tops.length) return;
    const c = this.rng.pick(tops);
    const e = { id: this.nextId++, kind, i: c.i, j: c.j, from: [c.i, c.j], to: [c.i, c.j], t: 0, dur: DROP, state: 'drop', wait: 0.25 };
    if (kind === 'serpent') e.body = [];
    this.enemies.push(e);
    this.emit({ type: 'spawn', kind, i: c.i, j: c.j, h: c.h });
  }
  spawnEnemies() {
    const L = this.L;
    for (const k of ['balls', 'green', 'smudge']) {
      if (!L[k]) continue;
      this.timers[k] -= DT;
      if (this.timers[k] <= 0) {
        this.timers[k] = L[k][1] * (0.85 + 0.3 * this.rng.next());
        const kind = k === 'balls' ? 'ball' : k;
        const count = this.enemies.filter(e => e.kind === kind).length;
        if (count < (kind === 'ball' ? 3 : 1)) this.spawn(kind);
      }
    }
    if (this.timers.egg !== Infinity) {
      this.timers.egg -= DT;
      if (this.timers.egg <= 0) {
        this.timers.egg = Infinity;
        this.spawn(this.boss === 'serpent' ? 'serpent' : 'egg');
      }
    }
  }

  lowerNeighbors(i, j) {
    const c = this.cell(i, j);
    const out = [];
    DIRS.forEach(([di, dj], d) => {
      const n = this.cell(i + di, j + dj);
      if (n && n.h < c.h) out.push({ d, cell: n });
      else if (!n) out.push({ d, cell: null });   // beirada ou buraco: só se não tiver outro jeito
    });
    return out;
  }

  chaseMove(e, ti, tj) {
    let best = null, bd = Infinity;
    DIRS.forEach(([di, dj], d) => {
      const n = this.cell(e.i + di, e.j + dj);
      if (!n) return;
      if (e.body && e.body.some(b => b[0] === n.i && b[1] === n.j)) return;
      const dist = Math.abs(n.i - ti) + Math.abs(n.j - tj) + this.rng.next() * 0.1;
      if (dist < bd) { bd = dist; best = { d, cell: n }; }
    });
    return best;
  }

  updateEnemies() {
    if (this.freezeT > 0) { this.freezeT -= DT; return; }
    for (const e of this.enemies.slice()) {
      if (e.state === 'drop') {
        e.t += DT;
        if (e.t >= e.dur) { e.state = 'idle'; e.t = 0; e.wait = 0.2; this.emit({ type: 'enemy-land', kind: e.kind, i: e.i, j: e.j, h: this.cell(e.i, e.j).h }); }
        continue;
      }
      if (e.state === 'fall') {
        e.t += DT;
        if (e.t >= FALL) {
          this.enemies.splice(this.enemies.indexOf(e), 1);
          if (e.kind === 'snake' || e.kind === 'serpent') this.timers.egg = this.boss === 'serpent' ? SERPENT.back : SNAKE_BACK;
        }
        continue;
      }
      if (e.state === 'hatch') {
        e.t += DT;
        if (e.t >= HATCH) { e.kind = 'snake'; e.state = 'idle'; e.wait = 0.3; this.emit({ type: 'hatch', i: e.i, j: e.j, h: this.cell(e.i, e.j).h }); }
        continue;
      }
      if (e.state === 'hop') {
        e.t += DT;
        if (e.t >= e.dur) {
          if (e.body) { e.body.unshift(e.from.slice()); e.body.length = Math.min(e.body.length, SERPENT.len); }
          const c = this.cell(e.to[0], e.to[1]);
          if (!c) { e.state = 'fall'; e.t = 0; this.emit({ type: 'enemy-fall', kind: e.kind, at: e.to, lured: !!e.lured }); if (e.lured) { this.score += SCORE.snake; } continue; }
          e.i = c.i; e.j = c.j; e.state = 'idle'; e.t = 0; e.wait = this.hopOf(e) - e.dur;
          if (e.kind === 'smudge') { const before = c.paint; c.paint = Math.max(0, c.paint - 1); if (c.paint < before) this.emit({ type: 'unpaint', i: c.i, j: c.j, h: c.h, paint: c.paint, by: 'smudge' }); }
          this.emit({ type: 'enemy-land', kind: e.kind, i: c.i, j: c.j, h: c.h });
        }
        continue;
      }
      // parado: espera e escolhe o próximo pulo
      e.wait -= DT;
      if (e.wait > 0) continue;
      let mv = null;
      if (e.kind === 'ball' || e.kind === 'green' || e.kind === 'smudge' || e.kind === 'egg') {
        const opts = this.lowerNeighbors(e.i, e.j);
        if (e.kind === 'egg' && opts.every(o => !o.cell)) { e.state = 'hatch'; e.t = 0; continue; }
        if (opts.length) {
          // a bola prefere continuar dentro da pirâmide; só sai pela beirada se for o único jeito
          const inside = opts.filter(o => o.cell);
          mv = this.rng.pick(inside.length ? inside : opts);
        }
      } else if (e.kind === 'snake' || e.kind === 'serpent') {
        const L = this.lure;
        if (L && e.i === L.i && e.j === L.j) {
          mv = { d: L.d, cell: null }; e.lured = true; this.lure = null;
        } else {
          const pc = L ? [L.i, L.j] : this.playerCell() || [this.p.i, this.p.j];
          mv = this.chaseMove(e, pc[0], pc[1]);
        }
      }
      if (!mv) { e.wait = 0.2; continue; }
      e.from = [e.i, e.j];
      e.to = [e.i + DIRS[mv.d][0], e.j + DIRS[mv.d][1]];
      e.state = 'hop'; e.t = 0;
      e.dur = this.hopDur(e);
      e.hopAt = this.t;
      this.emit({ type: 'enemy-hop', kind: e.kind, from: e.from, to: e.to });
    }
    if (this.lure) { this.lure.t -= DT; if (this.lure.t <= 0) this.lure = null; }
  }

  checkHits() {
    const pc = this.playerCell();
    if (!pc) return;
    for (const e of this.enemies.slice()) {
      if (e.state === 'drop' || e.state === 'fall') continue;
      const ec = this.occ(e);
      let hit = ec[0] === pc[0] && ec[1] === pc[1];
      if (!hit && e.body) hit = e.body.some(b => b[0] === pc[0] && b[1] === pc[1]);
      if (!hit) continue;
      if (e.kind === 'green') {
        this.enemies.splice(this.enemies.indexOf(e), 1);
        this.freezeT = FREEZE; this.score += SCORE.green;
        this.emit({ type: 'freeze', i: pc[0], j: pc[1] });
      } else if (e.kind === 'smudge') {
        this.enemies.splice(this.enemies.indexOf(e), 1);
        this.score += SCORE.smudge;
        this.emit({ type: 'catch', i: pc[0], j: pc[1] });
      } else {
        this.emit({ type: 'hit', kind: e.kind, i: pc[0], j: pc[1] });
        this.loseLife(e.kind);
        return;
      }
    }
    // chefes
    if (this.sweep && this.sweep.phase === 'roll' && this.onLine(pc[0], pc[1], this.sweep)) {
      this.emit({ type: 'hit', kind: 'caramel', i: pc[0], j: pc[1] });
      this.loseLife('caramel');
      return;
    }
    for (const s of this.snows) if (s.t <= 0 && s.i === pc[0] && s.j === pc[1]) {
      this.emit({ type: 'hit', kind: 'snow', i: pc[0], j: pc[1] });
      this.loseLife('snow');
      return;
    }
    this.snows = this.snows.filter(s => s.t > 0);
  }

  onLine(i, j, s) { return s.axis === 0 ? i === s.c : j === s.c; }
  // linha que a bolota vai varrer: casas na linha e o quanto ela já andou (0..1)
  sweepCells(s = this.sweep) {
    if (!s) return [];
    return [...this.cells.values()].filter(c => this.onLine(c.i, c.j, s));
  }

  updateBoss() {
    if (this.boss === 'caramel') {
      if (!this.sweep) {
        this.sweepT -= DT;
        if (this.sweepT <= 0) {
          const axis = this.rng.next() < 0.5 ? 0 : 1;
          // prefere a linha onde o sapinho está (ou uma vizinha): ele tem que sair dela
          const pc = this.playerCell() || [0, 0];
          const base = axis === 0 ? pc[0] : pc[1];
          const c = Math.max(-(this.n - 1), Math.min(this.n - 1, base + Math.floor(this.rng.next() * 3) - 1));
          this.sweep = { axis, c, t: CARAMEL.warn, phase: 'warn', dir: this.rng.sign() };
          this.emit({ type: 'sweep-warn', axis, c });
        }
      } else {
        const s = this.sweep;
        s.t -= DT;
        if (s.t <= 0) {
          if (s.phase === 'warn') {
            s.phase = 'roll'; s.t = CARAMEL.roll;
            for (const c of this.sweepCells(s)) if (c.paint > 0 && !(c.i === 0 && c.j === 0)) { c.paint--; this.emit({ type: 'unpaint', i: c.i, j: c.j, h: c.h, paint: c.paint, by: 'caramel' }); }
            this.emit({ type: 'sweep', axis: s.axis, c: s.c });
          } else { this.sweep = null; this.sweepT = CARAMEL.every; }
        }
      }
    } else if (this.boss === 'yeti') {
      this.iceT -= DT;
      if (this.iceT <= 0) {
        this.iceT = YETI.iceEvery;
        const free = [...this.cells.values()].filter(c => !(c.i === 0 && c.j === 0) && !this.isIce(c));
        const picked = [];
        for (let k = 0; k < YETI.iceCells && free.length; k++) {
          const c = free.splice(Math.floor(this.rng.next() * free.length), 1)[0];
          c.iceT = this.t + YETI.iceLife; c.iceWas = true; picked.push([c.i, c.j, c.h]);
        }
        this.emit({ type: 'ice', cells: picked });
      }
      this.snowT -= DT;
      if (this.snowT <= 0) {
        this.snowT = YETI.snowEvery;
        const pc = this.playerCell() || [this.p.i, this.p.j];
        this.snows.push({ i: pc[0], j: pc[1], t: YETI.warn });
        this.emit({ type: 'snow-warn', i: pc[0], j: pc[1], h: this.cell(pc[0], pc[1])?.h ?? 0 });
      }
      for (const s of this.snows) if (s.t > 0) { s.t -= DT; if (s.t <= 0) this.emit({ type: 'snow', i: s.i, j: s.j, h: this.cell(s.i, s.j)?.h ?? 0 }); }
    }
  }

  checkEnd() {
    if (this.over) return;
    if (this.left === 0 && this.p.state === 'idle') this.finish(true);
  }

  finish(won) {
    this.phase = won ? 'won' : 'lost';
    const livesLost = Math.max(0, this.startLives - this.lives);
    const eff = this.t + livesLost * LIFE_PENALTY;
    const stars = won ? starsFor(this.level, eff) : 0;
    const discsLeft = this.discs.filter(s => !s.used).length;
    const bonus = won ? SCORE.clear + discsLeft * SCORE.disc + Math.max(0, this.lives) * 250 + Math.max(0, Math.round((this.L.par[1] - this.t) * 10)) : 0;
    this.score += bonus;
    this.enemies = [];
    this.result = { won, time: this.t, livesLost, eff, stars, score: this.score, bonus, lives: Math.max(0, this.lives) };
    this.emit({ type: won ? 'won' : 'lost' });
  }
}

export { LEVELS, WORLDS };

// Robô jogador com limites humanos: depois de cada pouso espera 0,3 s de reação e mais 0,22 s
// para apontar o próximo cubo; só sabe para onde um bicho vai pular 0,3 s depois que ele começou o
// pulo (antes disso, considera todos os destinos possíveis). Foge das casas onde pode haver um bicho
// quando chegar, usa as pétalas quando a cobra está perto e vai para o cubo por pintar mais perto.
// Usado pelos testes (calibra as estrelas) e pelo dev.autoplay. Sem navegador.
import { Rng } from './vec.js';
import { DIRS, JUMP, SLIDE, DROP, HATCH, SERPENT, CARAMEL, key } from './sim.js';

export const HUMAN = {
  reaction: 0.3,    // s depois de pousar
  aim: 0.05,        // s a mais para apertar (o cubo seguinte já foi apontado durante o pulo)
  seeHop: 0.3,      // s para perceber para onde o bicho está pulando
  stay: 0.9,        // s que costuma ficar numa casa
};

const HARM = new Set(['ball', 'egg', 'snake', 'serpent']);

export function makeRobot(opts = {}) { return new Robot(opts); }

class Robot {
  constructor(opts) {
    this.h = { ...HUMAN, ...opts };
    this.rng = new Rng(opts.seed ?? 11);
    this.reset();
  }
  reset() { this.readyAt = 0; this.wasIdle = false; this.lastPick = null; }

  // Intervalos em que cada casa pode estar ocupada por um bicho perigoso (a partir de agora).
  danger(g, horizon) {
    const out = [];   // { i, j, t0, t1 }
    const add = (i, j, t0, t1) => { if (t1 >= 0 && t0 <= horizon) out.push({ i, j, t0, t1 }); };
    const hopOf = (e) => g.hopOf(e);
    const durOf = (e) => g.hopDur(e);
    const moves = (e, i, j) => {
      if (e.kind === 'snake' || e.kind === 'serpent') return DIRS.map(([di, dj]) => g.cell(i + di, j + dj)).filter(Boolean).map(c => [c.i, c.j]);
      return g.lowerNeighbors(i, j).filter(o => o.cell).map(o => [o.cell.i, o.cell.j]);
    };
    const walk = (e, i, j, t, depth) => {   // t = quando começa o próximo pulo
      const dur = durOf(e);
      add(i, j, -1, t + dur * 0.5);
      if (depth <= 0 || t > horizon) { add(i, j, -1, horizon + 1); return; }
      for (const [ni, nj] of moves(e, i, j)) walk(e, ni, nj, t + dur + (hopOf(e) - dur), depth - 1);
      if (!moves(e, i, j).length) add(i, j, -1, horizon + 1);
    };
    const frozen = g.freezeT;
    for (const e of g.enemies) {
      if (!HARM.has(e.kind) || e.state === 'fall') continue;
      if (e.body) for (const b of e.body) add(b[0], b[1], -1, 0.8);
      if (e.state === 'drop') { walk(e, e.i, e.j, e.dur - e.t + 0.2 + frozen, 2); continue; }
      if (e.state === 'hatch') { walk({ ...e, kind: 'snake' }, e.i, e.j, HATCH - e.t + 0.3 + frozen, 2); continue; }
      if (e.state === 'hop') {
        const known = g.t - e.hopAt >= this.h.seeHop;
        const rest = e.dur - e.t;
        add(e.from[0], e.from[1], -1, rest - e.dur * 0.5 + 0.05);
        const dests = known ? [e.to] : [e.to, ...moves(e, e.from[0], e.from[1])];
        for (const d of dests) {
          if (!g.cell(d[0], d[1])) continue;
          walk(e, d[0], d[1], rest + (hopOf(e) - e.dur) + frozen, 2);
        }
        continue;
      }
      walk(e, e.i, e.j, Math.max(0, e.wait) + frozen, 2);
    }
    // Bolota de Caramelo: a linha avisada
    const s = g.sweep;
    if (s) {
      const t0 = s.phase === 'warn' ? s.t : 0, t1 = s.phase === 'warn' ? s.t + CARAMEL.roll : s.t;
      for (const c of g.sweepCells(s)) add(c.i, c.j, t0 - 0.1, t1 + 0.1);
    }
    for (const sn of g.snows) if (sn.t > 0) add(sn.i, sn.j, sn.t - 0.15, sn.t + 0.25);
    return out;
  }

  // custo para chegar no cubo por pintar mais perto, a partir de uma casa (depois de pousar nela)
  distToWork(g, from, painted) {
    const need = (c) => (painted.has(key(c.i, c.j)) ? false : !g.done(c));
    const dist = new Map([[key(from.i, from.j), 0]]);
    const q = [[from, 0]];
    let best = Infinity;
    while (q.length) {
      q.sort((a, b) => a[1] - b[1]);
      const [c, d] = q.shift();
      if (d >= best) break;
      for (const [di, dj] of DIRS) {
        const n = g.cell(c.i + di, c.j + dj);
        if (!n) continue;
        const k = key(n.i, n.j);
        const step = need(n) ? 1 : (g.mode === 'toggle' ? 4 : 1);
        const nd = d + step;
        if (need(n)) { best = Math.min(best, nd); continue; }
        if (nd < (dist.get(k) ?? Infinity)) { dist.set(k, nd); q.push([n, nd]); }
      }
    }
    return best === Infinity ? 0 : best;
  }

  step(g) {
    const P = g.p, H = this.h;
    if (P.state !== 'idle') { this.wasIdle = false; return { jump: null }; }
    if (!this.wasIdle) { this.wasIdle = true; this.readyAt = g.t + H.reaction + H.aim; }
    if (g.t < this.readyAt) return { jump: null };

    const horizon = JUMP + SLIDE * 3 + H.stay + 0.4;
    const dz = this.danger(g, horizon);
    const risk = (i, j, t0, t1) => {
      let r = 0;
      for (const z of dz) if (z.i === i && z.j === j && z.t1 >= t0 && z.t0 <= t1) r += 1 + Math.max(0, 1.5 - z.t0);
      return r;
    };
    const stayRisk = risk(P.i, P.j, 0, JUMP * 0.5 + H.stay * 0.6);
    const snakeNear = g.enemies.some(e => (e.kind === 'snake' || e.kind === 'serpent') && e.state !== 'fall' && Math.abs(e.i - P.i) + Math.abs(e.j - P.j) <= 2);
    const snakeClose = g.enemies.some(e => (e.kind === 'snake' || e.kind === 'serpent') && e.state !== 'fall' && Math.abs(e.i - P.i) + Math.abs(e.j - P.j) <= 3);
    let best = null, bv = -Infinity;
    for (let d = 0; d < 4; d++) {
      const o = g.outcome(P.i, P.j, d);
      let v;
      if (o.kind === 'fall') continue;
      if (o.kind === 'disc') {
        v = snakeNear ? 30 : (stayRisk > 0 ? 6 : -20);
        v -= risk(P.i, P.j, 0, JUMP * 0.5) * 50;
      } else {
        const c = o.cell;
        const tArr = JUMP + SLIDE * (o.path.length - 1);
        let r = risk(P.i, P.j, 0, JUMP * 0.5);
        o.path.forEach((pc, k) => { const ta = JUMP * 0.5 + SLIDE * k; r += risk(pc.i, pc.j, ta, k === o.path.length - 1 ? tArr + H.stay : ta + SLIDE); });
        const painted = new Set();
        let gain = 0;
        for (const pc of o.path) {
          const willNeed = !g.done(pc);
          if (g.mode === 'toggle') { gain += willNeed ? 10 : -8; } else if (willNeed) gain += 10;
          painted.add(key(pc.i, pc.j));
          if (g.mode !== 'toggle' && pc.paint + 1 < g.need) painted.delete(key(pc.i, pc.j));
        }
        if (g.mode === 'toggle') for (const pc of o.path) if (g.done(pc)) painted.delete(key(pc.i, pc.j));
        v = gain - this.distToWork(g, c, painted) * 2 - r * 60 + this.rng.next() * 0.5;
        // longe da cobra e perto de uma pétala livre
        for (const e of g.enemies) if ((e.kind === 'snake' || e.kind === 'serpent') && e.state !== 'fall') {
          const dn = Math.abs(e.i - c.i) + Math.abs(e.j - c.j), d0 = Math.abs(e.i - P.i) + Math.abs(e.j - P.j);
          if (d0 <= 3) {
            v += (dn - d0) * 6;
            const free = g.discs.filter(s => !s.used);
            if (free.length) {
              const dd = (x) => Math.min(...free.map(s => Math.abs(s.i - x.i) + Math.abs(s.j - x.j)));
              v += (dd(P) - dd(c)) * 5;
            }
          }
        }
      }
      if (v > bv) { bv = v; best = d; }
    }
    // ficar parado é melhor se todos os pulos forem arriscados e a casa atual for segura
    if (best !== null && bv < -40 && stayRisk === 0 && !snakeClose) { this.readyAt = g.t + 0.12; return { jump: null }; }
    if (best === null) { this.readyAt = g.t + 0.12; return { jump: null }; }
    return { jump: best };
  }
}

export { DROP };

// Testes automáticos: node tests/run.js (ou npm test). Não tocam som nem usam navegador.
import { Game, DT, DIRS, JUMP, FALL, RIDE, RESPITE, LIVES, FREEZE, DROP, HATCH, SCORE, CARAMEL, SERPENT, YETI, SNAKE_BACK, key } from '../js/sim.js';
import { LEVELS, WORLDS, LEVELS_PER_WORLD, starsFor } from '../js/levels.js';
import { makeRobot, HUMAN } from '../js/robot.js';

let fails = 0, count = 0;
function ok(cond, msg) {
  count++;
  if (!cond) { fails++; console.log('  FALHOU:', msg); }
}
const none = { jump: null };
const run = (g, sec, inp = none) => { const evs = []; for (let i = 0; i < Math.round(sec / DT); i++) { g.step(typeof inp === 'function' ? inp(g) : inp); evs.push(...g.events); } return evs; };
// jogo sem bichos (para montar cenas)
function quiet(level = 1, opts = {}) {
  const g = new Game(level, opts);
  g.timers = { balls: Infinity, green: Infinity, smudge: Infinity, egg: Infinity };
  g.boss = null;
  return g;
}
const jumpTo = (g, d) => { const e = run(g, DT, { jump: d }); return e.concat(run(g, JUMP + 0.05)); };
const put = (g, kind, i, j, extra = {}) => {
  const e = { id: g.nextId++, kind, i, j, from: [i, j], to: [i, j], t: 0, dur: 0.3, state: 'idle', wait: 99, ...extra };
  if (kind === 'serpent') e.body = e.body || [];
  g.enemies.push(e);
  return e;
};

console.log('Pirâmide');
{
  for (const n of [3, 4]) {
    const L = LEVELS.findIndex(l => l.n === n && !l.holes);
    const g = new Game(L);
    ok(g.cells.size === (2 * n - 1) ** 2, `tamanho ${n}: ${(2 * n - 1) ** 2} cubos`);
    ok(g.cell(0, 0).h === n - 1 && g.cell(n - 1, n - 1).h === 0 && g.cell(1, 0).h === n - 2, `tamanho ${n}: topo no meio e degraus nos quatro lados`);
    let okNb = true;
    for (const c of g.cells.values()) for (const [di, dj] of DIRS) { const m = g.cell(c.i + di, c.j + dj); if (m && Math.abs(m.h - c.h) > 1) okNb = false; }
    ok(okNb, `tamanho ${n}: vizinhas sobem ou descem no máximo um degrau`);
  }
}

console.log('Fases');
{
  ok(LEVELS.length === 12 && WORLDS.length === 3, '12 fases em 3 mundos');
  LEVELS.forEach((L, i) => {
    ok(L.world === Math.floor(i / LEVELS_PER_WORLD), `fase ${i + 1} no mundo certo`);
    ok(!!L.boss === (i % 4 === 3), `fase ${i + 1}: chefe só na 4ª de cada mundo`);
    ok(L.par[0] < L.par[1], `fase ${i + 1}: limites de estrelas em ordem`);
    ok(['one', 'two', 'toggle'].includes(L.paint), `fase ${i + 1}: modo de pintar válido`);
    const g = new Game(i);
    ok(!!g.cell(0, 0), `fase ${i + 1}: tem topo`);
    // tudo alcançável a partir do topo
    const seen = new Set([key(0, 0)]), q = [g.cell(0, 0)];
    while (q.length) { const c = q.pop(); for (const [di, dj] of DIRS) { const m = g.cell(c.i + di, c.j + dj); if (m && !seen.has(key(m.i, m.j))) { seen.add(key(m.i, m.j)); q.push(m); } } }
    ok(seen.size === g.cells.size, `fase ${i + 1}: todos os cubos alcançáveis`);
    for (const s of g.discs) ok(!!g.cell(s.i, s.j) && !g.cell(s.i + DIRS[s.d][0], s.j + DIRS[s.d][1]), `fase ${i + 1}: pétala ${s.id} do lado de fora de uma beirada`);
    for (const [hi, hj] of L.holes || []) ok(!g.cell(hi, hj) && !(hi === 0 && hj === 0), `fase ${i + 1}: buraco ${hi},${hj}`);
  });
  ok(starsFor(0, 1) === 3 && starsFor(0, LEVELS[0].par[0] + 1) === 2 && starsFor(0, 9999) === 1, 'estrelas pelo tempo');
}

console.log('Pulos e pintura');
{
  const g = quiet(1);
  ok(g.cell(0, 0).paint === 1, 'o topo já começa pintado');
  const ev = jumpTo(g, 0);
  ok(g.p.i === 1 && g.p.j === 0 && g.p.state === 'idle', 'pula para a casa vizinha');
  ok(g.cell(1, 0).paint === 1 && ev.some(e => e.type === 'paint'), 'pinta o cubo onde pousa');
  ok(g.score === SCORE.paint, 'pontos por pintar');
  jumpTo(g, 1);
  ok(g.cell(0, 0).paint === 1 && g.score === SCORE.paint, 'pintar de novo não dá pontos nem muda (uma pintada)');
  // pulo durante o pulo fica na fila só no finzinho
  const g2 = quiet(1);
  run(g2, DT, { jump: 0 });
  run(g2, JUMP * 0.3, { jump: 2 });
  run(g2, JUMP);
  ok(g2.p.i === 1 && g2.p.j === 0, 'apertar no começo do pulo não faz pular de novo');
  const g3 = quiet(1);
  run(g3, DT, { jump: 0 });
  run(g3, JUMP - 0.06);
  run(g3, DT, { jump: 2 });
  run(g3, JUMP + 0.1);
  ok(g3.p.i === 1 && g3.p.j === 1, 'apertar no fim do pulo encadeia o próximo');
  // duas pintadas
  const g4 = quiet(4);
  jumpTo(g4, 0);
  ok(g4.cell(1, 0).paint === 1 && !g4.done(g4.cell(1, 0)), 'duas pintadas: a primeira ainda não completa');
  jumpTo(g4, 1); jumpTo(g4, 0);
  ok(g4.done(g4.cell(1, 0)), 'duas pintadas: a segunda completa');
  // pintar de novo desfaz
  const g5 = quiet(8);
  jumpTo(g5, 0); jumpTo(g5, 1);
  ok(g5.cell(0, 0).paint === 0, 'modo desfazer: voltar no cubo pintado despinta');
  // vencer
  const g6 = quiet(0);
  for (const c of g6.cells.values()) c.paint = 1;
  g6.cell(1, 0).paint = 0;
  jumpTo(g6, 0);
  run(g6, DT);
  ok(g6.phase === 'won' && g6.result.won && g6.result.stars >= 1, 'pintou tudo: venceu');
}

console.log('Queda, pétalas e gelo');
{
  const g = quiet(1);
  g.p.i = 3; g.p.j = 2;
  const ev = run(g, JUMP + FALL + 0.2, (gg) => (gg.t < DT * 1.5 ? { jump: 0 } : none));
  ok(ev.some(e => e.type === 'fall') && g.lives === LIVES - 1, 'pular para fora da pirâmide: cai e perde vida');
  ok(g.p.i === 0 && g.p.j === 0 && g.p.state === 'idle', 'volta no topo');
  // buraco
  const g2 = quiet(5);
  g2.p.i = 1; g2.p.j = 0;
  run(g2, JUMP + FALL + 0.2, (gg) => (gg.t < DT * 1.5 ? { jump: 2 } : none));
  ok(g2.lives === LIVES - 1, 'pular num buraco também cai');
  // pétala
  const g3 = quiet(1);
  const s = g3.discs[0];
  g3.p.i = s.i; g3.p.j = s.j;
  const e3 = run(g3, JUMP + RIDE + JUMP, (gg) => (gg.t < DT * 1.5 ? { jump: s.d } : none));
  ok(e3.some(e => e.type === 'ride') && g3.lives === LIVES, 'a pétala pega o sapinho');
  ok(g3.p.i === 0 && g3.p.j === 0 && g3.p.state === 'idle', 'e leva de volta ao topo');
  ok(s.used && !g3.discAt(s.i, s.j, s.d), 'cada pétala só serve uma vez');
  // gelo escorrega
  const g4 = quiet(10);
  const ice = g4.cell(1, 0);
  ok(ice.ice, 'fase 11 tem gelo');
  const o = g4.outcome(0, 0, 0);
  ok(o.kind === 'cell' && o.cell.i === 2 && o.path.length === 2, 'o robô sabe que o gelo escorrega');
  jumpTo(g4, 0); run(g4, 0.4);
  ok(g4.p.i === 2 && g4.p.j === 0 && g4.cell(1, 0).paint === 1 && g4.cell(2, 0).paint === 1, 'pousou no gelo: escorrega mais uma casa (pintando as duas)');
}

console.log('Bichos');
{
  // bola desce aleatória e sai pela beirada
  const g = quiet(1);
  g.timers.balls = 0.01;
  const ev = run(g, 0.05);
  ok(ev.some(e => e.type === 'spawn' && e.kind === 'ball') && g.enemies.length === 1, 'bola aparece perto do topo');
  const b = g.enemies[0];
  ok(Math.abs(b.i) + Math.abs(b.j) === 1, 'cai numa casa vizinha do topo');
  g.timers.balls = Infinity;
  let h0 = g.cell(b.i, b.j).h, down = true;
  const e2 = [];
  let first = true;
  for (let k = 0; k < 900 && g.enemies.length; k++) { g.step(none); e2.push(...g.events); for (const e of g.events) if (e.type === 'enemy-land' && e.kind === 'ball') { if (e.h >= h0 && !first) down = false; first = false; h0 = e.h; } }
  ok(down, 'a bola só desce');
  ok(e2.some(e => e.type === 'enemy-fall') && !g.enemies.length, 'na beirada ela pula para fora e some');
  // bola no sapinho: perde vida e todos os bichos somem
  const g2 = quiet(1);
  put(g2, 'ball', 0, 0);
  put(g2, 'ball', 2, 2);
  const e3 = run(g2, DT * 2);
  ok(e3.some(e => e.type === 'hit') && g2.lives === LIVES - 1 && !g2.enemies.length, 'bateu na bola: perde vida e os bichos somem');
  const e4 = run(g2, RESPITE - 0.2, { jump: null });
  ok(!e4.some(e => e.type === 'spawn'), 'respiro depois da batida');
  // ovo choca e a cobra persegue
  const g3 = quiet(1);
  put(g3, 'egg', 3, 0, { wait: 0 });
  run(g3, HATCH + 0.2);
  const sn = g3.enemies[0];
  ok(sn.kind === 'snake', 'ovo na beirada choca e vira cobra');
  g3.p.i = -2; g3.p.j = 0;
  const d0 = Math.abs(sn.i + 2) + Math.abs(sn.j);
  run(g3, 2.5);
  ok(Math.abs(sn.i + 2) + Math.abs(sn.j) < d0, 'a cobra vem atrás do sapinho');
  // pétala derruba a cobra que vem atrás
  const g4 = quiet(1);
  const s = g4.discs[0];
  g4.p.i = s.i; g4.p.j = s.j;
  const snk = put(g4, 'snake', s.i - DIRS[s.d][0], s.j - DIRS[s.d][1], { wait: 2 });
  const e5 = run(g4, RIDE + 1.5, (gg) => (gg.t < DT * 1.5 ? { jump: s.d } : none));
  ok(e5.some(e => e.type === 'enemy-fall' && e.lured) && g4.score >= SCORE.snake, 'a cobra segue o sapinho na pétala e cai');
  void snk;
  // borrão despinta e pode ser pego
  const g5 = quiet(1);
  g5.cell(1, 0).paint = 1;
  put(g5, 'smudge', 0, 1, { wait: 0 });
  g5.enemies[0].state = 'hop'; g5.enemies[0].from = [0, 1]; g5.enemies[0].to = [1, 1]; g5.enemies[0].dur = 0.3; g5.enemies[0].hopAt = 0;
  g5.cell(1, 1).paint = 1;
  run(g5, 0.35);
  ok(g5.cell(1, 1).paint === 0, 'borrão despinta onde pousa');
  g5.p.i = 1; g5.p.j = 1; g5.enemies[0].wait = 9;
  const e6 = run(g5, DT * 2);
  ok(e6.some(e => e.type === 'catch') && !g5.enemies.length && g5.lives === LIVES, 'pegar o borrão dá pontos e não tira vida');
  // bola verde congela
  const g6 = quiet(1);
  put(g6, 'green', 0, 0);
  const bl = put(g6, 'ball', 2, 0, { wait: 0 });
  const e7 = run(g6, DT * 2);
  ok(e7.some(e => e.type === 'freeze') && g6.freezeT > FREEZE - 0.1, 'bola verde congela os bichos');
  const before = [bl.i, bl.j, bl.state];
  run(g6, 1);
  ok(bl.i === before[0] && bl.j === before[1] && bl.state === before[2], 'congelados não se mexem');
  // bichos aparecem sozinhos
  const g7 = new Game(10, { seed: 2 });
  const e8 = run(g7, 20);
  for (const k of ['ball', 'green', 'smudge', 'egg']) ok(e8.some(e => e.type === 'spawn' && e.kind === k), `fase 11: aparece ${k}`);
}

console.log('Chefes');
{
  // Bolota: avisa a linha, depois varre despintando e derruba quem está nela
  const g = new Game(3, { seed: 1 });
  g.timers = { balls: Infinity, green: Infinity, smudge: Infinity, egg: Infinity };
  for (const c of g.cells.values()) c.paint = 1;
  g.cell(3, 3).paint = 0;
  const ev = run(g, CARAMEL.first + 0.1);
  ok(ev.some(e => e.type === 'sweep-warn') && g.sweep?.phase === 'warn', 'a Bolota avisa a linha antes');
  const line = g.sweepCells();
  ok(line.length >= 5, 'a linha atravessa a pirâmide');
  const pc = g.playerCell();
  const onLine = g.onLine(pc[0], pc[1], g.sweep);
  const ev2 = run(g, CARAMEL.warn + 0.1);
  ok(ev2.some(e => e.type === 'sweep') && line.filter(c => !(c.i === 0 && c.j === 0)).every(c => c.paint === 0), 'a Bolota despinta a linha');
  ok(onLine ? g.lives === LIVES - 1 : g.lives === LIVES, 'quem fica na linha leva a batida');
  // Serpente: corpo também machuca; cai na pétala e volta
  const gs = quiet(7);
  const se = put(gs, 'serpent', 0, 1, { body: [[1, 1], [1, 0]] });
  gs.p.i = 1; gs.p.j = 0;
  const e3 = run(gs, DT * 2);
  ok(e3.some(e => e.type === 'hit' && e.kind === 'serpent'), 'o corpo da Serpente também machuca');
  void se;
  const gs2 = new Game(7, { seed: 3 });
  gs2.timers.balls = Infinity;
  const e4 = run(gs2, 3 + DROP * 0.5);
  ok(e4.some(e => e.type === 'spawn' && e.kind === 'serpent'), 'a Serpente aparece');
  const disc = gs2.discs[0];
  gs2.p.i = disc.i; gs2.p.j = disc.j; gs2.p.state = 'idle';
  const sp = gs2.enemies.find(e => e.kind === 'serpent');
  sp.i = disc.i - DIRS[disc.d][0]; sp.j = disc.j - DIRS[disc.d][1]; sp.state = 'idle'; sp.wait = 2; sp.body = [];
  const t5 = gs2.t;
  const e5 = run(gs2, RIDE + 2, (gg) => (gg.t < t5 + DT * 1.5 ? { jump: disc.d } : none));
  ok(e5.some(e => e.type === 'enemy-fall' && e.kind === 'serpent'), 'a Serpente cai atrás do sapinho');
  const e5b = run(gs2, SERPENT.back + 1.5);
  ok(e5b.some(e => e.type === 'spawn' && e.kind === 'serpent'), 'e volta depois de um tempo');
  ok(!disc.used || disc.back > 0, 'a pétala volta na luta da Serpente');
  // Yeti: gelo e bolas de neve marcadas
  const gy = new Game(11, { seed: 1 });
  gy.timers = { balls: Infinity, green: Infinity, smudge: Infinity, egg: Infinity };
  const e6 = run(gy, YETI.first + 0.1);
  ok(e6.some(e => e.type === 'ice') && [...gy.cells.values()].filter(c => gy.isIce(c)).length === YETI.iceCells, 'o Yeti congela cubos');
  run(gy, YETI.iceLife + 0.5);
  ok([...gy.cells.values()].filter(c => gy.isIce(c)).length <= YETI.iceCells * 2, 'o gelo derrete');
  const gy2 = new Game(11, { seed: 1 });
  gy2.timers = { balls: Infinity, green: Infinity, smudge: Infinity, egg: Infinity };
  const e7 = run(gy2, YETI.first + 1 + 0.1);
  ok(e7.some(e => e.type === 'snow-warn'), 'o Yeti marca onde a bola de neve vai cair');
  const e8 = run(gy2, YETI.warn + 0.1);
  ok(e8.some(e => e.type === 'snow') && gy2.lives === LIVES - 1, 'ficou parado na marca: leva a bola de neve');
}

console.log('Robô (limites humanos) nas 12 fases');
{
  const SEEDS = [1, 2, 3, 4, 5];
  let total = 0;
  for (let lv = 0; lv < LEVELS.length; lv++) {
    const rs = [];
    let fastest = Infinity;
    for (const seed of SEEDS) {
      const g = new Game(lv, { seed });
      const robot = makeRobot({ seed: seed * 7 });
      let landT = null;
      while (!g.over && g.t < 400) {
        const inp = robot.step(g);
        if (inp.jump != null && g.p.state === 'idle' && landT !== null) fastest = Math.min(fastest, g.t - landT);
        g.step(inp);
        if (g.events.some(e => e.type === 'land' || e.type === 'ride-end')) landT = g.t;
      }
      rs.push(g.result || { won: false, eff: 999, stars: 0, livesLost: 9 });
    }
    ok(fastest >= HUMAN.reaction + HUMAN.aim - 1e-6, `fase ${lv + 1}: o robô espera reação + mira entre os pulos (${fastest.toFixed(2)} s)`);
    const allWon = rs.every(r => r.won), minStars = Math.min(...rs.map(r => r.stars));
    ok(allWon, `fase ${lv + 1}: o robô vence com as ${SEEDS.length} sementes`);
    ok(minStars >= 2, `fase ${lv + 1}: o robô faz pelo menos 2 estrelas (${rs.map(r => r.stars).join(' ')})`);
    total += rs.reduce((s, r) => s + r.stars, 0);
    console.log(`  ${String(lv + 1).padStart(2)} ${LEVELS[lv].name.padEnd(20)} tempo efetivo ${rs.map(r => Math.round(r.eff)).join(' ').padEnd(22)} vidas perdidas ${rs.map(r => r.livesLost).join('')}  estrelas ${rs.map(r => r.stars).join('')}  (limites ${LEVELS[lv].par.join('/')})`);
  }
  console.log(`  média de estrelas do robô: ${(total / (SEEDS.length * LEVELS.length)).toFixed(2)}`);
}

console.log(fails ? `\n${fails} de ${count} testes falharam` : `\nTudo certo (${count} testes)`);
process.exit(fails ? 1 : 0);

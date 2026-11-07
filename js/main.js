// Liga as regras (sim.js) à tela, ao Quest (controles e mãos) e ao mouse/teclado.
import * as THREE from '../vendor/three/three.module.js';
import { Game, DT, DIRS, FALL, RIDE, DROP, LIVES, LIFE_PENALTY, CARAMEL } from './sim.js';
import { LEVELS, WORLDS, LEVELS_PER_WORLD } from './levels.js';
import { makeRobot } from './robot.js';
import { buildWorld, PyramidView, buildFrog, buildBall, buildEgg, buildSnake, buildSmudge, buildPetal, buildCaramel, buildYeti, buildMarker, Particles, THEMES } from './scene.js';
import { Panel, Label, C as UI } from './ui.js';
import { Sfx } from './audio.js';
import { loadSave, storeSave, rankOf, addScore } from './save.js';

const save = loadSave();
const sfx = new Sfx();
sfx.on = save.sound;
sfx.musicOn = save.music;
const IS_QUEST = /OculusBrowser|Quest/i.test(navigator.userAgent);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BOSS_NAME = { caramel: 'Bolota', serpent: 'Serpente', yeti: 'Yeti' };
const PAINT_HINT = { one: 'Pinte todos os cubos', two: 'Cada cubo precisa de duas pintadas', toggle: 'Cuidado: pisar de novo despinta' };

// ---------- Render e cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_QUEST ? 1 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation?.(1);
document.getElementById('app').appendChild(renderer.domElement);

const world = buildWorld();
const { scene } = world;
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.03, 80);
const rig = new THREE.Group();
scene.add(rig);
rig.add(camera);
const PC_CAM = new THREE.Vector3(0, 1.62, 0.32);
const PC_LOOK = new THREE.Vector3(0, 1.02, -0.55);

const pyrView = new PyramidView(scene);
const units = pyrView.units;
const particles = new Particles(scene);
const frog = buildFrog(); units.add(frog.group);
const marker = buildMarker(); marker.group.visible = false; units.add(marker.group);
const warnMarks = []; // marcas de bola de neve
const caramel = buildCaramel(); caramel.group.visible = false; units.add(caramel.group);
const yeti = buildYeti(); yeti.group.visible = false; units.add(yeti.group);
const petals = [];
const enemyViews = new Map();

// menus e placas
const panel = new Panel(0.9);
const fpsLabel = new Label(0.12);
fpsLabel.mesh.position.set(0.16, -0.14, -0.6);
fpsLabel.mesh.visible = false;
camera.add(fpsLabel.mesh);
const msgLabel = new Label(0.9, 1024, 128);
scene.add(msgLabel.mesh);
msgLabel.mesh.visible = false;

// ---------- Estado ----------
let app = 'menu';
let mode = 'level';
let level = 0;
let game = null;
let robot = makeRobot();
let demo = true;
let msg = null;
let doneTimer = 0;
let lastResult = null, newRecord = false;
let paintCount = 0;
let pendingJump = null;
let pyrYaw = 0, pyrYawV = 0;
const arcade = { score: 0, lives: LIVES, rank: -1, over: false, letters: [0, 0, 0], slot: 0 };

const unlocked = (i) => i === 0 || !!save.done[i - 1];
const nextLevel = () => { let n = 0; while (n < LEVELS.length - 1 && save.done[n]) n++; return n; };
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function newGame(lv, opts = {}) {
  level = clamp(lv, 0, LEVELS.length - 1);
  const L = LEVELS[level];
  game = new Game(level, opts);
  world.setTheme(L.world);
  pyrView.build(game, THEMES[L.world]);
  for (const v of enemyViews.values()) units.remove(v.group);
  enemyViews.clear();
  for (const p of petals) units.remove(p.group);
  petals.length = 0;
  for (const s of game.discs) { const p = buildPetal(); units.add(p.group); petals.push(p); }
  robot.reset();
  acc = 0; paintCount = 0; pendingJump = null;
  sfx.setSong(L.world, !demo);
}

function startLevel(lv, m = mode) {
  mode = m;
  demo = false;
  arcade.counted = false;
  newGame(lv, { seed: Math.floor(Math.random() * 1e6), lives: mode === 'arcade' ? arcade.lives : LIVES });
  app = 'playing';
  doneTimer = 0;
  panel.hide();
  const L = LEVELS[level], W = WORLDS[L.world];
  const head = level % LEVELS_PER_WORLD === 0 ? `${W.name}. ${W.hint}` : L.boss ? `Chefe: ${L.name}!` : `Fase ${level + 1}: ${L.name}. ${PAINT_HINT[L.paint]}`;
  showMsg(head, 5, '#fff4fa');
  if (L.boss === 'caramel') later.push({ t: time + 5.2, fn: () => showMsg('A linha que piscar vermelho vai ser esmagada: saia dela!', 4, '#ffb84a') });
  if (L.boss === 'serpent') later.push({ t: time + 5.2, fn: () => showMsg('O corpo da Serpente também machuca. As pétalas voltam!', 4, '#7affc8') });
  if (L.boss === 'yeti') later.push({ t: time + 5.2, fn: () => showMsg('Saia da marca azul antes da bola de neve. O gelo escorrega!', 4, '#5af0ff') });
  sfx.coin();
  updateHint();
}

function startArcade() {
  arcade.score = 0; arcade.lives = LIVES; arcade.rank = -1; arcade.over = false;
  startLevel(0, 'arcade');
}

function togglePause() {
  if (app === 'playing') { app = 'paused'; showScreen('pause'); }
  else if (app === 'paused') { app = 'playing'; panel.hide(); }
  sfx.setSong(LEVELS[level].world, app === 'playing');
  updateHint();
}

function goMenu() {
  app = 'menu';
  demo = true;
  newGame(nextLevel(), { seed: Math.floor(Math.random() * 1e6) });
  showScreen('main');
  updateHint();
}

function showMsg(text, t = 2, color = '#7affc8') { msg = { text, t, color }; }
const pad6 = (n) => String(Math.max(0, Math.round(n))).padStart(6, '0');
const totalStars = () => Object.values(save.done).reduce((s, d) => s + (d.stars || 0), 0);

// ---------- Menus ----------
function showScreen(name) {
  const vr = renderer.xr.isPresenting;
  placePanel();
  panel.show((p) => {
    if (name === 'main') {
      p.title('Pula-Pirâmide', 76, 72);
      p.text('Pule de cubo em cubo e pinte a pirâmide toda, sem cair nem ser pego.', 512, 136, { size: 26, color: UI.dim });
      const next = nextLevel();
      p.button(save.done[0] ? `Continuar: fase ${next + 1}` : 'Começar', () => startLevel(next, 'level'), 262, 172, 500, 86, { size: 38 });
      p.button('Fliperama (as 12 seguidas)', () => startArcade(), 262, 272, 500, 74, { size: 30 });
      p.button('Escolher fase', () => showScreen('levels'), 262, 360, 245, 70, { size: 28 });
      p.button('Recordes', () => showScreen('scores'), 517, 360, 245, 70, { size: 28 });
      p.button('Como jogar', () => showScreen('help'), 262, 444, 500, 66, { size: 28 });
      const opt = (label, key, x, after) => p.button(`${label}: ${save[key] ? 'sim' : 'não'}`, () => { save[key] = !save[key]; storeSave(save); after?.(); showScreen('main'); }, x, 526, 220, 60, { size: 24 });
      opt('Som', 'sound', 152, () => sfx.setOn(save.sound));
      opt('Música', 'music', 402, () => sfx.setMusic(save.music));
      opt('FPS', 'fps', 652);
      p.text(`Estrelas: ${totalStars()} de ${LEVELS.length * 3}${save.scores[0] ? `   ·   Recorde: ${save.scores[0].name} ${save.scores[0].score}` : ''}`, 512, 622, { size: 25, color: UI.star });
      p.text(vr ? 'Aponte e aperte o gatilho para escolher' : 'No Quest: abra esta página no navegador do óculos e aperte "Entrar em VR"', 512, 670, { size: 21, color: UI.dim });
    } else if (name === 'levels') {
      p.title('Escolher fase', 56, 48);
      WORLDS.forEach((W, w) => {
        const y = 100 + w * 190;
        p.text(W.name, 512, y + 6, { size: 26, bold: true, color: ['#ff6ab8', '#ffd25a', '#5af0ff'][w] });
        for (let k = 0; k < LEVELS_PER_WORLD; k++) {
          const i = w * LEVELS_PER_WORLD + k, L = LEVELS[i], d = save.done[i];
          p.tile(112 + k * 205, y + 26, 190, 140, { num: i + 1, name: L.boss ? `Chefe: ${L.name}` : L.name, stars: d?.stars || 0, done: !!d, locked: !unlocked(i), master: !!L.boss, action: () => startLevel(i, 'level') });
        }
      });
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 652, 300, 56, { size: 28 });
    } else if (name === 'scores') {
      p.title('Recordes do fliperama', 60, 50);
      if (!save.scores.length) p.text('Ninguém ainda. Jogue o Fliperama: as 12 fases seguidas!', 512, 300, { size: 28, color: UI.dim });
      save.scores.forEach((e, i) => {
        const y = 130 + i * 56, hl = mode === 'arcade' && arcade.over && i === arcade.rank;
        p.text(`${i + 1}.`, 250, y, { size: 34, bold: true, color: hl ? UI.edge : UI.dim, align: 'right' });
        p.text(e.name, 300, y, { size: 38, bold: true, color: hl ? UI.edge : UI.text, align: 'left' });
        p.text(pad6(e.score), 620, y, { size: 38, bold: true, color: hl ? UI.edge : UI.star, align: 'right' });
        p.text(e.level >= 13 ? 'zerou!' : `fase ${e.level}`, 660, y, { size: 26, color: UI.dim, align: 'left' });
      });
      p.button('Fliperama', () => startArcade(), 262, 588, 245, 80, { size: 30 });
      p.button('Voltar', () => showScreen('main'), 517, 588, 245, 80, { size: 30 });
    } else if (name === 'help') {
      p.title('Como jogar', 56);
      const rows = vr ? [
        'Aponte o controle para um cubo vizinho e aperte o gatilho: o sapinho pula.',
        'Segure o botão do lado (grip) e gire a mão para virar a pirâmide (ou o direcional).',
        'Pular para fora da pirâmide ou num buraco = cair e perder uma vida.',
        'As pétalas do lado levam de volta ao topo; a cobra que vem atrás cai.',
      ] : [
        'O mouse aponta um cubo vizinho; clique para o sapinho pular.',
        'Q e E (ou arrastar com o botão direito) giram a pirâmide.',
        'Pular para fora da pirâmide ou num buraco = cair e perder uma vida.',
        'As pétalas do lado levam de volta ao topo; a cobra que vem atrás cai.',
      ];
      rows.forEach((t, i) => p.text(t, 40, 112 + i * 46, { size: 23, align: 'left' }));
      const sp = [
        ['Bola vermelha: desce e machuca', '#ff4a4a'], ['Ovo roxo: vira cobra que persegue', '#a85ae0'],
        ['Borrão azul: despinta; pegue ele', '#5a6aff'], ['Bola verde: congela todo mundo', '#4ad86a'],
        ['Gelo: escorrega mais uma casa', '#8af0ff'], ['Buraco: não pise', '#ffb84a'],
      ];
      sp.forEach(([t, c], i) => p.text(t, 60 + (i % 2) * 470, 316 + Math.floor(i / 2) * 50, { size: 22, align: 'left', color: c }));
      p.text(`Chefes na 4ª fase de cada mundo. Estrelas pelo tempo (cada vida perdida = +${LIFE_PENALTY} s).`, 512, 552, { size: 22, color: UI.dim });
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 600, 300, 76);
    } else if (name === 'pause') {
      p.title('Pausa', 64);
      p.text(`Fase ${level + 1}: ${LEVELS[level].name}${mode === 'arcade' ? '  ·  fliperama' : ''}`, 512, 122, { size: 28, color: UI.dim });
      p.button('Continuar', () => togglePause(), 262, 160, 500, 84);
      p.button(mode === 'arcade' ? 'Recomeçar o fliperama' : 'Recomeçar a fase', () => (mode === 'arcade' ? startArcade() : startLevel(level)), 262, 258, 500, 80, { size: 30 });
      p.button('Recentralizar', () => { recenter(); togglePause(); }, 262, 352, 245, 80, { size: 28, locked: !vr });
      p.button('Como jogar', () => showScreen('help'), 517, 352, 245, 80, { size: 28 });
      p.button(`Som: ${save.sound ? 'sim' : 'não'}`, () => { save.sound = !save.sound; storeSave(save); sfx.setOn(save.sound); showScreen('pause'); }, 262, 446, 245, 72, { size: 26 });
      p.button(`Música: ${save.music ? 'sim' : 'não'}`, () => { save.music = !save.music; storeSave(save); sfx.setMusic(save.music); showScreen('pause'); }, 517, 446, 245, 72, { size: 26 });
      p.button('Menu principal', () => goMenu(), 262, 560, 500, 80);
    } else if (name === 'done') {
      const r = lastResult, d = save.done[level], L = LEVELS[level];
      if (r.won) {
        p.title(newRecord ? 'Pirâmide pintada! Recorde!' : 'Pirâmide pintada!', 66, 54);
        p.stars(r.stars, 512, 140, 74);
        p.text(`Tempo ${r.time.toFixed(0)} s  ·  vidas perdidas ${r.livesLost}`, 512, 212, { size: 28 });
        p.text(`Pontos ${r.score}  (bônus ${r.bonus})`, 512, 256, { size: 34, bold: true, color: UI.edge });
        p.text(`3 estrelas até ${L.par[0]} s · 2 até ${L.par[1]} s (cada vida perdida = +${LIFE_PENALTY} s)`, 512, 298, { size: 21, color: UI.dim });
        if (d) p.text(`Melhor: ${d.stars} estrela${d.stars === 1 ? '' : 's'} · ${d.score} pontos`, 512, 332, { size: 22, color: UI.dim });
      } else {
        p.title(mode === 'arcade' ? 'Fim de jogo' : 'Acabaram as vidas', 70, 58);
        p.text(`Faltaram ${game.left} cubos`, 512, 160, { size: 32, color: UI.red });
        p.text('Dica: olhe para onde as bolas vão pular e use as pétalas contra a cobra.', 512, 214, { size: 24 });
      }
      if (mode === 'arcade') {
        p.text(`Fliperama: ${pad6(arcade.score)} pontos  ·  vidas ${arcade.lives}`, 512, 384, { size: 30, bold: true, color: UI.star });
        if (r.won && level < LEVELS.length - 1) p.button('Próxima fase', () => startLevel(level + 1, 'arcade'), 262, 420, 500, 92, { size: 38 });
        else p.button('Recordes', () => showScreen('scores'), 262, 420, 500, 92, { size: 38 });
        p.button('Menu principal', () => goMenu(), 262, 540, 500, 78);
      } else {
        if (level < LEVELS.length - 1) p.button('Próxima fase', () => startLevel(level + 1, 'level'), 262, 372, 500, 90, { size: 36, locked: !unlocked(level + 1) });
        else if (r.won) p.text('Você pintou as 12 pirâmides!', 512, 416, { size: 34, bold: true, color: UI.edge });
        p.button(r.won ? 'Repetir' : 'Tentar de novo', () => startLevel(level, 'level'), 262, 478, 245, 80);
        p.button('Fases', () => showScreen('levels'), 517, 478, 245, 80);
        p.button('Menu principal', () => goMenu(), 262, 576, 500, 78);
      }
    } else if (name === 'initials') {
      p.title('Novo recorde!', 70, 60);
      p.text(`${pad6(arcade.score)} pontos  ·  ${arcade.rank + 1}º lugar`, 512, 140, { size: 34, bold: true, color: UI.star });
      p.text('Escolha suas 3 letras', 512, 190, { size: 26, color: UI.dim });
      for (let k = 0; k < 3; k++) {
        const x = 292 + k * 160;
        p.button('▲', () => { arcade.letters[k] = (arcade.letters[k] + 1) % LETTERS.length; showScreen('initials'); }, x, 220, 120, 70, { size: 36 });
        p.text(LETTERS[arcade.letters[k]], x + 60, 345, { size: 96, bold: true, color: k === arcade.slot && !vr ? UI.star : UI.edge });
        p.button('▼', () => { arcade.letters[k] = (arcade.letters[k] + LETTERS.length - 1) % LETTERS.length; showScreen('initials'); }, x, 400, 120, 70, { size: 36 });
      }
      p.button('Gravar', () => {
        const nm = arcade.letters.map(i => LETTERS[i]).join('');
        save.name = nm;
        addScore(save, nm, arcade.score, arcade.reached);
        storeSave(save);
        app = 'done';
        updateHint();
        showScreen('scores');
      }, 262, 520, 500, 90, { size: 40 });
      p.text(vr ? 'Aponte e aperte o gatilho' : 'Teclado: digite as letras (Enter grava)', 512, 650, { size: 22, color: UI.dim });
    }
  });
}

function placePanel() {
  if (renderer.xr.isPresenting) {
    if (panel.mesh.parent !== scene) scene.add(panel.mesh);
    panel.mesh.scale.setScalar(1);
    const e = new THREE.Euler().setFromQuaternion(xrHeadQuat(), 'YXZ');
    const head = xrHeadPos();
    panel.mesh.position.set(head.x - Math.sin(e.y) * 1.1, head.y - 0.05, head.z - Math.cos(e.y) * 1.1);
    panel.mesh.rotation.set(0, e.y, 0);
    return;
  }
  if (panel.mesh.parent !== camera) camera.add(panel.mesh);
  const half = THREE.MathUtils.degToRad(camera.fov / 2);
  const visH = 2 * 0.8 * Math.tan(half), visW = visH * camera.aspect;
  panel.mesh.position.set(0, 0, -0.8);
  panel.mesh.rotation.set(0, 0, 0);
  panel.mesh.scale.setScalar(Math.min(1, visW * 0.94 / 0.9, visH * 0.92 / 0.633));
}

function finishLevel() {
  const r = game.result;
  lastResult = r;
  const prev = save.done[level];
  newRecord = false;
  if (r.won) {
    newRecord = !!prev && r.score > prev.score;
    save.done[level] = { stars: Math.max(r.stars, prev?.stars || 0), score: Math.max(r.score, prev?.score || 0), time: Math.min(r.time, prev?.time ?? 1e9) };
    storeSave(save);
  }
  if (mode === 'arcade') {
    arcade.score += r.score;
    arcade.counted = true;
    arcade.lives = r.lives + (r.won && LEVELS[level].boss ? 1 : 0);
    arcade.reached = r.won ? level + 2 : level + 1;
    if (!r.won || level === LEVELS.length - 1) {
      arcade.over = true;
      arcade.rank = rankOf(save, arcade.score);
      if (arcade.rank >= 0) {
        arcade.letters = [...(save.name || 'AAA')].map(ch => Math.max(0, LETTERS.indexOf(ch)));
        arcade.slot = 0;
        app = 'initials';
        showScreen('initials');
        for (let k = 0; k < r.stars; k++) setTimeout(() => sfx.star(k), 300 + k * 220);
        updateHint();
        return;
      }
    }
  }
  app = 'done';
  showScreen('done');
  for (let k = 0; k < r.stars; k++) setTimeout(() => sfx.star(k), 300 + k * 220);
  updateHint();
}

// ---------- Mira: de um raio (no mundo) para a direção do pulo ----------
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _inv = new THREE.Matrix4(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
function rayBox(o, d, x0, x1, y0, y1, z0, z1) {
  let tmin = 0, tmax = 1e9;
  for (const [oo, dd, a, b] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
    if (Math.abs(dd) < 1e-9) { if (oo < a || oo > b) return -1; continue; }
    let t1 = (a - oo) / dd, t2 = (b - oo) / dd;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}
// devolve { d, kind, at: [i, j], y } ou null
function aimAt(origin, dir) {
  if (!game) return null;
  units.updateMatrixWorld(true);
  _inv.copy(units.matrixWorld).invert();
  _o.copy(origin).applyMatrix4(_inv);
  _d.copy(dir).transformDirection(_inv);
  const P = game.p;
  const base = P.state === 'jump' && game.cell(P.to[0], P.to[1]) ? P.to : P.state === 'idle' ? [P.i, P.j] : null;
  if (!base) return null;
  let best = null, bt = Infinity;
  for (const c of game.cells.values()) {
    if (c.i === base[0] && c.j === base[1]) continue;   // a própria casa não tapa a de trás
    const t = rayBox(_o, _d, c.i - 0.5, c.i + 0.5, 0, c.h + 1, c.j - 0.5, c.j + 0.5);
    if (t >= 0 && t < bt) { bt = t; best = [c.i, c.j]; }
  }
  for (const s of game.discs) {
    if (s.used) continue;
    const di = s.i + DIRS[s.d][0], dj = s.j + DIRS[s.d][1];
    const t = rayBox(_o, _d, di - 0.5, di + 0.5, 0.5, 1.6, dj - 0.5, dj + 0.5);
    if (t >= 0 && t < bt) { bt = t; best = [di, dj]; }
  }
  const bc = game.cell(base[0], base[1]);
  if (!best) {
    // nada na frente: usa o plano na altura do sapinho
    const y = bc.h + 1;
    if (Math.abs(_d.y) < 1e-6) return null;
    const t = (y - _o.y) / _d.y;
    if (t < 0) return null;
    const px = _o.x + _d.x * t, pz = _o.z + _d.z * t;
    if (Math.hypot(px - base[0], pz - base[1]) < 0.4) return null;
    best = [Math.round(px), Math.round(pz)];
  }
  const dx = best[0] - base[0], dz = best[1] - base[1];
  if (!dx && !dz) return null;
  const d = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 0 : 1) : (dz > 0 ? 2 : 3);
  const o = game.outcome(base[0], base[1], d);
  const ti = base[0] + DIRS[d][0], tj = base[1] + DIRS[d][1];
  const tc = game.cell(ti, tj);
  return { d, kind: o.kind, at: [ti, tj], y: tc ? tc.h + 1 : bc.h + 1 };
}

// ---------- Controles do VR ----------
const SIDES = ['left', 'right'];
const ctrls = [];
for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);
  rig.add(ctrl);
  const laser = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0x7affc8 }));
  laser.visible = false;
  ctrl.add(laser);
  const entry = { ctrl, laser, source: null, side: null, prevButtons: [], hoverIndex: -1, aim: null, grip: null };
  ctrls.push(entry);
  ctrl.addEventListener('connected', (e) => { entry.source = e.data; entry.side = e.data.handedness; });
  ctrl.addEventListener('disconnected', () => { entry.source = null; entry.side = null; entry.grip = null; });
  ctrl.addEventListener('selectstart', () => onSelect(entry));
  ctrl.addEventListener('squeezestart', () => { entry.grip = { a0: handAngle(entry), yaw0: pyrYaw }; });
  ctrl.addEventListener('squeezeend', () => { entry.grip = null; });
}
const entryFor = (side) => ctrls.find(e => e.side === side && e.source);
function pulse(side, v, ms) {
  try { entryFor(side)?.source?.gamepad?.hapticActuators?.[0]?.pulse?.(clamp(v, 0, 1), ms); } catch { /* sem vibração */ }
}
const both = (v, ms) => { pulse('left', v, ms); pulse('right', v, ms); };
let lastHand = 'right';
function handAngle(e) {
  e.ctrl.getWorldPosition(_v);
  const c = pyrView.pyr.position;
  return Math.atan2(_v.x - c.x, _v.z - c.z);
}
function onSelect(entry) {
  sfx.unlock();
  if (panel.visible) { if (entry.hoverIndex >= 0) { const a = panel.actionAt(entry.hoverIndex); if (a) { sfx.click(); a(); } } return; }
  if (app === 'playing' && !dev.autoplay && entry.aim) { pendingJump = entry.aim.d; lastHand = entry.side; }
}
function pollButtons(dt) {
  for (const e of ctrls) {
    const gp = e.source?.gamepad;
    if (!gp || e.source.hand) continue;
    const b = gp.buttons.map(x => x.pressed);
    if (b[5] && !e.prevButtons[5] && (app === 'playing' || app === 'paused')) togglePause();   // B ou Y
    e.prevButtons = b;
    const ax = gp.axes?.[2] || 0;
    if (Math.abs(ax) > 0.2 && !panel.visible) pyrYaw += ax * 1.8 * dt;
  }
  for (const e of ctrls) if (e.grip && e.source) {
    let da = handAngle(e) - e.grip.a0;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    pyrYaw = e.grip.yaw0 + da;
  }
}

// ---------- VR: sessão e recentralizar ----------
let recenterIn = 0;
function xrHeadPos() { return renderer.xr.isPresenting ? renderer.xr.getCamera().getWorldPosition(new THREE.Vector3()) : camera.getWorldPosition(new THREE.Vector3()); }
function xrHeadQuat() { return renderer.xr.isPresenting ? renderer.xr.getCamera().getWorldQuaternion(new THREE.Quaternion()) : camera.getWorldQuaternion(new THREE.Quaternion()); }
function recenter() {
  if (!renderer.xr.isPresenting) return;
  // põe a cabeça em x = 0, z = 0 olhando para a pirâmide (-z); a altura fica
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  rig.rotation.set(0, -e.y, 0);
  const head = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -e.y);
  rig.position.set(-head.x, 0, -head.z);
  if (panel.visible) placePanel();
}
renderer.xr.addEventListener('sessionstart', () => {
  recenterIn = 6;
  camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
  if (panel.visible) setTimeout(placePanel, 150);
  updateHint();
});
renderer.xr.addEventListener('sessionend', () => {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  if (panel.visible) placePanel();
  onResize();
  updateHint();
});

// ---------- Mouse e teclado (PC) ----------
const mouse = { ndc: new THREE.Vector2(0, 0), has: false, rdown: false, lx: 0 };
const keys = {};
const raycaster = new THREE.Raycaster();
const canvas = renderer.domElement;
let pcAim = null;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  setMouse(e);
  if (e.button === 2) { mouse.rdown = true; mouse.lx = e.clientX; return; }
  if (panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    const a = panel.actionAt(panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv));
    if (a) { sfx.click(); a(); }
    return;
  }
  if (e.button === 0 && app === 'playing' && !dev.autoplay) {
    raycaster.setFromCamera(mouse.ndc, camera);
    const a = aimAt(raycaster.ray.origin, raycaster.ray.direction);
    if (a) pendingJump = a.d;
  }
});
window.addEventListener('pointerup', (e) => { if (e.button === 2) mouse.rdown = false; });
canvas.addEventListener('pointermove', (e) => {
  if (mouse.rdown && !renderer.xr.isPresenting) { pyrYaw += (e.clientX - mouse.lx) * 0.01; mouse.lx = e.clientX; }
  setMouse(e);
});
function setMouse(e) { mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1); mouse.has = true; }
window.addEventListener('blur', () => { mouse.rdown = false; for (const k in keys) keys[k] = false; });
window.addEventListener('keydown', (e) => {
  sfx.unlock();
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if (app === 'initials') {
    if (/^[a-z0-9]$/.test(k)) { arcade.letters[arcade.slot] = LETTERS.indexOf(k.toUpperCase()); arcade.slot = (arcade.slot + 1) % 3; showScreen('initials'); }
    else if (k === 'backspace') { arcade.slot = (arcade.slot + 2) % 3; showScreen('initials'); }
    else if (k === 'enter') panel.buttons.at(-1)?.action?.();
    return;
  }
  keys[k] = true;
  if (e.repeat) return;
  if (k === 'escape' || k === 'p') { if (app === 'playing' || app === 'paused') togglePause(); return; }
  if (k === 'f') { save.fps = !save.fps; storeSave(save); }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (panel.visible) placePanel();
}
window.addEventListener('resize', onResize);

function updatePcCamera(dt) {
  const turn = (keys.e ? 1 : 0) - (keys.q ? 1 : 0);
  pyrYaw += turn * 1.8 * dt;
  if (renderer.xr.isPresenting) return;
  camera.position.copy(PC_CAM);
  camera.lookAt(PC_LOOK);
}

// mira de cada frame: mostra a marca no cubo para onde o sapinho vai pular
function updateAim() {
  const vr = renderer.xr.isPresenting;
  let a = null;
  if (app === 'playing' && !dev.autoplay && !panel.visible) {
    if (vr) {
      for (const e of ctrls) {
        e.aim = null;
        if (!e.source) continue;
        e.ctrl.getWorldPosition(_v); e.ctrl.getWorldQuaternion(_q);
        e.aim = aimAt(_v.clone(), _v2.set(0, 0, -1).applyQuaternion(_q).clone());
      }
      a = (entryFor(lastHand)?.aim) || ctrls.find(e => e.aim)?.aim || null;
    } else if (mouse.has) {
      raycaster.setFromCamera(mouse.ndc, camera);
      a = pcAim = aimAt(raycaster.ray.origin, raycaster.ray.direction);
    }
  }
  marker.group.visible = !!a;
  if (a) {
    marker.group.position.set(a.at[0], a.y + 0.06, a.at[1]);
    const bad = a.kind === 'fall';
    marker.ring.visible = !bad; marker.cross.visible = bad;
    marker.ring.material.color.set(a.kind === 'disc' ? '#ffe45a' : '#7affc8');
    marker.group.scale.setScalar(1 + 0.08 * Math.sin(time * 8));
  }
}

// ---------- Desenho ----------
const SPLAT = 0.9;
function cellTop(i, j, fallbackH = 0) { const c = game.cell(i, j); return new THREE.Vector3(i, (c ? c.h : fallbackH) + 1, j); }
function hopPos(from, to, f, arc) {
  const a = cellTop(from[0], from[1]);
  const b = cellTop(to[0], to[1], a.y - 1);
  const p = a.clone().lerp(b, f);
  p.y += Math.sin(Math.PI * f) * arc;
  return p;
}
function fallPos(from, to, t) {
  const a = cellTop(from[0], from[1]);
  const p = new THREE.Vector3(to[0] + (to[0] - from[0]) * 0.3 * (t / FALL), a.y - 12 * (t / FALL) ** 2, to[1] + (to[1] - from[1]) * 0.3 * (t / FALL));
  return p;
}
const faceOf = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);
function drawPlayer(ahead) {
  const P = game.p;
  const g = frog.group;
  g.visible = true;
  let pos, rotY = g.rotation.y;
  if (P.state === 'jump') {
    const f = clamp((P.t + ahead) / P.dur, 0, 1);
    pos = hopPos(P.from, P.to, f, P.forced ? 0.15 : SPLAT);
    if (P.from[0] !== P.to[0] || P.from[1] !== P.to[1]) rotY = faceOf(P.from, P.to);
    g.scale.set(1, 1 + 0.15 * Math.sin(Math.PI * f), 1);
  } else if (P.state === 'fall') {
    pos = fallPos(P.from, P.to, P.t + ahead);
    g.scale.setScalar(1);
  } else if (P.state === 'ride') {
    const s = P.from, d = P.dir;
    const start = new THREE.Vector3(s[0] + DIRS[d][0], 1.05, s[1] + DIRS[d][1]);
    const end = new THREE.Vector3(0, game.n + 1.6, 0);
    const f = clamp((P.t + ahead) / RIDE, 0, 1);
    pos = start.clone().lerp(end, f * f * (3 - 2 * f));
    pos.y += Math.sin(Math.PI * f) * 1.2;
    rotY += 0.05;
  } else {
    pos = cellTop(P.i, P.j);
    g.scale.set(1, 1 + 0.04 * Math.sin(time * 5), 1);
  }
  g.position.copy(pos);
  g.rotation.y = rotY;
  const hurt = game.respite > 0 && Math.floor(time * 10) % 2 === 0;
  frog.skin.color.set(hurt ? '#ff8a8a' : game.freezeT > 0 ? '#7ae8ff' : '#4ad86a');
  return pos;
}
function viewFor(e) {
  let v = enemyViews.get(e.id);
  const want = e.kind;
  if (v && v.kind !== want) { units.remove(v.group); v = null; }
  if (!v) {
    const th = THEMES[LEVELS[level].world];
    const b = want === 'ball' ? buildBall('#ff3a3a') : want === 'green' ? buildBall('#3ad86a') : want === 'egg' ? buildEgg() : want === 'snake' ? buildSnake('#8a3ad8') : want === 'serpent' ? buildSnake('#2aa86a', 5) : buildSmudge();
    v = { ...b, kind: want };
    if (want === 'serpent') { v.body = [0, 1, 2].map(() => { const s = buildBall('#2a9a5a'); units.add(s.group); s.group.scale.setScalar(0.85); return s; }); }
    void th;
    units.add(v.group);
    enemyViews.set(e.id, v);
  }
  return v;
}
function drawEnemies(ahead) {
  const alive = new Set();
  const frozen = game.freezeT > 0;
  for (const e of game.enemies) {
    alive.add(e.id);
    const v = viewFor(e);
    let pos;
    const ta = frozen ? 0 : ahead;
    if (e.state === 'drop') { pos = cellTop(e.i, e.j); pos.y += 7 * (1 - Math.min(1, (e.t + ta) / e.dur)) ** 2; }
    else if (e.state === 'hop') pos = hopPos(e.from, e.to, clamp((e.t + ta) / e.dur, 0, 1), e.kind === 'snake' || e.kind === 'serpent' ? 0.5 : 0.7);
    else if (e.state === 'fall') pos = fallPos(e.from, e.to, e.t + ta);
    else pos = cellTop(e.i, e.j);
    v.group.position.copy(pos);
    if (e.state === 'hop' && (e.from[0] !== e.to[0] || e.from[1] !== e.to[1])) v.group.rotation.y = faceOf(e.from, e.to);
    if (e.state === 'hatch') v.group.rotation.z = Math.sin(time * 30) * 0.15;
    if ((e.kind === 'snake' || e.kind === 'serpent') && v.tongue) v.tongue.visible = Math.floor(time * 4) % 2 === 0;
    if (v.mat) v.mat.emissiveIntensity = frozen ? 0.8 : 0.25;
    if (v.body) v.body.forEach((s, k) => { const b = e.body?.[k]; s.group.visible = !!b; if (b) s.group.position.copy(cellTop(b[0], b[1])); });
  }
  for (const [id, v] of enemyViews) if (!alive.has(id)) { units.remove(v.group); if (v.body) v.body.forEach(s => units.remove(s.group)); enemyViews.delete(id); }
}
function drawBosses(ahead) {
  const s = game.sweep;
  caramel.group.visible = !!s;
  if (s) {
    const n = game.n;
    let f = s.phase === 'warn' ? 0 : 1 - (s.t - ahead) / CARAMEL.roll;
    f = clamp(f, 0, 1);
    const along = (-(n + 1.5) + f * (2 * n + 3)) * s.dir;
    const hAt = (x) => n - 1 - Math.min(n - 1, Math.max(Math.abs(Math.round(x)), Math.abs(s.c)));
    if (s.axis === 0) caramel.group.position.set(s.c, Math.max(0, hAt(along) + 1) - 0.2, along);
    else caramel.group.position.set(along, Math.max(0, hAt(along) + 1) - 0.2, s.c);
    caramel.group.rotation.y = s.axis === 0 ? (s.dir > 0 ? 0 : Math.PI) : (s.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    caramel.ball.rotation.x = f * 8;
    caramel.group.scale.setScalar(s.phase === 'warn' ? 0.6 + 0.4 * (1 - s.t / CARAMEL.warn) : 1);
    if (s.phase === 'warn') { caramel.group.position.y = game.n + 3 + Math.sin(time * 6) * 0.2; }
  }
  yeti.group.visible = game.boss === 'yeti';
  if (yeti.group.visible) {
    const n = game.n;
    yeti.group.position.set(Math.sin(time * 0.4) * 2, n + 2.2 + Math.sin(time * 1.3) * 0.3, -n - 3.5);
    yeti.group.rotation.y = 0;
    const sn = game.snows.find(x => x.t > 0);
    yeti.snowball.visible = !!sn;
    if (sn) {
      const f = 1 - sn.t / 1.1;
      const target = cellTop(sn.i, sn.j);
      const start = new THREE.Vector3(0, 2.6, 0.6);
      const local = yeti.group.worldToLocal(units.localToWorld(target.clone()));
      yeti.snowball.position.copy(start.lerp(local, f * f));
    }
  }
  // marcas da bola de neve
  while (warnMarks.length < game.snows.length) { const m = buildMarker(); m.ring.material = m.ring.material.clone(); m.ring.material.color.set('#5af0ff'); m.cross.visible = false; units.add(m.group); warnMarks.push(m); }
  warnMarks.forEach((m, k) => {
    const s = game.snows[k];
    m.group.visible = !!s && s.t > 0;
    if (m.group.visible) { m.group.position.copy(cellTop(s.i, s.j)).add(new THREE.Vector3(0, 0.07, 0)); m.group.scale.setScalar(1.6 - 0.8 * (1 - s.t / 1.1)); }
  });
  // pétalas
  game.discs.forEach((s, k) => {
    const p = petals[k];
    if (!p) return;
    const riding = game.p.state === 'ride' && game.p.disc === s;
    p.group.visible = !s.used || riding;
    if (riding) p.group.position.copy(frog.group.position).add(new THREE.Vector3(0, -0.05, 0));
    else p.group.position.set(s.i + DIRS[s.d][0] * 1.05, 1 + Math.sin(time * 2 + k) * 0.08, s.j + DIRS[s.d][1] * 1.05);
    p.disc.rotation.z = time * 1.5;
  });
}

// ---------- HUD ----------
const hintEl = document.getElementById('hint');
const hudEl = document.getElementById('hud');
const msgEl = document.getElementById('msg');
const fpsEl = document.getElementById('fps');
function updateHint() {
  if (renderer.xr.isPresenting) { hintEl.textContent = ''; return; }
  hintEl.innerHTML = app === 'playing'
    ? '<span>Mouse: aponte um cubo vizinho e clique para pular · Q/E ou botão direito arrastando: gira a pirâmide · Esc: pausa</span>'
    : app === 'initials' ? '<span>Digite as 3 letras e aperte Enter</span>' : '<span>Clique nas opções do painel</span>';
}
function updateBoard() {
  if (!game) return;
  if (app === 'menu') {
    const best = save.scores[0];
    world.setBoard([
      { text: 'PULA-PIRÂMIDE', x: 30, size: 58, color: '#7affc8' },
      { text: best ? `${best.name} ${pad6(best.score)}` : 'INSIRA FICHA', x: 994, align: 'right', size: 44, color: '#ff6ab8' },
    ]);
    return;
  }
  const score = mode === 'arcade' ? arcade.score + (arcade.counted ? 0 : game.score) : game.score;
  const L = LEVELS[level];
  world.setBoard([
    { text: L.boss ? BOSS_NAME[L.boss].toUpperCase() : `FASE ${level + 1}`, x: 26, size: 50, color: L.boss ? '#ff6ab8' : '#7affc8' },
    { text: pad6(score), x: 560, align: 'center', size: 70, color: '#ffe45a' },
    { text: `${game.left}▢ ${'♥'.repeat(Math.max(0, game.lives))}`, x: 1000, align: 'right', size: 48, color: '#ff5a6a' },
  ]);
}
function updateHud(dt) {
  const vr = renderer.xr.isPresenting;
  const playing = (app === 'playing' || app === 'done' || app === 'paused') && !!game && !demo;
  if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
  updateBoard();
  if (!vr) {
    msgLabel.mesh.visible = false;
    hudEl.style.display = playing ? 'block' : 'none';
    if (playing) {
      const L = LEVELS[level];
      const html = `<b>${level + 1}. ${L.name}</b><br><em>${WORLDS[L.world].name}${mode === 'arcade' ? ' · fliperama' : ''}</em>`
        + `<div>Tempo ${Math.floor(game.result?.time ?? game.t)} s · vidas ${'♥'.repeat(Math.max(0, game.lives))}</div>`
        + `<div>Faltam ${game.left} de ${game.total} cubos</div>`
        + `<div><em>${PAINT_HINT[L.paint]}</em></div>`
        + (game.freezeT > 0 ? `<div style="color:#7ae8ff">Congelados: ${Math.ceil(game.freezeT)} s</div>` : '')
        + (game.sweep?.phase === 'warn' ? '<div style="color:#ff5a3a">A Bolota vai esmagar a linha vermelha!</div>' : '')
        + (game.snows.some(s => s.t > 0) ? '<div style="color:#5af0ff">Bola de neve: saia da marca azul!</div>' : '');
      if (hudEl.dataset.last !== html) { hudEl.innerHTML = html; hudEl.dataset.last = html; }
    }
    const mtxt = msg && playing ? msg.text : '';
    if (msgEl.dataset.last !== mtxt) { msgEl.textContent = mtxt; msgEl.style.color = msg?.color || '#fff'; msgEl.dataset.last = mtxt; }
    msgEl.style.display = mtxt ? 'block' : 'none';
    return;
  }
  hudEl.style.display = msgEl.style.display = 'none';
  msgLabel.mesh.visible = playing && !!msg;
  if (!playing) return;
  const hp = xrHeadPos(), hq = xrHeadQuat();
  const fwd = _v.set(0, 0, -1).applyQuaternion(hq);
  const up = _v2.set(0, 1, 0).applyQuaternion(hq);
  const k = Math.min(1, dt * 2.5);
  const tgt = hp.clone().addScaledVector(fwd, 1.4).addScaledVector(up, 0.3);
  msgLabel.mesh.position.lerp(tgt, msgLabel.mesh.visible ? k : 1);
  msgLabel.mesh.lookAt(hp);
  if (msg) msgLabel.set([{ text: msg.text, size: 0.62, color: msg.color, bold: false }]);
}

// ---------- Eventos do jogo -> som, vibração, avisos, efeitos ----------
const wpos = (i, j, h = null) => { const c = game.cell(i, j); return units.localToWorld(new THREE.Vector3(i, (h ?? (c ? c.h : 0)) + 1, j)); };
function handleEvents(evs) {
  const quiet = demo;
  const th = THEMES[LEVELS[level].world];
  for (const ev of evs) {
    switch (ev.type) {
      case 'jump': if (!quiet) { sfx.jump(wpos(...ev.from)); pulse(lastHand, 0.2, 15); } break;
      case 'slide': if (!quiet) sfx.slide(wpos(...ev.from)); break;
      case 'paint': {
        pyrView.hit(ev.i, ev.j);
        const p = wpos(ev.i, ev.j);
        particles.burst(p, th.top[ev.paint >= ev.need ? 2 : 1], 10, 0.5, 0.5, 0.012, 1.5);
        if (!quiet) { sfx.paint(p, paintCount++, ev.paint >= ev.need); pulse(lastHand, 0.35, 25); }
        break;
      }
      case 'unpaint': {
        const p = wpos(ev.i, ev.j);
        particles.burst(p, '#ffffff', 6, 0.4, 0.4, 0.01, 1);
        if (!quiet) sfx.unpaint(p);
        break;
      }
      case 'step': if (!quiet) sfx.stepOn(wpos(ev.i, ev.j)); break;
      case 'land': break;
      case 'fall': if (!quiet) { sfx.fall(wpos(game.p.from[0], game.p.from[1])); showMsg('Caiu!', 1.5, '#ff5a6a'); } break;
      case 'ride': if (!quiet) { sfx.ride(); showMsg('Pétala! De volta ao topo', 1.5, '#ffe45a'); } break;
      case 'ride-end': break;
      case 'spawn': if (!quiet) sfx.spawn(wpos(ev.i, ev.j, ev.h)); break;
      case 'enemy-land': if (!quiet) sfx.enemyLand(wpos(ev.i, ev.j, ev.h), ev.kind); break;
      case 'enemy-hop': break;
      case 'hatch': particles.burst(wpos(ev.i, ev.j, ev.h), '#e8c8ff', 16, 0.5, 0.5, 0.015, 1); if (!quiet) { sfx.hatch(wpos(ev.i, ev.j, ev.h)); showMsg('O ovo chocou: cobra!', 1.6, '#a85ae0'); } break;
      case 'enemy-fall':
        if (ev.lured && !quiet) { sfx.snakeFall(wpos(...ev.at, 0)); showMsg(`A ${ev.kind === 'serpent' ? 'Serpente' : 'cobra'} caiu atrás de você! +500`, 2, '#7affc8'); }
        else if (!quiet) sfx.enemyFall(wpos(...ev.at, 0));
        break;
      case 'hit': {
        const p = wpos(ev.i, ev.j);
        particles.burst(p, '#ff5a5a', 30, 0.8, 0.7, 0.02, 1.5);
        if (!quiet) { sfx.hit(); both(1, 300); showMsg(game.lives > 0 ? `Ai! ${game.lives === 1 ? 'Última vida!' : `Restam ${game.lives} vidas`}` : 'Ai!', 2, '#ff5a6a'); }
        break;
      }
      case 'lost-life': if (!quiet && ev.why === 'fall') both(0.8, 200); break;
      case 'freeze': particles.burst(wpos(ev.i, ev.j), '#7ae8ff', 30, 0.8, 0.8, 0.015, 0.5); if (!quiet) { sfx.freeze(); showMsg('Congelou tudo!', 1.6, '#7ae8ff'); } break;
      case 'catch': particles.burst(wpos(ev.i, ev.j), '#5a6aff', 20, 0.7, 0.6, 0.015, 1); if (!quiet) { sfx.catch(wpos(ev.i, ev.j)); showMsg('Pegou o borrão! +300', 1.4, '#9aa8ff'); } break;
      case 'sweep-warn': if (!quiet) { sfx.warn(units.localToWorld(new THREE.Vector3(0, game.n + 3, 0))); showMsg('Bolota! Saia da linha vermelha', 1.3, '#ff5a3a'); } break;
      case 'sweep': if (!quiet) { sfx.roll(units.localToWorld(new THREE.Vector3(0, game.n, 0))); both(0.4, 300); } break;
      case 'ice': for (const [i, j, h] of ev.cells) particles.burst(wpos(i, j, h), '#c8f4ff', 10, 0.4, 0.6, 0.012, 0.5); if (!quiet) { sfx.ice(units.localToWorld(new THREE.Vector3(0, game.n, -3))); } break;
      case 'thaw': break;
      case 'snow-warn': if (!quiet) sfx.snowWarn(wpos(ev.i, ev.j, ev.h)); break;
      case 'snow': particles.burst(wpos(ev.i, ev.j, ev.h), '#ffffff', 30, 1, 0.6, 0.02, 1.5); if (!quiet) sfx.snow(wpos(ev.i, ev.j, ev.h)); break;
      case 'disc-back': if (!quiet) sfx.discBack(); break;
      case 'won': if (!quiet) { sfx.won(); doneTimer = 2.2; showMsg('Pirâmide pintada!', 2.2, '#7affc8'); for (let k = 0; k < 5; k++) later.push({ t: time + k * 0.2, fn: () => particles.burst(units.localToWorld(new THREE.Vector3(0, game.n + 1, 0)), ['#ff6ab8', '#ffe45a', '#7affc8'][k % 3], 40, 1.2, 1, 0.02, 1) }); } break;
      case 'lost': if (!quiet) { sfx.lost(); both(1, 400); doneTimer = 2.5; showMsg('Acabaram as vidas...', 2.5, '#ff5a6a'); } break;
    }
  }
}

// ---------- Botão de VR ----------
const vrBtn = document.getElementById('vr');
async function setupVR() {
  const okXR = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!okXR) {
    vrBtn.textContent = window.isSecureContext ? 'VR não disponível neste navegador' : 'VR precisa de HTTPS';
    vrBtn.disabled = true;
    return;
  }
  vrBtn.textContent = 'Entrar em VR';
  vrBtn.disabled = false;
  vrBtn.onclick = async () => {
    sfx.unlock();
    if (renderer.xr.isPresenting) { renderer.xr.getSession()?.end(); return; }
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      await renderer.xr.setSession(session);
      vrBtn.textContent = 'Sair do VR';
      session.addEventListener('end', () => { vrBtn.textContent = 'Entrar em VR'; });
    } catch (err) {
      vrBtn.textContent = 'Erro ao entrar em VR';
      console.error(err);
    }
  };
}
setupVR();

// ---------- Laço principal ----------
let acc = 0, lastT = performance.now(), time = 0;
let fpsFrames = 0, fpsTime = 0;
const later = [];
const _lf = new THREE.Vector3(), _lu = new THREE.Vector3();

function ambient(dt) {
  const w = LEVELS[level].world;
  if (w === 2) { for (let k = 0; k < 2; k++) if (Math.random() < dt * 25) particles.spawn((Math.random() - 0.5) * 8, 4, (Math.random() - 0.5) * 8 - 1, 0.1, -0.6, 0, 7, 0.025, '#ffffff', 0); }
  else if (w === 1) { if (Math.random() < dt * 4) particles.spawn((Math.random() - 0.5) * 6, 0.3, (Math.random() - 0.5) * 6, 0, 0.25, 0, 5, 0.03, '#ffd25a', -0.02); }
  else if (Math.random() < dt * 6) particles.spawn((Math.random() - 0.5) * 6, 0.2, (Math.random() - 0.5) * 6 - 1, 0, 0.3, 0, 4, 0.03, ['#ff6ab8', '#7ad8ff', '#ffe45a'][Math.floor(Math.random() * 3)], -0.03);
}

function tick(dt) {
  time += dt;
  const vr = renderer.xr.isPresenting;
  if (recenterIn > 0 && --recenterIn === 0) recenter();
  pollButtons(dt);
  rig.updateMatrixWorld(true);
  updatePcCamera(dt);
  camera.updateMatrixWorld(true);
  // pirâmide gira com suavidade até o ângulo pedido
  pyrYawV += (pyrYaw - pyrYawV) * Math.min(1, dt * 14);
  pyrView.pyr.rotation.y = pyrYawV;

  const running = app === 'playing' || app === 'done' || app === 'menu' || app === 'initials';
  if (running) {
    acc += dt;
    const n = Math.min(12, Math.floor(acc / DT));
    for (let i = 0; i < n; i++) {
      let inp;
      if (dev.autoplay || demo) inp = robot.step(game);
      else { inp = { jump: app === 'playing' ? pendingJump : null }; pendingJump = null; }
      game.step(inp);
      handleEvents(game.events);
    }
    acc -= n * DT;
    if (demo && game.over) newGame(Math.floor(Math.random() * LEVELS.length), { seed: Math.floor(Math.random() * 1e6) });
  } else acc = 0;
  if (app === 'playing' && doneTimer > 0) { doneTimer -= dt; if (doneTimer <= 0) finishLevel(); }
  for (let i = later.length - 1; i >= 0; i--) if (time >= later[i].t) { const f = later[i].fn; later.splice(i, 1); f(); }

  // visual
  const ahead = app === 'paused' ? 0 : acc;
  const th = THEMES[LEVELS[level].world];
  const s = game.sweep;
  pyrView.update(game, th, app === 'paused' ? 0 : dt, time, s ? (c) => game.onLine(c.i, c.j, s) : null);
  drawPlayer(ahead);
  drawEnemies(ahead);
  drawBosses(ahead);
  updateAim();
  if (app !== 'paused') { ambient(dt); particles.update(dt); }
  particles.mat.uniforms.uScale.value = vr ? 800 : renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  world.update(app === 'paused' ? 0 : dt, time);
  updateHud(dt);
  updateMenuRays();

  if (sfx.ctx) {
    const hq = xrHeadQuat();
    sfx.setListener(xrHeadPos(), _lf.set(0, 0, -1).applyQuaternion(hq), _lu.set(0, 1, 0).applyQuaternion(hq));
  }

  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    const f = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
    fpsEl.style.display = save.fps && !vr ? 'block' : 'none';
    fpsEl.textContent = `${f} FPS`;
    fpsLabel.mesh.visible = save.fps && vr;
    fpsLabel.set(`${f} FPS`);
  }
}

// ---------- Raios do menu ----------
const rayOrigin = new THREE.Vector3(), rayDir = new THREE.Vector3();
function updateMenuRays() {
  const vr = renderer.xr.isPresenting;
  let hover = -1;
  for (const e of ctrls) {
    e.hoverIndex = -1;
    e.laser.visible = false;
    if (!vr || !e.source) continue;
    e.ctrl.getWorldPosition(rayOrigin);
    e.ctrl.getWorldQuaternion(_q);
    rayDir.set(0, 0, -1).applyQuaternion(_q);
    if (!panel.visible) {
      // durante o jogo o raio mostra para onde aponta (curto)
      e.laser.visible = app === 'playing';
      e.laser.scale.z = 0.6;
      continue;
    }
    raycaster.set(rayOrigin, rayDir);
    const hit = raycaster.intersectObject(panel.mesh)[0];
    e.laser.visible = true;
    e.laser.scale.z = hit ? hit.distance : 1.2;
    e.hoverIndex = panel.pick(hit?.uv);
    if (e.hoverIndex >= 0) hover = e.hoverIndex;
  }
  if (!vr && panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    hover = panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv);
    canvas.style.cursor = hover >= 0 && panel.actionAt(hover) ? 'pointer' : 'default';
  } else if (!vr) canvas.style.cursor = app === 'playing' && pcAim ? 'pointer' : 'default';
  if (panel.visible) panel.setHover(hover);
}

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  tick(dt);
  renderer.render(scene, camera);
}

// ---------- Depuração (console do navegador) ----------
// dev.loadLevel(5)      abre a fase 5 (1 a 12)
// dev.autoplay = true   o robô joga (limites humanos)
// dev.advance(20)       avança 20 s de jogo na hora
// dev.state()           resumo: tela, fase, vidas, pontos, sapinho, bichos, chefes
// dev.snapshot()        imagem da tela (JPEG em data URL)
// dev.arcade()          começa o fliperama
// dev.resetSave()       apaga progresso e recordes
const dev = {
  _auto: false,
  get autoplay() { return this._auto; },
  set autoplay(v) { this._auto = !!v; robot.reset(); updateHint(); },
  loadLevel(n) { startLevel(clamp(n, 1, LEVELS.length) - 1, 'level'); return this.state(); },
  arcade() { startArcade(); return this.state(); },
  advance(sec, step = 1 / 72) {
    const frames = Math.round(sec / step);
    for (let i = 0; i < frames; i++) tick(step);
    lastT = performance.now();
    renderer.render(scene, camera);
    return this.state();
  },
  state() {
    return {
      tela: app, modo: mode, fase: level + 1, nome: LEVELS[level].name, mundo: WORLDS[LEVELS[level].world].name, pintura: LEVELS[level].paint,
      tempo: +game.t.toFixed(1), vidas: game.lives, pontos: game.score, fliperama: mode === 'arcade' ? arcade.score : null,
      sapinho: { casa: [game.p.i, game.p.j], estado: game.p.state }, faltam: game.left, de: game.total,
      bichos: game.enemies.map(e => ({ tipo: e.kind, casa: [e.i, e.j], estado: e.state })), congelados: +game.freezeT.toFixed(1),
      petalas: game.discs.filter(s => !s.used).length, bolota: game.sweep ? { ...game.sweep } : null, neve: game.snows.length,
      giro: +pyrYaw.toFixed(2), resultado: game.result, salvo: save.done[level] || null,
    };
  },
  snapshot(w = 960) {
    renderer.render(scene, camera);
    const src = renderer.domElement, c = document.createElement('canvas');
    c.width = w; c.height = Math.round(w * src.height / src.width);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  },
  resetSave() { save.done = {}; save.scores = []; storeSave(save); },
};
window.dev = dev;
window.piramide = { dev, get game() { return game; }, save, sfx, robot, startLevel, startArcade, goMenu, camera, scene, renderer, aimAt, setYaw(v) { pyrYaw = v; } };

void DROP;
goMenu();
renderer.setAnimationLoop(frame);

// Cena 3D: o cenário de cada mundo (céu pintado em canvas, chão, enfeites), a mesa com a pirâmide
// de cubos (instanciados), o sapinho, as bolas, o ovo e a cobra, o borrão, as pétalas, os chefes,
// as marcas de mira e aviso, o letreiro do placar e as partículas.
// Dentro do grupo da pirâmide tudo é em "casas": 1 unidade = 1 cubo; o grupo é escalado para a
// maquete ficar com ~75 cm de largura. Desempenho de Quest: sem sombras, sem pós-processamento,
// cubos e tampas em InstancedMesh e partículas num só Points.
import * as THREE from '../vendor/three/three.module.js';

// ---------- temas dos mundos ----------
export const THEMES = [
  { // Pirâmide de Doces: céu rosa, pirulitos, chão de chocolate, bolo de pedestal
    name: 'doces', sky: ['#ff9ad8', '#ffd0ea', '#a8e8ff'], fog: '#ffc8e8', bg: '#ffc8e8',
    hemi: ['#fff0f8', '#8a4a6a', 1.5], sun: ['#fff4e0', 1.2], floor: ['#6a3a22', '#7e4a2c'],
    side: ['#f4dcc0', '#e2c09a'], top: ['#7ad8ff', '#ffe45a', '#ff4a9a'], ice: '#c8f0ff', accent: '#ff4aa8', accent2: '#7affc8',
  },
  { // Templo de Jade: verde profundo, pedra entalhada, lanternas
    name: 'jade', sky: ['#04140e', '#0e3a2a', '#2a6a4a'], fog: '#0a2a1e', bg: '#06180f',
    hemi: ['#d8ffe8', '#1a3a20', 1.4], sun: ['#fff0c8', 1.1], floor: ['#1a3a2a', '#244a36'],
    side: ['#3a9a6a', '#2a7a52'], top: ['#a8a090', '#ffd25a', '#ff5a3a'], ice: '#c8f0ff', accent: '#ffd25a', accent2: '#ff5a3a',
  },
  { // Pirâmide de Gelo: aurora, neve, picos de gelo
    name: 'gelo', sky: ['#020a1e', '#0a2a4a', '#1a5a7a'], fog: '#0a1a2e', bg: '#040e20',
    hemi: ['#e0f4ff', '#2a3a5a', 1.5], sun: ['#ffffff', 1.1], floor: ['#d8e8f4', '#c0d4e4'],
    side: ['#8ac8f0', '#5aa0d8'], top: ['#e8f4ff', '#ff7ad8', '#7a5aff'], ice: '#8af0ff', accent: '#5af0ff', accent2: '#ff7ad8',
  },
];

// ---------- texturas desenhadas no canvas ----------
function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const rnd = (() => { let s = 777; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

function skyTexture(th) {
  return canvasTex(2048, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.5, th.sky[1]); gr.addColorStop(0.62, th.sky[2]); gr.addColorStop(1, th.sky[0]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (th.name === 'doces') {
      // nuvens de algodão-doce e morros de bala de goma
      for (let i = 0; i < 70; i++) { const x = rnd() * w, y = h * (0.1 + rnd() * 0.35), r = 30 + rnd() * 60; g.fillStyle = 'rgba(255,255,255,0.55)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * r * 0.6, y + Math.sin(k) * 10, r * (0.7 + 0.3 * Math.sin(k * 2)), 0, 7); g.fill(); } }
      const cols = ['#ff6a9a', '#ffb84a', '#7ad8ff', '#a87aff', '#7affc8'];
      for (let i = 0; i < 26; i++) { const x = (i / 26) * w + rnd() * 40, r = 80 + rnd() * 90; g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(x, h * 0.6, r, r * 0.7, 0, Math.PI, 0); g.fill(); }
      g.globalAlpha = 1;
    } else if (th.name === 'jade') {
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,220,${rnd() * 0.6})`; g.fillRect(rnd() * w, rnd() * h * 0.45, 1.5, 1.5); }
      g.fillStyle = '#f8f0c8'; g.beginPath(); g.arc(w * 0.3, h * 0.2, 40, 0, 7); g.fill();
      // montanhas em camadas
      for (let layer = 0; layer < 3; layer++) {
        g.fillStyle = ['#0e3024', '#0a261c', '#061a12'][layer];
        g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) g.lineTo(x, h * (0.5 + layer * 0.04) - Math.abs(Math.sin(x * (0.004 + layer * 0.002) + layer)) * (120 - layer * 30));
        g.lineTo(w, h); g.fill();
      }
    } else {
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.8})`; g.fillRect(rnd() * w, rnd() * h * 0.5, 1.5, 1.5); }
      // aurora
      for (let b = 0; b < 3; b++) {
        const col = ['rgba(90,255,180,0.18)', 'rgba(120,180,255,0.16)', 'rgba(255,120,220,0.12)'][b];
        g.strokeStyle = col; g.lineWidth = 60 - b * 12;
        g.beginPath();
        for (let x = 0; x <= w; x += 20) g.lineTo(x, h * (0.18 + b * 0.06) + Math.sin(x * 0.006 + b) * 50);
        g.stroke();
      }
      g.fillStyle = '#c8dcec';
      g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 30) g.lineTo(x, h * 0.58 - Math.abs(Math.sin(x * 0.005)) * 110 - (rnd() * 20));
      g.lineTo(w, h); g.fill();
    }
  });
}

function floorTexture(th) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = th.floor[0]; g.fillRect(0, 0, w, h);
    if (th.name === 'doces') {   // tablete de chocolate
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = th.floor[1]; g.fillRect(i * 128 + 8, j * 128 + 8, 112, 112); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(i * 128 + 8, j * 128 + 8, 112, 10); }
    } else if (th.name === 'jade') {   // lajotas
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? th.floor[1] : th.floor[0]; g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122); g.strokeStyle = 'rgba(255,210,90,0.15)'; g.lineWidth = 3; g.strokeRect(i * 128 + 20, j * 128 + 20, 88, 88); }
    } else {
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.4})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, 1 + rnd() * 3, 0, 7); g.fill(); }
    }
  }, [6, 6]);
}

function sideTexture() {   // lateral do cubo em tons de cinza (a cor vem do tema)
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3); g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(4, 4, w - 8, 4);
  });
}
function topTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.7);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c8c8c8');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  });
}
function petalTexture() {
  return canvasTex(128, 128, (g, w) => {
    const c = w / 2;
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2;
      g.save(); g.translate(c, c); g.rotate(a);
      const gr = g.createLinearGradient(0, 0, 0, -58); gr.addColorStop(0, '#ffe45a'); gr.addColorStop(1, '#ff6ab8');
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, -30, 16, 30, 0, 0, 7); g.fill(); g.restore();
    }
    g.fillStyle = '#fff4a0'; g.beginPath(); g.arc(c, c, 14, 0, 7); g.fill();
  });
}
function caramelTexture() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#d8862a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff0d0'; g.lineWidth = 12;
    for (let k = -2; k < 8; k++) { g.beginPath(); g.moveTo(k * 40, 0); g.lineTo(k * 40 + 60, h); g.stroke(); }
  });
}
export function glowTexture() {
  return canvasTex(64, 64, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}

// ---------- mundo ----------
export function buildWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#000', 10, 40);
  const hemi = new THREE.HemisphereLight('#fff', '#333', 1.4);
  const sun = new THREE.DirectionalLight('#fff', 1.1);
  sun.position.set(1.2, 3, 2);
  scene.add(hemi, sun);
  const glowTex = glowTexture();
  const dummy = new THREE.Object3D();

  const themes = THEMES.map((th) => {
    const g = new THREE.Group();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 24), new THREE.MeshBasicMaterial({ map: skyTexture(th), side: THREE.BackSide, fog: false, toneMapped: false }));
    sky.position.y = 1.4; g.add(sky);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshLambertMaterial({ map: floorTexture(th) }));
    floor.rotation.x = -Math.PI / 2; g.add(floor);
    if (th.name === 'doces') {
      // pirulitos e jujubas em volta
      const stickM = new THREE.MeshLambertMaterial({ color: '#fff8f0' });
      const swirl = canvasTex(128, 128, (c, w) => { const cols = ['#ff4a8a', '#ffffff', '#ffb84a', '#7ad8ff']; for (let r = 60; r > 0; r -= 8) { c.fillStyle = cols[(r / 8) % 4 | 0]; c.beginPath(); c.arc(w / 2, w / 2, r, 0, 7); c.fill(); } });
      const popM = new THREE.MeshLambertMaterial({ map: swirl });
      for (let k = 0; k < 10; k++) {
        const a = k / 10 * Math.PI * 2 + 0.2, r = 3.5 + (k % 3) * 1.4, hgt = 1.6 + (k % 4) * 0.5;
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, hgt, 8), stickM); stick.position.set(Math.cos(a) * r, hgt / 2, Math.sin(a) * r); g.add(stick);
        const pop = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 24), [stickM, popM, popM]);
        pop.rotation.x = Math.PI / 2; pop.position.set(Math.cos(a) * r, hgt + 0.4, Math.sin(a) * r); pop.lookAt(0, hgt + 0.4, 0); pop.rotateX(Math.PI / 2); g.add(pop);
      }
      const gum = new THREE.InstancedMesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial(), 40);
      const cc = new THREE.Color();
      for (let i = 0; i < 40; i++) { const a = rnd() * Math.PI * 2, r = 2.4 + rnd() * 6; dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); dummy.scale.setScalar(0.6 + rnd()); dummy.updateMatrix(); gum.setMatrixAt(i, dummy.matrix); gum.setColorAt(i, cc.set(['#ff4a8a', '#ffb84a', '#7ad8ff', '#a87aff', '#7affc8'][i % 5])); }
      g.add(gum);
    } else if (th.name === 'jade') {
      const stone = new THREE.MeshLambertMaterial({ color: '#2a6a4a' });
      const red = new THREE.MeshLambertMaterial({ color: '#a8281a' });
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2 + 0.4, r = 3.2;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3.2, 10), red); col.position.set(Math.cos(a) * r, 1.6, Math.sin(a) * r); g.add(col);
        const lan = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffb84a', toneMapped: false })); lan.scale.y = 1.3; lan.position.set(Math.cos(a) * (r - 0.3), 2.2, Math.sin(a) * (r - 0.3)); g.add(lan);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb84a', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(0.9); halo.position.copy(lan.position); g.add(halo);
      }
      const roof = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 8, 48), stone); roof.rotation.x = Math.PI / 2; roof.position.y = 3.25; g.add(roof);
      const bamboo = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 1, 6), new THREE.MeshLambertMaterial({ color: '#5aa84a' }), 80);
      for (let i = 0; i < 80; i++) { const a = rnd() * Math.PI * 2, r = 5 + rnd() * 6, hg = 2 + rnd() * 3; dummy.position.set(Math.cos(a) * r, hg / 2, Math.sin(a) * r); dummy.scale.set(1, hg, 1); dummy.rotation.set((rnd() - 0.5) * 0.15, 0, (rnd() - 0.5) * 0.15); dummy.updateMatrix(); bamboo.setMatrixAt(i, dummy.matrix); }
      g.add(bamboo);
    } else {
      const iceM = new THREE.MeshLambertMaterial({ color: '#a8e0ff', transparent: true, opacity: 0.85, flatShading: true });
      const spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 1, 5), iceM, 50);
      for (let i = 0; i < 50; i++) { const a = rnd() * Math.PI * 2, r = 3 + rnd() * 8, hg = 0.6 + rnd() * 2.6; dummy.position.set(Math.cos(a) * r, hg / 2, Math.sin(a) * r); dummy.scale.set(0.6 + rnd(), hg, 0.6 + rnd()); dummy.rotation.set(0, rnd() * 3, (rnd() - 0.5) * 0.2); dummy.updateMatrix(); spikes.setMatrixAt(i, dummy.matrix); }
      g.add(spikes);
    }
    g.visible = false;
    scene.add(g);
    return g;
  });

  // ---------- letreiro do placar (atrás da pirâmide) ----------
  const marquee = new THREE.Group();
  const W = 1.8;
  const frameM = new THREE.MeshLambertMaterial({ color: '#2a0e2e' });
  marquee.add(new THREE.Mesh(new THREE.BoxGeometry(W, 0.36, 0.08), frameM));
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 1024; boardCanvas.height = 128;
  const boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 4;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, 0.3), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }));
  board.position.z = 0.041; marquee.add(board);
  const NB = 34;
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), NB);
  for (let k = 0; k < NB; k++) {
    const m = new THREE.Matrix4();
    if (k < 16) m.setPosition(-W / 2 + 0.06 + k * (W - 0.12) / 15, 0.17, 0.05);
    else if (k < 32) m.setPosition(W / 2 - 0.06 - (k - 16) * (W - 0.12) / 15, -0.17, 0.05);
    else m.setPosition((k === 32 ? -1 : 1) * (W / 2 - 0.02), 0, 0.05);
    bulbs.setMatrixAt(k, m); bulbs.setColorAt(k, new THREE.Color('#7affc8'));
  }
  marquee.add(bulbs);
  marquee.position.set(0, 1.64, -2.0);
  marquee.rotation.x = 0.05;
  scene.add(marquee);

  let cur = -1;
  const world = {
    scene, themes, glowTex,
    setTheme(i) {
      if (i === cur) return;
      cur = i;
      const th = THEMES[i];
      themes.forEach((g, k) => { g.visible = k === i; });
      scene.background = new THREE.Color(th.bg);
      scene.fog.color.set(th.fog);
      hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = th.hemi[2];
      sun.color.set(th.sun[0]); sun.intensity = th.sun[1];
    },
    update(dt, time) {
      const c = new THREE.Color();
      for (let k = 0; k < NB; k++) { const on = (Math.floor(time * 6) + k) % 3 === 0; c.set(on ? THEMES[cur]?.accent || '#7affc8' : '#2a1a2a'); bulbs.setColorAt(k, c); }
      bulbs.instanceColor.needsUpdate = true;
    },
    board: { last: '' },
    setBoard(lines) {
      const key = JSON.stringify(lines);
      if (key === this.board.last) return;
      this.board.last = key;
      const g = boardCanvas.getContext('2d'), w = 1024, h = 128;
      g.fillStyle = '#0a040c'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.04)';
      for (let x = 4; x < w; x += 8) for (let y = 4; y < h; y += 8) g.fillRect(x, y, 3, 3);
      g.textBaseline = 'middle';
      for (const l of lines) {
        g.font = `bold ${l.size || 54}px monospace`;
        g.textAlign = l.align || 'left';
        g.fillStyle = l.color || '#7affc8';
        g.shadowColor = l.color || '#7affc8'; g.shadowBlur = 12;
        g.fillText(l.text, l.x, l.y ?? h / 2);
      }
      g.shadowBlur = 0;
      boardTex.needsUpdate = true;
    },
  };
  return world;
}

// ---------- mesa e pirâmide ----------
// O grupo `pyr` (posição/rotação da maquete) contém `units`, escalado por `cube` (metros por casa).
export class PyramidView {
  constructor(scene) {
    this.pyr = new THREE.Group();
    this.pyr.position.set(0, 0.86, -0.55);
    scene.add(this.pyr);
    this.units = new THREE.Group();
    this.pyr.add(this.units);
    this.sideMat = new THREE.MeshLambertMaterial({ map: sideTexture() });
    this.sides = new THREE.InstancedMesh(new THREE.BoxGeometry(0.98, 0.98, 0.98), this.sideMat, 260);
    this.tops = new THREE.InstancedMesh(new THREE.BoxGeometry(0.96, 0.06, 0.96), new THREE.MeshLambertMaterial({ map: topTexture() }), 100);
    for (const m of [this.sides, this.tops]) { m.frustumCulled = false; m.count = 0; this.units.add(m); }
    this.tops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tops.setColorAt(0, new THREE.Color());
    // pedestal
    this.stand = new THREE.Group();
    this.pyr.add(this.stand);
    this.m = new THREE.Matrix4(); this.c = new THREE.Color(); this.flash = new Map();
    this.cube = 0.1;
  }
  build(game, th) {
    const n = game.n;
    this.cube = 0.75 / (2 * n - 1);
    this.units.scale.setScalar(this.cube);
    let k = 0;
    for (const c of game.cells.values()) for (let y = 0; y <= c.h; y++) {
      this.m.makeTranslation(c.i, y + 0.5, c.j);
      this.sides.setMatrixAt(k, this.m);
      this.sides.setColorAt(k, this.c.set(th.side[(y + Math.abs(c.i) + Math.abs(c.j)) % 2]));
      k++;
    }
    this.sides.count = k;
    this.sides.instanceMatrix.needsUpdate = true;
    if (this.sides.instanceColor) this.sides.instanceColor.needsUpdate = true;
    this.cells = [...game.cells.values()];
    // pedestal do mundo
    for (const ch of this.stand.children.slice()) this.stand.remove(ch);
    const w = 0.84;
    if (th.name === 'doces') {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.72, w * 0.72, 0.03, 40), new THREE.MeshLambertMaterial({ color: '#ffffff' })); plate.position.y = -0.015; this.stand.add(plate);
      const frost = new THREE.Mesh(new THREE.TorusGeometry(w * 0.72, 0.025, 8, 40), new THREE.MeshLambertMaterial({ color: '#ff9ad8' })); frost.rotation.x = Math.PI / 2; frost.position.y = -0.01; this.stand.add(frost);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, 0.84, 16), new THREE.MeshLambertMaterial({ color: '#ffd0ea' })); leg.position.y = -0.45; this.stand.add(leg);
    } else if (th.name === 'jade') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.06, w + 0.08), new THREE.MeshLambertMaterial({ color: '#1e5a3a' })); top.position.y = -0.03; this.stand.add(top);
      const body = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.8, w - 0.1), new THREE.MeshLambertMaterial({ color: '#16422a' })); body.position.y = -0.46; this.stand.add(body);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.04, w - 0.06), new THREE.MeshLambertMaterial({ color: '#ffd25a', emissive: '#4a3000' })); trim.position.y = -0.1; this.stand.add(trim);
    } else {
      const block = new THREE.Mesh(new THREE.BoxGeometry(w, 0.86, w), new THREE.MeshLambertMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.8 })); block.position.y = -0.43; this.stand.add(block);
    }
  }
  hit(i, j) { this.flash.set(`${i},${j}`, 0.25); }
  update(game, th, dt, time, sweepLine) {
    let k = 0;
    for (const [key, t] of this.flash) { if (t - dt <= 0) this.flash.delete(key); else this.flash.set(key, t - dt); }
    for (const c of this.cells) {
      const fl = this.flash.get(`${c.i},${c.j}`) || 0;
      this.m.makeScale(1, 1 + fl * 2, 1).setPosition(c.i, c.h + 1 + 0.02 + fl * 0.1, c.j);
      this.tops.setMatrixAt(k, this.m);
      const p = Math.min(c.paint, game.need);
      this.c.set(th.top[game.need === 2 ? p : (p ? 2 : 0)]);
      if (game.need === 1 && p) this.c.set(th.top[2]);
      if (game.isIce(c)) this.c.lerp(new THREE.Color(th.ice), 0.6 + 0.2 * Math.sin(time * 4));
      if (sweepLine && sweepLine(c)) this.c.lerp(new THREE.Color('#ff2a2a'), 0.5 + 0.4 * Math.sin(time * 14));
      if (fl) this.c.lerp(new THREE.Color('#ffffff'), fl * 3);
      this.tops.setColorAt(k, this.c);
      k++;
    }
    this.tops.count = k;
    this.tops.instanceMatrix.needsUpdate = true;
    if (this.tops.instanceColor) this.tops.instanceColor.needsUpdate = true;
  }
}

// ---------- personagens (em casas: ~0,7 de altura) ----------
export function buildFrog() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: '#4ad86a' });
  const belly = new THREE.MeshLambertMaterial({ color: '#d8ffa8' });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), skin); body.scale.set(1, 0.8, 1.05); body.position.y = 0.28; g.add(body);
  const bel = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), belly); bel.scale.set(1, 0.8, 0.6); bel.position.set(0, 0.24, 0.16); g.add(bel);
  const eyeW = new THREE.MeshBasicMaterial({ color: '#ffffff' }), eyeB = new THREE.MeshBasicMaterial({ color: '#101010' });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin); e.position.set(sx * 0.15, 0.52, 0.08); g.add(e);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), eyeW); w.position.set(sx * 0.15, 0.55, 0.15); g.add(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeB); p.position.set(sx * 0.15, 0.56, 0.23); g.add(p);
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), skin); leg.scale.set(0.8, 0.5, 1.4); leg.position.set(sx * 0.26, 0.08, -0.05); g.add(leg);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color: '#a82a3a' })); mouth.position.set(0, 0.32, 0.31); mouth.rotation.set(0, 0, Math.PI); g.add(mouth);
  const cheek = new THREE.MeshBasicMaterial({ color: '#ff8aa8' });
  for (const sx of [-1, 1]) { const ch = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), cheek); ch.position.set(sx * 0.2, 0.36, 0.27); g.add(ch); }
  return { group: g, skin };
}

export function buildBall(color) {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 });
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), m); s.position.y = 0.28; g.add(s);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); shine.position.set(-0.1, 0.42, 0.18); g.add(shine);
  return { group: g, mat: m };
}
export function buildEgg() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: '#a85ae0', emissive: '#3a1060' });
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), m); s.scale.y = 1.3; s.position.y = 0.32; g.add(s);
  const spot = new THREE.MeshBasicMaterial({ color: '#e8c8ff' });
  for (let k = 0; k < 5; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), spot); const a = k * 1.3; d.position.set(Math.cos(a) * 0.24, 0.25 + (k % 3) * 0.1, Math.sin(a) * 0.24); g.add(d); }
  return { group: g, mat: m };
}
export function buildSnake(color = '#8a3ad8', len = 4) {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color });
  for (let k = 0; k < len; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.2 - k * 0.025, 0.08, 8, 18), m); t.rotation.x = Math.PI / 2; t.position.y = 0.08 + k * 0.13; g.add(t); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), m); head.scale.set(1, 0.85, 1.25); head.position.set(0, 0.62, 0.06); g.add(head);
  const eyeW = new THREE.MeshBasicMaterial({ color: '#fff45a', toneMapped: false });
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeW); e.position.set(sx * 0.08, 0.7, 0.2); g.add(e); }
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.18), new THREE.MeshBasicMaterial({ color: '#ff2a4a' })); tongue.position.set(0, 0.58, 0.3); g.add(tongue);
  return { group: g, mat: m, tongue };
}
export function buildSmudge() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: '#5a6aff' });
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), m); s.scale.set(1.1, 0.8, 1); s.position.y = 0.2; g.add(s);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); e.position.set(sx * 0.08, 0.3, 0.17); g.add(e); }
  const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), new THREE.MeshLambertMaterial({ color: '#c89a5a' })); brush.position.set(0.24, 0.35, 0); brush.rotation.z = -0.6; g.add(brush);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 8), new THREE.MeshLambertMaterial({ color: '#c8c8c8' })); tip.position.set(0.38, 0.5, 0); tip.rotation.z = -0.6 + Math.PI; g.add(tip);
  return { group: g };
}
export function buildPetal() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ map: petalTexture(), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  disc.rotation.x = -Math.PI / 2; g.add(disc);
  return { group: g, disc };
}
export function buildCaramel() {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), new THREE.MeshLambertMaterial({ map: caramelTexture() }));
  s.position.y = 1.1; g.add(s);
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); e.position.set(sx * 0.35, 1.5, 0.95); g.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#2a1000' })); p.position.set(sx * 0.35, 1.5, 1.13); g.add(p);
  }
  return { group: g, ball: s };
}
export function buildYeti() {
  const g = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ color: '#f4f8ff' });
  const face = new THREE.MeshLambertMaterial({ color: '#8ab0d8' });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.2, 18, 14), fur); body.scale.set(1, 1.2, 0.9); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), fur); head.position.y = 1.6; g.add(head);
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), face); mask.scale.z = 0.5; mask.position.set(0, 1.55, 0.5); g.add(mask);
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#5af0ff', toneMapped: false })); e.position.set(sx * 0.2, 1.7, 0.75); g.add(e);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.6, 10), fur); arm.position.set(sx * 1.25, 0.2, 0.2); arm.rotation.z = sx * 0.5; g.add(arm);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 6), new THREE.MeshLambertMaterial({ color: '#c8b080' })); horn.position.set(sx * 0.5, 2.2, 0); horn.rotation.z = -sx * 0.5; g.add(horn);
  }
  const snowball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), fur); g.add(snowball);
  return { group: g, snowball };
}

// marca de mira (anel verde ou X vermelho) e marcas de aviso, em casas
export function buildMarker() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.46, 28), new THREE.MeshBasicMaterial({ color: '#7affc8', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 4; g.add(ring);
  const xm = new THREE.MeshBasicMaterial({ color: '#ff3a3a', transparent: true, opacity: 0.9, depthTest: false, toneMapped: false });
  const x1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.14), xm); x1.rotation.y = Math.PI / 4; x1.renderOrder = 4;
  const x2 = x1.clone(); x2.rotation.y = -Math.PI / 4;
  const cross = new THREE.Group(); cross.add(x1, x2); g.add(cross);
  return { group: g, ring, cross };
}

// ---------- partículas ----------
export class Particles {
  constructor(scene, cap = 1400) {
    this.cap = cap;
    this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.s0 = new Float32Array(cap); this.grav = new Float32Array(cap);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: 'attribute vec3 pcolor; attribute float size; attribute float alpha; uniform float uScale; varying vec3 vC; varying float vA; void main(){ vC = pcolor; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(128.0, size * uScale / max(0.05, -mv.z)); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = vA * (1.0 - d * 1.8); gl_FragColor = vec4(vC * a, a); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.tmp = new THREE.Color();
  }
  spawn(x, y, z, vx, vy, vz, life, size, color, grav = 4) {
    const i = this.next; this.next = (this.next + 1) % this.cap;
    this.p.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3);
    this.tmp.set(color);
    this.col.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
    this.life[i] = this.max[i] = life; this.s0[i] = size; this.size[i] = size; this.alpha[i] = 1; this.grav[i] = grav;
  }
  burst(p, color, n, speed, life = 0.8, size = 0.02, grav = 2) {
    for (let k = 0; k < n; k++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(p.x, p.y, p.z, Math.cos(a) * r * s, Math.abs(u) * s, Math.sin(a) * r * s, life * (0.5 + Math.random() * 0.6), size * (0.5 + Math.random()), color, grav);
    }
  }
  update(dt) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      this.v[i * 3 + 1] -= this.grav[i] * dt;
      for (let j = 0; j < 3; j++) { this.v[i * 3 + j] *= 1 - 0.8 * dt; this.p[i * 3 + j] += this.v[i * 3 + j] * dt; }
      if (this.p[i * 3 + 1] < 0.01) { this.p[i * 3 + 1] = 0.01; this.v[i * 3 + 1] *= -0.3; }
      const f = Math.max(0, this.life[i] / this.max[i]);
      this.alpha[i] = Math.min(1, f * 2);
      this.size[i] = this.s0[i] * (0.5 + 0.5 * f);
    }
    for (const a of ['position', 'size', 'alpha', 'pcolor']) this.geo.attributes[a].needsUpdate = true;
  }
}

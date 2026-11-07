// Os 3 mundos e as 12 fases do Pula-Pirâmide. Sem navegador.
//
// A pirâmide é de degraus nos quatro lados: com tamanho n, as casas vão de -(n-1) a n-1 em i e em j,
// e a altura de cada casa é n-1 menos a distância (no maior eixo) até o centro. O topo é a casa (0, 0).
//
// Campos de cada fase:
//   n        tamanho (3 = 25 cubos, 4 = 49, 5 = 81)
//   paint    'one'   (pintar uma vez), 'two' (precisa de duas pintadas),
//            'toggle' (pintar de novo desfaz)
//   holes    casas que faltam [i, j] (pular nelas é cair)
//   ice      casas de gelo [i, j]: quem cai nelas escorrega mais uma casa no mesmo sentido
//   discs    pétalas voadoras do lado da pirâmide: [i, j, d] = casa da beirada e a direção para fora
//            (d: 0 = +i, 1 = -i, 2 = +j, 3 = -j); levam de volta ao topo
//   balls / green / smudge   [primeira aparição em s, intervalo em s] ou ausente
//   egg      quando cai o ovo da cobra (s) ou ausente; a cobra volta 5 s depois de cair
//   hop      tempo entre os pulos dos bichos (s)
//   boss     'caramel' (Bolota de Caramelo), 'serpent' (Serpente de Jade), 'yeti' (Yeti da Nevasca)
//   par      [3 estrelas, 2 estrelas] em segundos de "tempo efetivo" (tempo + 15 s por vida
//            perdida), calibrados pelo robô (ver tests/run.js)

export const WORLDS = [
  { name: 'Pirâmide de Doces', short: 'Doces', theme: 0, hint: 'Aponte para um cubo vizinho e aperte o gatilho: o sapinho pula e pinta.' },
  { name: 'Templo de Jade', short: 'Jade', theme: 1, hint: 'Aqui cada cubo precisa de duas pintadas. Use as pétalas para fugir da cobra.' },
  { name: 'Pirâmide de Gelo', short: 'Gelo', theme: 2, hint: 'Cuidado: em algumas fases pintar de novo desfaz, e o gelo escorrega.' },
];

export const LEVELS = [
  // ---------- Mundo 1: Doces ----------
  { name: 'Primeiro pulo', world: 0, n: 3, paint: 'one', discs: [[2, 0, 0]], balls: [6, 6], hop: 0.75, par: [24, 60] },
  { name: 'Cobra de alcaçuz', world: 0, n: 4, paint: 'one', discs: [[3, -1, 0], [-3, 1, 1]], balls: [8, 7], egg: 4, hop: 0.75, par: [70, 120] },
  { name: 'Borrão de calda', world: 0, n: 4, paint: 'one', discs: [[0, 3, 2], [0, -3, 3]], balls: [6, 6], egg: 6, smudge: [10, 12], hop: 0.7, par: [75, 125] },
  { name: 'Bolota de Caramelo', world: 0, n: 4, paint: 'one', boss: 'caramel', discs: [[3, 0, 0], [-3, 0, 1]], balls: [10, 9], hop: 0.72, par: [75, 130] },
  // ---------- Mundo 2: Jade ----------
  { name: 'Duas demãos', world: 1, n: 3, paint: 'two', discs: [[2, 1, 0], [-2, -1, 1]], balls: [5, 5], egg: 6, hop: 0.7, par: [60, 100] },
  { name: 'Buracos no templo', world: 1, n: 4, paint: 'one', holes: [[1, 1], [-1, -1], [2, -2], [-2, 2]], discs: [[3, 2, 0], [-3, -2, 1]], balls: [6, 6], egg: 5, smudge: [12, 12], hop: 0.68, par: [70, 120] },
  { name: 'Bolas verdes', world: 1, n: 4, paint: 'one', discs: [[2, 3, 2], [-2, -3, 3], [3, -2, 0]], balls: [5, 5.5], green: [10, 12], egg: 5, smudge: [9, 11], hop: 0.68, par: [75, 120] },
  { name: 'Serpente de Jade', world: 1, n: 3, paint: 'two', boss: 'serpent', discs: [[2, 0, 0], [-2, 0, 1], [0, 2, 2], [0, -2, 3]], balls: [10, 9], hop: 0.7, par: [70, 120] },
  // ---------- Mundo 3: Gelo ----------
  { name: 'Gelo fino', world: 2, n: 3, paint: 'toggle', discs: [[2, 1, 0], [-2, -1, 1]], balls: [7, 8], hop: 0.75, par: [55, 120] },
  { name: 'Gelo quebradiço', world: 2, n: 4, paint: 'two', holes: [[0, 2], [0, -2], [2, 0], [-2, 0]], ice: [[1, 1], [-1, -1]], discs: [[3, 2, 0], [-3, -2, 1]], balls: [6, 6], egg: 6, smudge: [14, 14], hop: 0.7, par: [115, 175] },
  { name: 'Nevasca', world: 2, n: 4, paint: 'one', ice: [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 2], [-2, -2]], discs: [[3, 0, 0], [-3, 0, 1], [0, 3, 2]], balls: [5, 5], green: [12, 12], egg: 5, smudge: [9, 10], hop: 0.66, par: [80, 160] },
  { name: 'Yeti da Nevasca', world: 2, n: 4, paint: 'one', boss: 'yeti', discs: [[3, -2, 0], [-3, 2, 1]], balls: [9, 8], hop: 0.66, par: [50, 90] },
];

export const LEVELS_PER_WORLD = 4;

export function starsFor(level, effTime) {
  const p = LEVELS[level].par;
  return effTime <= p[0] ? 3 : effTime <= p[1] ? 2 : 1;
}

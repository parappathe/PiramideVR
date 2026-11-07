# PiramideVR

Pula-Pirâmide: jogo em VR para o Meta Quest 3 no navegador (WebXR), sem instalar nada. Uma pirâmide
de cubos com degraus nos quatro lados fica numa mesa na frente do jogador, numa escala de maquete
(~75 cm de largura). O sapinho começa no topo; o jogador **aponta o controle para um cubo vizinho e
aperta o gatilho**: ele pula e pinta o topo do cubo. Pintar a pirâmide toda vence. A mão (grip)
gira a pirâmide para ver todos os lados. Bolas descem rolando, uma cobra persegue, um borrão
despinta; pétalas voadoras nos lados levam de volta ao topo (e a cobra que vem atrás cai). 12 fases
em 3 mundos (Pirâmide de Doces, Templo de Jade, Pirâmide de Gelo), a 4ª de cada mundo é um chefe.
Estrelas pelo tempo, modo Fliperama (as 12 seguidas) com recorde de 3 letras. Também joga no PC com
o mouse. Tudo em português. Releitura original do gênero (sapinho, bichos, chefes e visual próprios).

## Como rodar / jogar

**No Quest:** abrir no navegador do óculos o endereço publicado (quando for publicado:
**https://parappathe.github.io/PiramideVR/**) e apertar "Entrar em VR". Para atualizar o site:
commitar e rodar `python publicar.py PiramideVR` na pasta `C:\claude code` (só quando o Eduardo pedir).

**No PC:** `python serve.py` nesta pasta e abrir `http://localhost:8875` (o painel de
visualização usa `.claude/launch.json`). O `serve.py` manda o navegador não guardar cache;
`python serve.py --https` serve para abrir no Quest pela rede de casa (porta 8443).

### Controles

| | VR (Quest) | PC |
|---|---|---|
| Escolher o pulo | Apontar o raio do controle (ou da mão) para um cubo vizinho; um anel verde marca o destino, amarelo é pétala, X vermelho é queda | Apontar o mouse num cubo vizinho (mesmas marcas) |
| Pular | Gatilho (ou pinça com a mão) | Clique |
| Girar a pirâmide | Segurar o grip e girar a mão em volta da maquete, ou o direcional para os lados | Q/E ou arrastar com o botão direito |
| Pausa | B ou Y | Esc ou P |
| Menu | Apontar com o controle e gatilho | Clique |
| FPS | Menu → FPS | Tecla F |

Apontar para um cubo que não é vizinho escolhe o vizinho na direção dele. Apertar no finzinho de um
pulo já encadeia o próximo. Na pausa do VR, "Recentralizar" põe a cabeça de frente para a maquete.
O controle vibra a cada pulo e pintura, nas batidas e quedas.

### Regras

- **Pirâmide:** tamanho 3 (25 cubos) ou 4 (49). O topo é a casa (0, 0); cada anel em volta é um
  degrau mais baixo. Pula-se para as 4 vizinhas (sobe, desce ou fica no mesmo degrau). Pular para fora
  ou num buraco: cai e perde uma vida (volta no topo).
- **Pintura** (por fase): uma pintada; duas pintadas (o cubo muda de cor no meio); ou "pisar de novo
  despinta" (fase 9).
- **Gelo:** quem pousa num cubo de gelo escorrega mais uma casa no mesmo sentido (pode cair!).
- **Bichos:** bola vermelha (cai perto do topo e desce pulando ao acaso; sai pela beirada); ovo roxo
  (desce até a beirada e choca uma cobra que persegue, um pouco mais devagar que o sapinho; volta 5 s
  depois de cair); borrão azul (desce despintando; pegar dá 300 pontos); bola verde (pegar congela os
  bichos por 3,5 s). Bateu numa bola ou na cobra: perde vida, os bichos somem e o jogo respira 1,5 s.
- **Pétalas:** pular da beirada para a pétala leva de volta ao topo (2 s); a cobra que vem atrás pula
  junto e cai (+500). Cada pétala serve uma vez (na luta da Serpente elas voltam em 8 s).
- **Chefes:** Fase 4, **Bolota de Caramelo**: a cada 8 s uma linha da pirâmide pisca vermelho por
  1,4 s e a bolota passa rolando, despintando a linha e derrubando quem estiver nela. Fase 8,
  **Serpente de Jade**: cobra comprida (cabeça e 3 gomos, todos machucam) que persegue; cai atrás de
  você nas pétalas, que voltam. Fase 12, **Yeti da Nevasca**: congela 3 cubos a cada 5 s (gelo por
  8 s) e joga bolas de neve onde o sapinho está: a marca azul avisa 1,1 s antes.
- **Pontos:** 25 por cubo pintado, bônus de fase, vidas, pétalas que sobraram e tempo.
- **Estrelas** pelo "tempo efetivo" (tempo + 15 s por vida perdida); limites em `par` de cada fase.
  Vencer libera a próxima.
- **Fliperama:** as 12 fases seguidas com as vidas que sobraram (+1 vida a cada chefe), pontos
  somados; no fim, se entrar nos 8 melhores, escolhe 3 letras (no PC dá para digitar).
- Progresso, recordes e opções no navegador (localStorage `piramidevr.v1`).

Fases (em `js/levels.js`): Doces: 1 Primeiro pulo, 2 Cobra de alcaçuz, 3 Borrão de calda,
4 Bolota de Caramelo. Jade: 5 Duas demãos, 6 Buracos no templo, 7 Bolas verdes, 8 Serpente de Jade.
Gelo: 9 Gelo fino (pisar de novo despinta), 10 Gelo quebradiço, 11 Nevasca, 12 Yeti da Nevasca.

## Como testar

- `node tests/run.js` (ou `npm test`): pirâmide (tamanho, degraus nos 4 lados), fases (todos os
  cubos alcançáveis, pétalas na beirada, buracos), pulos e pintura (uma, duas pintadas, despintar,
  fila do próximo pulo, vencer), queda, buraco, pétala, gelo, bolas (só descem, saem pela beirada),
  batida, ovo e cobra, cobra que cai atrás da pétala, borrão, bola verde, os três chefes e o
  **robô**: joga as 12 fases com 5 sementes, com limites humanos (0,3 s de reação depois de cada
  pouso, só sabe para onde um bicho pula 0,3 s depois que ele começou) e tem que vencer todas com
  pelo menos 2 estrelas. Imprime o tempo efetivo por fase. Termina com "Tudo certo". Não toca som.
- No navegador (console): `dev.loadLevel(8)` abre a fase 8 (1 a 12, ignora o bloqueio),
  `dev.autoplay = true` faz o robô jogar, `dev.advance(20)` avança 20 s na hora, `dev.state()`
  mostra tela, fase, vidas, pontos, sapinho, bichos e chefes, `dev.arcade()` começa o fliperama,
  `dev.snapshot()` devolve a imagem da tela (JPEG em data URL), `dev.resetSave()` apaga progresso e
  recordes. `window.piramide` tem `game`, `save`, `sfx`, `robot`, `aimAt` (mira de um raio),
  `setYaw` (gira a pirâmide), `startLevel`, `startArcade`, `goMenu`.

## Estrutura

| Arquivo | O que tem |
|---|---|
| `index.html`, `css/style.css` | Página, botão "Entrar em VR", HUD do PC |
| `js/vec.js` | Vetores 3D em arrays e aleatório com semente. Sem navegador |
| `js/sim.js` | Regras: `Game` (pirâmide, pulos, pintura, gelo, pétalas, bichos, chefes, vidas, estrelas e pontos), `outcome` (para onde vai um pulo, usado pelo robô). Sem navegador |
| `js/levels.js` | Os 3 mundos e as 12 fases (tamanho, pintura, buracos, gelo, pétalas, bichos, limites de estrelas). Sem navegador |
| `js/robot.js` | Robô com limites humanos: calcula onde os bichos podem estar, foge, usa as pétalas e vai para o cubo por pintar mais perto. Testes e `dev.autoplay`. Sem navegador |
| `js/main.js` | Liga tudo: render, VR (raio dos controles, gatilho, grip e direcional giram a maquete, vibração, recentralizar), mouse/teclado, mira (raio → cubo vizinho), menus, letreiro, eventos → sons e efeitos, `dev` |
| `js/scene.js` | Os 3 cenários (céu em canvas, pirulitos e jujubas, templo com lanternas e bambu, picos de gelo e aurora), mesa de cada mundo, cubos e tampas instanciados, sapinho, bolas, ovo, cobra, Serpente, borrão, pétalas, Bolota, Yeti, marcas, letreiro, partículas |
| `js/ui.js` | Painel de menu 3D em canvas, quadradinhos de fase e placas de texto |
| `js/audio.js` | Sons sintetizados com áudio 3D (HRTF) e uma musiquinha por mundo |
| `js/save.js` | Progresso, recordes (8 melhores) e opções |
| `tests/run.js` | Testes |
| `serve.py` | Servidor local sem cache (porta 8875, `--https` para o Quest) |
| `vendor/three/three.module.js` | Three.js r170 (cópia local) |

Coordenadas: metros; chão em y = 0, o jogador em x = 0, z = 0 olhando para -z. A maquete fica em
(0; 0,86; -0,55). Dentro dela tudo é em casas (grupo `units`, escalado para a pirâmide ter 75 cm):
casa (i, j) tem o topo em y = h + 1.

## Regras e convenções do projeto

- `vec.js`, `sim.js`, `levels.js` e `robot.js` não podem usar navegador nem Three.js: os testes
  rodam no Node.
- Fase nova ou mudada: rodar `node tests/run.js` (confere se todo cubo é alcançável e se as pétalas
  estão numa beirada) e conferir o tempo efetivo do robô impresso no fim; `par` tem que deixar o robô
  com 2 estrelas ou mais com folga (3 estrelas perto do tempo típico).
- Eventos do jogo (`game.events`) são a única ponte da lógica para som, vibração e efeitos.
- A física roda em passos fixos de 1/120 s; o desenho interpola dentro do pulo.

## Decisões

- Pirâmide de degraus nos quatro lados (zigurate) para dar sentido a girar a maquete; por isso a
  borda de queda é o anel de baixo e os buracos de algumas fases criam quedas no meio.
- A mira escolhe uma das 4 direções a partir do cubo apontado (não precisa acertar exatamente o
  vizinho); a casa do próprio sapinho não tapa a de trás. A marca mostra antes se é queda.
- A cobra pula 30% mais devagar que as bolas: o sapinho de gente (com 0,3 s de reação) consegue
  fugir; a graça é levar ela até uma pétala.
- "Pisar de novo despinta" ficou só numa fase pequena (25 cubos): na pirâmide de 49 com bichos ficou
  confuso demais até para o robô.
- Conforto: maquete parada numa mesa na frente, nada vem na direção do rosto, câmera do VR nunca
  mexida pelo jogo; girar a pirâmide é com a mão.
- Estrelas por tempo (com 15 s de multa por vida perdida), calibradas pelo robô.
- Desempenho de Quest: pixelRatio 1, foveação, cubos e tampas em InstancedMesh, partículas num só
  `Points`, 2 luzes sem sombra, sem pós-processamento.
- Porta do servidor local 8875.

## Pendências / problemas conhecidos

- **Nada foi testado no Quest ainda.** Só o óculos verifica: se apontar o raio para cubos de 10 cm a
  ~60 cm é confortável e preciso, se girar com o grip em volta da maquete é natural, o direcional,
  a pinça das mãos para pular, a altura e a distância da mesa, recentralizar, vibração e FPS.
- No PC foi conferido que a página abre sem erro, que a mira do mouse escolhe as 4 direções e que o
  robô joga as fases; sons e música só foram checados por não dar erro, ninguém ouviu ainda.
- A dificuldade foi calibrada pelo robô; pode estar fácil ou difícil para gente de verdade. Os
  limites de estrela estão em `par` de cada fase.

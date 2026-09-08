# AGENTS.md

## Idioma

- El repo está íntegramente en español (comentarios, UI, README). Escribir comentarios, textos de UI y specs en español.

## Qué es este repo

- Juego tipo Pac-Man en vanilla JS/HTML/CSS. Sin build, sin `package.json`, sin tests, sin linter/formatter. No inventar comandos npm ni buscarlos: no existen.
- El propósito del proyecto es aprender Spec Driven Development (flujo abajo).

## Ejecutar y verificar

- Abrir `src/index.html` directamente en el navegador (funciona por `file://`; no hay módulos ES ni `fetch`, no hace falta dev server).
- No hay lint/typecheck/test. La verificación es manual: jugar (flechas, comer dots, túnel fila 14, colisión con fantasmas, ganar/perder/reiniciar).

## Arquitectura (globals en `window`, NO módulos ES)

- 4 scripts cargados en orden desde `src/index.html`: `maze.js` → `game.js` → `render.js` → `main.js`. El orden importa: se comunican solo vía globals exportados al final de cada archivo (`window.MAZE`, `window.createGame`, `window.draw`, ...). No añadir `import`/`export` ni reordenar los tags.
- `maze.js`: solo datos. `MAZE_STR` (28x31) se parsea a `MAZE`: `'#'`→1 pared, `'.'`→2 dot, `' '`→0 vacío, `'-'`→3 puerta de la jaula. `MAZE` es prístina y nunca se muta; cada partida la copia a `game.grid`.
- `game.js`: estado y reglas, sin DOM. Depende de los globals de `maze.js`. La puerta (3) bloquea a Pac-Man pero no a los fantasmas. Túnel con wrap horizontal en `TUNNEL_ROW` (fila 14).
- `render.js`: dibujo en canvas; usa `game.grid` (nunca `MAZE`) para reflejar los dots comidos. `TILE=20` → canvas 560x620.
- `main.js`: bucle `requestAnimationFrame`, teclado y overlay.

## Estilo de código

- Los JS usan espacios dentro de los paréntesis: `( x )`, `( grid, x, y )`. Mantener ese estilo al editar (no hay formatter que lo imponga).

## Flujo spec-driven

- Las features se definen como specs antes de codificar: `/spec <descripción>` genera `specs/NN-slug.md` en estado Draft. El humano la aprueba cambiando el estado a Approved/Aprobado. Después `/spec-impl NN-slug` crea la rama `spec-NN-slug` e implementa paso a paso con pausas para revisar diffs.
- `/spec-impl` rechaza specs que no estén Approved y nunca hace commits automáticos.
- `specs/` aún no existe; la primera spec se numerará `01-`.
- `.agents/skills/` y `skills-lock.json` provienen del gestor de skills (klerith/fernando-skills); no editarlos a mano.

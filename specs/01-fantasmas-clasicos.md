# SPEC 01 — Cuatro fantasmas con personalidad clásica

> **Estado:** Aprobado
> **Depende de:** ninguna
> **Fecha:** 2026-09-08
> **Objetivo:** Blinky, Pinky, Inky y Clyde actúan cada uno con su personalidad clásica del arcade, salen de la jaula de forma escalonada y Blinky persigue agresivamente a Pac-Man.

## Por qué existe esta spec

Hoy hay solo 2 fantasmas con IA binaria (`hunter` directo y `random`), definidos en `GHOST_STARTS` (src/js/maze.js:54) y ramificados en `decideGhost` (src/js/game.js:113). Además, `kind` pasa de nombres descriptivos a nombres clásicos del arcade: es un cambio de convención pedido explícitamente, no un descuido.

## Scope

**In:**

- Ampliar `GHOST_STARTS` (src/js/maze.js) de 2 a 4 fantasmas, con `kind` clásico y `exitDelay` en segundos.
- Sustituir la IA binaria de `decideGhost` (src/js/game.js) por los cuatro objetivos clásicos.
- Fases por fantasma: `waiting` (quieto en la jaula hasta expirar su retardo) → `exiting` (salida guionizada por la puerta) → `active` (IA de su personalidad).
- Velocidad de Blinky a 0.12 celdas/frame; Pinky, Inky y Clyde se quedan a 0.1 (`GHOST_SPEED`).
- Reordenar `GHOST_COLORS` (src/js/render.js) a [rojo, rosa, cian, naranja] para que cada `kind` lleve su color de arcade.
- `resetPositions` (src/js/game.js) restaura posiciones, fases y temporizadores al perder una vida.

**Out of scope (para futuras specs):**

- Modo asustado y power pellets (fantasmas comestibles, puntos extra).
- Alternancia global de modos scatter/chase con temporizador.
- Aceleración de Blinky por umbrales de dots restantes (Cruise Elroy).
- Salida de jaula por contador de dots comidos.
- Fruta bonus, animaciones de ojos, intermissions.
- Cambios en `src/index.html`, `src/js/main.js` o en la geometría del laberinto.

## Modelo de datos

```js
// maze.js — GHOST_STARTS pasa de 2 a 4 entradas
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'blinky', exitDelay: 0 }, // segundos
  { x: 14, y: 14, kind: 'pinky',  exitDelay: 2 },
  { x: 12, y: 14, kind: 'inky',   exitDelay: 4 },
  { x: 15, y: 14, kind: 'clyde',  exitDelay: 6 },
];

// game.js — velocidades
const GHOST_SPEED  = 0.1;   // pinky, inky, clyde (sin cambio)
const BLINKY_SPEED = 0.12;  // el agresivo

// game.js — cada fantasma de game.ghosts gana dos campos
{
  x: 13, y: 14,
  dir: 'up',
  kind: 'blinky',
  speed: BLINKY_SPEED,
  phase: 'waiting',   // 'waiting' | 'exiting' | 'active'
  exitDelay: 0,       // segundos restantes; solo descuenta en 'waiting'
}
```

Objetivos por `kind` (en celdas, distancia Manhattan, recalculados en cada celda alineada):

| kind   | Objetivo                                                           |
| ------ | ------------------------------------------------------------------ |
| blinky | celda de Pac-Man (persecución directa, lógica `hunter` actual)     |
| pinky  | pacman + 4·dir(pacman) — sin el bug histórico del vector «arriba»  |
| inky   | 2·(pacman + 2·dir) − pos(blinky) — flanqueo usando al agresivo     |
| clyde  | pacman si distancia Manhattan > 8; si ≤ 8, esquina (0, 30)         |

Convenciones: coordenadas en celdas, origen arriba-izquierda. `exitDelay` se descuenta a razón de 1/60 s por frame de `requestAnimationFrame` (solo durante `state: 'playing'`).

## Plan de implementación

1. **Datos y colores.** Ampliar `GHOST_STARTS` en src/js/maze.js con las 4 entradas (kind + exitDelay) y reordenar `GHOST_COLORS` en src/js/render.js a `['#ff0000', '#ffb8ff', '#00ffff', '#ffb852']` (rojo, rosa, cian, naranja, en orden blinky, pinky, inky, clyde). Prueba manual: abrir src/index.html; la partida arranca sin errores de consola y en la jaula se ven 4 fantasmas con sus colores (los kinds nuevos aún caen en la rama aleatoria de `decideGhost`: estado intermedio válido y jugable).
2. **Fases y salida escalonada.** En src/js/game.js: `createGame` inicializa `phase` y `exitDelay`; `moveGhost` descuenta el retardo sin moverse en `'waiting'`; al expirar pasa a `'exiting'` con salida guionizada (alinearse en horizontal a la columna 13 o 14 de la fila 14, subir por la puerta hasta la fila 11) y de ahí a `'active'`; `resetPositions` restaura posiciones, fases y retardos. Prueba manual: Blinky sale al instante; Pinky, Inky y Clyde quietos 2/4/6 s; ninguno encerrado; al perder una vida el escalonado se repite.
3. **Objetivos de blinky, pinky e inky.** Reescribir `decideGhost` con la tabla de objetivos (blinky conserva la lógica actual). Prueba manual: Pinky corta el paso hacia donde te diriges; Inky cierra por el lado opuesto a Blinky.
4. **Objetivo de clyde y velocidad de blinky.** Umbral de 8 celdas hacia la esquina (0, 30) y `BLINKY_SPEED = 0.12` para Blinky; el resto sigue a `GHOST_SPEED`. Prueba manual: acércate a Clyde y retrocede a su esquina; Blinky avanza visiblemente más rápido que los otros tres.

## Criterios de aceptación

- [ ] Al iniciar la partida se ven 4 fantasmas en la jaula con colores rojo, rosa, cian y naranja.
- [ ] Blinky sale de la jaula nada más empezar; Pinky, Inky y Clyde permanecen quietos y salen a los 2, 4 y 6 segundos respectivamente.
- [ ] Tras perder una vida (que no sea la última), los 4 regresan a la jaula y el escalonado se reinicia con los mismos retardos.
- [ ] Ningún fantasma queda atrapado dentro de la jaula tras expirar su retardo.
- [ ] Blinky traza siempre la ruta más corta hacia la celda de Pac-Man (persecución directa).
- [ ] Pinky apunta 4 celdas por delante de la dirección de movimiento de Pac-Man.
- [ ] Inky flanquea: su rumbo depende de la posición de Blinky y cierra por el lado opuesto.
- [ ] Clyde persigue a más de 8 celdas de distancia y se retira hacia la esquina inferior izquierda (0, 30) al acercarse a 8 o menos.
- [ ] Blinky se desplaza visiblemente más rápido (0.12) que los otros tres (0.1).
- [ ] La puerta de la jaula sigue bloqueando solo a Pac-Man, y el túnel de la fila 14 sigue funcionando para los 4 fantasmas.
- [ ] La partida sigue siendo ganable (comer todos los dots) y perdible (3 colisiones con cualquier fantasma).
- [ ] No hay errores en la consola del navegador durante una partida completa.

## Decisiones

- **Sí:** cuarteto clásico del arcade. Conductas documentadas y realmente distintas sin tocar las reglas de movimiento.
- **No:** conjunto simplificado de conductas. Menos fiel y no más simple de razonar.
- **Sí:** Blinky como agresivo. Ya existía como `hunter`; conserva color rojo y posición.
- **Sí:** los 4 nacen dentro de la jaula (12..15, fila 14). Sin casos especiales de inicio fuera.
- **No:** Blinky naciendo fuera de la jaula como el arcade. Diferencia mínima a cambio de un caso especial.
- **Sí:** salida escalonada por temporizador fijo (0/2/4/6 s), reiniciada en cada respawn. Determinista y verificable a mano.
- **No:** salida por contador de dots. Depende del jugador; difícil de verificar.
- **Sí:** quietos mientras esperan. El escalonado ya diferencia el inicio.
- **No:** rebotar dentro de la jaula. Animación decorativa con lógica extra de límites.
- **Sí:** nombres clásicos (`blinky`, `pinky`, `inky`, `clyde`) para `kind`. Elección explícita del usuario, pese a que la convención existente era descriptiva.
- **Sí:** salida guionizada de la jaula (columna 13/14 → puerta → fila 11) antes de activar la IA.
- **No:** dejar que la IA decida desde dentro de la jaula. Deambularía sin sentido antes de encontrar la puerta.
- **Sí:** Blinky a 0.12. Más rápido que los demás, pero Pac-Man (0.125) aún gana distancia en recta.
- **No:** Blinky a 0.125 (inescapable en recta) y Elroy por umbrales (código extra difícil de verificar a mano).
- **Sí:** Pinky sin el bug histórico del vector «arriba» (que desplazaba 4 a la izquierda). Simétrico y predecible.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Fantasma atascado en la jaula si el guion de salida falla (p. ej. tras un respawn) | La salida guionizada usa solo geometría fija de la jaula (no `decideGhost` ni colisiones); hay criterio de aceptación específico. |
| 0.12 no es 1/n exacto y podría romper la alineación por celda | `aligned()` tolera ±1e-3; el error acumulado de 0.12·25 es ~4e-16, muy por debajo. |
| Partida más difícil con 4 IA dirigidas (antes 1 hunter + 1 random) | Pac-Man (0.125) supera a Pinky/Inky/Clyde y a Blinky (0.12); el criterio de partida ganable/perdible actúa de red de seguridad. |

## Lo que **no** está en esta spec

- Modo asustado y power pellets.
- Alternancia global scatter/chase.
- Cruise Elroy (aceleración por dots restantes).
- Contador de dots para salir de la jaula.

Cada una de esas, si llega algún día, va en su propia spec.

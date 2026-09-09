// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // pinky, inky, clyde
const BLINKY_SPEED = 0.12;  // blinky: el agresivo

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: g.kind === 'blinky' ? BLINKY_SPEED : GHOST_SPEED,
      kind: g.kind,
      phase: 'waiting', // 'waiting' | 'exiting' | 'active'
      exitDelay: g.exitDelay, // segundos restantes; solo descuenta en 'waiting'
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Objetivo (en celdas) de cada fantasma segun su personalidad clasica.
// Se recalcula en cada celda alineada (decideGhost solo corre alineado).
function ghostTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const d = DIRS[ p.dir ];

  if ( g.kind === 'blinky' ) {
    // Persecucion directa: la celda de Pac-Man.
    return { x: px, y: py };
  }
  if ( g.kind === 'pinky' ) {
    // Emboscada: 4 celdas por delante de la direccion de Pac-Man
    // (sin el bug historico del vector 'arriba').
    return { x: px + d.x * 4, y: py + d.y * 4 };
  }
  if ( g.kind === 'inky' ) {
    // Flanqueo: 2·(pacman + 2·dir) − pos(blinky).
    const b = game.ghosts.find( ( o ) => o.kind === 'blinky' );
    const ax = px + d.x * 2; // ancla: 2 celdas delante de Pac-Man
    const ay = py + d.y * 2;
    return { x: 2 * ax - Math.round( b.x ), y: 2 * ay - Math.round( b.y ) };
  }
  if ( g.kind === 'clyde' ) {
    // Timido: persigue de lejos, pero a 8 celdas o menos (Manhattan)
    // se retira hacia su esquina inferior izquierda (0, 30).
    const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
    if ( dist > 8 ) return { x: px, y: py };
    return { x: 0, y: 30 };
  }
  return null; // kind desconocido: deambular aleatorio
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const target = ghostTarget( game, g );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  if ( !target ) {
    // Sin personalidad dirigida aun: deambular aleatorio.
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    return;
  }

  // Elegir la direccion (sin reversa) que mas acorta la distancia
  // Manhattan desde la celda vecina al objetivo.
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Geometria fija de la salida de la jaula (MAZE_STR filas 11-14).
const EXIT_COL_LEFT = 13; // columnas de subida (justo bajo la puerta)
const EXIT_COL_RIGHT = 14;
const EXIT_ROW = 11; // fila sobre la puerta: fin del guion, inicio de la IA

// Salida guionizada de la jaula: en la fila del nacimiento (14) alinearse en
// horizontal a la columna 13 o 14, subir por la puerta hasta la fila 11 y
// pasar a 'active'. Usa solo geometria fija (no decideGhost ni colisiones):
// ningun fantasma puede quedar atrapado dentro.
function stepExit( g ) {
  if ( g.x < EXIT_COL_LEFT - 1e-3 ) {
    g.dir = 'right';
    g.x = Math.min( g.x + g.speed, EXIT_COL_LEFT );
  } else if ( g.x > EXIT_COL_RIGHT + 1e-3 ) {
    g.dir = 'left';
    g.x = Math.max( g.x - g.speed, EXIT_COL_RIGHT );
  } else if ( g.y > EXIT_ROW + 1e-3 ) {
    g.dir = 'up';
    g.y = Math.max( g.y - g.speed, EXIT_ROW );
  } else {
    g.x = Math.round( g.x );
    g.y = EXIT_ROW;
    g.dir = 'up';
    g.phase = 'active';
  }
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Fase 'waiting': quieto en la jaula hasta expirar su retardo
  // (1/60 s por frame, solo durante state 'playing').
  if ( g.phase === 'waiting' ) {
    g.exitDelay -= 1 / 60;
    if ( g.exitDelay <= 0 ) g.phase = 'exiting';
    return;
  }

  // Fase 'exiting': salida guionizada por la puerta.
  if ( g.phase === 'exiting' ) {
    stepExit( g );
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    const s = GHOST_STARTS[ i ];
    g.x = s.x;
    g.y = s.y;
    g.dir = 'up';
    g.phase = 'waiting';
    g.exitDelay = s.exitDelay; // el escalonado 0/2/4/6 se reinicia
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;

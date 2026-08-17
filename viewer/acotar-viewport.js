// viewer/acotar-viewport.js — Que un panel flotante no se pueda perder por un borde.
//
// ── POR QUÉ ESTO ES UN FICHERO PROPIO Y NO TRES LÍNEAS DENTRO DEL PANEL ─────
// Porque es LO ÚNICO del panel arrastrable que se puede probar de verdad, y
// mezclado con el DOM no se probaría nunca. `getBoundingClientRect()` devuelve
// ceros en jsdom, así que un test que midiera el acotado allí mediría **nada** y
// pasaría siempre. Este repositorio ya pagó esa factura una vez, y está escrita:
//
//     test/viewer/cajon-diagnostico.dom.test.js:1059
//       // aquellas cuatro pruebas pasaban en verde mientras el botón era
//       // inalcanzable en producción, porque jsdom no maqueta
//
// Sacando la aritmética a una función PURA —sin DOM, sin Leaflet, sin ventana—
// el proyecto Vitest `node` la prueba de verdad, con números, y al panel le queda
// solo el trabajo de medir y aplicar. Lo que sigue sin poder probarse en jsdom
// —que tras un `resize` de VERDAD la barra siga alcanzable— es del guion de humo
// 16, en Chromium. Son dos guardianes distintos porque son dos preguntas
// distintas: aquí «¿la cuenta está bien?», allí «¿se aplica la cuenta?».
//
// ── ⛔ LO QUE SE ACOTA ES LA BARRA DE TÍTULO, NO EL PANEL ───────────────────
// Y la diferencia no es un matiz. Un panel cuyo CUERPO se sale por abajo es
// incómodo: se lee peor y se arrastra hacia arriba. Una BARRA DE TÍTULO fuera del
// viewport es un panel que **no se puede cerrar ni minimizar nunca más**, porque
// sus dos únicos controles —`[–]` y `[×]`— se han ido con ella, y el asidero del
// arrastre también. Deja de ser una molestia y pasa a ser una trampa: la única
// salida es recargar la página, y con ella se va el trabajo sin guardar.
//
// Por eso el rectángulo que entra aquí es el de la BARRA y no el del panel. Como
// la barra ocupa la esquina superior izquierda del panel, su `x`/`y` **son** los
// del panel, y lo que devuelve esta función se puede aplicar tal cual.

/**
 * Acota la posición de un panel flotante para que su barra de título siga dentro
 * de la ventana.
 *
 * ── LA REGLA, EN UNA LÍNEA ──────────────────────────────────────────────────
 * La barra no puede dejar HUECO contra ningún borde por el que se haya salido. O
 * sea: mientras quepa, se mete entera; y cuando no quepa, se le exige cubrir el
 * borde de lado a lado en vez de dejar una franja muerta.
 *
 * ⚠️ **El caso «no cabe» NO es teórico y por eso no se resuelve a la brava.** Una
 * ventana más estrecha que el panel existe (un móvil apaisado, un navegador
 * partido en dos). La tentación era fijar `x = 0` y olvidarse, y eso escondería
 * el `[×]` —que está en el extremo DERECHO de la barra— justo en la ventana donde
 * más falta hace cerrar el panel. Con el intervalo de abajo caben las dos
 * posiciones, la de pegarse a la izquierda y la de pegarse a la derecha, y **no
 * se le mueve el panel al usuario más de lo imprescindible**: si lo que tenía ya
 * cubría el ancho, se queda donde estaba.
 *
 * ── POR QUÉ EL INTERVALO SE ESCRIBE CON `min` Y `max` Y NO CON UN `if` ──────
 * Los dos extremos son `0` y `sobra = ventana − barra`, y **cuál de los dos es el
 * de arriba depende del signo de `sobra`**: con la barra cabiendo (`sobra ≥ 0`) el
 * intervalo es `[0, sobra]`, y sin caber (`sobra < 0`) es `[sobra, 0]`. Escribirlo
 * como `[min(0,sobra), max(0,sobra)]` cubre los dos sin ramas, y sobre todo cubre
 * el borde exacto —`sobra === 0`, la barra clavada al ancho de la ventana— que es
 * donde un `if` mal puesto deja el intervalo vacío y `clamp` devuelve cualquier
 * cosa.
 *
 * ⚠️ **Una ventana de 0×0 no lanza**, devuelve números. Pasa de verdad: una
 * pestaña de fondo, un `iframe` sin maquetar todavía y jsdom miden 0. Lanzar ahí
 * convertiría un estado transitorio y normal en una excepción en consola.
 *
 * IDEMPOTENTE: acotar lo ya acotado devuelve lo mismo. Es lo que deja llamarla en
 * cada `resize` y en cada paso del arrastre sin acumular deriva.
 *
 * ```js
 * acotarAlViewport({ x: 900, y: 40, ancho: 320, alto: 28 }, { ancho: 1000, alto: 700 })
 * // → { x: 680, y: 40 }   ← se salía 220 px por la derecha
 * ```
 *
 * @param {{x: number, y: number, ancho: number, alto: number}} barra  El
 *   rectángulo de la BARRA DE TÍTULO en coordenadas de la ventana. Su `x`/`y` son
 *   también los del panel, porque la barra va pegada a su esquina.
 * @param {{ancho: number, alto: number}} ventana  El viewport.
 * @returns {{x: number, y: number}} La posición corregida del panel.
 */
export function acotarAlViewport(barra, ventana) {
  const b = exigirRectangulo(barra, 'barra', ['x', 'y', 'ancho', 'alto'])
  const v = exigirRectangulo(ventana, 'ventana', ['ancho', 'alto'])

  return {
    x: acotarEje(b.x, v.ancho - b.ancho),
    y: acotarEje(b.y, v.alto - b.alto),
  }
}

/**
 * Un eje. `sobra` es lo que le queda de ventana a la barra después de ponerla: si
 * es positivo hay sitio de sobra y la barra vive en `[0, sobra]`; si es negativo
 * la barra es más grande que la ventana y vive en `[sobra, 0]`, que es el juego de
 * posiciones en las que cubre el borde entero sin dejar hueco.
 */
function acotarEje(valor, sobra) {
  const suelo = Math.min(0, sobra)
  const techo = Math.max(0, sobra)
  return Math.min(Math.max(valor, suelo), techo)
}

/**
 * ⚠️ **Se valida el CONTRATO, no el rango.** Que la ventana mida 0 es un estado
 * legítimo (ver el JSDoc de arriba) y aquí pasa sin ruido; que `ancho` llegue como
 * `undefined` o como `NaN` es un fallo del programador, y ésos se cazan en el
 * borde con un mensaje que dice qué llegó. Un `NaN` que se deja entrar sale por el
 * otro lado convertido en un `style.left = 'NaNpx'`, que el navegador ignora en
 * silencio: el panel se queda quieto y nadie sabe por qué.
 */
function exigirRectangulo(valor, nombre, claves) {
  if (valor === null || typeof valor !== 'object') {
    throw new TypeError(
      `acotarAlViewport: '${nombre}' debe ser un objeto con ${claves.join(', ')}; llegó ` +
        `${valor === null ? 'null' : typeof valor}.`,
    )
  }
  for (const clave of claves) {
    if (!Number.isFinite(valor[clave])) {
      throw new TypeError(
        `acotarAlViewport: '${nombre}.${clave}' debe ser un número finito; llegó ` +
          `${JSON.stringify(valor[clave]) ?? typeof valor[clave]}.`,
      )
    }
  }
  return valor
}

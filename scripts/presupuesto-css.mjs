#!/usr/bin/env node
// scripts/presupuesto-css.mjs — Rework de UI · T10. EL PRESUPUESTO DE LA HOJA.
//
// Mide lo que pesa la hoja de estilo CONSTRUIDA, la parte con el vendor
// descontado, y lo contrasta con el último asiento del registro de abajo.
//
// ═════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO ES UN SCRIPT Y NO UN PÁRRAFO EN UN MARKDOWN
// ═════════════════════════════════════════════════════════════════════════════
// El criterio 10 del rework dice: «`estilos/app.css` acaba pesando menos de
// 57.159 B al cerrar la quinta rebanada; durante la migración puede subir, pero
// **cada rebanada anota cuánto**». La premisa que lo justificaba decía que la
// hoja había crecido un 24 % en una fase «y nadie lo vio».
//
// Nadie lo vio porque no había NADA que mirar: ni un número publicado, ni un
// sitio donde anotarlo. Escribir ahora ese número a mano en un fichero de prosa
// reproduce el mismo modo de fallo con más letra: el día que alguien engorde la
// hoja no va a acordarse de venir a actualizar un markdown, exactamente como no
// se acordó de volver a por el rail durante ocho fases (`estilos/app.css:11-21`).
//
// Así que el registro y el medidor son la MISMA cosa: `ASIENTOS` es la lista, y
// el script sale ROJO si la hoja construida no coincide con el último asiento.
// La regla no es «no crezcas», que sería mentira durante una migración; es
// **«crece si hace falta, pero queda anotado»**. La única forma de poner el
// script en verde tras tocar CSS es añadir el asiento.
//
// Del `validar-xsd.mjs` se hereda la lección más cara del repositorio: **no
// poder medir es un FALLO (código 2), nunca un salto benigno.** Un guardián que
// se salta solo no es un guardián, es una intención — y ese error ya costó un
// fichero rechazado por la Sede con 1.784 pruebas en verde.
//
// ── QUÉ NÚMERO ES ÉSTE, Y CUÁL NO ───────────────────────────────────────────
// ⛔ NO es el tamaño de `estilos/app.css` en disco. Ése mide hoy ~182.000 B y
//    casi todo son COMENTARIOS: en este repositorio la hoja es también el
//    registro de diseño, y presupuestar el fichero fuente castigaría escribir
//    el porqué de cada regla, que es justo lo contrario de lo que se quiere.
//    El minificador se los come enteros; lo que sobrevive son REGLAS, que es lo
//    que el criterio 10 quiere vigilar («si de verdad se quitaron los apaños de
//    la pelea por píxeles o solo se taparon»).
//
// ✅ Es `dist/assets/index-*.css`: la hoja que se descarga. Contiene, en este
//    orden, `estilos/app.css` con sus cinco `@import` de tokens ya fundidos, y
//    detrás `leaflet/dist/leaflet.css`, que importa `app/main.js`.
//
// ⛔ **Y ahí está la corrección que T10 trae y que hay que leer antes de citar
//    el techo**: de los 57.159 B de la línea base, **15.095 son de Leaflet**.
//    Medido en las DOCE builds históricas del barrido: 15.095 B clavados en las
//    doce, porque `leaflet@^1.9.4` no se ha movido desde F05. O sea que el techo
//    del criterio 10, dicho en bytes que este proyecto escribe, es
//    **42.064 B**, no 57.159. Por eso se publican los dos.
//
// ── USO ─────────────────────────────────────────────────────────────────────
//     npm run build && npm run presupuesto
//
// Códigos de salida:  0 = dentro de lo anotado · 1 = la hoja se movió sin
// anotarse (o revienta el techo) · 2 = no se ha podido medir.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * El primer selector propio de `leaflet.css`, y por tanto la costura entre lo
 * nuestro y el vendor en la hoja construida.
 *
 * No vale buscar `.leaflet-` a secas: `estilos/app.css` tiene una docena de
 * reglas que pisan cromo de Leaflet (`.gml-app .gml-mapa .leaflet-bar`…) y la
 * primera aparecería mucho antes. `.leaflet-pane,` con la coma es la lista de
 * selectores con la que ARRANCA `leaflet.css` («required styles») y no la
 * escribe nadie más.
 */
export const MARCA_VENDOR = '.leaflet-pane,'

/** El espacio de nombres de todo lo que escribe este proyecto. */
export const MARCA_NUESTRA = '.gml-'

/**
 * Las cinco rebanadas del rework son **las cinco pantallas del rail**, en su
 * orden. El techo del criterio 10 solo se exige cuando las cinco están
 * anotadas.
 *
 * ⚠️ Esta lista está a mano A PROPÓSITO y NO importa `app/navegacion.js`: un
 * script de tooling que importa código de la app se lleva por delante media
 * aplicación (`navegacion.js` cuelga de `viewer/_comun.js`). Que no diverja lo
 * garantiza `test/scripts/presupuesto-css.test.js`, que sí importa las dos y
 * exige que sean idénticas.
 */
export const REBANADAS = Object.freeze(['entrada', 'validacion', 'edicion', 'diagnostico', 'informe'])

/**
 * El techo del criterio 10, en las dos unidades, para que nadie tenga que
 * hacer la resta de cabeza ni se le olvide que hay vendor dentro.
 *
 * Los dos números son **la medición exacta de `960bb7a` (F11)**, que es la
 * línea base declarada del rework: el criterio pide acabar por debajo de donde
 * se empezó.
 */
export const TECHO = Object.freeze({ total: 57159, nuestro: 42064 })

/**
 * EL REGISTRO. Un asiento por hito, con la hoja construida medida de verdad.
 *
 * Los doce primeros NO se copiaron de ningún sitio: se midieron el 2026-08-04
 * reconstruyendo el artefacto en cada commit (se sustituye `estilos/`, se corre
 * `npm run build`, se lee `dist/assets/*.css`). Por eso hay `commit`: cualquiera
 * puede repetir el barrido y obtener los mismos números.
 *
 * `rebanada` = qué pantalla del rail cerró ese hito, o `null` si el hito no
 * cerró ninguna. Es lo que decide cuándo empieza a exigirse el techo.
 *
 * ── CÓMO SE AÑADE UN ASIENTO ────────────────────────────────────────────────
 *   1. `npm run build`
 *   2. `npm run presupuesto` → sale ROJO y te dice el par (total, nuestro)
 *   3. copias ese par aquí abajo con su hito, su commit y **una nota de una
 *      línea diciendo QUÉ subió o bajó**. La nota es la mitad del valor: un
 *      número sin causa no se puede revisar después.
 */
export const ASIENTOS = Object.freeze(
  [
    { hito: 'F03', commit: '5d68f14', total: 31779, nuestro: 16684, rebanada: null,
      nota: 'La cáscara nace: un panel de altura fija y el mapa.' },
    { hito: 'F04', commit: 'a1c1138', total: 32743, nuestro: 17648, rebanada: null,
      nota: 'Generación del GML: +964 B, el hito más barato de los doce.' },
    { hito: 'F05', commit: 'ba00138', total: 34938, nuestro: 19843, rebanada: null,
      nota: 'Catastro en vivo: la barra de búsqueda y sus estados.' },
    { hito: 'F06', commit: '3dd7f99', total: 42221, nuestro: 27126, rebanada: null,
      nota: '⭐ EL SALTO GORDO: +7.283 B, +36,7 % de lo nuestro en UNA fase. La barra flotante de edición.' },
    { hito: 'F07', commit: 'a0e2a9d', total: 43641, nuestro: 28546, rebanada: null,
      nota: 'Diagnóstico de encaje: el cajón sobre el mapa, no un bloque en el panel.' },
    { hito: 'F08', commit: '3ea5d49', total: 45905, nuestro: 30810, rebanada: null,
      nota: 'Comprobar un GML: segundo cajón sobre el mapa y la zona de soltar ficheros.' },
    { hito: 'F09', commit: '21366ac', total: 49244, nuestro: 34149, rebanada: null,
      nota: 'Informe firmable: el diálogo de la firma y su formulario.' },
    { hito: 'F10', commit: 'c2df2c7', total: 52801, nuestro: 37706, rebanada: null,
      nota: 'Persistencia: el diálogo de expedientes y la fila del rótulo.' },
    { hito: 'F11', commit: '960bb7a', total: 57159, nuestro: 42064, rebanada: null,
      nota: '⭐ LÍNEA BASE DEL REWORK. Segunda rama: el panel de edificio y sus dos cajas encogibles.' },
    { hito: 'Rework T1-T4', commit: 'cdaae52', total: 57159, nuestro: 42064, rebanada: null,
      nota: '⭐ CERO BYTES. La autoridad de navegación y sus tres guardianes son JS puro.' },
    { hito: 'Rework T5-T6', commit: 'c2e0544', total: 61108, nuestro: 46013, rebanada: 'entrada',
      nota: 'Cáscara de tres columnas (+2.370) y pantalla de Entrada (+1.579). La primera rebanada.' },
    { hito: 'Rework T7-T8', commit: '848934f', total: 61108, nuestro: 46013, rebanada: null,
      nota: 'Avisos de rama y comentarios: cero CSS, y los artefactos salieron idénticos byte a byte.' },
    { hito: 'Rework T9-T10', commit: 'af508f7', total: 61108, nuestro: 46013, rebanada: null,
      nota: 'Pantalla de contraste: el cajón se viste con estilos en línea, así que no toca la hoja.' },
    { hito: 'Rework rebanada 2', commit: 'c176c3f', total: 61108, nuestro: 46013, rebanada: 'validacion',
      nota: '⭐ CERO BYTES: repartir el pie por pantallas es MARCADO (data-pantalla), y las cinco reglas del CSS ya estaban escritas desde T6.' },
    { hito: 'Rework rebanada 3', commit: 'd0b7229', total: 61108, nuestro: 46013, rebanada: 'edicion',
      nota: '⭐ CERO BYTES otra vez: la barra declara su pantalla desde JS y el interruptor de los cuatro gestos es lógica, no estilo.' },
    { hito: 'Rework rebanada 4', commit: '44b02ad', total: 61108, nuestro: 46013, rebanada: 'diagnostico',
      nota: '⭐ CERO BYTES por TERCERA vez seguida, y aquí es un hecho sobre dónde vive el cromo del cajón: viewer/cajon-diagnostico.js se viste con estilos EN LÍNEA porque no importa ninguna hoja (para ser legible en jsdom y en un mapa pelado), así que anclarle el pie y subirle el tope de alto no toca app.css. Lo demás —que no se descarte y que el ✕ salga— es lógica.' },
    { hito: 'Rework rebanada 5', commit: '(sin commitear)', total: 61587, nuestro: 46492, rebanada: null,
      nota:
        '⚠️ EL PRODUCTO DE LA QUINTA ESTÁ HECHO Y AQUÍ NO SE DECLARA CERRADA, A PROPÓSITO. Cerrarla ' +
        'hace exigible el techo del criterio 10 (42.064 B nuestros) y hoy sobran 4.428. Se midió si ' +
        'había de dónde sacarlos y NO lo hay: 0 clases y 0 pares data-* huérfanos sobre 178 y 22, y ' +
        'el reparto son 286 reglas de las que ninguna pasa de 527 B una vez fuera los tokens (3.906) ' +
        'y el tema oscuro (1.931). O sea: el techo solo se cumple quitando producto vivo. La decisión ' +
        '—bajar la hoja o revisar el techo— es del autor, y hasta que la tome el registro dice la ' +
        'verdad: hoja movida +479 B (el informe a página completa y su bloque anclado), rebanada ' +
        'anotada, quinta SIN cerrar.' },
  ].map((a) => Object.freeze({ ...a, vendor: a.total - a.nuestro })),
)

/**
 * Parte la hoja construida en lo nuestro y el vendor, **comprobando la costura
 * en cada lectura en vez de darla por buena**.
 *
 * Que Leaflet vaya al final es un hecho medido en doce builds, no una promesa
 * de Vite: el día que cambie el orden (o que alguien importe otra hoja de
 * terceros) este reparto atribuiría bytes ajenos a este proyecto y el
 * presupuesto pasaría a medir otra cosa **sin decirlo**. De ahí las dos
 * verificaciones: la marca aparece UNA vez, y detrás de ella no queda ni un
 * selector `.gml-`.
 *
 * @param {string} css Contenido de la hoja construida.
 * @returns {{total: number, nuestro: number, vendor: number}} Bytes UTF-8.
 * @throws {Error} Si la costura no se puede verificar.
 */
export function partirHoja(css) {
  const trozos = css.split(MARCA_VENDOR)
  if (trozos.length === 1) {
    throw new Error(
      `No se encuentra «${MARCA_VENDOR}» en la hoja construida: no se puede separar lo que ` +
        'escribe este proyecto de lo que trae Leaflet. Si se ha quitado Leaflet, el presupuesto ' +
        'entero cambia de escala y hay que rehacer la línea base (TECHO), no ajustar la marca.',
    )
  }
  if (trozos.length > 2) {
    throw new Error(
      `«${MARCA_VENDOR}» aparece ${trozos.length - 1} veces en la hoja construida y debería ` +
        'aparecer una: alguien ha escrito ese selector fuera de leaflet.css, o el vendor entra dos veces.',
    )
  }
  const cola = trozos[1]
  if (cola.includes(MARCA_NUESTRA)) {
    throw new Error(
      'Detrás del bloque de Leaflet hay selectores `.gml-`: el vendor ha dejado de ser el final ' +
        'de la hoja y este reparto atribuiría bytes de Leaflet a este proyecto. Hay que rehacer ' +
        'el corte antes de volver a fiarse de la cifra.',
    )
  }
  const total = Buffer.byteLength(css, 'utf8')
  const nuestro = Buffer.byteLength(trozos[0], 'utf8')
  return { total, nuestro, vendor: total - nuestro }
}

/**
 * Contrasta la medición con el registro.
 *
 * @param {{total: number, nuestro: number}} medido
 * @param {object} [opciones]
 * @returns {{ok: boolean, problemas: string[], ultimo: object, cerradas: string[],
 *            pendientes: string[], delta: {total: number, nuestro: number}}}
 */
export function comparar(medido, { asientos = ASIENTOS, techo = TECHO, rebanadas = REBANADAS } = {}) {
  const problemas = []
  const ultimo = asientos[asientos.length - 1]

  if (medido.total !== ultimo.total || medido.nuestro !== ultimo.nuestro) {
    const d = medido.nuestro - ultimo.nuestro
    problemas.push(
      `La hoja se ha movido y NADIE lo ha anotado: el último asiento («${ultimo.hito}») dice ` +
        `${bytes(ultimo.total)} (${bytes(ultimo.nuestro)} nuestros) y lo construido mide ` +
        `${bytes(medido.total)} (${bytes(medido.nuestro)} nuestros), ` +
        `${d >= 0 ? '+' : ''}${bytes(d)}. Añade el asiento en scripts/presupuesto-css.mjs ` +
        'con su hito y una línea diciendo qué ha cambiado.',
    )
  }

  const cerradas = rebanadas.filter((r) => asientos.some((a) => a.rebanada === r))
  const pendientes = rebanadas.filter((r) => !cerradas.includes(r))

  // El techo NO se exige durante la migración: el criterio 10 dice literalmente
  // que puede subir mientras dure. Solo muerde cuando las cinco pantallas están
  // anotadas, que es el momento en que el rework se declara terminado.
  if (pendientes.length === 0 && medido.nuestro >= techo.nuestro) {
    problemas.push(
      `Las cinco rebanadas están cerradas y la hoja NO ha bajado del techo del criterio 10: ` +
        `${bytes(medido.nuestro)} nuestros frente a los ${bytes(techo.nuestro)} exigidos ` +
        `(${bytes(techo.total)} con Leaflet dentro). Sobran ${bytes(medido.nuestro - techo.nuestro)}.`,
    )
  }

  return {
    ok: problemas.length === 0,
    problemas,
    ultimo,
    cerradas,
    pendientes,
    delta: { total: medido.total - techo.total, nuestro: medido.nuestro - techo.nuestro },
  }
}

/**
 * Bytes con separador de millares español, que es como están escritas todas las
 * cifras del repositorio.
 *
 * `useGrouping: 'always'` no es adorno: en español el separador de millares NO
 * se pone por defecto en números de cuatro cifras, así que sin él este medidor
 * escribiría «3949 B» al lado de «61.108 B» y los dos números parecerían venir
 * de sitios distintos.
 */
export function bytes(n) {
  return `${n.toLocaleString('es-ES', { useGrouping: 'always' })} B`
}

/**
 * El informe que se imprime. Se separa de la E/S para poder probarlo sin `dist/`.
 *
 * @returns {string}
 */
export function informe(medido, veredicto, { techo = TECHO } = {}) {
  // En valor absoluto: el signo ya lo dice la palabra («por encima»/«por debajo»),
  // y «-9,4 % por debajo» se lee como lo contrario de lo que es.
  const pct = (a, b) => `${(Math.abs((a - b) / b) * 100).toFixed(1).replace('.', ',')} %`
  const lineas = [
    '─ Presupuesto de la hoja construida (Rework de UI · T10) ────────────────',
    `  Hoja entera        ${bytes(medido.total)}`,
    `  · de este proyecto ${bytes(medido.nuestro)}   ← la cifra presupuestada`,
    `  · de Leaflet       ${bytes(medido.vendor)}   (vendor: no lo escribimos ni lo podemos encoger)`,
    '',
    `  Techo (criterio 10) ${bytes(techo.nuestro)} nuestros / ${bytes(techo.total)} con vendor`,
    veredicto.delta.nuestro >= 0
      ? `  Hoy SOBRAN          ${bytes(veredicto.delta.nuestro)}  (${pct(medido.nuestro, techo.nuestro)} por encima)`
      : `  Hoy hay holgura de  ${bytes(-veredicto.delta.nuestro)}  (${pct(medido.nuestro, techo.nuestro)} por debajo)`,
    '',
    `  Último asiento      ${veredicto.ultimo.hito} — ${bytes(veredicto.ultimo.total)}`,
    `  Rebanadas cerradas  ${veredicto.cerradas.length}/5${
      veredicto.pendientes.length > 0 ? ` (faltan: ${veredicto.pendientes.join(', ')})` : ''
    }`,
  ]
  if (veredicto.pendientes.length > 0) {
    lineas.push('  El techo NO se exige hasta que las cinco estén cerradas (criterio 10).')
  }
  return lineas.join('\n')
}

// ── De aquí abajo, solo E/S ──────────────────────────────────────────────────

/**
 * Localiza la hoja construida y se niega a medir una que esté vieja.
 *
 * Medir un `dist/` anterior al último cambio de CSS daría una cifra plausible y
 * FALSA, que es el peor resultado posible para un guardián. Ya pasó a mano
 * mientras se escribía T10: `dist/` de las 16:18 y `estilos/app.css` de las
 * 14:53 parecían coherentes y no lo eran.
 */
function localizarHoja() {
  const dir = join(RAIZ, 'dist', 'assets')
  if (!existsSync(dir)) {
    throw new Error('No hay `dist/`. Corre `npm run build` y vuelve: el presupuesto se mide sobre el artefacto, no sobre la fuente.')
  }
  const hojas = readdirSync(dir).filter((n) => n.endsWith('.css'))
  if (hojas.length !== 1) {
    throw new Error(
      `Se esperaba UNA hoja en dist/assets y hay ${hojas.length} (${hojas.join(', ') || 'ninguna'}). ` +
        'Con más de una, el reparto nuestro/vendor deja de tener sentido y hay que decidir qué se presupuesta.',
    )
  }
  const ruta = join(dir, hojas[0])
  const construida = statSync(ruta).mtimeMs

  const fuentes = [join(RAIZ, 'node_modules', 'leaflet', 'dist', 'leaflet.css')]
  const cola = [join(RAIZ, 'estilos')]
  while (cola.length > 0) {
    const d = cola.pop()
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) cola.push(p)
      else if (e.name.endsWith('.css')) fuentes.push(p)
    }
  }
  const masNueva = fuentes
    .filter((f) => existsSync(f))
    .map((f) => ({ f, t: statSync(f).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0]

  if (masNueva && masNueva.t > construida) {
    throw new Error(
      `La hoja construida es MÁS VIEJA que «${masNueva.f.slice(RAIZ.length + 1)}». La cifra sería ` +
        'plausible y falsa. Corre `npm run build` antes de medir.',
    )
  }
  return { ruta, css: readFileSync(ruta, 'utf8') }
}

function principal() {
  let medido
  try {
    const { css } = localizarHoja()
    medido = partirHoja(css)
  } catch (err) {
    console.error(`⛔ NO SE HA PODIDO MEDIR: ${err.message}`)
    return 2
  }
  const veredicto = comparar(medido)
  console.log(informe(medido, veredicto))
  if (veredicto.ok) {
    console.log('\n✅ La hoja coincide con el último asiento.')
    return 0
  }
  console.error('')
  for (const p of veredicto.problemas) console.error(`⛔ ${p}`)
  return 1
}

// ¿Me están ejecutando, o me está importando un test? Se compara la ruta de
// este módulo con la que node recibió por argumento.
//
// ⚠️ La comparación es SIN DISTINGUIR MAYÚSCULAS a propósito, y no es pereza:
// este repositorio arrastra el bug de casing de la unidad en Windows (`e:` vs
// `E:`, documentado en `vitest.config.js` y en `vite.config.js`). Con una
// comparación estricta, invocar el script desde un cwd con la unidad en
// minúscula no ejecutaría NADA y saldría con código 0: un guardián que se salta
// solo, otra vez.
const esteFichero = fileURLToPath(import.meta.url)
const invocado = process.argv[1] ? resolve(process.argv[1]) : ''
if (esteFichero.toLowerCase() === invocado.toLowerCase()) {
  process.exit(principal())
}

// licencias/terceros.js — F16 · Lo que va empaquetado de otros, con su licencia.
//
// ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
// Casi todo lo que va dentro del paquete del navegador pide, por su licencia, que
// con cada copia viaje su aviso de copyright y el texto de la licencia (MIT, ISC,
// BSD y la OFL de las fuentes lo dicen con esas palabras). La aplicación se publica
// en GitHub Pages y hasta F16 no llevaba ninguno: los comentarios de cabecera se los
// come el minificador.
//
// ── ⭐ POR QUÉ EL INVENTARIO SALE DEL BUILD Y NO DE `package.json` ───────────
// Medido el 2026-11-01: `package.json` declara 10 dependencias y en el paquete van
// **32 paquetes**, dos de ellos en dos versiones a la vez (`@turf/helpers` y
// `@turf/meta`, 7.3.5 y 7.4.0). Turf arrastra veinte subpaquetes suyos, y además
// `bignumber.js`, `polyclip-ts`, `rbush`, `robust-predicates`, `splaytree-ts`…
// Ninguno sale en `package.json` y todos van dentro. Y al revés: la lista del dossier (O9) nombraba
// jsPDF y html2canvas, que este proyecto no usa —el PDF lo escribe `report/`—, y
// proj4js, que tiene PROHIBIDO entrar (`vite.config.js#gmlSinProj4`). Una lista
// escrita a mano ya había caducado antes de escribirse.
//
// Por eso el plugin de `vite.config.js` pregunta al paquete construido qué módulos
// lleva, y este fichero decide qué se dice de cada uno.
//
// ── ⛔ EL SPDX SE COMPRUEBA, NO SE COPIA ────────────────────────────────────
// `splaytree-ts@1.0.2` declara en su `package.json` la licencia «BDS-3-Clause».
// No existe: es una errata de BSD-3-Clause, que es lo que dice su `LICENSE`.
// Copiar el campo tal cual habría publicado una página de licencias con un
// identificador inventado. De ahí {@link SPDX_ADMITIDAS} —una lista cerrada; lo que
// no está en ella revienta el build— y {@link CORRECCIONES}, cada una atada a su
// versión y a una frase que tiene que estar en el texto de la licencia.
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
// No lee disco ni conoce Vite: recibe rutas y contenidos, igual que
// `pwa/precache.js`. El plugin se queda en el pegamento y esto se prueba en el
// proyecto `node`. Del navegador solo lo importa `app/dialogo-creditos.js`, y solo
// por {@link RUTA_INVENTARIO} y {@link RUTA_AVISO}.

/** El inventario que lee el diálogo de créditos, en la raíz del artefacto. */
export const RUTA_INVENTARIO = 'licencias.json'

/** Los textos completos, para descargar. Es el aviso que las licencias piden que viaje. */
export const RUTA_AVISO = 'licencias-terceros.txt'

/**
 * Las licencias que este proyecto sabe cumplir empaquetando el aviso y el texto, y
 * ninguna más. **Lista cerrada a propósito**: una dependencia nueva con otra licencia
 * —una Apache-2.0 con su NOTICE, una GPL— tiene que pararse a que alguien la mire, y
 * la forma de que se pare es que el build no salga.
 */
export const SPDX_ADMITIDAS = Object.freeze(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Unlicense'])

/**
 * Lo que un `package.json` declara mal, por `nombre@versión`. **Atado a la versión**:
 * si el paquete sube, la corrección deja de aplicarse y el build vuelve a pararse a
 * mirar, porque la versión nueva puede haberlo arreglado o haber cambiado de licencia.
 * `prueba` es una frase que tiene que estar en el texto de la licencia: la corrección
 * no es una opinión, es lo que dice el fichero.
 */
export const CORRECCIONES = Object.freeze({
  'splaytree-ts@1.0.2': Object.freeze({
    declarada: 'BDS-3-Clause',
    spdx: 'BSD-3-Clause',
    prueba: 'BSD 3-Clause License',
  }),
})

/**
 * Las tipografías empaquetadas. No son paquetes de npm —están copiadas en
 * `estilos/fuentes/`—, así que el plugin las reconoce por la ruta de origen del
 * fichero y no por `node_modules`.
 */
export const FUENTES = Object.freeze([
  Object.freeze({
    patron: /(^|\/)estilos\/fuentes\/Geist(Mono)?-[^/]+\.woff2$/,
    nombre: 'Geist y Geist Mono',
    spdx: 'OFL-1.1',
    url: 'https://github.com/vercel/geist-font',
    /** El fichero que trae el texto verbatim de la licencia, desde su línea «Copyright». */
    licencia: 'estilos/fuentes/LICENCIA-GEIST.txt',
  }),
])

/** Las extensiones que cuentan como tipografía en el artefacto. */
const EXTENSION_FUENTE = /\.(woff2?|ttf|otf)$/i

const FICHERO_LICENCIA = /^(licen[cs]e|copying)(\.(md|txt|markdown))?$/i

/**
 * El paquete de npm al que pertenece un módulo, por su ruta. Con dependencias
 * anidadas cuenta el ÚLTIMO `node_modules`, que es el del paquete que de verdad
 * aporta el código.
 *
 * @param {string} id  El identificador del módulo tal como lo da el empaquetador.
 * @returns {{nombre: string, dir: string} | null}  `dir` es la carpeta del paquete
 *   con `/`; `null` si el módulo no viene de `node_modules` (es nuestro).
 */
export function paqueteDeModulo(id) {
  const ruta = String(id).replace(/^\0/, '').replace(/\\/g, '/').split('?')[0]
  const marca = '/node_modules/'
  const i = ruta.lastIndexOf(marca)
  if (i === -1) return null
  const [primero, segundo] = ruta.slice(i + marca.length).split('/')
  if (!primero || primero.startsWith('.')) return null
  if (primero.startsWith('@') && !segundo) return null
  const nombre = primero.startsWith('@') ? `${primero}/${segundo}` : primero
  return { nombre, dir: ruta.slice(0, i + marca.length) + nombre }
}

/**
 * De los ficheros de la carpeta de un paquete, el de la licencia.
 *
 * @param {string[]} nombres
 * @returns {string | null}
 */
export function ficheroLicencia(nombres) {
  return [...nombres].sort().find((n) => FICHERO_LICENCIA.test(n)) ?? null
}

/** Si un fichero del artefacto es una tipografía. @param {string} ruta */
export function esFuente(ruta) {
  return EXTENSION_FUENTE.test(String(ruta))
}

/**
 * Un aviso de copyright: «Copyright» seguido de (c), © o un año, o un renglón que
 * empieza por (c) o ©. **No basta la palabra**: la OFL parte renglones justo antes de
 * «Copyright Holder(s) and the Author(s)…» y «Copyright Holder. This restriction…»,
 * y la BSD lleva «COPYRIGHT HOLDERS» en la cláusula de garantía. Ninguno es un aviso.
 */
const AVISO_COPYRIGHT = /^(Copyright\s+(\([cC]\)|©|<?\d)|\([cC]\)\s|©\s)/

/**
 * Las líneas de copyright de un texto de licencia, sin repetir.
 *
 * @param {string} texto
 * @returns {string[]}
 */
export function lineasCopyright(texto) {
  const vistas = new Set()
  for (const linea of String(texto).split(/\r?\n/)) {
    const limpia = linea.trim()
    if (AVISO_COPYRIGHT.test(limpia)) vistas.add(limpia.replace(/`/g, ''))
  }
  return [...vistas]
}

/**
 * La licencia de un paquete, comprobada.
 *
 * @param {{nombre: string, version: string, licencia: unknown, texto: string}} paquete
 * @returns {{spdx: string, declarada?: string}}
 * @throws {Error}  Si la licencia no está en {@link SPDX_ADMITIDAS}, o si hay una
 *   corrección y el texto no la respalda. El mensaje dice qué hacer.
 */
function licenciaComprobada({ nombre, version, licencia, texto }) {
  const correccion = CORRECCIONES[`${nombre}@${version}`]
  if (correccion !== undefined) {
    if (licencia !== correccion.declarada || !texto.includes(correccion.prueba)) {
      throw new Error(
        `licencias: la corrección de ${nombre}@${version} ya no casa. Se esperaba que su ` +
          `package.json declarase «${correccion.declarada}» (declara ${JSON.stringify(licencia)}) y ` +
          `que su licencia dijera «${correccion.prueba}». Mira el fichero de licencia y rehaz ` +
          `CORRECCIONES en licencias/terceros.js.`,
      )
    }
    return { spdx: correccion.spdx, declarada: correccion.declarada }
  }
  if (typeof licencia !== 'string' || !SPDX_ADMITIDAS.includes(licencia)) {
    throw new Error(
      `licencias: ${nombre}@${version} va en el paquete con la licencia ` +
        `${JSON.stringify(licencia)}, que no está entre las admitidas ` +
        `(${SPDX_ADMITIDAS.join(', ')}). Si es una errata del package.json, añádela a ` +
        `CORRECCIONES con la frase de su LICENSE que lo prueba; si es otra licencia, alguien ` +
        `tiene que decidir si se puede distribuir antes de ampliar SPDX_ADMITIDAS.`,
    )
  }
  return { spdx: licencia }
}

/**
 * @typedef {object} Obra
 * @property {string} nombre
 * @property {string} [version]   Las fuentes no la llevan.
 * @property {string} spdx
 * @property {string} [declarada] Lo que decía el `package.json`, si se corrigió.
 * @property {string[]} copyright
 * @property {string} url
 * @property {string} texto       El texto completo de la licencia.
 */

/**
 * @typedef {object} Inventario
 * @property {Obra[]} paquetes  Por nombre.
 * @property {Obra[]} fuentes
 */

/**
 * El inventario de lo empaquetado.
 *
 * @param {object} entrada
 * @param {Array<{nombre: string, version: string, licencia: unknown, texto: string | null}>} entrada.paquetes
 *   Uno por paquete que aporta al menos un módulo. `licencia` es el campo `license`
 *   del `package.json`; `texto`, el de su fichero de licencia, o `null` si no trae.
 * @param {Array<{fuente: typeof FUENTES[number], texto: string}>} [entrada.fuentes]
 * @returns {Inventario}
 * @throws {Error}  Si un paquete no trae fichero de licencia o su licencia no se
 *   puede afirmar. Publicar sin el texto incumple justo lo que esto viene a cumplir.
 */
export function inventariar({ paquetes, fuentes = [] }) {
  // Una misma versión puede ir copiada en dos carpetas (anidada bajo dos padres).
  // Es la misma obra con la misma licencia: se cuenta una vez. Dos VERSIONES
  // distintas sí son dos entradas, porque pueden tener licencias distintas.
  const unicos = new Map()
  for (const p of paquetes) unicos.set(`${p.nombre}@${p.version}`, p)

  const obras = [...unicos.values()].map((p) => {
    if (typeof p.texto !== 'string' || p.texto.trim() === '') {
      throw new Error(
        `licencias: ${p.nombre}@${p.version} va en el paquete y no trae fichero de licencia. ` +
          `Sin su texto no se puede cumplir lo que pide; búscalo en su repositorio antes de publicar.`,
      )
    }
    return {
      nombre: p.nombre,
      version: p.version,
      ...licenciaComprobada({ ...p, texto: p.texto }),
      copyright: lineasCopyright(p.texto),
      url: `https://www.npmjs.com/package/${p.nombre}/v/${p.version}`,
      texto: p.texto.replace(/\r\n/g, '\n').trim(),
    }
  })
  const clave = (o) => `${o.nombre}@${o.version}`
  obras.sort((a, b) => (clave(a) < clave(b) ? -1 : clave(a) > clave(b) ? 1 : 0))

  return {
    paquetes: obras,
    fuentes: fuentes.map(({ fuente, texto }) => {
      const limpio = texto.replace(/\r\n/g, '\n')
      const desde = limpio.search(/^Copyright\b/m)
      if (desde === -1) {
        throw new Error(
          `licencias: ${fuente.licencia} no trae ninguna línea «Copyright»; el texto de la ` +
            `licencia de ${fuente.nombre} empieza ahí y sin ella no se sabe dónde.`,
        )
      }
      const verbatim = limpio.slice(desde).trim()
      return {
        nombre: fuente.nombre,
        spdx: fuente.spdx,
        copyright: lineasCopyright(verbatim),
        url: fuente.url,
        texto: verbatim,
      }
    }),
  }
}

/**
 * El aviso en texto plano, con el texto completo de cada licencia. **Sin fecha**: el
 * service worker versiona por contenido (`pwa/precache.js#versionDe`) y una fecha
 * haría que cada build pareciera un despliegue nuevo.
 *
 * @param {Inventario} inventario
 * @returns {string}
 */
export function componerAviso({ paquetes, fuentes }) {
  const raya = '-'.repeat(72)
  const bloque = (o) =>
    [
      raya,
      `${o.nombre}${o.version ? ` ${o.version}` : ''} — ${o.spdx}`,
      o.url,
      ...(o.declarada ? [`(su package.json dice «${o.declarada}»; el texto de abajo es ${o.spdx})`] : []),
      '',
      o.texto,
      '',
    ].join('\n')
  return [
    'Concreta GML — software y tipografías de terceros',
    '='.repeat(50),
    '',
    'Lo que va empaquetado en la aplicación y no es de este proyecto, con el texto',
    'completo de su licencia. El inventario lo saca el build de lo que de verdad lleva',
    'el paquete, no de una lista escrita a mano.',
    '',
    `${paquetes.length} paquetes de software (contando cada versión) y ` +
      `${fuentes.length} ${fuentes.length === 1 ? 'tipografía' : 'tipografías'}.`,
    '',
    ...paquetes.map(bloque),
    ...fuentes.map(bloque),
  ].join('\n')
}

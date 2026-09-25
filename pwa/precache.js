// pwa/precache.js — 2026-09-25 · Lo que el service worker se lleva al instalarse, y
// con qué versión.
//
// ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
// `storage/cuota.js` dejó MEDIDO que `navigator.storage.persist()` devuelve `false`, y
// escrito por qué: Chrome concede la persistencia a los sitios instalados como
// aplicación, marcados como favoritos o con interacción acumulada. Y la aplicación
// llevaba desde F10 aconsejando «instálala como aplicación» (`AVISO_SIN_PERSISTENCIA`)
// **sin poder instalarse**: no había manifiesto ni service worker. Un consejo que no se
// puede seguir es un botón gris y mudo escrito en prosa.
//
// Este módulo es la mitad de construcción de esa puerta: decide qué ficheros del
// artefacto se precachean y calcula una VERSIÓN a partir de su contenido, para que
// `vite.config.js` componga `sw.js` desde la plantilla `pwa/sw.js`.
//
// ── ⭐ POR QUÉ LA VERSIÓN SALE DEL CONTENIDO Y NO DE UN NÚMERO ───────────────
// El navegador solo reinstala un service worker cuando cambian los BYTES de su
// script. Una plantilla estática copiada tal cual sería idéntica en cada despliegue:
// el `install` no volvería a correr, la caché de la primera versión se quedaría para
// siempre y el modo sin conexión serviría una aplicación vieja. Con la versión
// derivada de lo que se precachea, cada despliegue que cambia algo cambia el script,
// y cada uno que no cambia nada no obliga a nadie a reinstalar.
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
// No lee disco ni conoce Vite: recibe rutas y contenidos. Así se prueba en el
// proyecto `node` sin construir nada, y el plugin de `vite.config.js` se queda en
// diez líneas de pegamento. No entra en el paquete del navegador: lo importan el
// plugin y las pruebas, nadie más.

import { createHash } from 'node:crypto'

/**
 * La marca de la plantilla que se sustituye por la lista. Es JavaScript válido tal
 * cual (un array vacío con un comentario delante), para que la plantilla se pueda
 * ejecutar sin componer —en las pruebas— y no precachee nada.
 */
export const MARCA_PRECACHE = '/* @gml-precache */ []'

/** Ídem para la versión: sin componer, la caché se llama `concreta-gml-dev`. */
export const MARCA_VERSION = "/* @gml-version */ 'dev'"

/**
 * La portada, relativa al alcance del service worker. **Sustituye a `index.html`**
 * en la lista: GitHub Pages sirve la aplicación en `/concretagml/` y no en
 * `/concretagml/index.html`, y la navegación que hay que poder atender sin conexión
 * es la primera. Precachear las dos sería guardar dos veces lo mismo con dos claves
 * que el service worker tendría que saber casar.
 */
export const PORTADA = './'

/** Lo que nunca se precachea: el propio script y los mapas de fuente. */
const EXCLUIDO = [/^sw\.js$/, /\.map$/]

/**
 * La lista de URL que se precachean, relativas al alcance, ordenadas y sin repetir.
 *
 * @param {string[]} rutas  Rutas del artefacto relativas a su raíz, con `/` (las de
 *   `bundle[*].fileName` y las de `public/`).
 * @returns {string[]}
 * @throws {TypeError}  Si `rutas` no es una lista de cadenas no vacías.
 */
export function listaPrecache(rutas) {
  if (!Array.isArray(rutas) || rutas.some((r) => typeof r !== 'string' || r === '')) {
    throw new TypeError('listaPrecache: se espera una lista de rutas relativas no vacías.')
  }
  const lista = new Set()
  for (const ruta of rutas) {
    const limpia = ruta.replace(/\\/g, '/').replace(/^\.?\//, '')
    if (EXCLUIDO.some((re) => re.test(limpia))) continue
    lista.add(limpia === 'index.html' ? PORTADA : limpia)
  }
  return [...lista].sort()
}

/**
 * Doce cifras hexadecimales de SHA-256 sobre las rutas Y los contenidos, en orden de
 * ruta. Entra la ruta porque renombrar un fichero sin tocarlo también es un cambio
 * que el service worker tiene que ver.
 *
 * @param {Array<[string, string|Uint8Array]>} ficheros
 * @returns {string}
 */
export function versionDe(ficheros) {
  const hash = createHash('sha256')
  for (const [ruta, contenido] of [...ficheros].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    hash.update(ruta)
    hash.update('\0')
    hash.update(contenido)
    hash.update('\0')
  }
  return hash.digest('hex').slice(0, 12)
}

/**
 * La plantilla con la lista y la versión puestas.
 *
 * @param {string} plantilla  El texto de `pwa/sw.js`.
 * @param {{precache: string[], version: string}} datos
 * @returns {string}
 * @throws {Error}  Si la plantilla no trae cada marca EXACTAMENTE una vez. Una marca
 *   que falta daría un service worker que no precachea nada —el modo sin conexión
 *   muerto, en silencio—, y eso tiene que reventar el build, no publicarse.
 */
export function componerServiceWorker(plantilla, { precache, version }) {
  for (const marca of [MARCA_PRECACHE, MARCA_VERSION]) {
    const veces = plantilla.split(marca).length - 1
    if (veces !== 1) {
      throw new Error(
        `componerServiceWorker: la plantilla pwa/sw.js debe traer «${marca}» exactamente una ` +
          `vez y la trae ${veces}. Sin ella el service worker saldría sin precache o sin versión.`,
      )
    }
  }
  return plantilla
    .replace(MARCA_PRECACHE, JSON.stringify(precache))
    .replace(MARCA_VERSION, JSON.stringify(version))
}

// viewer/atribucion.js — F03 · Visor. Textos legales de atribución cartográfica.
//
// Estos cuatro textos son OBLIGATORIOS por licencia (criterio de aceptación 5 de
// F03, spec §"Atribución obligatoria (legal)"): PNOA/IGN se ceden bajo CC-BY 4.0
// y exigen mención literal del titular; el Catastro exige "© Dirección General
// del Catastro" (Ley 37/2007 RISP); OSM exige "© OpenStreetMap contributors" bajo
// ODbL, CON enlace a la licencia. Omitir o reformular estos textos es un
// incumplimiento de licencia, no un detalle cosmético.
//
// Este módulo es la ÚNICA fuente de esos strings en todo el proyecto: nadie debe
// reescribirlos o parafrasearlos en `services/ign.js` ni en `viewer/wms-catastro.js`
// (ni en ningún otro sitio). Esos módulos importan `ATRIBUCION` de aquí y la pasan
// tal cual como `options.attribution` de la capa Leaflet correspondiente.
//
// ── QUIÉN PINTA LA ATRIBUCIÓN: DOS SITIOS, DOS MECANISMOS ───────────────────
//   · **EN EL VISOR manda el control NATIVO de Leaflet** (`L.Control.Attribution`,
//     que `viewer/mapa.js` fuerza con `attributionControl: true`). Él une,
//     deduplica y muestra/oculta según qué capa esté activa. El visor NO lleva
//     lógica propia de atribución y NO debe llevar un pie de página propio.
//   · **EN EL PDF de F09 no hay control de Leaflet**, y ahí sí hay que componer
//     la línea a mano: para eso —y SOLO para eso— existe
//     {@link atribucionCombinada}. Usarla para pintar un pie en el visor haría
//     que la atribución saliera DOS VECES (hallazgo 2.9 de la auditoría de
//     coherencia 2C.2). Que nadie de la Fase 3/4 la use para un pie de página.
//
// Fronteras de responsabilidad (SPEC §2):
//   · Regla 1 — Ningún error silencioso: `atribucionCombinada` con una clave
//     desconocida es un contrato roto por el PROGRAMADOR (no hay dato de usuario
//     en este módulo) → throw, nunca un texto vacío o adivinado.
//   · Este módulo NO importa Leaflet ni toca el DOM (a propósito: su test corre
//     en el proyecto Vitest `node`, lo que demuestra que es Leaflet-free).
//
// Nota para F16 (página de créditos) — Override O9 del dossier: Leaflet se
// distribuye bajo licencia BSD-2-Clause, NO MIT (Turf, jsPDF, html2canvas y
// proj4js sí son MIT). No es un texto de atribución de datos cartográficos, por
// eso NO vive en `ATRIBUCION`; queda anotado aquí para que F16 lo recoja.

/**
 * Textos literales de atribución cartográfica, verificados contra
 * MEJORES_PRACTICAS_GML.md §2.4/§5.5 y spec/feature-03-visor.md. NO reformular:
 * copiar/pegar tal cual al usarlos.
 */
export const ATRIBUCION = Object.freeze({
  PNOA: 'PNOA cedido por © Instituto Geográfico Nacional de España',
  IGN: '© Instituto Geográfico Nacional de España',
  CATASTRO: '© Dirección General del Catastro',
  // OSM exige mención + enlace a la licencia ODbL (spec: "con enlace"); el texto
  // base "© OpenStreetMap contributors" es el mismo de la fuente verificada, con
  // el enlace y la sigla de licencia añadidos para cumplir el requisito de enlace.
  OSM: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL)',
})

/**
 * Combina los textos de atribución de varias capas activas en una sola línea,
 * deduplicando textos repetidos (p. ej. dos capas del IGN activas a la vez no
 * repiten el texto) y uniendo con `' · '`.
 *
 * **PARA EL PIE DEL PDF DE F09**, donde no existe el control de atribución de
 * Leaflet y la línea hay que componerla a mano. **NO para el visor**: allí manda
 * `L.Control.Attribution`, que ya une y deduplica, y pintar además un pie propio
 * duplicaría la atribución en pantalla (ver la cabecera del módulo). Hoy su único
 * consumidor es su test; el consumidor real llega con F09.
 *
 * @param {string[]} claves  Claves de {@link ATRIBUCION}, en orden de aparición.
 * @returns {string}  Textos únicos unidos por `' · '`; `''` si `claves` está vacío.
 * @throws {TypeError}   Si `claves` no es un array (eso es la FORMA del argumento).
 * @throws {RangeError}  Si contiene una clave que no existe en {@link ATRIBUCION}
 *   (un valor fuera de un DOMINIO ENUMERADO: la misma política que
 *   `validation/_comun.js#crearHallazgo`, `services/ign.js#crearCapaWMTS`,
 *   `viewer/wms-catastro.js` y `viewer/sincronizacion.js`). Contrato roto por el
 *   programador en ambos casos — regla 1.
 */
export function atribucionCombinada(claves) {
  if (!Array.isArray(claves)) {
    throw new TypeError(
      `atribucionCombinada: 'claves' debe ser un array; recibido ${typeof claves}.`,
    )
  }
  const validas = Object.keys(ATRIBUCION)
  const textos = []
  const vistos = new Set()
  for (const clave of claves) {
    if (!Object.prototype.hasOwnProperty.call(ATRIBUCION, clave)) {
      throw new RangeError(
        `atribucionCombinada: clave de atribución desconocida: ${JSON.stringify(clave)}. ` +
          `Válidas: ${validas.join(', ')}.`,
      )
    }
    const texto = ATRIBUCION[clave]
    if (!vistos.has(texto)) {
      vistos.add(texto)
      textos.push(texto)
    }
  }
  return textos.join(' · ')
}

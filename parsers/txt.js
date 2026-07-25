// parsers/txt.js — F01 · Parser de volcados TXT de dos columnas (X Y).
//
// Vía secundaria de entrada del técnico (SPEC F01 §Parsers): un fichero de texto
// con una coordenada por línea en DOS columnas (Este Norte), tal cual lo exporta
// una libreta topográfica o un listado de vértices. El separador de COLUMNAS es
// libre (espacio, tab, coma, punto y coma) y el separador DECIMAL se autodetecta.
//
// Todo el trabajo pesado (tokenización, autodetección del decimal, corte por la
// palabra `separador`, descarte de Z, detecciones defensivas) vive en
// parsers/_comun.js#extraerPares y NO se reimplementa aquí (regla 6 + DRY): este
// módulo sólo fija el contrato de entrada (string, regla de oro 1) y estampa el
// `origen: 'TXT'` en el ResultadoParse.
//
// Fronteras (SPEC §2, iguales que _comun.js):
//   · Regla 1 — sin decisiones silenciosas: entrada no-string → TypeError; el
//     separador decimal elegido y cualquier Z descartada se materializan como
//     Deteccion (las emite extraerPares).
//   · Regla 3 — coordenadas UTM crudas [x, y]; nada de lat/lon.
//   · Regla 4 — el anillo se entrega CRUDO: NO se cierra, NO se normaliza, NO se
//     quita el vértice de cierre duplicado (aunque el fichero lo traiga) ni se
//     proyecta. El cierre/saneado es del orquestador aguas abajo (geo/cierre.js).
//
// La sutileza coma-decimal ↔ coma-columna la resuelve autodetectarSeparadorDecimal
// dentro de extraerPares: si el decimal es ',', la coma NUNCA se usa además como
// separador de columnas (las columnas quedan partidas por espacio/tab/';'); si el
// decimal es '.', la coma sí puede delimitar columnas. Aquí sólo se RESPETA.

import { extraerPares } from './_comun.js'
import { ORIGEN_PARCELA } from '../model/parcela.js'

/**
 * Parsea un volcado TXT de dos columnas (X Y) en un {@link ResultadoParse}.
 *
 * @param {string} texto  Contenido completo del fichero TXT. DEBE ser un string
 *   (regla de oro 1: entrada inválida no se corrige en silencio, se lanza).
 * @param {object} [opts]  Opciones reenviadas a {@link extraerPares}:
 * @param {','|'.'} [opts.separadorDecimal]  Fuerza el separador decimal; si se
 *   omite, se autodetecta (y se reporta cuál en una Deteccion SEPARADOR_DECIMAL).
 * @param {string} [opts.palabraSeparador='separador']  Palabra que, sola en su
 *   línea, corta un polígono del siguiente (misma convención que LIST).
 * @returns {{ anillos: number[][][], detecciones: import('./_comun.js').Deteccion[], origen: string }}
 *   `anillos` en UTM crudos (sin cerrar), `detecciones` (regla 1) y `origen:'TXT'`.
 * @throws {TypeError}   Si `texto` no es un string.
 * @throws {RangeError}  Si `opts.separadorDecimal` se aporta y no es ',' ni '.'.
 */
export function parseTXT(texto, opts = {}) {
  if (typeof texto !== 'string') {
    throw new TypeError(
      `parseTXT: se esperaba el contenido del fichero como string; recibido ${typeof texto}.`,
    )
  }

  const { anillos, detecciones } = extraerPares(texto, opts)

  return { anillos, detecciones, origen: ORIGEN_PARCELA.TXT }
}

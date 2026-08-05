// derivacion/operacion.js — F17 · tarea 3.x · QUÉ ACTO JURÍDICO es esto, y por qué
// la aplicación solo lo PROPONE.
//
// Módulo PURO y casi hoja: solo importa los dos namespaces de `identidad.js`, que
// es su vecino. Sin DOM, sin Leaflet, sin turf, sin red, sin estado y sin reloj.
//
// ── EL DATO MÁS FRÁGIL DE TODO EL EXPEDIENTE (override O20) ─────────────────
// Antes de emitir el IVG, la Sede EXIGE elegir «Tipo de operación» en un
// desplegable de **exactamente dos** opciones —Segregación y Subsanación—, medidas
// el 2026-08-03. Y es **el único dato del expediente con redundancia cero**:
//
//   · la Sede **no lo mira**: cuando se elige, ya ha validado la geometría;
//   · el `.gml` **no lo lleva dentro**: el campo no existe en el fichero;
//   · el informe de F09 **no lo nombra**: se titula «Informe de contraste con el
//     parcelario catastral», que es lo que MIDE, no lo que se DECLARA.
//
// ⛔ Y ser declarativo lo vuelve MÁS grave, no menos: si la Sede lo comprobara, un
// valor equivocado se descubriría en el acto —rechazo, corrección, seguir—. Como no
// lo comprueba nadie, un valor equivocado produce **un IVG positivo con la etiqueta
// mal puesta**, firmado y con su CSV, nombrando el acto jurídico que no es.
//
// ── POR QUÉ SE DEDUCE DE LA FORMA DEL FICHERO ───────────────────────────────
// Las dos opciones no son una taxonomía de alteraciones catastrales —no hay
// agrupación, ni división, ni rectificación de linderos—: son **dos**, y cada una
// se corresponde con una de las dos formas de fichero que esta aplicación sabe
// producir, **las dos ya aceptadas con certificado** (`spec/SPEC.md` §7.2):
//
//   Subsanación  ← UN `gml:featureMember`, la referencia propia bajo `ES.SDGC.CP`
//                  (verificado el 2026-07-27)
//   Segregación  ← DOS O MÁS miembros, con al menos un alta bajo `ES.LOCAL.CP`
//                  (verificado el 2026-08-03, CSV `XMWPXCN9J8DB9J89`)
//
// ⛔ **Y el flujo principal de esta aplicación era una Subsanación que no se
// nombraba en ninguna capa.** F06 (editar el lindero) → F07 (diagnosticar) → F09
// (informe) es exactamente eso, y la palabra no aparecía en el proyecto. El hueco
// no estaba en el futuro: estaba en el caso de uso más frecuente.
//
// ── ⚠️ PROPONE, NO DECIDE (regla de oro 9) ──────────────────────────────────
// `propuesto` vale SIEMPRE `true` y no hay forma de que valga otra cosa. Esta
// función no sabe qué acto jurídico está haciendo el colegiado: sabe qué FORMA
// tiene el fichero, que es otra cosa. Un mismo fichero de dos miembros puede ser
// una segregación o la subsanación de una discrepancia que además libera un trozo,
// y quién lo decide firma. La aplicación mide y propone; se deja cambiar y se
// imprime.
//
// ── ⛔ Y CUANDO LA FORMA NO ES NINGUNA DE LAS DOS MEDIDAS, SE DICE ───────────
// `formaMedida` distingue «esta forma es una de las dos que se han presentado y
// aceptado» de «esto se parece a una de ellas». Y cuando ni siquiera se parece
// —dos o más miembros y ninguno de alta— **`tipo` sale `null`**: proponer ahí sería
// inventarse la etiqueta más consecuente del expediente a partir de un caso que
// nadie ha probado. Un desplegable sin nada preseleccionado obliga a elegir, que es
// exactamente lo que hay que hacer cuando no se sabe.

import { NAMESPACE_CATASTRO, NAMESPACE_LOCAL } from './identidad.js'

/**
 * Las DOS opciones del desplegable de la Sede. No hay una tercera: está medido
 * (`spec/SPEC.md` §7.2, override O20), y por eso el catálogo se puede cerrar sin
 * miedo a que la realidad traiga una cuarta forma.
 *
 * @readonly
 */
export const TIPO_OPERACION = Object.freeze({
  SUBSANACION: 'SUBSANACION',
  SEGREGACION: 'SEGREGACION',
})

/**
 * Cómo se escribe cada una en un papel. **Con tilde y en singular**, que es como
 * aparecen en el desplegable de la Sede: el informe y la Sede tienen que decir la
 * misma palabra para que se puedan cotejar de un vistazo.
 *
 * @readonly
 */
export const ROTULO_OPERACION = Object.freeze({
  [TIPO_OPERACION.SUBSANACION]: 'Subsanación',
  [TIPO_OPERACION.SEGREGACION]: 'Segregación',
})

/**
 * La marca de los tres candados que F09 estrenó para «presumiblemente con vía
 * pública», y por el mismo motivo: es la frase que el lector copia, así que las
 * tres advertencias tienen que viajar DENTRO de ella y no en una nota al pie que se
 * quede atrás al recortar.
 *
 * Aquí el matiz es distinto y más fuerte que en aquélla: allí la aplicación
 * presumía un hecho del terreno; aquí no presume nada —la forma del fichero es un
 * hecho— pero **el acto jurídico no se sigue de la forma**, y quien lo declara ante
 * la Sede responde de ello.
 *
 * @readonly
 */
export const AVISO_DECLARATIVO =
  'Dato DECLARATIVO, no medido: lo elige quien presenta y esta aplicación solo lo propone a ' +
  'partir de la forma del fichero. No viaja dentro del .gml y la Sede no lo comprueba, así que ' +
  'un valor equivocado no lo caza nadie. Confírmelo en la Sede antes de emitir.'

/**
 * Lo que devuelve {@link tipoDeOperacion}.
 *
 * @typedef {Object} OperacionPropuesta
 * @property {'SUBSANACION'|'SEGREGACION'|null} tipo  `null` = la forma del fichero
 *   no se parece a ninguna de las dos medidas, y **proponer sería inventar**.
 * @property {string} porQue  En castellano y con las cifras dentro, para enseñarlo
 *   junto al desplegable: quien elige tiene que ver de dónde sale la propuesta.
 * @property {true} propuesto  SIEMPRE. Ver la cabecera (regla de oro 9).
 * @property {boolean} formaMedida  `true` si la forma del fichero es exactamente
 *   una de las dos que se han presentado en la Sede y han vuelto con IVG positivo.
 * @property {number} miembros  Cuántas parcelas lleva el fichero.
 * @property {number} altas  Cuántas van bajo `ES.LOCAL.CP` (parcelas que el
 *   Catastro todavía no tiene).
 */

/**
 * Propone el «Tipo de operación» a partir de la FORMA del fichero que la aplicación
 * acaba de escribir.
 *
 * @param {Array<{namespaceInspire?: string}>} parcelas  Las identidades de los
 *   miembros, tal como salen de `derivacion/identidad.js` o del `resumen` de
 *   `gml/serialize-cp.js#serializarExpedienteCp` (`{namespaces}` esparcido). Solo
 *   se lee `namespaceInspire`; lo demás se ignora.
 * @returns {OperacionPropuesta}
 * @throws {TypeError} Si `parcelas` no es un array NO vacío: un fichero de cero
 *   parcelas no tiene tipo de operación, y devolver uno sería inventárselo.
 */
export function tipoDeOperacion(parcelas) {
  if (!Array.isArray(parcelas) || parcelas.length === 0) {
    throw new TypeError(
      `tipoDeOperacion: 'parcelas' debe ser un array NO vacío de identidades ` +
        `({namespaceInspire}); recibido ${JSON.stringify(parcelas)}. Un fichero sin parcelas no ` +
        'declara ninguna operación.',
    )
  }

  const miembros = parcelas.length
  const altas = parcelas.filter((p) => p?.namespaceInspire === NAMESPACE_LOCAL).length
  const inscritas = parcelas.filter((p) => p?.namespaceInspire === NAMESPACE_CATASTRO).length

  if (miembros === 1) {
    // Una sola parcela: lo que la Sede llama Subsanación. La forma MEDIDA es con la
    // referencia propia bajo `ES.SDGC.CP`; un alta suelta bajo `ES.LOCAL.CP` es
    // también un miembro único, pero **no es la forma que se presentó**.
    const medida = inscritas === 1
    return {
      tipo: TIPO_OPERACION.SUBSANACION,
      propuesto: true,
      formaMedida: medida,
      miembros,
      altas,
      porQue: medida
        ? 'El fichero lleva una sola parcela y es una finca que el Catastro ya tiene, así que ' +
          'lo que se corrige es su geometría: eso es una Subsanación. Es la forma que la Sede ' +
          'aceptó el 27 de julio de 2026.'
        : 'El fichero lleva una sola parcela, y con un miembro la Sede solo ofrece Subsanación. ' +
          '⚠️ Pero esta parcela va como alta (no consta en el Catastro), y esa combinación NO se ' +
          'ha presentado nunca: revísela antes de emitir.',
    }
  }

  if (altas === 0) {
    // ⛔ Dos o más miembros y ninguno de alta. No es la forma de la Segregación
    // medida —que lleva al menos una parcela nueva— ni cabe en «Subsanación», que
    // es de una sola. Esta aplicación no puede producirla hoy (toda cesión sale
    // bajo `ES.LOCAL.CP`), y si algún día la produce, quien firme elige.
    return {
      tipo: null,
      propuesto: true,
      formaMedida: false,
      miembros,
      altas,
      porQue:
        `El fichero lleva ${miembros} parcelas y todas constan ya en el Catastro: ninguna es un ` +
        'alta. Esa forma no se corresponde con ninguna de las dos que se han presentado en la ' +
        'Sede, así que la aplicación no propone ninguna. Elíjala usted.',
    }
  }

  return {
    tipo: TIPO_OPERACION.SEGREGACION,
    propuesto: true,
    formaMedida: true,
    miembros,
    altas,
    porQue:
      `El fichero lleva ${miembros} parcelas y ${altas === 1 ? 'una es' : `${altas} son`} un alta ` +
      'que el Catastro todavía no tiene: se está desgajando superficie de una finca para ' +
      'formar otra, y eso es una Segregación. Es la forma que la Sede aceptó el 3 de agosto ' +
      'de 2026.',
  }
}

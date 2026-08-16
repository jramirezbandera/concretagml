// app/cableado-informe.js — F09 · T5.1. EL CABLE del informe firmable en PDF.
//
// Todas las piezas de F09 estaban escritas y en verde antes que este fichero, y
// ninguna se conocía entre sí: `report/encuadre.js` sabe encuadrar,
// `report/canvas.js` sabe pedirle cartografía al WMS y dibujar encima,
// `report/literal.js` sabe redactar el lindero, `report/firma.js` sabe qué se
// imprime y qué se sustituye, `report/pdf-parcela.js` sabe maquetar y
// `app/dialogo-informe.js` sabe recoger lo que el usuario corrige. Esto es lo que
// las junta, igual que `cablearDiagnostico` juntó las de F07.
//
// ── EL RECORRIDO, EN ORDEN ──────────────────────────────────────────────────
//
//   1. **«Preparar informe (PDF)»** en el pie del cajón de diagnóstico
//      (`cajon.alPreparar`). El botón lo enciende y lo apaga el MISMO gate que al
//      de texto: hay diagnóstico enseñándose, o no hay informe que preparar.
//   2. **Los descriptivos** (`services/catastro.js#descriptivosPorRefcat`, el
//      contrato E). **Una petición por expediente**, cacheada aquí además de en
//      la capa de servicios: es el presupuesto de red entero de F09 (+1).
//   3. **El diálogo**, con el encabezado compuesto, el lindero ya redactado y la
//      firma que el navegador recordara.
//   4. **«Componer PDF»** → encuadrar → componer el plano (RED) → maquetar →
//      entregar los bytes con `gml/descargar.js#descargarBinario`.
//
// ── LAS CUATRO COSAS DE LAS QUE ESTE MÓDULO ES DUEÑO ────────────────────────
//
//   1. **EL RELOJ.** `report/` tiene prohibido leerlo —hay guardianes por grep
//      sobre `firma.js`, `literal.js`, `encuadre.js`, `pdf.js` y
//      `pdf-parcela.js`— por la misma razón que `gml/`: un informe descargado es
//      un snapshot y tiene que valer lo mismo dentro de un año. Quien sí puede
//      leerlo es este cableado, y lo hace por `ahora()`, inyectable. De ese
//      instante salen la fecha del encabezado Y el `idDocumento`, que se componen
//      AQUÍ y se inyectan hacia abajo.
//   2. **LA PROCEDENCIA.** Ver el bloque de abajo: es la diferencia entre un
//      documento exacto y uno que miente en silencio.
//   3. **LA DEGRADACIÓN DEL PLANO.** Ver el bloque de abajo.
//   4. **LA IDENTIDAD DEL DOCUMENTO.** Lo que se prepara es un documento
//      CONCRETO: una parcela, un instante, un identificador. Si el store cambia
//      —otra parcela, o la misma editada— el diálogo se CIERRA y se dice por qué
//      (ver {@link cablearInforme}, `alCambiarElStore`). Dejarlo abierto sería
//      ofrecer firmar un papel que describe algo que ya no está en pantalla.
//      ⚠️ **Y la garantía cubre las DOS mitades** (auditoría 2026-08-16): cerrar
//      solo protege lo que pasa después de abrir, y entre la foto del store y
//      `vista.abrir()` hay dos `await` —la consulta DNPRC y el pie de firma— por
//      los que un cambio se colaba sin efecto, porque `alCambiarElStore` sale por
//      arriba mientras no hay nada `preparado`. Esa ventana se cierra con un token
//      de cambios del store: si se movió, **el diálogo no se abre** y se dice
//      ({@link MOTIVO_PREPARACION_SUPERADA}).
//      Lo mismo vale para las VECINAS, que entran por un canal asíncrono ajeno:
//      se cotejan con la parcela que hay en pantalla antes de adoptarse (ver
//      `adoptarVecinas`), o el lindero se atribuiría con las referencias
//      catastrales de otra finca.
//
// ── ⚠️ LA PROCEDENCIA SE PROPAGA, O EL INFORME MIENTE ───────────────────────
// `report/firma.js#lineasEncabezado` escribe TRES cosas distintas donde no hay
// dato, y son tres afirmaciones distintas:
//
//     «No consta»                  el Catastro contestó y no trae ese campo
//     «No se ha consultado»        nadie le preguntó
//     «No se ha podido consultar»  se le preguntó y no contestó (+ el motivo)
//
// El valor por defecto de `procedencia` es `null`, o sea **«no se ha
// consultado»**, que es lo prudente cuando de verdad no se consultó. Pero si este
// cableado consulta el DNPRC y NO propaga `procedenciaDescriptivos(descriptivos)`
// hasta el diálogo y hasta `informePdfParcela`, el PDF imprime «No se ha
// consultado» en campos que **sí** se consultaron y que sencillamente no venían
// —el caso REAL de la parcela urbana de referencia, donde el servicio no trae
// paraje, polígono, parcela ni domicilio—. En un documento que alguien firma eso
// es una inexactitud silenciosa: dice algo falso sobre lo que la herramienta
// hizo. Está MEDIDO: con procedencia sale «No consta»; sin ella, «No se ha
// consultado». Hay un test que lo fija.
//
// ── ⚠️ SIN PLANO SE OFRECE EL INFORME IGUAL, Y SE DICE ──────────────────────
// El plano es la única pieza del informe que va a la RED (una `GetMap` de ~200 kB
// al WMS del Catastro, a 300 ppp) y por tanto la única que puede caerse sin que
// nadie tenga la culpa. La decisión, con su porqué:
//
//   · **Si el plano no se puede componer, el informe se compone SIN él.** No se
//     cancela la operación. Tres razones, en orden de peso:
//       (a) `report/pdf-parcela.js` admite `plano: null` **por contrato** y emite
//           la sección diciendo que no se pudo componer: la pieza está preparada
//           para este caso, no se está forzando nada.
//       (b) Las otras seis secciones —encabezado, vértices, diagnóstico, lindero,
//           procedencia del fichero y firma— **no dependen de la red** y son la
//           mayor parte del documento. Negarse a entregarlas porque un servicio
//           externo no contesta sería castigar al usuario por algo que no ha
//           hecho, y es exactamente la doctrina que F07 fijó con las colindantes
//           («un fallo de red no puede tumbar las ocho medidas que no dependen de
//           la red») y que F09 repitió al conservar el informe de TEXTO: degradar
//           no es quitar.
//       (c) El usuario ve el papel y decide. Lo que no puede pasar —y es lo único
//           inaceptable— es que se componga **en silencio** uno mudo.
//   · **Y se dice por TRES canales**, no por uno: el renglón del diálogo antes de
//     bajar, el panel de avisos con el motivo técnico, y **el propio PDF**, que
//     lleva escrito en su sitio que el plano no se pudo componer. El tercero es
//     el que importa: es el único que sobrevive a que alguien reenvíe el fichero.
//   · **Una capa caída no es lo mismo que un plano caído.** Si el WMS sirve la
//     ortofoto pero no el parcelario, `componerPlano` apaga esa capa y lo anota en
//     `plano.capasCaidas`; `informePdfParcela` lo convierte en `incidencias` y lo
//     imprime bajo el plano. Aquí se relaya al panel: un plano al que le falta una
//     capa se parece demasiado a uno completo como para que el usuario lo note.
//
// ── POR QUÉ EL DIAGNÓSTICO ENTRA Y NO SE RECALCULA ──────────────────────────
// `diagnostico` es una FUNCIÓN inyectada, y en la app la ata `app/main.js` al
// `ultimoDiagnostico()` de `cablearDiagnostico`: **el mismo objeto que el cajón
// está enseñando**. Recalcularlo aquí costaría ~67 ms de bloqueo con el usuario
// esperando y, sobre todo, abriría una SEGUNDA verdad sobre el mismo expediente
// —habría que reproducir la superficie registral, la clase, las vecinas y la
// traducción `ParcelaGml → Vecina`— con dos sitios donde equivocarse. La
// invariante que F08 fijó sigue siendo la misma: **el informe dice exactamente lo
// que dice el cajón del que salió**.
//
// ── LO QUE ESTE MÓDULO **NO** HACE ─────────────────────────────────────────
//   · **No fabrica marcado de la cáscara.** `index.html` no se toca en F09: el
//     `<dialog>` lo fabrica `app/dialogo-informe.js` y los dos botones del pie los
//     fabrica `viewer/cajon-diagnostico.js`.
//   · **No importa Leaflet ni toca el mapa.** El cajón entra ya construido y se le
//     habla por sus tres métodos (`alPreparar`, `estadoInforme`, `pintar`).
//   · **No decide si el encaje es bueno, ni si el informe es presentable.**
//     Traslada cifras y las pone en un papel (regla de oro 9).
//   · **No pide colindantes.** Se SUSCRIBE a las que traiga F05 (`alColindantes`,
//     que es un `Set` con baja precisamente para esto). El presupuesto de red de
//     F09 es +1 petición y este módulo la gasta en el DNPRC, no en repetir una
//     consulta que el cajón del diagnóstico ya hizo.
//
// Su test es `test/app/informe.dom.test.js`, con sufijo `.dom`: toca el DOM.

import { identidadDeParcela } from '../derivacion/identidad.js'
import { tipoDeOperacion } from '../derivacion/operacion.js'
import { TIPO_MIME_PDF, descargarBinario } from '../gml/descargar.js'
import { componerPlano } from '../report/canvas.js'
import { encuadrar } from '../report/encuadre.js'
import {
  componerEncabezado,
  componerIdDocumento,
  procedenciaDescriptivos,
} from '../report/firma.js'
import { describirLindero } from '../report/literal.js'
import { informePdfParcela } from '../report/pdf-parcela.js'
import { NIVEL } from '../viewer/_comun.js'
import { traducirColindantes } from './colindantes.js'
import { crearDialogoInforme } from './dialogo-informe.js'

// ── El tamaño del plano en el papel ──────────────────────────────────────────

/**
 * Ancho del plano sobre el papel, en milímetros. 180 mm es el ancho ÚTIL de un
 * A4 con los márgenes de `report/pdf-parcela.js` (210 − 15 − 15), así que el
 * plano ocupa la caja entera y no queda un canalón raro a un lado.
 *
 * A 300 ppp son 2126 px, por debajo del techo de 4000 px por dimensión que tiene
 * medido el WMS del Catastro: **la ruta normal es UNA sola `GetMap`**. El
 * troceado de `report/encuadre.js` existe para las geometrías que no caben, no
 * para este caso.
 *
 * @readonly
 */
export const ANCHO_PLANO_MM = 180

/**
 * Alto del plano sobre el papel, en milímetros. 130 mm deja sitio en la misma
 * página para el encabezado y para el pie de escala sin obligar a un salto.
 *
 * La relación 180×130 **no deforma nada**: `encuadrar` ajusta la caja del terreno
 * a esta relación añadiendo aire por el lado que sobra, nunca estirando.
 *
 * @readonly
 */
export const ALTO_PLANO_MM = 130

// ── Vocabulario de cara al usuario (regla de oro 9 y regla de oro 1) ─────────

/**
 * Lo que se escribe mientras se preparan los datos del informe. **Un botón que se
 * queda pensando es un error silencioso**: entre pulsar y ver el diálogo hay una
 * petición al Catastro, y sin este renglón el usuario no tiene forma de saber si
 * la aplicación le ha hecho caso.
 */
export const MENSAJE_PREPARANDO =
  'Preparando el informe: consultando al Catastro los datos descriptivos de la parcela…'

/**
 * Lo que se escribe mientras se compone el PDF. Es la espera LARGA del recorrido
 * —el plano se pide a 300 ppp y son ~200 kB de cartografía— y por eso dice
 * también cuánto puede tardar: una espera anunciada se aguanta; una espera muda
 * se interpreta como que la aplicación se ha colgado.
 */
export const MENSAJE_COMPONIENDO =
  'Componiendo el PDF: se está pidiendo el plano al Catastro a 300 puntos por pulgada. ' +
  'Puede tardar unos segundos.'

/** Segunda pulsación con una preparación ya en marcha. No se encolan dos. */
export const MENSAJE_YA_PREPARANDO =
  'El informe ya se está preparando; espere a que se abra el diálogo.'

/** Segunda pulsación con una composición ya en marcha. */
export const MENSAJE_YA_COMPONIENDO =
  'El PDF ya se está componiendo; espere a que termine.'

/**
 * No hay referencia catastral con la que preguntar. **No es un fallo**: es un alta
 * de particular o una parcela dibujada, y el informe se prepara igual con el
 * encabezado a «No se ha consultado» — que es exactamente lo que ha pasado.
 */
export const MOTIVO_SIN_REFCAT =
  'No se han consultado los datos descriptivos del Catastro: esta parcela no tiene referencia ' +
  'catastral, y la consulta se hace por referencia. El informe se prepara igual; los campos del ' +
  'encabezado que vienen del Catastro quedarán sin dato.'

/**
 * No hay a quién preguntarle. Gemelo de `MOTIVO_SIN_CATASTRO` de F07: un visor
 * montado sin el cliente del Catastro es un uso legítimo, no una degradación
 * callada.
 */
export const MOTIVO_SIN_CLIENTE =
  'No se han consultado los datos descriptivos del Catastro: esta pantalla no tiene conectado el ' +
  'cliente del servicio. El informe se prepara igual; los campos del encabezado que vienen del ' +
  'Catastro quedarán sin dato.'

/** La consulta salió y no trajo dato. El detalle lo pone el servicio. */
export const MOTIVO_DESCRIPTIVOS_SIN_DATO =
  'Los datos descriptivos del Catastro no se han podido consultar. El informe se prepara igual y ' +
  'lo dice donde corresponde, en vez de dar por vacíos unos campos que no se han podido leer.'

/** La consulta contestó con los siete campos del contrato E. */
export const ACUSE_DESCRIPTIVOS =
  'Datos descriptivos traídos del Catastro. Repáselos en el encabezado: lo que quede escrito es ' +
  'lo que se imprime.'

/**
 * Clave de motivo con la que se envuelve un fallo INESPERADO del cliente del
 * Catastro para que siga cabiendo en el sobre del contrato E. Los del catálogo
 * salen por `ok:false` con su propio motivo; esto es para lo que revienta.
 */
export const MOTIVO_DESCRIPTIVOS_ROTO = 'CONSULTA_INTERRUMPIDA'

/** Su mensaje, que acaba impreso bajo los campos vacíos del encabezado. */
export const MENSAJE_DESCRIPTIVOS_ROTO =
  'La consulta de los datos descriptivos se ha interrumpido por un fallo interno de la ' +
  'aplicación. El detalle técnico está en la consola del navegador.'

/**
 * Fallo PREPARANDO el informe: no se ha llegado a abrir el diálogo. Mismas tres
 * piezas que `MENSAJE_FALLO_INESPERADO` de `app/main.js` y de los otros tres
 * cableados: qué ha pasado, que no se ha cambiado nada, y dónde está el detalle.
 */
export const MENSAJE_INFORME_NO_PREPARADO =
  'El informe no se ha podido preparar por un fallo interno de la aplicación; no se ha ' +
  'cambiado nada de la parcela. El detalle técnico está en la consola del navegador.'

/**
 * El plano no se ha podido componer. **No cancela el informe** (ver la cabecera):
 * se avisa, y el PDF sale sin plano diciéndolo en su propia sección.
 */
export const MENSAJE_PLANO_NO_COMPUESTO =
  'El plano de situación no se ha podido componer: la cartografía del Catastro no ha llegado o ' +
  'el navegador no ha podido dibujarla. El informe se compone SIN plano y lo dice en su sitio; ' +
  'el resto del documento no depende de la red. El detalle técnico está en la consola del ' +
  'navegador.'

/** Su versión corta, para el renglón del diálogo. */
export const AVISO_SIN_PLANO = 'El informe se ha compuesto SIN plano. Mira el panel de avisos.'

/**
 * Fallo MAQUETANDO. Se distingue del de la entrega porque llevan a acciones
 * distintas: aquí el fichero no llegó a existir, allí existe y no bajó. Misma
 * distinción que hace `app/cableado-diagnostico.js` con el informe de texto y
 * `app/main.js` con el GML.
 */
export const MENSAJE_PDF_NO_COMPUESTO =
  'El PDF del informe no se ha podido componer por un fallo interno de la aplicación; no se ha ' +
  'descargado nada y no se ha cambiado nada de la parcela. El detalle técnico está en la consola ' +
  'del navegador.'

/** Fallo ENTREGANDO: el PDF se compuso entero y lo que falló fue el navegador. */
export const MENSAJE_PDF_NO_ENTREGADO =
  'El PDF del informe se ha compuesto, pero el navegador no ha podido entregarlo. Vuelve a ' +
  'intentarlo; el detalle técnico está en la consola del navegador.'

/** El store ha cambiado con el diálogo abierto. Ver la cabecera, dueño 4. */
export const MOTIVO_CIERRE_POR_CAMBIO =
  'Se ha cerrado el diálogo «Preparar informe»: la parcela ha cambiado desde que se preparó, y ' +
  'el documento describía la anterior. Vuelva a pulsar «Preparar informe (PDF)».'

/**
 * El store ha cambiado **mientras se preparaba**, o sea antes de que el diálogo
 * llegara a abrirse. Es el hermano de {@link MOTIVO_CIERRE_POR_CAMBIO} para la
 * otra mitad de la garantía; ver la cabecera, dueño 4.
 */
export const MOTIVO_PREPARACION_SUPERADA =
  'No se ha abierto el diálogo «Preparar informe»: la parcela ha cambiado mientras se preparaba ' +
  'el documento, y lo que se había recogido describía la anterior. Vuelva a pulsar «Preparar ' +
  'informe (PDF)».'

/** «Regenerar» ha traído un borrador distinto porque llegaron datos nuevos. */
export const AVISO_BORRADOR_ACTUALIZADO =
  'El borrador se ha vuelto a redactar con los datos que hay ahora: ha cambiado respecto al que ' +
  'se abrió con el diálogo.'

/** El usuario se ha echado atrás. Se dice, no se calla. */
export const ACUSE_CANCELADO =
  'No se ha compuesto ningún PDF: se ha cerrado el diálogo «Preparar informe».'

// ── Lecturas del modelo ──────────────────────────────────────────────────────

/**
 * Los recintos del POJO que haya en el store. El store admite `null` (su valor
 * inicial documentado) y cualquier POJO sin validarlo. Mismo criterio —y mismo
 * cuerpo— que `cableado-diagnostico.js#recintosDe`; son cuatro líneas y siguen
 * siendo dos copias porque exportarlas ataría los dos cableados por un detalle
 * que ninguno de los dos posee.
 *
 * @param {object|null} parcelaActual
 * @returns {Array<{vertices: Array<[number, number]>, tipo: string}>}
 */
function recintosDe(parcelaActual) {
  const recintos =
    parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.recintos
  return Array.isArray(recintos) ? recintos : []
}

/**
 * El contorno OFICIAL del POJO, o `null`. `null` y un array VACÍO se tratan igual
 * —no hay contorno que dibujar— y así llega a `componerPlano`, que distingue
 * `null` («no se dibuja») de `[]` («se miró y no hay»).
 *
 * @param {object|null} parcelaActual
 * @returns {Array|null}
 */
function oficialDe(parcelaActual) {
  const oficial =
    parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.geometriaOficial
  return Array.isArray(oficial) && oficial.length > 0 ? oficial : null
}

/**
 * La referencia catastral del POJO, o `null`. La cadena vacía y la cadena en
 * blanco valen `null`: es el caso REAL de `UTM_1.gml` y de la plantilla oficial
 * del Catastro, donde el elemento está y viene VACÍO.
 *
 * @param {object|null} parcelaActual
 * @returns {string|null}
 */
function referenciaDe(parcelaActual) {
  if (parcelaActual === null || parcelaActual === undefined) return null
  const refcat = typeof parcelaActual.refcat === 'string' ? parcelaActual.refcat : ''
  return refcat.trim() === '' ? null : refcat
}

/**
 * Qué PARCELA es esta, a efectos de «¿ha entrado otra?». Gemelo del de F07: la
 * referencia catastral primero y el `idLocal` como respaldo, porque los dos
 * sobreviven a las ediciones. La identidad del OBJETO no vale: cada operación de
 * edición produce uno nuevo.
 *
 * @param {object|null} parcelaActual
 * @returns {string|null}
 */
function claveDeExpediente(parcelaActual) {
  if (parcelaActual === null || parcelaActual === undefined) return null
  const refcat = typeof parcelaActual.refcat === 'string' ? parcelaActual.refcat.trim() : ''
  if (refcat !== '') return `refcat:${refcat.toUpperCase()}`
  const idLocal = typeof parcelaActual.idLocal === 'string' ? parcelaActual.idLocal : ''
  return idLocal === '' ? null : `idLocal:${idLocal}`
}

/**
 * De qué expediente son las vecinas que trae un resultado del Catastro, **según
 * el propio resultado**, o `null` si no lo declara. Gemelo del de
 * `cableado-diagnostico.js`, y sigue siendo dos copias por lo mismo que
 * {@link recintosDe}: son cinco líneas que ninguno de los dos cableados posee.
 *
 * `parcelaYColindantes` devuelve `{propia, colindantes}` y la `propia` es la
 * parcela que se pidió, separada por referencia catastral normalizada (override
 * O15). Es la única identidad que el resultado lleva encima.
 *
 * ⚠️ **Puede venir `null` y eso NO es un fallo**: hay parcelas para las que
 * `GetNeighbourParcel` se omite a sí misma (medido el 2026-08-15 en
 * `8081401TF9288S`). Cuando el resultado no declara identidad se adopta, que es
 * lo que se venía haciendo: este cableado **no pide** las vecinas —se cuelga de
 * la consulta que hace el cajón del diagnóstico— así que no tiene ninguna otra
 * fuente con la que cotejar, y descartar por no poder comprobar dejaría el
 * lindero sin atribuir para siempre y sin decir por qué.
 *
 * @param {object|null} resultado
 * @returns {string|null}
 */
function claveDelResultado(resultado) {
  const propia = resultado?.datos?.propia
  if (propia === null || propia === undefined || typeof propia !== 'object') return null
  const refcat = typeof propia.refcat === 'string' ? propia.refcat.trim() : ''
  return refcat === '' ? null : `refcat:${refcat.toUpperCase()}`
}

/**
 * `ParcelaGml[]` → `VecinaLiteral[]`, que es lo que come `report/literal.js`.
 *
 * NO es la misma traducción que la de `cableado-diagnostico.js#aVecinas`, y por eso
 * no se comparte: aquélla produce la `Vecina` de `diagnostico/_comun.js` (refcat +
 * recintos, que es lo que hace falta para medir una invasión) y ésta arrastra
 * además el **`cp:label`**, que es lo único que el parcelario dice de un
 * colindante sin gastar otra petición y lo que permite escribir «linda con la
 * parcela rotulada “16”» cuando no hay referencia catastral.
 *
 * Una vecina SIN recintos se deja pasar con `recintos: []`: `describirLindero` la
 * anota en `saltados` con su motivo, y descartarla aquí la haría desaparecer sin
 * dejar rastro.
 *
 * @param {Array<object>} parcelas
 * @returns {Array<{refcat: string|null, label: string|null, recintos: Array}>}
 */
// ⚠️ **Ya no se traduce aquí.** Tenía una gemela en `app/cableado-diagnostico.js`
// que discrepaba en el recorte del `refcat`. La única vive en
// `app/colindantes.js#traducirColindantes`, y emite exactamente los tres campos que
// este módulo necesitaba —`label` entre ellos—, así que el cambio es de sitio y no
// de forma.
const aVecinasLiteral = traducirColindantes

/**
 * Parte el texto del `<textarea>` en párrafos. Un párrafo es lo que hay entre dos
 * líneas en blanco, que es exactamente como `report/literal.js` los junta
 * (`[...lindero, ...notaTecnica].join('\n\n')`), así que partir por ahí es la
 * operación inversa y no una heurística.
 *
 * @param {string} texto
 * @returns {string[]}
 */
function enParrafos(texto) {
  return String(texto)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '')
}

// ── Contratos de las dependencias ────────────────────────────────────────────

/** ¿Sirve como store? DUCK TYPING, igual que en `viewer/index.js#esStore`. */
const esStore = (v) => !!v && typeof v.get === 'function' && typeof v.subscribe === 'function'

/**
 * ¿Es el cajón de `viewer/cajon-diagnostico.js`? Se comprueba **lo que este
 * módulo usa**, que son tres cosas y no las doce que comprueba
 * `cableado-diagnostico.js`. Los dos mensajes nombran su propio fichero, que es
 * la mitad de lo que sirve un error de contrato.
 */
const esCajon = (v) =>
  !!v &&
  typeof v.alPreparar === 'function' &&
  typeof v.estadoInforme === 'function' &&
  typeof v.pintar === 'function'

/** ¿Es el diálogo de `app/dialogo-informe.js`? */
const esDialogo = (v) =>
  !!v &&
  typeof v.fijar === 'function' &&
  typeof v.fijarLindero === 'function' &&
  typeof v.abrir === 'function' &&
  typeof v.cerrar === 'function' &&
  typeof v.abierto === 'function' &&
  typeof v.puedeComponer === 'function' &&
  typeof v.estado === 'function' &&
  typeof v.alComponer === 'function' &&
  typeof v.alRegenerar === 'function' &&
  typeof v.alCancelar === 'function' &&
  typeof v.destruir === 'function'

/** ¿Es el cliente de `services/catastro.js`, con lo que este módulo le pide? */
const esCliente = (v) => !!v && typeof v.descriptivosPorRefcat === 'function'

/** ¿Es el pie de firma guardado de `storage/pie-firma.js`? */
const esPieFirma = (v) =>
  !!v &&
  typeof v.recuperar === 'function' &&
  typeof v.recordar === 'function' &&
  typeof v.olvidar === 'function'

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Cablea el informe firmable en PDF: el botón primario del pie del cajón de
 * diagnóstico, el diálogo «Preparar informe», el servicio descriptivo del
 * Catastro, el plano y la entrega.
 *
 * ```js
 * const diag = cablearDiagnostico({ estado, cajon, contraste, panel, catastro })
 * const informe = cablearInforme({
 *   estado,
 *   cajon: visor.diagnostico.cajon,
 *   panel,
 *   srs: 'EPSG:25830',
 *   diagnostico: diag.ultimoDiagnostico,   // el que el cajón está enseñando
 *   cliente: clienteCatastro,              // para el DNPRC (contrato E)
 *   catastro: catastroCableado,            // solo para suscribirse a las vecinas
 *   pieFirma: crearPieDeFirmaGuardado({ bd: abrirBd(), alAvisar: panel.avisar }),
 *   comprobacion: () => comprobacionCableada?.comprobacion() ?? null,
 * })
 * // … al cerrar la pantalla:
 * informe.destruir()
 * ```
 *
 * @param {Object} opciones
 * @param {import('../viewer/_comun.js').EstadoVista} opciones.estado  El store del
 *   visor. Se LEE y se ESCUCHA; nunca se escribe: un informe no edita la parcela.
 * @param {object} opciones.cajon  `visor.diagnostico.cajon`.
 * @param {import('./avisos.js').PanelAvisos} opciones.panel  Panel de avisos.
 * @param {string} opciones.srs  SRS del expediente (`'EPSG:25830'`…). **Sin
 *   defecto a propósito**: se imprime en el encabezado, se rotula bajo el plano y
 *   es el SRS con el que se le pide la cartografía al WMS. Un valor supuesto sería
 *   un plano de otro sitio con pinta de estar bien.
 * @param {() => (object|null)} opciones.diagnostico  De dónde sale el diagnóstico
 *   que va en el informe. **Es una función y no un valor** porque cambia con cada
 *   edición; en la app la ata `app/main.js` a `cablearDiagnostico().ultimoDiagnostico`.
 *   `null` ⇒ no hay nada que informar y el botón está apagado (con su motivo, que
 *   lo escribe el cajón).
 * @param {object|null} [opciones.cliente=null]  El cliente de
 *   `services/catastro.js`, para el DNPRC. `null` ⇒ no se consulta y **se dice**
 *   ({@link MOTIVO_SIN_CLIENTE}).
 * @param {object|null} [opciones.catastro=null]  El cableado de F05, **solo** para
 *   suscribirse a `alColindantes`: de ahí salen las vecinas con las que
 *   `report/literal.js` atribuye cada lindero. `null` ⇒ el lindero se redacta
 *   diciendo que las colindantes no se han consultado, que es la verdad.
 * @param {object|null} [opciones.pieFirma=null]  El de `storage/pie-firma.js`.
 *   `null` ⇒ ni se recuerda ni se recupera la firma, y la casilla «Recordar» no
 *   hace nada. Es un estado legítimo (una ventana privada, un navegador sin
 *   IndexedDB) y el propio almacén ya lo cuenta por su canal de aviso.
 * @param {() => (object|null)} [opciones.comprobacion]  De dónde sale la
 *   `Comprobacion` de `comprobacion/gml.js`, si la parcela vino de un fichero. Es
 *   una FUNCIÓN por lo mismo que en `cablearDiagnostico`: la comprobación cambia
 *   con el tiempo y un valor congelado en el montaje mentiría a la segunda carga.
 * @param {object} [opciones.dialogo]  El diálogo. Por defecto se fabrica uno con
 *   `crearDialogoInforme` sobre `document`.
 * @param {() => Date} [opciones.ahora]  De dónde sale «ahora» para la fecha del
 *   encabezado y para el `idDocumento`. Por defecto el reloj del sistema. Es un
 *   parámetro porque `report/` **no consulta el reloj por contrato** —hay
 *   guardianes por grep— y poder fijarlo es lo único que permite afirmar algo
 *   exacto sobre el documento en una prueba.
 * @param {typeof componerPlano} [opciones.plano]  La composición del plano. Se
 *   inyecta porque es la única pieza que toca a la vez la RED y un `<canvas>`, y
 *   jsdom no tiene contexto 2D (el paquete `canvas` no está instalado ni se va a
 *   instalar): sin esta costura, el recorrido entero sería inprobable.
 * @param {typeof descargarBinario} [opciones.descargar]  La entrega del fichero.
 * @returns {{preparar: (evento?: Event|null) => Promise<void>,
 *   componer: (valores: object) => Promise<object|null>, dialogo: object,
 *   destruir: () => void}}
 * @throws {TypeError}  Contrato del programador.
 */
export function cablearInforme({
  estado,
  cajon,
  panel,
  srs,
  diagnostico,
  cliente = null,
  catastro = null,
  pieFirma = null,
  comprobacion = () => null,
  dialogo = undefined,
  ahora = () => new Date(),
  plano: componerElPlano = componerPlano,
  descargar = descargarBinario,
} = {}) {
  if (!esStore(estado)) {
    throw new TypeError(
      `cablearInforme: 'estado' debe ser el store de crearEstadoVista ({get, subscribe}); ` +
        `recibido ${typeof estado}.`,
    )
  }
  if (!esCajon(cajon)) {
    throw new TypeError(
      `cablearInforme: 'cajon' debe ser el de viewer/cajon-diagnostico.js (lo devuelve crearVisor ` +
        `en visor.diagnostico.cajon), con alPreparar, estadoInforme y pintar; recibido ` +
        `${typeof cajon}. Si vale undefined, el visor se montó sin 'diagnostico: true'.`,
    )
  }
  if (!panel || typeof panel.avisar !== 'function') {
    throw new TypeError(
      `cablearInforme: 'panel' debe ser el panel de avisos (con 'avisar'); recibido ` +
        `${typeof panel}. Sin él, un plano caído no tendría dónde contarse.`,
    )
  }
  if (typeof srs !== 'string' || srs.trim() === '') {
    throw new TypeError(
      `cablearInforme: 'srs' debe ser el sistema de referencia del expediente (por ejemplo ` +
        `'EPSG:25830'); recibido ${JSON.stringify(srs)}. No tiene valor por defecto a propósito: ` +
        'se imprime en el encabezado, se rotula bajo el plano y es el SRS con el que se le pide ' +
        'la cartografía al WMS.',
    )
  }
  for (const [nombre, valor] of [
    ['diagnostico', diagnostico],
    ['comprobacion', comprobacion],
    ['ahora', ahora],
    ['plano', componerElPlano],
    ['descargar', descargar],
  ]) {
    if (typeof valor !== 'function') {
      throw new TypeError(
        `cablearInforme: '${nombre}' debe ser una función; recibido ${typeof valor}. ` +
          "'diagnostico' y 'comprobacion' se pasan como funciones (y no como valores) porque las " +
          "dos cosas cambian con el tiempo; 'ahora' porque report/ no consulta el reloj por " +
          'contrato.',
      )
    }
  }
  if (cliente !== null && !esCliente(cliente)) {
    throw new TypeError(
      `cablearInforme: 'cliente' debe ser el de services/catastro.js (con descriptivosPorRefcat), ` +
        `o null para no consultar los datos descriptivos; recibido ${typeof cliente}.`,
    )
  }
  if (catastro !== null && typeof catastro.alColindantes !== 'function') {
    throw new TypeError(
      `cablearInforme: 'catastro' debe ser el cableado de app/cableado-catastro.js (de él solo se ` +
        `usa alColindantes), o null; recibido ${typeof catastro}.`,
    )
  }
  if (pieFirma !== null && !esPieFirma(pieFirma)) {
    throw new TypeError(
      `cablearInforme: 'pieFirma' debe ser el de storage/pie-firma.js (con recuperar, recordar y ` +
        `olvidar), o null si no hay almacén local; recibido ${typeof pieFirma}.`,
    )
  }

  // El diálogo se fabrica DESPUÉS de validar todo lo demás: si algo va a lanzar,
  // que lance sin haber dejado un `<dialog>` colgando del `<body>`. Es la misma
  // regla que `crearVisor` cumple al ser atómico.
  const vista = dialogo ?? crearDialogoInforme({ documento: document, alAvisar: panel.avisar })
  if (!esDialogo(vista)) {
    throw new TypeError(
      `cablearInforme: 'dialogo' debe ser el de app/dialogo-informe.js; recibido ${typeof vista}.`,
    )
  }

  let destruido = false

  /** Una preparación en vuelo, para que dos pulsaciones no encolen dos diálogos. */
  let preparando = false

  /** Una composición en vuelo. Ver {@link MENSAJE_YA_COMPONIENDO}. */
  let componiendo = false

  /**
   * Las vecinas traducidas, o `null`. **`null` = NO SE HAN CONSULTADO**, que es
   * distinto de `[]` = se consultaron y no hay ninguna. `report/literal.js` escribe
   * cosas DISTINTAS con cada uno de los dos, y esa distinción viaja intacta desde
   * aquí hasta el papel.
   *
   * @type {Array<object>|null}
   */
  let vecinas = null

  /** Qué parcela había la última vez, para detectar que ha entrado otra. */
  let clave = claveDeExpediente(estado.get())

  /**
   * Cuántas veces ha cambiado el store desde que se montó este cableado. Es un
   * TOKEN de secuencia, igual que el de `app/cableado-catastro.js#operar`, y
   * existe para la ventana de {@link preparar}: entre la foto del store y
   * `vista.abrir()` hay dos `await`, y un cambio ahí atraviesa
   * {@link alCambiarElStore} sin efecto porque todavía no hay nada `preparado`.
   *
   * Se cuenta el AVISO del store y no se compara el POJO: la garantía que promete
   * la cabecera —«si el store cambia, el diálogo se cierra»— es la misma para otra
   * parcela y para la misma editada, y `alCambiarElStore` cierra en los dos casos.
   * Comparar identidades de objeto dejaría fuera un `set` que reemitiera el mismo.
   */
  let cambiosDelStore = 0

  /**
   * Los descriptivos ya traídos, cacheados **por expediente**. Es la mitad del
   * presupuesto de red de F09: una petición por parcela y por sesión, aunque el
   * usuario prepare el informe cinco veces. La otra mitad la pone la caché de
   * `services/catastro.js`, que sobrevive a la recarga; ésta evita incluso el
   * viaje a IndexedDB.
   *
   * @type {{clave: string|null, valor: object|null}}
   */
  let descriptivos = { clave: null, valor: null }

  /**
   * El documento que se está preparando, congelado en el instante de pulsar
   * «Preparar informe». **Congelado a propósito**: la fecha, el `idDocumento`, el
   * encabezado, el lindero y el diagnóstico tienen que ser todos del MISMO
   * instante, o el papel describiría dos momentos distintos de la misma parcela.
   * Que no pueda quedarse rancio lo garantiza `alCambiarElStore`, que cierra el
   * diálogo en cuanto el store se mueve.
   *
   * `null` = no hay nada preparado.
   *
   * @type {{fecha: Date, encabezado: object, procedencia: object, literal: object,
   *   diagnostico: object, parcela: object|null}|null}
   */
  let preparado = null

  // ── Escritura de cara al usuario ───────────────────────────────────────────

  /**
   * Escribe en el renglón del DIÁLOGO **sin pisar el motivo de un botón apagado**.
   *
   * `dialogo.estado()` comparte nodo con el motivo del gate («Componer PDF está
   * apagado porque hay una presunción sin repasar»), y ese motivo manda: escribir
   * encima dejaría un botón gris y mudo, que es justo lo que la regla de oro 1
   * prohíbe. Cuando el botón está encendido no hay motivo que proteger y se
   * escribe sin más.
   *
   * @param {string} texto
   */
  function decirEnDialogo(texto) {
    if (destruido) return
    if (!vista.puedeComponer()) return
    vista.estado(texto)
  }

  /** Escribe el renglón del PIE del cajón, que es el desenlace de la pulsación. */
  function decirEnCajon(texto) {
    if (!destruido) cajon.estadoInforme(texto)
  }

  // ── Los descriptivos (contrato E) ──────────────────────────────────────────

  /**
   * Los datos alfanuméricos de la parcela, o `null` si **no se ha consultado**.
   *
   * Los tres desenlaces se distinguen y se dicen por separado, porque los tres
   * significan cosas distintas en el papel: no hay referencia con la que
   * preguntar, no hay cliente al que preguntar, o se preguntó (y contestara lo que
   * contestara, el sobre se devuelve tal cual y `procedenciaDescriptivos` lo lee).
   *
   * Un fallo INESPERADO del cliente **no cancela el informe**: se envuelve en un
   * sobre con `ok:false` —que es exactamente la forma que el contrato E define
   * para «se preguntó y no hubo dato»— y el encabezado imprime «No se ha podido
   * consultar» con este motivo debajo. Cancelar la preparación entera por un
   * defecto en la consulta de un dato accesorio sería tirar el informe por lo que
   * menos pesa de él.
   *
   * @param {string|null} refcat
   * @returns {Promise<object|null>}
   */
  async function pedirDescriptivos(refcat) {
    if (refcat === null) {
      decirEnCajon(MOTIVO_SIN_REFCAT)
      return null
    }
    if (cliente === null) {
      decirEnCajon(MOTIVO_SIN_CLIENTE)
      return null
    }
    if (descriptivos.clave === refcat) return descriptivos.valor

    let sobre
    try {
      sobre = await cliente.descriptivosPorRefcat(refcat)
    } catch (causa) {
      console.error('cablearInforme: fallo inesperado al consultar los descriptivos', causa)
      sobre = {
        ok: false,
        datos: null,
        motivo: MOTIVO_DESCRIPTIVOS_ROTO,
        mensaje: MENSAJE_DESCRIPTIVOS_ROTO,
      }
    }
    // Se cachea también el fallo, y es deliberado: reintentar solo porque el
    // usuario vuelva a pulsar convertiría un servicio caído en una ráfaga de
    // peticiones, que es lo que castiga la política de uso (override O8). Una
    // parcela nueva —o recargar— limpia la caché.
    descriptivos = { clave: refcat, valor: sobre }
    return sobre
  }

  // ── El pie de firma recordado ──────────────────────────────────────────────

  /**
   * Lo que el navegador recuerde del pie de firma. Sin almacén se devuelve la
   * forma vacía: el diálogo la trata igual que a una firma sin datos y el informe
   * imprime «No consta» en los cuatro campos, que es lo correcto y no un hueco.
   *
   * @returns {Promise<{firma: object|null, recordado: boolean}>}
   */
  async function recuperarFirma() {
    if (pieFirma === null) return { firma: null, recordado: false }
    try {
      const r = await pieFirma.recuperar()
      return { firma: r.firma ?? null, recordado: r.recordado === true }
    } catch (causa) {
      // El almacén ya avisa por su canal de todo lo que sabe contar; esto es para
      // lo que ni él previó. No puede tumbar la preparación del informe: una firma
      // que no se recuerda se vuelve a teclear.
      console.error('cablearInforme: fallo al recuperar el pie de firma guardado', causa)
      return { firma: null, recordado: false }
    }
  }

  /**
   * Guarda o BORRA el pie de firma según la casilla. Desmarcarla borra —así lo
   * documenta `storage/pie-firma.js`— y no hacerlo sería la peor lectura posible
   * de una casilla de privacidad: el usuario cree haber revocado algo que sigue
   * guardado.
   *
   * @param {object} valores  Los de `dialogo.valores()`.
   * @returns {Promise<void>}
   */
  async function recordarFirma(valores) {
    if (pieFirma === null) return
    try {
      if (valores.recordarFirma === true) await pieFirma.recordar(valores.firma)
      else await pieFirma.olvidar()
    } catch (causa) {
      console.error('cablearInforme: fallo al guardar u olvidar el pie de firma', causa)
    }
  }

  // ── El lindero ─────────────────────────────────────────────────────────────

  /**
   * Redacta el lindero con lo que hay AHORA.
   *
   * La `clase` sale del ENCABEZADO ya compuesto y no de ninguna otra parte, y ese
   * es el único sitio del que puede salir: es lo mismo que decide qué filas se
   * imprimen arriba y lo que habilita la presunción de vía pública abajo, así que
   * si se leyera de dos sitios el documento podría acabar diciendo «la finca
   * consta como urbana» en un párrafo y no imprimir la clase en el encabezado.
   * Una afirmación, una fuente.
   *
   * @param {Array} recintos
   * @param {'URBANA'|'RUSTICA'|null} clase
   * @returns {object}  Lo de `report/literal.js#describirLindero`.
   */
  function redactarLindero(recintos, clase) {
    return describirLindero({ recintos, vecinas, clase })
  }

  // ── Paso 1 · Preparar ──────────────────────────────────────────────────────

  /**
   * Prepara el informe y abre el diálogo. Es lo que se llama al pulsar «Preparar
   * informe (PDF)», y también está en la API por si hace falta dispararlo desde
   * fuera (un guion de humo, un atajo).
   *
   * Nada de lo que puede fallar aquí se deja subir: esto corre dentro de un oyente
   * del DOM, y **una excepción lanzada ahí no sale por `dispatchEvent`** (medido
   * en F08 · T3.2). Se reportaría como error no capturado en `window`, el usuario
   * vería que no pasa nada y el único rastro quedaría en una consola que un
   * técnico del Catastro no abre nunca.
   *
   * @param {Event|null} [evento=null]  El clic que lo ha disparado. Se acepta —y se
   *   ignora— para poder engancharlo directamente a `cajon.alPreparar`.
   * @returns {Promise<void>}
   */
  async function preparar(evento = null) {
    void evento
    if (destruido) return

    const d = diagnostico()
    if (d === null || d === undefined) {
      // El `disabled` del botón es cortesía; la garantía es esta comprobación. Y el
      // POR QUÉ no se reescribe aquí: lo escribe el cajón en su propio renglón en
      // el mismo instante en que apaga los dos botones del pie, así que basta con
      // asegurarse de que el gate está bajado. Dos redacciones del mismo motivo, en
      // dos módulos, divergirían.
      cajon.pintar(null)
      return
    }
    if (preparando) {
      decirEnCajon(MENSAJE_YA_PREPARANDO)
      return
    }

    preparando = true
    decirEnCajon(MENSAJE_PREPARANDO)
    try {
      // La foto del store y su TOKEN se toman juntos, y en este mismo tick: lo que
      // se prepare a partir de aquí describe ESTE instante. Ver la guarda de más
      // abajo, antes de abrir.
      const marca = cambiosDelStore
      const parcelaActual = estado.get()
      const recintos = recintosDe(parcelaActual)
      const refcat = referenciaDe(parcelaActual)
      // UN solo instante para la fecha del encabezado y para el identificador del
      // documento: leer el reloj dos veces podría dejarlos discrepando en el cambio
      // de segundo, y el identificador es lo que empareja el papel con su registro.
      const fecha = ahora()

      const sobre = await pedirDescriptivos(refcat)
      if (destruido) return

      // ⚠️ LA PROCEDENCIA, QUE ES LO QUE HACE QUE EL INFORME NO MIENTA. Ver la
      // cabecera: sin esto, los campos que el servicio no trae se imprimirían como
      // «No se ha consultado» habiéndose consultado.
      const procedencia = procedenciaDescriptivos(sobre)
      const encabezado = componerEncabezado({
        descriptivos: sobre,
        refcat,
        srs,
        fecha,
        // Se compone AQUÍ y se inyecta: `report/firma.js` sabe componerlo pero no
        // puede leer el reloj, y el store guarda una Parcela (no un Expediente), así
        // que no trae ningún `metadatos.idDocumento` que reutilizar.
        idDocumento: componerIdDocumento(refcat, fecha),
      })
      const literal = redactarLindero(recintos, encabezado.clase)

      const { firma, recordado } = await recuperarFirma()
      if (destruido) return

      // ── ⛔ LA VENTANA DE LOS DOS `await` (auditoría 2026-08-16) ──────────────
      // Desde la foto de arriba hasta aquí hay una consulta a la red (DNPRC) y una
      // lectura de IndexedDB (el pie de firma). Un cambio del store en ese hueco
      // atraviesa `alCambiarElStore` **sin efecto** —`preparado` todavía es `null`,
      // que es su condición de salida— y el diálogo se abriría DESPUÉS, ofreciendo
      // firmar un encabezado, un lindero y un diagnóstico de la parcela ANTERIOR,
      // con el diagnóstico del cajón ya recalculado y distinto. Y el `<dialog>` en
      // modo pantalla es `show()`, no modal: la ventana es alcanzable.
      //
      // No se abre nada, y **se dice**: un botón que se pulsa y no pasa nada es la
      // definición de error silencioso. La acción correcta —volver a pulsar— va en
      // el mensaje, igual que en el cierre de {@link MOTIVO_CIERRE_POR_CAMBIO}.
      if (cambiosDelStore !== marca) {
        decirEnCajon(MOTIVO_PREPARACION_SUPERADA)
        return
      }

      // ⭐ F17 · T12 · EL ACTO JURÍDICO, QUE ESTA APLICACIÓN NO NOMBRABA.
      //
      // Todo lo que hacen F06 (mover el lindero), F07 (diagnosticar) y F09 (este
      // informe) **es una Subsanación**, y la palabra no aparecía en ninguna capa
      // del proyecto (`spec/SPEC.md` §7.2). El hueco no estaba en el futuro: estaba
      // en el caso de uso más frecuente, y se cierra aquí — con una parcela, la
      // forma del fichero es la que la Sede aceptó el 2026-07-27.
      //
      // Se deduce de la IDENTIDAD y no del recuento a secas, porque la pareja
      // `localId`↔`namespace` es lo que distingue una finca inscrita de un alta.
      const identidad = identidadDeParcela({
        refcat: referenciaDe(parcelaActual),
        idLocal: parcelaActual?.idLocal ?? null,
      })
      const operacion = tipoDeOperacion([identidad])

      // `fijar` valida las tres piezas ANTES de tocar un solo nodo, así que si algo
      // está mal el diálogo se queda exactamente como estaba y el `catch` de abajo
      // lo cuenta. Por eso el estado interno se apunta DESPUÉS.
      vista.fijar({
        encabezado,
        procedencia,
        lindero: literal,
        firma,
        recordarFirma: recordado,
        operacion,
      })
      preparado = {
        fecha,
        encabezado,
        procedencia,
        literal,
        diagnostico: d,
        parcela: parcelaActual,
        identidad,
        operacion,
      }
      vista.abrir()

      // El desenlace de la consulta se cuenta en los dos renglones y no en uno: el
      // del cajón sobrevive al cierre del diálogo (es el historial de la pulsación)
      // y el del diálogo es el que el usuario tiene delante mientras rellena. Y en
      // el diálogo solo si no hay un motivo que proteger (ver `decirEnDialogo`).
      const acuse = procedencia.consultado
        ? procedencia.ok
          ? ACUSE_DESCRIPTIVOS
          : MOTIVO_DESCRIPTIVOS_SIN_DATO
        : null
      if (acuse !== null) {
        decirEnCajon(acuse)
        decirEnDialogo(acuse)
      }
    } catch (causa) {
      decirEnCajon('El informe no se ha podido preparar. Mira el panel de avisos.')
      panel.avisar(MENSAJE_INFORME_NO_PREPARADO, { nivel: NIVEL.ERROR, causa })
      console.error('cablearInforme: fallo al preparar el informe', causa)
    } finally {
      preparando = false
    }
  }

  // ── Paso 2 · Componer ──────────────────────────────────────────────────────

  /**
   * El plano, o `null` si no se ha podido componer. **Nunca lanza**: la decisión
   * de F09 es que un plano caído degrada el informe y no lo cancela (ver la
   * cabecera). El motivo sale por los dos canales de la casa —panel y consola— y
   * el propio PDF lo dirá en su sección.
   *
   * @param {Array} recintos
   * @param {Array|null} oficiales
   * @returns {Promise<{plano: object|null, encuadre: object|null}>}
   */
  async function componerElPlanoOSinEl(recintos, oficiales) {
    try {
      const encuadre = encuadrar({
        recintos,
        // El contorno oficial TAMBIÉN tiene que caber: encuadrar solo por la
        // geometría medida dejaría fuera, en silencio, justo la mitad del contraste
        // que el plano existe para enseñar.
        otrosRecintos: oficiales === null ? [] : [oficiales],
        anchoMm: ANCHO_PLANO_MM,
        altoMm: ALTO_PLANO_MM,
      })
      const plano = await componerElPlano({
        encuadre,
        recintos,
        recintosOficiales: oficiales,
        srs,
        // El canal de aviso del plano es el MISMO panel que todo lo demás: una
        // tesela que no llega es información para el usuario, no para el programador.
        alAvisar: panel.avisar,
      })
      return { plano, encuadre }
    } catch (causa) {
      panel.avisar(MENSAJE_PLANO_NO_COMPUESTO, { nivel: NIVEL.AVISO, causa })
      console.error('cablearInforme: fallo al componer el plano del informe', causa)
      return { plano: null, encuadre: null }
    }
  }

  /**
   * El objeto `literal` que se manda a imprimir, con lo que el usuario haya
   * escrito.
   *
   * ── POR QUÉ NO BASTA CON PASAR EL BORRADOR ORIGINAL ──
   * `report/pdf-parcela.js#seccionLindero` imprime `literal.lindero` y
   * `literal.notaTecnica` —los párrafos—, **no `literal.texto`**. Si aquí se
   * pasara el objeto tal cual llegó, el papel llevaría el borrador de la
   * aplicación y NO lo que el usuario corrigió en el cuadro, que es justo lo que
   * la spec pide poder corregir. Sería el fallo silencioso más caro de este
   * recorrido: la pantalla enseña un texto y el PDF imprime otro.
   *
   * Cuando el texto se ha editado, todo lo que hay en el cuadro pasa a `lindero` y
   * `notaTecnica` se vacía. No es una pérdida: la nota técnica **estaba dentro**
   * del cuadro (`texto === [...lindero, ...notaTecnica].join('\n\n')`), así que
   * seguirla imprimiendo aparte la duplicaría. Lo que quede en el cuadro es lo que
   * se imprime, que es literalmente lo que el diálogo promete.
   *
   * Los `tramos` se conservan intactos, y eso sí es innegociable: la marca de
   * presunción vive ahí, no en el texto, y es lo que hace que la advertencia
   * sobreviva a que alguien reescriba el párrafo.
   *
   * @param {object} literal  El de `describirLindero`.
   * @param {object} valores  Los de `dialogo.valores()`.
   * @returns {object}
   */
  function literalParaImprimir(literal, valores) {
    if (valores.linderoEditado !== true) return literal
    return {
      ...literal,
      texto: valores.lindero,
      lindero: enParrafos(valores.lindero),
      notaTecnica: [],
    }
  }

  /**
   * Compone el PDF y lo entrega. Es lo que se llama desde `dialogo.alComponer`.
   *
   * Los tres fallos posibles se cuentan por SEPARADO —plano, maquetación,
   * entrega— y con mensajes distintos, porque llevan a acciones distintas. Ninguno
   * se deja subir, por lo mismo que en {@link preparar}.
   *
   * @param {object} valores  Lo que devuelve `dialogo.valores()`.
   * @returns {Promise<object|null>}  El `ResultadoDescarga` de `gml/descargar.js`,
   *   o `null` si no se llegó a intentar la entrega.
   */
  async function componer(valores) {
    if (destruido) return null
    if (preparado === null || !valores) {
      // No hay documento preparado: el diálogo no puede estar en un estado en el
      // que esto ocurra por la vía normal (`valores()` devuelve `null` cuando no se
      // ha fijado nada, y entonces el botón está apagado con su motivo). Se guarda
      // igual, porque `componer` está en la API pública.
      vista.estado(
        'No hay ningún informe preparado que componer. Pulse «Preparar informe (PDF)».',
      )
      return null
    }
    if (componiendo) {
      vista.estado(MENSAJE_YA_COMPONIENDO)
      return null
    }

    componiendo = true
    // Se dice ANTES del primer `await`: el plano tarda, y un botón que se queda
    // pensando sin decirlo es un error silencioso. Se escribe sin pasar por
    // `decirEnDialogo` a propósito — aquí el botón está encendido por definición
    // (el diálogo solo reparte `alComponer` con el gate abierto).
    vista.estado(MENSAJE_COMPONIENDO)
    try {
      const { procedencia, literal, diagnostico: d, parcela } = preparado
      const recintos = recintosDe(parcela)
      const oficiales = oficialDe(parcela)

      // ── 1 · El plano (la RED) ──────────────────────────────────────────────
      const { plano, encuadre } = await componerElPlanoOSinEl(recintos, oficiales)
      if (destruido) return null

      // ── 2 · La maqueta ─────────────────────────────────────────────────────
      let informe
      try {
        informe = informePdfParcela({
          diagnostico: d,
          // El encabezado que vale es el que sale del DIÁLOGO, no el que entró: el
          // usuario ha podido corregir el municipio o el paraje, y lo que se
          // imprime es lo que él dejó escrito. La fecha y el `idDocumento` viajan
          // dentro intactos porque el diálogo no los deja editar.
          encabezado: valores.encabezado,
          parcela,
          comprobacion: comprobacion(),
          plano,
          // `encuadre` solo si hay plano: `informePdfParcela` exige la pareja.
          encuadre: plano === null ? null : encuadre,
          literal: literalParaImprimir(literal, valores),
          firma: valores.firma,
          // ⚠️ LA PROCEDENCIA, OTRA VEZ. Sin ella el PDF imprimiría «No se ha
          // consultado» en los campos que sí se consultaron. Ver la cabecera.
          procedencia,
          // ⭐ El ALCANCE. Con una sola parcela la lista tiene una fila y la marca
          // señala a la única, y eso NO es redundante: es la frase que impide leer
          // el papel como si abarcara un expediente entero el día que lleve varias.
          // El tipo que se imprime es el que quedó en el DESPLEGABLE, no el que se
          // propuso — y si el usuario lo tocó, el informe lo dice.
          expediente: {
            tipoOperacion: valores.tipoOperacion,
            propuesto: valores.operacionPropuesta,
            porQue: preparado.operacion?.porQue ?? null,
            miembros: [
              {
                localId: preparado.identidad?.refcat ?? null,
                namespace: preparado.identidad?.namespaceInspire ?? null,
                areaValue: null,
                descrita: true,
              },
            ],
          },
        })
      } catch (causa) {
        vista.estado('El PDF no se ha podido componer. Mira el panel de avisos.')
        panel.avisar(MENSAJE_PDF_NO_COMPUESTO, { nivel: NIVEL.ERROR, causa })
        console.error('cablearInforme: fallo al maquetar el PDF del informe', causa)
        return null
      }

      // ── 3 · Lo que el informe ha tenido que declarar de sí mismo ───────────
      // Al panel, uno por uno: son cosas que le han pasado AL DOCUMENTO (una capa
      // de cartografía que no se dibujó, un carácter sustituido) y el usuario tiene
      // que poder leerlas enteras. Van también dentro del PDF, que es lo que
      // sobrevive a que alguien lo reenvíe.
      for (const incidencia of informe.incidencias) {
        panel.avisar(incidencia, { nivel: NIVEL.AVISO })
      }

      // ── 4 · La casilla «Recordar» ──────────────────────────────────────────
      // ANTES de entregar: si la entrega falla, la preferencia del usuario sobre
      // sus propios datos ya está atendida. Y desmarcarla BORRA.
      await recordarFirma(valores)
      if (destruido) return null

      // ── 5 · La entrega ─────────────────────────────────────────────────────
      let entrega
      try {
        entrega = descargar(informe.bytes, {
          // El nombre lo propone `report/pdf-parcela.js` y lleva el `idDocumento`
          // dentro, que es alfanumérico por construcción: dos informes del mismo día
          // no se pisan en la carpeta de descargas y el fichero se empareja de un
          // vistazo con el papel impreso.
          nombreFichero: informe.nombreFichero,
          mime: TIPO_MIME_PDF,
        })
      } catch (causa) {
        vista.estado('El PDF no ha bajado. Mira el panel de avisos.')
        panel.avisar(MENSAJE_PDF_NO_ENTREGADO, { nivel: NIVEL.ERROR, causa })
        console.error('cablearInforme: fallo al entregar el PDF del informe', causa)
        return null
      }

      if (!entrega.descargado) {
        // El diálogo se queda ABIERTO: el documento sigue preparado y volver a
        // pulsar es la acción correcta. `descargarBinario` trae un `mensaje` en
        // castellano ya presentable y se enseña tal cual.
        vista.estado(entrega.mensaje)
        return entrega
      }

      // Bajó. El diálogo se cierra —ya no hay nada que rellenar— y el acuse se
      // escribe en el renglón del PIE, que es donde el usuario mira después de que
      // el modal desaparezca. Cerrar es PROGRAMÁTICO, así que no dispara
      // `alCancelar` y no se contará como que el usuario se echó atrás.
      vista.cerrar()
      decirEnCajon(
        plano === null
          ? `Descargado «${entrega.nombre}». ${AVISO_SIN_PLANO}`
          : informe.incidencias.length > 0
            ? `Descargado «${entrega.nombre}». El informe declara ` +
              `${informe.incidencias.length} incidencia(s): mira el panel de avisos.`
            : `Descargado «${entrega.nombre}».`,
      )
      return entrega
    } finally {
      componiendo = false
    }
  }

  // ── Oyentes ────────────────────────────────────────────────────────────────

  /**
   * El manejador suelta la promesa a propósito, igual que los de F05 y F07: lo que
   * puede fallar dentro ya se ha contado por el renglón, por el panel y por la
   * consola antes de resolverse. Quien llama a `preparar()` desde la API sí recibe
   * la promesa.
   */
  const alPulsarPreparar = (evento) => {
    preparar(evento).catch(() => {})
  }

  const alPulsarComponer = (valores) => {
    componer(valores).catch(() => {})
  }

  /**
   * «Regenerar el borrador». El diálogo ya ha restaurado por su cuenta el borrador
   * que guardó; esto es para lo que él no puede saber: que desde que se abrió
   * pueden haber llegado las colindantes, y con ellas un lindero mejor atribuido.
   *
   * **Solo se sustituye si de verdad ha cambiado.** `fijarLindero` repinta el gate,
   * y repintar el gate borra el acuse que el propio diálogo acaba de escribir
   * («Se ha vuelto al borrador que redactó la aplicación»). Sustituir por lo mismo
   * costaría ese acuse y no daría nada a cambio.
   */
  function alRegenerar() {
    if (destruido || preparado === null) return
    let nuevo
    try {
      nuevo = redactarLindero(recintosDe(preparado.parcela), preparado.encabezado.clase)
    } catch (causa) {
      console.error('cablearInforme: fallo al regenerar el borrador del lindero', causa)
      return
    }
    if (nuevo.texto === preparado.literal.texto) return
    preparado = { ...preparado, literal: nuevo }
    vista.fijarLindero(nuevo)
    decirEnDialogo(AVISO_BORRADOR_ACTUALIZADO)
  }

  /** El usuario se ha echado atrás («Cancelar» o `Escape`). Se dice, no se calla. */
  function alCancelar() {
    if (!destruido) decirEnCajon(ACUSE_CANCELADO)
  }

  /**
   * Adopta las vecinas de un resultado del Catastro. Es el ÚNICO camino por el que
   * `vecinas` deja de ser `null`, y por eso este cableado **no pide nada**: se
   * cuelga de la consulta que ya hace el cajón del diagnóstico al abrirse.
   *
   * ── ⛔ Y SE COTEJA DE QUÉ PARCELA SON (auditoría 2026-08-16) ────────────────
   * El canal es público y ASÍNCRONO: lo que llega puede haberse pedido para la
   * parcela de antes. Basta con que entre otra por una vía que no sea F05 —un
   * fichero, un `.json` restaurado— mientras `colindantes()` viaja: la respuesta
   * de la anterior llegaba después de que `alCambiarElStore` hubiera puesto
   * `vecinas` a `null`, se adoptaba como vigente, y `report/literal.js` atribuía
   * los linderos de ESTA parcela con las referencias catastrales de aquélla. En un
   * papel que alguien firma, eso es una inexactitud silenciosa.
   *
   * Descartar no se anuncia al usuario y tampoco hace falta: el lindero se redacta
   * entonces diciendo que las colindantes **no se han consultado**, que es
   * exactamente lo que ha pasado con las de esta parcela, y «Regenerar» lo rehará
   * en cuanto lleguen las suyas. El rastro técnico va a la consola.
   *
   * @param {import('../services/catastro.js').ResultadoCatastro} resultado
   */
  function adoptarVecinas(resultado) {
    if (destruido) return
    if (!resultado || !resultado.ok || !resultado.datos) return
    const declarada = claveDelResultado(resultado)
    if (declarada !== null && declarada !== claveDeExpediente(estado.get())) {
      console.warn(
        'cablearInforme: se descartan unas colindantes que no son de la parcela que hay en ' +
          `pantalla (llegaron las de ${declarada}).`,
      )
      return
    }
    vecinas = aVecinasLiteral(resultado.datos.colindantes)
  }

  /**
   * El suscriptor del store: **UNA vez por operación acabada**.
   *
   * Hace dos cosas, y la segunda es la que importa:
   *
   *   1. Si ha entrado OTRA parcela, se olvida todo lo del expediente anterior:
   *      las vecinas (son de la otra finca), los descriptivos (idem) y el
   *      documento preparado.
   *   2. Si el diálogo estaba abierto, **se cierra y se dice por qué**. El
   *      documento que se estaba preparando describe la parcela que había cuando
   *      se pulsó el botón —fecha, identificador, encabezado, lindero y
   *      diagnóstico, todos del mismo instante— y dejarlo abierto sobre una
   *      parcela distinta, o sobre la misma ya editada, sería ofrecer firmar un
   *      papel que no describe lo que hay en pantalla. Es la misma doctrina que
   *      hace que una parcela nueva cierre el cajón del diagnóstico (F07), llevada
   *      al caso en que el papel ya lleva un pie de firma.
   *
   * Por la vía normal esto casi nunca dispara —el diálogo es MODAL y bloquea el
   * mapa mientras está abierto—, y ese es justo el motivo de que no cueste nada
   * tenerlo: la garantía es absoluta y el precio, cero.
   *
   * @param {object|null} parcelaActual
   */
  function alCambiarElStore(parcelaActual) {
    if (destruido) return
    // El token, ANTES de cualquier salida por arriba: lo que cuenta es que el store
    // se ha movido, no lo que este suscriptor decida hacer con ello. Es lo que hace
    // que una preparación en vuelo se entere (ver la guarda de `preparar`).
    cambiosDelStore += 1
    const nueva = claveDeExpediente(parcelaActual)
    if (nueva !== clave) {
      clave = nueva
      vecinas = null
      descriptivos = { clave: null, valor: null }
    }
    if (preparado === null) return
    preparado = null
    if (vista.abierto()) {
      vista.cerrar()
      decirEnCajon(MOTIVO_CIERRE_POR_CAMBIO)
    }
    vista.fijar(null)
  }

  const bajaPreparar = cajon.alPreparar(alPulsarPreparar)
  const bajaComponer = vista.alComponer(alPulsarComponer)
  const bajaRegenerar = vista.alRegenerar(alRegenerar)
  const bajaCancelar = vista.alCancelar(alCancelar)
  const desuscribirStore = estado.subscribe(alCambiarElStore)
  const bajaColindantes = catastro === null ? () => {} : catastro.alColindantes(adoptarVecinas)

  return {
    preparar,
    componer,

    /**
     * El diálogo, para que el arranque y las pruebas puedan interrogarlo sin
     * conocer dónde se fabricó. Gemelo de `cajon.control` en el visor.
     */
    dialogo: vista,

    /**
     * Deja el cableado inerte: retira las cinco suscripciones y **destruye el
     * diálogo si lo fabricó este módulo**. IDEMPOTENTE.
     *
     * Un diálogo INYECTADO no se destruye: lo montó quien lo pasó y es suyo, igual
     * que el cajón y el contraste son del visor y los desmonta `visor.destruir()`.
     * Este módulo desmonta lo que ha montado él, ni más ni menos.
     */
    destruir() {
      if (destruido) return
      destruido = true
      bajaPreparar()
      bajaComponer()
      bajaRegenerar()
      bajaCancelar()
      desuscribirStore()
      bajaColindantes()
      if (dialogo === undefined) vista.destruir()
    },
  }
}

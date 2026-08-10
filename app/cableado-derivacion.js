// app/cableado-derivacion.js — F17 · 4.2. LA COSTURA DEL SOBRANTE.
//
// Une las cuatro cosas que ningún otro módulo conoce a la vez: el STORE (de donde
// sale la geometría y el contorno oficial), la LISTA del panel y la CAPA de
// manchas (`viewer/lista-sobrante.js` y `viewer/piezas.js`, que no saben qué es
// una parcela), la DERIVACIÓN pura (`derivacion/`, que no sabe qué es el DOM) y
// los DOS CTA de la cáscara.
//
// ── LO QUE ESTE MÓDULO NO HACE, Y ES LA MITAD DE SU DEFINICIÓN ──────────────
// No mide, no ordena piezas, no decide qué es una astilla, no compone XML y no
// nombra ficheros. Todo eso está hecho, medido y probado en las fases 1 a 3. Aquí
// solo se enchufan cables y se escriben motivos.
//
// ── ⛔ EL CTA SE ENCIENDE CON UN PREDICADO BARATO, Y LA PUERTA CORRE AL PULSAR ─
// `puedeDerivar` mira DOS hechos estructurales: hay contorno oficial y hay
// geometría del usuario. Nada más. El patrón es el de
// `app/cableado-diagnostico.js#puedeDiagnosticar`, y aquí importa todavía más
// porque este predicado corre en CADA notificación del store — o sea, en cada
// vértice arrastrado.
//
// ⛔ **Y no puede mirar la SUPERFICIE.** «Área menor» NO implica «está dentro»:
// una parcela puede menguar 3 m² por un lado y crecer 5 cm por otro, y entonces el
// sobrante no es la mitad de la verdad, es una entrega incompleta con total
// confianza. Comprobarlo de verdad es una resta booleana (`restar(P_new, P_of)`, y
// **jamás `booleanContains`**, que solo mira vértices y dice `true` con un lado
// fuera en una parcela cóncava — medido). Eso cuesta lo que cuesta, así que corre
// AL PULSAR y explica con cifras cuando dice que no.
//
// ── EL SOBRANTE ES UNA FOTO, Y AQUÍ ES DONDE CADUCA (decisión 3C) ───────────
// Cualquier cambio en el store invalida la derivación entera: los nombres escritos
// se pierden y **se dice**. Jamás se reasignan por clave heurística — el `orden` de
// una pieza vale solo dentro de SU derivación, y un nombre pegado a la pieza
// equivocada es una finca mal nombrada en un papel que se firma.
//
// ⚠️ **Se invalida por CUALQUIER cambio del store, no solo por «otra parcela».**
// `viewer/index.js` suelta las colindantes cuando cambia la IDENTIDAD de la
// parcela, y ese gancho no sirve aquí: la identidad no cambia al mover un vértice,
// y mover un vértice es exactamente lo que caduca el sobrante. Son dos hechos
// distintos y por eso son dos sitios distintos.
//
// ── DÓNDE VIVE CADA BOTÓN, Y POR QUÉ ────────────────────────────────────────
//   · **«Derivar sobrante»** está en el PIE del panel (`index.html`), junto a
//     «Generar GML» y «Diagnosticar encaje». Tiene que existir ANTES de que haya
//     bloque: el bloque aparece solo cuando hay sobrante, así que un botón dentro
//     de él sería un botón que solo existe después de haberlo pulsado.
//   · **«Descargar expediente»** está DENTRO del bloque, y lo fabrica la lista. Es
//     la acción que CONSUME lo que el bloque enseña —qué piezas van y cómo se
//     llaman—, el mismo criterio con el que F08 metió «Descargar informe de
//     contraste» en el cajón de F07 en vez de poner un tercer botón en el pie.
//
// ⚠️ **«Generar GML» NO se toca.** Sigue significando lo que significaba: el GML
// de UNA parcela. Cambiarle el comportamiento por debajo cuando hay sobrante sería
// que el mismo botón entregara dos cosas distintas según un estado que no se ve, y
// eso es peor que tener dos botones. Lo que sí hace este módulo es DECIRLO en el
// renglón del sobrante cuando el usuario excluye todas las piezas.

import { TIPO_DERIVACION } from '../derivacion/_comun.js'
import { derivarCesion } from '../derivacion/cesion.js'
import { prepararEntrega } from '../derivacion/entrega.js'
import { recortarVecinos } from '../derivacion/vecino.js'
import { descargarGml } from '../gml/descargar.js'
import { NIVEL } from '../viewer/_comun.js'
import {
  MOTIVO_NINGUNA_INCLUIDA,
  MOTIVO_SIN_DERIVAR,
} from '../viewer/lista-sobrante.js'
import { INSTRUCCION_PARCELARIO } from './navegacion.js'

// ── Selectores de la cáscara (contrato con `index.html`) ─────────────────────

/** El CTA del pie. */
export const SELECTOR_BOTON = '[data-accion="derivar-sobrante"]'
/** Su renglón `role="status"`. */
export const SELECTOR_ESTADO = '[data-estado="derivar-sobrante"]'
/** La sección del panel que aloja el bloque. */
export const SELECTOR_ANFITRION = '[data-anfitrion="sobrante"]'

// ── Motivos, escritos una vez y en un solo sitio ─────────────────────────────

/**
 * Por qué «Derivar sobrante» está apagado. Se escribe en el renglón **en el mismo
 * instante** en que se apaga: un botón gris y mudo es un error silencioso.
 *
 * ⛔ **La instrucción decía «Trae la parcela del Catastro (o un GML con su
 * geometría) y vuelve», y era la trampa**: hasta el 2026-08-08 traer la parcela del
 * Catastro BORRABA la medición del usuario, o sea justo la geometría cuyo sobrante
 * este botón existe para derivar. Ahora sale de {@link INSTRUCCION_PARCELARIO}.
 */
export const MOTIVO_SIN_OFICIAL =
  'No hay contorno oficial con el que comparar, así que no se puede saber qué parte de la ' +
  `parcela se suelta. ${INSTRUCCION_PARCELARIO}`

/** Y cuando lo que falta es la geometría del usuario. */
export const MOTIVO_SIN_GEOMETRIA =
  'Todavía no hay geometría medida que comparar con el contorno oficial.'

/**
 * ⛔ La respuesta de la PUERTA cuando la parcela ha CRECIDO en vez de menguar.
 *
 * Es el caso que el plan llamó por su nombre: el sobrante saldría VACÍO mientras
 * hay vecinos afectados, y la aplicación exportaría un expediente incompleto con
 * total confianza.
 *
 * ⚠️ **Son DOS mensajes y no uno, y la partición está MEDIDA** (guion 16,
 * 2026-08-05). La primera versión decía las cifras Y el porqué en el mismo
 * renglón, y ese renglón vive en el PIE del panel: cinco líneas a 343 px de ancho
 * le comieron **74,96 px** a la tabla de vértices, que a 1280×720 es un tercio de
 * lo que le queda. Así que aquí va **lo accionable con su cifra** —dos líneas— y
 * el porqué largo sale por el canal de avisos, que tiene scroll propio y es donde
 * este proyecto pone las explicaciones. Ninguna de las dos mitades se pierde.
 *
 * @param {import('../derivacion/cesion.js').PuertaCesion} puerta
 * @param {(n:number, d?:number) => string} formatear
 * @returns {string}
 */
export function motivoPuerta(puerta, formatear) {
  const cuantas = puerta.piezas.length
  return (
    `Se sale del contorno oficial: ${formatear(puerta.area)} m² en ${cuantas} sitio(s). ` +
    'Los tienes abajo; el expediente no se puede descargar así.'
  )
}

/**
 * ⛔ Por qué «Descargar expediente» está apagado cuando la geometría se sale.
 *
 * Es el motivo que sustituye al bloque escondido. Hasta hoy este caso **no tenía
 * renglón porque no tenía bloque**: la puerta llamaba a `invalidar(null)`, la lista
 * desaparecía y con ella el sobrante ya medido. Ahora el sobrante se ve, el exceso
 * se ve, y lo único que sigue cerrado es la descarga — que es lo que de verdad
 * había que cerrar.
 *
 * Dice la cifra y dice el porqué en una frase, porque este renglón vive DENTRO del
 * bloque (tiene su propio sitio y su scroll) y no en el pie del panel, que es donde
 * los píxeles están contados.
 *
 * @param {import('../derivacion/cesion.js').PuertaCesion} puerta
 * @param {(n:number, d?:number) => string} formatear
 * @returns {string}
 */
export function motivoEntregaFuera(puerta, formatear) {
  const cuantas = puerta.piezas.length
  return (
    `El expediente no se puede descargar todavía: ${formatear(puerta.area)} m² de la geometría ` +
    `medida caen fuera de la parcela oficial, en ${cuantas} ${cuantas === 1 ? 'sitio' : 'sitios'}, ` +
    'y no se sabe de quién es esa superficie. **Trae las parcelas colindantes del Catastro** y ' +
    'vuelve a derivar: con ellas, la aplicación recorta a quien le toque y el expediente sale ' +
    'completo. El sobrante de arriba ya está bien medido.'
  )
}

/**
 * Y el porqué, que va al panel de avisos. Se separa de {@link motivoPuerta} por
 * el presupuesto de píxeles del pie, no por gusto: ver el aviso de allí.
 *
 * @param {import('../derivacion/cesion.js').PuertaCesion} puerta
 * @param {(n:number, d?:number) => string} formatear
 * @returns {string}
 */
export function explicacionPuerta(puerta, formatear) {
  return (
    `No se ha derivado ningún sobrante: la geometría medida se sale del contorno oficial en ` +
    `${puerta.piezas.length} sitio(s), ${formatear(puerta.area)} m² en total, y el trozo más ` +
    `ancho mide ${formatear(puerta.grosorMaximo, 4)} m. Lo que sobresale NO es sobrante propio: ` +
    `es terreno de alguien, y repartirlo (que pase al vecino o que sea una cesión) es un acto ` +
    `jurídico y no una operación geométrica. Esta versión no lo cubre; está anotado como la ` +
    `fase 2 de esta feature.`
  )
}

/** Cuando ni siquiera se ha podido MEDIR si cabe dentro. */
export const MOTIVO_PUERTA_INDECIDIBLE =
  'No se ha podido comprobar si la geometría medida cabe dentro del contorno oficial, así que ' +
  'no se deriva nada: un sobrante calculado sobre una comparación que ha fallado sería una ' +
  'cifra inventada. Mira el panel de avisos.'

/** El bloqueo que trae la propia derivación (detecciones ERROR). */
export const MOTIVO_BLOQUEADA =
  'La derivación no se puede entregar. Mira el panel de avisos: ahí está el detalle.'

/** Cuando el expediente compuesto no cierra. */
export const MOTIVO_NO_CIERRA =
  'El expediente NO cierra sobre el contorno oficial, así que no se descarga: un fichero que ' +
  'no cubre la finca de partida sale con IVG negativo aunque cada parcela suya sea impecable. ' +
  'Mira el panel de avisos.'

/**
 * Qué decir cuando el expediente se ha compuesto y no puede salir.
 *
 * ⛔ **Hasta el 2026-08-10 este renglón decía SIEMPRE {@link MOTIVO_NO_CIERRA}**, y
 * eso era mentir en la mitad de los casos. Medido sobre la parcela `6346726UF8664N`
 * del autor: el conjunto cerraba —`cierra: true`, suma, solape y cobertura las
 * tres— y lo que impedía la descarga era que el escritor de GML se negaba a emitir
 * una astilla de 0,0251 m². El usuario leyó «no cierra sobre el contorno oficial»,
 * se fue a buscar un problema de cierre que no existía, y concluyó que la
 * aplicación ya no dejaba hacer el caso. Un mensaje falso cuesta más que un botón
 * apagado.
 *
 * Así que el motivo sale de `entrega.bloqueos`, que es la lista de tipos que de
 * verdad han bloqueado. Los tipos sin frase propia caen en el genérico: es
 * preferible «no se puede entregar, mira los avisos» a una frase concreta y
 * equivocada.
 *
 * @param {import('../derivacion/entrega.js').Entrega} entrega
 * @returns {string}
 */
export function motivoEntregaBloqueada(entrega) {
  const bloqueos = Array.isArray(entrega?.bloqueos) ? entrega.bloqueos : []
  if (bloqueos.includes(TIPO_DERIVACION.CONJUNTO_NO_CIERRA)) return MOTIVO_NO_CIERRA

  /** Una frase por bloqueo, en el orden en que conviene leerlas. */
  const FRASES = {
    [TIPO_DERIVACION.CRECE_FUERA]:
      'la geometría medida se sale del contorno oficial y no se sabe de quién es esa superficie',
    [TIPO_DERIVACION.PIEZA_INVALIDA]:
      'una de las parcelas del expediente no se puede escribir en el fichero',
    [TIPO_DERIVACION.RECORTE_FALLIDO]:
      'no se ha podido recortar a alguno de los colindantes afectados',
    [TIPO_DERIVACION.ASIGNACION_IMPOSIBLE]:
      'un trozo del sobrante se ha asignado a un colindante con el que no linda',
    [TIPO_DERIVACION.SIN_GEOMETRIA_OFICIAL]:
      'esta parcela no trae la geometría del Catastro contra la que derivar',
    [TIPO_DERIVACION.RESTA_FALLIDA]: 'el motor geométrico ha fallado al calcular el sobrante',
    [TIPO_DERIVACION.REGION_NO_APTA]: 'alguna geometría no forma un recinto medible',
  }
  const dichas = bloqueos.map((t) => FRASES[t]).filter((f) => f !== undefined)

  if (dichas.length === 0) {
    return (
      'El expediente no se puede descargar. El detalle está en el panel de avisos: ahí sale qué ' +
      'lo impide, con sus cifras.'
    )
  }
  return (
    `El expediente no se puede descargar porque ${dichas.join('; y ')}. El detalle, con las ` +
    'cifras, está en el panel de avisos.'
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Formato español para las cifras de los motivos. Local, como en el visor. */
function formatearNumero(n, decimales = 2) {
  if (!Number.isFinite(n)) return 'sin medir'
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n)
}

/** Describe un valor para un mensaje de contrato roto. */
function describir(valor) {
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return 'un array'
  return typeof valor
}

/**
 * Localiza un nodo del contrato, o LANZA nombrándolo. Mismo criterio (y casi el
 * mismo texto) que `app/cableado-diagnostico.js#nodo`: el marcado de `index.html`
 * es contrato de este cableado, y un `querySelector` que devuelve `null` en
 * silencio deja el botón muerto sin síntoma.
 */
function nodo(selector, documento) {
  const encontrado = documento.querySelector(selector)
  if (encontrado === null) {
    throw new Error(
      `app/cableado-derivacion.js: la cáscara no tiene ningún nodo '${selector}'. El marcado ` +
        `de index.html es contrato de este cableado: si se ha renombrado o movido ese nodo, ` +
        `hay que arreglarlo en index.html, no aquí.`,
    )
  }
  return /** @type {HTMLElement} */ (encontrado)
}

/** Los recintos del POJO que haya en el store, sin dar nada por hecho. */
function recintosDe(parcela) {
  const recintos = parcela === null || parcela === undefined ? null : parcela.recintos
  return Array.isArray(recintos) ? recintos : []
}

/** El contorno OFICIAL del POJO, o `null`. Vacío y `null` significan lo mismo. */
function oficialDe(parcela) {
  const oficial = parcela === null || parcela === undefined ? null : parcela.geometriaOficial
  return Array.isArray(oficial) && oficial.length > 0 ? oficial : null
}

/**
 * ¿Tiene sentido ofrecer «Derivar sobrante»? Hay contorno oficial Y hay geometría
 * del usuario. Ni una comprobación más: ver la cabecera.
 *
 * No se exporta: es una regla INTERNA de esta pantalla, y sacarla invitaría a que
 * otro módulo decidiera con ella. Se comprueba desde fuera por su efecto (el
 * `disabled` del botón), que es lo que el usuario ve.
 */
function puedeDerivar(parcela) {
  return oficialDe(parcela) !== null && recintosDe(parcela).length > 0
}

/** Qué parcela es ésta, para distinguir «otra» de «la misma editada». */
function claveDeParcela(parcela) {
  if (parcela === null || parcela === undefined) return null
  const refcat = typeof parcela.refcat === 'string' ? parcela.refcat.trim() : ''
  if (refcat !== '') return `refcat:${refcat}`
  const idLocal = typeof parcela.idLocal === 'string' ? parcela.idLocal : ''
  return idLocal === '' ? null : `idLocal:${idLocal}`
}

/** La referencia catastral PARA EL NOMBRE del fichero, o `null`. */
function referenciaDe(parcela) {
  if (parcela === null || parcela === undefined) return null
  const refcat = typeof parcela.refcat === 'string' ? parcela.refcat : ''
  return refcat.trim() === '' ? null : refcat
}

// ── Contratos de las dependencias (duck typing, como en todo `app/`) ─────────

const esStore = (v) => !!v && typeof v.get === 'function' && typeof v.subscribe === 'function'

const esLista = (v) =>
  !!v &&
  typeof v.pintar === 'function' &&
  typeof v.invalidar === 'function' &&
  typeof v.seleccionadas === 'function' &&
  typeof v.asignaciones === 'function' &&
  typeof v.nombres === 'function' &&
  typeof v.entrega === 'function' &&
  typeof v.estado === 'function' &&
  typeof v.alEntregar === 'function' &&
  typeof v.alCambiarSeleccion === 'function' &&
  typeof v.alSenalar === 'function' &&
  typeof v.resaltar === 'function' &&
  !!v.nodo

const esCapa = (v) =>
  !!v &&
  typeof v.pintar === 'function' &&
  typeof v.resaltar === 'function' &&
  typeof v.alSenalar === 'function' &&
  typeof v.limpiar === 'function'

const esPanel = (v) => !!v && typeof v.avisar === 'function'

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Cablea el sobrante: los dos CTA, el bloque del panel, las manchas del mapa y la
 * entrega del expediente.
 *
 * ```js
 * const derivacion = cablearDerivacion({
 *   estado,
 *   lista: visor.sobrante.lista,
 *   capa: visor.sobrante.capa,
 *   panel,
 *   srs: SRS_DEMO,
 * })
 * // … al cerrar la aplicación:
 * derivacion.destruir()
 * ```
 *
 * @param {object} opciones
 * @param {import('../viewer/_comun.js').EstadoVista} opciones.estado  El store del
 *   visor. Se LEE y se ESCUCHA; **nunca se escribe**: derivar no edita la parcela.
 * @param {object} opciones.lista  `visor.sobrante.lista`.
 * @param {object} opciones.capa  `visor.sobrante.capa`.
 * @param {import('./avisos.js').PanelAvisos} opciones.panel  Panel de avisos: ahí
 *   van las DETECCIONES de la derivación y del expediente, que es lo que le pasa
 *   al DATO. Los motivos de los botones van en sus renglones, que es lo que le
 *   pasa a la ACCIÓN.
 * @param {string} opciones.srs  Forma corta (`'EPSG:25830'`…). Va a la validación
 *   de cada pieza y al documento.
 * @param {Document} [opciones.documento=globalThis.document]
 * @param {HTMLElement} [opciones.boton]  El CTA del pie. Por defecto, el de la cáscara.
 * @param {HTMLElement} [opciones.renglon]  Su `role="status"`.
 * @param {HTMLElement} [opciones.anfitrion]  La sección que aloja el bloque.
 * @param {() => Date} [opciones.ahora]  De dónde sale «ahora» para el
 *   `beginLifespanVersion` y para el nombre del fichero. Parámetro y no llamada
 *   directa por lo mismo que en `cablearDiagnostico` y `cablearGeneracionGml`:
 *   es lo único que permite afirmar algo exacto sobre el nombre en una prueba.
 * @param {typeof descargarGml} [opciones.descargar]  La entrega del fichero.
 * @returns {{derivar: () => (object|null), entregar: () => (object|null),
 *   ultimaCesion: () => (object|null), destruir: () => void}}
 * @throws {TypeError}  Contrato del programador.
 * @throws {Error}  Si la cáscara no trae los tres nodos del contrato.
 */
export function cablearDerivacion({
  estado,
  lista,
  capa,
  capaFuera,
  panel,
  srs,
  colindantes = null,
  documento = globalThis.document,
  boton,
  renglon,
  anfitrion,
  ahora = () => new Date(),
  descargar = descargarGml,
} = {}) {
  if (!esStore(estado)) {
    throw new TypeError(
      `cablearDerivacion: 'estado' debe ser el store de crearEstadoVista ({get, subscribe}); ` +
        `recibido ${describir(estado)}.`,
    )
  }
  if (!esLista(lista)) {
    throw new TypeError(
      `cablearDerivacion: 'lista' debe ser la de viewer/lista-sobrante.js (la devuelve ` +
        `crearVisor en visor.sobrante.lista); recibido ${describir(lista)}. Si vale undefined, ` +
        `el visor se montó sin 'sobrante: true'.`,
    )
  }
  if (!esCapa(capa)) {
    throw new TypeError(
      `cablearDerivacion: 'capa' debe ser la de viewer/piezas.js (visor.sobrante.capa); ` +
        `recibido ${describir(capa)}.`,
    )
  }
  if (!esCapa(capaFuera)) {
    throw new TypeError(
      `cablearDerivacion: 'capaFuera' debe ser la SEGUNDA capa de viewer/piezas.js ` +
        `(visor.sobrante.capaFuera, la de variante 'FUERA'); recibido ${describir(capaFuera)}. ` +
        `Si vale undefined, el visor es de antes de que la puerta dejara de esconder el ` +
        `sobrante: sin ella, lo que se sale del contorno oficial no se pintaría en ninguna ` +
        `parte y el usuario vería un botón apagado sin ver por qué.`,
    )
  }
  if (!esPanel(panel)) {
    throw new TypeError(
      `cablearDerivacion: 'panel' debe ser el de app/avisos.js ({avisar}); recibido ` +
        `${describir(panel)}. Las detecciones de la derivación van ahí: son lo que le pasa ` +
        `al DATO, no a la acción.`,
    )
  }
  if (typeof srs !== 'string' || srs.trim() === '') {
    throw new TypeError(
      `cablearDerivacion: 'srs' debe ser la forma corta del sistema de referencia ` +
        `(p. ej. 'EPSG:25830'); recibido ${describir(srs)}.`,
    )
  }
  if (colindantes !== null && typeof colindantes.get !== 'function') {
    throw new TypeError(
      `cablearDerivacion: 'colindantes' debe ser el registro de app/colindantes.js (el que ` +
        `publica get()), o null para no atribuir el exceso a nadie; recibido ` +
        `${describir(colindantes)}.`,
    )
  }
  if (typeof ahora !== 'function' || typeof descargar !== 'function') {
    throw new TypeError(
      `cablearDerivacion: 'ahora' y 'descargar' deben ser funciones; recibidos ` +
        `${typeof ahora} y ${typeof descargar}.`,
    )
  }

  const elBoton = boton ?? nodo(SELECTOR_BOTON, documento)
  const elRenglon = renglon ?? nodo(SELECTOR_ESTADO, documento)
  const laSeccion = anfitrion ?? nodo(SELECTOR_ANFITRION, documento)

  // El bloque se cuelga AQUÍ y no en `app/main.js`: quien conoce a la vez la
  // sección anfitriona y la lista es este módulo. La sección viene VACÍA de
  // `index.html` a propósito (ver su comentario), así que esto no pisa nada.
  laSeccion.append(lista.nodo)

  // ── Estado interno ────────────────────────────────────────────────────────
  let vivo = true
  /** La última FOTO derivada, o `null`. */
  let cesion = null
  /** La clave de la parcela sobre la que se derivó esa foto. */
  let claveDerivada = null
  /**
   * Lo que el usuario ha decidido repartir: `{orden: refcat}`.
   *
   * Vive AQUÍ y no dentro de la foto porque sobrevive al recálculo del recorte: al
   * cambiar un destino hay que volver a recortar a los vecinos con la asignación
   * nueva, y si el reparto viviera dentro de lo que se recalcula se perdería en el
   * mismo paso que lo usa. Caduca con la foto, como todo lo demás (3C).
   */
  let reparto = {}

  /** Escribe el renglón del CTA del pie. */
  function decir(texto, esError = false) {
    elRenglon.textContent = texto
    elRenglon.classList.toggle('gml-accion-estado--error', esError === true)
  }

  /** Publica en el panel de avisos lo que la derivación (o la entrega) detectó. */
  function publicar(detecciones) {
    if (!Array.isArray(detecciones)) return
    for (const d of detecciones) {
      panel.avisar(d.mensaje, { nivel: d.severidad === 'ERROR' ? NIVEL.ERROR : NIVEL.AVISO })
    }
  }

  /** Enseña o esconde el bloque. El `hidden` lo apaga `.gml-app [hidden]`. */
  function mostrarBloque(visible) {
    laSeccion.hidden = !visible
  }

  /**
   * La foto ha caducado (3C). Vacía las dos vistas —la lista Y las manchas— y lo
   * dice **en el bloque**, no en el canal global.
   */
  function invalidar(motivo) {
    cesion = null
    claveDerivada = null
    reparto = {}
    capa.limpiar()
    // Las DOS capas, siempre juntas: dejar las manchas ámbar de una foto caducada
    // sobre una geometría que ya ha cambiado sería enseñar una invasión que puede
    // que ya no exista, en el color que este proyecto reserva para el único hecho
    // al que le pone carga.
    capaFuera.limpiar()
    if (motivo === null) {
      lista.pintar(null)
      mostrarBloque(false)
    } else {
      lista.invalidar(motivo)
      // El bloque SE QUEDA a la vista mientras el mensaje esté puesto: esconderlo
      // haría desaparecer al mismo tiempo la lista y la explicación de por qué ha
      // desaparecido, que es la definición de fallo silencioso.
      mostrarBloque(true)
    }
  }

  /**
   * Recalcula lo BARATO: el estado del CTA del pie, con su motivo. Corre en cada
   * notificación del store, o sea en cada vértice arrastrado.
   */
  function refrescar(parcela) {
    if (!vivo) return

    const hayOficial = oficialDe(parcela) !== null
    const hayGeometria = recintosDe(parcela).length > 0
    elBoton.disabled = !(hayOficial && hayGeometria)
    if (elBoton.disabled) {
      decir(hayOficial ? MOTIVO_SIN_GEOMETRIA : MOTIVO_SIN_OFICIAL)
    } else if (cesion === null) {
      decir('')
    }

    // ── 3C · la foto caduca con CUALQUIER cambio ────────────────────────────
    if (cesion === null) return
    const clave = claveDeParcela(parcela)
    invalidar(
      clave === claveDerivada
        ? undefined // el texto por defecto: «la parcela ha cambiado»
        : 'Ha entrado otra parcela, así que el sobrante de la anterior ya no le corresponde. ' +
            'Los nombres escritos se han perdido: vuelve a derivar.',
    )
    decir('')
  }

  /**
   * Deriva. Es lo CARO: la resta booleana y la puerta.
   *
   * @returns {object|null}  La `Cesion`, o `null` si la puerta no deja pasar.
   */
  function derivar() {
    if (!vivo) return null
    const parcela = estado.get()
    if (!puedeDerivar(parcela)) {
      // No debería llegarse (el botón está apagado), pero llamar a `derivar()` es
      // legítimo desde un test o desde otro cable, y devolver `null` mudo sería lo
      // que la regla de oro 1 prohíbe.
      decir(oficialDe(parcela) === null ? MOTIVO_SIN_OFICIAL : MOTIVO_SIN_GEOMETRIA, true)
      return null
    }

    // Otra pulsación es otra FOTO, así que el reparto anterior no le corresponde
    // (3C). Se limpia ANTES de derivar para que `fotografiar` no arrastre una
    // asignación a una pieza que ya es otro trozo de terreno con el mismo número.
    reparto = {}

    let derivada
    try {
      derivada = derivarCesion({
        recintos: recintosDe(parcela),
        geometriaOficial: oficialDe(parcela),
      })
    } catch (causa) {
      // Un fallo INESPERADO del cálculo. Va al panel de avisos porque es lo que le
      // pasa al dato, y al renglón porque el usuario acaba de pulsar un botón y
      // tiene derecho a saber que no ha pasado nada.
      panel.avisar(`No se ha podido derivar el sobrante: ${causa?.message ?? causa}`, {
        nivel: NIVEL.ERROR,
      })
      decir('La derivación ha fallado. Mira el panel de avisos.', true)
      return null
    }

    // Regla de oro 1: TODO lo que decidió la derivación, al panel.
    publicar(derivada.detecciones)

    // ── LA PUERTA: AHORA SEPARA **VER** DE **ENTREGAR** ─────────────────────
    //
    // ⛔ Hasta el 2026-08-10 esto era `invalidar(null)`: se escondía el bloque
    // entero y el sobrante —ya restado, medido, ordenado y numerado tres líneas más
    // arriba— se tiraba sin que el usuario lo viera nunca. Y el caso no es
    // excepcional: rectificar un lindero es retranquearse por un lado y salirse por
    // otro. Medido sobre el expediente real 29050A01000144 (2026-08-10): 36,46 m²
    // de sobrante y 25,49 m² de exceso **a la vez**, y lo que se enseñaba eran cero
    // de los dos.
    //
    // Lo que NO cambia es la entrega. Esos metros son de un colindante y un
    // expediente sin él vuelve con IVG negativo, así que «Descargar expediente»
    // sigue apagado —con su motivo escrito, que es la otra mitad—. Quien lo apaga
    // es `refrescarEntrega`, que ahora mira la puerta.
    if (derivada.puerta.contenida === false) {
      panel.avisar(explicacionPuerta(derivada.puerta, formatearNumero), { nivel: NIVEL.AVISO })
      const foto = fotografiar(derivada, parcela)
      // Con el exceso ya atribuido a sus dueños, el renglón del pie se calla y deja
      // hablar al bloque: el expediente se puede descargar y repetir en rojo que «se
      // sale» sería alarmar por un hecho que la propia pantalla acaba de resolver.
      if (excesoExplicado()) return foto
      // ⚠️ **Y aquí el renglón del pie SÍ habla**, en contra de la regla de los
      // 22,84 px que `fotografiar` acaba de aplicar. La regla dice que se calle
      // cuando el bloque ya cuenta lo mismo, y su premisa es que lo que hay que
      // contar es *bueno*: cuántas piezas y cuánto miden. Aquí lo que hay que
      // contar es que **la acción que el usuario acaba de pulsar no ha desbloqueado
      // nada**, y eso no lo dice el bloque, que está más abajo y puede estar fuera
      // de la vista. Una línea corta, con la cifra y con el sitio donde mirar.
      decir(motivoPuerta(derivada.puerta, formatearNumero), true)
      return foto
    }
    if (derivada.puerta.contenida === null) {
      invalidar(null)
      decir(MOTIVO_PUERTA_INDECIDIBLE, true)
      return null
    }
    if (!derivada.puedeEntregarse) {
      invalidar(null)
      decir(MOTIVO_BLOQUEADA, true)
      return null
    }

    return fotografiar(derivada, parcela)
  }

  /**
   * Guarda la FOTO y la pinta en sus tres sitios: la lista, las manchas del
   * sobrante y las manchas de lo que se sale.
   *
   * Es el único camino por el que `cesion` deja de ser `null`, y lo comparten las
   * DOS salidas buenas de `derivar()` —la que cabe dentro y la que se sale—, que es
   * justo lo que hace que la segunda enseñe lo mismo que la primera. Encender o
   * apagar la descarga NO se decide aquí: es de `refrescarEntrega`, que mira la
   * puerta.
   *
   * @param {object} derivada  La `Cesion`.
   * @param {object} parcela   La parcela sobre la que se derivó, para la clave.
   * @returns {object}  La misma `Cesion`, para que `derivar()` la devuelva.
   */
  function fotografiar(derivada, parcela) {
    cesion = derivada
    claveDerivada = claveDeParcela(parcela)

    // ── A QUIÉN LE ESTAMOS QUITANDO TERRENO ─────────────────────────────────
    // Solo si hay algo que atribuir: sin exceso no hay a quién, y `recortarVecinos`
    // haría una resta booleana por cada colindante para no decir nada. La
    // atribución viaja DENTRO de la foto para que la lista no tenga que ir a
    // buscarla a otro sitio, y para que caduque con ella (decisión 3C).
    derivada.recorte =
      derivada.puerta.piezas.length === 0
        ? null
        : recortarVecinos({
            recintos: recintosDe(parcela),
            // El sobrante entra para poder decir con QUIÉN linda cada trozo, que es
            // lo que decide qué destinos se le ofrecen al usuario.
            sobrante: derivada.piezas,
            asignadas: reparto,
            // ⛔ `?? null` y no `?? []`: sin registro NO se ha consultado, y `[]`
            // afirmaría que la parcela está aislada y que el exceso cae sobre un
            // vial. Ver la cabecera de `app/colindantes.js`.
            vecinas: colindantes === null ? null : colindantes.get(),
            fuera: derivada.puerta.piezas,
          })
    if (derivada.recorte !== null) publicar(derivada.recorte.detecciones)

    lista.pintar(derivada)
    capa.pintar(derivada.piezas)
    capaFuera.pintar(derivada.puerta.piezas)
    mostrarBloque(true)

    // ⛔ **CON ALGO QUE ENSEÑAR, EL RENGLÓN DEL PIE SE CALLA**, y no es un descuido
    // de la regla de oro 1: lo que tendría que decir —cuántas piezas y cuánto
    // miden— lo dice ya el BLOQUE, con su contador y una fila por pieza, y lo dice
    // mejor porque cada cifra está junto a la pieza que describe. Repetirlo aquí es
    // una segunda redacción del mismo hecho que además CUESTA: medido por el guion
    // 16, el renglón le quita **22,84 px** a la tabla de vértices, que a 1280×720
    // son casi tres cuartos de fila de las quince. `.gml-accion-estado:empty` lo
    // colapsa a 0 px, así que el hueco se devuelve entero.
    //
    // ⚠️ La condición es «el bloque enseña algo», no «hay sobrante». Desde que la
    // puerta dejó de esconder, el bloque puede estar poblado **solo** con la
    // sección del exceso —cero piezas de sobrante y tres trozos fuera es un
    // resultado legítimo: la parcela solo ha crecido—. Preguntar por
    // `piezas.length` a secas volvería a escribir el renglón encima de un bloque
    // que ya habla, y pagaría los 22,84 px por nada.
    const bloqueHabla = derivada.piezas.length > 0 || derivada.puerta.piezas.length > 0
    decir(
      bloqueHabla ? '' : 'No hay sobrante: la geometría medida cubre el contorno oficial entero.',
    )
    refrescarEntrega()
    return derivada
  }

  /**
   * ¿Está EXPLICADO todo lo que la geometría medida se sale?
   *
   * Lo está cuando se han consultado las colindantes: entonces cada metro de más
   * está atribuido a un vecino concreto —que entra en el expediente con su parcela
   * recortada— o declarado en `sobreNadie` (vial, dominio público, hueco del
   * parcelario), que es un caso legítimo y no un fallo.
   *
   * ⛔ Mira `consultado` y no `vecinos.length`: con las vecinas traídas y ninguna
   * afectada, el exceso entero es vial y sigue estando explicado. Sin traerlas no se
   * sabe nada, y «no le quito a nadie» y «no he mirado» son afirmaciones opuestas.
   */
  function excesoExplicado() {
    return cesion !== null && cesion.recorte != null && cesion.recorte.consultado === true
  }

  /**
   * El usuario ha cambiado el DESTINO de una pieza: hay que volver a recortar.
   *
   * ⛔ **No se repinta la lista**, y es deliberado: repintar reconstruye los
   * desplegables y perdería la elección que el usuario acaba de hacer, además de las
   * de las demás filas y los nombres escritos. Lo que cambia al asignar un trozo no
   * es el sobrante —esas piezas siguen siendo las mismas— sino los VECINOS, que no
   * se pintan en esta lista. Así que se recalcula el recorte en silencio y se
   * refresca lo único que sí cambia: si la entrega puede salir.
   */
  function repartir() {
    if (!vivo || cesion === null) return
    reparto = lista.asignaciones()
    const parcela = estado.get()
    try {
      cesion.recorte = recortarVecinos({
        recintos: recintosDe(parcela),
        vecinas: colindantes === null ? null : colindantes.get(),
        fuera: cesion.puerta.piezas,
        sobrante: cesion.piezas,
        asignadas: reparto,
      })
    } catch (causa) {
      panel.avisar(`No se ha podido repartir el sobrante: ${causa?.message ?? causa}`, {
        nivel: NIVEL.ERROR,
      })
      return
    }
    // Solo las de ERROR: las informativas del recorte ya se publicaron al derivar, y
    // repetirlas en cada cambio de desplegable llenaría el panel de duplicados.
    publicar(cesion.recorte.detecciones.filter((d) => d.severidad === 'ERROR'))
    refrescarEntrega()
  }

  /**
   * Enciende o apaga «Descargar expediente», SIEMPRE con su motivo.
   *
   * ⛔ **Aquí es donde vive ahora la puerta.** Antes bastaba con que hubiera foto,
   * porque una foto con exceso no llegaba nunca a existir: el bloque se escondía y
   * `cesion` se quedaba en `null`. Desde que VER y ENTREGAR se separaron, hay fotos
   * perfectamente pintadas que **no se pueden descargar**, y el sitio donde se dice
   * es éste — el renglón que cuelga del propio botón por `aria-describedby`.
   *
   * El orden de las tres preguntas importa: primero si hay foto, luego si la foto
   * cabe dentro de lo oficial, y solo al final si el usuario ha dejado alguna pieza
   * marcada. Al revés, una foto que se sale con todo desmarcado diría «marca al
   * menos una pieza» — un consejo que no arregla nada, porque marcarlas todas
   * seguiría sin poder descargar.
   */
  function refrescarEntrega() {
    if (cesion === null) {
      lista.entrega({ habilitado: false, motivo: MOTIVO_SIN_DERIVAR })
      return
    }
    // ⛔ La puerta solo sigue cerrada si el exceso NO está explicado. Con las
    // colindantes traídas, cada metro que la medición se sale está atribuido a un
    // vecino —que entra recortado en el fichero— o declarado sobre vial, y entonces
    // el expediente SÍ se puede presentar. Ver `derivacion/entrega.js`, que aplica
    // la misma regla sobre el bloqueo real.
    if (cesion.puerta.contenida === false && !excesoExplicado()) {
      lista.entrega({
        habilitado: false,
        motivo: motivoEntregaFuera(cesion.puerta, formatearNumero),
      })
      return
    }
    // ⛔ Cero piezas propias NO es cero expediente desde que existe el reparto: si
    // todos los trozos se los quedan colindantes, el fichero sale con la parcela y
    // los vecinos y **no lleva ningún alta**, que es un expediente perfectamente
    // válido —medido sobre el real: 4 miembros, ninguno de alta, cierra—. Lo que no
    // vale es que no quede NADA que declarar.
    //
    // ⛔ Y «los vecinos» son DOS casos, no uno. El del reparto —alguien recibe un
    // trozo— y el del RECORTE: la medición invade a un colindante y su parcela entra
    // corregida sin que nadie le dé nada. El segundo faltaba, y con él se caía justo
    // el caso que F23 existe para resolver: medido el 2026-08-10 sobre
    // `6346726UF8664N`, cuyo único trozo de sobrante es una astilla del enganche que
    // no se puede emitir. Cero altas, cero reparto, y aun así **dos parcelas que
    // declarar**.
    const hayReparto = Object.keys(lista.asignaciones()).length > 0
    const hayVecinos = (cesion.recorte?.vecinos?.length ?? 0) > 0
    if (
      lista.seleccionadas().length === 0 &&
      !hayReparto &&
      !hayVecinos &&
      cesion.piezas.length > 0
    ) {
      lista.entrega({ habilitado: false, motivo: MOTIVO_NINGUNA_INCLUIDA })
      return
    }
    lista.entrega({ habilitado: true, motivo: '' })
  }

  /**
   * Compone el expediente entero y lo entrega. UN solo fichero con N
   * `gml:featureMember` — el ZIP se canceló por medición, y una sola descarga
   * evita por diseño el bloqueo de la segunda descarga automática, que **no se
   * puede detectar desde JavaScript**.
   *
   * @returns {object|null}  El resultado de la descarga, o `null`.
   */
  function entregar() {
    if (!vivo || cesion === null) return null

    // ⛔ **La puerta, otra vez y aquí dentro.** No es redundancia con
    // `refrescarEntrega`: aquél apaga un BOTÓN, y `entregar()` es una función
    // pública del cableado que llaman también los tests y podría llamar otro cable.
    // Fiar la única defensa a un `disabled` del DOM es fiarla a la interfaz, y lo
    // que hay al otro lado es un fichero que alguien firma. `prepararEntrega`
    // también lo pararía —`cesion.puedeEntregarse` es `false` con `CRECE_FUERA`—,
    // pero lo diría con el motivo de «no cierra», que es otro hecho: aquí el
    // conjunto no es que no cierre, es que le falta un titular.
    if (cesion.puerta.contenida === false && !excesoExplicado()) {
      lista.estado(motivoEntregaFuera(cesion.puerta, formatearNumero), { error: true })
      return null
    }

    const parcela = estado.get()
    const fecha = ahora()

    let entrega
    try {
      entrega = prepararEntrega({
        parcela,
        srs,
        cesion,
        // El recorte viaja con la FOTO, así que lo que se entrega es exactamente lo
        // que el usuario tiene delante: los mismos vecinos, con las mismas cifras.
        // Volver a calcularlo aquí podría dar otro resultado si algo hubiera
        // cambiado, y eso es lo que la decisión 3C prohíbe.
        recorte: cesion.recorte ?? null,
        incluidas: lista.seleccionadas(),
        nombres: lista.nombres(),
      })
    } catch (causa) {
      panel.avisar(`No se ha podido componer el expediente: ${causa?.message ?? causa}`, {
        nivel: NIVEL.ERROR,
      })
      lista.estado('La composición del expediente ha fallado. Mira el panel de avisos.', {
        error: true,
      })
      return null
    }

    publicar(entrega.detecciones)

    // ⛔ NO BASTA `xml !== null`. El fichero de una sola parcela sería un GML
    // impecable y válido contra el XSD; lo que estaría mal es el EXPEDIENTE, y eso
    // no lo ve ningún validador de esquema. `puedeEntregarse` es lo que hay que
    // mirar, y lo dice `derivacion/entrega.js` tras las TRES afirmaciones del
    // cierre (suma, cero solape, cobertura).
    if (!entrega.puedeEntregarse || entrega.xml === null) {
      lista.estado(motivoEntregaBloqueada(entrega), { error: true })
      return null
    }

    const resultado = descargar(entrega.xml, {
      refcat: referenciaDe(parcela),
      fecha,
      // El HECHO, no el prefijo: `nombreFicheroGml` decide con él si el fichero se
      // llama «parcela-…» o «expediente-…». Si el llamante pudiera elegir el
      // nombre, podría llamar «parcela» a un fichero con tres.
      miembros: entrega.nMiembros,
      documento,
    })
    lista.estado(
      resultado.descargado
        ? `Descargado «${resultado.nombre}» con ${entrega.nMiembros} parcelas.`
        : resultado.mensaje,
      { error: !resultado.descargado },
    )
    return resultado
  }

  // ── Los cables ────────────────────────────────────────────────────────────

  elBoton.addEventListener('click', derivar)
  const bajaEntrega = lista.alEntregar(entregar)
  const bajaSeleccion = lista.alCambiarSeleccion(repartir)

  // El resaltado RECÍPROCO, que es media razón de ser de esta pantalla. Ni la
  // lista conoce el mapa ni el mapa la lista: los une este módulo, y en los dos
  // sentidos. La reentrada no es un problema porque los dos `resaltar` son
  // idempotentes y no vuelven a emitir.
  const bajaSenalLista = lista.alSenalar((orden) => capa.resaltar(orden))
  const bajaSenalCapa = capa.alSenalar((orden) => lista.resaltar(orden))

  const bajaStore = estado.subscribe(refrescar)
  // `subscribe` NO notifica al suscribirse, así que el primer estado del botón se
  // calcula a mano. Sin esta línea el CTA se quedaría en el `disabled` con el que
  // nace en `index.html` —y con el renglón vacío— hasta la primera edición:
  // exactamente el botón gris y mudo que no se admite.
  refrescar(estado.get())
  mostrarBloque(false)

  return {
    derivar,
    entregar,
    ultimaCesion: () => cesion,

    destruir() {
      if (!vivo) return
      vivo = false
      elBoton.removeEventListener('click', derivar)
      bajaEntrega()
      bajaSeleccion()
      bajaSenalLista()
      bajaSenalCapa()
      bajaStore()
    },
  }
}

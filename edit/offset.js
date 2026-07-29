// edit/offset.js — F06 · Desplazamiento de un lindero en paralelo (offset perpendicular).
//
// La operación MÁS USADA de toda la edición (plan §6): el usuario señala un lado
// del recinto, teclea una distancia y el lindero se mueve perpendicularmente a sí
// mismo. Los dos vértices que lo sostienen NO se trasladan con él: se RECALCULAN
// cortando la recta desplazada con las rectas de los dos linderos vecinos, de
// modo que esos vecinos siguen sobre SU MISMA RECTA y el resto del polígono no se
// deforma. Es la diferencia entre «mover un lindero» y «arrastrar dos vértices»,
// y es justo lo que un lindero real necesita: el lado contiguo suele ser un
// límite con un colindante, y su DIRECCIÓN no puede cambiar porque nosotros
// movamos el nuestro.
//
// Fórmula (dossier §3.6 «Algoritmos de edición», línea 569):
//   u = (Vi+1 − Vi)/|Vi+1 − Vi|;   nrm = (u.y, −u.x)
//   recta desplazada L' por A' = Vi + d·nrm, con dirección u
//   Vi_new   = intersectRectas(L', recta(Vi−1, Vi))
//   Vi+1_new = intersectRectas(L', recta(Vi+1, Vi+2))
// La intersección la hace `geo/segmento.js#intersectarRectas`, que ya trabaja
// trasladando a origen local (regla de oro 5) y que declara `paralelas` en vez de
// devolver una coordenada disparada cuando el seno del ángulo cae por debajo de
// la tolerancia. Aquí NO se re-implementa nada de eso.
//
// ── 1 · EL SIGNO: «hacia fuera» no es una convención, se MIDE ────────────────
//
// `nrm = (u.y, −u.x)` es `u` girado −90°: la normal a la DERECHA del sentido de
// recorrido. En un anillo ANTIHORARIO el interior queda a la izquierda, luego la
// derecha es el exterior; en uno HORARIO ocurre lo contrario. Este proyecto se
// encuentra LOS DOS sentidos —el Catastro emite el exterior horario (SPEC §3,
// override O1), su propia plantilla oficial lo trae antihorario, y el usuario
// dibuja como quiere—, así que el signo NO puede venir de una convención
// implícita: se obtiene de `geo/area.js#orientacion(anillo)`, que es el signo del
// área firmada del anillo REALMENTE recibido.
//
//   nrm_fuera = orientacion(anillo) · (u.y, −u.x)
//
// Con eso, `distancia > 0` aleja el lado del INTERIOR DE SU PROPIO ANILLO en los
// dos sentidos de giro, y el área encerrada por ESE anillo siempre crece.
//
// ── 2 · QUÉ SIGNIFICA `distancia > 0` EN UN HUECO ────────────────────────────
//
// La regla de arriba es del ANILLO, no de la parcela, y en un hueco las dos cosas
// se separan: «fuera del anillo del hueco» es «hacia el material de la parcela»,
// o sea el hueco SE AGRANDA y la superficie NETA (exterior − huecos,
// `geo/area.js#superficie`) DISMINUYE. Es deliberado y es lo que ve el usuario:
// el gesto es «aleja este lindero del recinto al que pertenece», y el recinto al
// que pertenece el lado de un hueco es el hueco. La alternativa —que
// `distancia > 0` significara siempre «más superficie neta»— haría que el MISMO
// gesto sobre dos anillos dibujados igual moviera el lindero en direcciones
// opuestas según una etiqueta (`tipo: 'HUECO'`) que no se ve en el mapa. Por eso
// este módulo no mira `tipo` en absoluto: solo el sentido de giro del anillo que
// edita.
//
// ── 3 · EL FALLBACK: por qué DOS, y cuál en cada caso ────────────────────────
//
// El vértice recalculado se aleja del original |d|/|sin θ|, con θ el ángulo entre
// el lindero desplazado y su vecino. Eso DIVERGE: con θ = 1°, un offset de 0,50 m
// lleva el vértice a 28,6 m. Sin tope, un pico agudo de una parcela real
// convierte el recinto en un rayo. Hay por tanto dos guardas y las dos actúan:
//
//   · PARALELISMO — `intersectarRectas` devuelve `paralelas: true` cuando
//     |seno| < `senoMinimo` (`OPERATIVOS.senoMinimoOffset`). Nótese qué significa
//     eso aquí: las dos rectas PASAN POR EL MISMO VÉRTICE, así que «paralelas»
//     equivale a «colineales» — ese vértice no es una esquina, es un punto de
//     paso en mitad de una recta. No hay corte que calcular porque no hay esquina.
//   · MITER-LIMIT — aunque haya corte, si |Vi_new − Vi| / |d| > `miterLimite`
//     (`OPERATIVOS.miterLimiteFactor`, el `stroke-miterlimit` por defecto de SVG)
//     la esquina es demasiado aguda y el corte, aunque numéricamente sano, es un
//     artefacto: nadie pide mover un lindero medio metro para que una esquina
//     viaje treinta.
//
// Y la elección, que es lo que hay que razonar:
//
//   · PARALELISMO → **TRASLACION**. Al no haber esquina no hay recta sobre la que
//     deslizar el vértice, así que el vértice se traslada `d·nrm` como el propio
//     lado. Es la única salida cerrada y estable; cualquier otra cosa sería
//     inventar una esquina que el dibujo no tiene.
//   · MITER-LIMIT → **BEVEL**. Aquí sí hay esquina, y esto es lo importante: el
//     MITER conserva la RECTA del lindero vecino (lo alarga o lo acorta, pero no
//     lo gira) y el BEVEL conserva el lindero vecino ENTERO (no lo toca: añade un
//     chaflán de longitud |d|). La TRASLACION es la única de las tres que GIRA el
//     lindero contiguo, y girar el límite con un colindante es exactamente lo que
//     no se puede hacer a espaldas de nadie. Por eso la traslación queda reservada
//     al caso en que no hay lindero contiguo con dirección propia que respetar, y
//     el pico agudo se bisela — que además es lo que el `miterlimit` significa en
//     todo el renderizado vectorial desde hace décadas.
//
// PRECEDENCIA de `modo`, que es UNO para toda la operación mientras que los
// extremos se resuelven por separado: gana el más DEGRADADO, con el orden
// TRASLACION > BEVEL > MITER — el mismo orden del párrafo anterior, de más a
// menos invasivo sobre lo que el usuario ya había dibujado. `modo` es el resumen
// para el botón; el detalle de QUÉ extremo cayó y por qué está en `detecciones`,
// una por extremo, con el índice del vértice escrito en el texto.
//
// ── 4 · NADA EN SILENCIO (regla de oro 1) ────────────────────────────────────
//
// Toda caída al fallback, todo lado que no se puede desplazar y toda orientación
// que no se ha podido determinar salen en `detecciones` con un `mensaje` en
// español PRESENTABLE TAL CUAL en el renglón de estado. Y la frontera de siempre:
//   · Dato/gesto del USUARIO que no se puede atender (un lado de longitud cero,
//     un anillo de dos vértices, distancia 0) → se devuelven los `recintos` SIN
//     TOCAR y una detección que lo cuenta. NUNCA `throw`: el usuario pincha donde
//     quiere.
//   · Contrato roto por el PROGRAMADOR (`recintos` que no es array, índice fuera
//     de rango, distancia no finita, opciones fuera de dominio) → `TypeError` /
//     `RangeError` nombrando el argumento y lo recibido.
//
// ── 5 · Invariantes ──────────────────────────────────────────────────────────
//
//   · Regla 2 — aquí no llega `geometriaOficial`: se recibe y se devuelve
//     `recintos`, la geometría EDITABLE, y nada más.
//   · Regla 4 — POJO plano, `[x, y]` en UTM, anillos ABIERTOS. El lado `indice`
//     va de `v[indice]` a `v[(indice+1) % n]`, así que con `indice = n−1` el lado
//     es el de CIERRE, y no necesita ningún caso especial: todo el módulo usa el
//     módulo del anillo.
//   · INMUTABILIDAD — se devuelve estructura NUEVA, con arrays de vértices nuevos
//     y pares `[x,y]` nuevos, sin compartir ni una referencia con la entrada. No
//     es cosmética: `edit/historial.js#commit` fotografía con `structuredClone`, y
//     una mutación en sitio dejaría al presente y a su snapshot compartiendo
//     memoria (el undo dejaría de deshacer).
//   · Módulo PURO: sin DOM, sin Leaflet, sin estado, sin reloj.
//
// NOTA DE DEUDA (T2.2) CERRADA en T3.4: `exigirRecintos`/`exigirRef`/`describir`
// eran gemelas de las de `edit/vertices.js`, duplicadas a propósito porque esta
// tarea corría en paralelo con otras dos de `edit/` y crear entonces un
// `edit/_comun.js` compartido habría sido editar un fichero que otra tarea
// estaba creando a la vez. Cerradas las tres, la extracción vive en
// `edit/_comun.js` — que documenta también la única divergencia real que había
// entre las dos copias de `exigirRef` (la redacción del mensaje). `describir`
// y `exigirRecintos` eran, en cambio, IDÉNTICAS byte a byte en ambos módulos.
// `exigirDistancia` y `exigirOpciones` se quedan aquí: solo las llama este
// módulo, y un helper con un único llamante no es reutilización.

import { intersectarRectas, LONGITUD_NULA_METROS } from '../geo/segmento.js'
import { areaFirmada, orientacion } from '../geo/area.js'
import { distancia as distanciaEntre } from '../geo/metrica.js'
import { OPERATIVOS } from '../config/operativos.js'
import { MINIMO_VERTICES } from './vertices.js'
import { describir, exigirRecintos, exigirRef } from './_comun.js'

/**
 * @typedef {import('../validation/_comun.js').RefVertice} RefVertice
 *   `{recinto, indice}` sobre el anillo ABIERTO. Se ALIASA el typedef de la
 *   validación, igual que hace `edit/vertices.js`: la UI resalta vértices con esa
 *   misma forma y las definiciones no pueden divergir si solo hay una.
 */

/**
 * @typedef {{vertices: Array<[number,number]>, tipo: string}} Recinto
 */

/**
 * @typedef {Object} DeteccionOffset
 * @property {string} tipo     Clave de {@link TIPO_OFFSET}. Código ESTABLE: la UI
 *   puede decidir con él sin analizar ningún texto.
 * @property {string} mensaje  Español, presentable TAL CUAL al usuario.
 */

/**
 * @typedef {Object} ResultadoOffset
 * @property {Recinto[]} recintos  Estructura NUEVA. Si la operación no se pudo
 *   aplicar, es una COPIA de la entrada, sin tocar (nunca `null`: el llamante
 *   siempre puede pintar lo que recibe).
 * @property {string} modo         Clave de {@link MODO_OFFSET}: el fallback más
 *   degradado que se aplicó en alguno de los dos extremos; `MITER` = ninguno.
 * @property {DeteccionOffset[]} detecciones  Vacío si no hubo nada que contar.
 */

// ── Vocabulario público ──────────────────────────────────────────────────────

/**
 * Cómo se resolvieron los vértices contiguos al lindero desplazado.
 *
 *   · `MITER`       — nominal: cada vértice se recalculó cortando la recta
 *                     desplazada con la del lindero vecino. NINGÚN fallback.
 *   · `BEVEL`       — al menos una esquina era demasiado aguda (miter-limit) y se
 *                     ha biselado: el vértice original se CONSERVA y se añade uno
 *                     nuevo a |d| de él, formando un chaflán.
 *   · `TRASLACION`  — al menos un extremo no tenía esquina donde apoyarse (el
 *                     lindero vecino es prolongación del desplazado) y se ha
 *                     trasladado `d·nrm`, como el propio lado.
 *
 * Es UNO por operación aunque los extremos se resuelvan por separado; cuando cada
 * extremo cae por un motivo distinto gana el más degradado, con la precedencia
 * TRASLACION > BEVEL > MITER (el porqué, en la cabecera del módulo §3). El
 * desglose por extremo va en las {@link DeteccionOffset}.
 *
 * @readonly
 */
export const MODO_OFFSET = Object.freeze({
  MITER: 'MITER',
  BEVEL: 'BEVEL',
  TRASLACION: 'TRASLACION',
})

/**
 * Prioridad de degradación de {@link MODO_OFFSET}: a mayor número, más invasiva
 * es la solución sobre lo que el usuario ya había dibujado, y por tanto más
 * merece ser LO QUE SE CUENTA cuando los dos extremos no coinciden.
 *
 * MITER no toca nada más que los dos vértices del lado. BEVEL tampoco mueve el
 * lindero vecino, pero añade un vértice que el usuario no dibujó. TRASLACION es
 * la única que GIRA el lindero vecino. De ahí el orden.
 *
 * @readonly
 * @type {Readonly<Record<string, number>>}
 */
const PRIORIDAD_MODO = Object.freeze({
  [MODO_OFFSET.MITER]: 0,
  [MODO_OFFSET.BEVEL]: 1,
  [MODO_OFFSET.TRASLACION]: 2,
})

/**
 * Tipos de {@link DeteccionOffset}. **Códigos estables**, mismo trato que
 * `MOTIVO_VERTICE` en `edit/vertices.js` y que `TIPO_GML` en `gml/_comun.js`: la
 * UI ramifica sobre el código, nunca sobre el texto.
 *
 * @readonly
 */
export const TIPO_OFFSET = Object.freeze({
  /** El desplazamiento pedido es exactamente 0 m: no hay nada que mover. */
  SIN_DESPLAZAMIENTO: 'SIN_DESPLAZAMIENTO',
  /** El anillo tiene menos de {@link MINIMO_VERTICES} vértices: no tiene lados. */
  ANILLO_INSUFICIENTE: 'ANILLO_INSUFICIENTE',
  /** Los dos extremos del lado señalado son el mismo punto: no hay dirección. */
  LADO_DEGENERADO: 'LADO_DEGENERADO',
  /** El área firmada del anillo es ≈ 0: no se puede saber cuál es su lado de fuera. */
  ORIENTACION_INDETERMINADA: 'ORIENTACION_INDETERMINADA',
  /** Un extremo no tenía esquina (lindero vecino colineal) → TRASLACION. */
  EXTREMO_TRASLADADO: 'EXTREMO_TRASLADADO',
  /** Un extremo tenía la esquina demasiado aguda (miter-limit) → BEVEL. */
  EXTREMO_BISELADO: 'EXTREMO_BISELADO',
})

/**
 * Texto en español, presentable TAL CUAL, para cada {@link TIPO_OFFSET}.
 *
 * Son FUNCIONES y no cadenas —a diferencia de `MENSAJE_POR_MOTIVO` en
 * `edit/vertices.js`— porque aquí el mensaje solo es útil con las cifras dentro:
 * «la esquina es demasiado aguda» no dice nada; «la esquina del vértice 7 mide
 * 1,0° y el vértice se iría a 28,65 m» sí. Mapa explícito y TOTAL, sin `default`:
 * un `default` es justamente lo que hace que un tipo nuevo herede un texto que
 * nadie ha escrito.
 *
 * Viven aquí y no en la UI para que ninguna pantalla redacte el motivo a mano y
 * para que dos pantallas no lo redacten distinto.
 *
 * @readonly
 * @type {Readonly<Record<string, (datos?: Object) => string>>}
 */
export const MENSAJE_OFFSET = Object.freeze({
  [TIPO_OFFSET.SIN_DESPLAZAMIENTO]: () =>
    'El desplazamiento pedido es de 0 m: el lindero se queda donde está. Escribe una distancia ' +
    'distinta de cero — positiva para alejarlo del recinto al que pertenece, negativa para ' +
    'acercarlo.',

  [TIPO_OFFSET.ANILLO_INSUFICIENTE]: ({ recinto, n }) =>
    `No se ha desplazado el lindero: el recinto ${recinto} tiene ${n} vértice(s) y hacen falta ` +
    `al menos ${MINIMO_VERTICES} para que haya lados que mover. La geometría no se ha modificado.`,

  [TIPO_OFFSET.LADO_DEGENERADO]: ({ recinto, desde, hasta }) =>
    `No se ha desplazado el lindero: el lado del vértice ${desde} al ${hasta} del recinto ` +
    `${recinto} tiene longitud cero —sus dos extremos son el mismo punto—, así que no hay ` +
    `dirección perpendicular que seguir. Elimina el vértice duplicado y vuelve a intentarlo. ` +
    `La geometría no se ha modificado.`,

  [TIPO_OFFSET.ORIENTACION_INDETERMINADA]: ({ recinto, areaFirmada: af }) =>
    `El recinto ${recinto} encierra un área prácticamente nula (${af.toExponential(2)} m²): sus ` +
    `vértices están alineados o el anillo se pliega sobre sí mismo, así que no se puede saber ` +
    `cuál es su lado de fuera. El lindero se ha desplazado suponiendo que el recinto se recorre ` +
    `en sentido antihorario; comprueba el resultado, porque puede haberse movido al revés.`,

  [TIPO_OFFSET.EXTREMO_TRASLADADO]: ({ vertice, grados, metros }) =>
    `El lindero contiguo al vértice ${vertice} es prolongación del que estás desplazando (forman ` +
    `${grados}°, no una esquina), así que no hay ningún punto de corte donde apoyar el vértice. ` +
    `Ese extremo se ha trasladado ${metros} m en paralelo, igual que el lindero: el lindero ` +
    `contiguo cambia de dirección. Revísalo si ese lado es un límite con un colindante.`,

  [TIPO_OFFSET.EXTREMO_BISELADO]: ({ vertice, grados, saltoMetros, veces, metros }) =>
    `La esquina del vértice ${vertice} es demasiado aguda (${grados}°): prolongar el lindero ` +
    `contiguo llevaría ese vértice a ${saltoMetros} m de donde está, ${veces} veces el ` +
    `desplazamiento pedido. Se ha biselado la esquina en su lugar —el lindero contiguo se queda ` +
    `como estaba y se añade un vértice a ${metros} m—, para no lanzar la punta del recinto.`,
})

/**
 * Guardián de carga: {@link MENSAJE_OFFSET} tiene que ser TOTAL sobre
 * {@link TIPO_OFFSET}. Si mañana se añade un tipo y aquí no se le escribe texto,
 * el módulo **no se carga** en vez de dejar un renglón en blanco la primera vez
 * que ese tipo aparezca en pantalla. Ruidoso a propósito, y por el mismo motivo
 * que sus gemelos de `edit/vertices.js` y `services/catastro.js`: un módulo que no
 * carga se arregla en cinco minutos; un mensaje vacío no lo ve nadie hasta que lo
 * ve un cliente.
 */
for (const tipo of Object.values(TIPO_OFFSET)) {
  /* c8 ignore next 6 -- solo se alcanza si el catálogo crece y los mensajes no */
  if (typeof MENSAJE_OFFSET[tipo] !== 'function') {
    throw new Error(
      `edit/offset: falta el mensaje de TIPO_OFFSET.${tipo}. Un tipo nuevo tiene que llegar a la ` +
        `pantalla con un texto decidido por alguien, no con un renglón en blanco.`,
    )
  }
}

// ── Helpers internos ─────────────────────────────────────────────────────────

/** Contrato del llamante: `distancia` es un número finito de metros. */
function exigirDistancia(valor, fn) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new TypeError(
      `${fn}: 'distancia' debe ser un número finito de metros (positiva = hacia fuera del ` +
        `anillo); recibido ${describir(valor)}.`,
    )
  }
  return valor
}

/**
 * Contrato del llamante sobre `opciones`, con los defectos de
 * `config/operativos.json` (NUNCA cifras escritas a mano aquí).
 *
 * `miterLimite` admite `Infinity` a propósito y está documentado: es la única
 * forma de pedir «sin bisel», y la usa el test que demuestra que sin la guarda el
 * vértice se va a decenas de metros. Un guardián que no se puede desactivar
 * tampoco se puede demostrar.
 */
function exigirOpciones(opciones, fn) {
  if (opciones === null || typeof opciones !== 'object' || Array.isArray(opciones)) {
    throw new TypeError(
      `${fn}: 'opciones' debe ser un objeto {senoMinimo, miterLimite}; ` +
        `recibido ${describir(opciones)}.`,
    )
  }
  const {
    senoMinimo = OPERATIVOS.senoMinimoOffset,
    miterLimite = OPERATIVOS.miterLimiteFactor,
  } = opciones

  if (typeof senoMinimo !== 'number' || !Number.isFinite(senoMinimo)) {
    throw new TypeError(
      `${fn}: 'opciones.senoMinimo' debe ser un número finito; recibido ${describir(senoMinimo)}.`,
    )
  }
  if (senoMinimo < 0 || senoMinimo >= 1) {
    throw new RangeError(
      `${fn}: 'opciones.senoMinimo' debe estar en [0,1) — es un seno, adimensional; ` +
        `recibido ${senoMinimo}.`,
    )
  }
  if (typeof miterLimite !== 'number' || Number.isNaN(miterLimite)) {
    throw new TypeError(
      `${fn}: 'opciones.miterLimite' debe ser un número (Infinity = sin bisel); ` +
        `recibido ${describir(miterLimite)}.`,
    )
  }
  if (miterLimite < 1) {
    throw new RangeError(
      `${fn}: 'opciones.miterLimite' debe ser ≥ 1; recibido ${miterLimite}. La razón ` +
        `|vértice desplazado| / |distancia| vale 1/|sin θ| y nunca baja de 1, así que un límite ` +
        `menor que 1 biselaría TODAS las esquinas, incluidas las rectas.`,
    )
  }
  return { senoMinimo, miterLimite }
}

/** Construye una {@link DeteccionOffset} a partir del catálogo. */
const detectar = (tipo, datos) => ({ tipo, mensaje: MENSAJE_OFFSET[tipo](datos) })

/**
 * Copia PROFUNDA e independiente. `structuredClone` porque el modelo es POJO
 * plano (regla 4) y es el mismo mecanismo con el que `edit/historial.js`
 * fotografía el estado: si algo no fuera clonable aquí, tampoco tendría undo.
 */
const clonarRecintos = (recintos) => structuredClone(recintos)

/**
 * Ángulo (grados, en [0, 90]) correspondiente a un seno de rectas. Se usa
 * `asin(|seno|)` a sabiendas de que devuelve el ángulo AGUDO equivalente: para
 * decirle al usuario «esta esquina es demasiado aguda» lo que importa es cuánto
 * se separan las dos RECTAS, y dos rectas que forman 179° están tan cerca de ser
 * la misma como dos que forman 1°.
 */
const gradosDeSeno = (seno) => (Math.asin(Math.min(1, Math.abs(seno))) * 180) / Math.PI

/**
 * Resuelve UN extremo del lindero desplazado.
 *
 * @param {[number,number]} apoyo   Punto de la recta desplazada L' (`V + d·nrm`).
 * @param {[number,number]} dirLado Dirección de L' (unitaria, la del lado).
 * @param {[number,number]} V       Vértice original del extremo.
 * @param {[number,number]} vecino  Vértice de fuera del lado, que define la recta contigua.
 * @param {number} magnitud         |distancia| en metros, > 0.
 * @param {number} senoMinimo
 * @param {number} miterLimite
 * @returns {{modo: string, punto: [number,number]|null, seno: number, salto: number}}
 *   `punto` es el corte (solo con `modo: 'MITER'`); `salto` es |punto − V| en el
 *   caso MITER y BEVEL —lo lejos que se HABRÍA ido— y `magnitud` en el caso
 *   TRASLACION.
 */
function resolverExtremo(apoyo, dirLado, V, vecino, magnitud, senoMinimo, miterLimite) {
  // Recta contigua: pasa por V con dirección V − vecino. Es una RECTA infinita,
  // no el segmento: el corte puede caer fuera del lindero vecino, y eso es
  // exactamente lo que el offset necesita (alargar o acortar al vecino sobre su
  // propia recta).
  const dirVecino = [V[0] - vecino[0], V[1] - vecino[1]]
  const { punto, paralelas, seno } = intersectarRectas(apoyo, dirLado, V, dirVecino, { senoMinimo })

  if (paralelas || punto === null) {
    return { modo: MODO_OFFSET.TRASLACION, punto: null, seno, salto: magnitud }
  }

  const salto = distanciaEntre(punto, V)
  if (salto / magnitud > miterLimite) {
    return { modo: MODO_OFFSET.BEVEL, punto, seno, salto }
  }
  return { modo: MODO_OFFSET.MITER, punto, seno, salto }
}

// ── Operación ────────────────────────────────────────────────────────────────

/**
 * Desplaza UN LADO del recinto paralelamente a sí mismo, recalculando los dos
 * vértices contiguos por intersección con los linderos vecinos.
 *
 * **El lado es `indice → indice + 1`**, con el módulo del anillo ABIERTO: con
 * `indice = n − 1` el lado es el de CIERRE (`v[n−1] → v[0]`).
 *
 * **Signo de `distancia` — la frase inequívoca:** `distancia > 0` aleja el lado
 * del INTERIOR DE SU PROPIO ANILLO, cualquiera que sea el sentido de giro con que
 * ese anillo esté guardado (el signo se obtiene midiendo, con
 * `geo/area.js#orientacion`, no de una convención). Dicho en términos de área: el
 * área encerrada por ESE anillo siempre CRECE con `distancia > 0` y siempre
 * MENGUA con `distancia < 0`. **En un HUECO eso significa que el hueco se
 * agranda**, y por tanto que la superficie NETA de la parcela
 * (`geo/area.js#superficie` = exterior − huecos) **disminuye**: «fuera del anillo
 * del hueco» es «hacia el material». El módulo no mira `tipo`; el gesto es
 * siempre «aleja este lindero del recinto al que pertenece».
 *
 * **No lanza si el usuario pide lo imposible** (regla de oro 1). Un lado de
 * longitud cero, un anillo con menos de {@link MINIMO_VERTICES} vértices o
 * `distancia === 0` devuelven los `recintos` SIN TOCAR (una copia) y una
 * {@link DeteccionOffset} que lo cuenta con un texto presentable. El `throw` se
 * reserva para el contrato roto por el programador.
 *
 * **`distancia === 0`** corta antes que cualquier otra comprobación: si no se
 * mueve nada, no hay nada que diagnosticar sobre el anillo. Devuelve la copia
 * intacta, `modo: 'MITER'` (= ningún fallback) y una única detección
 * `SIN_DESPLAZAMIENTO`.
 *
 * **Triángulos** (n = 3) funcionan sin caso especial: el vecino por un lado y el
 * vecino por el otro son el MISMO vértice (`v[2]`), pero las dos rectas contiguas
 * (`v2→v0` y `v1→v2`) son distintas y se cortan con la desplazada como en
 * cualquier otro anillo.
 *
 * @param {Recinto[]} recintos  Geometría EDITABLE (no la parcela, no la oficial).
 * @param {RefVertice} refVertice  `{recinto, indice}`: el vértice que ABRE el lado.
 * @param {number} distancia  Metros. **> 0 = hacia fuera del anillo** (ver arriba).
 * @param {{senoMinimo?: number, miterLimite?: number}} [opciones]
 *   `senoMinimo` ∈ [0,1): por debajo de ese seno las rectas se declaran paralelas
 *   y el extremo se TRASLADA. Defecto `OPERATIVOS.senoMinimoOffset` (0,01 ≈ 0,57°).
 *   `miterLimite` ≥ 1: tope de |vértice desplazado| / |distancia| antes de
 *   BISELAR. Defecto `OPERATIVOS.miterLimiteFactor` (4, el `stroke-miterlimit` de
 *   SVG). `Infinity` desactiva el bisel — solo para diagnóstico y para el test que
 *   demuestra que la guarda hace falta.
 * @returns {ResultadoOffset}
 * @throws {TypeError}  Si `recintos`, la referencia, `distancia` u `opciones` no
 *   cumplen la forma.
 * @throws {RangeError} Si `recinto`/`indice` se salen del rango real o si
 *   `senoMinimo`/`miterLimite` se salen de su dominio.
 */
export function desplazarLado(recintos, refVertice, distancia, opciones = {}) {
  const FN = 'desplazarLado'
  exigirRecintos(recintos, FN)
  const { recinto, indice, vertices } = exigirRef(recintos, refVertice, FN)
  const d = exigirDistancia(distancia, FN)
  const { senoMinimo, miterLimite } = exigirOpciones(opciones, FN)

  const sinCambios = (tipo, datos) => ({
    recintos: clonarRecintos(recintos),
    modo: MODO_OFFSET.MITER,
    detecciones: [detectar(tipo, datos)],
  })

  // Distancia 0: nada que mover, y por tanto nada que diagnosticar del anillo.
  if (d === 0) return sinCambios(TIPO_OFFSET.SIN_DESPLAZAMIENTO)

  const n = vertices.length
  if (n < MINIMO_VERTICES) {
    return sinCambios(TIPO_OFFSET.ANILLO_INSUFICIENTE, { recinto, n })
  }

  const i = indice
  const j = (i + 1) % n
  const anterior = (i - 1 + n) % n
  const siguiente = (j + 1) % n

  const Vi = vertices[i]
  const Vj = vertices[j]
  const Vp = vertices[anterior]
  const Vq = vertices[siguiente]

  // Director unitario del lado. Se calcula sobre la DIFERENCIA (metros), no sobre
  // las coordenadas UTM absolutas: regla de oro 5, igual que en `geo/segmento.js`.
  const brutoX = Vj[0] - Vi[0]
  const brutoY = Vj[1] - Vi[1]
  const largo = Math.hypot(brutoX, brutoY)
  if (largo <= LONGITUD_NULA_METROS) {
    return sinCambios(TIPO_OFFSET.LADO_DEGENERADO, { recinto, desde: i, hasta: j })
  }
  const ux = brutoX / largo
  const uy = brutoY / largo

  const detecciones = []

  // EL SIGNO. `(uy, −ux)` es la normal a la DERECHA del recorrido; multiplicada
  // por la orientación del anillo apunta SIEMPRE hacia fuera de ese anillo (§1 de
  // la cabecera). `orientacion` devuelve +1 por convención cuando el área firmada
  // es 0, así que ese caso —donde «fuera» no significa nada— se avisa.
  const firmada = areaFirmada(vertices)
  if (Math.abs(firmada) < OPERATIVOS.areaNulaM2) {
    detecciones.push(
      detectar(TIPO_OFFSET.ORIENTACION_INDETERMINADA, { recinto, areaFirmada: firmada }),
    )
  }
  const signo = orientacion(vertices)
  const nx = signo * uy
  const ny = signo * -ux

  // Traslación del lado: los dos extremos «en bruto», que son a la vez el punto de
  // apoyo de la recta desplazada, el resultado del fallback TRASLACION y el
  // vértice nuevo del BEVEL.
  const desX = d * nx
  const desY = d * ny
  const Ai = [Vi[0] + desX, Vi[1] + desY]
  const Aj = [Vj[0] + desX, Vj[1] + desY]

  const magnitud = Math.abs(d)
  const dirLado = [ux, uy]

  const extI = resolverExtremo(Ai, dirLado, Vi, Vp, magnitud, senoMinimo, miterLimite)
  const extJ = resolverExtremo(Aj, dirLado, Vj, Vq, magnitud, senoMinimo, miterLimite)

  // Detecciones por extremo, con el índice del vértice DENTRO del texto: `modo`
  // resume, esto detalla (regla de oro 1).
  const metros = magnitud.toFixed(2)
  for (const [ext, vertice] of [
    [extI, i],
    [extJ, j],
  ]) {
    if (ext.modo === MODO_OFFSET.TRASLACION) {
      detecciones.push(
        detectar(TIPO_OFFSET.EXTREMO_TRASLADADO, {
          vertice,
          grados: gradosDeSeno(ext.seno).toFixed(2),
          metros,
        }),
      )
    } else if (ext.modo === MODO_OFFSET.BEVEL) {
      detecciones.push(
        detectar(TIPO_OFFSET.EXTREMO_BISELADO, {
          vertice,
          grados: gradosDeSeno(ext.seno).toFixed(2),
          saltoMetros: ext.salto.toFixed(2),
          veces: Math.round(ext.salto / magnitud),
          metros,
        }),
      )
    }
  }

  const modo =
    PRIORIDAD_MODO[extI.modo] >= PRIORIDAD_MODO[extJ.modo] ? extI.modo : extJ.modo

  // Reconstrucción del anillo. Cada extremo aporta la LISTA de vértices que
  // sustituye al original, y el resto del anillo se copia tal cual. Con el módulo
  // del anillo el lado de CIERRE (i = n−1, j = 0) no necesita ningún caso
  // especial: al recorrer k = 0..n−1 la lista de `j` sale al principio y la de `i`
  // al final, que es su sitio en el recorrido cíclico.
  //
  // BEVEL conserva el vértice ORIGINAL y añade el trasladado del lado del lindero
  // desplazado: en el extremo `i` el chaflán va DESPUÉS del original (Vi, Ai) y en
  // el extremo `j` va ANTES (Aj, Vj), porque el recorrido entra por `i` y sale
  // por `j`.
  const listaI =
    extI.modo === MODO_OFFSET.MITER
      ? [extI.punto]
      : extI.modo === MODO_OFFSET.TRASLACION
        ? [Ai]
        : [Vi, Ai]
  const listaJ =
    extJ.modo === MODO_OFFSET.MITER
      ? [extJ.punto]
      : extJ.modo === MODO_OFFSET.TRASLACION
        ? [Aj]
        : [Aj, Vj]

  const nuevos = []
  for (let k = 0; k < n; k++) {
    const trozo = k === i ? listaI : k === j ? listaJ : [vertices[k]]
    // Pares NUEVOS siempre: ni un `[x,y]` de la entrada sobrevive en la salida.
    for (const p of trozo) nuevos.push([p[0], p[1]])
  }

  const salida = clonarRecintos(recintos)
  salida[recinto].vertices = nuevos
  return { recintos: salida, modo, detecciones }
}

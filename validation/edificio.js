// validation/edificio.js — F13 · Validación de las PARTES de una construcción.
//
// Superficie pública de la validación de la rama EDIFICIO, hermana de
// `validation/parcela.js` y con su mismo contrato visible: errores y avisos
// SEPARADOS, `puedeGenerar` como única puerta a la generación de GML, y ni una
// excepción por dato del usuario (regla de oro 1) — el `throw` se reserva para el
// contrato roto por el llamante.
//
// ═════════════════════════════════════════════════════════════════════════════
// LO QUE NO SE REESCRIBE, Y POR QUÉ SE REUSA TAL CUAL
// ═════════════════════════════════════════════════════════════════════════════
// Una parte de construcción **es** un anillo exterior sin huecos: así lo garantiza
// el criterio de aceptación 4 de F12 («las partes no admiten huecos») y así lo
// devuelven las cinco vías de entrada — medido sobre el fixture real: las trece
// partes traen `recinto.tipo === 'EXTERIOR'` y cero interiores.
//
// Eso es EXACTAMENTE la forma que esperan `reglasGeometria`, `reglasTopologia` y
// `reglasHuso` de F02, así que aquí se llaman con `[parte.recinto]` y no se
// reimplementa ni una. De rebote, cuatro de las seis reglas de rechazo del ICUC
// (dossier §1.3) ya están cubiertas por ellas o por el propio modelo, y conviene
// decir cuáles para que nadie escriba un guardián que no puede disparar:
//
//   · **≥4 puntos por recinto** — el ICUC cuenta el anillo CERRADO; el modelo lo
//     guarda ABIERTO (regla de oro 4), así que su umbral son 3 y ése es
//     literalmente el de `reglasGeometria` («vértices insuficientes: < 3 DISTINTOS»).
//   · **Geometría cerrada** (1.º = último) — no puede fallar: el modelo no guarda
//     el vértice de cierre y lo pone `gml/anillos.js#cerrarAnillo` al serializar.
//   · **2 coordenadas por punto** — `crearParteConstruccion` solo admite `[x,y]`.
//   · **Identificadores únicos** — los compone el serializador POR ÍNDICE, así que
//     no pueden chocar; y si algún día chocaran, `gml/serialize-bu.js` LANZA antes
//     de renderizar (es contrato roto por el programador, no dato del usuario).
//
// Lo que sí falta, y es lo que escribe este módulo: que una parte principal tenga
// plantas, que no haya partes vacías, que las construcciones no se solapen y que
// ninguna se aleje de la parcela más de lo que el ICUC admite.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔ EL DATO QUE CASI NUNCA ESTÁ: `parcelaContexto`
// ═════════════════════════════════════════════════════════════════════════════
// Dos de las reglas de la ficha —«parte fuera de la parcela» y el «>100 m» del
// ICUC— necesitan la parcela, y **la parcela normalmente no está**. Medido en la
// fase 0 de F13: `parcelaContexto` sale `null` tanto por la vía del GML de partes
// como por la del DXF. No es un olvido del modelo: `app/cableado-edificio.js` le
// pasa **la parcela que hubiera en la OTRA rama** (desviación 9 de F11), y el caso
// normal de un ICUC es soltar el dibujo del edificio y nada más.
//
// Por eso el resultado trae {@link ResultadoValidacionEdificio.noComprobado}: sin
// él, «0 avisos» significaría a la vez «está dentro» y «no se ha mirado», que es
// el silencio que la regla de oro 1 persigue. Se emite ADEMÁS un aviso legible,
// porque el técnico tiene que enterarse mirando la pantalla y no leyendo un array.
//
// ═════════════════════════════════════════════════════════════════════════════
// POR QUÉ CADA HALLAZGO SABE DE QUÉ PARTE ES
// ═════════════════════════════════════════════════════════════════════════════
// El `Hallazgo` de F02 localiza con `{recinto, indice}`, y ahí `recinto` es el
// índice DENTRO de una parcela. Con trece partes eso ya no basta: la ficha pide
// que «el resalte del aviso rodee **la parte que se sale**, no otra» (§16.1), y
// con `{recinto:0, indice:3}` repetido trece veces no hay forma de saber cuál.
//
// La diferencia con `validarParcela` es deliberada y son dos añadidos:
//   · cada hallazgo lleva `parte` — el índice de la parte, o `null` si el hallazgo
//     es del DOCUMENTO (no hay partes, no hay parcela con la que comparar);
//   · `porParte` agrupa **los mismos objetos**, no copias, para que el mapa pinte
//     lo de una parte sin recorrer la lista entera.
// `errores` y `avisos` siguen planos y separados porque son los que se CUENTAN, y
// el recuento de la ficha se hace sobre ellos.
//
// ⚠️ Un solape produce UN hallazgo, no dos, y ese hallazgo aparece en el `porParte`
// de LAS DOS partes implicadas. Emitir uno por parte inflaría el recuento («2
// errores» para un solo solape) y emitir solo uno atribuido a la primera dejaría
// muda a la segunda: quien pinchara la parte B no vería nada.

import { NIVEL, crearHallazgo, coordsPoligono, esRecintoApto, refsAnillo, OPERATIVOS } from './_comun.js'
import { reglasGeometria } from './reglas-geometria.js'
import { reglasTopologia } from './reglas-topologia.js'
import { reglasHuso } from './reglas-huso.js'
import { superficie } from '../geo/area.js'
import { proyectarEnSegmento } from '../geo/segmento.js'
import { TIPO_PARTE } from '../model/edificio.js'
import intersect from '@turf/intersect'
import { featureCollection, polygon } from '@turf/helpers'

// ── Vocabulario ──────────────────────────────────────────────────────────────

/**
 * Las comprobaciones que pueden quedarse SIN HACER por falta de dato, y que por
 * tanto hay que poder nombrar. No son «reglas que no han encontrado nada»: son
 * reglas que no se han podido ejecutar, y confundirlas es leer un silencio como
 * un cero.
 *
 * @readonly
 */
export const COMPROBACION = Object.freeze({
  /** Si la huella de cada parte cae dentro de la parcela declarada. */
  FUERA_DE_PARCELA: 'FUERA_DE_PARCELA',
  /** Si alguna construcción se aleja de la parcela más de lo que admite el ICUC. */
  DISTANCIA_A_PARCELA: 'DISTANCIA_A_PARCELA',
})

/**
 * Por qué una comprobación no se ha podido hacer.
 *
 * @readonly
 */
export const MOTIVO_NO_COMPROBADO = Object.freeze({
  /** No hay geometría de parcela con la que comparar. Ver la cabecera. */
  SIN_PARCELA: 'SIN_PARCELA',
})

/**
 * La distancia máxima entre una construcción y la parcela que declara, en metros.
 *
 * ⚠️ **No es una tolerancia de ingeniería nuestra y por eso NO vive en
 * `config/operativos.json`**: es una regla de rechazo publicada del ICUC —
 * «construcciones a **más de 100 m** de la parcela declarada» (ayuda oficial
 * `ayuda_ICUC.htm`, recogida en el dossier §1.3)—. Mismo criterio con el que el
 * margen oficial de identidad vive en `diagnostico/margen.js` con su cita al lado
 * y no en el fichero de tolerancias.
 */
export const DISTANCIA_MAXIMA_PARCELA_M = 100

// ── Typedefs del contrato ────────────────────────────────────────────────────

/**
 * Un {@link import('./_comun.js').Hallazgo} con la parte a la que pertenece.
 *
 * @typedef {import('./_comun.js').Hallazgo & {parte: number|null}} HallazgoParte
 */

/**
 * @typedef {Object} ResultadoValidacionEdificio
 * @property {HallazgoParte[]} errores   Bloquean la generación. Categoría SEPARADA.
 * @property {HallazgoParte[]} avisos    No bloquean. Categoría SEPARADA.
 * @property {boolean} puedeGenerar      `errores.length === 0`.
 * @property {Array<{indice: number, nombre: string, errores: HallazgoParte[],
 *   avisos: HallazgoParte[]}>} porParte  Los MISMOS objetos, agrupados.
 * @property {Array<{comprobacion: string, motivo: string}>} noComprobado  Lo que no
 *   se ha podido mirar, y por qué. Vacío cuando se ha mirado todo.
 */

// ── Helpers internos ─────────────────────────────────────────────────────────

/** El rótulo con el que se nombra una parte en los mensajes. */
const nombreDe = (parte, indice) =>
  typeof parte?.nombre === 'string' && parte.nombre.trim() !== ''
    ? parte.nombre
    : `la parte nº ${indice + 1}`

/** Metros cuadrados con dos decimales y coma, como los escribe el resto de la app. */
const m2 = (v) => `${v.toFixed(2).replace('.', ',')} m²`

/**
 * Superficie común a dos recintos (m²), o `0` si no la hay.
 *
 * Turf 7 exige el FeatureCollection de DOS polígonos —la forma de dos argumentos
 * LANZA—, igual que ya documenta `reglas-topologia.js`. Dos partes que solo
 * comparten pared dan `null`, que es el caso NORMAL y no un solape.
 *
 * @param {object} recintoA
 * @param {object} recintoB
 * @returns {number}
 */
function areaComun(recintoA, recintoB) {
  const comun = intersect(
    featureCollection([polygon(coordsPoligono(recintoA)), polygon(coordsPoligono(recintoB))]),
  )
  if (comun === null) return 0
  // `intersect` puede devolver Polygon o MultiPolygon; los dos se miden sumando
  // el exterior de cada pieza y restándole sus huecos, que es lo que hace
  // `superficie` sobre los recintos del modelo. Aquí basta el valor absoluto del
  // área firmada de cada anillo, con el signo puesto por su papel.
  const piezas =
    comun.geometry.type === 'MultiPolygon' ? comun.geometry.coordinates : [comun.geometry.coordinates]
  let total = 0
  for (const anillos of piezas) {
    total += superficie(
      anillos.map((anillo, i) => ({
        // Turf devuelve el anillo CERRADO; el modelo lo quiere ABIERTO.
        vertices: anillo.slice(0, -1),
        tipo: i === 0 ? 'EXTERIOR' : 'HUECO',
      })),
    )
  }
  return total
}

/**
 * Distancia mínima (m) de un recinto a otro, medida vértice a lado en las DOS
 * direcciones. Cero si se tocan o se cruzan.
 *
 * Se calcula con `geo/segmento.js#proyectarEnSegmento` y no con Turf: la regla de
 * oro 6 reserva Turf para lo TOPOLÓGICO, y una distancia euclídea sobre UTM es
 * aritmética de la casa (`geo/`), no topología.
 *
 * @param {object} recintoA
 * @param {object} recintoB
 * @returns {number}
 */
function distanciaEntre(recintoA, recintoB) {
  let minima = Infinity
  const parejas = [
    [recintoA.vertices, recintoB.vertices],
    [recintoB.vertices, recintoA.vertices],
  ]
  for (const [puntos, anillo] of parejas) {
    for (const p of puntos) {
      for (let i = 0; i < anillo.length; i++) {
        const a = anillo[i]
        const b = anillo[(i + 1) % anillo.length]
        const d = proyectarEnSegmento(p, a, b).distancia
        if (d < minima) minima = d
      }
    }
  }
  return minima
}

/** Los recintos de la parcela que sirven para comparar, o `null` si no hay. */
function parcelaUtil(parcelaContexto) {
  if (!Array.isArray(parcelaContexto) || parcelaContexto.length === 0) return null
  const aptos = parcelaContexto.filter(esRecintoApto)
  return aptos.length === 0 ? null : aptos
}

// ── El orquestador ───────────────────────────────────────────────────────────

/**
 * Valida las partes de una construcción y separa errores (bloqueantes) de avisos.
 *
 * @param {Array<object>} partes  `ParteConstruccion[]` de `model/edificio.js`. No se muta.
 * @param {{srs?: string, parcelaContexto?: Array<object>|null}} [opciones]
 *   `srs` del expediente (para la regla de huso) y los recintos de la parcela
 *   declarada, si los hay. Ver la cabecera: normalmente NO los hay.
 * @returns {ResultadoValidacionEdificio}
 * @throws {TypeError} Si `partes` no es un array (contrato roto por el llamante).
 */
export function validarEdificio(partes, { srs, parcelaContexto = null } = {}) {
  if (!Array.isArray(partes)) {
    throw new TypeError(
      `validarEdificio: 'partes' debe ser un array de ParteConstruccion; recibido ${typeof partes}. ` +
        `(Un dato de usuario inválido se señala con hallazgos, no con throw — regla 1; ` +
        `esto es un contrato roto por el llamante.)`,
    )
  }

  /** @type {HallazgoParte[]} */
  const todos = []
  /** @type {Array<{comprobacion: string, motivo: string}>} */
  const noComprobado = []
  const porParte = partes.map((parte, indice) => ({
    indice,
    nombre: nombreDe(parte, indice),
    errores: [],
    avisos: [],
  }))

  /**
   * Anota un hallazgo: entra en la lista plana y en el `porParte` de cada parte a
   * la que pertenece. Es el ÚNICO sitio donde se escribe en las dos, para que no
   * puedan divergir.
   *
   * @param {import('./_comun.js').Hallazgo} hallazgo
   * @param {number|null} parte  Índice de la parte, o `null` si es del documento.
   * @param {number[]} [tambienEn=[]]  Otras partes en cuyo grupo debe aparecer.
   */
  function anotar(hallazgo, parte, tambienEn = []) {
    const conParte = { ...hallazgo, parte }
    todos.push(conParte)
    for (const i of [parte, ...tambienEn]) {
      if (i === null || porParte[i] === undefined) continue
      porParte[i][conParte.nivel === NIVEL.ERROR ? 'errores' : 'avisos'].push(conParte)
    }
    return conParte
  }

  // ── 1 · Guarda estructural ────────────────────────────────────────────────
  // Sin partes no hay construcción que declarar, y es literalmente lo que
  // contesta el ICUC («Se debe aportar la geometría de la huella…»). Corta aquí:
  // todo lo de abajo recorre partes.
  if (partes.length === 0) {
    anotar(
      crearHallazgo(
        NIVEL.ERROR,
        'No hay ninguna construcción que declarar: el edificio no tiene ni una parte.',
        [],
        'Añadir al menos una parte con su recinto',
      ),
      null,
    )
    return resultado(todos, porParte, noComprobado)
  }

  // ── 2 · Cada parte por su cuenta ──────────────────────────────────────────
  partes.forEach((parte, indice) => {
    const nombre = nombreDe(parte, indice)
    const recinto = parte?.recinto ?? null

    // Una parte sin contorno es un estado LEGÍTIMO del modelo mientras se
    // trabaja —F12 la crea así, «pendiente de dibujar el recinto»— y un error
    // en cuanto se quiere generar: el ICUC rechaza las partes vacías.
    if (recinto === null || !Array.isArray(recinto.vertices) || recinto.vertices.length === 0) {
      anotar(
        crearHallazgo(
          NIVEL.ERROR,
          `${nombre} no tiene recinto: está pendiente de dibujar.`,
          [],
          'Dibujar el recinto de la parte',
        ),
        indice,
      )
      return
    }

    // Las tres de F02, tal cual, sobre el anillo de esta parte. El `recinto` de
    // sus `verticesAfectados` vale 0 —solo hay uno— y es correcto DENTRO de esta
    // parte: por eso el resalte se resuelve con `porParte` y no con la lista plana.
    for (const h of [
      ...reglasGeometria([recinto]),
      ...reglasTopologia([recinto]),
      ...reglasHuso([recinto], { srs }),
    ]) {
      anotar(h, indice)
    }

    // Criterio de aceptación 6 de la ficha. Solo se le pide a las PRINCIPALES:
    // el modelo fuerza las plantas a `null` en las de tipo OTRA (una piscina no
    // tiene plantas), así que exigírselas sería exigir lo imposible.
    if (parte?.tipo === TIPO_PARTE.PRINCIPAL && parte.plantasSobreRasante === null) {
      anotar(
        crearHallazgo(
          NIVEL.ERROR,
          `${nombre} no tiene declaradas las plantas sobre rasante. Es el dato que decide si ` +
            'entra en la huella del edificio: sin él, lo que se genere no se sabe si es la ' +
            'construcción o una parte de ella.',
          refsAnillo(0, recinto.vertices.length),
          'Declarar las plantas sobre rasante de la parte',
        ),
        indice,
      )
    }
  })

  // ── 3 · Las partes entre sí ───────────────────────────────────────────────
  // El ICUC rechaza los solapes entre construcciones. Dos partes que comparten
  // pared NO se solapan —`intersect` devuelve `null` cuando el lindero coincide
  // entero, en parte o en una esquina; está medido en `diagnostico/topologia.js`—,
  // así que un área común por encima del ruido de coma flotante es un solape real.
  for (let i = 0; i < partes.length; i++) {
    const ri = partes[i]?.recinto
    if (!esRecintoApto(ri)) continue
    for (let j = i + 1; j < partes.length; j++) {
      const rj = partes[j]?.recinto
      if (!esRecintoApto(rj)) continue
      const comun = areaComun(ri, rj)
      if (comun <= OPERATIVOS.areaNulaM2) continue
      anotar(
        crearHallazgo(
          NIVEL.ERROR,
          `${nombreDe(partes[i], i)} y ${nombreDe(partes[j], j)} se solapan en ${m2(comun)}. ` +
            'El ICUC rechaza las construcciones que se superponen.',
          refsAnillo(0, ri.vertices.length),
          'Separar las construcciones que se solapan',
        ),
        i,
        [j],
      )
    }
  }

  // ── 4 · Las partes contra la parcela ──────────────────────────────────────
  const parcela = parcelaUtil(parcelaContexto)
  if (parcela === null) {
    // NO se calla y NO se da por buena: se dice que no se ha mirado. Ver la
    // cabecera — con el dato ausente en el camino normal, esto es lo que el
    // técnico va a leer casi siempre, así que la frase tiene que decir qué falta
    // y qué hacer, no solo que falta.
    for (const comprobacion of Object.values(COMPROBACION)) {
      noComprobado.push({ comprobacion, motivo: MOTIVO_NO_COMPROBADO.SIN_PARCELA })
    }
    anotar(
      crearHallazgo(
        NIVEL.AVISO,
        'No se ha comprobado si las construcciones caen dentro de la parcela: no hay ninguna ' +
          'parcela cargada con la que compararlas. El ICUC sí lo comprueba, y rechaza las que ' +
          'se alejan más de ' +
          `${DISTANCIA_MAXIMA_PARCELA_M} m. Carga la parcela en la otra rama si quieres verlo aquí antes de subirlo.`,
      ),
      null,
    )
  } else {
    partes.forEach((parte, indice) => {
      const recinto = parte?.recinto
      if (!esRecintoApto(recinto)) return
      const nombre = nombreDe(parte, indice)
      const propia = superficie([{ ...recinto, tipo: 'EXTERIOR' }])
      const dentro = parcela.reduce(
        (suma, r) => (r.tipo === 'HUECO' ? suma : suma + areaComun(recinto, r)),
        0,
      )
      const fuera = propia - dentro

      if (dentro <= OPERATIVOS.areaNulaM2) {
        // Ni un metro dentro: además de estar fuera, puede estar LEJOS, y eso el
        // ICUC no lo admite. La distancia se mide siempre que no haya solape,
        // porque con solape es 0 por definición.
        const d = Math.min(...parcela.map((r) => distanciaEntre(recinto, r)))
        if (d > DISTANCIA_MAXIMA_PARCELA_M) {
          anotar(
            crearHallazgo(
              NIVEL.ERROR,
              `${nombre} está a ${d.toFixed(2).replace('.', ',')} m de la parcela declarada, y el ` +
                `ICUC rechaza las construcciones a más de ${DISTANCIA_MAXIMA_PARCELA_M} m. ` +
                'Suele significar que el dibujo está en otro huso o desplazado.',
              refsAnillo(0, recinto.vertices.length),
              'Comprobar el sistema de referencia o la posición del dibujo',
            ),
            indice,
          )
          return
        }
      }

      if (fuera > OPERATIVOS.areaNulaM2) {
        anotar(
          crearHallazgo(
            NIVEL.AVISO,
            `${nombre} se sale de la parcela: ${m2(fuera)} de sus ${m2(propia)} quedan fuera. ` +
              'Puede ser legítimo —una construcción a caballo de dos parcelas lo está—, pero ' +
              'conviene mirarlo antes de subirlo.',
            refsAnillo(0, recinto.vertices.length),
          ),
          indice,
        )
      }
    })
  }

  return resultado(todos, porParte, noComprobado)
}

/**
 * Reparte la lista plana en las dos categorías y compone el resultado. Existe
 * para que el `return` sea uno solo y las dos salidas (la guarda estructural y el
 * recorrido completo) no puedan construir formas distintas.
 *
 * @param {HallazgoParte[]} todos
 * @param {object[]} porParte
 * @param {object[]} noComprobado
 * @returns {ResultadoValidacionEdificio}
 */
function resultado(todos, porParte, noComprobado) {
  const errores = todos.filter((h) => h.nivel === NIVEL.ERROR)
  const avisos = todos.filter((h) => h.nivel === NIVEL.AVISO)
  return { errores, avisos, puedeGenerar: errores.length === 0, porParte, noComprobado }
}

// viewer/contraste.js — F07 · La REPRESENTACIÓN del diagnóstico sobre el mapa (§10.5).
//
// Dibuja cuatro cosas en el pane `diagnostico` (zIndex 428), y ninguna de ellas
// calcula nada: todas leen el POJO que devuelve `diagnostico/parcela.js#diagnosticar`.
//
//   1. **La diferencia simétrica** entre el contorno medido y el oficial, sombreada.
//   2. **Las piezas de invasión** a colindantes, en ÁMBAR — la única excepción que
//      la regla de oro 9 admite, porque es un hecho topológico binario con
//      consecuencia fija (el expediente se rechaza salvo que se modifique la vecina).
//   3. **El lindero de máxima desviación**, resaltado, con su cota y su LÍNEA GUÍA.
//   4. **La banda del margen de identidad**, rotulada, si el diagnóstico la trae.
//
// ── LA DIFERENCIA SOMBREADA NO NECESITA GEOMETRÍA BOOLEANA ──────────────────
// Parecía exigir `@turf/difference`, que no está en `package.json` y habría sido la
// única dependencia nueva de F07. No hace falta: **el `fillRule` por defecto de
// Leaflet es `'evenodd'`** —verificado en `node_modules/leaflet/dist/leaflet-src.js`
// (opción en :8159, aplicado por el renderizador SVG en :13347 y por el de Canvas en
// :12900)—, así que UN SOLO `L.polygon` con los anillos de las DOS geometrías
// rellena exactamente su diferencia simétrica.
//
// Y funciona con huecos, que es lo que no era evidente. La pertenencia a una región
// con patio es «dentro del exterior Y NO dentro del hueco», y la paridad da
// justamente eso: un punto en el exterior solo cuenta 1 (dentro), en exterior+hueco
// cuenta 2 (fuera). Al juntar los anillos de las dos parcelas, la paridad total es
// impar exactamente en los puntos que pertenecen a UNA de las dos regiones y no a la
// otra — la definición de diferencia simétrica. No hay que ordenar los anillos ni
// marcar cuál es hueco: la paridad no distingue.
//
// El ÁREA de esa misma región tampoco necesita booleanas: `diagnostico/parcela.js`
// la calcula como |A| + |B| − 2·|A∩B|, exacta. Este módulo solo la pinta.
//
// ── LA BANDA DEL MARGEN NO ES UN BUFFER ─────────────────────────────────────
// `turf.buffer` está PROHIBIDA (regla de oro 6), y aquí no hace falta: la banda se
// dibuja como el TRAZO del contorno oficial con un ancho en PÍXELES derivado de los
// metros del margen a la escala actual, y se repinta en `zoomend`. Es honesto —una
// banda de anchura constante sobre el terreno— y cuesta cero geometría. La escala se
// mide proyectando dos puntos UTM separados un metro con la maquinaria propia del
// proyecto (`vertUTMaLatLng` + `latLngToLayerPoint`), no con `mapa.distance()`, que
// es geodésica sobre grados.
//
// ── NADA DE ESTO INTERCEPTA EL PUNTERO ──────────────────────────────────────
// Todo va `interactive: false`. Con el diagnóstico abierto **F06 sigue activo** —se
// diagnostica, se corrige el lindero y se vuelve a diagnosticar—, así que ni la
// sombra ni la banda pueden robarle un clic al mapa ni un arrastre a un vértice. El
// zIndex 428 (bajo `vertices`, 430) es la segunda línea de defensa, no la única.
//
// ── ESTE MÓDULO NO JUZGA ────────────────────────────────────────────────────
// No decide qué es grave. El ámbar va donde `diagnostico.invasion.invasiones` trae
// una entrada, y en ningún otro sitio; la cifra de la diferencia y la de la
// desviación se rotulan en el gris del cromo del visor, sin escala de color. La
// banda del margen lleva SIEMPRE su etiqueta («margen de identidad del Catastro»),
// que viaja dentro del propio diagnóstico para que no se pueda pintar el número sin
// ella.

import L from 'leaflet'

import { OPERATIVOS } from '../config/operativos.js'
import { HUSOS_VALIDOS } from '../geo/huso.js'
import { NIVEL, PANE, resolverAvisar, vertUTMaLatLng } from './_comun.js'

/**
 * Describe un valor para un mensaje de contrato roto.
 *
 * ⚠️ **TERCERA copia dentro de `viewer/`**, y se declara en vez de disimularla:
 * `viewer/acotaciones.js:160` y `viewer/edicion.js:331` tienen la suya, idéntica.
 * En esta capa `describir` NO está en `_comun.js` —a diferencia de `validation/`,
 * `edit/` y `diagnostico/`, que sí lo tienen ahí—, y la limpieza de `viewer/` que
 * F06 dejó anotada no llegó a subirla. Añadir aquí una tercera copia es lo
 * coherente con la capa; subir las tres a `_comun.js` significa tocar dos ficheros
 * de F06 recién commiteados por un helper de cuatro líneas, y eso es una tarea
 * propia, no un efecto colateral de F07. Queda como DEUDA en
 * `spec/feature-07-diagnostico-parcela.md`.
 */
function describir(valor) {
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return 'un array'
  return typeof valor
}

/**
 * Tono de la diferencia sombreada. Gris azulado frío y translúcido: **no es un
 * color de mérito**. Se elegió por descarte, con el mismo criterio que
 * `COLOR_USUARIO` (ver `viewer/_comun.js`): no puede competir con el amarillo de la
 * geometría del usuario, ni con el rojo del parcelario catastral superpuesto, ni con
 * el azul de la hidrografía, ni leerse como «zona mala». Un gris frío al 22 % deja
 * ver la ortofoto debajo y no significa nada por sí mismo.
 */
const COLOR_DIFERENCIA = '#64748B'
const OPACIDAD_DIFERENCIA = 0.22

/**
 * Ámbar de la invasión. **Es la única excepción de la regla de oro 9 en todo el
 * proyecto**, y está autorizada por la spec: la invasión a colindante no es una
 * cifra que el técnico interprete, es un hecho topológico binario (hay/no hay) con
 * una consecuencia fija. Este color, y solo este, afirma algo.
 */
const COLOR_INVASION = '#D97706'
const OPACIDAD_INVASION = 0.45

/** Resalte del lindero de máxima desviación y de su línea guía. */
const COLOR_DESVIACION = '#DB2777'

/**
 * Banda del margen de identidad: trazo neutro y discontinuo. **Discontinuo a
 * propósito**: una banda continua alrededor del lindero oficial se lee como un
 * carril, y un carril se lee como «lo que cae aquí está bien». La discontinuidad la
 * presenta como lo que es —una referencia informativa— y no como un límite.
 */
const COLOR_MARGEN = '#94A3B8'
const TRAZO_MARGEN = '2 6'

/** Ancho máximo, en píxeles, con el que se dibuja la banda del margen. */
const MARGEN_MAX_PX = 40

/**
 * Capa de contraste del diagnóstico.
 *
 * ```js
 * const contraste = crearContraste({ mapa, zona })
 * contraste.pintar(diagnostico, { recintos, geometriaOficial })
 * contraste.limpiar()   // deja el mapa como estaba, sin desmontar
 * contraste.destruir()  // + retira los listeners del mapa
 * ```
 *
 * @param {Object} opciones
 * @param {import('leaflet').Map} opciones.mapa  Mapa con el pane `diagnostico` ya
 *   creado (lo crea `viewer/mapa.js` iterando `viewer/_comun.js#PANES`).
 * @param {number} opciones.zona  Huso UTM (29, 30 o 31). Ver `geo/huso.js`.
 * @param {number} [opciones.minimoPx=OPERATIVOS.cotaDiagnosticoMinimaPx]  Longitud
 *   mínima EN PÍXELES del segmento medido→oficial para rotular su cota. Por debajo,
 *   los dos puntos se dibujan solapados y una línea guía apuntando a «la diferencia
 *   entre estos dos puntos» sería un dedo señalando al aire.
 * @param {((mensaje: string, detalle?: object) => void)|null} [opciones.alAvisar]
 *   Canal de aviso (regla de oro 1). `null` ⇒ `avisoPorDefecto`.
 * @returns {{pintar: Function, limpiar: Function, destruir: Function}}
 * @throws {TypeError|RangeError} Contrato del programador.
 */
export function crearContraste({
  mapa,
  zona,
  minimoPx = OPERATIVOS.cotaDiagnosticoMinimaPx,
  alAvisar,
} = {}) {
  // ── Contratos del programador: throw, nunca corrección callada ─────────────
  // Se comprueban las funciones que este módulo usa DE VERDAD. Un guardián que solo
  // mira `addLayer` deja pasar dobles de test que después revientan por dentro.
  if (
    !mapa ||
    typeof mapa.addLayer !== 'function' ||
    typeof mapa.removeLayer !== 'function' ||
    typeof mapa.latLngToLayerPoint !== 'function' ||
    typeof mapa.on !== 'function' ||
    typeof mapa.off !== 'function'
  ) {
    throw new TypeError(
      `crearContraste: 'mapa' debe ser un L.Map (con addLayer/removeLayer/` +
        `latLngToLayerPoint/on/off); recibido ${describir(mapa)}.`,
    )
  }
  if (!HUSOS_VALIDOS.includes(zona)) {
    throw new RangeError(
      `crearContraste: 'zona' inválida: ${JSON.stringify(zona)}. ` +
        `Válidas: ${HUSOS_VALIDOS.join(', ')}.`,
    )
  }
  if (!Number.isFinite(minimoPx) || minimoPx < 0) {
    throw new TypeError(
      `crearContraste: 'minimoPx' debe ser un número finito ≥ 0 (píxeles de ` +
        `pantalla); recibido ${JSON.stringify(minimoPx)}.`,
    )
  }
  if (typeof mapa.getPane !== 'function' || !mapa.getPane(PANE.DIAGNOSTICO)) {
    throw new TypeError(
      `crearContraste: falta el pane '${PANE.DIAGNOSTICO}'. Créalo con los nombres ` +
        `de viewer/_comun.js#PANES antes de pintar el contraste (todo lo que dibuja ` +
        `esta capa es una anotación SOBRE las dos geometrías y bajo los vértices).`,
    )
  }

  const avisar = resolverAvisar(alAvisar)

  // ── Estado interno ────────────────────────────────────────────────────────
  let vivo = true
  /** Todas las capas puestas en el mapa por el último `pintar`. */
  let capas = []
  /** Lo último pintado, para poder repintar en `zoomend` sin recibirlo otra vez. */
  let ultimo = null

  const aLatLng = (utm) => vertUTMaLatLng(utm, zona)

  /**
   * Píxeles por metro a la escala actual del mapa, medidos con la maquinaria del
   * proyecto: dos puntos UTM separados **un metro en el eje Este** proyectados a
   * puntos de capa.
   *
   * Se mide junto a la geometría (`refUTM`) y no en el centro del mapa porque la
   * escala de una proyección conforme varía con la latitud; a la escala de una
   * parcela la diferencia es despreciable, pero medir donde se dibuja es gratis.
   *
   * @param {[number,number]} refUTM  Punto de referencia en UTM.
   * @returns {number}  px/m, o 0 si el mapa no puede proyectar (jsdom sin layout).
   */
  function pxPorMetro(refUTM) {
    const p0 = mapa.latLngToLayerPoint(aLatLng(refUTM))
    const p1 = mapa.latLngToLayerPoint(aLatLng([refUTM[0] + 1, refUTM[1]]))
    const px = Math.hypot(p1.x - p0.x, p1.y - p0.y)
    return Number.isFinite(px) ? px : 0
  }

  /** Añade una capa al pane del diagnóstico y la registra para el desmontaje. */
  function poner(capa) {
    capa.addTo(mapa)
    capas.push(capa)
    return capa
  }

  /**
   * Todos los anillos de unos recintos, en latlng, saltando los que no forman
   * anillo. Un anillo de menos de 3 vértices no encierra nada: señalar esa
   * degeneración es de F02 (regla de oro 1, y ya hay quien la señala), no de la capa
   * que dibuja — aquí simplemente no hay nada que pintar.
   *
   * @param {Array<{vertices: Array<[number,number]>}>|null} recintos
   * @returns {Array<Array<[number,number]>>}
   */
  function anillosLatLng(recintos) {
    if (!Array.isArray(recintos)) return []
    const anillos = []
    for (const r of recintos) {
      const v = r && Array.isArray(r.vertices) ? r.vertices : null
      if (!v || v.length < 3) continue
      anillos.push(v.map(aLatLng))
    }
    return anillos
  }

  // ── 1 · La diferencia simétrica ───────────────────────────────────────────

  /**
   * UN solo polígono con los anillos de las DOS geometrías. El `fillRule:'evenodd'`
   * —que es el DEFECTO de Leaflet, y se pasa explícito para que quede escrito de
   * qué depende este dibujo— rellena su diferencia simétrica. Ver la cabecera.
   */
  function pintarDiferencia(recintos, geometriaOficial) {
    const anillos = [...anillosLatLng(recintos), ...anillosLatLng(geometriaOficial)]
    if (anillos.length < 2) return

    poner(
      L.polygon(anillos, {
        pane: PANE.DIAGNOSTICO,
        interactive: false,
        fillRule: 'evenodd',
        fillColor: COLOR_DIFERENCIA,
        fillOpacity: OPACIDAD_DIFERENCIA,
        color: COLOR_DIFERENCIA,
        weight: 1,
        opacity: 0.55,
      }),
    )
  }

  // ── 2 · Las invasiones, en ámbar ──────────────────────────────────────────

  function pintarInvasiones(invasion) {
    if (!invasion || !Array.isArray(invasion.invasiones)) return

    for (const hallazgo of invasion.invasiones) {
      for (const pieza of hallazgo.piezas || []) {
        const anillos = anillosLatLng(pieza)
        if (anillos.length === 0) continue
        poner(
          L.polygon(anillos, {
            pane: PANE.DIAGNOSTICO,
            interactive: false,
            fillRule: 'evenodd',
            fillColor: COLOR_INVASION,
            fillOpacity: OPACIDAD_INVASION,
            color: COLOR_INVASION,
            weight: 2,
          }),
        )
      }
    }
  }

  // ── 3 · El lindero de máxima desviación, con su cota y su línea guía ──────

  function pintarDesviacion(desviacion, recintos) {
    const max = desviacion && desviacion.maxima
    if (!max) return

    const anillo = Array.isArray(recintos) && recintos[max.recinto]
      ? recintos[max.recinto].vertices
      : null
    if (!Array.isArray(anillo) || anillo.length < 3) {
      // El diagnóstico apunta a un lado que la geometría recibida ya no tiene: es
      // que se están pintando juntos un diagnóstico y una geometría de momentos
      // distintos. No se dibuja nada inventado y se dice (regla de oro 1).
      avisar(
        `No se ha podido resaltar el lindero de máxima desviación: el recinto ` +
          `${max.recinto} no está en la geometría recibida.`,
        { nivel: NIVEL.AVISO },
      )
      return
    }

    // El lado resaltado: del vértice `indice` al siguiente, con el módulo del anillo
    // (el último lado es el de cierre).
    const n = anillo.length
    const a = anillo[max.indice % n]
    const b = anillo[(max.indice + 1) % n]
    poner(
      L.polyline([aLatLng(a), aLatLng(b)], {
        pane: PANE.DIAGNOSTICO,
        interactive: false,
        color: COLOR_DESVIACION,
        weight: 4,
        opacity: 0.9,
      }),
    )

    // La línea guía: del punto medido a su homólogo oficial. ES el segmento que se
    // acota, así que se dibuja aunque sea corto; lo que se filtra por píxeles es el
    // RÓTULO, no la línea.
    const pMedido = aLatLng(max.en)
    const pOficial = aLatLng(max.enOficial)
    poner(
      L.polyline([pMedido, pOficial], {
        pane: PANE.DIAGNOSTICO,
        interactive: false,
        color: COLOR_DESVIACION,
        weight: 1.5,
        dashArray: '4 3',
        opacity: 0.95,
      }),
    )

    const q0 = mapa.latLngToLayerPoint(pMedido)
    const q1 = mapa.latLngToLayerPoint(pOficial)
    if (Math.hypot(q0.x - q1.x, q0.y - q1.y) <= minimoPx) return

    poner(
      L.marker([(pMedido[0] + pOficial[0]) / 2, (pMedido[1] + pOficial[1]) / 2], {
        pane: PANE.DIAGNOSTICO,
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'gml-cota-diagnostico',
          // `divIcon` y no `L.Icon` por lo mismo que en `viewer/sincronizacion.js`
          // (hallazgo C8): un icono con URL se rompe entre dev, build y jsdom.
          html: `<span>${formatearMetros(max.maxima)}</span>`,
          iconSize: null,
        }),
      }),
    )
  }

  // ── 4 · La banda del margen de identidad ──────────────────────────────────

  function pintarMargen(margen, geometriaOficial) {
    if (!margen || !Number.isFinite(margen.perimetroM)) return
    const anillos = anillosLatLng(geometriaOficial)
    if (anillos.length === 0) return

    const escala = pxPorMetro(geometriaOficial[0].vertices[0])
    if (escala <= 0) return

    // El margen es ±, así que la banda tiene el DOBLE de anchura que la cifra: se
    // extiende otro tanto a cada lado del lindero. Dibujarla con el ancho de la
    // cifra sola mostraría la mitad del margen y sería una banda que miente.
    const anchoPx = Math.min(2 * margen.perimetroM * escala, MARGEN_MAX_PX)
    // Por debajo de un píxel no hay banda que ver, y un trazo de 0,3 px se pinta
    // como una línea fina indistinguible del lindero: mejor no dibujar nada que
    // dibujar algo que se lee como otra cosa.
    if (anchoPx < 1) return

    for (const anillo of anillos) {
      poner(
        L.polyline([...anillo, anillo[0]], {
          pane: PANE.DIAGNOSTICO,
          interactive: false,
          color: COLOR_MARGEN,
          weight: anchoPx,
          opacity: 0.3,
          dashArray: TRAZO_MARGEN,
          lineCap: 'butt',
        }),
      )
    }
  }

  /**
   * Metros con dos decimales y coma decimal. El formato de SALIDA vive aquí y no en
   * `diagnostico/`, que devuelve float64 completo (regla de oro 11).
   */
  function formatearMetros(m) {
    return `${m.toFixed(2).replace('.', ',')} m`
  }

  /** Quita del mapa todo lo puesto por el último `pintar`. */
  function limpiar() {
    for (const capa of capas) {
      try {
        mapa.removeLayer(capa)
      } catch {
        // Una capa que ya no está en el mapa no es un error que deba tumbar el
        // desmontaje del resto: el desmontaje es idempotente en todo el visor.
      }
    }
    capas = []
  }

  /**
   * Pinta el contraste. Idempotente: cada llamada limpia lo anterior, así que
   * llamarla dos veces con el mismo diagnóstico deja el mapa igual.
   *
   * @param {object|null} diagnostico  Lo que devuelve `diagnostico/parcela.js`.
   *   `null` ⇒ solo limpia (el cajón se ha cerrado).
   * @param {{recintos?: Array, geometriaOficial?: Array|null}} [geometria]  Las dos
   *   geometrías. Hacen falta porque el diagnóstico trae CIFRAS y referencias a
   *   lados (`{recinto, indice}`), no los contornos: es lo que mantiene
   *   `diagnostico/` ciego a la vista.
   */
  function pintar(diagnostico, geometria = {}) {
    if (!vivo) return
    limpiar()
    if (diagnostico === null || diagnostico === undefined) {
      ultimo = null
      return
    }

    const { recintos = null, geometriaOficial = null } = geometria
    ultimo = { diagnostico, recintos, geometriaOficial }

    // El orden de pintado ES el orden de apilado dentro del pane: la diferencia va
    // debajo (es el fondo del hallazgo), las invasiones encima, y el resalte de la
    // desviación con su cota al final para que no lo tape nada.
    pintarMargen(diagnostico.margen, geometriaOficial)
    pintarDiferencia(recintos, geometriaOficial)
    pintarInvasiones(diagnostico.invasion)
    pintarDesviacion(diagnostico.desviacion, recintos)
  }

  /**
   * Repinta con lo último recibido. La banda del margen se mide en PÍXELES a partir
   * de metros, así que su anchura tiene que rehacerse con cada zoom; y el filtro del
   * rótulo de la cota también es en píxeles. Es el mismo motivo por el que
   * `viewer/acotaciones.js` escucha estos dos eventos.
   */
  function repintar() {
    if (!vivo || ultimo === null) return
    const { diagnostico, recintos, geometriaOficial } = ultimo
    pintar(diagnostico, { recintos, geometriaOficial })
  }

  mapa.on('zoomend moveend', repintar)

  return {
    pintar,
    limpiar,

    /** Deshace todo, incluidos los listeners del mapa. Idempotente. */
    destruir() {
      if (!vivo) return
      vivo = false
      mapa.off('zoomend moveend', repintar)
      limpiar()
      ultimo = null
    },
  }
}

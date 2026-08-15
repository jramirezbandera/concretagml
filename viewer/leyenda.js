// viewer/leyenda.js — QUÉ SIGNIFICA CADA GRAFISMO DEL MAPA.
//
// ── POR QUÉ EXISTE (2026-08-15) ─────────────────────────────────────────────
// El visor dibuja, a la vez y sobre la misma ortofoto, hasta ONCE grafismos
// distintos que **nadie presenta**: el amarillo del levantamiento, el gris
// discontinuo del parcelario vigente, el gris clarito de las vecinas, la mancha
// fría de la diferencia de superficie, el ámbar de la invasión, el rosa de la
// desviación máxima, la banda punteada del margen de identidad, el cian del
// sobrante, el violeta de las huellas… Todos están elegidos por descarte y con su
// porqué escrito en el módulo que los pinta —ver `COLOR_USUARIO` en
// `viewer/_comun.js` y las cabeceras de `contraste.js`, `colindantes.js`,
// `piezas.js` y `partes.js`—, y ese porqué **no llega a la pantalla**: quien abre
// la aplicación ve una mancha gris sobre su parcela y no tiene dónde enterarse de
// si es un defecto, una advertencia o la explicación de una cifra.
//
// Este control es ese sitio. Y es, además, la única pieza del visor que puede
// decirlo: las cifras del diagnóstico las explica su panel, pero **la mitad del
// diagnóstico se lee mirando el mapa** (está escrito en la cabecera de
// `viewer/cajon-diagnostico.js`, y es la razón por la que aquel cajón se mudó a la
// columna para no tapar lo que sus números señalan).
//
// ── ⛔ LA REGLA DE ORO 9 TAMBIÉN MANDA AQUÍ ─────────────────────────────────
// «La aplicación mide; el colegiado interpreta y firma.» Una leyenda es
// exactamente el sitio donde se cuela un veredicto sin querer: basta con escribir
// «zona conflictiva» donde pone «invasión a colindante», o «error» donde pone
// «diferencia de superficie». Así que cada renglón dice **qué es el dibujo**, y
// jamás si está bien. La ÚNICA entrada con carga es la invasión, que es la única
// excepción que la spec autoriza (§10.4: hecho topológico binario con consecuencia
// fija) — y el ámbar que lleva es el mismo, y por lo mismo, que el de la capa.
//
// ── ⚠️ LA PALETA SE DECLARA AQUÍ, Y ESO ES DELIBERADO ───────────────────────
// Los hex de abajo están REPETIDOS: cada uno vive también en el módulo que lo
// pinta. Es la convención que `viewer/piezas.js` dejó escrita al elegir su cian
// («cada capa declara su paleta con el porqué al lado, porque el porqué es
// distinto en cada una aunque el hex coincida»), y esta capa la sigue por la misma
// razón y con una propia: importar el color de cinco módulos de dibujo —uno de
// ellos `sincronizacion.js`, que arrastra el modelo entero— para pintar un
// cuadradito de 22 px sería pagar toda esa carga por una cadena de siete
// caracteres.
//
// Lo que NO puede pasar es que diverjan: **una leyenda que miente es peor que no
// tenerla**, porque el usuario deja de mirar el mapa y se cree la tarjeta. Contra
// eso hay un guardián que lee el fuente de los cinco módulos de dibujo y exige que
// cada hex de {@link ENTRADAS} siga apareciendo en el suyo
// (`test/viewer/leyenda.dom.test.js`). Si alguien retoca un color en su capa y se
// olvida de aquí, la suite se pone roja el mismo día.
//
// ── POR QUÉ NACE PLEGADA ────────────────────────────────────────────────────
// Porque el mapa es el asunto y la leyenda es el pie de foto. Desplegada de fábrica
// taparía ~240 × 320 px de ortofoto en la esquina que queda libre, que es justo
// donde suele caer la parcela cuando el encuadre la centra. Plegada cuesta una
// pastilla de 90 px que se lee «Leyenda» y se abre de un clic — y **recuerda cómo
// la dejaste** dentro de la sesión del visor, porque quien la abre una vez la
// quiere abierta.
//
// ── `disableClickPropagation` / `disableScrollPropagation`: OBLIGATORIOS ────
// Mismo motivo, y misma lección, que `viewer/capas.js` y `viewer/barra-edicion.js`:
// sin ellos, pulsar dentro de la leyenda seleccionaría un lindero por debajo y la
// rueda sobre la lista haría zoom al mapa.
//
// ── ESTE MÓDULO ES UNA VISTA, Y NO SABE QUÉ HAY DIBUJADO ────────────────────
// No consulta el mapa, no se suscribe a nada y no conoce el modelo: recibe qué
// GRUPOS enseñar y pinta sus renglones. Quien sabe si hay un diagnóstico en
// pantalla o si la rama es EDIFICIO es la aplicación, y se lo dice con
// {@link crearLeyenda}#grupos. El defecto —los dos grupos que siempre hay algo
// que explicar— deja al visor montado a pelo con una leyenda honrada.

import L from 'leaflet'

import { resolverAvisar } from './_comun.js'

/** Esquinas válidas de un `L.Control`: las claves de `map._controlCorners`. */
const POSICIONES = ['topleft', 'topright', 'bottomleft', 'bottomright']

/**
 * Los grupos de la leyenda. **Son el eje por el que la aplicación enciende y apaga
 * renglones**, y por eso están exportados: el llamante no escribe cadenas a mano.
 *
 * Se agrupa por DE QUIÉN ES EL DIBUJO y no por color ni por capa de Leaflet,
 * porque es la pregunta que el usuario trae: «esto que veo, ¿lo he puesto yo o me
 * lo ha traído el Catastro?». Es la misma distinción que el renglón de procedencia
 * del panel de diagnóstico declara con palabras.
 *
 * @readonly
 */
export const GRUPO = Object.freeze({
  LEVANTAMIENTO: 'levantamiento',
  CATASTRO: 'catastro',
  DIAGNOSTICO: 'diagnostico',
  SOBRANTE: 'sobrante',
  EDIFICIO: 'edificio',
})

/** Rótulo humano de cada grupo, en versalitas sobre sus renglones. */
export const ROTULO_GRUPO = Object.freeze({
  [GRUPO.LEVANTAMIENTO]: 'Tu medición',
  [GRUPO.CATASTRO]: 'Del Catastro',
  [GRUPO.DIAGNOSTICO]: 'Diagnóstico de encaje',
  [GRUPO.SOBRANTE]: 'Sobrante derivado',
  [GRUPO.EDIFICIO]: 'Construcción',
})

/**
 * Los grupos que se enseñan si nadie dice otra cosa: los dos que están dibujados
 * **siempre que hay algo en el mapa**. Los otros tres se encienden desde fuera
 * porque solo existen en su pantalla, y anunciar un grafismo que no está sería la
 * otra forma de mentir que tiene una leyenda.
 */
export const GRUPOS_POR_DEFECTO = Object.freeze([GRUPO.LEVANTAMIENTO, GRUPO.CATASTRO])

/**
 * Formas de muestra. **Son cuatro y no una sola caja de color**, y la diferencia
 * es información: el parcelario vigente y el margen de identidad son los dos
 * grises discontinuos, y lo único que los distingue sobre el mapa es el grosor del
 * trazo. Una leyenda que los pintara a los dos como un cuadradito gris no serviría
 * para lo que se abre.
 *
 * @readonly
 */
export const MUESTRA = Object.freeze({
  /** Polígono: contorno + relleno translúcido. */
  AREA: 'area',
  /** Línea: solo trazo, con el `dashArray` real de la capa. */
  LINEA: 'linea',
  /** El cuadradito que se agarra con el ratón. */
  PUNTO: 'punto',
  /** Un rótulo sobre fondo oscuro, como la cota del mapa. */
  ROTULO: 'rotulo',
})

/**
 * ⭐ **EL CATÁLOGO: un renglón por grafismo que el visor sabe dibujar.**
 *
 * `color` es el hex REAL con el que se pinta, repetido a propósito (ver la
 * cabecera) y vigilado por un guardián que lee el fuente del módulo dueño.
 *
 * ⚠️ **`fuente` es el módulo que DECLARA el hex, no siempre el que dibuja**, y la
 * diferencia importa porque es lo que el guardián va a leer. El amarillo lo declara
 * `viewer/_comun.js` (`COLOR_USUARIO`) y lo dibujan tres capas distintas
 * —`sincronizacion.js` el recinto y el vértice, `acotaciones.js` la cota—; apuntar
 * a cualquiera de ellas dejaría la guarda pasando por una mención en un comentario
 * en vez de por el valor, que es exactamente el falso verde que costó descubrir al
 * escribirla. Los demás colores sí los declara su propia capa, con el porqué al
 * lado, y ahí `fuente` es esa capa.
 *
 * `texto` dice qué ES el dibujo. Ni un adjetivo de mérito, salvo la invasión.
 *
 * @readonly
 */
export const ENTRADAS = Object.freeze([
  // ── Tu medición ───────────────────────────────────────────────────────────
  Object.freeze({
    id: 'recinto',
    grupo: GRUPO.LEVANTAMIENTO,
    muestra: MUESTRA.AREA,
    color: '#FFD600',
    relleno: 0.12,
    texto: 'Recinto que has medido o editado.',
    // Lo dibuja `viewer/sincronizacion.js`; el color lo declara `_comun.js`.
    fuente: 'viewer/_comun.js',
  }),
  Object.freeze({
    id: 'vertice',
    grupo: GRUPO.LEVANTAMIENTO,
    muestra: MUESTRA.PUNTO,
    color: '#FFD600',
    texto: 'Vértice: se arrastra para mover el lindero.',
    fuente: 'viewer/_comun.js',
  }),
  Object.freeze({
    id: 'cota',
    grupo: GRUPO.LEVANTAMIENTO,
    muestra: MUESTRA.ROTULO,
    color: '#FFD600',
    texto: 'Longitud del lado, en metros.',
    // Lo dibuja `viewer/acotaciones.js`, que también importa `COLOR_USUARIO`.
    fuente: 'viewer/_comun.js',
  }),
  // ── Del Catastro ──────────────────────────────────────────────────────────
  Object.freeze({
    id: 'oficial',
    grupo: GRUPO.CATASTRO,
    muestra: MUESTRA.LINEA,
    color: '#6B7280',
    trazo: '4 3',
    grosor: 1,
    texto: 'Parcelario vigente: el contorno oficial de tu parcela.',
    fuente: 'viewer/sincronizacion.js',
  }),
  Object.freeze({
    id: 'colindante',
    grupo: GRUPO.CATASTRO,
    muestra: MUESTRA.LINEA,
    color: '#CBD5E1',
    grosor: 1.5,
    texto: 'Parcelas colindantes traídas del Catastro.',
    fuente: 'viewer/colindantes.js',
  }),
  // ── Diagnóstico de encaje ─────────────────────────────────────────────────
  Object.freeze({
    id: 'diferencia',
    grupo: GRUPO.DIAGNOSTICO,
    muestra: MUESTRA.AREA,
    color: '#64748B',
    relleno: 0.22,
    texto: 'Diferencia entre tu medición y el parcelario vigente.',
    fuente: 'viewer/contraste.js',
  }),
  Object.freeze({
    id: 'invasion',
    grupo: GRUPO.DIAGNOSTICO,
    muestra: MUESTRA.AREA,
    color: '#D97706',
    relleno: 0.45,
    // La ÚNICA entrada con carga de toda la leyenda, y la única autorizada: es un
    // hecho topológico binario, no una interpretación. Ver la cabecera.
    texto: 'Invasión: tu recinto entra en una parcela vecina.',
    fuente: 'viewer/contraste.js',
  }),
  Object.freeze({
    id: 'desviacion',
    grupo: GRUPO.DIAGNOSTICO,
    muestra: MUESTRA.LINEA,
    color: '#DB2777',
    grosor: 4,
    texto: 'Lindero con la desviación máxima frente al oficial.',
    fuente: 'viewer/contraste.js',
  }),
  Object.freeze({
    id: 'margen',
    grupo: GRUPO.DIAGNOSTICO,
    muestra: MUESTRA.LINEA,
    color: '#94A3B8',
    trazo: '2 6',
    grosor: 6,
    texto: 'Margen de identidad del Catastro, a escala del mapa.',
    fuente: 'viewer/contraste.js',
  }),
  // ── Sobrante derivado ─────────────────────────────────────────────────────
  Object.freeze({
    id: 'pieza',
    grupo: GRUPO.SOBRANTE,
    muestra: MUESTRA.AREA,
    color: '#22D3EE',
    relleno: 0.35,
    texto: 'Pieza del sobrante que se propone segregar.',
    fuente: 'viewer/piezas.js',
  }),
  Object.freeze({
    id: 'fuera',
    grupo: GRUPO.SOBRANTE,
    muestra: MUESTRA.AREA,
    color: '#D97706',
    relleno: 0.35,
    texto: 'Trozo que se sale del contorno oficial.',
    fuente: 'viewer/piezas.js',
  }),
  // ── Construcción ──────────────────────────────────────────────────────────
  Object.freeze({
    id: 'huella',
    grupo: GRUPO.EDIFICIO,
    muestra: MUESTRA.AREA,
    color: '#A78BFA',
    relleno: 0.3,
    texto: 'Huella de una parte de la construcción.',
    fuente: 'viewer/partes.js',
  }),
])

/**
 * Clases CSS de la leyenda. **Son contrato con `estilos/app.css`**, igual que las
 * de `viewer/cajon-diagnostico.js`: la hoja de la aplicación viste el cromo fino
 * (la familia tipográfica, sobre todo) y este módulo solo pone lo MÍNIMO en línea
 * para que se lea sin ninguna hoja cargada — en `npm run dev` sobre un mapa pelado
 * y en jsdom.
 */
export const CLASE = Object.freeze({
  CONTENEDOR: 'gml-leyenda',
  PASTILLA: 'gml-leyenda-pastilla',
  PANEL: 'gml-leyenda-panel',
  GRUPO: 'gml-leyenda-grupo',
  ENTRADA: 'gml-leyenda-entrada',
  MUESTRA: 'gml-leyenda-muestra',
})

/**
 * Los `data-*` que este módulo produce. Contrato con quien lo cablee y con las
 * pruebas, que no escriben literales a mano: una cadena mal tecleada en un
 * `querySelector` devuelve `null` sin quejarse.
 *
 * ⚠️ `data-accion="alternar-leyenda"` y no `leyenda` a secas, por la lección M8 que
 * `viewer/cajon-diagnostico.js` dejó escrita: los valores de `data-accion` son
 * VERBOS en toda la aplicación, y un sustantivo suelto es el nombre que le pondría
 * el siguiente que añada otro mando de leyenda en cualquier otro sitio.
 */
export const SELECTOR = Object.freeze({
  ALTERNAR: '[data-accion="alternar-leyenda"]',
  PANEL: '[data-leyenda="panel"]',
  ENTRADA: '[data-leyenda-entrada]',
})

/** Lo que dice la pastilla. Es un sustantivo porque nombra lo que abre. */
export const ROTULO = 'Leyenda'

/** Tamaños del cromo. Uno solo por trabajo, como la escala del cajón. */
const ESCALA = Object.freeze({
  /** Los renglones y el rótulo de la pastilla. */
  CUERPO: '12px',
  /** El rótulo de grupo, en versalitas. */
  ROTULO: '10px',
})

/**
 * Ancho y alto de una muestra, en px. El ancho da para que un `dashArray` de
 * `2 6` —ocho píxeles de ciclo— enseñe dos huecos y se lea COMO discontinuo; con
 * los 14 px que pedía la rejilla se veía un guion suelto y no significaba nada.
 */
const MUESTRA_ANCHO_PX = 26
const MUESTRA_ALTO_PX = 14

/**
 * ⭐ **EL FONDO DE DOS TONOS DE LAS MUESTRAS, Y POR QUÉ NO SON BLANCAS.**
 *
 * ⛔ **Defecto REAL, medido en el navegador el 2026-08-15 sobre la primera
 * versión de este control**: sobre el blanco de la tarjeta, la muestra de «parcelas
 * colindantes» —`#CBD5E1`, slate-300— **no se veía**. Da 1,3:1 de contraste, o sea
 * un renglón con su texto y un hueco donde tendría que estar el grafismo. Una
 * leyenda con una muestra invisible es exactamente el fallo silencioso que este
 * control existe para cerrar: el usuario lee «parcelas colindantes» y sigue sin
 * saber cómo son.
 *
 * ── POR QUÉ NO SIRVE UN FONDO PLANO, Y ESTÁ CALCULADO ───────────────────────
 * Los colores del visor están elegidos para leerse sobre una ORTOFOTO, que va de
 * asfalto casi blanco a arbolado en sombra en el mismo encuadre, así que la paleta
 * tiene claros y oscuros a propósito. Ningún gris plano les sirve a todos:
 *
 *     fondo        #CBD5E1 (colindante)   #6B7280 (parcelario vigente)
 *     ─────────    ────────────────────   ───────────────────────────
 *     blanco       1,3:1  ⛔               4,8:1  ✅
 *     #94A3B8      1,6:1  ⛔               1,9:1  ⛔
 *     #64748B      2,6:1  ✅               1,1:1  ⛔
 *
 * O sea: cualquier plano deja fuera a uno de los dos. Lo que funciona es **tener
 * las dos mitades**, que es lo que hace un pie de foto de cartografía de toda la
 * vida — la muestra se pinta sobre un trozo de terreno, no sobre papel.
 *
 * Así que cada muestra va sobre una banda diagonal clara→oscura, y todo grafismo
 * la cruza entera: el que se pierda en una mitad se lee en la otra. Y de paso dice
 * la verdad sobre los rellenos, que en el mapa son TRANSLÚCIDOS: sobre esta banda
 * se ve que dejan pasar lo de debajo, igual que dejan ver la ortofoto.
 *
 * ⚠️ No lo lleva {@link MUESTRA.ROTULO}: la cota trae su propia pastilla oscura
 * —es la que le pone `viewer/acotaciones.js` para poder leerse sobre cualquier
 * fondo— y ponerle otra debajo sería dibujar dos cosas donde en el mapa hay una.
 */
const FONDO_MUESTRA =
  'linear-gradient(135deg,#F1F5F9 0%,#F1F5F9 46%,#64748B 54%,#64748B 100%)'

const crear = (doc, etiqueta, clase, texto) => {
  const el = doc.createElement(etiqueta)
  if (clase) el.className = clase
  if (texto !== undefined) el.textContent = texto
  return el
}

/**
 * Aplica estilos en línea propiedad a propiedad. **No se usa `style.cssText`**, y
 * por la misma razón exacta que lo explica `viewer/cajon-diagnostico.js#estilar`:
 * la guarda transversal del punto 12 prohíbe la subcadena `.css` en el código de
 * `viewer/`, y `.cssText` la contiene.
 *
 * @param {HTMLElement} el
 * @param {Record<string, string>} estilos  Propiedades en camelCase.
 * @returns {HTMLElement}  El mismo elemento, para poder encadenar.
 */
function estilar(el, estilos) {
  for (const [propiedad, valor] of Object.entries(estilos)) el.style[propiedad] = valor
  return el
}

/**
 * Un color hex de 6 dígitos con alfa, como `rgba()`.
 *
 * Se compone a mano en vez de escribir el `rgba` literal en {@link ENTRADAS}
 * porque el guardián de divergencia compara HEX contra el fuente de la capa: si
 * aquí se guardara el color ya convertido, no habría nada que comparar y la
 * leyenda podría irse quedando vieja en silencio, que es justo lo que no puede
 * pasar.
 *
 * @param {string} hex  `#RRGGBB`.
 * @param {number} alfa  0…1.
 * @returns {string}
 */
function conAlfa(hex, alfa) {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alfa})`
}

/**
 * Fabrica la muestra de una entrada: el trocito de dibujo que se compara con el
 * mapa. Es lo que hace que la leyenda sirva — un renglón de texto con el nombre
 * del color obligaría a traducir «gris azulado» a lo que se ve, que es
 * precisamente el trabajo que se está quitando.
 *
 * @param {Document} doc
 * @param {(typeof ENTRADAS)[number]} entrada
 * @returns {HTMLElement}
 */
function muestraDe(doc, entrada) {
  const caja = crear(doc, 'span', CLASE.MUESTRA)
  // `aria-hidden`: la muestra ES el texto de al lado dicho en dibujo. Un lector de
  // pantalla que la anunciara diría «imagen» dos veces por renglón y no añadiría
  // ni un dato — el renglón ya nombra el grafismo con palabras.
  caja.setAttribute('aria-hidden', 'true')
  estilar(caja, {
    flex: 'none',
    display: 'inline-block',
    width: `${MUESTRA_ANCHO_PX}px`,
    height: `${MUESTRA_ALTO_PX}px`,
    position: 'relative',
    marginTop: '1px',
    borderRadius: '2px',
    overflow: 'hidden',
  })
  // La banda de dos tonos, debajo de TODO menos de la cota. Ver {@link FONDO_MUESTRA}
  // para el defecto medido que cierra y para la tabla de contrastes que descarta
  // cualquier fondo plano.
  if (entrada.muestra !== MUESTRA.ROTULO) caja.style.backgroundImage = FONDO_MUESTRA

  if (entrada.muestra === MUESTRA.AREA) {
    estilar(caja, {
      // El relleno va como CAPA sobre la banda, no como `background` que la
      // sustituya: en el mapa el relleno es translucido y deja ver la ortofoto, y
      // aqui tiene que dejar ver lo mismo. Un color solido aqui mentiria sobre el
      // unico rasgo que distingue una mancha de F07 de un poligono opaco.
      backgroundImage: `linear-gradient(0deg, ${conAlfa(entrada.color, entrada.relleno)}, ` +
        `${conAlfa(entrada.color, entrada.relleno)}), ${FONDO_MUESTRA}`,
      border: `2px solid ${entrada.color}`,
      boxSizing: 'border-box',
    })
    return caja
  }

  if (entrada.muestra === MUESTRA.PUNTO) {
    // El cuadradito del vértice, centrado en su hueco y con el mismo anillo oscuro
    // que le pone `crearIconoVertice`: sin él, un cuadrado amarillo sobre el fondo
    // blanco de la tarjeta es casi invisible (~1,4:1), que es exactamente la
    // advertencia escrita en `COLOR_USUARIO`.
    const punto = crear(doc, 'span')
    estilar(punto, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%,-50%)',
      width: '10px',
      height: '10px',
      background: entrada.color,
      border: '2px solid #fff',
      boxShadow: '0 0 0 1px rgba(0,0,0,.35)',
    })
    caja.append(punto)
    return caja
  }

  if (entrada.muestra === MUESTRA.ROTULO) {
    // La cota tal cual se ve: amarillo sobre pastilla oscura translúcida, que es lo
    // que `viewer/acotaciones.js` monta para poder leerse sobre cualquier fondo.
    estilar(caja, {
      background: 'rgba(17,24,39,.82)',
      borderRadius: '3px',
      color: entrada.color,
      fontSize: '9px',
      lineHeight: `${MUESTRA_ALTO_PX}px`,
      textAlign: 'center',
      fontVariantNumeric: 'tabular-nums',
    })
    caja.textContent = '12,4 m'
    return caja
  }

  // LINEA. El trazo va en un hijo centrado verticalmente y no en el borde de la
  // caja: un `borderTop` sobre la caja dejaría la línea pegada arriba y las de 4 y
  // 6 px se leerían desalineadas contra las de 1 px de su misma columna.
  const linea = crear(doc, 'span')
  const grosor = entrada.grosor ?? 2
  // Un `dashArray` de Leaflet («2 6» = 2 px de trazo, 6 de hueco) se reproduce con
  // un degradado repetido, que es lo único que un `border-style: dashed` no sabe
  // hacer: el navegador elige el ritmo del `dashed` por su cuenta y no se
  // parecería al del mapa.
  let fondo = entrada.color
  if (entrada.trazo) {
    const [pinta, hueco] = trazoPx(entrada.trazo)
    fondo =
      `repeating-linear-gradient(to right, ${entrada.color} 0 ${pinta}px, ` +
      `transparent ${pinta}px ${pinta + hueco}px)`
  }
  estilar(linea, {
    position: 'absolute',
    top: '50%',
    left: '0',
    right: '0',
    transform: 'translateY(-50%)',
    height: `${grosor}px`,
    background: fondo,
  })
  caja.append(linea)
  return caja
}

/**
 * Un `dashArray` de Leaflet (`'4 3'`) como par de números.
 *
 * @param {string} trazo
 * @returns {[number, number]}
 */
function trazoPx(trazo) {
  const [a, b] = trazo.split(/[\s,]+/).map(Number)
  return [a, Number.isFinite(b) ? b : a]
}

const esMapa = (m) =>
  !!m &&
  typeof m.addControl === 'function' &&
  typeof m.removeControl === 'function' &&
  typeof m.getContainer === 'function'

// ── El control ───────────────────────────────────────────────────────────────

const ControlLeyenda = L.Control.extend({
  options: {
    position: 'bottomleft',
    etiqueta: 'Leyenda de los grafismos del mapa',
  },

  initialize(opciones) {
    L.setOptions(this, opciones)
    this._abierta = false
    this._grupos = [...GRUPOS_POR_DEFECTO]
  },

  onAdd(mapa) {
    const doc = mapa.getContainer().ownerDocument || document
    this._doc = doc
    const sello = L.Util.stamp(this)

    const contenedor = crear(doc, 'div', CLASE.CONTENEDOR)
    this._contenedor = contenedor
    estilar(contenedor, {
      font: `${ESCALA.CUERPO}/1.4 system-ui,sans-serif`,
      color: '#334155',
      // Al abrirse crece HACIA ARRIBA y no hacia abajo, que es lo que hace que la
      // pastilla no se mueva bajo el dedo que acaba de pulsarla.
      display: 'flex',
      flexDirection: 'column-reverse',
      alignItems: 'start',
      gap: '6px',
    })

    const idPanel = `gml-leyenda-panel-${sello}`

    // ── La pastilla: lo único que se ve plegada ─────────────────────────────
    const pastilla = crear(doc, 'button', CLASE.PASTILLA, ROTULO)
    pastilla.type = 'button'
    pastilla.dataset.accion = 'alternar-leyenda'
    // `aria-expanded` + `aria-controls`: es un revelador, y quien no ve la pantalla
    // tiene que saber si lo que controla está abierto ANTES de pulsarlo.
    pastilla.setAttribute('aria-expanded', 'false')
    pastilla.setAttribute('aria-controls', idPanel)
    estilar(pastilla, {
      background: '#ffffff',
      color: '#334155',
      border: '0',
      borderRadius: '6px',
      boxShadow: '0 1px 4px rgba(15,23,42,.3)',
      padding: '6px 10px',
      // NI `font-family` NI `font: inherit`: el estilo en línea gana a la hoja y
      // dejaría muerta la regla de `estilos/app.css`, que es la que pone Geist. El
      // módulo fija tamaño y grosor (legible sin hoja); la FAMILIA la pone la hoja.
      // Es el defecto REAL que los botones del cajón de diagnóstico pagaron el
      // 2026-07-30 y que allí está escrito con todas las letras.
      fontSize: ESCALA.CUERPO,
      fontWeight: '600',
      lineHeight: '1',
      cursor: 'pointer',
    })
    this._pastilla = pastilla

    // ── El panel: los renglones ─────────────────────────────────────────────
    const panel = crear(doc, 'div', CLASE.PANEL)
    panel.id = idPanel
    panel.dataset.leyenda = 'panel'
    // `<section>` no: el panel no tiene encabezado propio —lo que lo nombra es la
    // pastilla que lo abre— y una región anónima más en el árbol solo añade ruido
    // al navegar por hitos. La etiqueta viaja en `aria-label`.
    panel.setAttribute('role', 'group')
    panel.setAttribute('aria-label', this.options.etiqueta)
    estilar(panel, {
      background: '#ffffff',
      borderRadius: '6px',
      boxShadow: '0 2px 10px rgba(15,23,42,.25)',
      padding: '10px 12px',
      // El tope de alto es lo que impide que una leyenda con los cinco grupos
      // encendidos se coma la ventana entera en un portátil: a partir de ahí
      // scrollea por dentro, como el cajón de diagnóstico.
      maxHeight: 'min(60vh, 420px)',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      maxWidth: 'min(290px,60vw)',
      display: 'none',
    })
    this._panel = panel

    contenedor.append(panel, pastilla)

    // OBLIGATORIOS: sin ellos, pulsar dentro seleccionaría un lindero por debajo y
    // la rueda sobre la lista haría zoom al mapa.
    L.DomEvent.disableClickPropagation(contenedor)
    L.DomEvent.disableScrollPropagation(contenedor)
    L.DomEvent.on(pastilla, 'click', this._alPulsar, this)

    this._repintar()
    return contenedor
  },

  onRemove() {
    if (this._pastilla) L.DomEvent.off(this._pastilla, 'click', this._alPulsar, this)
  },

  _alPulsar(evento) {
    L.DomEvent.stop(evento)
    this._fijarAbierta(!this._abierta)
  },

  _fijarAbierta(abierta) {
    this._abierta = abierta === true
    if (!this._panel || !this._pastilla) return
    this._panel.style.display = this._abierta ? '' : 'none'
    this._pastilla.setAttribute('aria-expanded', this._abierta ? 'true' : 'false')
  },

  /**
   * Rehace los renglones. Se llama al nacer y cada vez que cambian los grupos.
   *
   * Se REHACE entero en vez de esconder y enseñar renglones ya fabricados, y es a
   * propósito: un renglón oculto sigue en el árbol de accesibilidad de algunos
   * lectores según cómo se esconda, y una leyenda que ANUNCIA un grafismo que no
   * está dibujado es exactamente la forma de mentir que este control tiene
   * prohibida. Doce nodos no valen una optimización.
   */
  _repintar() {
    const doc = this._doc
    const panel = this._panel
    if (!doc || !panel) return
    panel.replaceChildren()

    for (const grupo of Object.values(GRUPO)) {
      if (!this._grupos.includes(grupo)) continue
      const entradas = ENTRADAS.filter((e) => e.grupo === grupo)
      if (entradas.length === 0) continue

      // `<h3>` y no `<p>`: son los hijos del hito que el panel abre, y así un lector
      // de pantalla salta de grupo en grupo. Mismo criterio, y mismo gris `#475569`
      // por lo mismo (a 10 px, `#64748B` sobre blanco da 4,55:1 y no sobra nada),
      // que `viewer/cajon-diagnostico.js#rotuloDeGrupo`.
      const rotulo = crear(doc, 'h3', CLASE.GRUPO, ROTULO_GRUPO[grupo])
      estilar(rotulo, {
        margin: panel.childElementCount === 0 ? '0 0 5px' : '12px 0 5px',
        fontSize: ESCALA.ROTULO,
        fontWeight: '500',
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        color: '#475569',
      })
      panel.append(rotulo)

      const lista = crear(doc, 'ul')
      estilar(lista, { margin: '0', padding: '0', listStyle: 'none' })
      for (const entrada of entradas) {
        const fila = crear(doc, 'li', CLASE.ENTRADA)
        fila.dataset.leyendaEntrada = entrada.id
        estilar(fila, {
          display: 'flex',
          alignItems: 'start',
          gap: '8px',
          margin: '0 0 4px',
        })
        const texto = crear(doc, 'span', null, entrada.texto)
        estilar(texto, { minWidth: '0' })
        fila.append(muestraDe(doc, entrada), texto)
        lista.append(fila)
      }
      panel.append(lista)
    }
  },
})

/**
 * La leyenda de los grafismos del mapa, como control de Leaflet.
 *
 * ```js
 * const leyenda = crearLeyenda({ mapa })
 * leyenda.grupos([GRUPO.LEVANTAMIENTO, GRUPO.CATASTRO, GRUPO.DIAGNOSTICO])
 * leyenda.abrir()
 * ```
 *
 * @param {Object} opciones
 * @param {import('leaflet').Map} opciones.mapa  El mapa del visor.
 * @param {string} [opciones.posicion='bottomleft']  Esquina de Leaflet. El defecto
 *   no es arbitrario: `topleft` la ocupa el control de zoom, `topright` el de
 *   capas, `bottomright` el de opacidad **y** la atribución, y el borde inferior
 *   centrado la barra de edición de F06. `bottomleft` es la única esquina libre —
 *   la comparte con el cajón de diagnóstico cuando el visor se monta a pelo, y por
 *   eso esto nace PLEGADO y ocupa una pastilla.
 * @param {string[]} [opciones.grupos]  Qué grupos enseñar. Ver {@link GRUPO} y
 *   {@link GRUPOS_POR_DEFECTO}.
 * @param {boolean} [opciones.abierta=false]  Si nace desplegada.
 * @param {((mensaje: string, detalle?: object) => void)|null} [opciones.alAvisar]
 *   Canal de aviso (regla de oro 1). Se resuelve y valida aunque no se use, que es
 *   el patrón obligatorio del visor.
 * @returns {{control: object, grupos: Function, abrir: Function, cerrar: Function,
 *   abierta: Function, destruir: Function}}
 * @throws {TypeError|RangeError} Contrato del programador.
 */
export function crearLeyenda({
  mapa,
  posicion = 'bottomleft',
  grupos = GRUPOS_POR_DEFECTO,
  abierta = false,
  alAvisar,
} = {}) {
  if (!esMapa(mapa)) {
    throw new TypeError(
      `crearLeyenda: 'mapa' debe ser un mapa de Leaflet (con addControl/removeControl/` +
        `getContainer); recibido ${JSON.stringify(mapa)}.`,
    )
  }
  if (typeof posicion !== 'string') {
    throw new TypeError(
      `crearLeyenda: 'posicion' debe ser una cadena con una esquina de Leaflet; recibido ` +
        `${typeof posicion}.`,
    )
  }
  if (!POSICIONES.includes(posicion)) {
    throw new RangeError(
      `crearLeyenda: 'posicion' debe ser una esquina de Leaflet; recibido ` +
        `${JSON.stringify(posicion)}. Válidas: ${POSICIONES.join(', ')}.`,
    )
  }
  if (typeof abierta !== 'boolean') {
    throw new TypeError(
      `crearLeyenda: 'abierta' debe ser booleano; recibido ${typeof abierta}.`,
    )
  }
  // Patrón obligatorio del visor: se resuelve (y se valida) aunque no se use.
  resolverAvisar(alAvisar)

  const control = new ControlLeyenda({ position: posicion })
  mapa.addControl(control)

  let destruido = false

  /**
   * Valida y normaliza una lista de grupos.
   *
   * **Lanza con el grupo desconocido nombrado, y no lo ignora**: una leyenda a la
   * que se le pide un grupo que no existe se quedaría corta EN SILENCIO, y quien
   * la mirase creería que en esa pantalla no hay nada más dibujado. Es regla de
   * oro 1, y aquí muerde más que en ningún otro control del visor.
   *
   * @param {string[]} lista
   * @returns {string[]}
   */
  function validar(lista) {
    if (!Array.isArray(lista)) {
      throw new TypeError(
        `grupos: debe ser un array con los ids de GRUPO; recibido ${typeof lista}. ` +
          `Sin argumento LEE.`,
      )
    }
    const validos = Object.values(GRUPO)
    for (const id of lista) {
      if (!validos.includes(id)) {
        throw new RangeError(
          `grupos: '${JSON.stringify(id)}' no es un grupo de la leyenda. ` +
            `Válidos: ${validos.join(', ')}.`,
        )
      }
    }
    return [...new Set(lista)]
  }

  control._grupos = validar(grupos)
  control._repintar()
  control._fijarAbierta(abierta)

  return {
    control,

    /**
     * Qué grupos se están enseñando. Sin argumento LEE; con un array, ESCRIBE y
     * devuelve los aplicados.
     *
     * @param {string[]} [lista]
     * @returns {string[]}
     */
    grupos(lista) {
      if (destruido) return []
      if (lista === undefined) return [...control._grupos]
      control._grupos = validar(lista)
      control._repintar()
      return [...control._grupos]
    },

    abrir() {
      if (!destruido) control._fijarAbierta(true)
    },

    cerrar() {
      if (!destruido) control._fijarAbierta(false)
    },

    abierta() {
      return !destruido && control._abierta === true
    },

    /** Quita el control del mapa y deja el módulo inerte. IDEMPOTENTE. */
    destruir() {
      if (destruido) return
      destruido = true
      control.remove()
    },
  }
}

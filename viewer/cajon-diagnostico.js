// viewer/cajon-diagnostico.js — F07 · El CAJÓN del diagnóstico, sobre el mapa.
//
// ── QUÉ PROBLEMA RESUELVE, Y POR QUÉ NO ESTÁ EN EL PANEL ────────────────────
// La spec de F07 insinuaba un bloque más en el panel lateral. No cabe, y está
// MEDIDO: el panel reparte una altura FIJA entre bloques fijos, y el bloque
// «Edición» de F06 —270 px— dejó la caja de vértices en **64 px a 1440×900**, o sea
// un vértice y medio de los quince de la parcela. F06 lo cerró el 2026-07-29
// llevándose las herramientas a una barra flotante y la caja recuperó **303 px**,
// pero el problema de fondo sigue abierto: `estilos/app.css` avisa por escrito de
// que «el siguiente bloque que entre —F07 trae uno de diagnóstico— se lo vuelve a
// comer». Así que el diagnóstico no entra en el panel: vive **sobre el mapa**, como
// la barra de edición, y el panel no pierde ni un píxel.
//
// De paso gana lo que el panel no podía darle: **anchura**. La tabla a tres bandas
// (§10.2) enfrenta tres superficies con tres diferencias cruzadas, y eso son cinco
// columnas que en 320 px de panel no se leen.
//
// ── ESTE MÓDULO ES UNA VISTA, Y NADA MÁS ────────────────────────────────────
// Fabrica nodos, los rellena, los abre y los cierra. **No conoce el modelo, ni el
// store, ni la red, ni `diagnostico/parcela.js`.** Recibe el POJO del diagnóstico y
// lo pinta; quien lo calcula y quien lo cablea es `app/cableado-diagnostico.js`. Por
// eso aquí no se importa nada de `diagnostico/` salvo **una constante** —la etiqueta
// del margen— y ni una línea de `model/` o `edit/`. Es la misma doctrina, y por las
// mismas razones, que `viewer/barra-edicion.js`.
//
// ── F08 · POR QUÉ «DESCARGAR INFORME DE CONTRASTE» VIVE AQUÍ Y NO EN EL PIE ──
// El pie de `index.html` ya tiene dos CTA —«Generar GML» (F04) y «Diagnosticar
// encaje» (F07)— y el sitio natural de un tercero parecería ser ese. No lo es, y
// las tres razones son las que el plan de F08 fijó, en este orden:
//
//   1. **Es la acción que CONSUME el diagnóstico, y el diagnóstico se lee AQUÍ.**
//      El informe no es otra cosa que las cifras de este cajón puestas en un
//      fichero. Poner el botón en el panel, a un palmo de distancia de las cifras
//      que descarga, obligaría a recordar qué se estaba mirando para saber qué se
//      está bajando.
//   2. **El cajón tiene ANCHURA y el pie no.** Los CTA del pie van a lo ancho y
//      uno DEBAJO de otro —el razonamiento está escrito en `index.html`, junto al
//      de F07: «secundario y debajo del primario, no al lado»—, así que un tercero
//      cuesta ~36 px MEDIDOS de altura del panel, y esos píxeles salen de la caja
//      de vértices, que es justo la que lleva sin sitio desde F06. Aquí cuesta
//      **0 px de panel**, igual que costó traerse el diagnóstico al mapa.
//   3. **Sirve igual de bien a las DOS vías de entrada.** Quien llegó por
//      referencia catastral (F05) y quien llegó soltando un GML ajeno (F08)
//      quieren el mismo informe. El cajón es común a las dos, así que no hay que
//      ramificar la interfaz por procedencia — y `report/contraste-texto.js` acepta
//      `comprobacion: null` precisamente para eso.
//
// Lo que este módulo NO sabe es qué se escribe dentro del informe ni cómo baja:
// solo enciende el botón, lo apaga y avisa de que lo han pulsado. Componer el
// texto es de `report/contraste-texto.js` y entregarlo de
// `gml/descargar.js#descargarTexto`; a los dos los llama
// `app/cableado-diagnostico.js`, que es quien conoce el store y el reloj.
//
// ── LA REGLA DE ORO 9 ES EL REQUISITO PRINCIPAL DE ESTE FICHERO ─────────────
// «La aplicación mide; el colegiado interpreta y firma.» En un cajón lleno de cifras
// eso se traduce en tres prohibiciones concretas, y las tres tienen guardián:
//
//   1. **Ninguna cifra lleva color de mérito.** Todas en el gris del cromo del
//      visor. Nada de verde para «poco» y rojo para «mucho»: el umbral depende del
//      expediente, del municipio y del criterio de quien firma. La ÚNICA excepción
//      autorizada por la spec es la **invasión a colindante** (§10.4), que es un
//      hecho topológico binario con consecuencia fija — y ahí va ámbar.
//   2. **Ningún texto dictamina.** El titular es descriptivo («Contraste con el
//      parcelario — Medición de X m² frente a los Y m² del parcelario vigente»), no
//      «apta para presentar». No hay semáforo, ni «válido», ni «dentro de
//      tolerancia».
//   3. **El margen de identidad se ENUNCIA con su etiqueta**, nunca como veredicto.
//      La etiqueta viaja dentro del propio diagnóstico precisamente para que no se
//      pueda pintar la cifra sin ella.
//
// ── «NO HAY» Y «NO SE SABE» SE ESCRIBEN DISTINTO ────────────────────────────
// Es media razón de ser de F07 y el cajón es donde se ve. Una sección omitida dice
// **por qué** (el `motivo` que trae el diagnóstico, en español, ya redactado); la
// invasión sin consultar dice «no se ha consultado» y **nunca** «no hay invasión»,
// que es la afirmación tranquilizadora y falsa. Un `—` a secas no vale: no
// distingue las dos cosas.
//
// ── EL CLIC DE FUERA NO SE INTERCEPTA ───────────────────────────────────────
// Mismo problema y misma solución que `viewer/barra-edicion.js`, y conviene no
// «arreglarlo»: el cajón flota sobre el mapa, y en el mapa un clic **selecciona un
// lindero** (gesto de F06, que sigue vivo con el diagnóstico abierto). Si para
// cerrar se interceptara el clic de fuera con `capture` + `preventDefault`, el
// primer clic después de abrir se lo comería el cajón. Así que: se escucha `click`
// en el `document` en fase de BURBUJA, **nunca** se llama a `preventDefault` ni a
// `stopPropagation`, y si el destino está dentro del contenedor no se hace nada.
//
// Y el detalle de Leaflet que hace imprescindible esa última comprobación:
// `L.DomEvent.disableClickPropagation` **NO detiene el `click`** —detiene
// `mousedown`, `touchstart`, `dblclick` y `contextmenu`—, así que un clic en un
// botón del cajón SÍ llega a `document`.
//
// ── `disableClickPropagation` / `disableScrollPropagation`: OBLIGATORIOS ────
// Sin ellos, pulsar dentro del cajón seleccionaría un lindero por debajo y la rueda
// sobre la tabla haría zoom al mapa. Es el fallo clásico de un control de Leaflet;
// `viewer/capas.js` y `viewer/barra-edicion.js` ya lo resuelven igual.

import L from 'leaflet'

import { ETIQUETA as ETIQUETA_MARGEN } from '../diagnostico/margen.js'
import { resolverAvisar } from './_comun.js'

/** Esquinas válidas de un `L.Control`: las claves de `map._controlCorners`. */
const POSICIONES = ['topleft', 'topright', 'bottomleft', 'bottomright']

/**
 * Clases CSS del cajón. El cromo fino lo viste `estilos/app.css` (tarea T4.2); aquí
 * solo van los estilos MÍNIMOS en línea que hacen el cajón legible sin ninguna hoja
 * —mismo criterio que `viewer/capas.js` y `viewer/barra-edicion.js`—, porque este
 * módulo no importa CSS: el CSS es responsabilidad de la entrada de la aplicación.
 */
export const CLASE = Object.freeze({
  CONTENEDOR: 'gml-cajon-diagnostico',
  TITULAR: 'gml-cajon-titular',
  SECCION: 'gml-cajon-seccion',
  CIFRA: 'gml-cajon-cifra',
  TABLA: 'gml-cajon-tabla',
  // No hay `OMISION`. La había, y no la llevaba ningún nodo: los motivos de
  // omisión se escriben DENTRO de la cifra que falta (`textoOmitido`), que es lo
  // que hace que se lean en su sitio y no en una nota al pie. Una clase que nadie
  // pone es un gancho de CSS que no engancha nada — y peor, invita a escribir la
  // regla y a creer que se aplica.
  INVASION: 'gml-cajon-invasion',
  MARGEN: 'gml-cajon-margen',
})

/**
 * Los `data-*` que este módulo produce. **Son el CONTRATO con
 * `app/cableado-diagnostico.js`**, que localiza los nodos POR SELECTOR y lanza si
 * falta alguno — igual que `app/main.js` con los del pie y con los de la barra de
 * edición. Renombrar un valor aquí rompe ese módulo, no este fichero.
 *
 * Están exportados para que el cableado y sus tests no los escriban a mano: un
 * literal mal escrito en un `querySelector` devuelve `null` sin quejarse.
 *
 * ⚠️ `ESTADO` vale `cajon-diagnostico` y NO `diagnostico`, que es lo que pedía el
 * plan de F07. El motivo es una colisión real: el pie de `index.html` tiene su
 * PROPIO renglón de estado para el CTA «Diagnosticar», y la convención de la app
 * es que ese renglón lleve el mismo valor que su acción (`generar-gml`/
 * `generar-gml`, `cargar-catastro`/`cargar-catastro`) — o sea `diagnosticar`. Dos
 * cadenas que se diferencian en dos letras y que `querySelector` resuelve
 * quedándose con la PRIMERA del documento son un fallo esperando: el `<aside>` va
 * antes que el `<main>`, así que el renglón del cajón habría quedado inalcanzable
 * y mudo sin que nada lo dijera. Es exactamente la trampa que `index.html` ya
 * documenta con la barra de edición. Aquí se nombra por el componente, que además
 * es lo que este renglón es.
 *
 * ⚠️ Y lo mismo, otra vez, con el pie de F08: el renglón del informe vale
 * `informe-contraste` y **no** `descargar-informe`, que es el valor de su
 * `data-accion`. La convención del PIE de la app (`generar-gml`/`generar-gml`)
 * empareja acción y estado porque allí solo hay un nodo de cada; dentro del mapa
 * ya se ha visto lo que cuesta —M8 de F07—, así que aquí se nombra por el
 * COMPONENTE («el renglón del informe de contraste») y no por la acción. Que hoy
 * las dos cadenas no colisionen no basta: `descargar-informe` es exactamente el
 * nombre que le pondría el siguiente que añada un botón «Descargar informe» en
 * el pie, y `querySelector` se quedaría con el PRIMERO del documento —el
 * `<aside>` va antes que el `<main>`— dejando uno de los dos mudo y sin síntoma.
 * Hay un test que afirma que ningún otro nodo del documento lleva este valor.
 */
export const SELECTOR = Object.freeze({
  CERRAR: '[data-accion="cerrar-diagnostico"]',
  REGISTRAL: '[data-campo="superficie-registral"]',
  CLASE_PARCELA: '[data-campo="clase-parcela"]',
  ESTADO: '[data-estado="cajon-diagnostico"]',
  DESCARGAR: '[data-accion="descargar-informe"]',
  ESTADO_INFORME: '[data-estado="informe-contraste"]',
  TITULAR: '[data-diag="titular"]',
  MEDIDA: '[data-diag="superficie-medida"]',
  CATASTRAL: '[data-diag="superficie-catastral"]',
  CRUCES: '[data-diag="cruces"]',
  SOLAPE: '[data-diag="solape"]',
  CENTROIDES: '[data-diag="centroides"]',
  DESVIACION: '[data-diag="desviacion"]',
  INVASION: '[data-diag="invasion"]',
  MARGEN: '[data-diag="margen"]',
})

/** Rótulo humano de cada banda, para la tabla de cruces. */
const ROTULO_BANDA = Object.freeze({
  medida: 'Medición',
  catastral: 'Catastro',
  registral: 'Registro',
})

/**
 * Lo que se escribe cuando un número no consta. **No es un `—` a secas**: «no
 * consta» dice que el dato falta, mientras un guion se lee como «cero» o como
 * «nada que reseñar». Es la misma distinción que `app/main.js` ya hace en la ficha
 * del pie.
 */
const NO_CONSTA = 'No consta'

/**
 * Por qué «Descargar informe de contraste» está apagado. Se escribe en el renglón
 * del pie **en el mismo instante** en que el botón se apaga —al nacer y en cada
 * `pintar(null)`—, porque un botón gris y mudo es un error silencioso (regla de
 * oro 1): desde fuera no se distingue de uno roto.
 *
 * Dice las dos cosas que hacen falta: qué falta y qué hay que hacer para tenerlo.
 * Se exporta para que el cableado y los tests lo afirmen sin copiar el literal,
 * igual que {@link MOTIVO_SIN_OFICIAL} de `app/cableado-diagnostico.js`.
 *
 * @readonly
 */
export const MOTIVO_INFORME_SIN_DIAGNOSTICO =
  '«Descargar informe de contraste» está apagado: el informe recoge las medidas de este ' +
  'diagnóstico y todavía no hay ninguna calculada. Se enciende en cuanto el cajón muestra ' +
  'un diagnóstico.'

/**
 * Las dos vestimentas del botón del informe, que viajan SIEMPRE con su `disabled`
 * (ver `gateInforme`). Un botón que parece pulsable y no lo es no se distingue de
 * uno roto; uno apagado que parece encendido, tampoco.
 *
 * El apagado va en el GRIS del cromo y **nunca en rojo**: lo que se comunica es
 * «esto no se puede pulsar ahora», no «esto está mal» (regla de oro 9). El porqué
 * se escribe con palabras en el renglón de al lado, que es donde se lee. Son los
 * mismos dos pares que usa el primario de `viewer/cajon-comprobacion.js`, para que
 * los dos cajones —que comparten esquina y se turnan— no parezcan dos apps.
 */
const BOTON_INFORME = Object.freeze({
  ENCENDIDO: Object.freeze({ background: '#0F172A', color: '#fff', cursor: 'pointer' }),
  APAGADO: Object.freeze({ background: '#E2E8F0', color: '#64748B', cursor: 'default' }),
})

const nf = (decimales) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })

/** Superficies y longitudes: 2 decimales, que es lo que la app sabe medir. */
const FORMATO_2 = nf(2)
/** La superficie DECLARADA por el Catastro es un ENTERO (override O6). */
const FORMATO_0 = nf(0)

const m2 = (v) => (v === null || v === undefined ? NO_CONSTA : `${FORMATO_2.format(v)} m²`)
const m2Entero = (v) => (v === null || v === undefined ? NO_CONSTA : `${FORMATO_0.format(v)} m²`)
const metros = (v) => (v === null || v === undefined ? NO_CONSTA : `${FORMATO_2.format(v)} m`)

/**
 * Un `relativo` (FRACCIÓN, 0,05 = 5 %) como porcentaje presentable. **El × 100 vive
 * aquí**, en la capa de presentación, y no en `diagnostico/`: es la confusión clásica
 * de este campo y por eso el modelo devuelve fracción y solo la vista multiplica.
 */
const porcentaje = (v) =>
  v === null || v === undefined ? NO_CONSTA : `${FORMATO_2.format(v * 100)} %`

/** Con signo explícito: `+` cuando es positivo. El signo es información. */
function conSigno(v, formatear) {
  if (v === null || v === undefined) return NO_CONSTA
  const texto = formatear(Math.abs(v))
  if (v > 0) return `+${texto}`
  if (v < 0) return `−${texto}`
  return texto
}

const crear = (doc, etiqueta, clase, texto) => {
  const el = doc.createElement(etiqueta)
  if (clase) el.className = clase
  if (texto !== undefined) el.textContent = texto
  return el
}

/**
 * Aplica estilos en línea propiedad a propiedad.
 *
 * **No se usa `style.cssText`, y no es una preferencia.** La guarda transversal del
 * punto 12 (`test/viewer/contrato-capas.dom.test.js`) prohíbe la subcadena `.css` en
 * el código de `viewer/` —es lo que garantiza que el visor sea consumible como
 * LIBRERÍA por F05/F06/F08, con los estilos en la entrada de la app—, y `.cssText`
 * la contiene. Se podría haber refinado el guardián para excluirla; no se hace,
 * porque debilitar el guardián que protege la mayor regla arquitectónica del visor
 * para ahorrarse un helper de tres líneas es un mal cambio. Y asignar propiedades
 * una a una es además lo que hace el resto de la capa (`barra-edicion.js`,
 * `capas.js`): `cssText` PISA cualquier estilo previo, propiedad a propiedad no.
 *
 * @param {HTMLElement} el
 * @param {Record<string, string>} estilos  Propiedades en camelCase.
 * @returns {HTMLElement}  El mismo elemento, para poder encadenar.
 */
function estilar(el, estilos) {
  for (const [propiedad, valor] of Object.entries(estilos)) el.style[propiedad] = valor
  return el
}

const esMapa = (m) =>
  !!m &&
  typeof m.addControl === 'function' &&
  typeof m.removeControl === 'function' &&
  typeof m.getContainer === 'function'

// ── El control ───────────────────────────────────────────────────────────────

const CajonDiagnostico = L.Control.extend({
  options: {
    position: 'bottomleft',
    etiqueta: 'Diagnóstico de encaje con el parcelario',
  },

  /**
   * Los oyentes del `document` se LIGAN aquí, una vez por instancia, y se guardan
   * como campos propios. No es ceremonia: `addEventListener` y
   * `removeEventListener` tienen que recibir **la misma referencia**, y un
   * `bind(this)` escrito en el `add` y otro en el `remove` son dos funciones
   * distintas — el oyente quedaría vivo para siempre sobre un control ya destruido
   * y `destruir()` mentiría. Es la lección que `viewer/barra-edicion.js` dejó
   * escrita.
   */
  initialize(opciones) {
    L.setOptions(this, opciones)
    this._alClicFuera = (evento) => this._cerrarPorClicFuera(evento)
    this._alEscape = (evento) => this._cerrarPorEscape(evento)
    this._abierto = false
    this._eventoApertura = null
    this._oyentes = { cerrar: new Set(), cambiar: new Set(), descargar: new Set() }
  },

  onAdd(mapa) {
    const doc = mapa.getContainer().ownerDocument || document
    this._doc = doc
    // El sello de Leaflet da ids únicos aunque se monten dos cajones (dos mapas en
    // la misma página). Mismo recurso que `barra-edicion.js` y `capas.js`.
    const sello = L.Util.stamp(this)

    const contenedor = crear(doc, 'section', CLASE.CONTENEDOR)
    this._contenedor = contenedor
    contenedor.setAttribute('aria-label', this.options.etiqueta)
    // Estilos MÍNIMOS en línea: este módulo no importa ninguna hoja, así que el
    // cajón tiene que ser legible por sí solo (en `npm run dev` sin CSS, y en
    // jsdom). El cromo fino es de `estilos/app.css`.
    estilar(contenedor, {
      background: '#fff',
      padding: '10px 12px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(15,23,42,.25)',
      font: '13px/1.45 system-ui,sans-serif',
      color: '#334155',
      maxWidth: 'min(420px,42vw)',
      maxHeight: '52vh',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      display: 'none',
    })

    // ── Cabecera: titular descriptivo + cerrar ──────────────────────────────
    const cabecera = crear(doc, 'header')
    estilar(cabecera, {
      display: 'flex',
      alignItems: 'start',
      gap: '8px',
      justifyContent: 'space-between',
    })
    const titular = crear(doc, 'h2', CLASE.TITULAR)
    titular.dataset.diag = 'titular'
    estilar(titular, {
      margin: '0',
      fontSize: '13px',
      fontWeight: '600',
      color: '#0F172A',
    })
    this._titular = titular

    const cerrar = crear(doc, 'button', null, '✕')
    cerrar.type = 'button'
    cerrar.dataset.accion = 'cerrar-diagnostico'
    cerrar.setAttribute('aria-label', 'Cerrar el diagnóstico')
    estilar(cerrar, {
      flex: 'none',
      border: '0',
      background: 'transparent',
      cursor: 'pointer',
      fontSize: '14px',
      lineHeight: '1',
      padding: '2px 4px',
      color: '#64748B',
    })
    this._botonCerrar = cerrar

    cabecera.append(titular, cerrar)

    // ── Las tres bandas ────────────────────────────────────────────────────
    const bandas = crear(doc, 'div', CLASE.SECCION)
    const idRegistral = `gml-diag-registral-${sello}`
    const idClase = `gml-diag-clase-${sello}`
    const idInforme = `gml-diag-informe-${sello}`

    const medida = crear(doc, 'dd', CLASE.CIFRA)
    medida.dataset.diag = 'superficie-medida'
    const catastral = crear(doc, 'dd', CLASE.CIFRA)
    catastral.dataset.diag = 'superficie-catastral'
    this._medida = medida
    this._catastral = catastral

    const lista = crear(doc, 'dl')
    estilar(lista, {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: '2px 10px',
      margin: '8px 0 0',
    })
    lista.append(
      crear(doc, 'dt', null, 'Medición'),
      medida,
      crear(doc, 'dt', null, 'Parcelario vigente'),
      catastral,
    )

    // El campo de la superficie REGISTRAL: es un dato de una escritura, no algo que
    // se mida, así que lo teclea el usuario y nace vacío. `type="number"` con
    // `step` de céntimo: es una superficie en m².
    const etiquetaRegistral = crear(doc, 'label', null, 'Superficie registral (m²)')
    etiquetaRegistral.htmlFor = idRegistral
    const registral = crear(doc, 'input')
    registral.id = idRegistral
    registral.type = 'number'
    registral.step = '0.01'
    registral.min = '0'
    registral.inputMode = 'decimal'
    registral.dataset.campo = 'superficie-registral'
    registral.placeholder = 'de la escritura'
    estilar(registral, {
      width: '9em',
      padding: '3px 6px',
      border: '1px solid #CBD5E1',
      borderRadius: '4px',
    })
    this._registral = registral

    const filaRegistral = crear(doc, 'div')
    estilar(filaRegistral, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '8px',
    })
    filaRegistral.append(etiquetaRegistral, registral)

    // La tabla de diferencias cruzadas. Caja VACÍA: la rellena `pintar`.
    const cruces = crear(doc, 'table', CLASE.TABLA)
    cruces.dataset.diag = 'cruces'
    estilar(cruces, {
      borderCollapse: 'collapse',
      marginTop: '8px',
      width: '100%',
      fontSize: '12px',
    })
    this._cruces = cruces

    bandas.append(lista, filaRegistral, cruces)

    // ── Las métricas de encaje ─────────────────────────────────────────────
    const metricas = crear(doc, 'dl', CLASE.SECCION)
    estilar(metricas, {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: '2px 10px',
      margin: '10px 0 0',
    })
    this._solape = crear(doc, 'dd', CLASE.CIFRA)
    this._solape.dataset.diag = 'solape'
    this._centroides = crear(doc, 'dd', CLASE.CIFRA)
    this._centroides.dataset.diag = 'centroides'
    this._desviacion = crear(doc, 'dd', CLASE.CIFRA)
    this._desviacion.dataset.diag = 'desviacion'
    metricas.append(
      crear(doc, 'dt', null, 'Solape'),
      this._solape,
      crear(doc, 'dt', null, 'Desplazamiento de centroides'),
      this._centroides,
      crear(doc, 'dt', null, 'Desviación máxima de lindero'),
      this._desviacion,
    )

    // ── Invasión: la única sección que puede llevar ámbar ──────────────────
    const invasion = crear(doc, 'div', CLASE.INVASION)
    invasion.dataset.diag = 'invasion'
    invasion.style.marginTop = '10px'
    this._invasion = invasion

    // ── Margen de identidad, con su selector de clase ──────────────────────
    const etiquetaClase = crear(doc, 'label', null, 'Clase de suelo')
    etiquetaClase.htmlFor = idClase
    const selectorClase = crear(doc, 'select')
    selectorClase.id = idClase
    selectorClase.dataset.campo = 'clase-parcela'
    estilar(selectorClase, {
      padding: '3px 6px',
      border: '1px solid #CBD5E1',
      borderRadius: '4px',
    })
    for (const [valor, texto] of [
      ['', '(elegir)'],
      ['URBANA', 'Urbana'],
      ['RUSTICA', 'Rústica'],
    ]) {
      const opcion = crear(doc, 'option', null, texto)
      opcion.value = valor
      selectorClase.append(opcion)
    }
    this._clase = selectorClase

    const margen = crear(doc, 'p', CLASE.MARGEN)
    margen.dataset.diag = 'margen'
    estilar(margen, {
      margin: '6px 0 0',
      fontSize: '12px',
      color: '#64748B',
    })
    this._margen = margen

    const bloqueMargen = crear(doc, 'div', CLASE.SECCION)
    bloqueMargen.style.marginTop = '10px'
    const filaClase = crear(doc, 'div')
    estilar(filaClase, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    })
    filaClase.append(etiquetaClase, selectorClase)
    bloqueMargen.append(filaClase, margen)

    // ── El renglón de estado ───────────────────────────────────────────────
    // `role="status"` para que el lector de pantalla lo anuncie SIN robar el foco,
    // igual que el de «Generar GML» y el de la barra de edición: el usuario sigue
    // con las manos donde estaba.
    const estado = crear(doc, 'p')
    // `cajon-diagnostico`, no `diagnostico`: ver el aviso de {@link SELECTOR}.
    estado.dataset.estado = 'cajon-diagnostico'
    estado.setAttribute('role', 'status')
    estilar(estado, {
      margin: '8px 0 0',
      fontSize: '12px',
      color: '#64748B',
      minHeight: '1em',
    })
    this._estado = estado

    // ── El PIE: la acción que consume el diagnóstico (F08) ─────────────────
    // Por qué vive aquí y no en el pie de la app: ver la cabecera del módulo.
    // `<footer>` de verdad, hermano del `<header>` de la cabecera; no lleva clase
    // porque `estilos/app.css` no necesita engancharse a él, y una clase que nadie
    // viste es un gancho que invita a escribir la regla y a creer que se aplica
    // (ver la nota de `OMISION` en {@link CLASE}).
    const pie = crear(doc, 'footer')
    estilar(pie, { marginTop: '12px' })

    const descargar = crear(doc, 'button', null, 'Descargar informe de contraste')
    descargar.type = 'button'
    descargar.dataset.accion = 'descargar-informe'
    // El renglón de debajo es donde se escribe POR QUÉ está apagado, así que se
    // ENLAZA: un lector de pantalla que anuncie el botón anuncia también el
    // motivo, sin que el usuario tenga que ir a buscarlo. Mismo recurso que el
    // primario de `viewer/cajon-comprobacion.js`.
    descargar.setAttribute('aria-describedby', idInforme)
    // NACE APAGADO: sin diagnóstico calculado no hay cifras que llevarse. A partir
    // de aquí lo gobierna `pintar`, y NUNCA sin escribir el motivo (regla 1).
    descargar.disabled = true
    // ⚠️ NI `font: 'inherit'` NI NINGUNA `fontFamily` AQUÍ, y es deliberado
    // (2026-07-30, corregido tras medirlo en el guion 10). El atajo
    // `font: 'inherit'` hereda el `font` EN LÍNEA del contenedor —`system-ui`— y,
    // por ser inline, **gana a la hoja**: la regla `.gml-cajon-diagnostico button`
    // de `estilos/app.css` quedaba muerta y el botón salía en `system-ui` mientras
    // el resto del cajón iba en Geist. El módulo fija tamaño y grosor (legible sin
    // hoja); **la FAMILIA la pone la hoja**. Mismo reparto que en
    // `viewer/cajon-comprobacion.js`, y por eso los dos cajones se arreglan juntos.
    estilar(descargar, {
      border: '0',
      borderRadius: '4px',
      padding: '6px 12px',
      fontSize: 'inherit',
      lineHeight: 'inherit',
      fontWeight: '600',
      ...BOTON_INFORME.APAGADO,
    })
    this._descargar = descargar

    const estadoInforme = crear(doc, 'p')
    estadoInforme.id = idInforme
    // `informe-contraste`, no `descargar-informe`: ver el aviso de {@link SELECTOR}.
    estadoInforme.dataset.estado = 'informe-contraste'
    estadoInforme.setAttribute('role', 'status')
    estilar(estadoInforme, {
      margin: '6px 0 0',
      fontSize: '12px',
      color: '#64748B',
      minHeight: '1em',
    })
    // El motivo se escribe YA, no al primer repintado: el cajón puede abrirse sin
    // que nadie haya llamado a `pintar` todavía, y ese es justo el instante en que
    // el botón está gris.
    estadoInforme.textContent = MOTIVO_INFORME_SIN_DIAGNOSTICO
    this._estadoInforme = estadoInforme

    pie.append(descargar, estadoInforme)

    contenedor.append(cabecera, bandas, metricas, invasion, bloqueMargen, estado, pie)

    // OBLIGATORIOS: sin ellos, pulsar dentro seleccionaría un lindero por debajo y
    // la rueda sobre la tabla haría zoom al mapa.
    L.DomEvent.disableClickPropagation(contenedor)
    L.DomEvent.disableScrollPropagation(contenedor)

    L.DomEvent.on(cerrar, 'click', this._alPulsarCerrar, this)
    L.DomEvent.on(descargar, 'click', this._alPulsarDescargar, this)
    L.DomEvent.on(registral, 'change', this._alCambiar, this)
    L.DomEvent.on(registral, 'input', this._alCambiar, this)
    L.DomEvent.on(selectorClase, 'change', this._alCambiar, this)
    doc.addEventListener('click', this._alClicFuera)
    doc.addEventListener('keydown', this._alEscape)

    return contenedor
  },

  onRemove() {
    L.DomEvent.off(this._botonCerrar, 'click', this._alPulsarCerrar, this)
    L.DomEvent.off(this._descargar, 'click', this._alPulsarDescargar, this)
    L.DomEvent.off(this._registral, 'change', this._alCambiar, this)
    L.DomEvent.off(this._registral, 'input', this._alCambiar, this)
    L.DomEvent.off(this._clase, 'change', this._alCambiar, this)
    if (this._doc) {
      this._doc.removeEventListener('click', this._alClicFuera)
      this._doc.removeEventListener('keydown', this._alEscape)
    }
    this._abierto = false
  },

  // ── Apertura y cierre ─────────────────────────────────────────────────────

  _fijarAbierto(abierto, evento = null) {
    if (this._abierto === abierto) return
    this._abierto = abierto
    // El evento que ABRE el cajón, para que el guardián del clic fuera no lo cuente
    // como un clic fuera. Ver {@link _cerrarPorClicFuera}.
    this._eventoApertura = abierto ? evento : null
    if (this._contenedor) this._contenedor.style.display = abierto ? '' : 'none'
    if (!abierto) for (const fn of this._oyentes.cerrar) fn()
  },

  _alPulsarCerrar(evento) {
    L.DomEvent.stop(evento)
    this._fijarAbierto(false)
  },

  /**
   * Cierra al pulsar fuera. **Sin `capture` y sin `preventDefault`**: ver la
   * cabecera. Un clic en el mapa cierra el cajón Y selecciona el lindero, en el
   * mismo gesto, que es lo que el usuario espera.
   *
   * ── ⚠️ EL CLIC QUE ABRE EL CAJÓN NO ES UN CLIC FUERA ────────────────────────
   * El CTA «Diagnosticar» del pie está FUERA del cajón, y su manejador corre en la
   * fase de destino — o sea ANTES de que el mismo evento llegue burbujeando hasta
   * este oyente del `document`. Sin esta guarda la secuencia era: abrir, y cerrar
   * cuatro microsegundos después, en el mismo gesto. El cajón parpadeaba y no se
   * abría nunca, y desde fuera parecía que el botón no hacía nada.
   *
   * Se compara la IDENTIDAD del evento y no una bandera de «recién abierto»: una
   * bandera se tragaría también el primer clic fuera cuando el cajón se abre por
   * código (sin ningún evento de por medio), y ese clic sí tiene que cerrarlo.
   *
   * Lo que NO se hace es que el llamante pare la propagación de su clic: eso
   * dejaría sordo a cualquier otro oyente del documento —hoy, el panel de ayuda de
   * la barra de edición— por un problema que es de este componente.
   */
  _cerrarPorClicFuera(evento) {
    if (!this._abierto || !this._contenedor) return
    if (evento === this._eventoApertura) {
      // Se consume: el SIGUIENTE clic fuera sí cierra.
      this._eventoApertura = null
      return
    }
    if (this._contenedor.contains(evento.target)) return
    this._fijarAbierto(false)
  },

  _cerrarPorEscape(evento) {
    if (!this._abierto) return
    if (evento.key !== 'Escape') return
    this._fijarAbierto(false)
  },

  _alCambiar() {
    for (const fn of this._oyentes.cambiar) fn()
  },

  /**
   * Pulsación de «Descargar informe de contraste».
   *
   * ⚠️ **No se llama a `L.DomEvent.stop`**, a diferencia del botón de cerrar, y es
   * la misma decisión que tomó `viewer/cajon-comprobacion.js`: parar la propagación
   * de este clic dejaría sordo a cualquier otro oyente del `document` —hoy, el
   * panel de ayuda de la barra de edición— por un problema que ni siquiera existe.
   * No existe porque el clic pasa igualmente por {@link
   * CajonDiagnostico._cerrarPorClicFuera}, que lo ve DENTRO del contenedor y no
   * cierra nada: `disableClickPropagation` no detiene el `click`, pero la
   * comprobación `contains` sí lo distingue.
   */
  _alPulsarDescargar(evento) {
    for (const fn of this._oyentes.descargar) fn(evento)
  },
})

/**
 * El cajón del diagnóstico como control de Leaflet.
 *
 * ```js
 * const cajon = crearCajonDiagnostico({ mapa })
 * cajon.abrir()
 * cajon.pintar(diagnostico)
 * cajon.alCambiar(() => recalcular(cajon.registral(), cajon.clase()))
 * cajon.alDescargar(() => bajarInforme())   // el pie de F08
 * ```
 *
 * @param {Object} opciones
 * @param {import('leaflet').Map} opciones.mapa  El mapa del visor.
 * @param {string} [opciones.posicion='bottomleft']  Esquina de Leaflet. El defecto
 *   NO es arbitrario: `topleft` la ocupa la barra de edición de F06, `topright` el
 *   control de capas y `bottomright` el de opacidad **y** la atribución. `bottomleft`
 *   es la única esquina libre del visor.
 * @param {((mensaje: string, detalle?: object) => void)|null} [opciones.alAvisar]
 *   Canal de aviso (regla de oro 1). Se resuelve y valida aunque no se use, que es
 *   el patrón obligatorio del visor.
 * @returns {{control: object, pintar: Function, abrir: Function, cerrar: Function,
 *   abierto: Function, registral: Function, clase: Function,
 *   reiniciarExpediente: Function, estado: Function, estadoInforme: Function,
 *   alCambiar: Function, alDescargar: Function, alCerrar: Function,
 *   destruir: Function}}
 * @throws {TypeError|RangeError} Contrato del programador.
 */
export function crearCajonDiagnostico({ mapa, posicion = 'bottomleft', alAvisar } = {}) {
  if (!esMapa(mapa)) {
    throw new TypeError(
      `crearCajonDiagnostico: 'mapa' debe ser un mapa de Leaflet (con addControl/` +
        `removeControl/getContainer); recibido ${JSON.stringify(mapa)}.`,
    )
  }
  if (typeof posicion !== 'string') {
    throw new TypeError(
      `crearCajonDiagnostico: 'posicion' debe ser una cadena con una esquina de ` +
        `Leaflet; recibido ${typeof posicion}.`,
    )
  }
  if (!POSICIONES.includes(posicion)) {
    throw new RangeError(
      `crearCajonDiagnostico: 'posicion' debe ser una esquina de Leaflet; recibido ` +
        `${JSON.stringify(posicion)}. Válidas: ${POSICIONES.join(', ')}.`,
    )
  }
  // Patrón obligatorio del visor: se resuelve (y se valida) aunque no se use.
  resolverAvisar(alAvisar)

  const control = new CajonDiagnostico({ position: posicion })
  mapa.addControl(control)

  let destruido = false

  /** Escribe el titular DESCRIPTIVO de §10.5. Ni «apta» ni «correcta». */
  function pintarTitular(d) {
    const medida = m2(d.superficie.medida)
    if (d.superficie.catastral === null) {
      control._titular.textContent = `Contraste con el parcelario — Medición de ${medida}.`
      return
    }
    control._titular.textContent =
      `Contraste con el parcelario — Medición de ${medida} frente a los ` +
      `${m2Entero(d.superficie.catastral)} del parcelario vigente.`
  }

  /** La tabla de los tres pares cruzados. */
  function pintarCruces(d) {
    const doc = control._doc
    const tabla = control._cruces
    tabla.replaceChildren()

    const thead = crear(doc, 'thead')
    const filaCabecera = crear(doc, 'tr')
    for (const texto of ['', 'Diferencia', 'Relativa']) {
      const th = crear(doc, 'th', null, texto)
      estilar(th, {
        textAlign: 'right',
        padding: '2px 4px',
        fontWeight: '600',
        color: '#64748B',
      })
      if (texto === '') th.style.textAlign = 'left'
      filaCabecera.append(th)
    }
    thead.append(filaCabecera)

    const tbody = crear(doc, 'tbody')
    for (const cruce of d.bandas.cruces) {
      const tr = crear(doc, 'tr')
      const rotulo = crear(
        doc,
        'td',
        null,
        `${ROTULO_BANDA[cruce.a]} − ${ROTULO_BANDA[cruce.b]}`,
      )
      estilar(rotulo, {
        padding: '2px 4px',
      })
      const absoluto = crear(doc, 'td', null, conSigno(cruce.absoluto, m2))
      const relativo = crear(doc, 'td', null, conSigno(cruce.relativo, porcentaje))
      for (const td of [absoluto, relativo]) {
        // SIN color de mérito: el mismo gris del resto del cromo. Un Δ en verde
        // cuando es pequeño y en rojo cuando es grande estaría dictaminando si la
        // discrepancia es tolerable, que es la decisión que no nos toca.
        estilar(td, {
          textAlign: 'right',
          padding: '2px 4px',
          fontVariantNumeric: 'tabular-nums',
        })
        tr.append(td)
      }
      tr.prepend(rotulo)
      tbody.append(tr)
    }

    tabla.append(thead, tbody)
  }

  /**
   * Una sección omitida. Escribe **el motivo que trae el diagnóstico**, ya redactado
   * en español: la vista no tiene su propia tabla de traducciones, que es lo que se
   * queda corto en silencio cuando el modelo añade un caso.
   */
  function textoOmitido(d, que) {
    const omision = d.omisiones.find((o) => o.que === que)
    return omision ? omision.motivo : NO_CONSTA
  }

  function pintarMetricas(d) {
    control._solape.textContent =
      d.solape === null
        ? textoOmitido(d, 'solape')
        : `${m2(d.solape.area)} · ${porcentaje(d.solape.relativo)} de la mayor`

    control._centroides.textContent =
      d.centroides === null ? textoOmitido(d, 'centroides') : metros(d.centroides.distancia)

    if (d.desviacion === null || d.desviacion.maxima === null) {
      control._desviacion.textContent = textoOmitido(d, 'desviacion')
    } else {
      const max = d.desviacion.maxima
      control._desviacion.textContent =
        `${metros(max.maxima)} · lindero ${max.indice + 1}` +
        (max.recinto > 0 ? ` del hueco ${max.recinto}` : '')
    }
  }

  /**
   * La invasión. **La única sección con ámbar** (spec §10.4), y la única donde «no se
   * ha consultado» y «no hay» tienen que escribirse distinto.
   */
  function pintarInvasion(d) {
    const doc = control._doc
    const caja = control._invasion
    caja.replaceChildren()

    const { consultado, invasiones, descartadas } = d.invasion

    if (!consultado) {
      // ⛔ NUNCA «no hay invasión». Son afirmaciones opuestas y la segunda
      // tranquiliza: es el error silencioso más caro que podría cometer esta vista.
      caja.append(
        crear(
          doc,
          'p',
          null,
          'Invasión a colindantes: no se ha consultado. Hay que traer las parcelas vecinas del Catastro.',
        ),
      )
      estilar(caja.firstChild, {
        margin: '0',
        fontSize: '12px',
        color: '#64748B',
      })
      return
    }

    if (invasiones.length === 0) {
      const p = crear(doc, 'p', null, 'Invasión a colindantes: ninguna.')
      estilar(p, {
        margin: '0',
        fontSize: '12px',
        color: '#64748B',
      })
      caja.append(p)
    } else {
      const titulo = crear(doc, 'p', null, 'Invasión a colindantes')
      estilar(titulo, {
        margin: '0 0 4px',
        fontWeight: '600',
        color: '#92400E',
      })
      caja.append(titulo)

      const ul = crear(doc, 'ul')
      estilar(ul, {
        margin: '0',
        paddingLeft: '18px',
      })
      for (const h of invasiones) {
        const li = crear(
          doc,
          'li',
          null,
          `${h.refcat === null ? 'Parcela sin referencia' : h.refcat}: ${m2(h.area)}`,
        )
        // El ámbar, aquí y en ningún otro sitio del cajón.
        li.style.color = '#92400E'
        ul.append(li)
      }
      caja.append(ul)
    }

    if (descartadas.length > 0) {
      // Regla de oro 1: lo descartado se puede ver. Son astillas de redondeo en
      // linderos compartidos —sobre la parcela real hay dos— y quien desconfíe del
      // criterio tiene el área y el grosor delante.
      const total = descartadas.reduce((s, x) => s + x.area, 0)
      const p = crear(
        doc,
        'p',
        null,
        `Se han descartado ${descartadas.length} solape(s) de ${m2(total)} por ser más ` +
          `finos que un milímetro: son el redondeo del lindero compartido, no superficie.`,
      )
      estilar(p, {
        margin: '4px 0 0',
        fontSize: '11px',
        color: '#94A3B8',
      })
      caja.append(p)
    }
  }

  /**
   * El margen, SIEMPRE con su etiqueta, y la clase rotulada si es deducida.
   *
   * ── ⚠️ ESTA FUNCIÓN NO ESCRIBE EN EL `<select>` ────────────────────────────
   * Lo hacía —`control._clase.value = d.margen.clase`— y era un LAVADO: el
   * `<select>` significa «esto lo ha elegido una persona», y volcar en él la clase
   * DEDUCIDA la convertía en elegida al primer repintado. La siguiente vuelta,
   * `clase()` devolvía «RUSTICA» como si alguien la hubiera marcado, `diagnosticar`
   * la recibía por `clase` y no por `refcat`, y el rótulo «Clase propuesta por la
   * aplicación» desaparecía solo. La propuesta se quedaba en el expediente sin que
   * nadie la hubiera aceptado.
   *
   * Es exactamente la doctrina de `app/cableado-catastro.js#deducir()`, que rellena
   * el campo de la referencia pero NO la mete en el modelo: «así `parcela.refcat`
   * significa SIEMPRE "esto lo afirma el usuario" y nunca "esto lo adivinó un
   * servicio"». La propuesta se dice, con todas las letras, en el renglón de abajo.
   *
   * Quien sí puede tocar esos dos campos es {@link reiniciarExpediente}, y solo
   * cuando entra una parcela distinta.
   */
  function pintarMargen(d) {
    if (d.margen === null) {
      control._margen.textContent = textoOmitido(d, 'margen')
      return
    }

    const cifras =
      `${ETIQUETA_MARGEN}: ±${metros(d.margen.perimetroM)} de perímetro y ` +
      `${porcentaje(d.margen.superficieRelativo)} de superficie.`
    // Si la clase la propuso la app y no una persona, se DICE. Presentar una
    // deducción como un dato sería colar un criterio nuestro en el expediente.
    control._margen.textContent = d.margen.deducida
      ? `${cifras} Clase propuesta por la aplicación: ${d.margen.criterio}`
      : cifras
  }

  /**
   * El `disabled` del botón del informe, su vestimenta y su renglón: las TRES
   * cosas en una sola función, para que no puedan divergir. Es el mismo recurso
   * —y por lo mismo— que `apagarPrimario` en `viewer/cajon-comprobacion.js`.
   *
   * La regla es una sola línea: **el informe se puede descargar ⟺ el cajón está
   * enseñando un diagnóstico**. No hace falta que nadie se la cuente al cajón
   * desde fuera; la sabe él, porque es quien recibe el POJO en `pintar`.
   *
   * ── POR QUÉ AL ENCENDER SOLO SE BORRA EL MOTIVO, Y NO EL RENGLÓN ────────────
   * `pintar` corre en CADA operación acabada —o sea, en cada vértice que F06 mueva
   * con el cajón abierto—. Vaciar el renglón sin condición se llevaría por delante
   * el «Descargado «contraste_….txt».» que el cableado acaba de escribir, un
   * instante después de haberlo puesto. Es exactamente la regla que
   * `app/cableado-diagnostico.js#refrescarBoton` ya defiende para el renglón del
   * CTA, y aquí se aplica al revés: se reconoce el motivo por su texto y se borra
   * solo él.
   *
   * Al APAGAR sí se pisa lo que hubiera: un desenlace anterior habla de un
   * diagnóstico que ya no está, y dejarlo escrito junto a un botón gris haría creer
   * que basta con volver a pulsarlo.
   *
   * @param {boolean} hayDiagnostico
   */
  function gateInforme(hayDiagnostico) {
    if (!control._descargar || !control._estadoInforme) return
    control._descargar.disabled = !hayDiagnostico
    estilar(control._descargar, hayDiagnostico ? BOTON_INFORME.ENCENDIDO : BOTON_INFORME.APAGADO)
    if (!hayDiagnostico) {
      control._estadoInforme.textContent = MOTIVO_INFORME_SIN_DIAGNOSTICO
      return
    }
    if (control._estadoInforme.textContent === MOTIVO_INFORME_SIN_DIAGNOSTICO) {
      control._estadoInforme.textContent = ''
    }
  }

  return {
    control,

    /**
     * Pinta el diagnóstico. `null` deja el cajón en blanco (sin cerrarlo).
     *
     * @param {object|null} d  Lo que devuelve `diagnostico/parcela.js#diagnosticar`.
     */
    pintar(d) {
      if (destruido || !control._contenedor) return
      if (d === null || d === undefined) {
        control._titular.textContent = 'Sin diagnóstico.'
        for (const el of [control._medida, control._catastral, control._solape,
          control._centroides, control._desviacion]) {
          el.textContent = NO_CONSTA
        }
        control._cruces.replaceChildren()
        control._invasion.replaceChildren()
        control._margen.textContent = ''
        // Sin cifras no hay informe que componer, y el botón lo dice.
        gateInforme(false)
        return
      }

      pintarTitular(d)
      control._medida.textContent = m2(d.superficie.medida)
      control._catastral.textContent = m2Entero(d.superficie.catastral)
      // El campo de la registral NO se sobrescribe si el usuario está escribiendo en
      // él: pisar lo que alguien teclea es la forma más rápida de que no vuelva a
      // usarse un formulario. Solo se rellena cuando está vacío y el dato existe.
      if (control._registral.value === '' && d.superficie.registral !== null) {
        control._registral.value = String(d.superficie.registral)
      }
      pintarCruces(d)
      pintarMetricas(d)
      pintarInvasion(d)
      pintarMargen(d)
      // Hay diagnóstico enseñándose: el informe ya se puede llevar.
      gateInforme(true)
    },

    /**
     * Abre el cajón.
     *
     * @param {Event|null} [evento=null]  El evento de DOM que lo está abriendo, si
     *   lo hay. Se pasa para que el guardián del clic fuera no cuente como «clic
     *   fuera» el mismo clic que ha abierto el cajón — el CTA vive en el pie, o sea
     *   fuera. Ver {@link CajonDiagnostico._cerrarPorClicFuera}. Abrir por código
     *   (sin evento) es igual de válido: entonces no hay nada que ignorar.
     */
    abrir(evento = null) {
      if (!destruido) control._fijarAbierto(true, evento)
    },

    cerrar() {
      if (!destruido) control._fijarAbierto(false)
    },

    abierto() {
      return !destruido && control._abierto === true
    },

    /**
     * La superficie registral tecleada, o `null` si el campo está vacío o no es un
     * número. **`null` y no 0**: un campo vacío significa «no consta», y un 0 diría
     * que la escritura declara cero metros.
     */
    registral() {
      if (destruido || !control._registral) return null
      const texto = control._registral.value.trim()
      if (texto === '') return null
      const valor = Number(texto.replace(',', '.'))
      return Number.isFinite(valor) ? valor : null
    },

    /** La clase de suelo elegida, o `null` si nadie ha elegido. */
    clase() {
      if (destruido || !control._clase) return null
      return control._clase.value === '' ? null : control._clase.value
    },

    /**
     * Vacía los DOS campos del expediente (registral y clase). **El único camino
     * por el que estos dos nodos se escriben desde código**, y existe para un solo
     * caso: ha entrado una parcela DISTINTA.
     *
     * No se hace en `pintar` porque `pintar` corre en cada operación de edición, y
     * borrar ahí la superficie de la escritura cada vez que se mueve un vértice
     * sería insufrible. Y no se hace solo dentro de este módulo porque el cajón no
     * sabe qué parcela hay: eso lo sabe `app/cableado-diagnostico.js`, que es quien
     * escucha al store.
     *
     * No dispara `alCambiar`: no lo ha cambiado el usuario, y avisar provocaría un
     * recálculo redundante justo antes del que va a hacer el llamante de todas
     * formas.
     */
    reiniciarExpediente() {
      if (destruido) return
      if (control._registral) control._registral.value = ''
      if (control._clase) control._clase.value = ''
    },

    /** Escribe el renglón de estado (`role="status"`). */
    estado(texto) {
      if (!destruido && control._estado) control._estado.textContent = texto
    },

    /**
     * Escribe el renglón del PIE del informe (`role="status"`), que es un nodo
     * DISTINTO del de arriba: aquel cuenta lo que le pasa a lo que se está
     * enseñando (las vecinas que no llegaron, un fallo del cálculo) y este, el
     * desenlace de pulsar «Descargar informe de contraste». Se llaman distinto
     * (`cajon-diagnostico` / `informe-contraste`) por la misma razón por la que
     * ninguno se llama `diagnostico`: ver el aviso de {@link SELECTOR}.
     *
     * @param {string} texto
     */
    estadoInforme(texto) {
      if (!destruido && control._estadoInforme) control._estadoInforme.textContent = texto
    },

    /**
     * Se suscribe a los cambios del usuario en la registral o en la clase. Devuelve
     * la BAJA. Varios oyentes, como `alColindantes` de F05: un `= fn` desengancharía
     * al primero en silencio.
     */
    alCambiar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alCambiar: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.cambiar.add(fn)
      return () => control._oyentes.cambiar.delete(fn)
    },

    /**
     * Se suscribe a la pulsación de «Descargar informe de contraste». Devuelve la
     * BAJA. Varios oyentes, igual que {@link alCambiar}: un `= fn` desengancharía
     * al primero en silencio.
     *
     * El cajón **no compone ni entrega nada**: solo avisa. Quien escucha es
     * `app/cableado-diagnostico.js`, que sabe qué diagnóstico se está enseñando,
     * qué parcela hay en el store, qué hora es y cómo se baja un fichero.
     */
    alDescargar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alDescargar: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.descargar.add(fn)
      return () => control._oyentes.descargar.delete(fn)
    },

    /** Se suscribe al cierre (botón, clic fuera o Escape). Devuelve la BAJA. */
    alCerrar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alCerrar: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.cerrar.add(fn)
      return () => control._oyentes.cerrar.delete(fn)
    },

    /**
     * Quita el control del mapa —lo que dispara `onRemove` y con él la retirada de
     * los oyentes del `document`— y deja el módulo inerte. IDEMPOTENTE.
     */
    destruir() {
      if (destruido) return
      destruido = true
      control._oyentes.cerrar.clear()
      control._oyentes.cambiar.clear()
      control._oyentes.descargar.clear()
      control.remove()
    },
  }
}

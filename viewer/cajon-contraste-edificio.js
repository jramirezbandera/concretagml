// viewer/cajon-contraste-edificio.js — F14 · El contraste de la CONSTRUCCIÓN.
//
// ── QUÉ ES ESTO, Y POR QUÉ NO ES EL CAJÓN DE DIAGNÓSTICO CON OTRAS ETIQUETAS ─
// Es el hermano de `viewer/cajon-diagnostico.js` en la rama EDIFICIO: mismo sitio
// —la columna izquierda en la pantalla Diagnóstico—, mismo cromo, mismas reglas de
// oro. Lo que cambia es LO QUE SE COMPARA, y no se parece:
//
//   · **No hay tres bandas.** Una parcela tiene medición, parcelario y REGISTRO de
//     la propiedad, y el cruce de los tres es la mitad del valor de F07. Una
//     construcción no tiene superficie registral: lo que hay es la huella que se ha
//     medido y la que el Catastro publica, y ya.
//   · **No hay margen de identidad.** El del BOE es de parcelas (urbana/rústica),
//     con su tabla de tolerancias. Aplicárselo a un edificio sería inventarse un
//     criterio que ninguna norma da.
//   · **No hay desviación máxima de lindero.** Una construcción no tiene linderos
//     con vecinos: tiene una huella. Lo que sí tiene —y la parcela no— es
//     **cuánto de ella cae dentro de la parcela declarada**, que es la pregunta
//     que de verdad se hace quien presenta un ICUC.
//   · **Y tiene un estado que la otra no puede tener**: que no haya nada
//     registrado. Ver {@link REGISTRO} y el bloque de abajo.
//
// Por eso es un módulo y no una opción del otro: un `if (esEdificio)` repartido por
// mil doscientas líneas habría dejado los dos peores, y el de parcela lleva desde
// F07 sin necesitar una sola bandera.
//
// ── ⭐ LA PANTALLA HONESTA NO ES UNA PANTALLA: ES UN ESTADO ─────────────────
// «No consta construcción registrada» es un RESULTADO del Catastro, no un error
// —`200 OK` con una colección BU sin miembros, y hay fixture real—. Así que aquí
// no hay un camino de código aparte: el contraste llega con
// `registro.clave === SIN_CONSTRUCCIONES`, todas las secciones comparativas a
// `null` con su motivo, y el renglón de arriba dice la frase entera —incluida la
// parte que tranquiliza, que es la que importa: **el GML sale plenamente válido
// sin este paso**—. Un camino, imposible de olvidar.
//
// Y los cuatro sabores de «no hay» se escriben DISTINTO, que es media razón de ser
// de la fase: no se ha consultado / se consultó y no hay / no se ha podido
// consultar / un dato suelto que falta. Ver `diagnostico/edificio.js#REGISTRO`.
//
// ── ESTE MÓDULO ES UNA VISTA, Y NADA MÁS ────────────────────────────────────
// Fabrica nodos, los rellena, los abre y los cierra. **No conoce el modelo, ni el
// store, ni la red, ni `diagnostico/edificio.js`** salvo por UNA constante —el
// vocabulario de {@link REGISTRO}, para no escribir `'SIN_CONSTRUCCIONES'` a mano
// en una plantilla que no se quejaría si estuviera mal—. Es exactamente el mismo
// permiso, y por el mismo motivo, que `cajon-diagnostico.js` se toma con
// `ETIQUETA_MARGEN`.
//
// ── LO QUE SÍ SE REUTILIZA, Y POR QUÉ ESO ES LO CORRECTO ────────────────────
// Las medidas del papel y las dos vestimentas del contenedor se importan de
// `cajon-diagnostico.js`: `ESTILO_SOBRE_EL_MAPA`, `ESTILO_EN_EL_PANEL`,
// `ALTO_COMO_CAJON`, `ALTO_COMO_PANTALLA` y las clases de `CLASE`. No es ahorro de
// tecleo: **son un acuerdo con `estilos/app.css`**, y los 112 px de
// `ALTO_COMO_PANTALLA` y los 12 px de relleno de `ESTILO_EN_EL_PANEL` están
// MEDIDOS y compensados desde el otro lado de la hoja. Copiarlos aquí los habría
// dejado divergir a la primera corrección.
//
// ⚠️ **La clase del CONTENEDOR sí es propia** (`gml-cajon-contraste-edificio`), y
// eso cuesta dos comas en `estilos/app.css`. La alternativa —reutilizar
// `gml-cajon-diagnostico` y ahorrarse el CSS— pondría DOS nodos con esa clase en el
// mismo documento, y cinco guiones de humo (09, 10, 11, 14 y 15) la resuelven con
// `document.querySelector`, que se queda con el PRIMERO. Es la trampa M8 de F07,
// que este proyecto ya ha pagado dos veces; los ~90 bytes son el precio de no
// pagarla una tercera. Las clases de los HIJOS sí se comparten tal cual: sus reglas
// son `.gml-app .gml-cajon-titular` y compañía, sin contenedor delante, así que
// alcanzan a los dos y cuestan CERO.

import L from 'leaflet'

import { REGISTRO } from '../diagnostico/edificio.js'
import {
  ALTO_COMO_CAJON,
  ALTO_COMO_PANTALLA,
  CLASE as CLASE_CAJON,
  ESCALA,
  ESTILO_EN_EL_PANEL,
  ESTILO_SOBRE_EL_MAPA,
  rotuloDeGrupo,
} from './cajon-diagnostico.js'
import { resolverAvisar } from './_comun.js'

/** Esquinas válidas de un `L.Control`: las claves de `map._controlCorners`. */
const POSICIONES = ['topleft', 'topright', 'bottomleft', 'bottomright']

/**
 * La clase del contenedor. **Propia y no la del cajón de diagnóstico**: ver la
 * cabecera (trampa M8 de F07, ya pagada dos veces).
 */
export const CLASE_CONTENEDOR = 'gml-cajon-contraste-edificio'

/**
 * Las clases de los hijos, tomadas TAL CUAL del cajón de parcela. Sus reglas en
 * `estilos/app.css` no llevan contenedor delante (`.gml-app .gml-cajon-cifra`), así
 * que alcanzan a los dos cajones y este módulo no cuesta ni un byte de hoja por
 * ellas. Se re-exporta el objeto entero para que los tests puedan afirmar que son
 * las mismas sin volver a escribir los literales.
 */
export const CLASE = Object.freeze({
  ...CLASE_CAJON,
  CONTENEDOR: CLASE_CONTENEDOR,
  /** El renglón del estado del registro: la pantalla honesta vive aquí. */
  REGISTRO: 'gml-cajon-registro',
})

/**
 * Los `data-*` que este módulo produce. **Son el CONTRATO con
 * `app/cableado-contraste-edificio.js`**, que localiza los nodos POR SELECTOR.
 *
 * ⚠️ **Ni uno solo repite un par atributo/valor que ya exista en el documento**, y
 * eso no es aseo: `querySelector` se queda con el PRIMERO, así que un nombre
 * repetido deja a uno de los dos nodos mudo y sin síntoma. Es la lección M8 de F07
 * y la razón de que aquí se diga `contraste-edificio` y no `diagnostico`,
 * `informe-edificio` y no `informe-contraste`, `preparar-informe-edificio` y no
 * `preparar-informe`. Hay un guardián que recorre el documento montado y lo exige.
 */
export const SELECTOR = Object.freeze({
  CERRAR: '[data-accion="cerrar-contraste-edificio"]',
  CONSULTAR: '[data-accion="consultar-construccion"]',
  PREPARAR: '[data-accion="preparar-informe-edificio"]',
  ESTADO: '[data-estado="cajon-contraste-edificio"]',
  ESTADO_INFORME: '[data-estado="informe-edificio"]',
  TITULAR: '[data-contraste="titular"]',
  REGISTRO: '[data-contraste="registro"]',
  MEDIDA: '[data-contraste="huella-medida"]',
  OFICIAL: '[data-contraste="huella-oficial"]',
  DIFERENCIA_HUELLA: '[data-contraste="huella-diferencia"]',
  SOLAPE: '[data-contraste="solape"]',
  DIFERENCIA: '[data-contraste="diferencia"]',
  CENTROIDES: '[data-contraste="centroides"]',
  EN_PARCELA: '[data-contraste="en-parcela"]',
  FUERA: '[data-contraste="fuera"]',
  INVASION: '[data-contraste="invasion"]',
})

/**
 * El titular de la pantalla, DESCRIPTIVO (regla de oro 9). Dice qué se está
 * mirando, nunca si está bien.
 */
export const TITULO = 'Contraste con la construcción catastral'

/**
 * Lo que se escribe cuando un número no consta. **No es un `—` a secas**: «no
 * consta» dice que el dato falta, mientras un guion se lee como «cero» o como
 * «nada que reseñar». Misma decisión, y mismo literal, que el cajón de parcela.
 */
const NO_CONSTA = 'No consta'

/**
 * El RESUMEN de cada estado del registro, para la celda de la huella oficial.
 *
 * ⚠️ **Son resúmenes, no el motivo**: el motivo entero —con la frase que
 * tranquiliza— se escribe UNA vez, arriba, en el renglón del registro, y lo trae
 * hecho `diagnostico/edificio.js`. Repetirlo en cada celda haría un cajón
 * ilegible; ponerlo en ninguna dejaría celdas mudas. Cada resumen dice **cuál de
 * los tres «no hay» es**, que es lo único que la celda tiene que distinguir.
 *
 * `CONSULTADO` vale `null` a propósito: en ese estado la celda lleva una cifra y
 * no un resumen, y una entrada con texto invitaría a escribirla encima.
 *
 * @readonly
 */
export const RESUMEN_REGISTRO = Object.freeze({
  [REGISTRO.NO_CONSULTADO]: 'Sin consultar',
  [REGISTRO.SIN_CONSTRUCCIONES]: 'No consta ninguna',
  [REGISTRO.NO_SE_HA_PODIDO]: 'No se ha podido consultar',
  [REGISTRO.CONSULTADO]: null,
})

/**
 * Por qué está apagado «Preparar informe (PDF)». Se escribe en el renglón del pie
 * **en el mismo instante** en que se apaga —al nacer y en cada `pintar(null)`—,
 * porque un botón gris y mudo es un error silencioso (regla de oro 1): desde fuera
 * no se distingue de uno roto.
 *
 * ⚠️ Y dice **lo que hace falta de verdad**, que no es el contraste: el informe de
 * construcción se emite igual sin contrastar —«informe solo declarativo», ficha
 * §17—, así que lo que lo apaga es no tener construcción, no no tener contraste.
 * Escribir aquí «haz el contraste» mandaría a la gente a un paso opcional.
 */
export const MOTIVO_INFORME_SIN_EDIFICIO =
  '«Preparar informe (PDF)» está apagado: recoge las partes de la construcción y todavía no hay ' +
  'ninguna cargada. Se enciende en cuanto haya construcción, se haya contrastado o no — el ' +
  'contraste con el Catastro es un paso opcional.'

/**
 * Y lo que se dice mientras la consulta está en vuelo. El botón se apaga para que
 * no se pulse dos veces, y **se dice por qué**: un botón que se pone gris solo, sin
 * una palabra, se lee como que la aplicación se ha roto.
 */
export const CONSULTANDO = 'Consultando la construcción registrada en el Catastro…'

/**
 * Las vestimentas de los dos botones, que viajan SIEMPRE con su `disabled`. Un
 * botón que parece pulsable y no lo es no se distingue de uno roto; uno apagado que
 * parece encendido, tampoco. Existen porque un estilo EN LÍNEA no puede expresar
 * `:disabled` y este módulo no escribe reglas.
 *
 * Son los MISMOS pares que el cajón de parcela, literal por literal, y eso es
 * deliberado: los dos cajones ocupan el mismo sitio en la misma pantalla y se
 * turnan según la rama. Dos grises distintos se leerían como dos aplicaciones.
 * El apagado va en el GRIS del cromo y **nunca en rojo**: se comunica «esto no se
 * puede pulsar ahora», no «esto está mal» (regla de oro 9).
 */
const BOTON = Object.freeze({
  PRIMARIO: Object.freeze({
    ENCENDIDO: Object.freeze({ background: '#0F172A', color: '#fff', cursor: 'pointer' }),
    APAGADO: Object.freeze({ background: '#E2E8F0', color: '#64748B', cursor: 'default' }),
  }),
  SECUNDARIO: Object.freeze({
    ENCENDIDO: Object.freeze({
      background: 'transparent',
      color: '#334155',
      border: '1px solid #CBD5E1',
      cursor: 'pointer',
    }),
    APAGADO: Object.freeze({
      background: 'transparent',
      color: '#94A3B8',
      border: '1px solid #E2E8F0',
      cursor: 'default',
    }),
  }),
})

const nf = (decimales) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })

/** Superficies y longitudes: 2 decimales, que es lo que la app sabe medir. */
const FORMATO_2 = nf(2)
/** Recuentos: sin decimales y sin separador de millar (no hay 1.000 piezas). */
const FORMATO_CUENTA = new Intl.NumberFormat('es-ES', { useGrouping: false })

const m2 = (v) => (v === null || v === undefined ? NO_CONSTA : `${FORMATO_2.format(v)} m²`)
const metros = (v) => (v === null || v === undefined ? NO_CONSTA : `${FORMATO_2.format(v)} m`)
const cuenta = (v) => (v === null || v === undefined ? NO_CONSTA : FORMATO_CUENTA.format(v))

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

/** Plural del castellano para los recuentos que se dicen con palabras. */
const plural = (n, singular, pluralForma) => (n === 1 ? singular : pluralForma)

const crear = (doc, etiqueta, clase, texto) => {
  const el = doc.createElement(etiqueta)
  if (clase) el.className = clase
  if (texto !== undefined) el.textContent = texto
  return el
}

/**
 * Aplica estilos en línea propiedad a propiedad.
 *
 * **No se usa `style.cssText`**, y no es una preferencia: la guarda transversal del
 * punto 12 (`test/viewer/contrato-capas.dom.test.js`) prohíbe la subcadena `.css` en
 * el código de `viewer/`, y `.cssText` la contiene. El porqué largo está en
 * `viewer/cajon-diagnostico.js#estilar`, que es de donde sale esta función.
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

/**
 * ¿El gesto ha ocurrido dentro de un `<dialog>`? Se pregunta por el ELEMENTO y no
 * por el atributo `open`: en un `keydown` de `Escape` el diálogo ya se ha cerrado
 * cuando el evento llega burbujeando hasta el `document`. El porqué entero está en
 * `viewer/cajon-diagnostico.js#enDialogo`, y el defecto que evita es real (F09).
 */
const enDialogo = (objetivo) =>
  !!objetivo && typeof objetivo.closest === 'function' && objetivo.closest('dialog') !== null

// ── El control ───────────────────────────────────────────────────────────────

const CajonContrasteEdificio = L.Control.extend({
  options: {
    position: 'bottomleft',
    etiqueta: 'Contraste con la construcción catastral',
  },

  /**
   * Los oyentes del `document` se LIGAN aquí, una vez por instancia, y se guardan
   * como campos propios: `addEventListener` y `removeEventListener` tienen que
   * recibir **la misma referencia**, y dos `bind(this)` son dos funciones distintas
   * — el oyente quedaría vivo sobre un control ya destruido y `destruir()` mentiría.
   */
  initialize(opciones) {
    L.setOptions(this, opciones)
    this._alClicFuera = (evento) => this._cerrarPorClicFuera(evento)
    this._alEscape = (evento) => this._cerrarPorEscape(evento)
    this._abierto = false
    this._eventoApertura = null
    this._comoPantalla = false
    this._anfitrion = null
    this._esquina = null
    this._oyentes = {
      cerrar: new Set(),
      salir: new Set(),
      consultar: new Set(),
      preparar: new Set(),
    }
  },

  onAdd(mapa) {
    const doc = mapa.getContainer().ownerDocument || document
    this._doc = doc
    const sello = L.Util.stamp(this)

    const contenedor = crear(doc, 'section', CLASE.CONTENEDOR)
    this._contenedor = contenedor
    contenedor.setAttribute('aria-label', this.options.etiqueta)
    // Estilos MÍNIMOS en línea: este módulo no importa ninguna hoja, así que el
    // cajón tiene que ser legible por sí solo (en `npm run dev` sin CSS, y en
    // jsdom). El cromo fino es de `estilos/app.css`.
    estilar(contenedor, {
      font: '13px/1.45 system-ui,sans-serif',
      color: '#334155',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      display: 'none',
    })
    // Nace como CAJÓN SOBRE EL MAPA, igual que su hermano: quien lo muda al panel
    // es {@link _reubicar}, y solo cuando alguien le da un anfitrión y le dice que
    // es la pantalla. Un visor montado a pelo se comporta como un cajón.
    estilar(contenedor, ESTILO_SOBRE_EL_MAPA)

    // ── Cabecera: titular descriptivo + cerrar ──────────────────────────────
    const cabecera = crear(doc, 'header')
    estilar(cabecera, {
      display: 'flex',
      alignItems: 'start',
      gap: '8px',
      justifyContent: 'space-between',
    })
    const titular = crear(doc, 'h2', CLASE.TITULAR, TITULO)
    titular.dataset.contraste = 'titular'
    estilar(titular, { margin: '0', fontSize: ESCALA.CUERPO, fontWeight: '600', color: '#0F172A' })
    this._titular = titular

    const cerrar = crear(doc, 'button', null, '✕')
    cerrar.type = 'button'
    cerrar.dataset.accion = 'cerrar-contraste-edificio'
    cerrar.setAttribute('aria-label', 'Cerrar el contraste')
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

    // ── ⭐ EL RENGLÓN DEL REGISTRO: AQUÍ VIVE LA PANTALLA HONESTA ───────────
    // Va ARRIBA del todo y no en una nota al pie, porque cambia cómo se lee todo
    // lo que hay debajo: unas celdas vacías significan una cosa si nadie ha
    // preguntado y otra muy distinta si el Catastro ha dicho que no hay nada.
    //
    // El TEXTO llega hecho desde `diagnostico/edificio.js` (regla de oro 1: quien
    // sabe por qué no se puede medir es quien lo escribe). Aquí solo se pinta.
    //
    // Nace VACÍO y por lo tanto oculto: un renglón en blanco cuesta ~17 px, y no
    // tener nada que decir tiene que costar cero.
    const registro = crear(doc, 'p', CLASE.REGISTRO)
    registro.dataset.contraste = 'registro'
    // `role="status"`: consultar el Catastro lo reescribe, y un lector de pantalla
    // tiene que enterarse sin que le roben el foco de donde lo tenga.
    registro.setAttribute('role', 'status')
    estilar(registro, {
      margin: '8px 0 0',
      fontSize: ESCALA.APUNTE,
      color: '#475569',
      display: 'none',
    })
    this._registro = registro

    // ── La huella: lo medido contra lo publicado ───────────────────────────
    const huella = crear(doc, 'dl', CLASE.SECCION)
    estilar(huella, {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: '2px 10px',
      margin: '10px 0 0',
      fontSize: ESCALA.CUERPO,
    })
    this._medida = crear(doc, 'dd', CLASE.CIFRA)
    this._medida.dataset.contraste = 'huella-medida'
    this._oficial = crear(doc, 'dd', CLASE.CIFRA)
    this._oficial.dataset.contraste = 'huella-oficial'
    this._difHuella = crear(doc, 'dd', CLASE.CIFRA)
    this._difHuella.dataset.contraste = 'huella-diferencia'
    huella.append(
      crear(doc, 'dt', null, 'Huella medida'),
      this._medida,
      crear(doc, 'dt', null, 'Huella del Catastro'),
      this._oficial,
      crear(doc, 'dt', null, 'Diferencia'),
      this._difHuella,
    )

    // ── El encaje de las dos huellas ───────────────────────────────────────
    const encaje = crear(doc, 'dl', CLASE.SECCION)
    estilar(encaje, {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: '2px 10px',
      margin: '10px 0 0',
      fontSize: ESCALA.CUERPO,
    })
    this._solape = crear(doc, 'dd', CLASE.CIFRA)
    this._solape.dataset.contraste = 'solape'
    this._diferencia = crear(doc, 'dd', CLASE.CIFRA)
    this._diferencia.dataset.contraste = 'diferencia'
    this._centroides = crear(doc, 'dd', CLASE.CIFRA)
    this._centroides.dataset.contraste = 'centroides'
    encaje.append(
      crear(doc, 'dt', null, 'Solape'),
      this._solape,
      crear(doc, 'dt', null, 'Diferencia simétrica'),
      this._diferencia,
      crear(doc, 'dt', null, 'Desplazamiento de centroides'),
      this._centroides,
    )

    // ── Dentro de la parcela: la pregunta propia de esta rama ──────────────
    const enParcela = crear(doc, 'dl', CLASE.SECCION)
    estilar(enParcela, {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: '2px 10px',
      margin: '10px 0 0',
      fontSize: ESCALA.CUERPO,
    })
    this._enParcela = crear(doc, 'dd', CLASE.CIFRA)
    this._enParcela.dataset.contraste = 'en-parcela'
    this._fuera = crear(doc, 'dd', CLASE.CIFRA)
    this._fuera.dataset.contraste = 'fuera'
    enParcela.append(
      crear(doc, 'dt', null, 'Dentro de la parcela'),
      this._enParcela,
      crear(doc, 'dt', null, 'Fuera de la parcela'),
      this._fuera,
    )

    // ── Invasión: la única sección que puede llevar ámbar ──────────────────
    const invasion = crear(doc, 'div', CLASE.INVASION)
    invasion.dataset.contraste = 'invasion'
    invasion.style.marginTop = '10px'
    this._invasion = invasion

    // ── El renglón de estado ───────────────────────────────────────────────
    const estado = crear(doc, 'p')
    estado.dataset.estado = 'cajon-contraste-edificio'
    estado.setAttribute('role', 'status')
    estilar(estado, { margin: '8px 0 0', fontSize: ESCALA.APUNTE, color: '#64748B', minHeight: '1em' })
    this._estado = estado

    // ── El PIE: las dos acciones ───────────────────────────────────────────
    const idInforme = `gml-contraste-edificio-informe-${sello}`
    const pie = crear(doc, 'footer')
    estilar(pie, { marginTop: '0' })

    const acciones = crear(doc, 'div')
    estilar(acciones, { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' })

    // El PRIMARIO: el documento firmable, que es a lo que se viene. Va antes que la
    // consulta porque el orden es lo único que dice cuál de los dos es el
    // entregable — y aquí importa más que en la otra rama, porque el otro botón
    // lanza un paso OPCIONAL y ponerlo primero lo haría parecer obligatorio.
    const preparar = crear(doc, 'button', null, 'Preparar informe (PDF)')
    preparar.type = 'button'
    preparar.dataset.accion = 'preparar-informe-edificio'
    preparar.setAttribute('aria-describedby', idInforme)
    // NACE APAGADO: sin construcción cargada no hay partes que fichar.
    preparar.disabled = true
    // ⚠️ NI `font: 'inherit'` NI NINGUNA `fontFamily`: el estilo en línea gana a la
    // hoja y dejaría muerta la regla `.gml-cajon-contraste-edificio button` de
    // `estilos/app.css`. Es un defecto REAL medido en el guion 10 el 2026-07-30, en
    // el cajón hermano, y se hereda la corrección: el módulo pone tamaño y grosor
    // (legible sin hoja); **la FAMILIA la pone la hoja**.
    estilar(preparar, {
      border: '0',
      borderRadius: '4px',
      padding: '6px 12px',
      fontSize: 'inherit',
      lineHeight: 'inherit',
      fontWeight: '600',
      ...BOTON.PRIMARIO.APAGADO,
    })
    this._preparar = preparar

    // El SECUNDARIO: la consulta. Es lo que produce el contraste, y el contraste es
    // opcional — de ahí el contorno y no el fondo oscuro.
    const consultar = crear(doc, 'button', null, 'Consultar el Catastro')
    consultar.type = 'button'
    consultar.dataset.accion = 'consultar-construccion'
    // ⚠️ Ni `font: 'inherit'` ni `fontFamily`, por lo mismo que el primario.
    estilar(consultar, {
      borderRadius: '4px',
      padding: '6px 12px',
      fontSize: 'inherit',
      lineHeight: 'inherit',
      fontWeight: '600',
      ...BOTON.SECUNDARIO.ENCENDIDO,
    })
    this._consultar = consultar

    const estadoInforme = crear(doc, 'p')
    estadoInforme.id = idInforme
    estadoInforme.dataset.estado = 'informe-edificio'
    estadoInforme.setAttribute('role', 'status')
    estilar(estadoInforme, {
      margin: '6px 0 0',
      fontSize: ESCALA.APUNTE,
      color: '#64748B',
      minHeight: '1em',
    })
    // El motivo se escribe YA, no al primer repintado: el cajón puede abrirse sin
    // que nadie haya llamado a `pintar`, y ese es justo el instante en que el botón
    // está gris.
    estadoInforme.textContent = MOTIVO_INFORME_SIN_EDIFICIO
    this._estadoInforme = estadoInforme

    acciones.append(preparar, consultar)
    pie.append(acciones, estadoInforme)

    // ── EL BLOQUE ANCLADO ──────────────────────────────────────────────────
    // Misma receta —y por el mismo defecto medido— que el cajón de parcela el
    // 2026-08-05: lo que HABLA (los dos renglones `role="status"`) y lo que se
    // PULSA (los dos botones) van en un bloque `sticky` pegado abajo, **hijo
    // directo del contenedor**, que es el que scrollea. Sin esto, a 1280×720 lo
    // accionable nace por debajo del pliegue de un scroll interno que arranca en 0,
    // y nada dice que esté ahí.
    //
    // Los márgenes negativos con su relleno del mismo tamaño no son un apaño:
    // llevan el fondo blanco hasta los bordes del cajón (que tiene
    // `padding: 10px 12px`), y sin eso el contenido se vería pasar por debajo.
    const anclado = crear(doc, 'div')
    anclado.dataset.contraste = 'anclado'
    estilar(anclado, {
      position: 'sticky',
      bottom: '0',
      zIndex: '1',
      marginTop: '12px',
      marginLeft: '-12px',
      marginRight: '-12px',
      marginBottom: '-10px',
      padding: '8px 12px 10px',
      borderTop: '1px solid #E2E8F0',
      background: '#fff',
      boxSizing: 'border-box',
      width: 'calc(100% + 24px)',
    })
    this._anclado = anclado
    anclado.append(estado, pie)

    // ── ⭐ LA ESCALA COMPARTIDA Y LOS RÓTULOS (2026-08-10) ─────────────────
    // Las ocho cifras a DATO contra etiquetas en CUERPO: el salto que hace que la
    // vista caiga en el número y no en su nombre. Antes ninguna declaraba tamaño y
    // heredaban 12 px de Leaflet sobre el mapa y otro distinto dentro del panel.
    for (const dd of [
      this._medida, this._oficial, this._difHuella,
      this._solape, this._diferencia, this._centroides,
      this._enParcela, this._fuera,
    ]) {
      estilar(dd, { fontSize: ESCALA.DATO })
    }

    // Tres rótulos, con el vocabulario que este cajón ya usaba en sus etiquetas.
    //
    // ⛔ **Y aquí NO hay dato titular a `ESCALA.DATO_XL`, al contrario que en el
    // cajón de parcela.** No es un olvido: allí la cifra titular es un número
    // solo («40,04 m²»), y aquí `pintarHuella` compone «322,13 m² · 25 piezas».
    // A 30 px ese compuesto no cabe en los 392 px del panel y parte en dos
    // líneas, que es peor que no destacarlo. Los dos cajones dicen cosas
    // distintas y la jerarquía lo respeta.
    //
    // La invasión tampoco lleva rótulo, por lo mismo que en el hermano: se anuncia
    // ella sola con tres textos distintos (ver `CLASE.ROTULO` allí).
    contenedor.append(
      cabecera,
      registro,
      rotuloDeGrupo(doc, 'Huella'),
      huella,
      rotuloDeGrupo(doc, 'Encaje'),
      encaje,
      rotuloDeGrupo(doc, 'En la parcela'),
      enParcela,
      invasion,
      anclado,
    )

    // OBLIGATORIOS: sin ellos, pulsar dentro seleccionaría una parte por debajo y la
    // rueda sobre las cifras haría zoom al mapa.
    L.DomEvent.disableClickPropagation(contenedor)
    L.DomEvent.disableScrollPropagation(contenedor)

    L.DomEvent.on(cerrar, 'click', this._alPulsarCerrar, this)
    L.DomEvent.on(preparar, 'click', this._alPulsarPreparar, this)
    L.DomEvent.on(consultar, 'click', this._alPulsarConsultar, this)
    doc.addEventListener('click', this._alClicFuera)
    doc.addEventListener('keydown', this._alEscape)

    return contenedor
  },

  onRemove() {
    L.DomEvent.off(this._botonCerrar, 'click', this._alPulsarCerrar, this)
    L.DomEvent.off(this._preparar, 'click', this._alPulsarPreparar, this)
    L.DomEvent.off(this._consultar, 'click', this._alPulsarConsultar, this)
    if (this._doc) {
      this._doc.removeEventListener('click', this._alClicFuera)
      this._doc.removeEventListener('keydown', this._alEscape)
    }
    this._abierto = false
  },

  // ── Dónde vive el contenedor ──────────────────────────────────────────────

  /**
   * Mueve el contenedor al sitio que le toca y lo viste para ese sitio. Hay
   * exactamente DOS sitios y el razonamiento entero —incluido por qué se MUEVE el
   * nodo y no se fabrica otro— está en `viewer/cajon-diagnostico.js#_reubicar`.
   * IDEMPOTENTE y barata.
   */
  _reubicar() {
    const contenedor = this._contenedor
    if (!contenedor) return
    const enPanel = this._comoPantalla === true && this._anfitrion !== null
    const destino = enPanel ? this._anfitrion : this._esquina
    if (destino && contenedor.parentNode !== destino) destino.append(contenedor)
    if (enPanel) {
      estilar(contenedor, ESTILO_EN_EL_PANEL)
      return
    }
    estilar(contenedor, ESTILO_SOBRE_EL_MAPA)
    contenedor.style.maxHeight = this._comoPantalla ? ALTO_COMO_PANTALLA : ALTO_COMO_CAJON
  },

  // ── Apertura y cierre ─────────────────────────────────────────────────────

  _fijarAbierto(abierto, evento = null) {
    if (this._abierto === abierto) return
    this._abierto = abierto
    this._eventoApertura = abierto ? evento : null
    if (this._contenedor) this._contenedor.style.display = abierto ? '' : 'none'
    if (!abierto) for (const fn of this._oyentes.cerrar) fn()
  },

  /**
   * El ✕. Cuando el cajón ES la pantalla, cerrarlo es SALIRSE: pulsar un botón que
   * no hace nada es peor que no tenerlo (regla de oro 1), y esconderlo tampoco vale
   * porque salir del contraste es algo que el usuario quiere poder hacer. A dónde
   * se sale lo decide `app/contraste.js`; esta vista no sabe qué es un paso.
   */
  _alPulsarCerrar(evento) {
    L.DomEvent.stop(evento)
    if (this._comoPantalla) {
      for (const fn of this._oyentes.salir) fn(evento)
      return
    }
    this._fijarAbierto(false)
  },

  /**
   * Cierra al pulsar fuera. **Sin `capture` y sin `preventDefault`**, y **nunca
   * cuando es la pantalla**: mirar el mapa es literalmente lo que se hace en esa
   * pantalla, y un clic ahí la dejaría vacía sin que el rail pudiera devolverla
   * (navegar al paso en el que ya estás no publica nada). Está medido en el cajón
   * hermano el 2026-08-05, y aquí se hereda la corrección en vez del defecto.
   */
  _cerrarPorClicFuera(evento) {
    if (!this._abierto || !this._contenedor) return
    if (this._comoPantalla) return
    if (evento === this._eventoApertura) {
      this._eventoApertura = null
      return
    }
    if (this._contenedor.contains(evento.target)) return
    if (enDialogo(evento.target)) return
    this._fijarAbierto(false)
  },

  /**
   * Cierra con `Escape`. Con la misma excepción del diálogo, que aquí es todavía
   * más necesaria: `Escape` es LA tecla de cerrar un modal, y sin esta guarda
   * cancelar el diálogo del informe cerraría además el cajón de debajo.
   */
  _cerrarPorEscape(evento) {
    if (!this._abierto) return
    if (this._comoPantalla) return
    if (evento.key !== 'Escape') return
    if (enDialogo(evento.target)) return
    this._fijarAbierto(false)
  },

  /**
   * Pulsación de «Consultar el Catastro». **No se llama a `L.DomEvent.stop`**, y es
   * la misma decisión que en el cajón hermano: parar la propagación dejaría sordo a
   * cualquier otro oyente del `document` por un problema que no existe, porque el
   * guardián de clic-fuera ve el clic DENTRO del contenedor.
   */
  _alPulsarConsultar(evento) {
    for (const fn of this._oyentes.consultar) fn(evento)
  },

  /** Ídem con «Preparar informe (PDF)». El evento se pasa porque quien escucha va a
   *  abrir un diálogo con él, y un diálogo abierto por un clic quiere saber cuál. */
  _alPulsarPreparar(evento) {
    for (const fn of this._oyentes.preparar) fn(evento)
  },
})

/**
 * El cajón del contraste de construcción, como control de Leaflet.
 *
 * ```js
 * const cajon = crearCajonContrasteEdificio({ mapa })
 * cajon.anfitrion(document.querySelector('[data-anfitrion="contraste-edificio"]'))
 * cajon.comoPantalla(true)
 * cajon.pintar(contrastarEdificio({ envolvente, registro }))
 * cajon.alConsultar(() => pedirLaConstruccionAlCatastro())
 * cajon.alPreparar(() => abrirDialogoDelInforme())
 * ```
 *
 * @param {Object} opciones
 * @param {import('leaflet').Map} opciones.mapa  El mapa del visor.
 * @param {string} [opciones.posicion='bottomleft']  Esquina de Leaflet. El defecto
 *   es el mismo que el del cajón de diagnóstico, y por lo mismo: es la única
 *   esquina libre del visor. Los dos NUNCA coinciden en pantalla —se turnan por
 *   RAMA, y la rama es única—, así que compartirla no los apila.
 * @param {((mensaje: string, detalle?: object) => void)|null} [opciones.alAvisar]
 *   Canal de aviso (regla de oro 1). Se resuelve y valida aunque no se use, que es
 *   el patrón obligatorio del visor.
 * @returns {{control: object, pintar: Function, abrir: Function, cerrar: Function,
 *   abierto: Function, estado: Function, estadoInforme: Function,
 *   consultando: Function, alConsultar: Function, alPreparar: Function,
 *   alCerrar: Function, alSalir: Function, comoPantalla: Function,
 *   anfitrion: Function, destruir: Function}}
 * @throws {TypeError|RangeError} Contrato del programador.
 */
export function crearCajonContrasteEdificio({ mapa, posicion = 'bottomleft', alAvisar } = {}) {
  if (!esMapa(mapa)) {
    throw new TypeError(
      `crearCajonContrasteEdificio: 'mapa' debe ser un mapa de Leaflet (con addControl/` +
        `removeControl/getContainer); recibido ${JSON.stringify(mapa)}.`,
    )
  }
  if (typeof posicion !== 'string') {
    throw new TypeError(
      `crearCajonContrasteEdificio: 'posicion' debe ser una cadena con una esquina de ` +
        `Leaflet; recibido ${typeof posicion}.`,
    )
  }
  if (!POSICIONES.includes(posicion)) {
    throw new RangeError(
      `crearCajonContrasteEdificio: 'posicion' debe ser una esquina de Leaflet; recibido ` +
        `${JSON.stringify(posicion)}. Válidas: ${POSICIONES.join(', ')}.`,
    )
  }
  // Patrón obligatorio del visor: se resuelve (y se valida) aunque no se use.
  resolverAvisar(alAvisar)

  const control = new CajonContrasteEdificio({ position: posicion })
  mapa.addControl(control)
  // La esquina a la que hay que devolverlo si deja de ser la pantalla. Se lee AQUÍ
  // y no en `onAdd` porque Leaflet cuelga el contenedor DESPUÉS de que aquél
  // devuelva. Ver `viewer/cajon-diagnostico.js`.
  control._esquina = control._contenedor === undefined ? null : control._contenedor.parentNode

  let destruido = false
  /** ¿Hay una consulta en vuelo? Gobierna el `disabled` del botón secundario. */
  let enVuelo = false

  /**
   * El motivo de una sección omitida, TAL CUAL lo trae el contraste. La vista no
   * tiene su propia tabla de traducciones, que es lo que se queda corto en silencio
   * cuando el modelo añade un caso.
   */
  function textoOmitido(c, que) {
    const omision = c.omisiones.find((o) => o.que === que)
    return omision ? omision.motivo : NO_CONSTA
  }

  /**
   * El renglón del registro: la pantalla honesta. Cadena vacía **oculta** el
   * renglón, no lo deja en blanco.
   */
  function pintarRegistro(c) {
    const motivo = c.registro?.motivo ?? ''
    control._registro.textContent = motivo === null ? '' : motivo
    control._registro.style.display = motivo ? '' : 'none'
  }

  /** Las dos huellas y su diferencia. La medida SIEMPRE es una cifra: es nuestra. */
  function pintarHuella(c) {
    const clave = c.registro?.clave ?? REGISTRO.NO_CONSULTADO
    const resumen = RESUMEN_REGISTRO[clave] ?? NO_CONSTA
    const piezas = c.huella.nPiezasMedida
    control._medida.textContent =
      `${m2(c.huella.medida)} · ${cuenta(piezas)} ` +
      `${plural(piezas, 'pieza', 'piezas')}`
    control._oficial.textContent =
      c.huella.oficial === null
        ? resumen
        : `${m2(c.huella.oficial)} · ${cuenta(c.huella.nCarasOficial)} ` +
          `${plural(c.huella.nCarasOficial, 'cara', 'caras')}`
    control._difHuella.textContent =
      c.huella.diferencia === null ? resumen : conSigno(c.huella.diferencia, m2)
  }

  /** El encaje de las dos huellas. Cada `null` dice su motivo, no un guion. */
  function pintarEncaje(c) {
    control._solape.textContent =
      c.solape === null
        ? textoOmitido(c, 'solape')
        : `${m2(c.solape.area)} · ${porcentaje(c.solape.relativo)} de la mayor`
    control._diferencia.textContent =
      c.diferencia === null ? textoOmitido(c, 'diferencia') : m2(c.diferencia.area)
    control._centroides.textContent =
      c.centroides === null ? textoOmitido(c, 'centroides') : metros(c.centroides.distancia)
  }

  /** Cuánto de la construcción cae dentro de la parcela declarada, y cuánto fuera. */
  function pintarEnParcela(c) {
    if (c.enParcela === null) {
      const motivo = textoOmitido(c, 'enParcela')
      control._enParcela.textContent = motivo
      control._fuera.textContent = motivo
      return
    }
    control._enParcela.textContent =
      `${m2(c.enParcela.superficieDentro)} · ${porcentaje(c.enParcela.relativo)}`
    control._fuera.textContent = m2(c.enParcela.superficieFuera)
  }

  /**
   * La invasión. **La única sección con ámbar**, y la única donde «no se ha
   * consultado» y «no hay» tienen que escribirse distinto: son afirmaciones
   * opuestas y la segunda tranquiliza.
   */
  function pintarInvasion(c) {
    const doc = control._doc
    const caja = control._invasion
    caja.replaceChildren()

    const { consultado, invasiones, descartadas } = c.invasion

    if (!consultado) {
      // ⛔ NUNCA «no hay invasión»: es la afirmación tranquilizadora y falsa, y el
      // error silencioso más caro que esta vista podría cometer.
      const p = crear(
        doc,
        'p',
        null,
        'Invasión a parcelas vecinas: no se ha consultado. Hay que traer las parcelas colindantes ' +
          'del Catastro.',
      )
      estilar(p, { margin: '0', fontSize: ESCALA.APUNTE, color: '#64748B' })
      caja.append(p)
      return
    }

    if (invasiones.length === 0) {
      const p = crear(doc, 'p', null, 'Invasión a parcelas vecinas: ninguna.')
      estilar(p, { margin: '0', fontSize: ESCALA.APUNTE, color: '#64748B' })
      caja.append(p)
    } else {
      const titulo = crear(doc, 'p', null, 'Invasión a parcelas vecinas')
      estilar(titulo, { margin: '0 0 4px', fontWeight: '600', color: '#92400E' })
      caja.append(titulo)

      const ul = crear(doc, 'ul')
      estilar(ul, { margin: '0', paddingLeft: '18px' })
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
      // Regla de oro 1: lo descartado se puede ver. Son astillas de redondeo del
      // lindero compartido, y quien desconfíe del criterio tiene el área delante.
      const total = descartadas.reduce((s, x) => s + x.area, 0)
      const p = crear(
        doc,
        'p',
        null,
        `Se han descartado ${cuenta(descartadas.length)} ` +
          `${plural(descartadas.length, 'solape', 'solapes')} de ${m2(total)} por ser más finos ` +
          `que un milímetro: son el redondeo del lindero compartido, no superficie.`,
      )
      // Mismo arreglo que en el cajón hermano (2026-08-10): 11 px suelto fuera de
      // la escala, y `#94A3B8` daba 2,6:1 sobre blanco. Ahora APUNTE y 4,55:1.
      estilar(p, { margin: '4px 0 0', fontSize: ESCALA.APUNTE, color: '#64748B' })
      caja.append(p)
    }
  }

  /**
   * El `disabled` del informe, su vestimenta y su renglón: las tres cosas en una
   * función, para que no puedan divergir.
   *
   * La regla es una línea: **el informe se puede componer ⟺ el cajón está enseñando
   * un contraste**, y eso implica que hay construcción, porque `contrastarEdificio`
   * no se puede llamar sin envolvente. **No implica que se haya contrastado**, y
   * ésa es la diferencia con la rama de parcela: el informe de construcción se
   * emite igual sin contraste (§17, «informe solo declarativo»), y por eso el
   * motivo de {@link MOTIVO_INFORME_SIN_EDIFICIO} habla de la construcción y no del
   * contraste.
   *
   * Al ENCENDER solo se borra el motivo y no el renglón: `pintar` corre en cada
   * cambio del modelo, y vaciarlo sin condición se llevaría por delante el acuse de
   * recibo del PDF un instante después de escribirlo. Al APAGAR sí se pisa lo que
   * hubiera: un desenlace anterior habla de un informe que ya no se puede componer.
   *
   * @param {boolean} hayContraste
   */
  function gateInforme(hayContraste) {
    if (!control._preparar || !control._estadoInforme) return
    control._preparar.disabled = !hayContraste
    estilar(control._preparar, hayContraste ? BOTON.PRIMARIO.ENCENDIDO : BOTON.PRIMARIO.APAGADO)
    if (!hayContraste) {
      control._estadoInforme.textContent = MOTIVO_INFORME_SIN_EDIFICIO
      return
    }
    if (control._estadoInforme.textContent === MOTIVO_INFORME_SIN_EDIFICIO) {
      control._estadoInforme.textContent = ''
    }
  }

  return {
    control,

    /**
     * Pinta el contraste. `null` deja el cajón en blanco (sin cerrarlo).
     *
     * @param {object|null} c  Lo que devuelve
     *   `diagnostico/edificio.js#contrastarEdificio`.
     */
    pintar(c) {
      if (destruido || !control._contenedor) return
      if (c === null || c === undefined) {
        control._registro.textContent = ''
        control._registro.style.display = 'none'
        for (const el of [
          control._medida,
          control._oficial,
          control._difHuella,
          control._solape,
          control._diferencia,
          control._centroides,
          control._enParcela,
          control._fuera,
        ]) {
          el.textContent = NO_CONSTA
        }
        control._invasion.replaceChildren()
        // Sin construcción no hay informe que componer, y el botón lo dice.
        gateInforme(false)
        return
      }

      pintarRegistro(c)
      pintarHuella(c)
      pintarEncaje(c)
      pintarEnParcela(c)
      pintarInvasion(c)
      gateInforme(true)
    },

    /**
     * Abre el cajón.
     *
     * @param {Event|null} [evento=null]  El evento de DOM que lo está abriendo, si
     *   lo hay. Se pasa para que el guardián del clic fuera no cuente como «clic
     *   fuera» el mismo clic que ha abierto el cajón.
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
     * ¿Es esto un cajón o es la pantalla? Sin argumento, LEE. Con un booleano,
     * ESCRIBE. Cambia tres cosas a la vez —ya no se descarta, el ✕ pide la salida y
     * el tope de alto pasa a {@link ALTO_COMO_PANTALLA}— porque las tres son la
     * misma pregunta. El razonamiento entero, con las cifras que lo motivaron, está
     * en `viewer/cajon-diagnostico.js#comoPantalla`.
     *
     * @param {boolean} [valor]
     * @returns {boolean}
     */
    comoPantalla(valor) {
      if (destruido) return false
      if (valor === undefined) return control._comoPantalla === true
      if (typeof valor !== 'boolean') {
        throw new TypeError(
          `comoPantalla: 'valor' debe ser booleano; recibido ${typeof valor}. Sin argumento LEE.`,
        )
      }
      if (valor === control._comoPantalla) return control._comoPantalla
      control._comoPantalla = valor
      control._reubicar()
      if (control._botonCerrar) {
        control._botonCerrar.setAttribute(
          'aria-label',
          valor ? 'Salir del contraste' : 'Cerrar el contraste',
        )
      }
      return control._comoPantalla
    },

    /**
     * Dónde vive el cajón cuando ES la pantalla. Sin argumento, LEE; con un
     * elemento, lo adopta; con `null`, vuelve a la esquina del mapa.
     *
     * ⚠️ **No abre ni cierra nada**: mudar de sitio y estar abierto son cosas
     * distintas. Y lanza con cualquier cosa que no sea un elemento o `null`, porque
     * un `undefined` colado aquí sería una LECTURA silenciosa y el cajón se quedaría
     * sobre el mapa sin que nada lo dijera.
     *
     * @param {HTMLElement|null} [nodo]
     * @returns {HTMLElement|null}
     * @throws {TypeError}
     */
    anfitrion(nodo) {
      if (destruido) return null
      if (nodo === undefined) return control._anfitrion
      if (nodo !== null && !(nodo && typeof nodo === 'object' && nodo.nodeType === 1)) {
        throw new TypeError(
          `anfitrion: 'nodo' debe ser un elemento del DOM (donde colgar el contraste cuando es la ` +
            `pantalla) o null para devolverlo a la esquina del mapa; recibido ${typeof nodo}. ` +
            `Sin argumento LEE.`,
        )
      }
      control._anfitrion = nodo
      control._reubicar()
      return control._anfitrion
    },

    /**
     * Enciende o apaga «Consultar el Catastro» mientras la consulta está en vuelo,
     * **y lo dice** en el renglón de estado (regla de oro 1: un botón que se pone
     * gris solo, sin una palabra, se lee como que la aplicación se ha roto).
     *
     * Al terminar solo se borra el aviso de {@link CONSULTANDO} y no el renglón
     * entero: quien llama a `consultando(false)` acaba de escribir ahí el desenlace,
     * y vaciarlo se lo llevaría por delante.
     *
     * @param {boolean} activo
     * @returns {boolean}  Lo aplicado.
     */
    consultando(activo) {
      if (destruido || !control._consultar) return false
      enVuelo = activo === true
      control._consultar.disabled = enVuelo
      estilar(control._consultar, enVuelo ? BOTON.SECUNDARIO.APAGADO : BOTON.SECUNDARIO.ENCENDIDO)
      if (enVuelo) {
        control._estado.textContent = CONSULTANDO
      } else if (control._estado.textContent === CONSULTANDO) {
        control._estado.textContent = ''
      }
      return enVuelo
    },

    /** Escribe el renglón de estado del cajón (`role="status"`). */
    estado(texto) {
      if (!destruido && control._estado) control._estado.textContent = texto
    },

    /**
     * Escribe el renglón del PIE, que es un nodo DISTINTO del de arriba: aquel
     * cuenta lo que le pasa a lo que se está enseñando (la consulta, un fallo del
     * cálculo) y este, el desenlace de pulsar «Preparar informe (PDF)».
     */
    estadoInforme(texto) {
      if (!destruido && control._estadoInforme) control._estadoInforme.textContent = texto
    },

    /**
     * Se suscribe a «Consultar el Catastro». Devuelve la BAJA. Varios oyentes: un
     * `= fn` desengancharía al primero en silencio.
     *
     * El cajón **no conoce la red ni el modelo**: solo avisa de que han pulsado.
     * Quien consulta es `app/cableado-contraste-edificio.js`.
     */
    alConsultar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alConsultar: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.consultar.add(fn)
      return () => control._oyentes.consultar.delete(fn)
    },

    /**
     * Se suscribe a «Preparar informe (PDF)». Devuelve la BAJA.
     *
     * El cajón **no compone, no maqueta y no baja nada**: solo avisa. El PDF lo arma
     * `report/pdf-edificio.js` y el pie de firma lo recoge `app/dialogo-informe.js`;
     * quien los orquesta es el cableado.
     */
    alPreparar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alPreparar: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.preparar.add(fn)
      return () => control._oyentes.preparar.delete(fn)
    },

    /**
     * Avisa de que han pulsado el ✕ **estando en modo pantalla**, o sea de que
     * quieren SALIRSE. En modo cajón este canal no dispara nunca: allí el ✕ cierra,
     * que es lo que dice, y quien quiera enterarse tiene {@link alCerrar}.
     */
    alSalir(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alSalir: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.salir.add(fn)
      return () => control._oyentes.salir.delete(fn)
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
      control._oyentes.salir.clear()
      control._oyentes.consultar.clear()
      control._oyentes.preparar.clear()
      control.remove()
    },
  }
}

export default crearCajonContrasteEdificio

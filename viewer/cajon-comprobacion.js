// viewer/cajon-comprobacion.js — F08 · El CAJÓN de la COMPROBACIÓN, sobre el mapa.
//
// ── QUÉ ES ESTE FICHERO, Y CUÁL ES SU SITIO EN EL RECORRIDO ─────────────────
// Es lo primero que el usuario ve después de soltar un `.gml` en la ventana:
// «esto es lo que traes, esto es lo que le pasa, ¿lo contrastamos con el
// parcelario o lo descartas?». Pinta el POJO `Comprobacion` que produce
// `comprobacion/gml.js` y ofrece exactamente DOS salidas.
//
// Espejo estructural de `viewer/cajon-diagnostico.js` (F07): mismo esqueleto de
// control de Leaflet, mismos estilos mínimos en línea, mismo desmontaje atómico.
// Lo que cambia es el contenido — y una decisión de comportamiento que se explica
// más abajo (el clic de fuera NO cierra).
//
// ── LA ESQUINA ES `bottomleft`, COMPARTIDA CON EL CAJÓN DE F07 ──────────────
// **Las cuatro esquinas del mapa ya estaban ocupadas** cuando llegó F08, y está
// medido y escrito en el JSDoc de `crearCajonDiagnostico`: `topleft` la barra de
// edición de F06, `topright` el control de capas, `bottomleft` el cajón de F07 y
// `bottomright` el control de opacidad **y** la atribución de Leaflet. El plan de
// F08 decía `topright` y estaba mal.
//
// ⚠️ Actualización del 2026-08-19: el control de opacidad se mudó a `topright`,
// apilado bajo el de capas, para dejar de chocar con la barra de edición. O sea
// que `bottomright` hoy solo tiene la atribución — pero `topright` sigue ocupada,
// y ahora por dos cosas. La conclusión de esta cabecera no cambia.
//
// ⚠️ Actualización del 2026-08-05: la barra de edición se fue de `topleft` al
// CENTRO del borde inferior, en una quinta esquina que `viewer/barra-edicion.js`
// le añade a Leaflet. Eso NO libera `topleft` —ahí sigue el control de zoom, que
// era con quien la barra se apilaba— y no cambia nada de lo de abajo: este cajón
// y el de F07 se siguen turnando en `bottomleft`. Lo que sí hay que saber es que
// el borde inferior ya no está vacío; que no se solapen no depende de la
// geometría sino del recorrido (con este cajón abierto, el paso «Edición» está
// bloqueado, así que la barra no está en pantalla). Medido en navegador.
//
// La decisión es compartir `bottomleft` con el cajón de diagnóstico, y que los dos
// sean **mutuamente excluyentes por diseño**. No es un apaño: es lo que el
// recorrido ya dice. La comprobación PRECEDE al diagnóstico y no coexiste con él
// —este cajón solo tiene dos salidas y las dos lo cierran—, así que compartir
// esquina hace VISIBLE esa exclusión en vez de esconderla, y no añade ni un
// control más al cromo del mapa. Si algún día hicieran falta a la vez, Leaflet los
// apila en vertical: legible, pero feo. Se prefiere que sea imposible.
//
// **Este módulo NO se coordina con el otro cajón**, y es deliberado: expone
// `abrir()`, `cerrar()` y `abierto()` —la misma terna que F07— para que el
// cableado de la aplicación pueda blindar la exclusión desde arriba, que es donde
// se sabe qué está pasando. Es la misma frontera que F07 trazó al decidir que
// filtrar la propia parcela de la lista de vecinas era del llamante.
//
// ── ESTE MÓDULO ES UNA VISTA, Y NADA MÁS ────────────────────────────────────
// Fabrica nodos, los rellena, los abre y los cierra. **No conoce el modelo, ni el
// store, ni la red, ni `comprobacion/gml.js`.** Recibe el POJO y lo pinta; quien
// lo calcula y quien lo cablea es la capa de aplicación. Por eso aquí no se
// importa NADA de `comprobacion/`, `gml/` ni `model/`: ni siquiera la tabla de
// etiquetas de dialecto, porque `Comprobacion.dialecto` ya viaja con su
// `etiqueta` y su `queSignifica` **redactados en español y presentables tal
// cual** — exactamente para que la vista no tenga su propia tabla de traducciones
// que se quede corta en silencio el día que aparezca un dialecto nuevo. Es la
// misma doctrina que `viewer/barra-edicion.js` y que el cajón de F07.
//
// ── LA REGLA DE ORO 9 ES EL REQUISITO PRINCIPAL DE ESTE FICHERO ─────────────
// «La aplicación mide; el colegiado interpreta y firma.» Y aquí pesa más que en
// ningún otro sitio del proyecto, porque este cajón habla sobre el trabajo de OTRO
// TÉCNICO: el GML lo escribió alguien, con otro programa, quizá hace dos años.
// Tres prohibiciones concretas:
//
//   1. **Ni una palabra de mérito.** Nada de «válido», «correcto», «apto»,
//      «conforme». Lo que se dice es qué trae el fichero y qué se ha medido.
//   2. **Ni una clase CSS de mérito.** Nada de `--ok`, `--error`, `--exito`. Las
//      nueve clases que este módulo pone son estructurales y están congeladas en
//      {@link CLASE}.
//   3. **Las severidades se pintan como severidades.** `INFO`, `AVISO` y `ERROR`
//      son el nivel de una detección —información sobre quién lo dice y con qué
//      fuerza—, no una nota puesta a la parcela. Van en texto, en el mismo gris
//      del resto del cromo, sin verde ni rojo. El ámbar de F07 aquí no aparece:
//      su única excepción autorizada es la invasión a colindante, y esa es del
//      diagnóstico.
//
// Y el corolario que hay que tener presente al leer el código: `bloqueos` NO es
// lo contrario de `puedeContinuar`. Un CP 3.0 trae un `DIALECTO_RECHAZADO` de
// nivel ERROR **y el recorrido sigue**. Por eso la sección de bloqueos lleva
// escrito, cuando trae algo, que ERROR es la severidad de la detección y no un
// veredicto — y por eso el botón primario puede estar ENCENDIDO con esa lista
// llena. Confundir las dos cosas convertiría el gate en una calificación.
//
// ── UN BOTÓN GRIS Y MUDO ES UN ERROR SILENCIOSO (regla de oro 1) ────────────
// El primario nace `disabled` ⟺ `!puedeContinuar`, y en ese
// mismo instante {@link crearCajonComprobacion} escribe `motivoNoContinua` en el
// renglón de estado. Nunca hay un botón apagado sin su porqué a la vista: el
// contrato de `comprobacion/gml.js` garantiza que ese motivo no puede ser `null`
// ni cadena vacía cuando `puedeContinuar` es `false`, y aquí se aprovecha.
//
// ── EL CLIC DE FUERA **NO** CIERRA ESTE CAJÓN (a diferencia del de F07) ─────
// Es la única desviación de comportamiento respecto del cajón de diagnóstico, y
// es a propósito. El de F07 es una ANOTACIÓN: se lee, se descarta y se vuelve a
// pedir con un clic en «Diagnosticar». Éste es una BIFURCACIÓN: sus dos salidas
// son decisiones con consecuencias —una dispara una petición al Catastro y
// escribe en el store, la otra tira a la basura el fichero que acaba de cargarse—
// y ninguna de las dos puede ocurrir por un gesto que significaba otra cosa. Un
// clic en el mapa para mirar dónde cae la parcela no puede hacer desaparecer el
// cajón con el fichero dentro: eso es una pérdida silenciosa. Tampoco `Escape`,
// por lo mismo. La salida está rotulada, es un `<button>` de verdad y se alcanza
// con el teclado.
//
// Consecuencia: aquí no hay oyentes en el `document`, y por tanto `onRemove` no
// tiene que retirarlos.
//
// ── `disableClickPropagation` / `disableScrollPropagation`: OBLIGATORIOS ────
// Sin ellos, pulsar dentro del cajón **seleccionaría un lindero por debajo**
// (gesto de F06, que sigue vivo) y la rueda sobre la lista de notas —que puede ser
// larga con un GML ajeno— haría zoom al mapa. Es el fallo clásico de un control de
// Leaflet; `viewer/capas.js`, `viewer/barra-edicion.js` y el cajón de F07 ya lo
// resuelven igual.
//
// Y el detalle de Leaflet que conviene conocer aunque aquí no haya guardián de
// clic fuera: `L.DomEvent.disableClickPropagation` **NO detiene el `click`**
// —detiene `mousedown`, `touchstart`, `dblclick` y `contextmenu`—, así que un clic
// en un botón de ESTE cajón SÍ llega burbujeando hasta `document`. Eso no es un
// problema: es justamente lo que hace que el oyente de clic-fuera del cajón de
// F07 lo cierre solo cuando el usuario empieza a operar en éste, que es la
// exclusión mutua que se busca. Lo que no se puede hacer nunca es «arreglarlo»
// con `stopPropagation`: dejaría sordo al panel de ayuda de la barra de edición y
// al propio cajón de diagnóstico.
//
// ── SOLO-NAVEGADOR ──────────────────────────────────────────────────────────
// Importa Leaflet ⇒ su test lleva sufijo `.dom` y este módulo NUNCA entra por el
// barrel raíz `index.js` (rompería la suite `node`). Tampoco importa ninguna hoja
// de estilo: el cromo fino lo viste la hoja de la aplicación, contra las clases
// congeladas de {@link CLASE}.

import L from 'leaflet'

import { resolverAvisar } from './_comun.js'

/** Esquinas válidas de un `L.Control`: las claves de `map._controlCorners`. */
const POSICIONES = ['topleft', 'topright', 'bottomleft', 'bottomright']

/**
 * Clases CSS del cajón. **Congeladas y son contrato**: la hoja de estilos de la
 * aplicación se escribe contra estos literales y los tests también, igual que
 * `viewer/cajon-diagnostico.js#CLASE` y `viewer/barra-edicion.js#CLASE_BARRA`.
 *
 * Las cuatro de la familia común —titular, sección, cifra y tabla— se REUTILIZAN
 * tal cual del cajón de F07 en vez de inventar equivalentes: dos familias para el
 * mismo papel divergen, y la que se queda vieja siempre es la nueva. Las cuatro
 * propias (`fichero`, `miembros`, `notas`, `bloqueos`) son las partes que este
 * cajón tiene y el otro no.
 *
 * Ninguna lleva juicio: no hay `--ok`, ni `--error`, ni `--exito`. Es la regla de
 * oro 9 aplicada al gancho de CSS, y no es paranoia — una clase de mérito es una
 * invitación escrita a pintar de rojo el fichero de otro técnico.
 *
 * @readonly
 */
export const CLASE = Object.freeze({
  CONTENEDOR: 'gml-cajon-comprobacion',
  TITULAR: 'gml-cajon-titular',
  SECCION: 'gml-cajon-seccion',
  CIFRA: 'gml-cajon-cifra',
  TABLA: 'gml-cajon-tabla',
  FICHERO: 'gml-cajon-fichero',
  MIEMBROS: 'gml-cajon-miembros',
  NOTAS: 'gml-cajon-notas',
  BLOQUEOS: 'gml-cajon-bloqueos',
})

/**
 * Los `data-*` que este módulo produce. **Son el CONTRATO con el cableado de la
 * aplicación**, que localiza los nodos POR SELECTOR y lanza si falta alguno —igual
 * que `app/main.js` con los del pie y con los de la barra de edición—. Renombrar
 * un valor aquí rompe ese módulo, no este fichero.
 *
 * Están exportados para que el cableado y sus tests no los escriban a mano: un
 * literal mal escrito en un `querySelector` devuelve `null` sin quejarse.
 *
 * ⚠️ `ESTADO` vale `cajon-comprobacion`, **nombrado por el COMPONENTE y no por la
 * acción**, y esto no es cosmética. Es la lección M8 de F07: allí
 * `[data-estado="diagnostico"]` iba a colisionar con el `[data-estado="diagnosticar"]`
 * del pie, y como `querySelector` se queda con el PRIMERO del documento —y el
 * `<aside>` va antes que el `<main>`— el renglón del cajón habría quedado
 * inalcanzable y mudo sin que nada lo dijera. Aquí el riesgo es idéntico: la
 * acción de este cajón es «contrastar», y la convención de la app es que el
 * renglón de una acción lleve el nombre de esa acción.
 *
 * Todos estos nodos EXISTEN SIEMPRE, también con el cajón cerrado y sin nada
 * pintado. Si solo aparecieran al pintar, el `nodo()` del cableado lanzaría al
 * arrancar.
 */
export const SELECTOR = Object.freeze({
  CONTRASTAR: '[data-accion="contrastar-parcelario"]',
  DESCARTAR: '[data-accion="descartar-comprobacion"]',
  ESTADO: '[data-estado="cajon-comprobacion"]',
  TITULAR: '[data-comp="titular"]',
  FICHERO: '[data-comp="fichero"]',
  QUE_SIGNIFICA: '[data-comp="que-significa"]',
  MIEMBROS: '[data-comp="miembros"]',
  DECLARADA: '[data-comp="superficie-declarada"]',
  MEDIDA: '[data-comp="superficie-medida"]',
  VERTICES: '[data-comp="vertices"]',
  SRS: '[data-comp="srs"]',
  ORIENTACION: '[data-comp="orientacion"]',
  HALLAZGOS: '[data-comp="hallazgos"]',
  HALLAZGOS_NOTA: '[data-comp="hallazgos-nota"]',
  NOTAS: '[data-comp="notas"]',
  BLOQUEOS: '[data-comp="bloqueos"]',
})

/**
 * El radio de una parcela de la lista. **Fuera de {@link SELECTOR} a propósito**:
 * los de ahí existen siempre, y éstos solo cuando el fichero trae MÁS DE UNA
 * parcela. Meterlo en la misma tabla obligaría a que el test del contrato de nodos
 * —que los recorre todos y exige que ninguno falte— tuviera una excepción escrita
 * a mano, que es como se pudren esas guardas.
 */
export const SELECTOR_MIEMBRO = '[data-comp="miembro"]'

/**
 * Lo que se escribe cuando un dato no consta. **No es un `—` a secas**: «no
 * consta» dice que el dato falta, mientras un guion se lee como «cero» o como
 * «nada que reseñar». Misma constante y mismo motivo que en el cajón de F07 y en
 * la ficha del pie de `app/main.js`.
 */
const NO_CONSTA = 'No consta'

/**
 * Lo que dice el renglón mientras no hay fichero: al nacer y después de
 * `pintar(null)`. El botón primario está apagado en los dos momentos y **tiene que
 * decir por qué**, aunque el cajón esté cerrado y no lo vea nadie: la alternativa
 * es un botón gris y mudo esperando a que alguien abra el cajón antes de pintar.
 */
const SIN_FICHERO = 'Todavía no se ha comprobado ningún fichero.'

const nf = (opciones) => new Intl.NumberFormat('es-ES', opciones)

/** Lo que la aplicación MIDE: dos decimales, que es lo que sabe medir. */
const FORMATO_MEDIDO = nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Lo que el FICHERO declara: hasta dos decimales, **sin forzar ninguno**. El
 * `cp:areaValue` del Catastro es un entero (override O6) y sale «1536»; un GML de
 * un tercero puede declarar «1535,87» y sale con sus dos cifras. Forzar dos
 * decimales le añadiría a la declarada una precisión que nadie ha afirmado, y
 * forzar cero borraría una que sí se afirmó.
 */
const FORMATO_DECLARADO = nf({ maximumFractionDigits: 2 })

/** Tamaños de fichero en kB: un decimal basta para un rótulo. */
const FORMATO_TAMANO = nf({ maximumFractionDigits: 1 })

const BYTES_POR_KB = 1024

const m2Medido = (v) =>
  v === null || v === undefined ? NO_CONSTA : `${FORMATO_MEDIDO.format(v)} m²`
const m2Declarado = (v) =>
  v === null || v === undefined ? NO_CONSTA : `${FORMATO_DECLARADO.format(v)} m²`

/**
 * El tamaño del fichero, presentable. Por debajo de 1 kB se dan los bytes: en un
 * GML de 800 bytes, «0,8 kB» esconde justamente lo llamativo del dato.
 */
function tamano(bytes) {
  if (bytes === null || bytes === undefined) return NO_CONSTA
  if (bytes < BYTES_POR_KB) return `${bytes} bytes`
  return `${FORMATO_TAMANO.format(bytes / BYTES_POR_KB)} kB`
}

/** Plural con su cifra delante: «1 vértice», «15 vértices». */
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

const crear = (doc, etiqueta, clase, texto) => {
  const el = doc.createElement(etiqueta)
  if (clase) el.className = clase
  if (texto !== undefined) el.textContent = texto
  return el
}

/**
 * Aplica estilos en línea propiedad a propiedad.
 *
 * **No se usa `style.cssText`, y no es una preferencia.** La guarda transversal de
 * `test/viewer/contrato-capas.dom.test.js` prohíbe esa subcadena en el código de
 * `viewer/` —es lo que garantiza que el visor sea consumible como LIBRERÍA, con
 * los estilos en la entrada de la aplicación— y además `cssText` PISA cualquier
 * estilo previo, propiedad a propiedad no. Es el mismo helper, con el mismo
 * razonamiento, que el cajón de F07.
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
 * ¿Sirve como mapa de Leaflet? DUCK TYPING deliberado, igual que
 * `viewer/capas.js#esMapa` y el gemelo del cajón de F07: se comprueba lo que de
 * verdad se usa.
 */
const esMapa = (m) =>
  !!m &&
  typeof m === 'object' &&
  typeof m.addControl === 'function' &&
  typeof m.removeControl === 'function' &&
  typeof m.getContainer === 'function'

// ── Estilos mínimos en línea, compartidos ────────────────────────────────────
//
// Este módulo no importa ninguna hoja, así que el cajón tiene que ser legible por
// sí solo (en `npm run dev` sin estilos, y en jsdom). El cromo fino es de la hoja
// de la aplicación. Mismo criterio que `viewer/capas.js`, `viewer/barra-edicion.js`
// y el cajón de F07.

const ESTILO_SECCION = { margin: '10px 0 0' }
const ESTILO_ROTULO_SECCION = {
  margin: '0 0 4px',
  fontSize: '12px',
  fontWeight: '600',
  color: '#0F172A',
}
const ESTILO_LISTA = { margin: '0', paddingLeft: '18px', fontSize: '12px' }
const ESTILO_APUNTE = { margin: '4px 0 0', fontSize: '11px', color: '#94A3B8' }

/**
 * El botón primario, encendido y apagado.
 *
 * Existe porque un estilo EN LÍNEA no puede expresar `:disabled`, y este módulo no
 * escribe reglas: sin esto, el botón apagado se vería exactamente igual que el
 * encendido mientras la hoja de la aplicación no esté cargada (`npm run dev` sin
 * estilos, jsdom, y el guion de navegador antes de que llegue el CSS). Un control
 * que parece pulsable y no lo es no se distingue de uno roto.
 *
 * El apagado va en el GRIS del cromo, no en rojo: la diferencia que se comunica es
 * «esto no se puede pulsar ahora», no «esto está mal» (regla de oro 9). El porqué
 * está escrito con palabras en el renglón de estado, que es donde se lee.
 */
const PRIMARIO = Object.freeze({
  // ⭐ `#0F172A` (casi negro) hasta la revisión de diseño del 2026-08-10. El
  // encargo del autor pide que «la acción principal de cada bloque lleve un solo
  // botón relleno con COLOR DE ACENTO», y el acento de la aplicación es el azul
  // del design system: `#0369A1` es `--color-btn-primary-bg`, el MISMO relleno que
  // usa `.gml-boton--primario` en el panel. Antes el pie de este cajón era la
  // única acción principal de la aplicación que no se veía como las demás.
  // ⚠️ Y NO es `#0284C7` (`--color-accent`): el design system separa a propósito
  // el acento de ENLACE del relleno de BOTÓN porque blanco sobre sky-600 no llega
  // a AA (4,10:1). Sobre `#0369A1` da 5,93:1.
  // ⚠️ Literal y no `var(--color-btn-primary-bg)` A PROPÓSITO: este módulo tiene
  // que verse bien SIN la hoja cargada (se monta en jsdom y sobre un mapa pelado),
  // y una variable sin declarar deja la propiedad en su valor inicial. Quien
  // cambie el acento tiene que cambiarlo aquí también; el guardián es el ojo y el
  // guion de humo, no la cascada.
  ENCENDIDO: Object.freeze({ background: '#0369A1', color: '#fff', cursor: 'pointer' }),
  APAGADO: Object.freeze({ background: '#E2E8F0', color: '#64748B', cursor: 'default' }),
})

// ── El control ───────────────────────────────────────────────────────────────

const CajonComprobacion = L.Control.extend({
  options: {
    position: 'bottomleft',
    etiqueta: 'Comprobación del fichero GML cargado',
  },

  initialize(opciones) {
    L.setOptions(this, opciones)
    this._abierto = false
    /** Índice de la parcela marcada. `null` mientras no se ha pintado nada. */
    this._elegido = null
    this._oyentes = { elegir: new Set(), contrastar: new Set(), descartar: new Set() }
  },

  onAdd(mapa) {
    const doc = mapa.getContainer().ownerDocument || document
    this._doc = doc
    // El sello de Leaflet da ids únicos aunque se monten dos cajones (dos mapas en
    // la misma página). Mismo recurso que `barra-edicion.js` y `capas.js`. Aquí
    // hace falta ADEMÁS para el `name` de los radios: dos grupos con el mismo
    // nombre en el mismo documento serían UN solo grupo, y marcar una parcela del
    // primer mapa desmarcaría la del segundo.
    const sello = L.Util.stamp(this)
    this._nombreGrupo = `gml-comprobacion-miembro-${sello}`
    const idEstado = `gml-comprobacion-estado-${sello}`

    const contenedor = crear(doc, 'section', CLASE.CONTENEDOR)
    this._contenedor = contenedor
    contenedor.setAttribute('aria-label', this.options.etiqueta)
    estilar(contenedor, {
      background: '#fff',
      padding: '10px 12px',
      borderRadius: '6px',
      boxShadow: '0 2px 10px rgba(15,23,42,.25)',
      font: '13px/1.45 system-ui,sans-serif',
      color: '#334155',
      maxWidth: 'min(420px,42vw)',
      maxHeight: '52vh',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      display: 'none',
    })

    // ── Cabecera: titular descriptivo ───────────────────────────────────────
    // Sin aspa. Las salidas de este cajón son DOS y están abajo, rotuladas: un
    // aspa sería una tercera puerta con el mismo `data-accion` que «Descartar»
    // (dos nodos para el mismo selector de valor exacto) o, peor, una salida sin
    // nombre para una decisión que sí lo tiene.
    const titular = crear(doc, 'h2', CLASE.TITULAR)
    titular.dataset.comp = 'titular'
    estilar(titular, { margin: '0', fontSize: '13px', fontWeight: '600', color: '#0F172A' })
    this._titular = titular

    // ── El fichero: nombre, tamaño y con qué se leyó ────────────────────────
    const fichero = crear(doc, 'p', CLASE.FICHERO)
    fichero.dataset.comp = 'fichero'
    estilar(fichero, { margin: '4px 0 0', fontSize: '12px', color: '#64748B' })
    this._fichero = fichero

    // ── Qué es: la explicación del dialecto, ya redactada por la capa pura ──
    const queSignifica = crear(doc, 'p')
    queSignifica.dataset.comp = 'que-significa'
    estilar(queSignifica, { margin: '6px 0 0', fontSize: '12px' })
    this._queSignifica = queSignifica

    // ── Las parcelas del fichero, con radios si hay más de una ──────────────
    // `<fieldset>`/`<legend>` y no un `<div>` con un `<p>`: es UNA elección entre
    // varias opciones excluyentes, que es literalmente lo que ese par de elementos
    // significa, y es lo que hace que un lector de pantalla anuncie el grupo antes
    // de la primera opción.
    const miembros = crear(doc, 'fieldset', `${CLASE.SECCION} ${CLASE.MIEMBROS}`)
    miembros.dataset.comp = 'miembros'
    estilar(miembros, { ...ESTILO_SECCION, border: '0', padding: '0', minWidth: '0' })
    const leyenda = crear(doc, 'legend', null, 'Parcelas del fichero')
    estilar(leyenda, { ...ESTILO_ROTULO_SECCION, padding: '0' })
    miembros.append(leyenda)
    this._miembros = miembros
    this._leyendaMiembros = leyenda

    // ── Las cifras de la parcela que se está comprobando ────────────────────
    const cifras = crear(doc, 'dl', CLASE.SECCION)
    estilar(cifras, {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: '2px 10px',
      ...ESTILO_SECCION,
      fontSize: '12px',
    })
    this._declarada = crear(doc, 'dd', CLASE.CIFRA)
    this._declarada.dataset.comp = 'superficie-declarada'
    this._medida = crear(doc, 'dd', CLASE.CIFRA)
    this._medida.dataset.comp = 'superficie-medida'
    this._vertices = crear(doc, 'dd', CLASE.CIFRA)
    this._vertices.dataset.comp = 'vertices'
    this._srs = crear(doc, 'dd', CLASE.CIFRA)
    this._srs.dataset.comp = 'srs'
    this._orientacion = crear(doc, 'dd', CLASE.CIFRA)
    this._orientacion.dataset.comp = 'orientacion'
    cifras.append(
      // «que declara el fichero», con todas las letras: NO es la superficie
      // catastral. En la tabla a tres bandas de F07 «catastral» es lo que declara
      // el PARCELARIO; ésta es lo que declara ESTE fichero sobre sus propias
      // coordenadas. Llamarlas igual sería atribuirle al Catastro el número de un
      // tercero, y el rótulo es la última defensa contra esa confusión.
      crear(doc, 'dt', null, 'Superficie que declara el fichero'),
      this._declarada,
      crear(doc, 'dt', null, 'Superficie medida sobre sus coordenadas'),
      this._medida,
      crear(doc, 'dt', null, 'Vértices'),
      this._vertices,
      crear(doc, 'dt', null, 'Sistema de referencia'),
      this._srs,
      crear(doc, 'dt', null, 'Sentido del contorno exterior'),
      this._orientacion,
    )
    for (const dd of [
      this._declarada,
      this._medida,
      this._vertices,
      this._srs,
      this._orientacion,
    ]) {
      estilar(dd, { margin: '0' })
    }

    // ── La geometría, con la validación completa de F02 ─────────────────────
    const bloqueHallazgos = crear(doc, 'div', CLASE.SECCION)
    estilar(bloqueHallazgos, ESTILO_SECCION)
    const rotuloHallazgos = crear(doc, 'p', null, 'Revisión de la geometría')
    estilar(rotuloHallazgos, ESTILO_ROTULO_SECCION)
    const notaHallazgos = crear(doc, 'p')
    notaHallazgos.dataset.comp = 'hallazgos-nota'
    estilar(notaHallazgos, { margin: '0', fontSize: '12px', color: '#64748B' })
    this._notaHallazgos = notaHallazgos
    // Caja VACÍA que existe siempre: la rellena `pintar`. Mismo patrón que la
    // tabla de cruces del cajón de F07.
    const tablaHallazgos = crear(doc, 'table', CLASE.TABLA)
    tablaHallazgos.dataset.comp = 'hallazgos'
    estilar(tablaHallazgos, {
      borderCollapse: 'collapse',
      marginTop: '4px',
      width: '100%',
      fontSize: '12px',
    })
    this._hallazgos = tablaHallazgos
    bloqueHallazgos.append(rotuloHallazgos, notaHallazgos, tablaHallazgos)

    // ── Notas (INFO y AVISO) ────────────────────────────────────────────────
    const notas = crear(doc, 'div', `${CLASE.SECCION} ${CLASE.NOTAS}`)
    notas.dataset.comp = 'notas'
    estilar(notas, ESTILO_SECCION)
    this._notas = notas

    // ── Detecciones de nivel ERROR ──────────────────────────────────────────
    const bloqueos = crear(doc, 'div', `${CLASE.SECCION} ${CLASE.BLOQUEOS}`)
    bloqueos.dataset.comp = 'bloqueos'
    estilar(bloqueos, ESTILO_SECCION)
    this._bloqueos = bloqueos

    // ── Las dos salidas ─────────────────────────────────────────────────────
    const pie = crear(doc, 'div')
    estilar(pie, { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' })

    // ⭐ **«Cargar la parcela elegida», y no «Contrastar con el parcelario»**
    // desde el 2026-08-07. El rótulo viejo describía el recorrido viejo, en el que
    // este cajón salía con CUALQUIER `.gml` y era el peaje obligatorio para que la
    // geometría llegara al store. Hoy el fichero entra solo y **este cajón solo se
    // abre cuando trae varias parcelas**, o sea cuando hay que elegir una: el botón
    // confirma la elección, y contrastar con el parcelario es lo que pasa después,
    // no lo que se pide. El `data-accion` NO cambia — es contrato con
    // `app/cableado-comprobacion.js` y con los guiones de humo, y renombrarlo de
    // paso sería romper por cosmética.
    const contrastar = crear(doc, 'button', null, 'Cargar la parcela elegida')
    contrastar.type = 'button'
    contrastar.dataset.accion = 'contrastar-parcelario'
    // El renglón de estado es donde se escribe POR QUÉ está apagado, así que se
    // enlaza: un lector de pantalla que anuncie el botón anuncia también el
    // motivo, sin que el usuario tenga que ir a buscarlo.
    contrastar.setAttribute('aria-describedby', idEstado)
    // NACE APAGADO: sin fichero no hay nada que contrastar. A partir de aquí lo
    // gobierna `pintar`, y nunca sin escribir el motivo en el renglón.
    contrastar.disabled = true
    // ⚠️ NI `font: 'inherit'` NI NINGUNA `fontFamily` AQUÍ, y es deliberado
    // (2026-07-30, corregido tras medirlo en el guion 10). Este botón llevaba el
    // atajo `font: 'inherit'`, que hereda el `font` EN LÍNEA del contenedor
    // —`13px/1.45 system-ui`— y, por ser inline, **gana a la hoja**: la regla
    // `.gml-cajon-comprobacion button` de `estilos/app.css` quedaba muerta y los
    // botones salían en `system-ui` mientras el resto del cajón iba en Geist.
    // Medido con `getComputedStyle` en navegador real, no deducido.
    // El reparto es: el módulo fija tamaño y grosor (para que sea legible sin
    // ninguna hoja, que es la doctrina de este fichero) y **la FAMILIA la pone la
    // hoja**, que es la única que sabe cuál es la del producto.
    estilar(contrastar, {
      border: '0',
      borderRadius: '6px',
      padding: '6px 12px',
      fontSize: 'inherit',
      lineHeight: 'inherit',
      fontWeight: '600',
      ...PRIMARIO.APAGADO,
    })
    this._contrastar = contrastar

    const descartar = crear(doc, 'button', null, 'Descartar')
    descartar.type = 'button'
    descartar.dataset.accion = 'descartar-comprobacion'
    // Sin `font: 'inherit'` ni `fontFamily`, por lo mismo que el primario.
    estilar(descartar, {
      border: '1px solid #E2E8F0',
      borderRadius: '6px',
      padding: '6px 12px',
      background: '#F1F5F9',
      color: '#0F172A',
      cursor: 'pointer',
      fontSize: 'inherit',
      lineHeight: 'inherit',
    })
    this._descartar = descartar

    pie.append(contrastar, descartar)

    // ── El renglón de estado ────────────────────────────────────────────────
    // `role="status"` para que el lector de pantalla lo anuncie SIN robar el foco,
    // igual que el de «Generar GML», el de la barra de edición y el del cajón de
    // F07: el usuario sigue con las manos donde estaba.
    const estado = crear(doc, 'p')
    estado.id = idEstado
    // `cajon-comprobacion`, no `contrastar`: ver el aviso de {@link SELECTOR}.
    estado.dataset.estado = 'cajon-comprobacion'
    estado.setAttribute('role', 'status')
    estilar(estado, { margin: '8px 0 0', fontSize: '12px', color: '#64748B', minHeight: '1em' })
    estado.textContent = SIN_FICHERO
    this._estado = estado

    contenedor.append(
      titular,
      fichero,
      queSignifica,
      miembros,
      cifras,
      bloqueHallazgos,
      notas,
      bloqueos,
      pie,
      estado,
    )

    // OBLIGATORIOS: sin ellos, pulsar dentro seleccionaría un lindero por debajo y
    // la rueda sobre la lista de notas haría zoom al mapa.
    L.DomEvent.disableClickPropagation(contenedor)
    L.DomEvent.disableScrollPropagation(contenedor)

    L.DomEvent.on(contrastar, 'click', this._alPulsarContrastar, this)
    L.DomEvent.on(descartar, 'click', this._alPulsarDescartar, this)
    // DELEGADO en el `<fieldset>`, que vive toda la vida del control, y no en cada
    // radio: los radios los fabrica `pintar` y desaparecen al repintar, así que
    // engancharlos uno a uno obligaría a desengancharlos antes de vaciar la lista
    // —y el día que alguien se olvidara, quedarían oyentes vivos sobre nodos
    // muertos sin que nada lo dijera.
    L.DomEvent.on(miembros, 'change', this._alCambiarMiembro, this)

    return contenedor
  },

  onRemove() {
    L.DomEvent.off(this._contrastar, 'click', this._alPulsarContrastar, this)
    L.DomEvent.off(this._descartar, 'click', this._alPulsarDescartar, this)
    L.DomEvent.off(this._miembros, 'change', this._alCambiarMiembro, this)
    this._abierto = false
  },

  // ── Apertura y cierre ─────────────────────────────────────────────────────

  _fijarAbierto(abierto) {
    if (this._abierto === abierto) return
    this._abierto = abierto
    if (this._contenedor) this._contenedor.style.display = abierto ? '' : 'none'
  },

  // ── Oyentes ───────────────────────────────────────────────────────────────

  /**
   * «Contrastar con el parcelario». **NO cierra el cajón**, y es deliberado: quien
   * escucha va a pedirle el parcelario al Catastro, y el renglón de estado de este
   * cajón es donde se cuenta esa espera («Trayendo el parcelario…») y dónde acaba
   * el aviso si la red falla. Cerrarlo aquí dejaría la petición corriendo sin
   * ninguna superficie donde informar de ella. Lo cierra el llamante, cuando ya
   * tiene algo que decir.
   */
  _alPulsarContrastar(evento) {
    // `L.DomEvent.stop` NO: pararle la propagación a este clic dejaría sordo a
    // cualquier otro oyente del documento —hoy, el guardián de clic-fuera del
    // cajón de F07, que es justamente el que hace visible la exclusión mutua—.
    // Ver la cabecera.
    for (const fn of this._oyentes.contrastar) fn(evento)
  },

  /**
   * «Descartar». **Sí cierra**, y por sí solo: es una decisión instantánea y sin
   * consecuencias que contar. Un botón cuyo efecto dependiera de que el llamante
   * se acuerde de cerrar sería un botón muerto el día que se le olvide.
   */
  _alPulsarDescartar(evento) {
    this._fijarAbierto(false)
    for (const fn of this._oyentes.descartar) fn(evento)
  },

  _alCambiarMiembro(evento) {
    const destino = evento && evento.target
    if (!destino || destino.dataset.comp !== 'miembro') return
    const indice = Number(destino.value)
    if (!Number.isInteger(indice)) return
    this._elegido = indice
    for (const fn of this._oyentes.elegir) fn(indice)
  },
})

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * El cajón de la comprobación como control de Leaflet.
 *
 * ```js
 * const cajon = crearCajonComprobacion({ mapa })
 * cajon.pintar(comprobarGml({ texto, nombreFichero }))
 * cajon.abrir()
 * cajon.alContrastar(() => traerParcelario(cajon.elegido()))
 * cajon.alElegir((i) => cajon.pintar(comprobarGml({ texto, nombreFichero, indiceElegido: i })))
 * ```
 *
 * @param {Object} opciones
 * @param {import('leaflet').Map} opciones.mapa  El mapa del visor.
 * @param {string} [opciones.posicion='bottomleft']  Esquina de Leaflet. El defecto
 *   **la comparte con el cajón de diagnóstico de F07**, y los dos son mutuamente
 *   excluyentes por diseño: ver la cabecera del módulo. Las otras tres esquinas
 *   están ocupadas (`topleft` el control de zoom, `topright` el de capas **y el de
 *   opacidad desde el 2026-08-19**, `bottomright` la atribución), y desde el
 *   2026-08-05 el centro del borde inferior lo ocupa la barra de edición.
 * @param {((mensaje: string, detalle?: object) => void)|null} [opciones.alAvisar]
 *   Canal de aviso (regla de oro 1). **Se acepta y hoy no se usa**, exactamente
 *   igual que en `viewer/barra-edicion.js` y en el cajón de F07: esta vista fabrica
 *   nodos y no habla con nadie, así que no tiene sucesos que contar; pero se
 *   RESUELVE —y por tanto se VALIDA la forma— para que quien pase basura donde va
 *   el canal se entere aquí y no tres módulos más allá. Es el patrón obligatorio
 *   del visor y no se salta ni cuando el canal está mudo.
 * @returns {{control: object, pintar: Function, abrir: Function, cerrar: Function,
 *   abierto: Function, elegido: Function, puedeContrastar: Function,
 *   estado: Function, alElegir: Function, alContrastar: Function,
 *   alDescartar: Function, destruir: Function}}
 * @throws {TypeError|RangeError} Contrato del programador.
 */
export function crearCajonComprobacion({ mapa, posicion = 'bottomleft', alAvisar } = {}) {
  if (!esMapa(mapa)) {
    throw new TypeError(
      `crearCajonComprobacion: 'mapa' debe ser un mapa de Leaflet (con addControl/` +
        `removeControl/getContainer); recibido ${JSON.stringify(mapa)}.`,
    )
  }
  if (typeof posicion !== 'string') {
    throw new TypeError(
      `crearCajonComprobacion: 'posicion' debe ser una cadena con una esquina de ` +
        `Leaflet; recibido ${typeof posicion}.`,
    )
  }
  if (!POSICIONES.includes(posicion)) {
    throw new RangeError(
      `crearCajonComprobacion: 'posicion' debe ser una esquina de Leaflet; recibido ` +
        `${JSON.stringify(posicion)}. Válidas: ${POSICIONES.join(', ')}.`,
    )
  }
  // Patrón obligatorio del visor: se resuelve (y se valida) aunque no se use.
  resolverAvisar(alAvisar)

  const control = new CajonComprobacion({ position: posicion })
  mapa.addControl(control)

  let destruido = false

  /** El miembro que se está comprobando, o `null` si el fichero no trae ninguno. */
  const elegidoDe = (c) =>
    c.elegido === null || c.miembros[c.elegido] === undefined ? null : c.miembros[c.elegido]

  /** Rótulo de una parcela: lo que arma la capa pura, más el recuento de nodos. */
  function rotularMiembro(m) {
    const huecos = m.nHuecos > 0 ? ` · ${plural(m.nHuecos, 'hueco', 'huecos')}` : ''
    return `${m.etiqueta} · ${plural(m.nVertices, 'vértice', 'vértices')}${huecos}`
  }

  /**
   * La lista de parcelas. **Radios solo cuando hay más de una**: un grupo de
   * elección de un solo elemento no es una elección, es un adorno que además
   * sugiere que se podría desmarcar. Con una sola se enuncia y ya está.
   */
  function pintarMiembros(c) {
    const doc = control._doc
    const caja = control._miembros
    // Se conserva la `<legend>`: es parte de la estructura, no del contenido.
    caja.replaceChildren(control._leyendaMiembros)

    if (c.miembros.length === 0) {
      const p = crear(
        doc,
        'p',
        null,
        'Este fichero no trae ninguna parcela dentro, así que no hay nada que elegir.',
      )
      estilar(p, { margin: '0', fontSize: '12px' })
      caja.append(p)
      return
    }

    if (c.miembros.length === 1) {
      const p = crear(doc, 'p', null, rotularMiembro(c.miembros[0]))
      estilar(p, { margin: '0', fontSize: '12px' })
      caja.append(p)
      return
    }

    const intro = crear(
      doc,
      'p',
      null,
      `El fichero trae ${c.miembros.length} parcelas y se comprueba UNA. Las demás se quedan ` +
        'en el fichero: un expediente lleva una sola parcela, y unirlas no es algo que esta ' +
        'aplicación haga.',
    )
    estilar(intro, { margin: '0 0 4px', fontSize: '12px', color: '#64748B' })
    caja.append(intro)

    for (const m of c.miembros) {
      const fila = crear(doc, 'div')
      estilar(fila, { display: 'flex', alignItems: 'baseline', gap: '6px', fontSize: '12px' })

      const id = `${control._nombreGrupo}-${m.indice}`
      const radio = crear(doc, 'input')
      radio.type = 'radio'
      radio.name = control._nombreGrupo
      radio.id = id
      radio.value = String(m.indice)
      radio.dataset.comp = 'miembro'
      radio.checked = m.indice === c.elegido
      estilar(radio, { flex: 'none', margin: '0' })

      const rotulo = crear(doc, 'label', null, rotularMiembro(m))
      rotulo.htmlFor = id
      estilar(rotulo, { cursor: 'pointer' })

      fila.append(radio, rotulo)
      caja.append(fila)
    }
  }

  /** Las cifras de la parcela que se comprueba. `null` en todas si no hay ninguna. */
  function pintarCifras(c) {
    const m = elegidoDe(c)
    if (m === null) {
      for (const el of [
        control._declarada,
        control._medida,
        control._vertices,
        control._srs,
        control._orientacion,
      ]) {
        el.textContent = NO_CONSTA
      }
      return
    }

    control._declarada.textContent = m2Declarado(m.superficieDeclarada)
    control._medida.textContent = m2Medido(m.superficieMedida)
    const huecos = m.nHuecos > 0 ? ` · ${plural(m.nHuecos, 'hueco', 'huecos')}` : ''
    control._vertices.textContent = `${m.nVertices}${huecos}`
    control._srs.textContent = m.srs === null ? NO_CONSTA : m.srs
    // C4, rotulada y nada más. El sentido del anillo es una CONVENCIÓN (override
    // O1, matizado): el WFS del Catastro emite horario y la plantilla oficial del
    // propio Catastro va antihoraria. Ninguno de los dos está mal, así que aquí se
    // dice cuál trae y se acabó.
    control._orientacion.textContent =
      m.orientacionExterior === -1
        ? 'Horario'
        : m.orientacionExterior === 1
          ? 'Antihorario'
          : NO_CONSTA
  }

  /**
   * La geometría revisada con F02.
   *
   * **`null` y `[]` se escriben distinto, y es media razón de ser de esta
   * sección**: `null` significa «no había geometría que validar» y `[]` significa
   * «se validó entera y no hay nada que contar». Un texto común para los dos
   * casos —o peor, una tabla vacía en silencio— haría pasar por revisado lo que no
   * se miró nunca. Es la misma disciplina que «no se ha consultado» ≠ «no hay
   * invasión» en el cajón de F07.
   */
  function pintarHallazgos(c) {
    const doc = control._doc
    const tabla = control._hallazgos
    tabla.replaceChildren()

    if (c.hallazgos === null) {
      control._notaHallazgos.textContent =
        'No se ha revisado ninguna geometría: en este fichero no hay ninguna con la que ' +
        'hacerlo. Lo de abajo no dice que esté todo en orden, dice que no se ha mirado.'
      return
    }

    if (c.hallazgos.length === 0) {
      control._notaHallazgos.textContent =
        'Se ha pasado por la revisión completa —autointersecciones, vértices duplicados, ' +
        'número mínimo de puntos y rango del huso— y no ha salido nada que contar.'
      return
    }

    control._notaHallazgos.textContent =
      `La revisión completa ha dado ${plural(c.hallazgos.length, 'resultado', 'resultados')}, ` +
      'con el nivel de cada uno delante. Nada de esto impide seguir: verlo es justamente para ' +
      'lo que se carga el fichero.'

    const tbody = crear(doc, 'tbody')
    for (const h of c.hallazgos) {
      const tr = crear(doc, 'tr')
      // El NIVEL en su propia celda y en texto: es información sobre la fuerza con
      // la que se afirma el hallazgo, no una nota puesta a la parcela. Sin color.
      const nivel = crear(doc, 'td', null, h.nivel)
      estilar(nivel, {
        padding: '2px 6px 2px 0',
        verticalAlign: 'top',
        whiteSpace: 'nowrap',
        fontWeight: '600',
        color: '#64748B',
      })
      const texto = h.correccion ? `${h.mensaje} — ${h.correccion}` : h.mensaje
      const cuantos =
        h.verticesAfectados && h.verticesAfectados.length > 0
          ? ` (${plural(h.verticesAfectados.length, 'vértice', 'vértices')})`
          : ''
      const mensaje = crear(doc, 'td', null, `${texto}${cuantos}`)
      estilar(mensaje, { padding: '2px 0', verticalAlign: 'top' })
      tr.append(nivel, mensaje)
      tbody.append(tr)
    }
    tabla.append(tbody)
  }

  /**
   * Una lista de detecciones con su severidad delante. Sirve a las dos secciones
   * —notas y bloqueos— porque las dos son eso: la partición por severidad de la
   * MISMA lista, hecha por `comprobacion/gml.js`.
   */
  function pintarDetecciones(caja, rotulo, detecciones, textoVacio, apunte) {
    const doc = control._doc
    caja.replaceChildren()

    const titulo = crear(doc, 'p', null, rotulo)
    estilar(titulo, ESTILO_ROTULO_SECCION)
    caja.append(titulo)

    if (detecciones.length === 0) {
      const p = crear(doc, 'p', null, textoVacio)
      estilar(p, { margin: '0', fontSize: '12px', color: '#64748B' })
      caja.append(p)
      return
    }

    const ul = crear(doc, 'ul')
    estilar(ul, ESTILO_LISTA)
    for (const d of detecciones) {
      const li = crear(doc, 'li')
      estilar(li, { marginBottom: '3px' })
      const severidad = crear(doc, 'span', null, d.severidad)
      // Sin color de mérito, aquí tampoco: el mismo gris del resto del cromo. Un
      // AVISO en ámbar y un ERROR en rojo estarían calificando el fichero de otro
      // técnico, que es exactamente la decisión que no nos toca.
      estilar(severidad, { fontWeight: '600', color: '#64748B', marginRight: '4px' })
      li.append(severidad, doc.createTextNode(d.mensaje))
      ul.append(li)
    }
    caja.append(ul)

    if (apunte) {
      const p = crear(doc, 'p', null, apunte)
      estilar(p, ESTILO_APUNTE)
      caja.append(p)
    }
  }

  /**
   * El botón primario y su porqué. `disabled` ⟺ `!puedeContinuar`, con
   * `motivoNoContinua` escrito en el renglón EN EL MISMO PASO: un botón gris y mudo
   * es un error silencioso (regla de oro 1), y separar las dos cosas es como se
   * llega a tenerlo.
   *
   * Cuando sí se puede continuar, el renglón se VACÍA. Es un repintado de un
   * fichero recién comprobado: dejar ahí el motivo de la comprobación anterior
   * —o el «Trayendo el parcelario…» de la vez pasada— sería peor que no decir nada.
   * Quien quiera escribir algo después, tiene {@link estado}.
   */
  function pintarGate(c) {
    apagarPrimario(!c.puedeContinuar)
    control._estado.textContent = c.puedeContinuar ? '' : c.motivoNoContinua
  }

  /** El `disabled` y su vestimenta, SIEMPRE juntos. Ver {@link PRIMARIO}. */
  function apagarPrimario(apagado) {
    control._contrastar.disabled = apagado
    estilar(control._contrastar, apagado ? PRIMARIO.APAGADO : PRIMARIO.ENCENDIDO)
  }

  return {
    control,

    /**
     * Pinta la comprobación. `null` deja el cajón en blanco (sin cerrarlo) y el
     * botón primario APAGADO: sin fichero no hay nada que contrastar.
     *
     * @param {object|null} c  Lo que devuelve `comprobacion/gml.js#comprobarGml`.
     */
    pintar(c) {
      if (destruido || !control._contenedor) return

      if (c === null || c === undefined) {
        control._titular.textContent = 'Sin fichero comprobado.'
        control._fichero.textContent = ''
        control._queSignifica.textContent = ''
        control._miembros.replaceChildren(control._leyendaMiembros)
        for (const el of [
          control._declarada,
          control._medida,
          control._vertices,
          control._srs,
          control._orientacion,
        ]) {
          el.textContent = NO_CONSTA
        }
        control._notaHallazgos.textContent = ''
        control._hallazgos.replaceChildren()
        control._notas.replaceChildren()
        control._bloqueos.replaceChildren()
        apagarPrimario(true)
        control._estado.textContent = SIN_FICHERO
        control._elegido = null
        return
      }

      control._elegido = c.elegido

      // El titular DICE QUÉ ES EL FICHERO, que es la primera pregunta del usuario
      // («¿esto qué es?»), y la `etiqueta` viene ya redactada de la capa pura.
      // Descriptivo, nunca un dictamen.
      control._titular.textContent = `Comprobación del fichero — ${c.dialecto.etiqueta}`

      const { nombre, bytes, encodingDeclarado, encodingUsado } = c.fichero
      const codificacion =
        encodingDeclarado === null && encodingUsado === null
          ? 'codificación: no consta'
          : encodingDeclarado === null
            ? `leído como «${encodingUsado}»; el fichero no declara codificación`
            : encodingUsado === null
              ? `declara «${encodingDeclarado}»; no consta con qué se ha leído`
              : `declara «${encodingDeclarado}», leído como «${encodingUsado}»`
      control._fichero.textContent = `${nombre} · ${tamano(bytes)} · ${codificacion}`

      control._queSignifica.textContent = c.dialecto.queSignifica

      pintarMiembros(c)
      pintarCifras(c)
      pintarHallazgos(c)

      pintarDetecciones(
        control._notas,
        'Notas',
        c.notas,
        'Ninguna nota.',
        null,
      )
      pintarDetecciones(
        control._bloqueos,
        'Detecciones de nivel ERROR',
        c.bloqueos,
        'Ninguna detección de nivel ERROR.',
        // ⚠️ Esta frase es la que impide que la sección se lea como un veredicto.
        // MEDIDO en F08: un CP 3.0 trae un `DIALECTO_RECHAZADO` de nivel ERROR y el
        // recorrido SIGUE, con el botón de abajo encendido. ERROR es la fuerza con
        // la que se afirma la detección; si la aplicación puede o no puede seguir
        // lo dice el botón, y solo el botón.
        'ERROR es la severidad de la detección, no una calificación de la parcela ni una ' +
          'puerta cerrada: si el recorrido puede seguir lo dice el botón de abajo.',
      )

      pintarGate(c)
    },

    /**
     * Abre el cajón.
     *
     * A diferencia del de F07, **no recibe el evento que lo abre**: aquí no hay
     * guardián de clic-fuera al que engañar, porque este cajón no se cierra
     * pinchando fuera (ver la cabecera). Un parámetro que no se usa es una promesa
     * de comportamiento que no existe.
     */
    abrir() {
      if (!destruido) control._fijarAbierto(true)
    },

    cerrar() {
      if (!destruido) control._fijarAbierto(false)
    },

    abierto() {
      return !destruido && control._abierto === true
    },

    /**
     * Índice de la parcela marcada, o `null` si no hay ninguna.
     *
     * Con una sola parcela **no hay radio** y esto devuelve igualmente su índice
     * (0): lo que se responde es «cuál se está comprobando», no «cuál ha marcado el
     * usuario». Devolver `null` ahí obligaría a todo llamante a distinguir dos
     * casos que para él son el mismo.
     */
    elegido() {
      if (destruido) return null
      return control._elegido
    },

    /**
     * ¿Está encendido el botón primario? Se expone para que el cableado y sus
     * pruebas no tengan que espiar el `disabled` de un nodo por selector, y para
     * que el guion de navegador pueda afirmarlo sin conocer el marcado.
     */
    puedeContrastar() {
      if (destruido || !control._contrastar) return false
      return control._contrastar.disabled === false
    },

    /**
     * Escribe el renglón de estado (`role="status"`).
     *
     * ⚠️ `pintar` también escribe ahí —el motivo de un botón apagado, o el vacío
     * cuando está encendido—, así que lo que se escriba aquí vale hasta el
     * siguiente repintado. Es el orden correcto: el motivo de un gate nuevo manda
     * sobre el mensaje de la operación anterior.
     */
    estado(texto) {
      if (!destruido && control._estado) control._estado.textContent = texto
    },

    /**
     * Se suscribe a la elección de parcela. Recibe el ÍNDICE. Devuelve la BAJA.
     * Varios oyentes, como `alColindantes` de F05: un `= fn` desengancharía al
     * primero en silencio.
     */
    alElegir(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alElegir: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.elegir.add(fn)
      return () => control._oyentes.elegir.delete(fn)
    },

    /** Se suscribe a «Contrastar con el parcelario». Devuelve la BAJA. */
    alContrastar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alContrastar: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.contrastar.add(fn)
      return () => control._oyentes.contrastar.delete(fn)
    },

    /** Se suscribe a «Descartar» (que además cierra el cajón). Devuelve la BAJA. */
    alDescartar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alDescartar: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      control._oyentes.descartar.add(fn)
      return () => control._oyentes.descartar.delete(fn)
    },

    /**
     * Quita el control del mapa —lo que dispara `onRemove` y con él la retirada de
     * los oyentes— y deja el módulo inerte. IDEMPOTENTE.
     */
    destruir() {
      if (destruido) return
      destruido = true
      control._oyentes.elegir.clear()
      control._oyentes.contrastar.clear()
      control._oyentes.descartar.clear()
      control.remove()
    },
  }
}

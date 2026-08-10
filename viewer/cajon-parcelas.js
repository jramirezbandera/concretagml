// viewer/cajon-parcelas.js — F22 · T3.1. ELEGIR CUÁL DE LAS N FINCAS ES LA TUYA.
//
// Un DXF de «Consulta Masiva» del Catastro trae la manzana entera. `parsers/`
// demuestra que son N fincas separadas y, cuando el fichero las rotula, sabe cómo
// se llaman. Este cajón es donde se elige una.
//
// ── POR QUÉ UN CAJÓN PROPIO Y NO EL DE F08 ──────────────────────────────────
//
// El plan de F22 dio por reutilizable `viewer/cajon-comprobacion.js`, que ya tiene
// una lista de radios para «el fichero trae varias parcelas». **Medir lo refutó el
// mismo día**, por dos motivos:
//
//   1. **No resalta nada.** Su `alElegir` recalcula y repinta EL CAJÓN; la
//      geometría no llega al mapa hasta pulsar el botón primario, que es el que
//      hace `estado.set`. O sea que la mitad que esta fase compró —ver dónde cae
//      cada candidata— no existía.
//   2. **Su `pintar(c)` está atado a la forma de una comprobación de GML**: lee
//      `c.dialecto.etiqueta`, `c.dialecto.queSignifica`, `c.fichero.encodingDeclarado`,
//      `c.hallazgos`, `c.notas`, `c.bloqueos` y un `pintarGate(c)`. Un DXF no tiene
//      dialecto ni codificación declarada, y fabricárselos para encajar en la
//      vista sería inventar datos para poder reutilizar código.
//
// Lo que sí se reutiliza es lo que de verdad es común: las clases CSS de la
// familia (`gml-cajon-titular`, `gml-cajon-seccion`), el reparto «el módulo pone
// tamaño y grosor, la HOJA pone la familia tipográfica» —con su trampa del
// `font: 'inherit'` medida en el guion 10—, y la doctrina de que un botón apagado
// **dice por qué** en un renglón de estado enlazado por `aria-describedby`.
//
// ── LA ESQUINA ──────────────────────────────────────────────────────────────
//
// `bottomleft`, que es la de los otros tres cajones (comprobación, diagnóstico y
// contraste de edificio). **Comparten sitio a propósito**: son cuatro caras del
// mismo hueco, no cuatro paneles. Quien abra éste tiene que cerrar el que hubiera,
// y lo hace el CABLEADO —igual que `app/cableado-comprobacion.js` cierra el de F07
// antes de abrir el suyo—, porque soltar un fichero no es un clic y el guardián de
// clic-fuera del otro cajón no se entera.
//
// ── LO QUE ESTE CAJÓN NO HACE ───────────────────────────────────────────────
//
// No dibuja. Ningún cajón de este visor dibuja: eso es `viewer/candidatas.js`.
// Y no decide: emite `alElegir(i)` y `alConfirmar()`, y quien mete la parcela en
// el store es `app/`.

import L from 'leaflet'

import { resolverAvisar } from './_comun.js'

/** Esquinas válidas de un `L.Control`: las claves de `map._controlCorners`. */
const POSICIONES = ['topleft', 'topright', 'bottomleft', 'bottomright']

/**
 * Clases CSS del cajón. **Congeladas y son contrato** con la hoja y con los tests.
 *
 * Las dos de la familia común —titular y sección— se REUTILIZAN tal cual de los
 * cajones de F07/F08 en vez de inventar equivalentes: dos familias para el mismo
 * papel divergen, y la que se queda vieja siempre es la nueva.
 *
 * Ninguna lleva juicio: no hay `--ok` ni `--error`. Regla de oro 9.
 *
 * @readonly
 */
export const CLASE = Object.freeze({
  CONTENEDOR: 'gml-cajon-parcelas',
  TITULAR: 'gml-cajon-titular',
  SECCION: 'gml-cajon-seccion',
  LISTA: 'gml-cajon-candidatas',
})

/**
 * Los `data-*` que este módulo produce. **Son el CONTRATO con el cableado**, que
 * localiza los nodos por selector y lanza si falta alguno.
 *
 * ⚠️ `ESTADO` vale `cajon-parcelas`, nombrado por el COMPONENTE y no por la
 * acción, por la lección M8 de F07: la acción de este cajón es «elegir», y si el
 * renglón se llamara `[data-estado="elegir"]` colisionaría con cualquier otro
 * `elegir` del documento — y `querySelector` se queda con el PRIMERO, que como el
 * `<aside>` va antes que el `<main>` dejaría el renglón mudo sin que nada lo
 * dijera.
 *
 * Todos estos nodos EXISTEN SIEMPRE, también con el cajón cerrado y sin pintar.
 */
export const SELECTOR = Object.freeze({
  CONFIRMAR: '[data-accion="cargar-parcela-elegida"]',
  DESCARTAR: '[data-accion="descartar-parcelas"]',
  ESTADO: '[data-estado="cajon-parcelas"]',
  TITULAR: '[data-comp="titular"]',
  FICHERO: '[data-comp="fichero"]',
  LISTA: '[data-comp="candidatas"]',
})

/**
 * El radio de una candidata. **Fuera de {@link SELECTOR} a propósito**: los de ahí
 * existen siempre y éstos solo cuando hay algo pintado. Meterlo en la misma tabla
 * obligaría al test del contrato de nodos a llevar una excepción escrita a mano,
 * que es como se pudren esas guardas.
 */
export const SELECTOR_CANDIDATA = '[data-comp="candidata"]'

/** Lo que dice el renglón al nacer y tras `pintar(null)`. */
export const SIN_FICHERO = 'Todavía no hay ningún dibujo con varias fincas que elegir.'

/** Lo que dice el renglón mientras no se ha marcado ninguna. */
export const SIN_ELEGIR = 'Marca la finca que es la de tu expediente para poder cargarla.'

/**
 * El titular. Descriptivo y sin dictamen: el fichero no está mal por traer la
 * manzana entera — es lo que ese servicio del Catastro sirve.
 */
export const TITULAR = 'El dibujo trae varias fincas'

/**
 * La explicación, que es la que evita que esto se lea como un error del usuario.
 * ⚠️ Dice **por qué** hay que elegir (un expediente lleva una parcela) y **qué
 * pasa con las demás** (se quedan como parcelario de contexto), porque «elige
 * una» a secas invita a pensar que se pierde el resto.
 */
export const EXPLICACION =
  'No es una parcela con patios: son fincas distintas, ninguna dentro de otra. Un expediente ' +
  'lleva una sola. Marca la tuya —se resalta en el mapa al marcarla— y las demás se quedan ' +
  'dibujadas alrededor como parcelario de contexto.'

const nf = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

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
 * **No se usa `style.cssText`**: la guarda transversal de
 * `test/viewer/contrato-capas.dom.test.js` prohíbe esa subcadena en `viewer/` —es
 * lo que garantiza que el visor sea consumible como librería— y además `cssText`
 * pisa cualquier estilo previo. Mismo helper y mismo razonamiento que los cajones
 * de F07 y F08.
 */
function estilar(el, estilos) {
  for (const [propiedad, valor] of Object.entries(estilos)) el.style[propiedad] = valor
  return el
}

/** Duck typing deliberado, igual que los otros cajones: se comprueba lo que se usa. */
const esMapa = (m) =>
  !!m &&
  typeof m === 'object' &&
  typeof m.addControl === 'function' &&
  typeof m.removeControl === 'function' &&
  typeof m.getContainer === 'function'

const ESTILO_SECCION = { margin: '10px 0 0' }

/**
 * El botón primario, encendido y apagado. Existe porque un estilo EN LÍNEA no
 * puede expresar `:disabled` y este módulo no escribe reglas: sin esto, el botón
 * apagado se vería igual que el encendido mientras la hoja no esté cargada
 * (`npm run dev` sin estilos, jsdom, y el guion antes de que llegue el CSS).
 *
 * El apagado va en GRIS y no en rojo: lo que se comunica es «esto no se puede
 * pulsar ahora», no «esto está mal» (regla de oro 9).
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

/**
 * El rótulo de una candidata en la lista.
 *
 * ⚠️ **Sin nombre no se inventa uno.** El fichero puede no traer rótulos, y
 * llamar «Parcela 3» a un recinto del que no sabemos el nombre afirma algo que
 * nadie ha dicho. Se enseña su sitio en la lista —empezando en **1**, que es como
 * cuenta el usuario— y lo que sí se ha medido. Mismo criterio, y mismo texto, que
 * `viewer/candidatas.js#textoEmergente`.
 *
 * @param {{nombre?: string|null, superficie?: number, nVertices?: number}} c
 * @param {number} orden  Posición en la lista, empezando en 1.
 * @returns {string}
 */
export function rotularCandidata(c, orden) {
  const nombre = c && typeof c.nombre === 'string' && c.nombre !== '' ? c.nombre : null
  const medida = `${nf.format(Number(c?.superficie) || 0)} m²`
  const vertices =
    Number.isInteger(c?.nVertices) ? ` · ${plural(c.nVertices, 'vértice', 'vértices')}` : ''
  return nombre === null
    ? `Recinto ${orden} · ${medida}${vertices}`
    : `${nombre} · ${medida}${vertices}`
}

// ── El control ───────────────────────────────────────────────────────────────

const CajonParcelas = L.Control.extend({
  options: { position: 'bottomleft', etiqueta: 'Elegir la finca del expediente' },

  initialize(opciones) {
    L.setOptions(this, opciones)
    this._abierto = false
    /** Índice marcado, o `null` si todavía no se ha marcado ninguna. */
    this._elegido = null
    this._oyentes = { elegir: new Set(), confirmar: new Set(), descartar: new Set() }
  },

  onAdd(mapa) {
    const doc = mapa.getContainer().ownerDocument || document
    this._doc = doc
    // El sello de Leaflet da ids únicos aunque se monten dos cajones (dos mapas en
    // la misma página). Aquí hace falta ADEMÁS para el `name` de los radios: dos
    // grupos con el mismo nombre en el mismo documento serían UN solo grupo, y
    // marcar una finca del primer mapa desmarcaría la del segundo.
    const sello = L.Util.stamp(this)
    this._nombreGrupo = `gml-candidata-${sello}`
    const idEstado = `gml-parcelas-estado-${sello}`

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

    // ── Cabecera ────────────────────────────────────────────────────────────
    // Sin aspa: las salidas son DOS y están abajo, rotuladas. Un aspa sería una
    // tercera puerta sin nombre para una decisión que sí lo tiene.
    const titular = crear(doc, 'h2', CLASE.TITULAR, TITULAR)
    titular.dataset.comp = 'titular'
    estilar(titular, { margin: '0', fontSize: '13px', fontWeight: '600', color: '#0F172A' })
    this._titular = titular

    const fichero = crear(doc, 'p')
    fichero.dataset.comp = 'fichero'
    estilar(fichero, { margin: '4px 0 0', fontSize: '12px', color: '#64748B' })
    this._fichero = fichero

    const explicacion = crear(doc, 'p', null, EXPLICACION)
    estilar(explicacion, { margin: '6px 0 0', fontSize: '12px' })

    // ── La lista ────────────────────────────────────────────────────────────
    // `<fieldset>`/`<legend>` y no un `<div>`: es UNA elección entre opciones
    // excluyentes, que es literalmente lo que ese par significa, y es lo que hace
    // que un lector de pantalla anuncie el grupo antes de la primera opción.
    const lista = crear(doc, 'fieldset', `${CLASE.SECCION} ${CLASE.LISTA}`)
    lista.dataset.comp = 'candidatas'
    estilar(lista, { ...ESTILO_SECCION, border: '0', padding: '0', minWidth: '0' })
    const leyenda = crear(doc, 'legend', null, 'Fincas del dibujo')
    estilar(leyenda, { margin: '0 0 4px', fontSize: '12px', fontWeight: '600', color: '#0F172A', padding: '0' })
    lista.append(leyenda)
    this._lista = lista
    this._leyenda = leyenda

    // ── Las dos salidas ─────────────────────────────────────────────────────
    const pie = crear(doc, 'div')
    estilar(pie, { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px' })

    const confirmar = crear(doc, 'button', null, 'Cargar la finca elegida')
    confirmar.type = 'button'
    confirmar.dataset.accion = 'cargar-parcela-elegida'
    // El renglón dice POR QUÉ está apagado, así que se enlaza: un lector de
    // pantalla que anuncie el botón anuncia también el motivo.
    confirmar.setAttribute('aria-describedby', idEstado)
    confirmar.disabled = true // nace apagado: no hay nada marcado.
    // ⚠️ NI `font: 'inherit'` NI NINGUNA `fontFamily`, y es deliberado: ese atajo
    // hereda el `font` EN LÍNEA del contenedor y, por ser inline, GANA a la hoja,
    // dejando muerta su regla y el botón en `system-ui` mientras el resto del
    // cajón va en la tipografía del producto. Medido en navegador real en el
    // guion 10 y corregido en el cajón de F08; aquí se evita de origen. El
    // reparto es: el módulo fija tamaño y grosor, la HOJA pone la familia.
    estilar(confirmar, {
      border: '0',
      borderRadius: '6px',
      padding: '6px 12px',
      fontSize: 'inherit',
      lineHeight: 'inherit',
      fontWeight: '600',
      ...PRIMARIO.APAGADO,
    })
    this._confirmar = confirmar

    const descartar = crear(doc, 'button', null, 'Descartar el dibujo')
    descartar.type = 'button'
    descartar.dataset.accion = 'descartar-parcelas'
    estilar(descartar, {
      border: '1px solid #E2E8F0',
      background: '#F1F5F9',
      color: '#0F172A',
      borderRadius: '6px',
      padding: '6px 12px',
      fontSize: 'inherit',
      lineHeight: 'inherit',
      cursor: 'pointer',
    })
    this._descartar = descartar

    pie.append(confirmar, descartar)

    // ── El renglón de estado ────────────────────────────────────────────────
    const estado = crear(doc, 'p', null, SIN_FICHERO)
    estado.id = idEstado
    estado.dataset.estado = 'cajon-parcelas'
    estado.setAttribute('role', 'status')
    estilar(estado, { margin: '8px 0 0', fontSize: '12px', color: '#64748B', minHeight: '1em' })
    this._estado = estado

    contenedor.append(titular, fichero, explicacion, lista, pie, estado)

    // OBLIGATORIOS: sin ellos, pulsar dentro seleccionaría una finca por debajo y
    // la rueda sobre la lista haría zoom al mapa.
    L.DomEvent.disableClickPropagation(contenedor)
    L.DomEvent.disableScrollPropagation(contenedor)

    L.DomEvent.on(confirmar, 'click', this._alPulsarConfirmar, this)
    L.DomEvent.on(descartar, 'click', this._alPulsarDescartar, this)
    // DELEGADO en el `<fieldset>`, que vive toda la vida del control, y no en cada
    // radio: los radios los fabrica `pintar` y desaparecen al repintar, así que
    // engancharlos uno a uno dejaría oyentes vivos sobre nodos muertos el día que
    // alguien se olvide de desengancharlos.
    L.DomEvent.on(lista, 'change', this._alCambiarCandidata, this)

    return contenedor
  },

  onRemove() {
    L.DomEvent.off(this._confirmar, 'click', this._alPulsarConfirmar, this)
    L.DomEvent.off(this._descartar, 'click', this._alPulsarDescartar, this)
    L.DomEvent.off(this._lista, 'change', this._alCambiarCandidata, this)
    this._abierto = false
  },

  _fijarAbierto(abierto) {
    if (this._abierto === abierto) return
    this._abierto = abierto
    if (this._contenedor) this._contenedor.style.display = abierto ? '' : 'none'
  },

  /**
   * «Cargar la finca elegida». **NO cierra el cajón**, por el mismo motivo que su
   * gemelo de F08: quien escucha va a meter la parcela en el store y puede querer
   * contar algo en este renglón. Lo cierra el llamante cuando ya tiene qué decir.
   */
  _alPulsarConfirmar(evento) {
    // `L.DomEvent.stop` NO: pararle la propagación a este clic dejaría sordo al
    // guardián de clic-fuera del cajón de F07, que es el que hace visible la
    // exclusión mutua entre los cuatro cajones de esta esquina.
    if (this._elegido === null) return
    for (const fn of this._oyentes.confirmar) fn(this._elegido, evento)
  },

  /** «Descartar». Sí cierra, y por sí solo: decisión instantánea y sin nada que contar. */
  _alPulsarDescartar(evento) {
    this._fijarAbierto(false)
    for (const fn of this._oyentes.descartar) fn(evento)
  },

  _alCambiarCandidata(evento) {
    const destino = evento && evento.target
    if (!destino || destino.dataset.comp !== 'candidata') return
    const indice = Number(destino.value)
    if (!Number.isInteger(indice)) return
    this._marcar(indice)
    for (const fn of this._oyentes.elegir) fn(indice)
  },

  /**
   * Deja marcada la candidata `indice` **sin avisar a nadie**. Es la mitad que
   * comparten el clic en el radio y el clic en el mapa: sin ella, señalar en el
   * mapa dejaría el radio sin marcar y la pantalla diría dos cosas distintas.
   */
  _marcar(indice) {
    this._elegido = indice
    if (this._estado) this._estado.textContent = ''
    if (this._confirmar) {
      this._confirmar.disabled = false
      estilar(this._confirmar, PRIMARIO.ENCENDIDO)
    }
    if (!this._lista) return
    for (const radio of this._lista.querySelectorAll(SELECTOR_CANDIDATA)) {
      radio.checked = Number(radio.value) === indice
    }
  },
})

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Crea el cajón de elección de finca y lo añade al mapa.
 *
 * @param {object} opciones
 * @param {object} opciones.mapa  `L.Map`.
 * @param {string} [opciones.posicion='bottomleft']  Esquina de Leaflet. La comparte
 *   con los otros tres cajones a propósito; ver la cabecera.
 * @param {Function} [opciones.alAvisar]
 * @returns {object}  `{pintar, marcar, elegida, abrir, cerrar, estado, alElegir,
 *   alConfirmar, alDescartar, destruir}`
 * @throws {TypeError|RangeError}  Contratos del programador.
 */
export function crearCajonParcelas({ mapa, posicion = 'bottomleft', alAvisar } = {}) {
  if (!esMapa(mapa)) {
    throw new TypeError(
      `crearCajonParcelas: 'mapa' debe ser un mapa de Leaflet (con addControl/removeControl/` +
        `getContainer); recibido ${JSON.stringify(mapa)}.`,
    )
  }
  if (typeof posicion !== 'string') {
    throw new TypeError(
      `crearCajonParcelas: 'posicion' debe ser una cadena con una esquina de Leaflet; ` +
        `recibido ${typeof posicion}.`,
    )
  }
  if (!POSICIONES.includes(posicion)) {
    throw new RangeError(
      `crearCajonParcelas: 'posicion' debe ser una esquina de Leaflet; recibido ` +
        `${JSON.stringify(posicion)}. Válidas: ${POSICIONES.join(', ')}.`,
    )
  }
  // Patrón obligatorio del visor: se resuelve (y se valida) aunque no se use.
  resolverAvisar(alAvisar)

  const control = new CajonParcelas({ position: posicion })
  mapa.addControl(control)

  let destruido = false

  function apagarPrimario(apagado) {
    control._confirmar.disabled = apagado
    estilar(control._confirmar, apagado ? PRIMARIO.APAGADO : PRIMARIO.ENCENDIDO)
  }

  return {
    /**
     * Pinta la lista de candidatas.
     *
     * @param {{nombre: string, candidatas: Array<object>, capaRotulos?: string|null}|null} datos
     *   `null` ⇒ vacía el cajón y lo deja como al nacer. `candidatas` son los
     *   `datos.recintos` de la detección `VARIOS_RECINTOS_DISJUNTOS` de
     *   `parsers/importar.js`, tal cual: **no se remide nada aquí**, porque dos
     *   medidas del mismo anillo acaban enseñando dos cifras.
     * @returns {void}
     */
    pintar(datos) {
      if (destruido || !control._contenedor) return

      const doc = control._doc
      control._lista.replaceChildren(control._leyenda)
      control._elegido = null

      if (datos === null || datos === undefined) {
        control._fichero.textContent = ''
        control._estado.textContent = SIN_FICHERO
        apagarPrimario(true)
        return
      }

      const candidatas = Array.isArray(datos.candidatas) ? datos.candidatas : []
      control._fichero.textContent =
        `${datos.nombre ?? 'fichero sin nombre'} · ` +
        `${plural(candidatas.length, 'finca', 'fincas')}` +
        (datos.capaRotulos
          ? ` · nombres de la capa «${datos.capaRotulos}»`
          : ' · el dibujo no las nombra')

      candidatas.forEach((c, i) => {
        const fila = crear(doc, 'div')
        estilar(fila, { display: 'flex', alignItems: 'baseline', gap: '6px', fontSize: '12px' })

        const id = `${control._nombreGrupo}-${i}`
        const radio = crear(doc, 'input')
        radio.type = 'radio'
        radio.name = control._nombreGrupo
        radio.id = id
        radio.value = String(i)
        radio.dataset.comp = 'candidata'
        estilar(radio, { flex: 'none', margin: '0' })

        const rotulo = crear(doc, 'label', null, rotularCandidata(c, i + 1))
        rotulo.htmlFor = id
        estilar(rotulo, { cursor: 'pointer' })

        fila.append(radio, rotulo)
        control._lista.append(fila)
      })

      // NACE SIN NINGUNA MARCADA, y es deliberado: marcar una por defecto —la
      // primera, la mayor— es elegir por el usuario en la única pantalla que
      // existe porque la aplicación NO puede elegir. Un descuido y se firma la
      // finca del vecino.
      apagarPrimario(true)
      control._estado.textContent = candidatas.length === 0 ? SIN_FICHERO : SIN_ELEGIR
    },

    /**
     * Marca una candidata desde fuera (el clic en el mapa) **sin volver a
     * avisar**: quien llama ya sabe cuál es, y reemitir `alElegir` desde aquí
     * cerraría el bucle mapa → cajón → mapa.
     *
     * @param {number} indice
     */
    marcar(indice) {
      if (destruido || !Number.isInteger(indice)) return
      control._marcar(indice)
    },

    /** La candidata marcada, o `null`. */
    elegida: () => (destruido ? null : control._elegido),

    /**
     * El trozo de pantalla que este cajón ocupa, o `null` si está cerrado.
     *
     * ⛔ **Existe porque el guion 24 midió que el cajón tapaba CINCO de las ocho
     * fincas al 100 %.** El encuadre las metía a todas en el mapa —eso ya estaba
     * medido— y el cajón se ponía encima de la mitad: la pantalla pedía elegir
     * entre ocho con cinco debajo del panel que hace la pregunta. Quien encuadra
     * necesita saber qué sitio no está libre, y el único que sabe cuánto ocupa
     * este cajón —y en qué esquina— es él.
     *
     * Se devuelve el `DOMRect` tal cual, en coordenadas de ventana, que es lo
     * mismo que devuelve el contenedor del mapa: compararlos es restar.
     *
     * @returns {DOMRect|null}
     */
    caja() {
      if (destruido || !control._contenedor || !control._abierto) return null
      const r = control._contenedor.getBoundingClientRect()
      return r.width > 0 && r.height > 0 ? r : null
    },

    abrir() {
      if (!destruido) control._fijarAbierto(true)
    },

    cerrar() {
      if (!destruido) control._fijarAbierto(false)
    },

    /** Escribe el renglón de estado. Es donde se cuenta lo que tarda o lo que falla. */
    estado(texto) {
      if (!destruido && control._estado) control._estado.textContent = String(texto ?? '')
    },

    /** Se suscribe a «el usuario ha marcado la candidata i». Devuelve la baja. */
    alElegir(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alElegir: se esperaba una función; recibido ${typeof fn}.`)
      }
      control._oyentes.elegir.add(fn)
      return () => control._oyentes.elegir.delete(fn)
    },

    /** Se suscribe al botón primario. Recibe el índice elegido. Devuelve la baja. */
    alConfirmar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alConfirmar: se esperaba una función; recibido ${typeof fn}.`)
      }
      control._oyentes.confirmar.add(fn)
      return () => control._oyentes.confirmar.delete(fn)
    },

    /** Se suscribe a «Descartar». Devuelve la baja. */
    alDescartar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alDescartar: se esperaba una función; recibido ${typeof fn}.`)
      }
      control._oyentes.descartar.add(fn)
      return () => control._oyentes.descartar.delete(fn)
    },

    /** Quita el control del mapa —lo que dispara `onRemove`— y suelta los oyentes. */
    destruir() {
      if (destruido) return
      destruido = true
      try {
        mapa.removeControl(control)
      } catch {
        // Idempotente, como el resto del desmontaje del visor.
      }
      control._oyentes.elegir.clear()
      control._oyentes.confirmar.clear()
      control._oyentes.descartar.clear()
    },
  }
}

export default crearCajonParcelas

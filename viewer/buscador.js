// viewer/buscador.js — EL BUSCADOR DEL MAPA: se escribe una dirección, un
// municipio o una referencia, y el mapa va allí.
//
// ── POR QUÉ EXISTE (revisión de diseño, 2026-09-25) ──────────────────────────
// La aplicación arranca mirando a España entera y la bienvenida pide «busca tu
// parcela en el mapa y pínchala». Hasta hoy «buscar» era acercarse a mano desde un
// mapa donde un píxel son ~1,5 km: unos catorce saltos de rueda antes de ver una
// sola parcela. Este control es el camino corto, y está en el MAPA porque es ahí
// donde la bienvenida dice que se busca.
//
// ── ESTE MÓDULO ES UNA VISTA Y NO SABE DE CARTOCIUDAD ────────────────────────
// No hace ni una petición. Recibe `buscar(texto, {senal})` y `situar(lugar,
// {senal})` —los de `services/cartociudad.js`, que es quien habla con la red— y
// mueve el mapa con lo que le devuelven. Qué pasa DESPUÉS de moverlo (cerrar la
// bienvenida, deducir la referencia en la rama Parcela) no es de la vista: se lo
// dice a la aplicación por `alElegir`. Así se prueba con un mapa pelado y dos
// funciones de mentira.
//
// ── EL PATRÓN, Y POR QUÉ ÉSTE ────────────────────────────────────────────────
// Un «combobox» con lista (WAI-ARIA APG): el campo lleva `role="combobox"`,
// `aria-expanded` y `aria-activedescendant`; la lista, `role="listbox"`. Las
// flechas mueven la opción activa SIN sacar el foco del campo, `Intro` elige y
// `Escape` cierra. No es gusto: es el único patrón en el que un lector de pantalla
// anuncia las opciones mientras se sigue escribiendo.
//
// ── LAS DOS CARRERAS QUE ESTO TIENE QUE GANAR ────────────────────────────────
//   1. **Teclear rápido.** Cada tecla reprograma la búsqueda ({@link ESPERA_MS});
//      solo pregunta la última. El temporizador se INYECTA (`programar`), igual
//      que `services/_red.js` inyecta la espera: el repo no usa relojes falsos.
//   2. **La respuesta vieja que llega tarde.** Cada búsqueda aborta la anterior y
//      lleva su ficha; una respuesta cuya ficha ya no es la vigente no pinta nada.
//      Es el mismo token anti-carrera de `viewer/wms-catastro.js`.
//
// ── `disableClickPropagation` / `disableScrollPropagation`: OBLIGATORIOS ─────
// Mismo motivo que la leyenda y la barra de edición, y aquí con un agravante: un
// clic que atravesara el buscador llegaría al mapa, y el clic en el mapa es la
// geocodificación inversa del Catastro. Elegir un resultado con el ratón acabaría
// preguntando por la parcela que hay DEBAJO de la lista.
//
// ── EL ESTILO EN LÍNEA ES EL MÍNIMO PARA LEERSE SIN HOJA ─────────────────────
// Zona 3 de DESIGN.md §2: tamaños, colores y cajas van aquí; la FAMILIA la pone
// `estilos/app.css`, en la misma regla que viste la leyenda. Ni `font-family` ni
// `font: inherit` en línea: ganarían a la hoja y dejarían el buscador en la letra
// del sistema.

import L from 'leaflet'

import { MOTIVO_RED } from '../services/_red.js'

import { resolverAvisar } from './_comun.js'

/** Clases: son contrato para la hoja y para los guiones de humo. */
export const CLASE = Object.freeze({
  CONTENEDOR: 'gml-buscador',
  CAMPO: 'gml-buscador-campo',
  LISTA: 'gml-buscador-lista',
  OPCION: 'gml-buscador-opcion',
  ESTADO: 'gml-buscador-estado',
  ATRIBUCION: 'gml-buscador-atribucion',
})

/** Selectores por `data-*`, para no depender de la clase en las pruebas. */
export const SELECTOR = Object.freeze({
  CAMPO: '[data-buscador="campo"]',
  LISTA: '[data-buscador="lista"]',
  OPCION: '[data-buscador="opcion"]',
  ESTADO: '[data-buscador="estado"]',
  ATRIBUCION: '[data-buscador="atribucion"]',
})

/**
 * Milisegundos entre la última tecla y la pregunta. 300 es lo que tarda una
 * persona en decidir si ha terminado de escribir una palabra: menos pregunta por
 * cada letra de «alhaurín», más se nota como una espera.
 */
export const ESPERA_MS = 300

/**
 * Zoom al que se lleva un PORTAL o una referencia. Tiene que quedar por debajo de
 * los 2 m/px con los que `app/cableado-catastro.js` deja pinchar una parcela
 * (`METROS_POR_PIXEL_MAXIMO`); a 19 son ~0,2 m/px en toda la Península, o sea que
 * la parcela se ve entera y se puede señalar.
 */
export const ZOOM_PUNTO = 19

/** Zoom de una zona sin caja (un código postal es un POINT, medido). */
export const ZOOM_ZONA_SIN_CAJA = 15

/**
 * Tope al encuadrar una caja. Sin él, una calle corta de un pueblo encuadraría a
 * zoom 20 y se vería una acera; con 18 se ve la calle con sus parcelas a los lados.
 */
export const ZOOM_MAXIMO_CAJA = 18

const TEXTO = Object.freeze({
  ETIQUETA: 'Buscar en el mapa una dirección, un municipio o una referencia catastral',
  MARCADOR: 'Dirección, municipio o referencia',
  LISTA: 'Lugares encontrados',
  BUSCANDO: 'Buscando…',
  sinResultados: (q) => `No se encuentra nada con «${q}». Prueba con menos palabras.`,
  situando: (rotulo) => `Llevando el mapa a ${rotulo}…`,
})

/** Colores en línea: los mismos valores que los tokens de la hoja, legibles sin ella. */
const COLOR = Object.freeze({
  TEXTO: '#0F172A',
  SECUNDARIO: '#475569',
  FILO: '#CBD5E1',
  ACTIVA: '#F1F5F9',
  ACENTO: '#0369A1',
})

/** Esquinas válidas de un `L.Control`. */
const POSICIONES = ['topleft', 'topright', 'bottomleft', 'bottomright']

const crear = (doc, etiqueta, clase, texto) => {
  const el = doc.createElement(etiqueta)
  if (clase) el.className = clase
  if (texto !== undefined) el.textContent = texto
  return el
}

/**
 * Estilos en línea propiedad a propiedad. No se usa el atajo de texto del objeto
 * `style`: su nombre contiene la subcadena que la guarda de `viewer/` prohíbe (ver
 * `viewer/leyenda.js#estilar`).
 */
function estilar(el, estilos) {
  for (const [propiedad, valor] of Object.entries(estilos)) el.style[propiedad] = valor
  return el
}

/** El temporizador por defecto: devuelve con qué cancelarlo. */
function programarConTemporizador(fn, ms) {
  const id = setTimeout(fn, ms)
  return () => clearTimeout(id)
}

const esMapa = (m) =>
  !!m &&
  typeof m.addControl === 'function' &&
  typeof m.removeControl === 'function' &&
  typeof m.getContainer === 'function' &&
  typeof m.setView === 'function' &&
  typeof m.fitBounds === 'function'

const ControlBuscador = L.Control.extend({
  options: { position: 'topleft' },

  onAdd(mapa) {
    const doc = mapa.getContainer().ownerDocument || document
    const sello = L.Util.stamp(this)
    const idLista = `gml-buscador-lista-${sello}`

    // `<form role="search">`: es un hito de búsqueda de verdad, y quien navega por
    // hitos llega aquí de un salto. El `submit` se anula: no hay a dónde enviarlo.
    const contenedor = crear(doc, 'form', CLASE.CONTENEDOR)
    contenedor.setAttribute('role', 'search')
    contenedor.setAttribute('aria-label', 'Buscar en el mapa')
    contenedor.noValidate = true
    estilar(contenedor, {
      boxSizing: 'border-box',
      width: 'min(300px, 55vw)',
      padding: '4px',
      background: '#ffffff',
      borderRadius: '6px',
      boxShadow: '0 1px 4px rgba(15,23,42,.3)',
      color: COLOR.TEXTO,
      fontSize: '12px',
      lineHeight: '1.35',
    })

    const campo = crear(doc, 'input', CLASE.CAMPO)
    campo.type = 'search'
    campo.dataset.buscador = 'campo'
    campo.setAttribute('role', 'combobox')
    campo.setAttribute('aria-autocomplete', 'list')
    campo.setAttribute('aria-expanded', 'false')
    campo.setAttribute('aria-controls', idLista)
    campo.setAttribute('aria-label', TEXTO.ETIQUETA)
    campo.placeholder = TEXTO.MARCADOR
    campo.autocomplete = 'off'
    campo.spellcheck = false
    estilar(campo, {
      boxSizing: 'border-box',
      width: '100%',
      margin: '0',
      padding: '6px 8px',
      border: `1px solid ${COLOR.FILO}`,
      borderRadius: '4px',
      background: '#ffffff',
      color: COLOR.TEXTO,
      fontSize: '13px',
    })

    const lista = crear(doc, 'ul', CLASE.LISTA)
    lista.id = idLista
    lista.dataset.buscador = 'lista'
    lista.setAttribute('role', 'listbox')
    lista.setAttribute('aria-label', TEXTO.LISTA)
    estilar(lista, {
      display: 'none',
      margin: '4px 0 0',
      padding: '0',
      listStyle: 'none',
      maxHeight: 'min(50vh, 320px)',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
    })

    const estado = crear(doc, 'p', CLASE.ESTADO)
    estado.dataset.buscador = 'estado'
    estado.setAttribute('role', 'status')
    estilar(estado, { display: 'none', margin: '4px 4px 2px', color: COLOR.SECUNDARIO, fontSize: '11px' })

    const atribucion = crear(doc, 'p', CLASE.ATRIBUCION, this.options.atribucion)
    atribucion.dataset.buscador = 'atribucion'
    estilar(atribucion, { display: 'none', margin: '4px 4px 2px', color: COLOR.SECUNDARIO, fontSize: '10px' })

    contenedor.append(campo, lista, estado, atribucion)

    L.DomEvent.disableClickPropagation(contenedor)
    L.DomEvent.disableScrollPropagation(contenedor)

    Object.assign(this, { _doc: doc, _contenedor: contenedor, _campo: campo, _lista: lista, _estado: estado, _atribucion: atribucion, _idLista: idLista })
    return contenedor
  },
})

/**
 * Monta el buscador del mapa.
 *
 * ```js
 * const cartociudad = crearClienteCartoCiudad({ transporte })
 * const buscador = crearBuscador({
 *   mapa,
 *   buscar: cartociudad.buscar,
 *   situar: cartociudad.situar,
 *   atribucion: CARTOCIUDAD.ATRIBUCION,
 *   alElegir: ({ lugar, centro, esPunto }) => { … },
 * })
 * ```
 *
 * @param {Object} opciones
 * @param {import('leaflet').Map} opciones.mapa
 * @param {(texto: string, o: {senal: AbortSignal}) => Promise<{ok: boolean, datos: *, motivo: string|null, mensaje: string|null}>} opciones.buscar
 * @param {(lugar: object, o: {senal: AbortSignal}) => Promise<{ok: boolean, datos: *, motivo: string|null, mensaje: string|null}>} opciones.situar
 * @param {(eleccion: {lugar: object, centro: {lat: number, lng: number}, esPunto: boolean}) => void} [opciones.alElegir]
 *   Se llama DESPUÉS de mover el mapa, y solo si se ha movido.
 * @param {string} [opciones.atribucion='']  Lo que la licencia de los datos pide
 *   decir. Se enseña debajo de la lista, mientras hay lista.
 * @param {number} [opciones.minCaracteres=3]  Por debajo, no se pregunta.
 * @param {string} [opciones.posicion='topleft']  Esquina; el control se coloca el
 *   PRIMERO de ella, encima del zoom.
 * @param {(fn: () => void, ms: number) => () => void} [opciones.programar]  El
 *   temporizador de la espera entre teclas. Devuelve con qué cancelarlo.
 * @param {Function|null} [opciones.alAvisar]  Canal de aviso (patrón del visor).
 * @returns {{control: object, destruir: () => void}}
 * @throws {TypeError|RangeError}  Contrato del programador.
 */
export function crearBuscador({
  mapa,
  buscar,
  situar,
  alElegir = () => {},
  atribucion = '',
  minCaracteres = 3,
  posicion = 'topleft',
  programar = programarConTemporizador,
  alAvisar,
} = {}) {
  if (!esMapa(mapa)) {
    throw new TypeError(`crearBuscador: 'mapa' debe ser un mapa de Leaflet; recibido ${typeof mapa}.`)
  }
  for (const [nombre, fn] of [
    ['buscar', buscar],
    ['situar', situar],
    ['alElegir', alElegir],
    ['programar', programar],
  ]) {
    if (typeof fn !== 'function') {
      throw new TypeError(`crearBuscador: '${nombre}' debe ser una función; recibido ${typeof fn}.`)
    }
  }
  if (!POSICIONES.includes(posicion)) {
    throw new RangeError(
      `crearBuscador: 'posicion' debe ser una esquina de Leaflet (${POSICIONES.join(', ')}); ` +
        `recibido ${JSON.stringify(posicion)}.`,
    )
  }
  if (typeof atribucion !== 'string') {
    throw new TypeError(`crearBuscador: 'atribucion' debe ser una cadena; recibido ${typeof atribucion}.`)
  }
  const avisar = resolverAvisar(alAvisar)

  const control = new ControlBuscador({ position: posicion, atribucion })
  mapa.addControl(control)

  // ⭐ ENCIMA DEL ZOOM. Leaflet añade los controles de una esquina superior al
  // FINAL, y el zoom nace con el mapa, así que sin esto el buscador quedaría debajo
  // de los botones «+» y «−». Arriba del todo es donde se busca en un mapa.
  const esquina = control._contenedor.parentNode
  if (esquina && esquina.firstChild !== control._contenedor) {
    esquina.insertBefore(control._contenedor, esquina.firstChild)
  }

  const { _doc: doc, _campo: campo, _lista: lista, _estado: estado, _atribucion: pie } = control

  /** @type {object[]} Los lugares de la lista que se ve. */
  let lugares = []
  let activo = -1
  let ficha = 0
  /** @type {AbortController|null} */
  let enVuelo = null
  let cancelarEspera = () => {}
  let destruido = false

  function decir(texto) {
    estado.textContent = texto
    estado.style.display = texto === '' ? 'none' : ''
  }

  function abortar() {
    if (enVuelo !== null) {
      enVuelo.abort()
      enVuelo = null
    }
  }

  function marcarActivo(indice) {
    activo = indice
    const opciones = lista.querySelectorAll(SELECTOR.OPCION)
    opciones.forEach((opcion, i) => {
      const esta = i === indice
      opcion.setAttribute('aria-selected', esta ? 'true' : 'false')
      opcion.style.background = esta ? COLOR.ACTIVA : ''
      opcion.style.boxShadow = esta ? `inset 2px 0 0 ${COLOR.ACENTO}` : ''
    })
    if (indice >= 0 && opciones[indice]) {
      campo.setAttribute('aria-activedescendant', opciones[indice].id)
      if (typeof opciones[indice].scrollIntoView === 'function') {
        opciones[indice].scrollIntoView({ block: 'nearest' })
      }
    } else {
      campo.removeAttribute('aria-activedescendant')
    }
  }

  function cerrarLista() {
    lista.replaceChildren()
    lista.style.display = 'none'
    pie.style.display = 'none'
    campo.setAttribute('aria-expanded', 'false')
    campo.removeAttribute('aria-activedescendant')
    activo = -1
  }

  function pintarLista() {
    lista.replaceChildren()
    lugares.forEach((lugar, i) => {
      const opcion = crear(doc, 'li', CLASE.OPCION)
      opcion.id = `${control._idLista}-${i}`
      opcion.dataset.buscador = 'opcion'
      opcion.dataset.indice = String(i)
      opcion.setAttribute('role', 'option')
      opcion.setAttribute('aria-selected', 'false')
      estilar(opcion, {
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        padding: '6px 8px',
        borderRadius: '4px',
        cursor: 'pointer',
      })
      const rotulo = crear(doc, 'span', null, lugar.rotulo)
      estilar(rotulo, { fontSize: '12px', fontWeight: '500', color: COLOR.TEXTO })
      const detalle = crear(doc, 'span', null, lugar.detalle)
      estilar(detalle, { fontSize: '11px', color: COLOR.SECUNDARIO })
      opcion.append(rotulo, detalle)
      lista.append(opcion)
    })
    lista.style.display = ''
    pie.style.display = pie.textContent === '' ? 'none' : ''
    campo.setAttribute('aria-expanded', 'true')
    marcarActivo(-1)
  }

  async function buscarAhora() {
    cancelarEspera()
    const q = campo.value.trim()
    if (q.length < minCaracteres) return
    abortar()
    const aborto = new AbortController()
    enVuelo = aborto
    const mia = ++ficha
    decir(TEXTO.BUSCANDO)
    let r
    try {
      r = await buscar(q, { senal: aborto.signal })
    } catch (causa) {
      // Un `buscar` que LANZA ha roto su contrato (tiene que devolver motivo y
      // mensaje). Se cuenta, y el buscador sigue vivo para la siguiente tecla.
      if (mia !== ficha || destruido) return
      enVuelo = null
      avisar(`El buscador del mapa no ha podido preguntar: ${causa?.message ?? causa}`, { causa })
      decir('No se ha podido buscar. Vuelve a intentarlo.')
      cerrarLista()
      return
    }
    if (mia !== ficha || destruido) return
    enVuelo = null
    if (!r || !r.ok) {
      if (r?.motivo === MOTIVO_RED.CANCELADA) return
      decir(r?.mensaje ?? 'No se ha podido buscar.')
      cerrarLista()
      return
    }
    lugares = Array.isArray(r.datos) ? r.datos : []
    if (lugares.length === 0) {
      decir(TEXTO.sinResultados(q))
      cerrarLista()
      return
    }
    decir('')
    pintarLista()
  }

  async function elegir(lugar) {
    if (!lugar) return
    cancelarEspera()
    abortar()
    cerrarLista()
    campo.value = lugar.rotulo
    const aborto = new AbortController()
    enVuelo = aborto
    const mia = ++ficha
    decir(TEXTO.situando(lugar.rotulo))
    let r
    try {
      r = await situar(lugar, { senal: aborto.signal })
    } catch (causa) {
      if (mia !== ficha || destruido) return
      enVuelo = null
      avisar(`El buscador del mapa no ha podido situar «${lugar.rotulo}»: ${causa?.message ?? causa}`, { causa })
      decir('No se ha podido llevar el mapa hasta allí. Vuelve a intentarlo.')
      return
    }
    if (mia !== ficha || destruido) return
    enVuelo = null
    if (!r || !r.ok) {
      if (r?.motivo !== MOTIVO_RED.CANCELADA) decir(r?.mensaje ?? 'No se ha podido llevar el mapa hasta allí.')
      return
    }
    const { centro, caja } = r.datos
    // Sin animación: de zoom 6 a 19 es un vuelo largo, y lo que viene detrás
    // (la consulta al Catastro en la rama Parcela) no tiene por qué esperarlo.
    if (caja) {
      mapa.fitBounds(caja, { maxZoom: ZOOM_MAXIMO_CAJA, animate: false })
    } else {
      const zoom = lugar.esPunto
        ? Math.min(ZOOM_PUNTO, mapa.getMaxZoom?.() ?? ZOOM_PUNTO)
        : ZOOM_ZONA_SIN_CAJA
      mapa.setView([centro.lat, centro.lng], zoom, { animate: false })
    }
    decir('')
    const donde = centro ?? mapa.getCenter()
    alElegir({ lugar, centro: { lat: donde.lat, lng: donde.lng }, esPunto: lugar.esPunto === true })
  }

  // ── Oyentes ──────────────────────────────────────────────────────────────────

  const alEscribir = () => {
    cancelarEspera()
    if (campo.value.trim().length < minCaracteres) {
      abortar()
      ficha += 1
      lugares = []
      cerrarLista()
      decir('')
      return
    }
    cancelarEspera = programar(() => {
      buscarAhora().catch(() => {})
    }, ESPERA_MS)
  }

  const alTeclear = (evento) => {
    // Las flechas son de la lista, no del mapa: sin esto, con el mapa enfocado
    // antes, Leaflet las usaría para desplazar la vista.
    evento.stopPropagation()
    const abierta = lista.style.display !== 'none' && lugares.length > 0
    switch (evento.key) {
      case 'ArrowDown':
        if (!abierta) return
        evento.preventDefault()
        marcarActivo(activo + 1 >= lugares.length ? 0 : activo + 1)
        return
      case 'ArrowUp':
        if (!abierta) return
        evento.preventDefault()
        marcarActivo(activo <= 0 ? lugares.length - 1 : activo - 1)
        return
      case 'Enter':
        evento.preventDefault()
        if (abierta) elegir(lugares[activo >= 0 ? activo : 0]).catch(() => {})
        else buscarAhora().catch(() => {})
        return
      case 'Escape':
        // Con la lista abierta, Escape la cierra y NADA MÁS: el navegador vaciaría
        // además el campo de búsqueda, y se perdería lo escrito por cerrar una lista.
        if (abierta) {
          evento.preventDefault()
          cerrarLista()
        }
        return
      default:
    }
  }

  // `mousedown` + `preventDefault` en la lista: el foco se queda en el campo, que
  // es lo que mantiene vivo el `aria-activedescendant` y evita el `blur` que
  // cerraría la lista antes de que llegue el `click`.
  const alApretarLista = (evento) => evento.preventDefault()

  const alPulsarLista = (evento) => {
    // ⛔ **`stopPropagation` AQUÍ, Y NO BASTA CON `disableClickPropagation`.**
    // Medido en la prueba del buscador: elegir VACÍA la lista en este mismo tick,
    // así que cuando el `click` sube al mapa la opción pulsada ya no está en el
    // documento. Leaflet decide si un clic es del mapa subiendo por los padres del
    // objetivo en busca de la marca que pone `disableClickPropagation`, y un nodo
    // suelto no tiene padres: el clic llegaba al mapa, y el clic del mapa pregunta
    // al Catastro por la parcela que hay DEBAJO de la lista.
    evento.stopPropagation()
    const opcion = evento.target?.closest?.(SELECTOR.OPCION)
    if (!opcion) return
    elegir(lugares[Number(opcion.dataset.indice)]).catch(() => {})
  }

  const alEnviar = (evento) => evento.preventDefault()

  const alSalir = (evento) => {
    if (!control._contenedor.contains(evento.relatedTarget)) cerrarLista()
  }

  campo.addEventListener('input', alEscribir)
  campo.addEventListener('keydown', alTeclear)
  lista.addEventListener('mousedown', alApretarLista)
  lista.addEventListener('click', alPulsarLista)
  control._contenedor.addEventListener('submit', alEnviar)
  control._contenedor.addEventListener('focusout', alSalir)

  return {
    control,

    /**
     * Retira el control, cancela la espera y aborta lo que haya en vuelo. Una
     * respuesta que llegue después no encuentra dónde pintar. IDEMPOTENTE.
     */
    destruir() {
      if (destruido) return
      destruido = true
      cancelarEspera()
      abortar()
      ficha += 1
      campo.removeEventListener('input', alEscribir)
      campo.removeEventListener('keydown', alTeclear)
      lista.removeEventListener('mousedown', alApretarLista)
      lista.removeEventListener('click', alPulsarLista)
      control._contenedor.removeEventListener('submit', alEnviar)
      control._contenedor.removeEventListener('focusout', alSalir)
      mapa.removeControl(control)
    },
  }
}

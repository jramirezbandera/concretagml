// viewer/parcelas-expediente.js — F25 · tarea 2.4 · LAS OTRAS PARCELAS DEL EXPEDIENTE.
//
// Dos piezas del visor para un expediente de varias parcelas, y ninguna decide nada:
//
//   · **La capa**: las parcelas que NO están en edición, dibujadas. Sin ella, cambiar
//     de parcela haría desaparecer del mapa la que se deja, y en una segregación es
//     justo el lindero contra el que se está ajustando la otra.
//   · **El selector**: qué parcela está en edición, para elegir otra, y desde la fase
//     3 para AÑADIR una (dibujarla, o una colindante) y QUITAR la que se edita. Es un
//     control de Leaflet en la esquina del buscador y el zoom. Con una sola parcela
//     solo enseña «Añadir parcela», que es la puerta de entrada; la lista y «Quitar»
//     aparecen con dos o más. ⚠️ En la fase 2 el control entero se escondía con una
//     parcela («un expediente de una se ve exactamente como antes de F25»), y la fase
//     3 lo cambió a propósito: sin esa puerta visible, la función no existe para
//     quien no la conoce.
//
// Quien cambia de parcela es `app/main.js` (apartar el historial, activar, `set`).
// Este módulo pinta y avisa de que se ha elegido otra, y nada más.
//
// ── ⛔ EL SELECTOR VA SOBRE EL MAPA Y NO EN EL PANEL ────────────────────────
// La ficha de F25 lo ponía en la cabecera del panel. Se mudó al escribirlo: con dos
// o más parcelas gastaría un renglón en el panel que F17 dejó a **1,57 px** de su
// suelo a 1280×720 (M28 de F17), con un síntoma mudo —la tabla de vértices encoge sin
// avisar—, y ese margen no se ha vuelto a medir desde el rework. Sobre el mapa cuesta
// **0 px de panel y 0 B de CSS** (estilo en línea, zona 3 de `DESIGN.md`), y el mapa
// también está siempre a la vista.
//
// ── ⛔ LAS OTRAS PARCELAS NO SE ELIGEN CON UN CLIC EN EL MAPA ────────────────
// Era lo natural y se descartó: un clic sobre una parcela del expediente es, muchas
// veces, un clic de DIBUJO —cerrar el recinto de la pieza nueva enganchando a la de al
// lado— o de INSERTAR un vértice en el lindero compartido. Capturarlo para cambiar de
// parcela rompería las dos cosas justo donde más se usan. La capa es interactiva solo
// para el emergente, y con `bubblingMouseEvents` (el defecto de `L.Path`) el clic
// sigue llegando al mapa: el mismo arreglo que `viewer/colindantes.js`, que tiene el
// razonamiento entero y la prueba que lo mide.
//
// ── EL COLOR: EL DEL USUARIO, DISCONTINUO ───────────────────────────────────
// Son trabajo del usuario —se editan y se serializan—, así que no pueden ir en el gris
// de las colindantes, que es contexto ajeno. Pero no son las que se están editando, y
// eso lo dice la línea discontinua y la ausencia de vértices. Es `COLOR_USUARIO`, el
// mismo literal: **ningún color nuevo** que justificar en `DESIGN.md` §3.2, y ninguno
// de mérito (regla de oro 9).
//
// SOLO-NAVEGADOR: importa Leaflet; su test lleva el sufijo `.dom` y no entra en el
// barrel raíz.

import L from 'leaflet'

import { HUSOS_VALIDOS } from '../geo/huso.js'
import { COLOR_USUARIO, NIVEL, PANE, resolverAvisar, vertUTMaLatLng } from './_comun.js'

/** Clase del `<path>` de cada parcela que no está en edición. */
export const CLASE_OTRA = 'gml-otra-parcela'

/** Clase del emergente. */
export const CLASE_EMERGENTE = 'gml-otra-parcela-emergente'

/** Los ganchos del selector, para el cableado y las pruebas. */
export const SELECTOR = Object.freeze({
  CONTROL: '[data-parcelas-expediente="control"]',
  FILA_LISTA: '[data-parcelas-expediente="fila-lista"]',
  LISTA: '[data-parcelas-expediente="lista"]',
  CUENTA: '[data-parcelas-expediente="cuenta"]',
  AÑADIR: '[data-parcelas-expediente="añadir"]',
  MENU: '[data-parcelas-expediente="menu"]',
  OPCION: '[data-parcelas-expediente="opcion"]',
  QUITAR: '[data-parcelas-expediente="quitar"]',
})

/** Lo que dice el selector. */
export const TEXTO = Object.freeze({
  ROTULO: 'Parcela en edición',
  SIN_REFERENCIA: 'sin referencia',
  AÑADIR: 'Añadir parcela',
  QUITAR: 'Quitar esta parcela',
  QUITAR_ARMADO: '¿Quitarla? Pulsa otra vez',
  SIN_OPCIONES: 'No hay nada que añadir ahora mismo.',
})

/**
 * Cuánto dura armado «Quitar esta parcela». Quitar una parcela NO se deshace con
 * Ctrl+Z —el deshacer es de cada parcela, y ésta deja de existir—, así que se pide
 * una segunda pulsación, como «Borrar» en la lista de expedientes guardados.
 */
export const MS_QUITAR_ARMADO = 4000

/** Trazo discontinuo: «es tuya y no es la que editas». Ver la cabecera. */
const GROSOR = 2
const DISCONTINUO = '6 4'
const OPACIDAD = 0.9

const POSICIONES = ['topleft', 'topright', 'bottomleft', 'bottomright']

/** Colores en línea del control: los mismos valores que los tokens de la hoja. */
const COLOR = Object.freeze({ TEXTO: '#0F172A', SECUNDARIO: '#475569', FILO: '#CBD5E1' })

/**
 * Cómo se nombra una parcela en la lista y en el emergente: su número de orden y su
 * referencia catastral, o «sin referencia» si no la tiene —una pieza segregada antes
 * de tenerla—. El número va SIEMPRE: dos piezas sin referencia tienen que poder
 * distinguirse, y la referencia sola no lo permite.
 *
 * @param {{refcat?: string|null}} parcela
 * @param {number} orden  Empezando en 1.
 * @returns {string}
 */
export function rotularParcela(parcela, orden) {
  const refcat = typeof parcela?.refcat === 'string' && parcela.refcat.trim() !== '' ? parcela.refcat.trim() : null
  return `${orden} · ${refcat ?? TEXTO.SIN_REFERENCIA}`
}

/** Estilos en línea propiedad a propiedad (ver `viewer/buscador.js#estilar`). */
function estilar(el, estilos) {
  for (const [propiedad, valor] of Object.entries(estilos)) el.style[propiedad] = valor
  return el
}

const esParUTM = (v) => Array.isArray(v) && v.length >= 2 && Number.isFinite(v[0]) && Number.isFinite(v[1])

const ControlSelector = L.Control.extend({
  options: { position: 'topleft' },
  onAdd(mapa) {
    const doc = mapa.getContainer().ownerDocument || document
    const contenedor = doc.createElement('div')
    contenedor.dataset.parcelasExpediente = 'control'
    contenedor.hidden = true
    estilar(contenedor, {
      boxSizing: 'border-box',
      padding: '6px 8px',
      background: '#ffffff',
      borderRadius: '6px',
      boxShadow: '0 1px 4px rgba(15,23,42,.3)',
      color: COLOR.TEXTO,
      fontSize: '12px',
      lineHeight: '1.35',
    })
    const etiqueta = doc.createElement('label')
    estilar(etiqueta, { display: 'flex', alignItems: 'center', gap: '6px', margin: '0' })
    const rotulo = doc.createElement('span')
    rotulo.textContent = TEXTO.ROTULO
    estilar(rotulo, { fontWeight: '600', color: COLOR.SECUNDARIO, whiteSpace: 'nowrap' })
    // Un `<select>` nativo y no una lista hecha a mano: teclado, lector de pantalla y
    // móvil funcionan solos, y no hay ningún desplegable propio que mantener.
    const lista = doc.createElement('select')
    lista.dataset.parcelasExpediente = 'lista'
    estilar(lista, {
      font: 'inherit',
      padding: '2px 4px',
      border: `1px solid ${COLOR.FILO}`,
      borderRadius: '6px',
      background: '#ffffff',
      color: COLOR.TEXTO,
    })
    const cuenta = doc.createElement('span')
    cuenta.dataset.parcelasExpediente = 'cuenta'
    estilar(cuenta, { color: COLOR.SECUNDARIO, whiteSpace: 'nowrap' })
    etiqueta.append(rotulo, lista, cuenta)
    etiqueta.dataset.parcelasExpediente = 'fila-lista'

    // ── F25 · fase 3 · añadir y quitar ──
    // Botones y no opciones del `<select>`: con el teclado, las flechas sobre un
    // `<select>` cerrado disparan `change` en Chrome, y cada flecha AÑADIRÍA una
    // parcela. Para cambiar de parcela eso cuesta un reencuadre; para añadir, no vale.
    const acciones = doc.createElement('div')
    estilar(acciones, { display: 'flex', gap: '6px', marginTop: '4px' })
    const boton = (dato, texto) => {
      const b = doc.createElement('button')
      b.type = 'button'
      b.dataset.parcelasExpediente = dato
      b.textContent = texto
      estilar(b, {
        font: 'inherit',
        padding: '2px 8px',
        border: `1px solid ${COLOR.FILO}`,
        borderRadius: '6px',
        background: '#ffffff',
        color: COLOR.TEXTO,
        cursor: 'pointer',
      })
      return b
    }
    const añadir = boton('añadir', `${TEXTO.AÑADIR} ▾`)
    const idMenu = `gml-parcelas-menu-${L.Util.stamp(this)}`
    añadir.setAttribute('aria-expanded', 'false')
    añadir.setAttribute('aria-controls', idMenu)
    const quitar = boton('quitar', TEXTO.QUITAR)
    acciones.append(añadir, quitar)
    const menu = doc.createElement('div')
    menu.id = idMenu
    menu.dataset.parcelasExpediente = 'menu'
    menu.hidden = true
    estilar(menu, { flexDirection: 'column', gap: '2px', marginTop: '4px' })

    contenedor.append(etiqueta, acciones, menu)
    L.DomEvent.disableClickPropagation(contenedor)
    L.DomEvent.disableScrollPropagation(contenedor)
    Object.assign(this, {
      _doc: doc,
      _contenedor: contenedor,
      _fila: etiqueta,
      _lista: lista,
      _cuenta: cuenta,
      _añadir: añadir,
      _quitar: quitar,
      _menu: menu,
      _boton: boton,
    })
    return contenedor
  },
})

/**
 * Monta la capa y el selector.
 *
 * ```js
 * const parcelas = crearParcelasExpediente({ mapa, zona: 30 })
 * parcelas.pintar({ parcelas: conjunto.parcelas(), activa: conjunto.activa() })
 * const baja = parcelas.alElegir((idLocal) => activarParcela(idLocal))
 * parcelas.visible(false)   // en la rama Edificio
 * ```
 *
 * @param {object} args
 * @param {import('leaflet').Map} args.mapa  Con el pane `PANE.COLINDANTES` montado.
 * @param {number} args.zona  Huso UTM.
 * @param {string} [args.posicion='topleft']
 * @param {() => Array<{clave: string, texto: string}>} [args.opcionesAñadir]  Lo que
 *   ofrece «Añadir parcela». Se pregunta AL ABRIR el menú, no al pintar: lo que hay
 *   que ofrecer —las colindantes dibujadas— cambia por caminos que este módulo no ve.
 * @param {(fn: () => void, ms: number) => () => void} [args.programar]  El
 *   temporizador del armado de «Quitar». Devuelve con qué cancelarlo.
 * @param {import('./_comun.js').Avisar} [args.alAvisar]
 * @returns {{pintar: Function, alElegir: Function, alAñadir: Function, alQuitar: Function,
 *   visible: Function, control: object, destruir: Function}}
 * @throws {TypeError|RangeError}  Contrato del programador.
 */
export function crearParcelasExpediente({
  mapa,
  zona,
  posicion = 'topleft',
  opcionesAñadir = () => [],
  programar = (fn, ms) => {
    const id = setTimeout(fn, ms)
    return () => clearTimeout(id)
  },
  alAvisar,
} = {}) {
  if (
    !mapa ||
    typeof mapa.addLayer !== 'function' ||
    typeof mapa.removeLayer !== 'function' ||
    typeof mapa.addControl !== 'function' ||
    typeof mapa.getPane !== 'function'
  ) {
    throw new TypeError(`crearParcelasExpediente: 'mapa' debe ser un L.Map; recibido ${typeof mapa}.`)
  }
  if (!HUSOS_VALIDOS.includes(zona)) {
    throw new RangeError(
      `crearParcelasExpediente: 'zona' inválida: ${JSON.stringify(zona)}. Válidas: ${HUSOS_VALIDOS.join(', ')}.`,
    )
  }
  if (!POSICIONES.includes(posicion)) {
    throw new RangeError(
      `crearParcelasExpediente: 'posicion' debe ser una esquina de Leaflet (${POSICIONES.join(', ')}); ` +
        `recibido ${JSON.stringify(posicion)}.`,
    )
  }
  if (!mapa.getPane(PANE.COLINDANTES)) {
    throw new TypeError(
      `crearParcelasExpediente: falta el pane '${PANE.COLINDANTES}'. Las otras parcelas van por ` +
        `DEBAJO de la que se edita, como las colindantes: si la taparan, se agarraría su trazo en ` +
        `vez del vértice.`,
    )
  }
  if (typeof opcionesAñadir !== 'function' || typeof programar !== 'function') {
    throw new TypeError(`crearParcelasExpediente: 'opcionesAñadir' y 'programar' deben ser funciones.`)
  }
  const avisar = resolverAvisar(alAvisar)

  let vivo = true
  let capas = []
  let mostrar = true
  /** Cuántas hay, para saber si el selector tiene sentido. */
  let cuantas = 0
  /** Lo último que se pidió pintar, para volver a pintarlo al reaparecer. */
  let ultimo = { parcelas: [], activa: null }
  /** @type {Set<(idLocal: string) => void>} */
  const oyentes = new Set()
  /** @type {Set<(clave: string) => void>} */
  const oyentesAñadir = new Set()
  /** @type {Set<(idLocal: string) => void>} */
  const oyentesQuitar = new Set()
  /** Con qué se cancela el armado de «Quitar», o `null` si no está armado. */
  let desarmar = null

  const control = new ControlSelector({ position: posicion })
  mapa.addControl(control)

  const repartir = (lista, valor, quien) => {
    for (const fn of lista) {
      try {
        fn(valor)
      } catch (causa) {
        console.error(`viewer/parcelas-expediente.js: un oyente de ${quien} ha fallado`, causa)
      }
    }
  }

  const alCambiarLista = () => repartir(oyentes, control._lista.value, 'alElegir')
  control._lista.addEventListener('change', alCambiarLista)

  /**
   * Cierra el menú OCULTÁNDOLO, sin vaciarlo: los botones se rehacen al abrirlo.
   *
   * ⛔ **Vaciarlo aquí plantaba la primera esquina del dibujo encima del menú**
   * (medido en Chromium al cerrar la fase 3). Leaflet 1.9 no detiene el `click` de un
   * control: el mapa sube por `parentNode` desde el elemento pulsado buscando la marca
   * de `disableClickPropagation` (`Map#_isClickDisabled`). La opción se pulsa, su
   * oyente cierra el menú y EMPIEZA el dibujo, y si el cierre la despega del DOM el
   * mapa ya no encuentra la marca: toma la pulsación por suya y el dibujo recién
   * empezado la convierte en su primer vértice.
   */
  function cerrarMenu() {
    control._menu.hidden = true
    control._menu.style.display = 'none'
    control._añadir.setAttribute('aria-expanded', 'false')
  }

  function abrirMenu() {
    const opciones = opcionesAñadir()
    control._menu.replaceChildren()
    if (!Array.isArray(opciones) || opciones.length === 0) {
      const nada = control._doc.createElement('p')
      nada.textContent = TEXTO.SIN_OPCIONES
      estilar(nada, { margin: '2px 0', color: COLOR.SECUNDARIO })
      control._menu.append(nada)
    } else {
      for (const { clave, texto } of opciones) {
        const b = control._boton('opcion', texto)
        b.dataset.clave = clave
        estilar(b, { textAlign: 'left' })
        b.addEventListener('click', () => {
          cerrarMenu()
          repartir(oyentesAñadir, clave, 'alAñadir')
        })
        control._menu.append(b)
      }
    }
    control._menu.hidden = false
    control._menu.style.display = 'flex'
    control._añadir.setAttribute('aria-expanded', 'true')
  }

  const alPulsarAñadir = () => (control._menu.hidden ? abrirMenu() : cerrarMenu())
  control._añadir.addEventListener('click', alPulsarAñadir)

  function soltarArmado() {
    desarmar?.()
    desarmar = null
    control._quitar.textContent = TEXTO.QUITAR
  }

  const alPulsarQuitar = () => {
    if (desarmar === null) {
      control._quitar.textContent = TEXTO.QUITAR_ARMADO
      desarmar = programar(() => {
        desarmar = null
        control._quitar.textContent = TEXTO.QUITAR
      }, MS_QUITAR_ARMADO)
      return
    }
    const idLocal = ultimo.activa
    soltarArmado()
    repartir(oyentesQuitar, idLocal, 'alQuitar')
  }
  control._quitar.addEventListener('click', alPulsarQuitar)

  /**
   * ⭐ F25 · fase 3: el control aparece en cuanto hay una parcela en edición, porque
   * «Añadir parcela» es la puerta de entrada al expediente de varias. La lista y
   * «Quitar» solo con dos o más: con una no hay nada entre lo que elegir ni nada que
   * se pueda quitar sin dejar el expediente vacío.
   */
  function aplicarVisibilidad() {
    const hayActiva = ultimo.activa !== null
    control._contenedor.hidden = !(mostrar && hayActiva)
    control._fila.hidden = cuantas < 2
    control._fila.style.display = cuantas < 2 ? 'none' : 'flex'
    control._quitar.hidden = cuantas < 2
    if (control._contenedor.hidden) cerrarMenu()
  }

  function limpiar() {
    for (const capa of capas) {
      try {
        mapa.removeLayer(capa)
      } catch {
        // Idempotente, como el resto del desmontaje del visor.
      }
    }
    capas = []
  }

  function anillosLatLng(recintos) {
    if (!Array.isArray(recintos)) return []
    const anillos = []
    for (const recinto of recintos) {
      const finitos = Array.isArray(recinto?.vertices) ? recinto.vertices.filter(esParUTM) : []
      if (finitos.length >= 3) anillos.push(finitos.map((v) => vertUTMaLatLng(v, zona)))
    }
    return anillos
  }

  /**
   * Pinta las parcelas que NO están en edición y rehace el selector. Idempotente.
   *
   * @param {{parcelas: object[], activa: string|null}} contenido
   * @returns {void}
   */
  function pintar({ parcelas = [], activa = null } = {}) {
    if (!vivo) return
    if (!Array.isArray(parcelas)) {
      throw new TypeError(`pintar: 'parcelas' debe ser un array; recibido ${typeof parcelas}.`)
    }
    limpiar()
    // Otra parcela en edición, u otro expediente: un «Quitar» armado se referiría a
    // la de antes, y un menú abierto ofrecería lo de antes.
    if (activa !== ultimo.activa) {
      soltarArmado()
      cerrarMenu()
    }
    ultimo = { parcelas, activa }
    cuantas = parcelas.length

    // ── La lista ──
    const lista = control._lista
    lista.replaceChildren()
    parcelas.forEach((p, i) => {
      const opcion = control._doc.createElement('option')
      opcion.value = p.idLocal
      opcion.textContent = rotularParcela(p, i + 1)
      lista.append(opcion)
    })
    if (activa !== null) lista.value = activa
    control._cuenta.textContent = `de ${cuantas}`
    aplicarVisibilidad()

    // ── La capa ── (oculta, no se pinta: un emergente sobre algo invisible engaña)
    if (!mostrar) return
    let saltadas = 0
    parcelas.forEach((p, i) => {
      if (p.idLocal === activa) return
      const anillos = anillosLatLng(p.recintos)
      if (anillos.length === 0) {
        saltadas++
        return
      }
      const poligono = L.polygon(anillos, {
        pane: PANE.COLINDANTES,
        className: CLASE_OTRA,
        interactive: true,
        color: COLOR_USUARIO,
        weight: GROSOR,
        opacity: OPACIDAD,
        dashArray: DISCONTINUO,
        fill: true,
        fillColor: COLOR_USUARIO,
        fillOpacity: 0,
      })
      poligono.bindTooltip(`Parcela ${rotularParcela(p, i + 1)} · elígela en «${TEXTO.ROTULO}» para editarla`, {
        className: CLASE_EMERGENTE,
        sticky: true,
        direction: 'top',
      })
      poligono.addTo(mapa)
      capas.push(poligono)
    })
    if (saltadas > 0) {
      avisar(
        `${saltadas} de ${cuantas - (activa === null ? 0 : 1)} parcela(s) del expediente que no estás ` +
          `editando no tienen un contorno dibujable: no se ven en el mapa, pero siguen en el expediente.`,
        { nivel: NIVEL.AVISO },
      )
    }
  }

  return {
    pintar,

    /**
     * Se llama cuando el usuario elige OTRA parcela en el selector, con su `idLocal`.
     * @param {(idLocal: string) => void} fn
     * @returns {() => void}
     */
    alElegir(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alElegir: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      oyentes.add(fn)
      return () => oyentes.delete(fn)
    },

    /**
     * Se llama cuando el usuario elige algo del menú «Añadir parcela», con la `clave`
     * de la opción tal como la dio `opcionesAñadir`.
     * @param {(clave: string) => void} fn
     * @returns {() => void}
     */
    alAñadir(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alAñadir: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      oyentesAñadir.add(fn)
      return () => oyentesAñadir.delete(fn)
    },

    /**
     * Se llama con la SEGUNDA pulsación de «Quitar esta parcela», con el `idLocal` de
     * la que está en edición.
     * @param {(idLocal: string) => void} fn
     * @returns {() => void}
     */
    alQuitar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alQuitar: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      oyentesQuitar.add(fn)
      return () => oyentesQuitar.delete(fn)
    },

    /** Enseña u oculta la capa y el selector (la rama Edificio no edita parcelas). */
    visible(si) {
      if (!vivo || mostrar === (si === true)) return
      mostrar = si === true
      pintar(ultimo)
    },

    control,

    /** Quita la capa y el control. Idempotente. */
    destruir() {
      if (!vivo) return
      vivo = false
      limpiar()
      soltarArmado()
      control._lista.removeEventListener('change', alCambiarLista)
      control._añadir.removeEventListener('click', alPulsarAñadir)
      control._quitar.removeEventListener('click', alPulsarQuitar)
      oyentes.clear()
      oyentesAñadir.clear()
      oyentesQuitar.clear()
      try {
        mapa.removeControl(control)
      } catch {
        // Ya fuera del mapa.
      }
    },
  }
}

export default crearParcelasExpediente

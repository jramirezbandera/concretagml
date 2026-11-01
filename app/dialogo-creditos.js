// app/dialogo-creditos.js — F16 · «Créditos y licencias».
//
// ── QUÉ CIERRA ESTE FICHERO ─────────────────────────────────────────────────
// Los criterios 2 y 3 de F16: una página que lista cada dependencia con su SPDX
// correcto (Leaflet BSD-2-Clause, override O9) y las atribuciones de los datos. Las
// atribuciones ya estaban en el visor y en el PDF desde F03 y F09; lo que no había
// era un sitio donde leerlas juntas, ni nada que dijera de quién es el software que
// va dentro.
//
// ── DE DÓNDE SALE CADA COSA ─────────────────────────────────────────────────
//   · **Los datos**: de `viewer/atribucion.js#ATRIBUCION` y de
//     `services/cartociudad.js#CARTOCIUDAD`, que son la ÚNICA fuente de esos textos.
//     Aquí no se reescribe ninguno: se importan y se pintan tal cual.
//   · **El software y la tipografía**: de `licencias.json`, que escribe el build
//     (`vite.config.js#gmlLicencias`) a partir de lo que de verdad va empaquetado. Por
//     qué no es una lista a mano está en la cabecera de `licencias/terceros.js`.
//
// ⚠️ **En `npm run dev` no hay inventario, y se dice.** El fichero lo escribe el build
// y el servidor de desarrollo no empaqueta nada. La sección lo cuenta en vez de
// salir vacía: una lista vacía sin motivo diría «no usamos software de nadie».
//
// ── POR QUÉ CUELGA DEL MENÚ DE EXPEDIENTE ───────────────────────────────────
// Por lo mismo que «Cómo funciona» y el diccionario: es consulta, no una salida ni un
// paso. Coste en la barra: cero, el menú crece hacia abajo.
//
// ── CUÁNTO CUESTA EN LA HOJA ────────────────────────────────────────────────
// Solo su clase en las dos reglas del contenedor (la caja y el velo), como
// `.gml-dialogo-trabajo` en F21. El interior reutiliza las piezas del diccionario —la
// ficha plegable con su nombre, sus insignias y sus apartados— y los grupos con rótulo
// del diálogo de importación: es la misma pieza para la misma lectura. Ver
// {@link CLASE}.

import { CARTOCIUDAD } from '../services/cartociudad.js'
import { ATRIBUCION } from '../viewer/atribucion.js'
import { RUTA_AVISO, RUTA_INVENTARIO } from '../licencias/terceros.js'

// ── Textos ───────────────────────────────────────────────────────────────────

const TITULO = 'Créditos y licencias'

const INTRO =
  'Concreta GML funciona entero en tu navegador, sobre datos públicos y software de ' +
  'otros. Esto es de quién es cada cosa y con qué licencia se usa.'

const ROTULO_DATOS = 'Datos cartográficos'
const APUNTE_DATOS =
  'El mapa y el PDF citan a cada uno cuando se ve su capa; aquí van todos juntos.'

/**
 * Las fuentes de datos, con el texto de atribución LITERAL de su módulo y la licencia
 * con la que se usan. El rótulo dice para qué lo usa la aplicación, que es lo que
 * quien lee necesita para saber de qué se le está hablando.
 */
const DATOS = Object.freeze([
  ['Ortofoto PNOA', ATRIBUCION.PNOA, 'CC BY 4.0'],
  ['Mapa base y topográfico del IGN', ATRIBUCION.IGN, 'CC BY 4.0'],
  ['Parcelario, construcciones y consultas del Catastro', ATRIBUCION.CATASTRO, 'Ley 37/2007, de reutilización de la información del sector público'],
  ['Mapa de OpenStreetMap', ATRIBUCION.OSM, 'ODbL 1.0'],
  ['Buscador de direcciones', CARTOCIUDAD.ATRIBUCION, 'CC BY 4.0'],
])

const ROTULO_SOFTWARE = 'Software y tipografías de terceros'
const ENLACE_AVISO = 'Descargar los textos completos (.txt)'
const CARGANDO = 'Leyendo el inventario…'

/** Lo que se dice en `npm run dev`. Ver la cabecera. */
const SIN_INVENTARIO =
  'El inventario lo escribe el build (npm run build) a partir de lo que va empaquetado, y ' +
  'el servidor de desarrollo no empaqueta nada: aquí no hay lista que enseñar.'

const ROTULO_CORREGIDA = (o) =>
  `Su package.json declara «${o.declarada}», que no es un identificador SPDX. El texto de ` +
  `su licencia dice ${o.spdx}, y es lo que vale.`

const SIN_COPYRIGHT = 'Su licencia no lleva aviso de copyright.'

const BOTON_CERRAR = 'Cerrar'

// ── Clases y ganchos · contrato con `estilos/app.css` y con los guiones ──────

/**
 * ⚠️ Solo {@link CLASE.DIALOGO} es propia, y existe para que un `querySelector`
 * encuentre ESTE diálogo y no el del diccionario; el resto son clases de otros
 * diálogos, reutilizadas a propósito (ver la cabecera). Si alguna cambia de nombre
 * allí, cambia aquí.
 */
const CLASE = Object.freeze({
  DIALOGO: 'gml-dialogo-creditos',
  CUERPO: 'gml-dialogo-diccionario-cuerpo',
  TITULO: 'gml-dialogo-diccionario-titulo',
  INTRO: 'gml-dialogo-diccionario-intro',
  GRUPO: 'gml-dialogo-importacion-grupo',
  ROTULO: 'gml-dialogo-importacion-rotulo',
  APUNTE: 'gml-dialogo-importacion-apunte',
  DATOS: 'gml-dialogo-importacion-lista',
  LISTA: 'gml-diccionario-lista',
  ENTRADA: 'gml-diccionario-entrada',
  RESUMEN: 'gml-diccionario-resumen',
  CLAVE: 'gml-diccionario-clave',
  INSIGNIAS: 'gml-diccionario-insignias',
  INSIGNIA: 'gml-diccionario-insignia',
  DETALLE: 'gml-diccionario-detalle',
  APARTADO: 'gml-diccionario-apartado',
  CORRECCION: 'gml-diccionario-correccion',
  PIE: 'gml-dialogo-diccionario-pie',
})

const ACCION = Object.freeze({ CERRAR: 'cerrar-creditos' })

/**
 * El `menuitem` de la barra que abre esta pantalla. **Es contrato de `index.html`** y
 * casa exactamente un nodo (G16).
 */
export const SELECTOR_ABRIR_CREDITOS = '[data-accion="creditos"]'

/** Los estados de la sección de software, en `data-estado`. Los lee el guion de humo. */
export const ESTADO_INVENTARIO = Object.freeze({
  CARGANDO: 'cargando',
  LISTO: 'listo',
  SIN_INVENTARIO: 'sin-inventario',
  FALLO: 'fallo',
})

/** El mismo duck typing del resto de la casa. */
function esElementoDOM(el) {
  return (
    !!el &&
    typeof el === 'object' &&
    typeof el.appendChild === 'function' &&
    typeof el.addEventListener === 'function' &&
    el.nodeType === 1
  )
}

/** @param {unknown} x */
function esInventario(x) {
  const obras = (l) =>
    Array.isArray(l) &&
    l.every((o) => typeof o?.nombre === 'string' && typeof o?.spdx === 'string' && typeof o?.texto === 'string')
  return !!x && typeof x === 'object' && obras(x.paquetes) && obras(x.fuentes)
}

/**
 * Pinta un texto que puede traer UN tipo de marcado: el `<a href="…">…</a>` de la
 * atribución de OpenStreetMap, que la licencia ODbL pide con enlace. Se construye con
 * nodos y no con `innerHTML`, aunque el texto sea nuestro: así un retoque futuro de
 * `ATRIBUCION` no puede meter aquí nada que no sea un enlace.
 *
 * @param {Document} doc
 * @param {HTMLElement} destino
 * @param {string} texto
 */
function pintarConEnlaces(doc, destino, texto) {
  const re = /<a href="([^"]+)">([^<]*)<\/a>/g
  let desde = 0
  for (const m of texto.matchAll(re)) {
    destino.append(doc.createTextNode(texto.slice(desde, m.index)))
    const a = doc.createElement('a')
    a.href = m[1]
    a.textContent = m[2]
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    destino.append(a)
    desde = m.index + m[0].length
  }
  destino.append(doc.createTextNode(texto.slice(desde)))
}

/**
 * @typedef {object} DialogoCreditos
 * @property {HTMLElement} nodo  El `<dialog>`.
 * @property {() => Promise<void>} abrir  Enseña el diálogo; la promesa se resuelve
 *   cuando el inventario está pintado (o se ha dicho por qué no).
 * @property {() => void} cerrar  IDEMPOTENTE.
 * @property {() => boolean} estaAbierto
 * @property {() => void} destruir  IDEMPOTENTE.
 */

/**
 * Fabrica el diálogo de créditos y cablea el `menuitem` que lo abre.
 *
 * @param {object} [opciones]
 * @param {Document} [opciones.documento=document]
 * @param {HTMLElement} [opciones.disparador]  Si no llega se busca por
 *   {@link SELECTOR_ABRIR_CREDITOS}.
 * @param {string} [opciones.base='./']  Prefijo de las dos URL del build;
 *   `app/main.js` pasa `import.meta.env.BASE_URL`.
 * @param {boolean} [opciones.construido=false]  Si la aplicación viene del build.
 *   `false` no pide nada y dice {@link SIN_INVENTARIO}.
 * @param {() => Promise<unknown>} [opciones.cargar]  Trae el inventario. Por defecto
 *   un `fetch` de `base + licencias.json`; parámetro para las pruebas.
 * @returns {DialogoCreditos}
 * @throws {TypeError}  Si falta el documento o el disparador.
 */
export function crearDialogoCreditos({
  documento = document,
  disparador,
  base = './',
  construido = false,
  cargar,
} = {}) {
  const doc = documento
  if (!doc || typeof doc.createElement !== 'function') {
    throw new TypeError(
      `crearDialogoCreditos: 'documento' debe ser un Document; recibido ${typeof doc}.`,
    )
  }

  const boton = disparador ?? doc.querySelector(SELECTOR_ABRIR_CREDITOS)
  if (!esElementoDOM(boton)) {
    throw new TypeError(
      `crearDialogoCreditos: no hay disparador. Se busca por '${SELECTOR_ABRIR_CREDITOS}', ` +
        `que es contrato de index.html. Sin él, las licencias que la aplicación está obligada ` +
        `a enseñar quedarían sin ninguna forma de llegar a ellas.`,
    )
  }

  const traer =
    cargar ??
    (async () => {
      const respuesta = await fetch(`${base}${RUTA_INVENTARIO}`)
      if (!respuesta.ok) throw new Error(`${RUTA_INVENTARIO} contestó ${respuesta.status}.`)
      return respuesta.json()
    })

  const crear = (etiqueta, clase, texto) => {
    const el = doc.createElement(etiqueta)
    if (clase) el.className = clase
    if (texto !== undefined) el.textContent = texto
    return el
  }

  // ── El DOM ────────────────────────────────────────────────────────────────

  const dialogo = crear('dialog', CLASE.DIALOGO)
  dialogo.setAttribute('aria-modal', 'true')
  dialogo.tabIndex = -1

  const cuerpo = crear('div', CLASE.CUERPO)
  const titulo = crear('h2', CLASE.TITULO, TITULO)
  titulo.id = 'gml-dialogo-creditos-titulo'
  dialogo.setAttribute('aria-labelledby', titulo.id)

  // Los datos: no dependen de nada y se pintan una vez.
  const grupoDatos = crear('section', CLASE.GRUPO)
  grupoDatos.dataset.creditos = 'datos'
  const listaDatos = crear('ul', CLASE.DATOS)
  for (const [uso, atribucion, licencia] of DATOS) {
    const li = crear('li')
    li.append(crear('strong', null, uso), doc.createTextNode(' — '))
    pintarConEnlaces(doc, li, atribucion)
    li.append(doc.createTextNode(` · ${licencia}`))
    listaDatos.append(li)
  }
  grupoDatos.append(
    crear('h3', CLASE.ROTULO, ROTULO_DATOS),
    crear('p', CLASE.APUNTE, APUNTE_DATOS),
    listaDatos,
  )

  // El software: se pinta al abrir, la primera vez.
  const grupoSoftware = crear('section', CLASE.GRUPO)
  grupoSoftware.dataset.creditos = 'software'
  const apunteSoftware = crear('p', CLASE.APUNTE)
  apunteSoftware.setAttribute('role', 'status')
  const listaSoftware = crear('div', CLASE.LISTA)
  listaSoftware.id = 'gml-creditos-software'
  listaSoftware.hidden = true
  grupoSoftware.append(crear('h3', CLASE.ROTULO, ROTULO_SOFTWARE), apunteSoftware, listaSoftware)

  const pie = crear('div', CLASE.PIE)
  const botonCerrar = crear('button', 'gml-boton gml-boton--primario', BOTON_CERRAR)
  botonCerrar.type = 'button'
  botonCerrar.dataset.accion = ACCION.CERRAR
  pie.append(botonCerrar)

  cuerpo.append(titulo, crear('p', CLASE.INTRO, INTRO), grupoDatos, grupoSoftware, pie)
  dialogo.append(cuerpo)
  doc.body.appendChild(dialogo)

  // ── El inventario ─────────────────────────────────────────────────────────

  let destruido = false
  let abierto = false
  let focoPrevio = null
  /** La carga en curso o hecha. Una sola por vida del diálogo, salvo si falló. */
  let carga = null

  function estado(valor, texto) {
    grupoSoftware.dataset.estado = valor
    apunteSoftware.textContent = texto
  }

  /**
   * La ficha de una obra, plegada. El texto de la licencia se pinta al desplegarla
   * por primera vez: son 35 textos y nadie los lee todos.
   *
   * @param {import('../licencias/terceros.js').Obra} o
   */
  function pintarObra(o) {
    const det = crear('details', CLASE.ENTRADA)
    det.dataset.obra = o.version ? `${o.nombre}@${o.version}` : o.nombre
    det.dataset.spdx = o.spdx

    const resumen = crear('summary', CLASE.RESUMEN)
    resumen.append(crear('span', CLASE.CLAVE, o.nombre))
    const insignias = crear('span', CLASE.INSIGNIAS)
    if (o.version) insignias.append(crear('span', CLASE.INSIGNIA, o.version))
    insignias.append(crear('span', CLASE.INSIGNIA, o.spdx))
    resumen.append(insignias)

    const detalle = crear('div', CLASE.DETALLE)
    const pintarDetalle = () => {
      if (detalle.childElementCount > 0) return
      const avisos = o.copyright?.length ? o.copyright.join(' · ') : SIN_COPYRIGHT
      detalle.append(crear('p', CLASE.APARTADO, avisos))
      if (o.declarada) detalle.append(crear('p', CLASE.CORRECCION, ROTULO_CORREGIDA(o)))
      if (o.url) {
        const p = crear('p', CLASE.APARTADO)
        const a = crear('a', null, o.url)
        a.href = o.url
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        p.append(a)
        detalle.append(p)
      }
      // Párrafo a párrafo, con los renglones del fichero unidos: los textos de
      // licencia vienen partidos a 80 columnas y aquí la caja mide 68ch.
      for (const parrafo of o.texto.split(/\n\s*\n/)) {
        const limpio = parrafo.replace(/\s+/g, ' ').trim()
        if (limpio !== '') detalle.append(crear('p', CLASE.APARTADO, limpio))
      }
    }
    det.addEventListener('toggle', () => {
      if (det.open) pintarDetalle()
    })

    det.append(resumen, detalle)
    listaSoftware.append(det)
  }

  function pintarInventario(inventario) {
    listaSoftware.replaceChildren()
    for (const o of [...inventario.paquetes, ...inventario.fuentes]) pintarObra(o)
    listaSoftware.hidden = false

    const n = inventario.paquetes.length
    const f = inventario.fuentes.length
    estado(
      ESTADO_INVENTARIO.LISTO,
      `${n} paquetes de software (contando cada versión) y ${f} ` +
        `${f === 1 ? 'tipografía' : 'tipografías'} van dentro de la aplicación. La lista ` +
        `sale del build, de lo que de verdad lleva el paquete. `,
    )
    const a = crear('a', null, ENLACE_AVISO)
    a.href = `${base}${RUTA_AVISO}`
    a.setAttribute('download', '')
    apunteSoftware.append(a)
  }

  function asegurarInventario() {
    if (!construido) {
      estado(ESTADO_INVENTARIO.SIN_INVENTARIO, SIN_INVENTARIO)
      return Promise.resolve()
    }
    if (carga !== null) return carga
    estado(ESTADO_INVENTARIO.CARGANDO, CARGANDO)
    carga = Promise.resolve()
      .then(traer)
      .then((inventario) => {
        if (!esInventario(inventario)) {
          throw new Error(`${RUTA_INVENTARIO} no tiene la forma de un inventario.`)
        }
        if (!destruido) pintarInventario(inventario)
      })
      .catch((error) => {
        // Se olvida la carga para que la próxima apertura lo vuelva a intentar: el
        // fallo típico es estar sin red con el inventario fuera de la caché.
        carga = null
        if (!destruido) {
          estado(
            ESTADO_INVENTARIO.FALLO,
            `No se ha podido leer la lista de licencias (${error?.message ?? error}). ` +
              `Cierra y vuelve a abrir para reintentarlo.`,
          )
        }
      })
    return carga
  }

  // ── Apertura y cierre ─────────────────────────────────────────────────────

  function cerrar() {
    if (!abierto) return
    abierto = false
    if (typeof dialogo.close === 'function') {
      try {
        dialogo.close()
      } catch {
        dialogo.removeAttribute('open')
      }
    } else {
      dialogo.removeAttribute('open')
    }
    const previo = focoPrevio
    focoPrevio = null
    if (previo && typeof previo.focus === 'function' && previo.isConnected) previo.focus()
  }

  function abrir() {
    if (destruido) return Promise.resolve()
    const pendiente = asegurarInventario()
    if (abierto) return pendiente
    focoPrevio = doc.activeElement ?? null
    abierto = true
    if (typeof dialogo.showModal === 'function') {
      try {
        dialogo.showModal()
      } catch {
        dialogo.setAttribute('open', '')
      }
    } else {
      dialogo.setAttribute('open', '')
    }
    // El foco al botón de cerrar: aquí no hay nada que rellenar, y es lo único que
    // todo el que entra acaba pulsando.
    if (typeof botonCerrar.focus === 'function') botonCerrar.focus()
    return pendiente
  }

  // ── Oyentes ───────────────────────────────────────────────────────────────

  const escuchados = []
  function escuchar(diana, tipo, fn) {
    diana.addEventListener(tipo, fn)
    escuchados.push({ diana, tipo, fn })
  }

  escuchar(boton, 'click', (evento) => {
    evento.preventDefault?.()
    abrir()
  })
  boton.setAttribute('aria-haspopup', 'dialog')

  escuchar(dialogo, 'click', (evento) => {
    if (evento.target === dialogo) {
      cerrar()
      return
    }
    const pulsado = evento.target?.closest?.('[data-accion]')
    if (pulsado && dialogo.contains(pulsado) && pulsado.dataset.accion === ACCION.CERRAR) cerrar()
  })

  escuchar(dialogo, 'cancel', (evento) => {
    evento.preventDefault?.()
    cerrar()
  })

  escuchar(dialogo, 'keydown', (evento) => {
    if (evento.key === 'Escape' && abierto) {
      evento.preventDefault?.()
      cerrar()
    }
  })

  return {
    nodo: dialogo,
    abrir,
    cerrar,
    estaAbierto: () => abierto,

    /** Cierra lo que hubiera, suelta los oyentes y se quita del DOM. */
    destruir() {
      if (destruido) return
      cerrar()
      destruido = true
      for (const { diana, tipo, fn } of escuchados) diana.removeEventListener(tipo, fn)
      escuchados.length = 0
      boton.removeAttribute('aria-haspopup')
      dialogo.remove()
    },
  }
}

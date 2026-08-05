/* -------------------------------------------------------------------------- *
 * test/app/main-edificio.dom.test.js — F11 · T4.1 · el paso 13, ensamblado     *
 *                                                                              *
 * Los diez módulos de F11 están hechos y probados uno por uno, y cada uno tiene *
 * su suite. Lo que hasta esta tarea no ejecutaba NADIE es el ENSAMBLAJE:        *
 * mientras `app/main.js` no monte el paso 13, la segunda rama de la aplicación  *
 * es código que solo existe en los tests — exactamente lo que le pasó a F08     *
 * hasta su T5.1 y a F10 hasta la suya.                                          *
 *                                                                              *
 * ── QUÉ SE PRUEBA AQUÍ, Y QUÉ NO ──                                            *
 * NO se vuelven a probar el conmutador (`test/app/rama.dom.test.js`), el panel  *
 * (`panel-edificio.dom.test.js`), el cableado (`edificio.dom.test.js`), la capa *
 * de huellas, el lector BU ni el cliente del `wfsBU`. Se prueban las cosas que  *
 * **no son de ninguna función sino del ORDEN del arranque**, que son siete:     *
 *   1. que la rama se monta y las dos secciones de EDIFICIO nacen SELLADAS y    *
 *      ocultas — sin la marca, el conmutador no las gobierna y la rama de       *
 *      edificio no se enseñaría nunca (la costura que destapó la fase 2);       *
 *   2. que conmutar de ida y vuelta deja el panel de PARCELA funcionando de     *
 *      verdad: el MISMO nodo, con su valor y con su cableado vivo (M10);        *
 *   3. que la FICHA DEL PIE cambia de cara y no de dueño — cinco de sus ocho    *
 *      renglones hablan de la parcela y con el edificio delante estarían        *
 *      afirmando cosas del otro documento;                                      *
 *   4. que los DOS stores son independientes: escribir en uno no repinta lo del *
 *      otro;                                                                    *
 *   5. que el `.dxf` entra por la ÚNICA zona de fichero de la aplicación y que  *
 *      su destino se resuelve TARDE, por la rama activa;                        *
 *   6. que un GML de EDIFICIO soltado sobre la ventana **conmuta la rama y se   *
 *      carga** — la quinta vía de §14.2, que hasta F11 se paraba con honradez y *
 *      era el criterio 4 de F08 declarado «a medias»;                           *
 *   7. que el expediente (paso 12) recibe la rama y el segundo store, que es lo *
 *      único que le impide guardar el documento equivocado **en silencio**.     *
 *                                                                              *
 * ── DECISIÓN 1 · NO SE REMONTA LA CÁSCARA ENTRE PRUEBAS ──                     *
 * Igual que en `main-comprobacion.dom.test.js` y por lo mismo: lo que se prueba *
 * es la app VIVA, y `document.body.innerHTML = …` destruiría el contenedor del  *
 * mapa y con él las huellas, los cajones y el panel de edificio que el arranque *
 * tiene en la mano. El precio es que las pruebas comparten estado, así que cada *
 * una **deja la rama como la encontró** (hay un `afterEach` que lo hace).        *
 *                                                                              *
 * ── DECISIÓN 2 · SE DOBLAN DOS MÓDULOS Y SE INTERCEPTA UNO ──                  *
 *   · `viewer/index.js` — `crearVisor` monta un `L.Map` con capas, WMS, tabla y *
 *     encuadre, y nada de eso ensambla el paso 13. El doble PARTE del módulo    *
 *     real (`importOriginal`) y solo sustituye `crearVisor`, porque              *
 *     `app/cableado-edificio.js` importa de ahí `encuadrarSobreRecintos` — y un *
 *     doble de una sola clave convertiría cada export nuevo del visor en un     *
 *     fallo de importación de este fichero.                                      *
 *     ⚠️ Su `mapa` es el `L.Map` DE VERDAD del arnés, no un `{on, off}`:         *
 *     `viewer/partes.js` exige `addLayer`/`removeLayer`/`getPane`.               *
 *   · `services/_red.js` — el transporte. Es lo único que tocaría la red, y     *
 *     `peticiones` es además el espía con el que se afirma que las cuatro vías  *
 *     por fichero **no consultan nada**.                                        *
 *   · `app/cableado-expediente.js` NO se dobla: se INTERCEPTA para quedarse con *
 *     las opciones con que `app/main.js` lo monta (de ahí sale la afirmación 7) *
 *     y se delega en el módulo real. Es la única forma de leer lo que el        *
 *     arranque le pasa sin exportarlo solo para el test — misma técnica que     *
 *     `main-comprobacion.dom.test.js` usa con `cablearDiagnostico`.             *
 *                                                                              *
 * ── ⚠️ LAS DOS TRAMPAS DE ENTORNO, LAS DOS MEDIDAS ──                          *
 *   1. `readFileSync` devuelve un `Buffer` del realm de Node, y bajo jsdom el   *
 *      `instanceof Uint8Array` de `gml/decodificar.js` da `false` sobre él. Los *
 *      bytes se pasan SIEMPRE por `Uint8Array.from(...)`.                        *
 *   2. jsdom no implementa `DataTransfer` ni `DragEvent`: el `drop` se fabrica  *
 *      con `Event` + un doble de `dataTransfer`.                                 *
 * Y una tercera, de F11: el `innerHTML` del `<body>` **no trae su clase**, y    *
 * `app/rama.js` LANZA sin `.gml-app`. Se repone del fichero real.                *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, afterEach, vi } from 'vitest'

import { SELECTOR_CAMPO_REFCAT } from '../../app/cableado-catastro.js'
import { EXTENSIONES as EXTENSIONES_EDIFICIO } from '../../app/cableado-edificio.js'
import { SRS_DEMO } from '../../app/demo-datos.js'
import {
  SELECTOR as SELECTOR_PANEL_EDIFICIO,
  TITULO_PARTES,
} from '../../app/panel-edificio.js'
import {
  ATRIBUTO_PANEL,
  ATRIBUTO_RAMA,
  RAMA,
  SELECTOR as SELECTOR_RAMA,
  selectorBoton,
} from '../../app/rama.js'
import { CLASE_INPUT } from '../../app/zona-fichero.js'
import { area } from '../../geo/area.js'
import { husoPorSrs } from '../../geo/huso.js'
import { crearEdificio, crearParteConstruccion } from '../../model/edificio.js'
import { crearBarraEdicion } from '../../viewer/barra-edicion.js'
import { crearCajonComprobacion } from '../../viewer/cajon-comprobacion.js'
import { crearCajonDiagnostico } from '../../viewer/cajon-diagnostico.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearListaSobrante } from '../../viewer/lista-sobrante.js'
import { crearCapaPiezas } from '../../viewer/piezas.js'
import { CLASE_HUELLA } from '../../viewer/partes.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

// ── Fixtures REALES ──────────────────────────────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')
/** ⚠️ `Uint8Array.from`, nunca el `Buffer` a pelo. Ver la trampa 1. */
const leerBytes = (...ruta) => Uint8Array.from(readFileSync(join(RAIZ, ...ruta)))

/**
 * El DXF de UNA sola capa. Se elige a propósito el mínimo y no el de Consulta
 * Masiva: con más de una capa el cableado abre el diálogo de reparto —que es su
 * comportamiento correcto y tiene su propia suite—, y aquí lo que se prueba es el
 * CABLE, no el reparto. El de siete capas se usa abajo, una sola vez, para
 * comprobar que el diálogo también llega hasta el final por esta vía.
 */
const DXF_UNA_CAPA = leerBytes('test', 'fixtures', 'parsers', 'poly_clasica.dxf')

/** El DXF real de Consulta Masiva: 7 huellas en `Construccion` + 1 en `Parcela`. */
const DXF_EDIFICIO = leerBytes(
  'test',
  'fixtures',
  'parsers',
  'edificio_consulta_masiva_3515508VF0831N.dxf',
)

/**
 * El dialecto BU por la vía del fichero: **el de `BuildingPart`, con sus trece
 * partes, y no el de `Building`**. La distinción está medida en T2.1 y es de
 * dominio, no de test: la huella del `Building` es la ENVOLVENTE INSPIRE (la unión
 * de las partes), y guardarla como parte sería guardar la envolvente con otro
 * nombre y contar su superficie dos veces. Consecuencia aceptada y comprobada
 * allí: `bu_building_*.gml` **a solas** sale con cero partes y bloqueado, nombrando
 * `GetBuildingPartByParcel`. Aquí hace falta un fichero que sí cargue.
 */
const GML_BU = leerBytes('test', 'fixtures', 'gml', 'bu_buildingpart_9398516VK3799G.gml')

/** Un GML de PARCELA, para afirmar que el desvío no se lleva lo que no es suyo. */
const GML_CP = leerBytes('test', 'fixtures', 'gml', 'cp_parcela_9398516VK3799G.gml')

// ── El estado compartido con las fábricas de `vi.mock` (que se izan) ─────────

const arranque = vi.hoisted(() => {
  const peticiones = []
  const estado = {
    /** Opciones con las que `app/main.js` montó el visor. */
    opciones: null,
    /** Opciones con las que `app/main.js` cableó el expediente (paso 12). */
    expediente: null,
    /** URLs pedidas al transporte. Vacío = no se ha tocado la red. */
    peticiones,
  }
  estado.transporte = {
    async pedirTexto(url) {
      peticiones.push(url)
      throw new Error(`prueba: este fichero no debería tocar la red (${url})`)
    },
    estado: () => ({ peticiones: peticiones.length }),
    destruir() {},
  }
  return estado
})

// ── El cromo del mapa: el otro efecto de `crearVisor` sobre el documento ─────

let mapaVivo = null
let diagnosticoVivo = null
let comprobacionViva = null

/** La lista y la capa de F17 vivas. Van JUNTAS, como en el visor real. */
let sobranteVivo = null

/**
 * Pone en el documento lo que `crearVisor` monta SOBRE EL MAPA, con los módulos de
 * producción y no con copias: los siete nodos de la barra de edición, el cajón y la
 * capa de F07 y el cajón de F08. Sin ellos, tres cableados que van FUERA del `try`
 * del Catastro lanzarían y este fichero no recolectaría ni un test.
 */
function montarCromoDelMapa() {
  const { mapa } = montarMapa()
  crearPanes(mapa)
  crearBarraEdicion({ mapa })
  mapaVivo = mapa
  diagnosticoVivo = {
    cajon: crearCajonDiagnostico({ mapa }),
    contraste: crearContraste({ mapa, zona: husoPorSrs(SRS_DEMO) }),
  }
  comprobacionViva = crearCajonComprobacion({ mapa })
  // F17: las dos piezas del sobrante, también DE VERDAD — `cablearDerivacion`
  // hace duck typing de once métodos de la lista y cuatro de la capa, y va fuera
  // de todo `try`, así que un doble a mano tumbaría esta suite entera.
  sobranteVivo = {
    lista: crearListaSobrante({ documento: document }),
    capa: crearCapaPiezas({ mapa, zona: husoPorSrs(SRS_DEMO) }),
  }
}

// ── Los dobles ───────────────────────────────────────────────────────────────

vi.mock('../../viewer/index.js', async (importarOriginal) => ({
  // Se PARTE del módulo real: `app/cableado-edificio.js` importa de aquí
  // `encuadrarSobreRecintos`, y un doble de una sola clave lo dejaría sin definir.
  ...(await importarOriginal()),
  crearVisor: (_contenedor, opciones) => {
    arranque.opciones = opciones
    montarCromoDelMapa()
    return {
      // El `L.Map` DE VERDAD: `viewer/partes.js` necesita addLayer/removeLayer/getPane.
      mapa: mapaVivo,
      estado: opciones.estado,
      capas: {},
      acotaciones: null,
      edicion: {
        snapActivo: () => true,
        tolerancia: () => 0.2,
        ladoSeleccionado: () => null,
        alCambiarSeleccion: () => () => {},
        fijarColindantes() {},
        desplazarSeleccion: () => ({ aplicado: false, modo: null, detecciones: [] }),
      },
      // La barra que `app/rama.js` oculta con la rama EDIFICIO. Se devuelve la de
      // verdad —montada arriba sobre el mapa del arnés— y no un doble: el módulo
      // pregunta por `barraEdicion.control.getContainer()`.
      barraEdicion: null,
      colindantes: { pintar() {}, limpiar() {}, destruir() {} },
      diagnostico: diagnosticoVivo,
      comprobacion: comprobacionViva,
      sobrante: sobranteVivo,
      destruir() {},
    }
  },
}))

vi.mock('../../services/_red.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return { ...original, crearTransporte: () => arranque.transporte }
})

// `cablearExpediente` NO se dobla: se intercepta para quedarse con las opciones con
// las que `app/main.js` lo monta —de ahí sale la afirmación 7— y se delega en el
// módulo REAL, que es quien de verdad decide qué documento se guarda.
vi.mock('../../app/cableado-expediente.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    cablearExpediente: (opciones) => {
      arranque.expediente = opciones
      return original.cablearExpediente(opciones)
    },
  }
})

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────

const CASCARA_INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body([^>]*)>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/main-edificio.dom.test.js: no se ha encontrado el <body> de index.html. La ' +
        'cáscara de estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  const clase = /class="([^"]*)"/i.exec(encontrado[1])
  // ⚠️ TODOS los atributos de la etiqueta de apertura, no solo la clase.
  // `innerHTML` copia lo de DENTRO del <body> y nada de su etiqueta, así que lo
  // que lleve puesto el <body> real hay que reponerlo a mano. Hasta el rework de
  // UI bastaba con `class` (`app/rama.js` LANZA sin `.gml-app`); desde T6 el
  // <body> lleva además `data-app="cascara"`, que es el gancho de
  // `app/pantalla.js`, y sin él el arranque entero revienta. Se copian todos para
  // que el próximo atributo que aparezca no vuelva a romper estos cuatro ficheros.
  const atributos = [...encontrado[1].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map(([, n, v]) => [
    n,
    v,
  ])
  return { clase: clase === null ? '' : clase[1], atributos, cuerpo: encontrado[2] }
})()

// ⚠️ La CLASE del `<body>` también: `innerHTML` copia lo de dentro y nada de la
// etiqueta de apertura, y `app/rama.js` LANZA sin `.gml-app` (ver la trampa 3).
document.body.className = CASCARA_INDEX.clase
for (const [nombre, valor] of CASCARA_INDEX.atributos) {
  document.body.setAttribute(nombre, valor)
}
document.body.innerHTML = CASCARA_INDEX.cuerpo

// El arranque REAL, una sola vez. Si el paso 13 rompiera el ensamblaje, este
// fichero entero fallaría aquí y no en un `it`.
await import('../../app/main.js')

// ── Utilidades del recorrido ─────────────────────────────────────────────────

const cuerpo = document.body
const q = (selector) => document.querySelector(selector)

/** El botón del conmutador de una rama. */
const botonRama = (rama) => q(selectorBoton(rama))

/** Lleva la pantalla a una rama pulsando su botón, como haría el usuario. */
function irA(rama) {
  botonRama(rama).click()
}

/** El `<dd data-ficha="…">` y su `<dt>`, que es el vecino anterior. */
const ficha = (clave) => {
  const dd = q(`[data-ficha="${clave}"]`)
  return { valor: dd, rotulo: dd.previousElementSibling }
}

/** `FileList` de mentira: array-like, como la de verdad. */
function dobleFileList(ficheros) {
  const lista = { length: ficheros.length, item: (i) => ficheros[i] ?? null }
  ficheros.forEach((f, i) => {
    lista[i] = f
  })
  return lista
}

/** Suelta un `File` sobre la ventana, como haría el usuario. Ver la trampa 2. */
function soltar(fichero) {
  const evento = new Event('drop', { bubbles: true, cancelable: true })
  evento.dataTransfer = { types: ['Files'], files: dobleFileList([fichero]), dropEffect: 'none' }
  cuerpo.dispatchEvent(evento)
}

const ficheroDeBytes = (bytes, nombre) => new File([bytes], nombre, { type: '' })

/** Cede el turno al bucle de microtareas unas cuantas veces. */
async function cederTurno(veces = 60) {
  for (let vuelta = 0; vuelta < veces; vuelta += 1) await Promise.resolve()
}

async function soltarYEsperar(fichero) {
  soltar(fichero)
  await cederTurno()
}

/** El segundo store, tal y como se lo pasó `app/main.js` al expediente. */
const storeEdificio = () => arranque.expediente.estadoEdificio

/** El store de PARCELA, que es el que recibió el visor. */
const storeParcela = () => arranque.opciones.estado

/** Las huellas pintadas en el mapa, contadas en el DOM. */
const huellasEnElMapa = () => document.querySelectorAll(`.${CLASE_HUELLA}`).length

// Cada prueba deja la rama como la encontró: la cáscara NO se remonta (decisión 1).
afterEach(async () => {
  if (cuerpo.dataset[ATRIBUTO_RAMA.replace('data-', '')] !== RAMA.PARCELA) irA(RAMA.PARCELA)
  storeEdificio().set(null)
  await cederTurno(5)
})

// ── 1 · La rama se monta, y las secciones nacen selladas ─────────────────────

describe('app/main · F11 · el paso 13 monta la segunda rama', () => {
  it('el conmutador está en la cabecera y la pantalla nace en PARCELA', () => {
    const conmutador = q(SELECTOR_RAMA.CONMUTADOR)

    expect(conmutador).not.toBeNull()
    // Dentro de `.gml-chips`, que es el sitio medido a coste 0 px.
    expect(conmutador.closest(SELECTOR_RAMA.CHIPS)).not.toBeNull()
    expect(cuerpo.getAttribute(ATRIBUTO_RAMA)).toBe(RAMA.PARCELA)
    expect(botonRama(RAMA.PARCELA).getAttribute('aria-pressed')).toBe('true')
    expect(botonRama(RAMA.EDIFICIO).getAttribute('aria-pressed')).toBe('false')
  })

  it('⭐ las DOS secciones de edificio están SELLADAS y ocultas al arrancar', () => {
    const secciones = [...document.querySelectorAll(`[${ATRIBUTO_PANEL}="${RAMA.EDIFICIO}"]`)]

    // Sin la marca, `app/rama.js` no las descubre y la rama EDIFICIO no se
    // enseñaría NUNCA: es la costura que la fase 2 dejó rota y la 3 cosió, y esta
    // es la única prueba que la ejercita con el arranque de verdad.
    expect(secciones).toHaveLength(2)
    expect(secciones.every((s) => s.hidden)).toBe(true)
    // Y las de parcela, marcadas y a la vista.
    const deParcela = [...document.querySelectorAll(`[${ATRIBUTO_PANEL}="${RAMA.PARCELA}"]`)]
    expect(deParcela).toHaveLength(2)
    expect(deParcela.some((s) => s.hidden)).toBe(false)
  })

  it('conmutar INTERCAMBIA los paneles, sin sacar ninguno del documento', () => {
    const bloqueParcela = q(`[${ATRIBUTO_PANEL}="${RAMA.PARCELA}"]`)
    const bloqueEdificio = q(`[${ATRIBUTO_PANEL}="${RAMA.EDIFICIO}"]`)

    irA(RAMA.EDIFICIO)

    expect(cuerpo.getAttribute(ATRIBUTO_RAMA)).toBe(RAMA.EDIFICIO)
    expect(bloqueParcela.hidden).toBe(true)
    expect(bloqueEdificio.hidden).toBe(false)
    // ⛔ El intercambio es por VISIBILIDAD: los dos siguen EN el documento. Con
    // `replaceChildren` la referencia quedaría huérfana, escribible y muda.
    expect(bloqueParcela.isConnected).toBe(true)
    expect(bloqueEdificio.isConnected).toBe(true)
  })

  it('⭐ M10 · ida y vuelta deja el campo de parcela VIVO: mismo nodo y mismo valor', () => {
    const antes = q(SELECTOR_CAMPO_REFCAT)
    antes.value = '9398516VK3799G'

    irA(RAMA.EDIFICIO)
    irA(RAMA.PARCELA)

    const despues = q(SELECTOR_CAMPO_REFCAT)
    // El MISMO nodo, no uno equivalente: los treinta nodos que `app/` resuelve una
    // sola vez en el montaje siguen apuntando aquí.
    expect(despues).toBe(antes)
    expect(despues.value).toBe('9398516VK3799G')
    expect(despues.isConnected).toBe(true)
    antes.value = ''
  })

  it('⛔ ningún `data-campo` de refcat se repite entre ramas', () => {
    // `querySelector` se queda con el de parcela aunque esté oculto (medido en
    // T0.3). Si el panel de edificio hubiera reusado el nombre, esta cuenta daría 2
    // y el cableado de edificio estaría escribiendo en el campo de la otra rama.
    expect(document.querySelectorAll(SELECTOR_CAMPO_REFCAT)).toHaveLength(1)
    expect(document.querySelectorAll(SELECTOR_PANEL_EDIFICIO.REFCAT)).toHaveLength(1)
    expect(q(SELECTOR_CAMPO_REFCAT)).not.toBe(q(SELECTOR_PANEL_EDIFICIO.REFCAT))
  })

  it('los dos CTA del pie se apagan CON su motivo, y se reponen al volver', () => {
    const generar = q(SELECTOR_RAMA.CTA_GENERAR)
    const renglon = q(SELECTOR_RAMA.ESTADO_GENERAR)
    const textoAntes = renglon.textContent

    irA(RAMA.EDIFICIO)

    expect(generar.disabled).toBe(true)
    // Botón apagado CON motivo, jamás botón muerto: el renglón tiene que cambiar.
    expect(renglon.textContent).not.toBe(textoAntes)
    expect(renglon.textContent.trim().length).toBeGreaterThan(0)

    irA(RAMA.PARCELA)
    expect(renglon.textContent).toBe(textoAntes)
  })
})

// ── 2 · La ficha del pie: la misma vista, dos documentos ─────────────────────

describe('app/main · F11 · la ficha del pie cambia de cara, no de dueño', () => {
  it('con la rama EDIFICIO quedan CUATRO pares, y los otros cuatro se van enteros', () => {
    const solosDeParcela = ['perimetro', 'superficie-catastral', 'delta-catastral', 'colindantes']

    irA(RAMA.EDIFICIO)

    for (const clave of solosDeParcela) {
      const par = ficha(clave)
      // Se oculta el `<dd>` **y su `<dt>`**: la ficha es una rejilla de dos
      // columnas y dejar el rótulo solo la partiría por la mitad.
      expect(par.valor.hidden).toBe(true)
      expect(par.rotulo.hidden).toBe(true)
    }
    // Los cuatro que se sostienen en las dos ramas.
    for (const clave of ['srs', 'refcat', 'vertices', 'superficie']) {
      expect(ficha(clave).valor.hidden).toBe(false)
    }
  })

  it('los dos rótulos que cambian de PREGUNTA lo dicen, y vuelven al volver', () => {
    const contador = ficha('vertices')
    const medida = ficha('superficie')
    const rotuloVertices = contador.rotulo.textContent
    const rotuloSuperficie = medida.rotulo.textContent

    irA(RAMA.EDIFICIO)

    expect(contador.rotulo.textContent).toBe(TITULO_PARTES)
    expect(contador.rotulo.textContent).not.toBe(rotuloVertices)
    // «Superficie en planta» y no «Superficie»: lo que se mide es el suelo que
    // ocupan las huellas, no la superficie CONSTRUIDA, que en tres plantas es el
    // triple. Llamarlas igual invitaría a compararlas.
    expect(medida.rotulo.textContent).toMatch(/planta/i)

    irA(RAMA.PARCELA)
    expect(contador.rotulo.textContent).toBe(rotuloVertices)
    expect(medida.rotulo.textContent).toBe(rotuloSuperficie)
  })

  it('sin edificio cargado la ficha lo DICE, en vez de escribir un 0', () => {
    irA(RAMA.EDIFICIO)

    // «0 partes» afirmaría que el edificio tiene cero partes; lo que pasa es que no
    // hay edificio. Y un guion se lee como «esto no ha cargado».
    expect(ficha('vertices').valor.textContent).not.toBe('0')
    expect(ficha('vertices').valor.textContent).toMatch(/\p{L}/u)
    expect(ficha('refcat').valor.textContent).toMatch(/\p{L}/u)
  })

  it('⭐ mide las huellas del edificio que hay en el store, no las de la parcela', async () => {
    const huella = (dx) => ({
      tipo: 'EXTERIOR',
      vertices: [
        [dx, 0],
        [dx + 10, 0],
        [dx + 10, 10],
        [dx, 10],
      ],
    })
    const edificio = crearEdificio({
      refcat: '3515508VF0831N',
      partes: [
        crearParteConstruccion({ nombre: 'Cuerpo', recinto: huella(0), origen: 'DXF' }),
        crearParteConstruccion({ nombre: 'Porche', recinto: huella(100), origen: 'DXF' }),
      ],
    })

    irA(RAMA.EDIFICIO)
    storeEdificio().set(edificio)
    await cederTurno(5)

    expect(ficha('vertices').valor.textContent).toBe('2')
    expect(ficha('refcat').valor.textContent).toBe('3515508VF0831N')
    // 100 m² + 100 m². Se compara contra `geo/area.js`, que es de donde sale, en vez
    // de contra el literal «200,00 m²»: así la prueba no se casa con el formateador.
    const esperada = area(huella(0).vertices) + area(huella(100).vertices)
    expect(esperada).toBe(200)
    expect(ficha('superficie').valor.textContent).toMatch(/^200,00 m²$/)
  })

  it('⛔ una parte SIN contorno se cuenta y se dice, no se calla', async () => {
    const edificio = crearEdificio({
      partes: [
        crearParteConstruccion({
          nombre: 'Cuerpo',
          recinto: {
            tipo: 'EXTERIOR',
            vertices: [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
            ],
          },
          origen: 'DXF',
        }),
        // Sin recinto: `model/edificio.js` la admite (queda pendiente de dibujar).
        crearParteConstruccion({ nombre: 'Sin dibujar', origen: 'DIBUJADA' }),
      ],
    })

    irA(RAMA.EDIFICIO)
    storeEdificio().set(edificio)
    await cederTurno(5)

    // Si se callara, la superficie de abajo sería incompleta con pinta de completa.
    expect(ficha('vertices').valor.textContent).toMatch(/2/)
    expect(ficha('vertices').valor.textContent).toMatch(/sin contorno/i)
    expect(ficha('superficie').valor.textContent).toBe('100,00 m²')
  })

  it('⛔ arrastrar un vértice de la parcela NO escribe en la ficha del edificio', async () => {
    irA(RAMA.EDIFICIO)
    storeEdificio().set(
      crearEdificio({
        partes: [
          crearParteConstruccion({
            nombre: 'Cuerpo',
            recinto: {
              tipo: 'EXTERIOR',
              vertices: [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
              ],
            },
            origen: 'DXF',
          }),
        ],
      }),
    )
    await cederTurno(5)
    const antes = ficha('superficie').valor.textContent
    expect(antes).toBe('100,00 m²')

    // ⚠️ Este es el canal EN VIVO del arrastre, tal cual: `app/main.js` se lo pasa
    // a `crearVisor` como `alPrevisualizar` y `viewer/sincronizacion.js` lo llama en
    // cada fotograma. Con la rama EDIFICIO la parcela sigue en el mapa como
    // CONTEXTO y sus vértices se pueden agarrar —la barra está oculta, los
    // marcadores no—, así que sin la guarda un solo gesto escribiría la superficie
    // de la parcela en la línea que está enseñando la del edificio.
    const anillosDeLaParcela = storeParcela().get().recintos.map((r) => r.vertices)
    arranque.opciones.alPrevisualizar(anillosDeLaParcela, null)

    expect(ficha('superficie').valor.textContent).toBe(antes)
    expect(ficha('vertices').valor.textContent).toBe('1')
  })

  it('⭐ los DOS stores son independientes: la parcela no repinta la ficha del edificio', async () => {
    irA(RAMA.EDIFICIO)
    const antes = ficha('superficie').valor.textContent

    // Un `set` del store de PARCELA: una edición, un `undo`, una parcela traída.
    storeParcela().set(storeParcela().get())
    await cederTurno(5)

    // Si la ficha no repartiera por rama, aquí estaría la superficie de la parcela
    // en la línea que enseña la del edificio.
    expect(ficha('superficie').valor.textContent).toBe(antes)
  })
})

// ── 3 · El `.dxf` entra por la ÚNICA zona de fichero, y por la rama activa ───

describe('app/main · F11 · el dibujo entra por la zona que ya existía', () => {
  it('la zona anuncia las CINCO extensiones, con las del GML primero', () => {
    const input = q(`.${CLASE_INPUT}`)
    const anunciadas = input.getAttribute('accept').split(',').map((e) => e.trim())

    expect(anunciadas.slice(0, 2)).toEqual(['.gml', '.xml'])
    expect(anunciadas).toContain('.json')
    for (const extension of EXTENSIONES_EDIFICIO) expect(anunciadas).toContain(extension)
    // Cinco y no seis: una extensión con dos destinos LANZA al cablear.
    expect(new Set(anunciadas).size).toBe(anunciadas.length)
  })

  it('⭐ con la rama EDIFICIO, un DXF produce partes y las pinta en el mapa', async () => {
    irA(RAMA.EDIFICIO)

    await soltarYEsperar(ficheroDeBytes(DXF_UNA_CAPA, 'huella.dxf'))

    const edificio = storeEdificio().get()
    expect(edificio).not.toBeNull()
    expect(edificio.partes).toHaveLength(1)
    expect(edificio.partes[0].origen).toBe('DXF')
    // Y se VEN: el criterio 2 se verifica con los ojos, no solo en un test.
    expect(huellasEnElMapa()).toBe(1)
    // Sin tocar la red: leer un dibujo no consulta nada.
    expect(arranque.peticiones).toHaveLength(0)
  })

  it('⭐ la parcela que hay en pantalla viaja como `parcelaContexto`, no como rama', async () => {
    const enPantalla = storeParcela().get()
    expect(enPantalla.recintos.length).toBeGreaterThan(0)

    irA(RAMA.EDIFICIO)
    await soltarYEsperar(ficheroDeBytes(DXF_UNA_CAPA, 'huella.dxf'))

    // Desviación 9 del plan: `crearExpediente` PROHÍBE llevar las dos ramas, así
    // que la parcela de debajo no puede viajar como rama `parcela`. Va donde
    // `model/edificio.js` previó desde F00 — y si `app/main.js` no le pasara el
    // store de parcela al cableado, esto sería `null` sin que nadie se enterara.
    const edificio = storeEdificio().get()
    expect(edificio.parcelaContexto).not.toBeNull()
    expect(edificio.parcelaContexto).toHaveLength(enPantalla.recintos.length)
    expect(edificio.parcelaContexto[0].vertices).toEqual(enPantalla.recintos[0].vertices)
  })

  it('⛔ con la rama PARCELA el mismo DXF no carga nada, y dice por dónde', async () => {
    const panelAvisos = q('#avisos')
    const antes = storeParcela().get()

    await soltarYEsperar(ficheroDeBytes(DXF_UNA_CAPA, 'huella.dxf'))

    // El destino se resuelve TARDE, por la rama activa: aquí no hay a quién dárselo.
    expect(storeEdificio().get()).toBeNull()
    expect(storeParcela().get()).toBe(antes)
    // Y no se calla: decir «no» sin decir «por dónde» es la mitad de un mensaje.
    expect(panelAvisos.textContent).toMatch(/rama Edificio/i)
  })

  it('el DXF real de siete capas pregunta por el reparto y lo carga al elegir', async () => {
    irA(RAMA.EDIFICIO)

    await soltarYEsperar(ficheroDeBytes(DXF_EDIFICIO, 'consulta-masiva.dxf'))

    // Aquí NO se ha cargado nada todavía: se ofrece, no se adivina (decisión 5 de la
    // fase, y en `UTM.dxf` la parcela está en la capa `0` y no en la llamada PARCELA).
    expect(storeEdificio().get()).toBeNull()
    const casillas = [...document.querySelectorAll(`${SELECTOR_PANEL_EDIFICIO.LISTA_CAPAS} input`)]
    expect(casillas.length).toBeGreaterThan(1)

    const construccion = casillas.find((c) => c.value === 'Construccion')
    expect(construccion).toBeDefined()
    // ⚠️ Con `change`, no solo `checked`: asignar la propiedad NO dispara el suceso,
    // y «Aplicar» nace `disabled` con su motivo al lado —se enciende al marcar—.
    // Sin esta línea el clic cae sobre un botón apagado y no pasa nada, que es
    // exactamente lo que la primera versión de esta prueba midió sin darse cuenta.
    casillas.forEach((c) => {
      c.checked = c === construccion
      c.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(q(SELECTOR_PANEL_EDIFICIO.APLICAR_CAPAS).disabled).toBe(false)
    q(SELECTOR_PANEL_EDIFICIO.APLICAR_CAPAS).click()
    await cederTurno()

    // Las siete huellas de `Construccion`, y ni una de las otras seis capas.
    expect(storeEdificio().get().partes).toHaveLength(7)
    expect(huellasEnElMapa()).toBe(7)
  })
})

// ── 4 · El GML de edificio: la quinta vía, que ya no es un callejón ──────────

describe('app/main · F11 · un GML de edificio CONMUTA la rama y se carga', () => {
  it('⭐ soltarlo con la rama PARCELA lleva la pantalla a EDIFICIO y lo enseña', async () => {
    expect(cuerpo.getAttribute(ATRIBUTO_RAMA)).toBe(RAMA.PARCELA)

    await soltarYEsperar(ficheroDeBytes(GML_BU, 'edificio.gml'))

    // Esto es el criterio 4 de F08, que quedó declarado «a medias» esperando a que
    // existiera una rama a la que llevar el fichero.
    expect(cuerpo.getAttribute(ATRIBUTO_RAMA)).toBe(RAMA.EDIFICIO)
    expect(storeEdificio().get()).not.toBeNull()
    // Y el cajón de comprobación NO se abre: ese fichero no era suyo.
    expect(comprobacionViva.abierto()).toBe(false)
    // El cambio de contexto se DICE: la pantalla ha cambiado de panel sola.
    expect(q('#avisos').textContent).toMatch(/construcci[oó]n/i)
  })

  it('un GML de PARCELA sigue yendo a su cajón y NO conmuta nada', async () => {
    await soltarYEsperar(ficheroDeBytes(GML_CP, 'parcela.gml'))

    expect(cuerpo.getAttribute(ATRIBUTO_RAMA)).toBe(RAMA.PARCELA)
    expect(comprobacionViva.abierto()).toBe(true)
    expect(storeEdificio().get()).toBeNull()
    comprobacionViva.cerrar()
  })
})

// ── 5 · El expediente recibe la rama (o guardaría el documento equivocado) ───

describe('app/main · F11 · el paso 12 sabe en qué rama está', () => {
  it('⭐ `cablearExpediente` recibe el conmutador Y el segundo store', () => {
    // Sin estas dos piezas, `expedienteActual()` devolvería SIEMPRE `{srs, parcela}`
    // y con la rama EDIFICIO puesta se guardaría el documento equivocado, EN
    // SILENCIO. Es el sitio donde F11 podía romper F10 sin hacer ruido.
    expect(arranque.expediente.rama).not.toBeNull()
    expect(arranque.expediente.rama).toBeDefined()
    expect(typeof arranque.expediente.rama.subscribe).toBe('function')
    expect(arranque.expediente.estadoEdificio).toBeDefined()
    expect(arranque.expediente.estadoEdificio).not.toBeNull()
  })

  it('⛔ y es el MISMO store que llena el cableado de edificio, no otro', async () => {
    irA(RAMA.EDIFICIO)
    await soltarYEsperar(ficheroDeBytes(DXF_UNA_CAPA, 'huella.dxf'))

    // Dos stores distintos con la misma forma habrían pasado las cinco pruebas de
    // arriba y habrían dejado al expediente mirando uno vacío para siempre.
    expect(arranque.expediente.estadoEdificio.get()).not.toBeNull()
    expect(arranque.expediente.estadoEdificio.get().partes).toHaveLength(1)
  })

  it('⛔ el paso 13 corrió ANTES que el 12: la rama existía al montarlo', () => {
    // La única inversión de la lista de pasos, y esta es su prueba: si `cablearRama`
    // se hubiera montado después, aquí habría llegado `null` y `cablearExpediente`
    // se habría comportado como en F10 —siempre rama PARCELA— sin quejarse.
    expect(arranque.expediente.rama.get()).toBe(RAMA.PARCELA)
  })
})

// ── 8 · ⭐ CONTRATO K.1 EN DOS EJES, SOBRE EL DOCUMENTO MONTADO ENTERO ────────
//
// Rework de UI · T3. Hasta hoy K.1 se vigilaba en `test/app/rama.dom.test.js`,
// y bien, pero con dos límites que el rework convierte en agujeros:
//
//   · Comparaba **una rama contra la otra**, mirando solo dentro de las
//     `<section>` marcadas con `data-rama-panel`. Todo lo que vive FUERA de una
//     rama —el pie, los avisos, la cabecera, los dos `<dialog>`, la barra de
//     edición, los cajones del mapa— no se comparaba con nada, y sin embargo
//     compite por el mismo `querySelector`.
//   · Corría sobre un DOBLE del panel de edificio y una cáscara montada a mano.
//     Aquí corre sobre `app/main.js` de verdad, ya arrancado arriba: es el único
//     fichero del repositorio donde la aplicación entera está en pie.
//
// ── LA REGLA, ESCRITA DE FORMA QUE NO CADUQUE ────────────────────────────────
// No es «que no se repita entre ramas» ni «que no se repita entre pasos»: es que
// **cada par atributo/valor de los cinco sea ÚNICO en el documento montado**,
// salvo los que se declaran GRUPO abajo. `querySelector` devuelve el primero en
// orden de documento —también si está `hidden`, también si está en la otra rama,
// también si está en un `<dialog>` cerrado—, así que el eje que metió el nodo ahí
// da igual. Escrito así, el guardián cubre rama×rama, paso×paso, rama×paso y
// compartido×cualquiera, y **no habrá que tocarlo cuando el rail aterrice**.
//
// Ya pasó una vez y está documentado en `index.html:326-330`: dos controles con
// el mismo nombre, uno se quedó mudo, y **nada avisó**.
//
// ── ⚠️ LOS DOS GRUPOS LEGÍTIMOS, DESTAPADOS AL ESCRIBIR ESTO ────────────────
// La primera versión de este guardián exigía unicidad a secas y salió ROJA sobre
// la aplicación real, con dos hallazgos que resultaron ser correctos:
// `data-campo="modelo-edificio"` (×2) y `data-campo="capa-elegida"` (×N). No son
// colisiones: son un grupo de radios y una casilla por capa del DXF, y **nadie
// los resuelve nunca con `querySelector` en singular** —producción los lee por su
// `Map` de radios y por `evento.target.dataset.campo`, y los tests con
// `querySelectorAll`—. O sea: la regla de K.1 no es «un valor, un nodo», es «un
// valor, un CONTROL». Un grupo de radios ES un control.
//
// Se declaran uno a uno, con dueño y motivo, y **cualquier otro duplicado sigue
// siendo rojo**. Además se comprueba que las excepciones no se queden rancias: un
// grupo que baje a un solo nodo deja de necesitar excepción.

describe('app/main · K.1 en dos ejes · ningún `data-*` se repite en el documento montado', () => {
  /** Los cinco `data-*` que el cableado resuelve por `querySelector` y guarda. */
  const DATOS_EXCLUSIVOS = [
    'data-campo',
    'data-accion',
    'data-estado',
    'data-ficha',
    'data-procedencia',
  ]

  /**
   * Los pares atributo/valor que SON un grupo a propósito, con quién los pone y
   * por qué no rompen K.1. Escrito a mano y corto: es una excepción, y una
   * excepción sin nombre y sin motivo es un agujero.
   */
  const GRUPOS_DECLARADOS = Object.freeze({
    'data-campo="modelo-edificio"':
      'los radios de MODELO_EDIFICIO (app/panel-edificio.js:717). Un grupo de radios ES un ' +
      'control: producción los lee por su Map, nunca por querySelector.',
    'data-campo="capa-elegida"':
      'una casilla por capa del DXF (app/panel-edificio.js:1083), leídas SIEMPRE con ' +
      'querySelectorAll acotado a su lista (app/panel-edificio.js:1122).',
  })

  /** Cuántos nodos tiene un par atributo/valor ahora mismo. */
  const cuantos = (par) => document.querySelectorAll(`[${par}]`).length

  /**
   * Los pares que aparecen más de una vez **y no están declarados como grupo**,
   * con su cuenta. Devuelve cadenas ya formateadas para que el fallo NOMBRE al
   * culpable en vez de decir «esperaba 0 y había 1».
   *
   * @returns {string[]}
   */
  function repetidosNoDeclarados() {
    const encontrados = []
    for (const atributo of DATOS_EXCLUSIVOS) {
      const cuenta = new Map()
      for (const el of document.querySelectorAll(`[${atributo}]`)) {
        const valor = el.getAttribute(atributo)
        cuenta.set(valor, (cuenta.get(valor) ?? 0) + 1)
      }
      for (const [valor, veces] of cuenta) {
        const par = `${atributo}="${valor}"`
        if (veces > 1 && !(par in GRUPOS_DECLARADOS)) encontrados.push(`${par} (×${veces})`)
      }
    }
    return encontrados
  }

  /** Cuántos nodos de contrato hay montados ahora mismo. */
  const censo = () =>
    DATOS_EXCLUSIVOS.reduce((n, a) => n + document.querySelectorAll(`[${a}]`).length, 0)

  it('con la rama PARCELA puesta', () => {
    expect(
      repetidosNoDeclarados(),
      'un `data-*` repetido deja mudo a uno de los dos controles: querySelector se queda con ' +
        'el primero del documento, también si está oculto',
    ).toEqual([])
  })

  it('con la rama EDIFICIO puesta (el conmutador no introduce colisiones)', () => {
    irA(RAMA.EDIFICIO)
    expect(repetidosNoDeclarados()).toEqual([])
  })

  it('y con las dos ramas montadas a la vez, que es SIEMPRE', () => {
    // Las secciones de la rama inactiva NO se sacan del DOM (ésa es la regla dura
    // de `app/rama.js`), así que las dos compiten siempre por el `querySelector`.
    // Que la de parcela esté `hidden` no la quita de en medio: ése es el motivo
    // entero por el que K.1 existe.
    expect(document.querySelectorAll('[data-rama-panel]').length).toBeGreaterThan(1)
    irA(RAMA.EDIFICIO)
    expect(document.querySelector('.gml-bloque--catastro').hidden).toBe(true)
    expect(document.querySelector('.gml-bloque--catastro').isConnected).toBe(true)
    expect(repetidosNoDeclarados()).toEqual([])
  })

  it('el censo no es vacuo: la aplicación entera trae más de treinta nodos de contrato', () => {
    // Un suelo, no un número exacto: `toBe(n)` sería una lista escrita a mano con
    // otro nombre y saldría roja cada vez que el marcado creciera con razón. Lo
    // que este `expect` impide es que el guardián de arriba salga verde porque no
    // había nada montado que mirar.
    expect(censo()).toBeGreaterThan(30)
  })

  it('⛔ el guardián NO es vacuo: un duplicado inyectado sale rojo y con nombre', () => {
    const intruso = document.createElement('p')
    intruso.setAttribute('data-estado', 'generar-gml') // ya existe en el pie
    document.body.appendChild(intruso)
    try {
      expect(repetidosNoDeclarados()).toEqual(['data-estado="generar-gml" (×2)'])
    } finally {
      intruso.remove()
    }
    expect(repetidosNoDeclarados()).toEqual([])
  })

  it('las excepciones no están rancias: los dos grupos declarados SIGUEN siendo grupos', () => {
    // Si un grupo baja a un solo nodo, la excepción sobra y hay que retirarla: un
    // permiso que ya no hace falta es un agujero abierto por si acaso.
    irA(RAMA.EDIFICIO)
    for (const [par, motivo] of Object.entries(GRUPOS_DECLARADOS)) {
      expect(
        cuantos(par),
        `«${par}» ya no es un grupo, así que su excepción sobra — ${motivo}`,
      ).toBeGreaterThan(1)
    }
  })

  it('⭐ el grupo de radios tiene UN solo `name`, que es lo que impide que dos paneles se fundan', () => {
    // `app/panel-edificio.js:713-715` sella el `name` con su marca justamente
    // porque «dos paneles en el mismo documento con el mismo `name` serían UN
    // grupo de radios, y elegir en uno desmarcaría el otro». Aquí se vigila.
    irA(RAMA.EDIFICIO)
    const radios = [...document.querySelectorAll('[data-campo="modelo-edificio"]')]
    expect(radios.length).toBeGreaterThan(1)
    const nombres = new Set(radios.map((r) => r.name))
    expect(nombres.size, 'los radios del grupo no comparten `name`: no son un grupo').toBe(1)
    const [nombre] = nombres
    expect(
      document.querySelectorAll(`input[name="${nombre}"]`).length,
      'hay radios de FUERA del grupo compartiendo su `name`: elegir en uno desmarcaría el otro',
    ).toBe(radios.length)
  })
})

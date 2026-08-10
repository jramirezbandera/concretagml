/* -------------------------------------------------------------------------- *
 * test/app/main-fincas.dom.test.js — F22 · T4.3 y T4.4                       *
 *                                                                            *
 * ⛔ ESTE FICHERO EXISTE POR LA LECCIÓN MÁS CARA DE F18.                      *
 *                                                                            *
 * Aquella fase estrenó el cuarto estado de `rotuloDelDato` y NADIE FUE A      *
 * MIRARLO: la cabecera dijo «Parcela del Catastro» sobre el levantamiento del *
 * propio técnico, y 6.339 pruebas estaban en verde. No fallaban una           *
 * afirmación — **la afirmación no existía**. Lo destapó el guion de humo.     *
 *                                                                            *
 * F22 estrena el SEXTO, así que se viene a mirar A PROPÓSITO, y con un        *
 * guardián que acusa por la AFIRMACIÓN y no por la forma del texto (cuarta    *
 * vez que este proyecto paga eso, ver F17 · fase 1 y F18).                    *
 *                                                                            *
 * Se monta la aplicación de verdad —el eyebrow no es una función exportada,   *
 * es un renglón que un usuario lee— y se le meten al store las parcelas que   *
 * cada vía produce, comprobando que cada una se rotula como lo que es.        *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { componerParcelaElegida } from '../../app/cableado-medicion.js'
import { SRS_DEMO } from '../../app/demo-datos.js'
import { husoPorSrs } from '../../geo/huso.js'
import { importar } from '../../parsers/importar.js'
import { ORIGEN_PARCELA, TIPO_RECINTO, crearParcela, crearRecinto } from '../../model/parcela.js'
import { crearBarraEdicion } from '../../viewer/barra-edicion.js'
import { crearCajonComprobacion } from '../../viewer/cajon-comprobacion.js'
import { crearCajonDiagnostico } from '../../viewer/cajon-diagnostico.js'
import { crearCajonParcelas } from '../../viewer/cajon-parcelas.js'
import { crearCapaCandidatas } from '../../viewer/candidatas.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearListaSobrante } from '../../viewer/lista-sobrante.js'
import { VARIANTE, crearCapaPiezas } from '../../viewer/piezas.js'
import {
  CLASE as CLASE_PARCELAS,
  SELECTOR as SELECTOR_PARCELAS,
  SELECTOR_CANDIDATA,
} from '../../viewer/cajon-parcelas.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

const RAIZ = join(import.meta.dirname, '..', '..')

// ── El espía del montaje ─────────────────────────────────────────────────────
//
// Mismo recurso que `main-comprobacion.dom.test.js`: se parte del visor REAL y
// solo se sustituye `crearVisor`, para que un export nuevo del visor no convierta
// este fichero en un fallo de importación.

const arranque = vi.hoisted(() => ({ opciones: null }))

/**
 * El cromo del mapa, con los módulos que lo fabrican en PRODUCCIÓN y no con
 * copias. Sin la barra de edición, el cajón de F07 y el de F08, `cablearEdicion`,
 * `cablearDiagnostico` y `cablearComprobacion` LANZAN —los tres van fuera del
 * `try` del Catastro— y este fichero no recolectaría ni un test.
 *
 * ⭐ F22 le añade sus dos piezas, y de verdad también: `cablearMedicion` hace duck
 * typing de `{cajon, capa}` y un doble a mano volvería a pasar por la puerta que
 * este mismo fichero existe para vigilar.
 */
let vivos = null
function montarCromoDelMapa() {
  const { mapa } = montarMapa()
  crearPanes(mapa)
  crearBarraEdicion({ mapa })
  const zona = husoPorSrs(SRS_DEMO)
  vivos = {
    mapa,
    diagnostico: { cajon: crearCajonDiagnostico({ mapa }), contraste: crearContraste({ mapa, zona }) },
    comprobacion: crearCajonComprobacion({ mapa }),
    parcelas: { cajon: crearCajonParcelas({ mapa }), capa: crearCapaCandidatas({ mapa, zona }) },
    sobrante: {
      lista: crearListaSobrante({ documento: document }),
      capa: crearCapaPiezas({ mapa, zona }),
      capaFuera: crearCapaPiezas({ mapa, zona, variante: VARIANTE.FUERA }),
    },
  }
}

vi.mock('../../viewer/index.js', async (importarOriginal) => ({
  ...(await importarOriginal()),
  crearVisor: (_contenedor, opciones) => {
    arranque.opciones = opciones
    montarCromoDelMapa()
    return {
      mapa: vivos.mapa,
      estado: opciones.estado,
      capas: {},
      acotaciones: null,
      edicion: {
        snapActivo: () => true,
        tolerancia: () => 0.2,
        ladoSeleccionado: () => null,
        alCambiarSeleccion: () => () => {},
        // El modo borrar (2026-08-10): el doble solo tiene que existir. Lo que
        // `cablearEdicion` le pide es leerlo, escribirlo y suscribirse.
        modoBorrar: () => false,
        alCambiarModoBorrar: () => () => {},
        fijarColindantes() {},
        desplazarSeleccion: () => ({ aplicado: false, modo: null, detecciones: [] }),
      },
      colindantes: { pintar() {}, limpiar() {}, destruir() {} },
      diagnostico: vivos.diagnostico,
      comprobacion: vivos.comprobacion,
      parcelas: vivos.parcelas,
      sobrante: vivos.sobrante,
      destruir() {},
    }
  },
}))

// La red no se toca en este fichero: nada de lo que se prueba la necesita.
vi.mock('../../services/_red.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    crearTransporte: () => ({
      pedir: () => {
        throw new Error('prueba: este fichero no toca la red')
      },
    }),
  }
})

// ── La cáscara, que TIENE que existir antes de importar `app/main.js` ────────

const HTML = readFileSync(join(RAIZ, 'index.html'), 'utf8')
const CASCARA = (() => {
  const encontrado = /<body([^>]*)>([\s\S]*?)<\/body>/i.exec(HTML)
  const clase = /class="([^"]*)"/i.exec(encontrado[1])
  const atributos = [...encontrado[1].matchAll(/([a-z-]+)="([^"]*)"/gi)]
    .filter(([, nombre]) => nombre !== 'class')
    .map(([, nombre, valor]) => [nombre, valor])
  return { clase: clase === null ? '' : clase[1], atributos, cuerpo: encontrado[2] }
})()

document.body.className = CASCARA.clase
for (const [nombre, valor] of CASCARA.atributos) document.body.setAttribute(nombre, valor)
document.body.innerHTML = CASCARA.cuerpo

window.history.replaceState({}, '', '?demo=real')
await import('../../app/main.js')

/** El store REAL del ensamblaje. */
const estado = arranque.opciones.estado

/** `FileList` de mentira: array-like, como la de verdad. */
function dobleFileList(ficheros) {
  const lista = { length: ficheros.length, item: (i) => ficheros[i] ?? null }
  ficheros.forEach((f, i) => {
    lista[i] = f
  })
  return lista
}

/** Suelta un `File` sobre la ventana, como haría el usuario. */
function soltar(fichero) {
  const evento = new Event('drop', { bubbles: true, cancelable: true })
  evento.dataTransfer = { types: ['Files'], files: dobleFileList([fichero]), dropEffect: 'none' }
  document.body.dispatchEvent(evento)
}

const ficheroDeBytes = (bytes, nombre) => new File([bytes], nombre, { type: '' })

/** Cede el turno al bucle de microtareas unas cuantas veces. */
async function cederTurno(veces = 60) {
  for (let vuelta = 0; vuelta < veces; vuelta += 1) await Promise.resolve()
}

const eyebrow = () => document.querySelector('[data-eyebrow]').textContent.trim()
const fichaColindantes = () => document.querySelector('[data-ficha="colindantes"]').textContent.trim()

// ── Las parcelas de cada vía ─────────────────────────────────────────────────

const ANILLO = [
  [386115.9, 4064386.0],
  [386139.9, 4064386.0],
  [386139.9, 4064417.5],
  [386115.9, 4064417.5],
]
const recintos = () => [crearRecinto(ANILLO, TIPO_RECINTO.EXTERIOR)]

/** Lo que produce «Traer del Catastro» (F05). */
const delWfs = () =>
  crearParcela({
    idLocal: '6346726UF8664N',
    refcat: '6346726UF8664N',
    recintos: recintos(),
    geometriaOficial: recintos(),
    origen: ORIGEN_PARCELA.WFS,
  })

/** Lo que produce la MEDICIÓN PROPIA de F18 sobre una parcela ya traída. */
const medicionPropia = () =>
  crearParcela({
    idLocal: '6346726UF8664N',
    refcat: '6346726UF8664N',
    // El levantamiento del técnico: distinto de la oficial, que es el punto.
    recintos: [crearRecinto(ANILLO.map(([x, y]) => [x + 0.4, y - 0.3]), TIPO_RECINTO.EXTERIOR)],
    geometriaOficial: recintos(),
    origen: ORIGEN_PARCELA.DXF,
  })

/** Y lo que produce F22 al elegir una finca de un dibujo del Catastro. */
const MANZANA = readFileSync(
  join(RAIZ, 'test/fixtures/parsers/manzana_consulta_masiva_6346726UF8664N.dxf'),
  'latin1',
)
const fincaElegida = (indice = 0) => {
  const r = importar(MANZANA, { capa: 'Parcela' })
  const aviso = r.detecciones.find(
    (d) => d?.datos?.bloqueo === 'VARIOS_RECINTOS_DISJUNTOS',
  )
  return componerParcelaElegida(r.anillos[indice], aviso.datos.recintos[indice], {
    origen: ORIGEN_PARCELA.DXF,
    nombreFichero: 'ConsultaMasiva_ (90).dxf',
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ═══════════════════════════════════════════════════════════════════════════

describe('main · F22 · el visor se monta con las dos piezas de elección', () => {
  it('`parcelas: true`, y no un objeto', () => {
    // `true` y no `{posicion}`: su única clave de montaje vale aquí exactamente lo
    // que su defecto, y escribirla fingiría una decisión no tomada.
    expect(arranque.opciones.parcelas).toBe(true)
  })
})

describe('main · F22 · T4.3 · LA CABECERA, que es donde F18 se hizo daño', () => {
  it('⛔ una finca elegida de un dibujo del Catastro NO se rotula «Tu medición»', () => {
    // Es el error caro de esta aplicación CON EL SIGNO CAMBIADO: atribuirle al
    // usuario una geometría que no ha medido. A partir de ahí corrige un lindero
    // creyéndolo propio, y firma.
    estado.set(fincaElegida())
    const rotulo = eyebrow()
    expect(rotulo).not.toMatch(/tu medici[óo]n/i)
    // Y sí afirma lo que es: cartografía del Catastro que vino en un dibujo.
    expect(rotulo).toMatch(/catastro/i)
    expect(rotulo).toMatch(/dibujo/i)
  })

  it('⚠️ y tampoco se rotula igual que lo que la app acaba de pedirle al WFS', () => {
    // La Sede actualiza su cartografía: un dibujo de junio no es lo que el WFS
    // contestaría hoy, y el técnico tiene que poder distinguirlos.
    estado.set(delWfs())
    const delServicio = eyebrow()
    estado.set(fincaElegida())
    expect(eyebrow()).not.toBe(delServicio)
  })

  it('⛔⛔ y la MEDICIÓN PROPIA de F18 sigue diciendo que es tuya', () => {
    // **Este es el guardián que de verdad importa.** El primer criterio que se
    // escribió para el rótulo nuevo fue «origen de fichero Y hay geometría
    // oficial», y habría reintroducido el defecto de F18 con otro disfraz:
    // `componerParcelaMedida` CONSERVA la `geometriaOficial` que hubiera —es toda
    // la decisión de aquella fase—, así que el flujo normal del perito (traigo la
    // oficial, meto MI levantamiento) habría acabado rotulado «Cartografía del
    // Catastro» sobre el dibujo del técnico.
    estado.set(medicionPropia())
    const rotulo = eyebrow()
    expect(rotulo).toMatch(/tu medici[óo]n/i)
    expect(rotulo).not.toMatch(/cartograf[íi]a del catastro/i)
  })

  it('⚠️ en cuanto se edita un vértice, la finca elegida pasa a ser TU medición', () => {
    // Consecuencia buscada del criterio: lo que hay en pantalla ya es la propuesta
    // del técnico, no la cartografía de la Sede. `geometriaOficial` sigue intacta
    // como referencia del Diagnóstico.
    const finca = fincaElegida()
    estado.set(finca)
    expect(eyebrow()).toMatch(/dibujo/i)

    const movida = crearParcela({
      ...finca,
      recintos: [
        crearRecinto(
          finca.recintos[0].vertices.map(([x, y], i) => (i === 0 ? [x + 0.25, y] : [x, y])),
          TIPO_RECINTO.EXTERIOR,
        ),
      ],
      geometriaOficial: finca.geometriaOficial,
    })
    estado.set(movida)
    expect(eyebrow()).toMatch(/tu medici[óo]n/i)
  })

  it('la vía del WFS no ha cambiado: sigue diciendo que la parcela es del Catastro', () => {
    // Anti-vacuidad de los tres de arriba: si el rótulo nuevo se hubiera comido al
    // viejo, todos ellos seguirían en verde y la app diría «del dibujo» sobre algo
    // que trajo el servicio.
    estado.set(delWfs())
    expect(eyebrow()).toMatch(/parcela del catastro/i)
    expect(eyebrow()).not.toMatch(/dibujo/i)
  })
})

describe('main · F22 · T4.4 · el RECORRIDO entero, soltando el fichero de verdad', () => {
  // ⭐ Aquí el cajón, la capa y el diálogo son los REALES: el doble solo sustituye
  // `crearVisor`. Es la diferencia entre probar que las piezas encajan y probar
  // que el usuario puede hacerlo — y es la mitad que a F18 le faltó.

  it('soltar la manzana ABRE el cajón con las ocho fincas y sus referencias', async () => {
    soltar(ficheroDeBytes(new TextEncoder().encode(MANZANA), 'ConsultaMasiva_ (90).dxf'))
    await cederTurno()

    // Primero el diálogo de capas, que es la decisión que ya existía.
    // ⚠️ Por su CLASE y no `document.querySelector('dialog')`: la aplicación monta
    // SIETE `<dialog>` (avisos, expediente, informe, pegado…) y el primero del
    // documento es el de avisos. Es la misma trampa del `querySelector` que la
    // lección M8 de F07 dejó escrita para los `data-estado`.
    const dialogo = document.querySelector('.gml-dialogo-importacion')
    expect(dialogo, 'no se ha abierto la ventana de revisión').not.toBeNull()
    const radioCapa = [...dialogo.querySelectorAll('input[type="radio"]')].find(
      (r) => r.value === 'Parcela',
    )
    expect(radioCapa, 'el diálogo no ofrece la capa «Parcela»').toBeTruthy()
    radioCapa.checked = true
    radioCapa.dispatchEvent(new Event('change', { bubbles: true }))
    dialogo
      .querySelector('[data-accion="importar-medicion"]')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await cederTurno()

    const cajon = document.querySelector(`.${CLASE_PARCELAS.CONTENEDOR}`)
    expect(cajon, 'no se ha montado el cajón de fincas').not.toBeNull()
    expect(cajon.style.display).not.toBe('none')
    expect(cajon.textContent).toContain('6346726UF8664N')
    expect(cajon.querySelectorAll(SELECTOR_CANDIDATA)).toHaveLength(8)
  })

  it('⛔ y al elegir una, la ficha DICE que las vecinas salen del dibujo', async () => {
    const cajon = document.querySelector(`.${CLASE_PARCELAS.CONTENEDOR}`)
    const radio = cajon.querySelectorAll(SELECTOR_CANDIDATA)[0]
    radio.checked = true
    radio.dispatchEvent(new Event('change', { bubbles: true }))
    cajon
      .querySelector(SELECTOR_PARCELAS.CONFIRMAR)
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await cederTurno()

    // La finca ha entrado…
    expect(estado.get().refcat).toBe('6346726UF8664N')
    // …y el recuento de vecinas no se limita a decir «7»: dice de dónde salen. El
    // número solo no distingue una consulta a la Sede de las siete fincas que
    // sobran de un dibujo, y confundirlas es afirmar una procedencia que la
    // pantalla no respalda — el error de F18 un piso más abajo.
    expect(fichaColindantes()).toContain('7')
    expect(fichaColindantes()).toMatch(/dibujo/i)
  })

  it('⚠️ y la cabecera, con el recorrido REAL, tampoco dice «Tu medición»', () => {
    // El mismo guardián de arriba pero llegando por donde llega el usuario, que es
    // lo único que habría cazado el defecto de F18 antes del guion de humo.
    expect(eyebrow()).not.toMatch(/tu medici[óo]n/i)
    expect(eyebrow()).toMatch(/dibujo/i)
  })

  it('⛔ y el renglón de procedencia NO desmiente a la cabecera', () => {
    // **El guion 24 encontró a la aplicación diciendo dos cosas contrarias sobre
    // la misma geometría con dos centímetros de separación**: arriba «Cartografía
    // del Catastro · del dibujo» y debajo «Geometría medida por ti … NO del
    // Catastro», porque el renglón reutilizaba el texto de F18 tal cual. Una
    // cabecera correcta con un pie que la desmiente no es media verdad: es la
    // misma mentira, y la que se lee al firmar es la de abajo.
    const renglon = document.querySelector('[data-procedencia="parcela"]').textContent.trim()
    expect(renglon).not.toMatch(/medida por ti/i)
    expect(renglon).not.toMatch(/NO del Catastro/i)
    // Y dice las dos cosas que lo separan de una consulta al servicio.
    expect(renglon).toMatch(/6346726UF8664N/)
    expect(renglon).toMatch(/no de una consulta/i)
  })

  it('⛔ y NO aterriza en Diagnóstico, que fue lo que se comía las siete vecinas', () => {
    // **Lo destapó el guion 24.** Una finca del DXF entra con
    // `recintos === geometriaOficial`, así que el encaje vale CERO por
    // construcción y aterrizar en Diagnóstico enseña un dictamen tautológico como
    // si fuera un resultado. Y tenía una segunda mitad, peor: abrir el Diagnóstico
    // dispara `pedirVecinas()`, que sustituía las SIETE fincas del dibujo por las
    // que devuelve el WFS —7 → 3 medido en Chrome— cincuenta milisegundos después
    // de haberlas pintado, y sin decir una palabra.
    expect(document.body.dataset.paso).toBe('edicion')

    // La mitad no vacua: las vecinas del dibujo siguen contadas después del
    // aterrizaje. Con el destino anterior, aquí ponía «3» y sin el «· del dibujo».
    expect(fichaColindantes()).toContain('7')
    expect(fichaColindantes()).toMatch(/dibujo/i)
  })
})

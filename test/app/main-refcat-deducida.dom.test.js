/* -------------------------------------------------------------------------- *
 * test/app/main-refcat-deducida.dom.test.js — auditoría 2026-08-16 · H1 y H2  *
 *                                                                            *
 * ⛔ LA VARIABLE QUE PROMETÍA UNA COSA Y HACÍA OTRA.                          *
 *                                                                            *
 * `app/main.js#refcatDeducida` lleva escrito en su JSDoc que «se borra en     *
 * cuanto entra parcela nueva», y da el motivo: «una referencia deducida de la *
 * geometría ANTERIOR pintada sobre la actual sería una afirmación falsa sobre *
 * lo que hay en pantalla». La auditoría encontró que de las CUATRO puertas de *
 * documento nuevo sólo DOS la borraban, y que la deducción automática que la  *
 * escribe no tenía ninguna guarda de vigencia: una promesa suelta que, al     *
 * resolverse, escribía en la ficha del documento que estuviera puesto.        *
 *                                                                            *
 * Los dos defectos se ven en el MISMO renglón de la ficha —el de la           *
 * referencia catastral— y son la misma frase falsa dicha por dos caminos, así *
 * que se prueban juntos y sobre la aplicación VIVA: lo que se afirma aquí es  *
 * lo que un técnico lee justo antes de firmar.                                *
 *                                                                            *
 *   · **H1** — se importa un dibujo sin referencia (la app deduce una y la    *
 *     ficha la pinta con su coletilla) y después se abre un proyecto guardado *
 *     cuya parcela TAMPOCO trae referencia. La ficha tiene que decir «Sin     *
 *     referencia», no la referencia de la parcela anterior.                    *
 *   · **H2** — lo mismo, pero con la consulta del PRIMER dibujo todavía en el  *
 *     aire: se resuelve DESPUÉS de que el documento haya cambiado. Ese es el  *
 *     caso que ningún orden de resolución natural produce y que el token de   *
 *     vigencia existe para cubrir; con el transporte resolviendo en orden,    *
 *     esta prueba pasaría sin token y no probaría nada (misma decisión que    *
 *     `test/app/catastro.dom.test.js`, decisión 3).                            *
 *                                                                            *
 * ── EL ARNÉS: LA APP DE VERDAD, Y SÓLO DOS DOBLES ──                          *
 * Se importa `app/main.js` sobre la cáscara real de `index.html` (mismo camino *
 * que `main-fincas.dom.test.js`) y se dobla lo justo:                          *
 *   · `crearVisor`, porque un `L.Map` completo no pinta nada en esta historia; *
 *   · el TRANSPORTE, no el cliente: `crearClienteCatastro` y                    *
 *     `cablearCatastro` son los REALES y sirven el fixture `ovc-rccoor-ok.json` *
 *     capturado con `curl`. Así la referencia que acaba en la ficha sale del   *
 *     código de producción y no de una imitación.                              *
 *                                                                            *
 * ── MUTACIONES EJECUTADAS (para comprobar que no son guardianes vacuos) ──    *
 * Cada una aplicada a `app/main.js`, corrida `npm run test:dom -- refcat` y    *
 * revertida con el editor (nunca con `git checkout`).                          *
 *   M1 · quitar `entraDocumentoNuevo()` de la puerta del EXPEDIENTE (dejar     *
 *        `alCargarParcela: edicionCableada.alCargarParcela` a pelo, que es el  *
 *        estado en el que la auditoría lo encontró) → 2 rojos: el de H1 y el   *
 *        primer tramo del de H2.                                               *
 *   M2 · quitar el cotejo `sello !== selloDocumento` de                        *
 *        `deducirRefcatTrasImportar` → 1 rojo, el de H2: la respuesta de la    *
 *        importación anterior escribe su referencia sobre el documento nuevo.  *
 *        Y el de H1 sigue VERDE, que es la otra mitad de por qué hacen falta   *
 *        las dos piezas.                                                       *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { SRS_DEMO } from '../../app/demo-datos.js'
import { aProyecto } from '../../export/proyecto.js'
import { husoPorSrs } from '../../geo/huso.js'
import {
  ORIGEN_PARCELA,
  TIPO_RECINTO,
  crearExpediente,
  crearParcela,
  crearRecinto,
} from '../../model/parcela.js'
import { crearBarraEdicion } from '../../viewer/barra-edicion.js'
import { crearCajonComprobacion } from '../../viewer/cajon-comprobacion.js'
import { crearCajonDiagnostico } from '../../viewer/cajon-diagnostico.js'
import { crearCajonParcelas } from '../../viewer/cajon-parcelas.js'
import { crearCapaCandidatas } from '../../viewer/candidatas.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearListaSobrante } from '../../viewer/lista-sobrante.js'
import { VARIANTE, crearCapaPiezas } from '../../viewer/piezas.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

const RAIZ = join(import.meta.dirname, '..', '..')

/** El `Consulta_RCCOOR` real: UN candidato, `9398516VK3799G`. */
const TEXTO_RCCOOR = readFileSync(
  join(RAIZ, 'test', 'fixtures', 'catastro', 'ovc-rccoor-ok.json'),
  'utf8',
)
/** La referencia que ese fixture deduce, DERIVADA de él y no copiada a mano. */
const REFCAT_DEDUCIDA = (() => {
  const { pc } = JSON.parse(TEXTO_RCCOOR).Consulta_RCCOORResult.coordenadas.coord[0]
  return `${pc.pc1}${pc.pc2}`
})()

// ── El transporte doble, con resolución MANUAL ──────────────────────────────
//
// Cumple el puerto que `crearClienteCatastro` exige (`pedirTexto`, `estado`,
// `destruir`) y **no conoce `fetch`**: es imposible que esta suite toque la red.
// Cada petición queda PENDIENTE y el test decide cuándo contesta, que es la única
// forma de montar el caso de H2 (la primera consulta contesta bien y TARDE).

const red = vi.hoisted(() => ({ pendientes: [] }))

vi.mock('../../services/_red.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    crearTransporte: () => ({
      async pedirTexto(url) {
        let resolver
        const promesa = new Promise((cumplir) => {
          resolver = cumplir
        })
        red.pendientes.push({
          url,
          responder: () =>
            resolver({
              ok: true,
              estado: 200,
              texto: TEXTO_RCCOOR,
              tipoContenido: 'application/json',
              motivo: null,
              mensaje: null,
              intentos: 1,
              ms: 1,
              url,
            }),
        })
        return promesa
      },
      estado: () => ({ peticiones: red.pendientes.length }),
      destruir() {},
    }),
  }
})

/** Contesta a todo lo que esté en el aire, en el orden en que se pidió. */
function responderTodo() {
  const enElAire = red.pendientes.splice(0)
  for (const peticion of enElAire) peticion.responder()
}

// ── El espía del montaje ─────────────────────────────────────────────────────
//
// Mismo recurso que `main-fincas.dom.test.js`: se parte del visor REAL y sólo se
// sustituye `crearVisor`, para que un export nuevo del visor no convierta este
// fichero en un fallo de importación.

const arranque = vi.hoisted(() => ({ opciones: null }))

let vivos = null
function montarCromoDelMapa() {
  const { mapa } = montarMapa()
  crearPanes(mapa)
  crearBarraEdicion({ mapa })
  const zona = husoPorSrs(SRS_DEMO)
  vivos = {
    mapa,
    diagnostico: {
      cajon: crearCajonDiagnostico({ mapa }),
      contraste: crearContraste({ mapa, zona }),
    },
    comprobacion: crearCajonComprobacion({ mapa }),
    parcelas: { cajon: crearCajonParcelas({ mapa }), capa: crearCapaCandidatas({ mapa, zona }) },
    sobrante: {
      lista: crearListaSobrante({ documento: document }),
      capa: crearCapaPiezas({ mapa, zona }),
      capaFuera: crearCapaPiezas({ mapa, zona, variante: VARIANTE.FUERA }),
      capaVecinos: crearCapaPiezas({ mapa, zona, variante: VARIANTE.VECINO }),
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

// ── Gestos del usuario ───────────────────────────────────────────────────────

/** `FileList` de mentira: array-like, como la de verdad. */
function dobleFileList(ficheros) {
  const lista = { length: ficheros.length, item: (i) => ficheros[i] ?? null }
  ficheros.forEach((f, i) => {
    lista[i] = f
  })
  return lista
}

/** Suelta un `File` sobre la ventana, que es la ÚNICA zona de la aplicación. */
function soltar(texto, nombre) {
  const fichero = new File([new TextEncoder().encode(texto)], nombre, { type: '' })
  const evento = new Event('drop', { bubbles: true, cancelable: true })
  evento.dataTransfer = { types: ['Files'], files: dobleFileList([fichero]), dropEffect: 'none' }
  document.body.dispatchEvent(evento)
}

/** Cede el turno al bucle de microtareas unas cuantas veces. */
async function cederTurno(veces = 80) {
  for (let vuelta = 0; vuelta < veces; vuelta += 1) await Promise.resolve()
}

/** El renglón de la ficha que dice la referencia catastral. Lo que se lee al firmar. */
const fichaRefcat = () => document.querySelector('[data-ficha="refcat"]').textContent.trim()

// ── Los dos documentos de la historia ────────────────────────────────────────

// El cuadrado «limpio» de `cableado-medicion.dom.test.js`, y por su motivo escrito
// allí: en Málaga (386130, 4064400) las otras dos lecturas de huso mueren solas, así
// que la importación NO abre la pantalla de ambigüedad y entra derecha.
const DIBUJO_SIN_REFERENCIA =
  '386130.00 4064400.00\n386140.00 4064400.00\n386140.00 4064410.00\n386130.00 4064410.00'

/**
 * Un proyecto guardado cuya parcela **tampoco trae referencia**. Es el caso que la
 * auditoría verificó por traza, y el que hace visible el defecto: si la ficha
 * prefiriera la del modelo no habría nada que ver.
 */
const PROYECTO_SIN_REFERENCIA = JSON.stringify(
  aProyecto(
    crearExpediente({
      srs: SRS_DEMO,
      parcela: crearParcela({
        idLocal: 'proyecto-sin-referencia',
        origen: ORIGEN_PARCELA.DXF,
        recintos: [
          crearRecinto(
            [
              [386200, 4064500],
              [386220, 4064500],
              [386220, 4064520],
              [386200, 4064520],
            ],
            TIPO_RECINTO.EXTERIOR,
          ),
        ],
      }),
    }),
    // Instante FIJO: `aProyecto` no consulta el reloj a propósito (la fecha entra
    // por parámetro), así que aquí tampoco se consulta.
    { fecha: new Date(Date.UTC(2026, 7, 16, 9, 0, 0)), nombre: 'Proyecto sin referencia' },
  ),
)

// ═══════════════════════════════════════════════════════════════════════════

describe('main · H1 · la referencia DEDUCIDA no sobrevive al documento que la dedujo', () => {
  it('se importa un dibujo sin referencia y la ficha pinta la deducida, con su coletilla', async () => {
    soltar(DIBUJO_SIN_REFERENCIA, 'levantamiento.txt')
    await cederTurno()
    // La consulta del OVC está en el aire: se contesta ahora, en orden.
    responderTodo()
    await cederTurno()

    // Anti-vacuidad de todo el fichero: sin esto, los dos guardianes de abajo
    // pasarían sobre una ficha que nunca llegó a decir nada.
    expect(fichaRefcat(), 'la app no ha deducido nada: no hay defecto que probar').toContain(
      REFCAT_DEDUCIDA,
    )
    expect(fichaRefcat()).toMatch(/deducida, sin confirmar/i)
  })

  it('⛔ y al abrir un proyecto guardado SIN referencia, la ficha NO la hereda', async () => {
    // Es la afirmación falsa que `refcatDeducida` declara impedir: la referencia de
    // la parcela ANTERIOR pintada sobre la que hay ahora en pantalla. El técnico la
    // lee, la da por buena y firma un expediente contra la parcela de otro.
    soltar(PROYECTO_SIN_REFERENCIA, 'proyecto.json')
    await cederTurno()

    expect(fichaRefcat()).not.toContain(REFCAT_DEDUCIDA)
    expect(fichaRefcat()).not.toMatch(/deducida/i)
    expect(fichaRefcat()).toMatch(/sin referencia/i)
  })
})

describe('main · H2 · una deducción SUPERADA no escribe en la ficha del documento nuevo', () => {
  it('⛔ la consulta del dibujo anterior contesta TARDE y su referencia se descarta', async () => {
    // El caso que ningún orden natural produce: se suelta el dibujo, la consulta se
    // queda en el aire, entra OTRO documento y sólo entonces contesta. Sin cotejo de
    // vigencia, ese `then` escribe la referencia del dibujo que ya no está.
    soltar(DIBUJO_SIN_REFERENCIA, 'otro-levantamiento.txt')
    await cederTurno()
    expect(red.pendientes.length, 'la deducción no ha llegado a pedir nada').toBeGreaterThan(0)

    // Documento nuevo mientras la consulta sigue en el aire.
    soltar(PROYECTO_SIN_REFERENCIA, 'proyecto.json')
    await cederTurno()
    expect(fichaRefcat(), 'la puerta del expediente no ha borrado la deducción (H1)').toMatch(
      /sin referencia/i,
    )

    // Y ahora contesta la vieja.
    responderTodo()
    await cederTurno()

    expect(fichaRefcat()).not.toContain(REFCAT_DEDUCIDA)
    expect(fichaRefcat()).toMatch(/sin referencia/i)
  })
})

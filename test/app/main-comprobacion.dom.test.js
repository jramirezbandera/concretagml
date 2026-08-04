/* -------------------------------------------------------------------------- *
 * test/app/main-comprobacion.dom.test.js — F08 · T5.1 · el paso 9, ensamblado  *
 *                                                                              *
 * Las seis piezas de F08 están hechas y probadas una por una, y `app/           *
 * cableado-comprobacion.js` (T4.1) ya las une — con su propia suite completa,   *
 * `test/app/comprobacion.dom.test.js`. Lo que hasta esta tarea no ejecutaba     *
 * NADIE es el ensamblaje: mientras `app/main.js` no monte el paso 9, F08 entera *
 * sigue siendo código que solo existe en los tests.                             *
 *                                                                              *
 * ── QUÉ SE PRUEBA AQUÍ, Y QUÉ NO ──                                            *
 * NO se vuelven a probar la decodificación, la comprobación, el cajón, la zona  *
 * de fichero ni el cableado de F08: cada uno tiene su suite. Aquí se prueban    *
 * las cosas que **no son de ninguna función sino del ORDEN del arranque**:      *
 *   1. que el visor se monta con `comprobacion: true` y su cajón nace cerrado;  *
 *   2. que la app arranca IGUAL cuando el cliente del Catastro no se ha podido  *
 *      construir —el paso 9 va fuera del `try` del paso 7— y que entonces       *
 *      comprobar un fichero sigue funcionando, sin parcelario y DICIÉNDOLO;     *
 *   3. que el botón «Abrir un GML…» del rótulo está enganchado de verdad;       *
 *   4. que las dos features quedan ENLAZADAS: el informe que se descarga desde  *
 *      el cajón de F07 lleva la sección del fichero cuando la parcela vino de   *
 *      uno, y no la lleva cuando vino por referencia catastral;                 *
 *   5. que el desmontaje del paso 9 deja la pantalla limpia — y eso incluye los *
 *      oyentes de la VENTANA, que son los que sobrevivirían a la pantalla.      *
 *                                                                              *
 * ── DECISIÓN 1 · DOS ARRANQUES EN EL MISMO FICHERO ──                          *
 * `app/main.js` se ejecuta AL IMPORTARLO y una sola vez por registro de         *
 * módulos, así que un fichero de test = un arranque… salvo que se reinicie el   *
 * registro. El caso «el cliente del Catastro no se ha podido crear» es un       *
 * ARRANQUE distinto, no un estado al que se pueda llevar el primero: se monta   *
 * con `vi.resetModules()` + un `import()` dinámico, en el ÚLTIMO `describe` del *
 * fichero y dentro de su `beforeAll`, porque Vitest ejecuta las suites en el    *
 * orden del fichero y ese segundo arranque se lleva por delante el `<body>` —y  *
 * con él el mapa— del primero.                                                  *
 *                                                                              *
 * ── DECISIÓN 2 · NO SE REMONTA LA CÁSCARA ENTRE PRUEBAS ──                     *
 * Al revés que `main-edicion.dom.test.js`, aquí NO hay un `beforeEach` que      *
 * reponga el `<body>`: lo que se prueba es la app VIVA (soltar un fichero,      *
 * pulsar «Contrastar», descargar el informe), y `document.body.innerHTML = …`   *
 * destruiría el contenedor del mapa y con él los dos cajones que el arranque    *
 * tiene en la mano. El precio es que las pruebas del primer arranque comparten  *
 * estado, así que cada una deja el sistema como lo encontró y la que desmonta   *
 * va la última, con su motivo escrito.                                          *
 *                                                                              *
 * ── DECISIÓN 3 · SE DOBLAN CUATRO MÓDULOS, Y NINGUNO DE F08 ──                 *
 *   · `viewer/index.js` — `crearVisor` monta un `L.Map` con capas, WMS, tabla y *
 *     encuadre, y nada de eso tiene que ver con ensamblar el paso 9. El doble   *
 *     CAPTURA sus opciones (de ahí sale la afirmación 1) y reproduce el efecto  *
 *     del original sobre el DOCUMENTO con los módulos DE VERDAD: la barra de    *
 *     F06, el cajón y la capa de F07, y el cajón de F08. Un doble escrito a     *
 *     mano sería una segunda redacción de esas APIs —`cablearComprobacion`      *
 *     comprueba siete métodos por duck typing— que se desincroniza en silencio. *
 *   · `services/_red.js` — el transporte. Es lo único que tocaría la red, y     *
 *     `peticiones` es además el espía con el que se afirma que no se pide nada  *
 *     cuando no hay con qué.                                                     *
 *   · `services/catastro.js` — SOLO para poder hacer que `crearClienteCatastro` *
 *     lance en el segundo arranque. Todo lo demás del módulo pasa tal cual.     *
 *   · `gml/descargar.js` — `descargarTexto` se ENVUELVE (no se sustituye): se   *
 *     apunta el texto y se delega en el módulo real con un `documento` y una    *
 *     `url` inyectados, que es lo que el propio módulo admite para esto. Así el *
 *     texto que se afirma es el que habría bajado a la carpeta de descargas.    *
 *   · Los tres módulos de F08 —`app/cableado-comprobacion.js`,                   *
 *     `app/zona-fichero.js` y `comprobacion/gml.js`— son los REALES. Doblar     *
 *     cualquiera de ellos convertiría este fichero en un test de sus dobles.    *
 *                                                                              *
 * `app/cableado-diagnostico.js` es un caso aparte y NO es un doble: se          *
 * intercepta la llamada para quedarse con las OPCIONES y con la API que         *
 * devuelve, y acto seguido se delega en el módulo real. Es la única forma de    *
 * leer el envoltorio `comprobacion` que `app/main.js` le pasa —la pieza que     *
 * enlaza las dos features— sin exportarlo desde el arranque solo para el test.  *
 *                                                                              *
 * ── ⚠️ LA TRAMPA DE ENTORNO, MEDIDA EN T4.1 Y QUE AQUÍ SIGUE VIVA ──           *
 * `readFileSync` devuelve un `Buffer` del realm de Node, y bajo jsdom el        *
 * `instanceof Uint8Array` de `gml/decodificar.js` da `false` sobre él. Los      *
 * bytes de un fixture se pasan SIEMPRE por `Uint8Array.from(...)`. Y jsdom no   *
 * implementa `DataTransfer` ni `DragEvent`: el `drop` se fabrica con `Event` +  *
 * un doble de `dataTransfer`.                                                   *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'

import {
  SELECTOR_BOTON_CARGAR,
  SELECTOR_ESTADO_CATASTRO,
} from '../../app/cableado-catastro.js'
import {
  COLA_SIN_PARCELARIO,
  MOTIVO_SIN_CLIENTE,
  SELECTOR_BOTON_ABRIR,
  SELECTOR_PROCEDENCIA,
} from '../../app/cableado-comprobacion.js'
import { SELECTOR_BOTON_DIAGNOSTICAR, SELECTOR_ESTADO_DIAGNOSTICO } from '../../app/cableado-diagnostico.js'
import { SRS_DEMO } from '../../app/demo-datos.js'
import { CLASE_INPUT } from '../../app/zona-fichero.js'
import { husoPorSrs } from '../../geo/huso.js'
import { ORIGEN_PARCELA } from '../../model/parcela.js'
import { crearBarraEdicion } from '../../viewer/barra-edicion.js'
import { SELECTOR as SELECTOR_COMP, crearCajonComprobacion } from '../../viewer/cajon-comprobacion.js'
import { SELECTOR as SELECTOR_DIAG, crearCajonDiagnostico } from '../../viewer/cajon-diagnostico.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

// ── Fixtures REALES ──────────────────────────────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')
const leerTexto = (...ruta) => readFileSync(join(RAIZ, ...ruta), 'utf8')
/** ⚠️ `Uint8Array.from`, nunca el `Buffer` a pelo. Ver la cabecera. */
const leerBytes = (...ruta) => Uint8Array.from(readFileSync(join(RAIZ, ...ruta)))

/** La respuesta REAL del WFS para la parcela de la demo: la única con refcat. */
const RUTA_WFS = ['test', 'fixtures', 'gml', 'cp_parcela_9398516VK3799G.gml']
const TEXTO_WFS = leerTexto(...RUTA_WFS)
/** `GetNeighbourParcel` real: 5 miembros para 4 colindantes (override O15). */
const TEXTO_VECINDAD = leerTexto('test', 'fixtures', 'catastro', 'wfs-neighbour-9398516VK3799G.xml')
/** La plantilla oficial de ALTA: su referencia catastral viene VACÍA (`''`). */
const RUTA_PLANTILLA = ['test', 'fixtures', 'gml', 'cp_ejemplo_explicativo.gml']

/**
 * El fichero «de otro despacho»: la misma parcela con el primer vértice movido
 * 2,5 m al noreste. Es una derivación DE TEST —no describe ningún caso del
 * dominio, así que no va a `test/fixtures/gml/derivados/`— y su única función es
 * que la geometría del FICHERO y la del WFS sean distinguibles vértice a vértice.
 * Sin esa diferencia, «la del fichero es la que entra» no se puede afirmar.
 */
const VERTICE_WFS = [439283.23, 4479671.27]
const VERTICE_FICHERO = [439285.73, 4479673.77]
const TEXTO_FICHERO_MOVIDO = TEXTO_WFS.replaceAll(
  `${VERTICE_WFS[0]} ${VERTICE_WFS[1]}`,
  `${VERTICE_FICHERO[0]} ${VERTICE_FICHERO[1]}`,
)

// ── El estado compartido con las fábricas de `vi.mock` (que se izan) ─────────

/**
 * `vi.mock` se IZA por encima de todo y su fábrica no puede leer un `const` de
 * este módulo. `vi.hoisted` es la vía oficial para compartir un objeto con ella.
 */
const arranque = vi.hoisted(() => {
  const peticiones = []
  const estado = {
    /** Opciones con las que `app/main.js` montó el visor. */
    opciones: null,
    /** Opciones con las que `app/main.js` cableó el diagnóstico (F07). */
    diagnostico: null,
    /** Lo que devolvió `cablearDiagnostico`, para disparar el informe. */
    apiDiagnostico: null,
    /** Textos que han pasado por `descargarTexto`, en orden. */
    informes: [],
    /** URLs pedidas al transporte. Vacío = no se ha tocado la red. */
    peticiones,
    /** ¿Debe reventar `crearClienteCatastro`? Lo enciende el segundo arranque. */
    fallarCliente: false,
    /** Qué contesta el transporte. Se rellena abajo, con los fixtures ya leídos. */
    responder: () => {
      throw new Error('el transporte doble no tiene respuesta configurada')
    },
  }
  estado.transporte = {
    async pedirTexto(url) {
      peticiones.push(url)
      return estado.responder(url)
    },
    estado: () => ({ peticiones: peticiones.length }),
    destruir() {},
  }
  return estado
})

// ── El cromo del mapa: el otro efecto de `crearVisor` sobre el documento ─────

/** El `L.Map` del arnés, vivo. F11: lo consume `viewer/partes.js` (ver abajo). */
let mapaVivo = null
/** El cajón de F07 y su capa, vivos. */
let diagnosticoVivo = null
/** El cajón de F08, vivo. SUELTO, como en el visor real. */
let comprobacionViva = null

/**
 * Pone en el documento lo que `crearVisor` monta SOBRE EL MAPA, con los módulos
 * que lo fabrican en producción y no con copias (decisión 3): los siete nodos de
 * la barra de edición, el cajón y la capa de contraste de F07, y el cajón de F08.
 * Sin los tres últimos, `cablearEdicion`, `cablearDiagnostico` y
 * `cablearComprobacion` lanzan —los tres van FUERA del `try` del Catastro— y este
 * fichero no recolectaría ni un test.
 */
function montarCromoDelMapa() {
  const { mapa } = montarMapa()
  crearPanes(mapa)
  crearBarraEdicion({ mapa })
  // ⚠️ F11: el `L.Map` DE VERDAD se guarda y va al doble. Hasta aquí el
  // `visor.mapa` era `{on, off}` —lo justo que consume `cablearCatastro` por duck
  // typing—, y desde F11 hay un segundo consumidor, `viewer/partes.js`, que
  // necesita `addLayer`/`removeLayer`/`getPane` para pintar las huellas.
  mapaVivo = mapa
  diagnosticoVivo = {
    cajon: crearCajonDiagnostico({ mapa }),
    // El huso se DERIVA del SRS del expediente con la misma función que la app.
    contraste: crearContraste({ mapa, zona: husoPorSrs(SRS_DEMO) }),
  }
  comprobacionViva = crearCajonComprobacion({ mapa })
}

// ── Los cuatro dobles ────────────────────────────────────────────────────────

vi.mock('../../viewer/index.js', async (importarOriginal) => ({
  // ⚠️ F11: se PARTE del módulo real y solo se sustituye `crearVisor`. Antes el
  // doble era un objeto literal con una sola clave, y eso convertía cualquier
  // export NUEVO del visor en un fallo de importación de este fichero — que es lo
  // que pasó al exportar `encuadrarSobreRecintos` (T1.5), que consume
  // `app/cableado-edificio.js`. Con `importOriginal` el doble es exactamente lo
  // que dice ser: el visor real con el montaje sustituido.
  ...(await importarOriginal()),
  crearVisor: (_contenedor, opciones) => {
    arranque.opciones = opciones
    montarCromoDelMapa()
    return {
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
      // La capa de vecinas: doblada y muda, por lo mismo que `edicion`. Tiene que
      // EXISTIR porque `app/main.js` monta el visor con `colindantes: true` y el
      // suscriptor que las dibuja llama a `visor.colindantes.pintar(...)` a pelo.
      colindantes: { pintar() {}, limpiar() {}, destruir() {} },
      diagnostico: diagnosticoVivo,
      comprobacion: comprobacionViva,
      destruir() {},
    }
  },
}))

vi.mock('../../services/_red.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return { ...original, crearTransporte: () => arranque.transporte }
})

vi.mock('../../services/catastro.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    crearClienteCatastro: (opciones) => {
      if (arranque.fallarCliente) {
        throw new Error('prueba: el cliente del Catastro no se ha podido construir')
      }
      return original.crearClienteCatastro(opciones)
    },
  }
})

vi.mock('../../gml/descargar.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    descargarTexto: (texto, opciones) => {
      arranque.informes.push(texto)
      // Se DELEGA en el real con el documento y la URL inyectados (decisión 3):
      // jsdom no implementa `URL.createObjectURL`, y sustituir la función entera
      // dejaría sin ejercitar el único camino de entrega que tiene la app.
      return original.descargarTexto(texto, { ...opciones, ...entregaEspia() })
    },
  }
})

/** `documento` + `url` de mentira para `descargarTexto`, sin `Blob` real. */
function entregaEspia() {
  return {
    url: { createObjectURL: () => 'blob:https://concreta.test/0', revokeObjectURL() {} },
    documento: {
      body: document.body,
      createElement(etiqueta) {
        const el = document.createElement(etiqueta)
        if (etiqueta === 'a') el.click = () => {}
        return el
      },
    },
  }
}

// `cablearDiagnostico` NO se dobla: se intercepta para quedarse con las opciones
// —de ahí sale el envoltorio `comprobacion` que enlaza las dos features— y con la
// API que devuelve, y se delega en el módulo REAL.
vi.mock('../../app/cableado-diagnostico.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    cablearDiagnostico: (opciones) => {
      arranque.diagnostico = opciones
      arranque.apiDiagnostico = original.cablearDiagnostico(opciones)
      return arranque.apiDiagnostico
    },
  }
})

// Ídem con `cablearComprobacion`: hace falta su `destruir()` para poder afirmar
// que el desmontaje limpia, y `app/main.js` no exporta el cableado (ni debe: no
// hay ninguna otra razón de producto para sacarlo del arranque).
vi.mock('../../app/cableado-comprobacion.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    cablearComprobacion: (opciones) => {
      arranque.comprobacion = opciones
      arranque.apiComprobacion = original.cablearComprobacion(opciones)
      return arranque.apiComprobacion
    },
  }
})

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────

const CASCARA_INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body([^>]*)>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/main-comprobacion.dom.test.js: no se ha encontrado el <body> de index.html. La ' +
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

const CUERPO_INDEX = CASCARA_INDEX.cuerpo

/**
 * ⚠️ Repone también la CLASE del `<body>`, que hasta F11 se perdía: el `innerHTML`
 * copia lo de DENTRO del `<body>` y nada de su etiqueta de apertura. `app/rama.js`
 * resuelve `.gml-app` para colgar ahí el `data-rama` y **LANZA** si no está.
 */
const montarCascara = () => {
  document.body.className = CASCARA_INDEX.clase
  for (const [nombre, valor] of CASCARA_INDEX.atributos) {
    document.body.setAttribute(nombre, valor)
  }
  document.body.innerHTML = CUERPO_INDEX
}

// ── Utilidades del recorrido ─────────────────────────────────────────────────

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
const ficheroDeTexto = (texto, nombre) =>
  new File([new TextEncoder().encode(texto)], nombre, { type: '' })

/** Cede el turno al bucle de microtareas unas cuantas veces. */
async function cederTurno(veces = 60) {
  for (let vuelta = 0; vuelta < veces; vuelta += 1) await Promise.resolve()
}

async function soltarYEsperar(fichero) {
  soltar(fichero)
  await cederTurno()
}

/** La raíz del cajón de comprobación que hay vivo ahora mismo. */
const raizComprobacion = () => comprobacionViva.control.getContainer()
/** La raíz del cajón de diagnóstico que hay vivo ahora mismo. */
const raizDiagnostico = () => diagnosticoVivo.cajon.control.getContainer()

const pulsar = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))

/**
 * Abre el diagnóstico por el CTA del pie y descarga el informe con el botón del
 * cajón, que es el recorrido real, y devuelve el TEXTO que habría bajado.
 */
async function descargarInforme() {
  pulsar(document.querySelector(SELECTOR_BOTON_DIAGNOSTICAR))
  await cederTurno()
  const boton = raizDiagnostico().querySelector(SELECTOR_DIAG.DESCARGAR)
  expect(boton.disabled, 'el botón del informe está apagado: no hay diagnóstico calculado').toBe(
    false,
  )
  pulsar(boton)
  await cederTurno()
  return arranque.informes[arranque.informes.length - 1]
}

// ── ARRANQUE 1: la app entera, con el Catastro en pie ────────────────────────

// La cáscara TIENE que existir antes de importar `app/main.js`: su código de nivel
// superior busca los nodos con `nodo(...)`, que LANZA si falta alguno.
montarCascara()
arranque.responder = (url) => ({
  ok: true,
  estado: 200,
  texto: url.includes('Neighbour') ? TEXTO_VECINDAD : TEXTO_WFS,
  tipoContenido: 'text/xml',
  motivo: null,
  mensaje: null,
  intentos: 1,
  ms: 1,
  url,
})

await import('../../app/main.js')

/** El store REAL del ensamblaje (el mismo que comparten las cinco vistas). */
const estadoDelArranque = arranque.opciones.estado

afterEach(() => {
  vi.restoreAllMocks()
})

describe('app/main · F08 · el paso 9 está montado', () => {
  it('el visor se monta con `comprobacion: true`', () => {
    // `true` y no un objeto: su única clave de montaje —`posicion`— vale aquí
    // exactamente lo que su defecto, y escribirla fingiría una decisión no tomada.
    expect(arranque.opciones.comprobacion).toBe(true)
  })

  it('el cajón de F08 existe y nace CERRADO', () => {
    // Montarlo no es abrirlo: un cajón que se abriera solo taparía el mapa con algo
    // que nadie ha pedido. Y comparte `bottomleft` con el de F07, así que abrirlo al
    // arrancar dejaría los dos apilados desde el primer segundo.
    expect(comprobacionViva).not.toBeNull()
    expect(comprobacionViva.abierto()).toBe(false)
    expect(diagnosticoVivo.cajon.abierto()).toBe(false)
  })

  it('el paso 9 recibe el CLIENTE del Catastro, no su cableado', () => {
    // `cargar()` del cableado haría `estado.set` con la geometría del WFS y borraría
    // la del fichero, que es justo lo que hay que contrastar. Lo que se le pasa es
    // el acceso al servicio, a secas.
    expect(arranque.comprobacion.cliente).not.toBeNull()
    expect(typeof arranque.comprobacion.cliente.parcelaPorRefcat).toBe('function')
    expect(arranque.comprobacion.cliente.cargar).toBeUndefined()
  })

  it('y el cajón de F07, para la exclusión mutua de `bottomleft`', () => {
    expect(arranque.comprobacion.cajonDiagnostico).toBe(diagnosticoVivo.cajon)
  })

  it('reinicia el historial al cargar la parcela de un fichero (mismo gancho que F05)', () => {
    // Cargar la parcela de un fichero es abrir un documento nuevo: `Ctrl+Z` no puede
    // devolver «la parcela que traje». Es el MISMO gancho que recibe el Catastro.
    expect(typeof arranque.comprobacion.alCargarParcela).toBe('function')
  })
})

describe('app/main · F08 · el botón «Abrir un GML…» del rótulo', () => {
  it('está en la cáscara y lo ha enganchado la zona de fichero', () => {
    // El `<input type="file">` NO está en `index.html` a propósito (lo dice por
    // escrito): lo fabrica `app/zona-fichero.js`. Que exista es la prueba de que el
    // paso 9 llegó a cablearse.
    expect(document.querySelector(SELECTOR_BOTON_ABRIR)).not.toBeNull()
    expect(document.querySelector(`.${CLASE_INPUT}`)).not.toBeNull()
  })

  it('pulsarlo abre el selector de ficheros', () => {
    const input = document.querySelector(`.${CLASE_INPUT}`)
    const espia = vi.spyOn(input, 'click').mockImplementation(() => {})
    pulsar(document.querySelector(SELECTOR_BOTON_ABRIR))
    expect(espia).toHaveBeenCalledTimes(1)
  })
})

describe('app/main · F08 · las dos features, enlazadas', () => {
  it('sin fichero, el envoltorio devuelve `null`: es LA VÍA DE F05', () => {
    // El defecto de la opción `comprobacion` de `cablearDiagnostico` es `() => null`,
    // y el envoltorio del arranque tiene que valer exactamente eso mientras no haya
    // comprobación. Si no, la interfaz se ramificaría por procedencia.
    expect(typeof arranque.diagnostico.comprobacion).toBe('function')
    expect(arranque.diagnostico.comprobacion()).toBeNull()
  })

  it('y el informe sale SIN la sección del fichero (la parcela vino por referencia)', async () => {
    // La app arranca con la parcela de demo, que es la real del Catastro y trae
    // `geometriaOficial`: hay contra qué contrastar y el CTA nace encendido.
    const texto = await descargarInforme()
    expect(texto).toContain('INFORME DE CONTRASTE CON EL PARCELARIO CATASTRAL')
    expect(texto).not.toContain('QUÉ SE LEYÓ DEL FICHERO')
  })

  it('soltar un GML abre SU cajón y cierra el de F07 (comparten esquina)', async () => {
    // Los dos viven en `bottomleft`. Soltar un fichero no es un clic, así que el
    // guardián de clic-fuera de F07 no se entera: quien lo cierra es el paso 9.
    expect(diagnosticoVivo.cajon.abierto()).toBe(true) // lo dejó abierto la prueba anterior
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))

    expect(comprobacionViva.abierto()).toBe(true)
    expect(diagnosticoVivo.cajon.abierto()).toBe(false)
    expect(raizComprobacion().querySelector(SELECTOR_COMP.FICHERO).textContent).toContain(
      'de-otro-despacho.gml',
    )
    // Ya hay comprobación viva, y el envoltorio la ve: es tardío, no un snapshot.
    expect(arranque.diagnostico.comprobacion()).not.toBeNull()
    expect(arranque.diagnostico.comprobacion().fichero.nombre).toBe('de-otro-despacho.gml')
  })

  it('«Contrastar» compone las DOS geometrías y el informe ya lleva la del fichero', async () => {
    arranque.peticiones.length = 0
    pulsar(raizComprobacion().querySelector(SELECTOR_COMP.CONTRASTAR))
    await cederTurno()

    // El parcelario se ha pedido UNA vez, con la referencia leída del fichero.
    expect(arranque.peticiones.filter((u) => !u.includes('Neighbour'))).toHaveLength(1)

    const parcela = estadoDelArranque.get()
    expect(parcela.origen).toBe(ORIGEN_PARCELA.GML_EXISTENTE)
    // La geometría que entra es la del FICHERO; la del WFS va de término de
    // comparación. Si el cableado hubiera llamado a `cargar()`, estos dos vértices
    // serían el mismo.
    expect(parcela.recintos[0].vertices[0]).toEqual(VERTICE_FICHERO)
    expect(parcela.geometriaOficial[0].vertices[0]).toEqual(VERTICE_WFS)

    // La procedencia dice las DOS cosas, y en este orden: primero de dónde viene la
    // geometría que se dibuja, después el parcelario como lo que es.
    const procedencia = document.querySelector(SELECTOR_PROCEDENCIA).textContent
    expect(procedencia).toContain('de-otro-despacho.gml')
    expect(procedencia).toContain('NO del Catastro')

    // Y el informe, ahora sí, con la sección del fichero: las dos features enlazadas.
    const texto = await descargarInforme()
    expect(texto).toContain('QUÉ SE LEYÓ DEL FICHERO')
    expect(texto).toContain('de-otro-despacho.gml')
  })

  it('«Descartar» suelta el fichero y el envoltorio vuelve a `null`', async () => {
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    expect(arranque.diagnostico.comprobacion()).not.toBeNull()

    pulsar(raizComprobacion().querySelector(SELECTOR_COMP.DESCARTAR))
    await cederTurno()

    expect(comprobacionViva.abierto()).toBe(false)
    // El informe vuelve a emitirse sin sección de fichero: no queda un documento
    // cargado en memoria al que ya no se puede volver desde ninguna parte.
    expect(arranque.diagnostico.comprobacion()).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// Rework de UI · T9 · LA RUTA CRÍTICA 2, ANDADA ENTERA
//
// «Comprobar un GML ajeno: Entrada (soltar `.gml`) → contraste → Informe.»
//
// ⛔ **Hasta T9 esta ruta no se podía andar, y está medido:** «Contrastar con el
// parcelario» metía la parcela en el store y **no movía al usuario de sitio**.
// Quien soltaba el GML de otro se quedaba en Entrada mirando las tres vías, con
// una geometría ajena ya cargada por debajo y sin una sola línea en pantalla que
// dijera de dónde había salido — el único renglón que lo decía
// (`[data-procedencia="parcela"]`) vive DENTRO de la pantalla Entrada desde T6.
//
// Se prueba sobre la app REAL (el mismo arranque de arriba), porque lo que T9
// añade es precisamente la costura entre cuatro módulos que solo se conocen aquí.
// ══════════════════════════════════════════════════════════════════════════════

/** El `<li>` de un paso del rail. */
const peldano = (paso) => document.querySelector(`[data-rail="pasos"] [data-paso="${paso}"]`)
/** Su botón, que es donde vive el `disabled`. */
const botonPeldano = (paso) => peldano(paso).querySelector('button')
/** El paso activo, tal y como lo escribe `app/pantalla.js` en la raíz. */
const pasoActivo = () => document.body.getAttribute('data-paso')
/** El renglón de procedencia del cajón de diagnóstico (T9). */
const procedenciaDelCajon = () =>
  raizDiagnostico().querySelector('[data-procedencia="contraste"]')
/** La puerta (D4). */
const puerta = () => raizDiagnostico().querySelector('[data-accion="tomar-geometria"]')

describe('app/main · T9 · la ruta crítica 2, de principio a fin', () => {
  it('⛔ soltar un GML ajeno entra en modo COMPROBACIÓN: Edición se apaga CON motivo', async () => {
    // ⚠️ **PUNTO DE PARTIDA LIMPIO, y no es ceremonia: lo obligó una mutación.** Los
    // bloques de arriba dejan un diagnóstico calculado, así que «Informe» ya está
    // encendido y la prueba del final salía VERDE aunque se quitara la suscripción
    // que la sostiene. Vaciar el store lo olvida y deja el rail donde de verdad
    // empieza esta ruta.
    estadoDelArranque.set(null)
    await cederTurno()
    expect(botonPeldano('informe').disabled).toBe(true)

    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'del-vecino.gml'))

    expect(comprobacionViva.abierto()).toBe(true)
    // ⭐ **Y vuelve a ENTRADA, que es donde vive este cajón.** Lo destapó esta misma
    // prueba: la anterior había dejado la app en Diagnóstico (por el CTA del pie),
    // y sin esto el rail decía «Diagnóstico» mientras la esquina del mapa enseñaba
    // el cajón de otra pantalla. Traer un fichero nuevo es empezar otro expediente.
    expect(pasoActivo()).toBe('entrada')
    // El rail lo dice ya, antes de contrastar: la geometría que vas a mirar es de
    // otro y editarla no es lo que crees.
    expect(botonPeldano('edicion').disabled).toBe(true)
    expect(botonPeldano('edicion').textContent).toContain('Tomar esta geometría y editarla')
    // Y el motivo NO es el de siempre («trae una parcela primero»): decir eso aquí
    // mandaría al usuario a hacer un trabajo que ya ha hecho.
    expect(botonPeldano('edicion').textContent).not.toMatch(/trae una parcela/i)
  })

  it('⭐ «Contrastar» ATERRIZA en Diagnóstico: antes de T9 se quedaba en Entrada', async () => {
    expect(pasoActivo()).toBe('entrada')

    pulsar(raizComprobacion().querySelector(SELECTOR_COMP.CONTRASTAR))
    await cederTurno()

    expect(pasoActivo()).toBe('diagnostico')
    // Y la esquina del mapa la manda el paso: uno abierto, el otro cerrado, sin que
    // los dos módulos se hayan puesto de acuerdo entre ellos.
    expect(diagnosticoVivo.cajon.abierto()).toBe(true)
    expect(comprobacionViva.abierto()).toBe(false)
  })

  it('⭐ y la PROCEDENCIA está declarada: dice que es de otro y nombra la puerta', async () => {
    const renglon = procedenciaDelCajon()
    expect(renglon).not.toBeNull()
    // Se ve: la vista oculta el renglón solo cuando no hay nada que decir.
    expect(renglon.style.display).not.toBe('none')
    expect(renglon.textContent).toContain('otro técnico')
    expect(renglon.textContent).toContain('Tomar esta geometría y editarla')
    // El contrato K.1 en acción: este renglón NO es el de la vía del Catastro.
    expect(renglon.dataset.procedencia).toBe('contraste')
    expect(document.querySelectorAll('[data-procedencia="contraste"]')).toHaveLength(1)
  })

  it('la puerta se ENSEÑA, y no está apagada: no aplica o no está', () => {
    expect(puerta().style.display).not.toBe('none')
    expect(puerta().disabled).toBe(false)
  })

  it('⭐ cruzarla cambia el modo de verdad: el rail se completa y el renglón se reescribe', async () => {
    pulsar(puerta())
    await cederTurno()

    // Edición ya está, y sin motivo colgando.
    expect(botonPeldano('edicion').disabled).toBe(false)
    expect(botonPeldano('edicion').textContent).not.toContain('Tomar esta geometría')
    // La puerta se retira: ya se ha cruzado.
    expect(puerta().style.display).toBe('none')
    // Y el renglón no reescribe la historia — sigue diciendo de dónde salió el
    // dibujo— pero ya no dice que sea de solo lectura.
    expect(procedenciaDelCajon().textContent).toContain('otro técnico')
    expect(procedenciaDelCajon().textContent).toContain('Lo has tomado como tuyo')
    expect(procedenciaDelCajon().textContent).not.toContain('no se edita ni se genera GML')
  })

  it('⭐ el paso «Informe» se enciende SIN el apaño del temporizador que T9 borró', async () => {
    // T5 refrescaba los hechos del rail con `queueMicrotask` + `setTimeout(…, 500)`
    // porque `app/cableado-diagnostico.js` no notificaba a nadie: `ultimoDiagnostico()`
    // era una lectura, no un canal. Un temporizador de medio segundo es una apuesta —
    // con la red lenta, «Informe» se quedaba apagado y nada lo decía—. Ahora hay
    // suscripción de verdad y es cierto en el mismo turno.
    //
    // ⛔ **VERIFICADO POR MUTACIÓN:** quitando `alDiagnostico(refrescarHechos)` de
    // `app/main.js`, esta prueba sale ROJA. La primera versión NO lo hacía, porque
    // medía un «Informe» que ya venía encendido de otro bloque. De ahí el vaciado
    // del store en la primera prueba de este describe.
    expect(botonPeldano('informe').disabled).toBe(false)
  })

  it('⭐ y con una parcela PROPIA la pantalla no habla de nadie: la procedencia distingue', async () => {
    // Anti-vacuidad. Sin esta prueba, un renglón que dijera siempre «de otro
    // técnico» pasaría las cinco de arriba.
    estadoDelArranque.set({ ...estadoDelArranque.get(), origen: ORIGEN_PARCELA.WFS })
    await cederTurno()

    expect(procedenciaDelCajon().textContent).toContain('del Catastro')
    expect(procedenciaDelCajon().textContent).not.toContain('otro técnico')
    expect(puerta().style.display).toBe('none')
  })
})

// ── El desmontaje. VA EL ÚLTIMO del primer arranque, y por eso está escrito ──
// `destruir()` deja el cableado inerte a propósito: cualquier prueba que corriera
// después encontraría la app viva pero sorda, y fallaría por un motivo que no es
// el suyo. Se pone al final en vez de reconstruir el arranque entre pruebas.
describe('app/main · F08 · el desmontaje del paso 9 limpia', () => {
  it('retira el <input type="file"> y los oyentes de la VENTANA', async () => {
    expect(document.querySelector(`.${CLASE_INPUT}`)).not.toBeNull()

    arranque.apiComprobacion.destruir()

    // El input se va con la zona de fichero.
    expect(document.querySelector(`.${CLASE_INPUT}`)).toBeNull()
    expect(comprobacionViva.abierto()).toBe(false)

    // Y lo que de verdad importa: los oyentes viven en la VENTANA, así que
    // sobrevivirían a la pantalla. Soltar un fichero ya no comprueba nada.
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    expect(comprobacionViva.abierto()).toBe(false)
    expect(arranque.diagnostico.comprobacion()).toBeNull()
  })

  it('es IDEMPOTENTE: llamarlo dos veces no lanza', () => {
    expect(() => arranque.apiComprobacion.destruir()).not.toThrow()
  })
})

// ── ARRANQUE 2: el cliente del Catastro no se ha podido construir ────────────
//
// Es un ARRANQUE distinto y no un estado alcanzable desde el primero (decisión 1).
// Se monta en el `beforeAll` de este `describe`, que Vitest ejecuta después de las
// suites anteriores: el `montarCascara()` de aquí se lleva por delante el `<body>`
// del primer arranque, mapa incluido.

describe('app/main · F08 · la app arranca IGUAL sin cliente del Catastro', () => {
  /** Los avisos que llegan al panel del segundo arranque, leídos del DOM. */
  const avisos = () =>
    [...document.querySelectorAll('#avisos [data-nivel]')].map((el) => el.textContent)

  beforeAll(async () => {
    vi.resetModules()
    arranque.fallarCliente = true
    arranque.informes.length = 0
    arranque.peticiones.length = 0
    arranque.opciones = null
    montarCascara()
    // El fallo del cliente se cuenta por consola a propósito (`app/main.js`,
    // decisión 3): se silencia para que la salida del test no parezca un error.
    const enConsola = vi.spyOn(console, 'error').mockImplementation(() => {})
    await import('../../app/main.js')
    enConsola.mockRestore()
  })

  it('el arranque ha terminado: el visor sigue montándose con la comprobación', () => {
    // La afirmación que sostiene todo lo demás. Si `cablearComprobacion` estuviera
    // DENTRO del `try` del Catastro, el paso 9 no se habría cableado; si estuviera
    // fuera pero exigiera cliente, el import entero habría reventado.
    expect(arranque.opciones).not.toBeNull()
    expect(arranque.opciones.comprobacion).toBe(true)
    expect(document.querySelector(`.${CLASE_INPUT}`)).not.toBeNull()
  })

  it('el bloque del Catastro se apaga y lo dice; la comprobación NO', () => {
    // Lo que se pierde es la vía de entrada del Catastro, y solo eso. Los
    // selectores se leen del módulo que los declara, no se copian.
    expect(document.querySelector(SELECTOR_BOTON_CARGAR).disabled).toBe(true)
    expect(document.querySelector(SELECTOR_ESTADO_CATASTRO).textContent.trim()).not.toBe('')
    expect(document.querySelector(SELECTOR_BOTON_ABRIR).disabled).toBe(false)
  })

  it('el paso 9 recibe `cliente: null`, que es una respuesta prevista', () => {
    expect(arranque.comprobacion.cliente).toBeNull()
  })

  it('comprobar un fichero SIGUE funcionando: se abre el cajón y se lee la parcela', async () => {
    await soltarYEsperar(ficheroDeBytes(leerBytes(...RUTA_WFS), 'cp_parcela_9398516VK3799G.gml'))

    expect(comprobacionViva.abierto()).toBe(true)
    expect(raizComprobacion().querySelector(SELECTOR_COMP.CONTRASTAR).disabled).toBe(false)
  })

  it('y al contrastar entra la parcela SIN parcelario, sin tocar la red y DICIÉNDOLO', async () => {
    pulsar(raizComprobacion().querySelector(SELECTOR_COMP.CONTRASTAR))
    await cederTurno()

    // Ni una petición: no hay a quién pedírsela, y eso no es un fallo de red.
    expect(arranque.peticiones).toEqual([])

    const parcela = arranque.opciones.estado.get()
    expect(parcela.origen).toBe(ORIGEN_PARCELA.GML_EXISTENTE)
    expect(parcela.recintos[0].vertices.length).toBeGreaterThan(0)
    expect(parcela.geometriaOficial).toBeNull()

    // Y se dice por los dos sitios: el renglón de procedencia (que es gris de 11 px
    // y solo se lee cuando se duda del dato) y el panel de avisos (que es donde se
    // cuenta lo que cambia lo que se puede hacer a continuación).
    const procedencia = document.querySelector(SELECTOR_PROCEDENCIA).textContent
    expect(procedencia).toContain('Sin parcelario con el que contrastarla')
    expect(procedencia).toContain(MOTIVO_SIN_CLIENTE)
    expect(avisos().join('\n')).toContain(COLA_SIN_PARCELARIO)
  })

  it('el CTA de F07 queda apagado CON su motivo escrito, no gris y mudo', () => {
    // La otra mitad de la degradación honrada: sin contorno oficial no hay encaje
    // que diagnosticar, y el usuario tiene derecho a saber por qué.
    expect(document.querySelector(SELECTOR_BOTON_DIAGNOSTICAR).disabled).toBe(true)
    expect(document.querySelector(SELECTOR_ESTADO_DIAGNOSTICO).textContent.trim()).not.toBe('')
  })

  it('un GML sin referencia catastral tampoco inventa nada (la plantilla oficial)', async () => {
    // ⛔ MEDIDO en T2.1 y T4.1: el `cp:nationalCadastralReference` de la plantilla de
    // ALTA está presente y VACÍO, que no es lo mismo que ausente. Aquí concurren los
    // DOS motivos para no pedir parcelario —no hay cliente y no hay referencia—, y
    // el que se cuenta es el de la referencia, que es el del fichero que el usuario
    // tiene delante.
    await soltarYEsperar(ficheroDeBytes(leerBytes(...RUTA_PLANTILLA), 'cp_ejemplo_explicativo.gml'))
    pulsar(raizComprobacion().querySelector(SELECTOR_COMP.CONTRASTAR))
    await cederTurno()

    expect(arranque.peticiones).toEqual([])
    expect(arranque.opciones.estado.get().refcat).toBeNull()
    expect(document.querySelector(SELECTOR_PROCEDENCIA).textContent).toContain('VACÍA')
  })
})

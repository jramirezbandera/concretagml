/* -------------------------------------------------------------------------- *
 * test/app/cableado-medicion.dom.test.js — F18 · T3                           *
 *                                                                            *
 * El paso 17: un `.dxf` o un `.txt` soltado con la rama PARCELA puesta entra  *
 * como MEDICIÓN del técnico. Lo que puede salir mal aquí es caro, porque a    *
 * partir de este módulo la geometría es la que se firma:                      *
 *                                                                            *
 *   · que la medición PISE la geometría oficial que había que contrastar;    *
 *   · que se componga contra la parcela de DEMOSTRACIÓN y el diagnóstico      *
 *     compare dos polígonos sin relación, con cifras ciertas y sin sentido;   *
 *   · que el listado de replanteo que exporta la propia app entre —o peor,    *
 *     que se rechace con el motivo equivocado—;                              *
 *   · que una corrección se aplique sin que nadie la haya marcado;           *
 *   · y que el historial de edición no se reinicie, con lo que un `Ctrl+Z`    *
 *     devolvería la parcela anterior.                                        *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ENCABEZADO_NO_CONSTRUIDA,
  MENSAJE_CANCELADO,
  MENSAJE_ES_LISTADO_PROPIO,
  MENSAJE_FICHERO_NO_LEIDO,
  MENSAJE_SIN_REFERENCIA,
  avisoDeSuperficie,
  cablearMedicion,
  componerParcelaMedida,
  textoProcedenciaMedicion,
} from '../../app/cableado-medicion.js'
import { serializarCoordenadasTxt } from '../../export/coordenadas.js'
import { superficie } from '../../geo/area.js'
import { ORIGEN_PARCELA, crearParcela, crearRecinto } from '../../model/parcela.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const fixture = (n) => readFileSync(join(RAIZ, 'test', 'fixtures', 'parsers', n), 'utf8')

const UTM_DXF = fixture('UTM.dxf')

const CUADRADO =
  '440123.45 4470987.65\n440133.45 4470987.65\n440133.45 4470997.65\n440123.45 4470997.65'

const ficheroDeTexto = (texto, nombre) =>
  new File([new TextEncoder().encode(texto)], nombre, { type: '' })

/** Un anillo cualquiera, para poblar una parcela de partida. */
const ANILLO_OFICIAL = [
  [440000, 4470000],
  [440050, 4470000],
  [440050, 4470050],
  [440000, 4470050],
]

const ID_DEMO = 'demo-9398516VK3799G'

/** La parcela con la que arranca la app: real, con su geometría oficial. */
const parcelaDemo = () =>
  crearParcela({
    idLocal: ID_DEMO,
    refcat: '9398516VK3799G',
    recintos: [crearRecinto(ANILLO_OFICIAL)],
    geometriaOficial: [crearRecinto(ANILLO_OFICIAL)],
    origen: ORIGEN_PARCELA.WFS,
  })

/** Una parcela que el usuario SÍ ha traído (otro `idLocal`). */
const parcelaTraida = () =>
  crearParcela({
    idLocal: '29041A00800099',
    refcat: '29041A00800099',
    recintos: [crearRecinto(ANILLO_OFICIAL)],
    geometriaOficial: [crearRecinto(ANILLO_OFICIAL)],
    superficieCatastral: 2500,
    origen: ORIGEN_PARCELA.WFS,
  })

// ── El arnés ─────────────────────────────────────────────────────────────────

let avisos = []
let store = null
let procedencia = null

/** Un doble del diálogo: responde lo que se le diga, sin DOM. */
const dialogoQueResponde = (...respuestas) => {
  const cola = [...respuestas]
  const aperturas = []
  return {
    aperturas,
    abrir(entrada) {
      aperturas.push(entrada)
      return Promise.resolve(cola.length > 0 ? cola.shift() : {})
    },
    destruir() {},
  }
}

const panelFalso = { avisar: (mensaje, extra) => avisos.push({ mensaje, ...extra }) }

const dijo = (trozo) => avisos.some((a) => a.mensaje.includes(trozo))

function crearStore(inicial) {
  let valor = inicial
  return {
    get: () => valor,
    set: vi.fn((v) => {
      valor = v
    }),
  }
}

const cablear = (extra = {}) =>
  cablearMedicion({
    estado: store,
    panel: panelFalso,
    idLocalDemo: ID_DEMO,
    procedencia,
    dialogo: dialogoQueResponde(),
    ...extra,
  })

beforeEach(() => {
  avisos = []
  store = crearStore(parcelaDemo())
  document.body.replaceChildren()
  procedencia = document.createElement('p')
  procedencia.dataset.procedencia = 'parcela'
  document.body.appendChild(procedencia)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ═════════════════════════════════════════════════════════════════════════════
// 1 · ⭐ La composición: la decisión que le da valor a la fase
// ═════════════════════════════════════════════════════════════════════════════

describe('cableado-medicion · componerParcelaMedida', () => {
  const nuevos = [crearRecinto(CUADRADO.split('\n').map((l) => l.split(' ').map(Number)))]
  const args = { origen: ORIGEN_PARCELA.DXF, idLocalDemo: ID_DEMO, nombreFichero: 'mio.dxf' }

  it('⭐ sobre una parcela TRAÍDA conserva la oficial, la referencia y la superficie', () => {
    const antes = parcelaTraida()
    const despues = componerParcelaMedida(antes, nuevos, args)

    // La medición ocupa `recintos`…
    expect(despues.recintos[0].vertices).toEqual(nuevos[0].vertices)
    // …y la oficial NO se toca. Esto es toda la fase en una aserción.
    expect(despues.geometriaOficial).toEqual(antes.geometriaOficial)
    expect(despues.refcat).toBe('29041A00800099')
    expect(despues.superficieCatastral).toBe(2500)
    expect(despues.idLocal).toBe(antes.idLocal)
    expect(despues.origen).toBe(ORIGEN_PARCELA.DXF)
  })

  it('⭐ y con eso el Diagnóstico de F07 tiene las DOS geometrías, sin traer nada', () => {
    // Anti-vacuidad de lo anterior: no basta con que el campo exista, tiene que
    // haber dos geometrías DISTINTAS que contrastar.
    const compuesta = componerParcelaMedida(parcelaTraida(), nuevos, args)
    expect(compuesta.geometriaOficial).not.toBeNull()
    expect(superficie(compuesta.recintos)).not.toBeCloseTo(
      superficie(compuesta.geometriaOficial),
      2,
    )
  })

  it('⛔ sobre la parcela de DEMOSTRACIÓN sustituye: ni oficial ni referencia', () => {
    // Si se compusiera, un levantamiento de otra provincia se contrastaría contra
    // la geometría real de 9398516VK3799G y el diagnóstico daría cifras enormes,
    // ciertas y sin ningún sentido.
    const despues = componerParcelaMedida(parcelaDemo(), nuevos, args)

    expect(despues.geometriaOficial).toBeNull()
    expect(despues.refcat).toBeNull()
    expect(despues.idLocal).toBe('mio.dxf')
  })

  it('con el store vacío se comporta como con la demo', () => {
    expect(componerParcelaMedida(null, nuevos, args).geometriaOficial).toBeNull()
  })

  it('⚠️ el detector es el `idLocal`, no el origen ni la referencia', () => {
    // La demo YA viene con `origen: WFS` y con la referencia de una parcela real,
    // así que cualquiera de los dos como detector daría un falso positivo. Se
    // comprueba que una parcela con el MISMO origen y referencia pero otro
    // `idLocal` sí conserva su oficial.
    const comoLaDemo = crearParcela({
      idLocal: 'otra-cosa',
      refcat: '9398516VK3799G',
      recintos: [crearRecinto(ANILLO_OFICIAL)],
      geometriaOficial: [crearRecinto(ANILLO_OFICIAL)],
      origen: ORIGEN_PARCELA.WFS,
    })
    expect(componerParcelaMedida(comoLaDemo, nuevos, args).geometriaOficial).not.toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · El renglón de procedencia
// ═════════════════════════════════════════════════════════════════════════════

describe('cableado-medicion · textoProcedenciaMedicion', () => {
  it('dice que la geometría NO es del Catastro, que es lo que impide el error caro', () => {
    const texto = textoProcedenciaMedicion({ nombreFichero: 'mio.dxf', conParcelario: true })
    expect(texto).toContain('mio.dxf')
    expect(texto).toMatch(/NO del Catastro/)
    expect(texto).toMatch(/parcelario que ya estaba/i)
  })

  it('sin parcelario lo dice, y señala por dónde traerlo', () => {
    const texto = textoProcedenciaMedicion({ nombreFichero: 'mio.txt', conParcelario: false })
    expect(texto).toMatch(/Sin parcelario/i)
    expect(texto).toMatch(/referencia catastral/i)
  })

  it('⭐ dice DÓNDE CAE la parcela, que es la exigencia de F01', () => {
    const texto = textoProcedenciaMedicion({
      nombreFichero: 'mio.dxf',
      capa: '0',
      conParcelario: false,
      huso: { zona: 30, srs: 'EPSG:25830' },
    })
    expect(texto).toContain('huso 30')
    expect(texto).toContain('EPSG:25830')
    expect(texto).toContain('capa «0»')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · El recorrido completo
// ═════════════════════════════════════════════════════════════════════════════

describe('cableado-medicion · alFichero', () => {
  it('un TXT limpio entra SIN abrir la revisión', async () => {
    const dialogo = dialogoQueResponde()
    const medicion = cablear({ dialogo })
    await medicion.alFichero(ficheroDeTexto(CUADRADO, 'parcela.txt'))

    expect(dialogo.aperturas).toHaveLength(0) // el camino feliz no lleva modal
    expect(store.set).toHaveBeenCalledTimes(1) // UN solo `set`
    expect(store.get().origen).toBe(ORIGEN_PARCELA.TXT)
    expect(store.get().recintos[0].vertices).toHaveLength(4)
  })

  it('⭐ con `UTM.dxf` abre la revisión UNA vez y, elegida la capa, entra la parcela buena', async () => {
    const dialogo = dialogoQueResponde({ capa: '0' })
    const medicion = cablear({ dialogo })
    await medicion.alFichero(ficheroDeTexto(UTM_DXF, 'UTM.dxf'))

    // UNA sola apertura: elegida la capa no queda nada que preguntar.
    expect(dialogo.aperturas).toHaveLength(1)
    expect(dialogo.aperturas[0].nombre).toBe('UTM.dxf')

    const parcela = store.get()
    expect(parcela.origen).toBe(ORIGEN_PARCELA.DXF)
    // ⛔ El guardián de la regresión de F11: superficie POSITIVA, no −390,45 m².
    expect(superficie(parcela.recintos)).toBeGreaterThan(0)
    expect(superficie(parcela.recintos)).toBeCloseTo(61.045, 3)
  })

  it('⭐ importar sobre una parcela traída NO borra la geometría oficial', async () => {
    store = crearStore(parcelaTraida())
    const oficialAntes = store.get().geometriaOficial
    const medicion = cablear({ dialogo: dialogoQueResponde({ capa: '0' }) })
    await medicion.alFichero(ficheroDeTexto(UTM_DXF, 'UTM.dxf'))

    expect(store.get().geometriaOficial).toEqual(oficialAntes)
    expect(store.get().refcat).toBe('29041A00800099')
  })

  it('escribe el renglón de procedencia con el fichero, la capa y el huso', async () => {
    const medicion = cablear({ dialogo: dialogoQueResponde({ capa: '0' }) })
    await medicion.alFichero(ficheroDeTexto(UTM_DXF, 'UTM.dxf'))

    expect(procedencia.textContent).toContain('UTM.dxf')
    expect(procedencia.textContent).toContain('capa «0»')
    expect(procedencia.textContent).toMatch(/NO del Catastro/)
    expect(procedencia.textContent).toMatch(/huso 30/)
  })

  it('⭐ llama a `alCargarParcela` DESPUÉS del `set` — el historial se reinicia', async () => {
    // Sin esto, un `Ctrl+Z` después de importar devolvería la parcela anterior:
    // cambiaría la geometría en pantalla y con ella el GML que se generaría. Es la
    // decisión 2 de `cablearEdicion`, y aquí se comprueba que esta vía la respeta.
    const orden = []
    store.set.mockImplementation(() => orden.push('set'))
    const medicion = cablear({
      dialogo: dialogoQueResponde(),
      alCargarParcela: () => orden.push('alCargarParcela'),
    })
    await medicion.alFichero(ficheroDeTexto(CUADRADO, 'parcela.txt'))

    expect(orden).toEqual(['set', 'alCargarParcela'])
  })

  it('un oyente roto no descarga la parcela que ya ha entrado', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const medicion = cablear({
      dialogo: dialogoQueResponde(),
      alCargarParcela: () => {
        throw new Error('el suscriptor ha reventado')
      },
    })
    await expect(medicion.alFichero(ficheroDeTexto(CUADRADO, 'p.txt'))).resolves.toBeUndefined()

    expect(store.set).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalled()
  })

  it('cancelar la revisión no cambia NADA de lo que había', async () => {
    const antes = store.get()
    const medicion = cablear({ dialogo: dialogoQueResponde(null) })
    await medicion.alFichero(ficheroDeTexto(UTM_DXF, 'UTM.dxf'))

    expect(store.set).not.toHaveBeenCalled()
    expect(store.get()).toBe(antes)
    expect(dijo(MENSAJE_CANCELADO)).toBe(true)
  })

  it('sin referencia catastral se dice, con las dos vías que sí existen', async () => {
    const medicion = cablear({ dialogo: dialogoQueResponde() })
    await medicion.alFichero(ficheroDeTexto(CUADRADO, 'parcela.txt'))

    expect(store.get().refcat).toBeNull()
    expect(dijo(MENSAJE_SIN_REFERENCIA)).toBe(true)
    // …pero NO bloquea: la geometría ha entrado igual.
    expect(store.set).toHaveBeenCalledTimes(1)
  })

  it('⛔ el listado de replanteo propio se rechaza POR SU NOMBRE, no por el huso', async () => {
    // Sin esto el usuario recibe «no se ha podido resolver el huso»: un bloqueo del
    // catálogo, plausible y falso — no hay ningún huso que arreglar.
    const { texto } = serializarCoordenadasTxt({
      recintos: [crearRecinto(ANILLO_OFICIAL)],
      refcat: '9398516VK3799G',
      srs: 'EPSG:25830',
      fecha: new Date(Date.UTC(2026, 7, 6)),
    })
    const dialogo = dialogoQueResponde()
    const medicion = cablear({ dialogo })
    await medicion.alFichero(ficheroDeTexto(texto, 'coordenadas.txt'))

    expect(dijo(MENSAJE_ES_LISTADO_PROPIO)).toBe(true)
    expect(dijo('huso')).toBe(false) // el diagnóstico falso NO se llega a emitir
    expect(store.set).not.toHaveBeenCalled()
    expect(dialogo.aperturas).toHaveLength(0)
  })

  it('un fichero que no construye parcela lo dice, con el motivo de `importar()`', async () => {
    const medicion = cablear({ dialogo: dialogoQueResponde() })
    // Coordenadas en grados: `importar()` bloquea y esta versión no sabe proyectar.
    await medicion.alFichero(ficheroDeTexto('-4.42 36.72\n-4.41 36.72\n-4.41 36.73', 'geo.txt'))

    expect(dijo(ENCABEZADO_NO_CONSTRUIDA)).toBe(true)
    expect(dijo('grados')).toBe(true) // el motivo REAL, no uno inventado aquí
    expect(store.set).not.toHaveBeenCalled()
  })

  it('unos bytes ilegibles se cuentan como lo que son: del entorno, no del fichero', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const roto = ficheroDeTexto(CUADRADO, 'p.txt')
    roto.arrayBuffer = () => Promise.reject(new Error('la unidad se ha desconectado'))
    const medicion = cablear({ dialogo: dialogoQueResponde() })
    await expect(medicion.alFichero(roto)).resolves.toBeUndefined()

    expect(dijo(MENSAJE_FICHERO_NO_LEIDO)).toBe(true)
    expect(store.set).not.toHaveBeenCalled()
  })

  it('⚠️ no repregunta lo ya contestado: «dejar el cierre» no reabre la pantalla', async () => {
    // Si el usuario elige DEJAR, `importar()` se comporta igual y vuelve a emitir la
    // misma detección. Sin la cuenta de tipos resueltos, esto sería un modal que se
    // reabre solo. El doble devuelve `{}` siempre: si hubiera bucle, no pararía.
    const cierreAmbiguo = `${CUADRADO}\n440123.48 4470987.68`
    const dialogo = dialogoQueResponde()
    const medicion = cablear({ dialogo })
    await medicion.alFichero(ficheroDeTexto(cierreAmbiguo, 'cierre.txt'))

    expect(dialogo.aperturas).toHaveLength(1)
    expect(store.set).toHaveBeenCalledTimes(1)
  })

  it('`destruir` deja mudo el cableado: un fichero tardío no escribe en el store', async () => {
    const medicion = cablear({ dialogo: dialogoQueResponde() })
    medicion.destruir()
    await medicion.alFichero(ficheroDeTexto(CUADRADO, 'p.txt'))

    expect(store.set).not.toHaveBeenCalled()
  })

  it('el contrato con el programador se comprueba antes de tocar un nodo', () => {
    expect(() => cablearMedicion({ estado: null, panel: panelFalso })).toThrow(TypeError)
    expect(() => cablearMedicion({ estado: store, panel: null })).toThrow(TypeError)
    expect(() =>
      cablearMedicion({ estado: store, panel: panelFalso, procedencia, alCargarParcela: 42 }),
    ).toThrow(TypeError)
  })
})

/* -------------------------------------------------------------------------- *
 * F19 · El cotejo de superficie llega AL PANEL, y sobrevive al diálogo        *
 *                                                                            *
 * ⛔ Esto lo puso aquí un caso REAL del 2026-08-06, el día que F19 se         *
 * publicó. Un técnico pegó la LISTA de una parcela suya y entraron 16         *
 * vértices y 168,5851 m² cuando el dibujo declaraba 276,5018: la copia se     *
 * había cortado —la LISTA pagina en la ventana de texto del CAD— y faltaba    *
 * el último vértice. Los 107,9167 m² y los 8,7738 m de perímetro que          *
 * faltaban eran EL MISMO TRIÁNGULO, el del vértice perdido.                   *
 *                                                                            *
 * La aplicación lo dijo bien... una vez, en el diálogo del pegado, que se     *
 * cierra. Después el panel no lo repetía, y por la vía de FICHERO no salía    *
 * en ningún sitio — la decisión 5 de F19, sin implementar.                    *
 * -------------------------------------------------------------------------- */

/** El pegado REAL del 2026-08-06, con su último vértice perdido. */
const LIST_TRUNCADO = [
  'Comando: LISTA',
  '--------------------- LWPOLYLINE ----------------------------------',
  '                           Capa:  0',
  '            Marcas de polilínea:  Cerrado',
  '                           Área:  276.5018',
  '                      Perímetro:  64.8189',
  ...[
    [372516.02, 4084674.06], [372514.61, 4084657.0], [372502.97, 4084657.97],
    [372502.54, 4084658.13], [372502.16, 4084658.32], [372501.85, 4084658.49],
    [372501.5, 4084658.75], [372501.19, 4084659.0], [372500.85, 4084659.31],
    [372500.53, 4084659.63], [372500.23, 4084659.95], [372499.89, 4084660.4],
    [372499.63, 4084660.81], [372499.31, 4084661.38], [372499.04, 4084661.99],
    [372498.77, 4084662.8],
  ].map(([x, y]) => `                      Ubicación:  X= ${x.toFixed(4)}  Y= ${y.toFixed(4)}  Z= 0.0000`),
].join('\n')

describe('app/cableado-medicion · F19 · el cotejo de superficie en el panel', () => {
  it('⛔ el caso real: entra la geometría Y el panel dice que la superficie no cuadra', async () => {
    const medicion = cablear({ dialogo: dialogoQueResponde() })
    await medicion.alTexto(LIST_TRUNCADO, 'coordenadas pegadas')

    // La geometría ENTRA: la aplicación no sabe cuál de las dos cifras es la
    // buena, y rechazar el fichero sería dictaminar que el dibujo tiene razón.
    expect(store.set).toHaveBeenCalledTimes(1)
    expect(store.set.mock.calls[0][0].recintos[0].vertices).toHaveLength(16)

    // Y se DICE, con las dos cifras y la diferencia.
    expect(dijo('276,5018')).toBe(true) // la que declara el dibujo
    expect(dijo('168,5851')).toBe(true) // la que sale aquí
    expect(dijo('107,9167')).toBe(true) // lo que se ha perdido
  })

  it('⭐ y nombra la sospecha SIN dictaminar cuál de las dos cifras es la buena', async () => {
    const medicion = cablear({ dialogo: dialogoQueResponde() })
    await medicion.alTexto(LIST_TRUNCADO, 'coordenadas pegadas')

    const aviso = avisos.find((a) => a.mensaje.includes('276,5018')).mensaje
    // Declara MÁS de lo que sale ⇒ la sospecha es geometría que no ha llegado.
    expect(aviso).toMatch(/pagina|copiarla a medias|no haya llegado/i)
    // ⚠️ Pero no afirma que el dibujo esté bien ni que la medición esté mal.
    expect(aviso).not.toMatch(/incorrect|erróne|mal medid/i)
  })

  it('⭐ es EL ÚLTIMO en emitirse, porque el panel pone el más reciente arriba', async () => {
    // Comprobado en `app/avisos.js` (regla de diseño 6) y no supuesto: con doce
    // tarjetas de tope, enterrar esto bajo los avisos de separador decimal sería
    // no decirlo. Este guardián es lo que impide que alguien lo reordene sin ver.
    const medicion = cablear({ dialogo: dialogoQueResponde() })
    await medicion.alTexto(LIST_TRUNCADO, 'coordenadas pegadas')

    expect(avisos.length).toBeGreaterThan(1)
    expect(avisos[avisos.length - 1].mensaje).toMatch(/276,5018/)
  })

  it('⭐ y sale también POR FICHERO, que es la decisión 5 de F19 sin implementar', async () => {
    // Por esta vía no hay diálogo de pegado que lo enseñe: si no saliera aquí, no
    // saldría en ninguna parte. Es el hueco que el caso real destapó.
    const medicion = cablear({ dialogo: dialogoQueResponde() })
    await medicion.alFichero(ficheroDeTexto(LIST_TRUNCADO, 'parcela.txt'))

    expect(dijo('276,5018')).toBe(true)
    expect(dijo('168,5851')).toBe(true)
  })

  it('cuando las dos cifras CUADRAN el panel se calla: una coincidencia no es un aviso', async () => {
    // `avisosDe` ya descarta las INFO por lo mismo. La confirmación se da donde
    // sirve —el diálogo del pegado, mientras aún se puede cancelar— y ahí se da
    // SIEMPRE (decisión 4). Aquí sería ruido sobre el canal de los problemas.
    const bueno = LIST_TRUNCADO.replace('276.5018', '168.5851')
    const medicion = cablear({ dialogo: dialogoQueResponde() })
    await medicion.alTexto(bueno, 'coordenadas pegadas')

    expect(store.set).toHaveBeenCalledTimes(1)
    expect(dijo('168,5851')).toBe(false)
    expect(dijo('no cuadra')).toBe(false)
  })

  it('sin superficie declarada no se inventa ninguna: `.dxf` y `.txt` no la traen', async () => {
    const medicion = cablear({ dialogo: dialogoQueResponde() })
    await medicion.alTexto(CUADRADO, 'coordenadas pegadas')

    expect(dijo('no cuadra')).toBe(false)
    expect(dijo('declara')).toBe(false)
  })
})

describe('app/cableado-medicion · F19 · avisoDeSuperficie (la función pura)', () => {
  it('sin cotejo, o cuadrando, no hay nada que decir', () => {
    expect(avisoDeSuperficie(null)).toBeNull()
    expect(avisoDeSuperficie(undefined)).toBeNull()
    expect(avisoDeSuperficie({ coincide: true, reportada: 61, calculada: 61, diferencia: 0 })).toBeNull()
  })

  it('declarar MENOS de lo que sale apunta a un vértice repetido, no a uno perdido', () => {
    const aviso = avisoDeSuperficie({
      coincide: false,
      reportada: 100,
      calculada: 150,
      diferencia: 50,
    })
    expect(aviso).toMatch(/MENOS/)
    expect(aviso).toMatch(/repetido|de más/i)
    expect(aviso).not.toMatch(/pagina/i) // la sospecha del otro signo, aquí no
  })
})

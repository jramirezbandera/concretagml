/* -------------------------------------------------------------------------- *
 * test/export/proyecto.test.js — F10 · T3.2 · El fichero de proyecto          *
 *                                                                            *
 * Dos mitades muy distintas, y la segunda es la que importa:                  *
 *                                                                            *
 *   1. **La ida y vuelta**, sobre la parcela REAL del WFS: lo que sale de     *
 *      `aProyecto`, pasado por `JSON.stringify`/`parse` —que es lo que de     *
 *      verdad ocurre entre exportar e importar— y devuelto por `deProyecto`,  *
 *      es el MISMO expediente. Incluida la parte que no se ve: la geometría   *
 *      oficial vuelve CONGELADA, porque JSON no conserva `Object.freeze`      *
 *      igual que no lo conserva `structuredClone` (la trampa medida en la     *
 *      fase 0 y ya escrita en `storage/expedientes.js`).                      *
 *                                                                            *
 *   2. **La batería de ficheros rotos**: JSON truncado, un GML soltado por    *
 *      error, un array, un fichero de otro programa, un expediente a medias,  *
 *      un huso que no dibujamos, una versión del futuro, claves de más. La    *
 *      regla es UNA y se afirma en todos: `deProyecto` **no lanza nunca** por *
 *      el contenido del fichero. Es la lección de F08 entera.                 *
 *                                                                            *
 * ⚠️ Los expedientes de prueba llevan `metadatos` EXPLÍCITOS. `crearExpediente` *
 * rellena `creado`/`modificado` con el reloj del sistema cuando faltan, y una *
 * prueba de igualdad estructural sobre eso sería intermitente por diseño.     *
 *                                                                            *
 * Proyecto Vitest `node`: JSON y modelo, sin DOM.                             *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SEVERIDAD, TIPO_EXPORT } from '../../export/_comun.js'
import {
  CLAVES_EXPEDIENTE,
  CLAVES_SOBRE,
  FORMATO_PROYECTO,
  MOTIVO_PROYECTO,
  VERSION_PROYECTO,
  aProyecto,
  deProyecto,
} from '../../export/proyecto.js'
import { parsearGml } from '../../gml/parse.js'
import { SRS_VALIDOS, crearExpediente } from '../../model/parcela.js'

const RAIZ = join(import.meta.dirname, '..', '..')

// ── El fixture REAL ─────────────────────────────────────────────────────────

const REF = '9398516VK3799G'
const SRS = 'EPSG:25830'

const DEL_WFS = parsearGml(
  readFileSync(join(RAIZ, 'test', 'fixtures', 'gml', `cp_parcela_${REF}.gml`), 'utf8'),
).parcelas[0]

const clon = (v) => JSON.parse(JSON.stringify(v))

const FECHA = new Date(Date.UTC(2026, 7, 3, 9, 45, 12))

/** Metadatos fijos: ver la advertencia de la cabecera. */
const METADATOS = Object.freeze({
  creado: '2026-07-01T08:00:00.000Z',
  modificado: '2026-08-03T09:40:00.000Z',
  autor: 'Colegiado de prueba',
  idDocumento: 'DOC-1',
})

/** Un expediente real: la parcela del WFS, editada y con su geometría oficial. */
function expedienteReal() {
  const recintos = clon(DEL_WFS.recintos)
  const editados = clon(DEL_WFS.recintos)
  editados[0].vertices[0][0] += 0.4 // una edición de verdad, como la de F06
  return crearExpediente({
    srs: SRS,
    metadatos: { ...METADATOS },
    parcela: {
      idLocal: 'PARCELA-1',
      refcat: REF,
      origen: 'WFS',
      recintos: editados,
      geometriaOficial: recintos,
      superficieCatastral: 1536,
    },
  })
}

/** Lo que de verdad viaja: el POJO pasado por JSON, ida y vuelta. */
const porElFichero = (proyecto) => JSON.parse(JSON.stringify(proyecto))

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Escribir
// ═════════════════════════════════════════════════════════════════════════════

describe('export/proyecto · aProyecto', () => {
  it('el sobre lleva la marca, la versión, la fecha inyectada y el rótulo', () => {
    const p = aProyecto(expedienteReal(), { fecha: FECHA, nombre: '  Linde norte  ' })
    expect(p.formato).toBe(FORMATO_PROYECTO)
    expect(p.version).toBe(VERSION_PROYECTO)
    expect(p.generado).toBe('2026-08-03T09:45:12.000Z')
    expect(p.nombre).toBe('Linde norte') // recortado
  })

  it('el sobre no tiene una clave de más ni de menos', () => {
    // Si alguien añade un campo al fichero sin declararlo en CLAVES_SOBRE, el lector
    // lo denunciará como CLAVE_DESCONOCIDA en su propio fichero. Mejor que salte aquí.
    const p = aProyecto(expedienteReal(), { fecha: FECHA })
    expect(Object.keys(p).sort()).toEqual([...CLAVES_SOBRE].sort())
  })

  it('el `expediente` es LITERALMENTE el del modelo, sin adaptador', () => {
    const original = expedienteReal()
    const p = aProyecto(original, { fecha: FECHA })
    expect(Object.keys(p.expediente).sort()).toEqual([...CLAVES_EXPEDIENTE].sort())
    expect(p.expediente).toEqual(original)
  })

  it('un nombre vacío o en blanco se guarda como `null`, no como cadena vacía', () => {
    expect(aProyecto(expedienteReal(), { fecha: FECHA }).nombre).toBeNull()
    expect(aProyecto(expedienteReal(), { fecha: FECHA, nombre: '   ' }).nombre).toBeNull()
  })

  it('lo que se escribe pasa por `crearExpediente`: un expediente inválido LANZA', () => {
    // Escribir un fichero inválido para que lo abra otra persona no es degradación del
    // entorno: es un fallo nuestro, y tiene que sonar aquí y no en su ordenador.
    expect(() => aProyecto({ tipo: 'PARCELA', srs: 'EPSG:4326' }, { fecha: FECHA })).toThrow(RangeError)
    expect(() =>
      aProyecto({ tipo: 'PARCELA', srs: SRS, parcela: { origen: 'WFS' } }, { fecha: FECHA }),
    ).toThrow(TypeError)
  })

  it('sin fecha, o con una fecha inservible, no se compone un fichero sin fechar', () => {
    expect(() => aProyecto(expedienteReal(), {})).toThrow(TypeError)
    expect(() => aProyecto(expedienteReal(), { fecha: '2026-08-03' })).toThrow(TypeError)
    expect(() => aProyecto(expedienteReal(), { fecha: new Date('nada') })).toThrow(RangeError)
    expect(() => aProyecto(expedienteReal(), { fecha: FECHA, nombre: 42 })).toThrow(TypeError)
  })

  it('el JSON resultante es legible por un humano y no pierde ni un vértice', () => {
    const texto = JSON.stringify(aProyecto(expedienteReal(), { fecha: FECHA }), null, 2)
    expect(texto).toContain(FORMATO_PROYECTO)
    expect(texto).toContain(REF)
    const vuelta = JSON.parse(texto)
    expect(vuelta.expediente.parcela.recintos[0].vertices.length).toBe(
      DEL_WFS.recintos[0].vertices.length,
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · La ida y vuelta
// ═════════════════════════════════════════════════════════════════════════════

describe('export/proyecto · exportar e importar devuelve el mismo expediente', () => {
  it('la ida y vuelta por JSON conserva el expediente entero', () => {
    const original = expedienteReal()
    const r = deProyecto(porElFichero(aProyecto(original, { fecha: FECHA, nombre: 'Linde norte' })))

    expect(r.ok).toBe(true)
    expect(r.motivo).toBeNull()
    expect(r.avisos).toEqual([])
    expect(r.nombre).toBe('Linde norte')
    expect(r.generado).toBe('2026-08-03T09:45:12.000Z')
    expect(r.version).toBe(VERSION_PROYECTO)
    expect(r.expediente).toEqual(original)
  })

  it('también funciona desde el TEXTO, que es lo que llega de un `File`', () => {
    const texto = JSON.stringify(aProyecto(expedienteReal(), { fecha: FECHA }), null, 2)
    const r = deProyecto(texto)
    expect(r.ok).toBe(true)
    expect(r.expediente.parcela.refcat).toBe(REF)
  })

  it('⭐ la geometría oficial vuelve CONGELADA, aunque JSON no conserve el freeze', () => {
    // Las dos mitades, como en `storage/expedientes.js`: primero que el peligro es REAL
    // en este arnés —el objeto crudo vuelve del JSON descongelado—, y luego que
    // `deProyecto` lo arregla. Sin la primera mitad, la segunda podría estar pasando
    // por casualidad.
    const proyecto = porElFichero(aProyecto(expedienteReal(), { fecha: FECHA }))
    expect(Object.isFrozen(proyecto.expediente.parcela.geometriaOficial)).toBe(false)

    const { expediente } = deProyecto(proyecto)
    const oficial = expediente.parcela.geometriaOficial
    expect(Object.isFrozen(oficial)).toBe(true)
    expect(Object.isFrozen(oficial[0])).toBe(true)
    expect(Object.isFrozen(oficial[0].vertices)).toBe(true)
    expect(Object.isFrozen(oficial[0].vertices[0])).toBe(true)
    expect(() => {
      oficial[0].vertices[0][0] = 0
    }).toThrow(TypeError)
  })

  it('los recintos EDITABLES siguen siéndolo: congelar de más rompería F06', () => {
    const { expediente } = deProyecto(porElFichero(aProyecto(expedienteReal(), { fecha: FECHA })))
    const recintos = expediente.parcela.recintos
    expect(Object.isFrozen(recintos)).toBe(false)
    recintos[0].vertices[0][0] += 1 // no lanza: la edición sigue viva
    expect(recintos[0].vertices[0][0]).toBeGreaterThan(0)
  })

  it('⭐ los PUNTOS del levantamiento cruzan el fichero, y vuelven congelados', () => {
    // El fichero de proyecto es lo que hace que «sin backend» no signifique «sin
    // salida» (SPEC §1): es la copia de seguridad y la forma de mandarle un
    // expediente a un compañero. Un expediente a medio dibujar que llegue sin sus
    // dianas obliga al que lo abre a pedir el DXF por separado.
    const nube = [
      [440123.45, 4470987.65],
      [440163.45, 4470987.65],
      [440163.45, 4471027.65],
    ]
    const conPuntos = crearExpediente({
      srs: SRS,
      metadatos: { ...METADATOS },
      parcela: {
        idLocal: 'levantamiento.dxf',
        origen: 'DXF',
        // CERO recintos: el levantamiento importado sin unir, que es el estado más
        // fácil de perder por el camino porque no hay geometría que lo delate.
        recintos: [],
        puntosLevantamiento: nube,
      },
    })

    const { expediente } = deProyecto(porElFichero(aProyecto(conPuntos, { fecha: FECHA })))
    expect(expediente.parcela.puntosLevantamiento).toEqual(nube)
    expect(expediente.parcela.recintos).toEqual([])
    expect(Object.isFrozen(expediente.parcela.puntosLevantamiento)).toBe(true)
  })

  it('la geometría oficial NO se contagia de la edición: son copias independientes', () => {
    const { expediente } = deProyecto(porElFichero(aProyecto(expedienteReal(), { fecha: FECHA })))
    const antes = expediente.parcela.geometriaOficial[0].vertices[0][0]
    expediente.parcela.recintos[0].vertices[0][0] += 5
    expect(expediente.parcela.geometriaOficial[0].vertices[0][0]).toBe(antes)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Ficheros rotos: la regla es que NUNCA se lanza
// ═════════════════════════════════════════════════════════════════════════════

describe('export/proyecto · un fichero ajeno no revienta nunca', () => {
  /** Todo lo que un usuario podría soltar en la entrada de proyecto. */
  const ROTOS = [
    ['texto que no es JSON', 'esto no es json ni de lejos'],
    ['JSON truncado', '{"formato": "concreta-gml/proyecto", "version": 1'],
    ['un GML del Catastro', '<?xml version="1.0"?>\n<gml:FeatureCollection/>'],
    ['un HTML', '<!doctype html><html></html>'],
    ['un array JSON', '[1, 2, 3]'],
    ['un número JSON', '42'],
    ['`null` JSON', 'null'],
    ['una cadena JSON', '"hola"'],
    ['un objeto vacío', '{}'],
    ['un fichero de otro programa', '{"formato": "otra-cosa/v3", "datos": []}'],
    ['el sobre sin expediente', `{"formato": "${FORMATO_PROYECTO}", "version": 1}`],
    ['el expediente a null', `{"formato": "${FORMATO_PROYECTO}", "expediente": null}`],
    ['el expediente como lista', `{"formato": "${FORMATO_PROYECTO}", "expediente": []}`],
    [
      'un expediente sin `origen` en la parcela',
      JSON.stringify({
        formato: FORMATO_PROYECTO,
        version: 1,
        expediente: { tipo: 'PARCELA', srs: SRS, parcela: { idLocal: 'x', recintos: [] } },
      }),
    ],
    [
      'un expediente con los recintos del revés',
      JSON.stringify({
        formato: FORMATO_PROYECTO,
        version: 1,
        expediente: {
          tipo: 'PARCELA',
          srs: SRS,
          parcela: {
            idLocal: 'x',
            origen: 'WFS',
            recintos: [{ tipo: 'HUECO', vertices: [[1, 1], [2, 2], [3, 3]] }],
          },
        },
      }),
    ],
    ['una cadena vacía', ''],
  ]

  it.each(ROTOS)('«%s» → `ok:false` con su motivo, sin una sola excepción', (_que, contenido) => {
    let r
    expect(() => {
      r = deProyecto(contenido)
    }).not.toThrow()
    expect(r.ok).toBe(false)
    expect(Object.values(MOTIVO_PROYECTO)).toContain(r.motivo)
    expect(typeof r.mensaje).toBe('string')
    expect(r.mensaje.length).toBeGreaterThan(20) // una frase, no un código
    expect(r.expediente).toBeNull()
    expect(Array.isArray(r.avisos)).toBe(true)
  })

  it('soltar un GML se dice CON su nombre, y remite al botón que sí lo abre', () => {
    // Con dos entradas de fichero en la misma pantalla es el error más probable, y el
    // mensaje de `JSON.parse` («Unexpected token <») no le dice nada a nadie.
    const r = deProyecto('<?xml version="1.0"?>\n<gml:FeatureCollection/>')
    expect(r.motivo).toBe(MOTIVO_PROYECTO.NO_ES_JSON)
    expect(r.mensaje).toMatch(/GML/)
    expect(r.mensaje).toMatch(/Abrir un GML/)
  })

  it('un fichero de otro programa dice QUÉ formato traía y cuál se esperaba', () => {
    const r = deProyecto('{"formato": "otra-cosa/v3"}')
    expect(r.motivo).toBe(MOTIVO_PROYECTO.OTRO_FORMATO)
    expect(r.mensaje).toContain('otra-cosa/v3')
    expect(r.mensaje).toContain(FORMATO_PROYECTO)
  })

  it('un huso que no dibujamos se rechaza NOMBRÁNDOLO, y sin abrir nada a medias', () => {
    const r = deProyecto(
      JSON.stringify({
        formato: FORMATO_PROYECTO,
        version: 1,
        expediente: { tipo: 'PARCELA', srs: 'EPSG:32628', parcela: null },
      }),
    )
    expect(r.motivo).toBe(MOTIVO_PROYECTO.SRS_NO_SOPORTADO)
    expect(r.mensaje).toContain('EPSG:32628')
    for (const srs of SRS_VALIDOS) expect(r.mensaje).toContain(srs)
    expect(r.expediente).toBeNull()
  })

  it('un expediente que el modelo rechaza arrastra el motivo del modelo, no lo esconde', () => {
    const r = deProyecto(
      JSON.stringify({
        formato: FORMATO_PROYECTO,
        version: 1,
        expediente: { tipo: 'PARCELA', srs: SRS, parcela: { idLocal: 'x', origen: 'INVENTADO' } },
      }),
    )
    expect(r.motivo).toBe(MOTIVO_PROYECTO.EXPEDIENTE_ILEGIBLE)
    expect(r.mensaje).toContain('INVENTADO') // el mensaje de crearParcela, entero
  })

  it('solo lanza si la LLAMADA está mal, que no es un fichero raro', () => {
    // La frontera de siempre: el entorno degrada, el programador revienta.
    expect(() => deProyecto(42)).toThrow(TypeError)
    expect(() => deProyecto(null)).toThrow(TypeError)
    expect(() => deProyecto(undefined)).toThrow(TypeError)
    expect(() => deProyecto([])).toThrow(TypeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · Tolerante y declarante
// ═════════════════════════════════════════════════════════════════════════════

describe('export/proyecto · lo que se tolera, se dice', () => {
  const conSobre = (extra) =>
    deProyecto({
      formato: FORMATO_PROYECTO,
      version: VERSION_PROYECTO,
      expediente: porElFichero(expedienteReal()),
      ...extra,
    })

  it('una versión POSTERIOR se abre igual, pero con su aviso y su cifra', () => {
    const r = conSobre({ version: 99 })
    expect(r.ok).toBe(true)
    expect(r.version).toBe(99) // la que DECLARA el fichero, no la nuestra
    const aviso = r.avisos.find((a) => a.tipo === TIPO_EXPORT.VERSION_POSTERIOR)
    expect(aviso).toBeDefined()
    expect(aviso.severidad).toBe(SEVERIDAD.AVISO)
    expect(aviso.mensaje).toContain('99')
    expect(aviso.datos).toEqual({ version: 99, conocida: VERSION_PROYECTO })
  })

  it('una versión ilegible se lee como la actual, diciéndolo', () => {
    const r = conSobre({ version: 'uno' })
    expect(r.ok).toBe(true)
    expect(r.version).toBeNull()
    expect(r.avisos.some((a) => a.tipo === TIPO_EXPORT.VERSION_POSTERIOR)).toBe(true)
  })

  it('la versión actual NO produce ningún aviso', () => {
    // Anti-vacuidad de las dos de arriba: si el aviso saltara siempre, no diría nada.
    expect(conSobre({}).avisos).toEqual([])
  })

  it('una clave de más en el sobre se declara POR SU NOMBRE', () => {
    const r = conSobre({ colorFavorito: 'azul', otraCosa: 1 })
    expect(r.ok).toBe(true)
    const aviso = r.avisos.find((a) => a.tipo === TIPO_EXPORT.CLAVE_DESCONOCIDA)
    expect(aviso.datos.claves).toEqual(['colorFavorito', 'otraCosa'])
    expect(aviso.mensaje).toContain('colorFavorito')
    expect(aviso.datos.donde).toContain('cabecera')
  })

  it('una clave de más DENTRO del expediente también, y se distingue de la anterior', () => {
    const r = conSobre({
      expediente: { ...porElFichero(expedienteReal()), diagnostico: { area: 1 } },
    })
    expect(r.ok).toBe(true)
    const aviso = r.avisos.find((a) => a.tipo === TIPO_EXPORT.CLAVE_DESCONOCIDA)
    expect(aviso.datos.claves).toEqual(['diagnostico'])
    expect(aviso.datos.donde).toContain('expediente')
    // Y la clave de más no ha entrado en el modelo.
    expect(r.expediente.diagnostico).toBeUndefined()
  })

  /** Un sobre con un expediente de EDIFICIO dentro. Se usa dos veces. */
  const conEdificio = () =>
    conSobre({
      expediente: porElFichero(
        crearExpediente({
          tipo: 'EDIFICIO',
          srs: SRS,
          metadatos: { ...METADATOS },
          edificio: { modelo: 'SIMPLE', partes: [] },
        }),
      ),
    })

  it('un expediente de EDIFICIO se LEE, y se avisa de qué se puede hacer con él', () => {
    const r = conEdificio()
    expect(r.ok).toBe(true)
    expect(r.expediente.tipo).toBe('EDIFICIO')
    expect(r.expediente.edificio.modelo).toBe('SIMPLE')
    expect(r.avisos.some((a) => /EDIFICIO/.test(a.mensaje))).toBe(true)
    // El código no distingue («VERSION_POSTERIOR» lo comparte con otras dos cosas), así
    // que quien decida por código lo hace por `datos.tipo`. Es lo que sostiene el aviso
    // del cableado, y está declarado en el fichero.
    const aviso = r.avisos.find((a) => a.datos?.tipo === 'EDIFICIO')
    expect(aviso).toBeDefined()
    expect(aviso.severidad).toBe(SEVERIDAD.AVISO)
  })

  it('⛔ F11 · el aviso DICE LA VERDAD sobre lo que la aplicación sabe hacer hoy', () => {
    // Este `it` existe porque el aviso de F10 se quedó viejo el día que aterrizó la
    // segunda rama: decía «esta versión de la aplicación solo sabe enseñar y editar la
    // rama de parcela», y desde F11 la rama de edificio se abre, se dibuja y se edita.
    // Un aviso caducado es peor que ninguno: el usuario decide con él.
    const aviso = conEdificio().avisos.find((a) => a.datos?.tipo === 'EDIFICIO')

    // ⛔ **Y se volvió a quedar viejo en F12 · T4.3**, que es exactamente lo que este
    // `it` existe para que pase en rojo y no en silencio: decía «lo que todavía no hace
    // es guardarlo en el almacén de este navegador, de momento solo se conserva en el
    // fichero de proyecto», y desde T4.3 el edificio tiene identidad, clave de borrador
    // propia y autoguardado. Lo que sigue faltando es archivarlo CON NOMBRE.

    // 1 · Lo que YA NO es cierto no puede seguir escrito. Las dos caducidades, la de
    //     F11 y la de F12, se quedan aquí: son la memoria de por qué el texto es éste.
    expect(aviso.mensaje).not.toMatch(/solo sabe enseñar/i)
    expect(aviso.mensaje).not.toMatch(/solo\s+.{0,20}la rama de parcela/i)
    expect(aviso.mensaje).not.toMatch(/guardarlo en el almacén de este navegador/i)
    expect(aviso.mensaje).not.toMatch(/solo se conserva en el fichero/i)

    // 2 · Lo que SÍ hace, dicho: se abre en su rama, se ve, y se autoguarda.
    expect(aviso.mensaje).toMatch(/rama Edificio/)
    expect(aviso.mensaje).toMatch(/autoguarda/i)

    // 3 · Y las tres cosas que NO hace, nombradas una a una (F12 · T4.3 y las fases
    //     F13/F14). Sin esto el aviso sería una promesa a medias.
    expect(aviso.mensaje).toMatch(/archivarlo con nombre/i)
    expect(aviso.mensaje).toMatch(/GML/)
    expect(aviso.mensaje).toMatch(/contrastarlo/i)
  })

  it('el resumen cuenta lo mismo que la lista de avisos', () => {
    const r = conSobre({ version: 99, algoRaro: true })
    expect(r.resumen.total).toBe(r.avisos.length)
    expect(r.resumen.total).toBe(2)
    expect(r.resumen.porSeveridad[SEVERIDAD.AVISO]).toBe(2)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Guardianes
// ═════════════════════════════════════════════════════════════════════════════

describe('export/proyecto · guardianes', () => {
  it('`CLAVES_EXPEDIENTE` se DERIVA del modelo, no se escribe a mano', () => {
    // Si el modelo crece y esta lista no, el lector avisaría de una clave que sí
    // entiende. La derivación lo impide; esto solo comprueba que sigue derivada.
    expect(CLAVES_EXPEDIENTE).toEqual(Object.keys(crearExpediente()))
    expect(CLAVES_EXPEDIENTE).toContain('parcela')
    expect(CLAVES_EXPEDIENTE).toContain('edificio')
    expect(Object.isFrozen(CLAVES_EXPEDIENTE)).toBe(true)
  })

  it('el módulo no importa nada de `viewer/`, `services/`, `storage/` ni `app/`', () => {
    // `export/` sale por el barrel raíz y corre en el proyecto `node`. Un import de
    // `storage/` invertiría además las capas: un serializador puro no depende de un
    // adaptador de entorno.
    const fuente = readFileSync(join(RAIZ, 'export', 'proyecto.js'), 'utf8')
    const imports = [...fuente.matchAll(/^import .* from '(.+)'$/gm)].map((m) => m[1])
    expect(imports.length).toBeGreaterThan(0)
    for (const ruta of imports) {
      expect(ruta).not.toMatch(/\/(viewer|services|storage|app)\//)
    }
  })

  it('el módulo no consulta el reloj: la fecha entra por parámetro', () => {
    const fuente = readFileSync(join(RAIZ, 'export', 'proyecto.js'), 'utf8')
    expect(fuente).not.toMatch(/Date\.now\(\)/)
    expect(fuente).not.toMatch(/new Date\(/)
  })
})

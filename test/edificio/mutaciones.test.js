/* -------------------------------------------------------------------------- *
 * test/edificio/mutaciones.test.js — Las cuatro mutaciones puras (F11, T1.3)  *
 *                                                                            *
 * Lo que se prueba aquí, por orden de importancia:                           *
 *   1. NINGUNA muta el original. Se compara referencia Y contenido, con un    *
 *      snapshot `structuredClone` de antes: es lo que sostiene el undo/redo.  *
 *   2. `conModelo` COMPLETO→SIMPLIFICADO enumera los SIETE atributos que se   *
 *      pierden ANTES de perderlos, y el edificio resultante no tiene ni una   *
 *      de esas claves. La vuelta los repone a `null` sin inventar valores.    *
 *   3. Índice fuera de rango LANZA (contrato del programador); nombre vacío   *
 *      NO lanza (dato de usuario) — y esa asimetría es deliberada.            *
 * -------------------------------------------------------------------------- */

import { describe, expect, it } from 'vitest'

import {
  ROTULO_ATRIBUTO,
  conAtributos,
  conModelo,
  conParteRenombrada,
  conRefcat,
} from '../../edificio/mutaciones.js'
import { SEVERIDAD, TIPO_EDIFICIO } from '../../edificio/_comun.js'
import {
  ATRIBUTOS_COMPLETO,
  ESTADO_CONSERVACION,
  MODELO_EDIFICIO,
  ORIGEN_PARTE,
  crearEdificio,
  crearParteConstruccion,
} from '../../model/edificio.js'

// ── Andamiaje ─────────────────────────────────────────────────────────────────

const recinto = (dx = 0) => ({
  tipo: 'EXTERIOR',
  vertices: [
    [440123.45 + dx, 4100200.1],
    [440150.0 + dx, 4100200.1],
    [440150.0 + dx, 4100230.5],
    [440123.45 + dx, 4100230.5],
  ],
})

const partesDeEjemplo = () => [
  crearParteConstruccion({ nombre: 'Parte 1', recinto: recinto(0), origen: ORIGEN_PARTE.DXF }),
  crearParteConstruccion({ nombre: 'Parte 2', recinto: recinto(40), origen: ORIGEN_PARTE.DXF }),
  crearParteConstruccion({ nombre: 'Parte 3', origen: ORIGEN_PARTE.DXF }), // sin recinto
]

/** Edificio COMPLETO con los siete atributos rellenos. */
const edificioCompleto = () =>
  crearEdificio({
    refcat: '9398516VK3799G',
    modelo: MODELO_EDIFICIO.COMPLETO,
    partes: partesDeEjemplo(),
    parcelaContexto: [recinto(-10)],
    construccionOficial: [
      crearParteConstruccion({ nombre: 'oficial', recinto: recinto(0), origen: ORIGEN_PARTE.WFS }),
    ],
    usoDominante: 'residencial',
    estadoConservacion: ESTADO_CONSERVACION.FUNCIONAL,
    anioConstruccion: 1998,
    anioReforma: 2015,
    numeroInmuebles: 4,
    numeroViviendas: 3,
    superficieConstruida: 312.5,
  })

/** Edificio SIMPLIFICADO (el caso frecuente: ICUC). */
const edificioSimplificado = () =>
  crearEdificio({ modelo: MODELO_EDIFICIO.SIMPLIFICADO, partes: partesDeEjemplo() })

/**
 * Ejecuta `fn(edificio)` y comprueba que el original no se ha tocado NI EN
 * REFERENCIA NI EN CONTENIDO. Devuelve el resultado para seguir afirmando.
 */
function sinMutar(edificio, fn) {
  const antes = structuredClone(edificio)
  const refPartes = edificio.partes
  const resultado = fn(edificio)
  expect(edificio, 'el POJO del store se ha mutado').toEqual(antes)
  expect(edificio.partes, 'el array de partes se ha reemplazado').toBe(refPartes)
  expect(resultado.edificio, 'la mutación ha devuelto el MISMO objeto').not.toBe(edificio)
  expect(resultado.edificio.partes).not.toBe(edificio.partes)
  return resultado
}

// ── La forma del resultado ────────────────────────────────────────────────────

describe('edificio/mutaciones — la forma que ven T2.1, T2.5 y T3.2', () => {
  it('las CUATRO devuelven {edificio, detecciones}, no un Edificio pelado', () => {
    const e = edificioCompleto()
    for (const r of [
      conModelo(e, MODELO_EDIFICIO.COMPLETO),
      conRefcat(e, '1234567AB1234C'),
      conParteRenombrada(e, 0, 'vivienda'),
      conAtributos(e, { numeroViviendas: 9 }),
    ]) {
      expect(Object.keys(r).sort()).toEqual(['detecciones', 'edificio'])
      expect(Array.isArray(r.detecciones)).toBe(true)
      expect(r.edificio.modelo).toBe('COMPLETO')
    }
  })

  it('el edificio devuelto sigue siendo un POJO clonable (regla de oro 4)', () => {
    const { edificio } = conRefcat(edificioCompleto(), 'X')
    expect(Object.getPrototypeOf(edificio)).toBe(Object.prototype)
    expect(structuredClone(edificio)).toEqual(edificio)
  })

  it('LANZAN si lo que reciben no tiene forma de Edificio (contrato del programador)', () => {
    for (const malo of [null, undefined, 42, 'edificio', [], { refcat: 'x' }]) {
      expect(() => conModelo(malo, MODELO_EDIFICIO.COMPLETO)).toThrow(TypeError)
      expect(() => conRefcat(malo, 'x')).toThrow(TypeError)
      expect(() => conParteRenombrada(malo, 0, 'x')).toThrow(TypeError)
      expect(() => conAtributos(malo, {})).toThrow(TypeError)
    }
  })
})

// ── conModelo ─────────────────────────────────────────────────────────────────

describe('conModelo — COMPLETO → SIMPLIFICADO borra los siete, y lo dice antes', () => {
  it('enumera LOS SIETE atributos que se pierden, con clave y con rótulo', () => {
    const { detecciones } = sinMutar(edificioCompleto(), (e) =>
      conModelo(e, MODELO_EDIFICIO.SIMPLIFICADO),
    )
    expect(detecciones).toHaveLength(1)
    const [d] = detecciones
    expect(d.tipo).toBe(TIPO_EDIFICIO.MODELO_CAMBIADO)
    expect(d.severidad).toBe(SEVERIDAD.AVISO)
    // Los siete, por clave, en `datos`: es con lo que decide la interfaz.
    expect(d.datos.atributosPerdidos).toEqual(ATRIBUTOS_COMPLETO)
    expect(d.datos.atributosPerdidos).toHaveLength(7)
    expect(d.datos.desde).toBe('COMPLETO')
    expect(d.datos.hacia).toBe('SIMPLIFICADO')
    // Y los siete, por rótulo, en el mensaje: es lo que lee la persona.
    for (const clave of ATRIBUTOS_COMPLETO) {
      expect(d.mensaje, `el mensaje no nombra «${ROTULO_ATRIBUTO[clave]}»`).toContain(
        ROTULO_ATRIBUTO[clave],
      )
    }
  })

  it('distingue los que TIENEN valor de los que están vacíos', () => {
    const lleno = conModelo(edificioCompleto(), MODELO_EDIFICIO.SIMPLIFICADO)
    expect(lleno.detecciones[0].datos.conValor).toHaveLength(7)
    expect(lleno.detecciones[0].datos.conValor[0]).toEqual({
      clave: 'usoDominante',
      rotulo: 'uso dominante',
      valor: 'residencial',
    })

    const vacio = conModelo(
      crearEdificio({ modelo: MODELO_EDIFICIO.COMPLETO }),
      MODELO_EDIFICIO.SIMPLIFICADO,
    )
    expect(vacio.detecciones[0].datos.conValor).toEqual([])
    expect(vacio.detecciones[0].mensaje).toContain('ninguno tiene valor')
  })

  it('el edificio resultante NO tiene ninguna de las siete claves', () => {
    const { edificio } = conModelo(edificioCompleto(), MODELO_EDIFICIO.SIMPLIFICADO)
    expect(edificio.modelo).toBe('SIMPLIFICADO')
    for (const clave of ATRIBUTOS_COMPLETO) {
      expect(clave in edificio, `${clave} sigue estando`).toBe(false)
    }
    expect(Object.keys(edificio).sort()).toEqual(
      ['construccionOficial', 'modelo', 'parcelaContexto', 'partes', 'refcat'].sort(),
    )
  })

  it('conserva TODO lo demás: RC, partes, contexto y geometría oficial', () => {
    const original = edificioCompleto()
    const { edificio } = conModelo(original, MODELO_EDIFICIO.SIMPLIFICADO)
    expect(edificio.refcat).toBe('9398516VK3799G')
    expect(edificio.partes).toEqual(original.partes)
    expect(edificio.parcelaContexto).toEqual(original.parcelaContexto)
    expect(edificio.construccionOficial).toEqual(original.construccionOficial)
  })
})

describe('conModelo — SIMPLIFICADO → COMPLETO repone a null, sin inventar', () => {
  it('las siete claves aparecen y valen null', () => {
    const { edificio, detecciones } = sinMutar(edificioSimplificado(), (e) =>
      conModelo(e, MODELO_EDIFICIO.COMPLETO),
    )
    expect(edificio.modelo).toBe('COMPLETO')
    for (const clave of ATRIBUTOS_COMPLETO) {
      expect(clave in edificio).toBe(true)
      expect(edificio[clave], `${clave} se ha inventado`).toBeNull()
    }
    expect(detecciones).toHaveLength(1)
    expect(detecciones[0].tipo).toBe(TIPO_EDIFICIO.MODELO_CAMBIADO)
    expect(detecciones[0].severidad).toBe(SEVERIDAD.INFO) // añadir no destruye
    expect(detecciones[0].datos.atributosAnadidos).toEqual(ATRIBUTOS_COMPLETO)
  })

  it('la ida y vuelta NO es reversible, y el aviso lo advierte', () => {
    const original = edificioCompleto()
    const ida = conModelo(original, MODELO_EDIFICIO.SIMPLIFICADO)
    expect(ida.detecciones[0].mensaje).toContain('Volver a COMPLETO los repone vacíos')
    const vuelta = conModelo(ida.edificio, MODELO_EDIFICIO.COMPLETO)
    expect(vuelta.edificio.numeroViviendas).toBeNull() // valía 3
    expect(vuelta.edificio.usoDominante).toBeNull() // valía 'residencial'
    expect(original.numeroViviendas).toBe(3) // y el original intacto
  })
})

describe('conModelo — casos de borde', () => {
  it('cambiar al MISMO modelo no emite ninguna detección, pero devuelve otro objeto', () => {
    const original = edificioCompleto()
    const { edificio, detecciones } = conModelo(original, MODELO_EDIFICIO.COMPLETO)
    expect(detecciones).toEqual([])
    expect(edificio).not.toBe(original)
    expect(edificio).toEqual(original)
  })

  it("un typo en 'modelo' LANZA: no degrada en silencio a SIMPLIFICADO", () => {
    const e = edificioCompleto()
    for (const malo of ['Completo', 'COMPLETO ', 'simplificado', 42, null, undefined]) {
      expect(() => conModelo(e, malo)).toThrow(RangeError)
    }
  })
})

// ── conRefcat ─────────────────────────────────────────────────────────────────

describe('conRefcat', () => {
  it('cambia la RC y no toca nada más', () => {
    const original = edificioCompleto()
    const { edificio, detecciones } = sinMutar(original, (e) => conRefcat(e, '1234567AB1234C'))
    expect(edificio.refcat).toBe('1234567AB1234C')
    expect(detecciones).toEqual([])
    expect(original.refcat).toBe('9398516VK3799G')
    // Los siete atributos sobreviven a una mutación que no va con ellos.
    for (const clave of ATRIBUTOS_COMPLETO) {
      expect(edificio[clave]).toEqual(original[clave])
    }
  })

  it('acepta null (RC sin fijar) y no normaliza lo que el usuario escribe', () => {
    expect(conRefcat(edificioCompleto(), null).edificio.refcat).toBeNull()
    // Ni recorta, ni pasa a mayúsculas, ni convierte '' en null: esa decisión
    // —con su aviso— es de la interfaz.
    expect(conRefcat(edificioCompleto(), '  9398516vk3799g  ').edificio.refcat).toBe(
      '  9398516vk3799g  ',
    )
    expect(conRefcat(edificioCompleto(), '').edificio.refcat).toBe('')
  })

  it('LANZA con undefined: si no, borraría la RC en silencio', () => {
    expect(() => conRefcat(edificioCompleto(), undefined)).toThrow(TypeError)
    expect(() => conRefcat(edificioCompleto(), 42)).toThrow(TypeError)
  })
})

// ── conParteRenombrada ────────────────────────────────────────────────────────

describe('conParteRenombrada', () => {
  it('renombra la parte i y NO toca las demás', () => {
    const original = edificioCompleto()
    const { edificio, detecciones } = sinMutar(original, (e) => conParteRenombrada(e, 1, 'porche'))
    expect(detecciones).toEqual([])
    expect(edificio.partes.map((p) => p.nombre)).toEqual(['Parte 1', 'porche', 'Parte 3'])
    expect(original.partes.map((p) => p.nombre)).toEqual(['Parte 1', 'Parte 2', 'Parte 3'])
    // La parte renombrada conserva TODO lo suyo menos el nombre.
    expect(edificio.partes[1].recinto).toEqual(original.partes[1].recinto)
    expect(edificio.partes[1].origen).toBe('DXF')
    expect(edificio.partes[1].tipo).toBe('PRINCIPAL')
    // Y las otras dos son idénticas en contenido.
    expect(edificio.partes[0]).toEqual(original.partes[0])
    expect(edificio.partes[2]).toEqual(original.partes[2])
  })

  it('índice fuera de rango LANZA RangeError (contrato del programador)', () => {
    const e = edificioCompleto() // 3 partes
    for (const fuera of [3, 4, -1, 99]) {
      expect(() => conParteRenombrada(e, fuera, 'x'), `no lanzó con i=${fuera}`).toThrow(RangeError)
    }
    // Un edificio sin partes no tiene ningún índice válido.
    expect(() => conParteRenombrada(crearEdificio(), 0, 'x')).toThrow(RangeError)
  })

  it('índice no entero LANZA TypeError', () => {
    const e = edificioCompleto()
    for (const malo of [1.5, '1', null, undefined, NaN]) {
      expect(() => conParteRenombrada(e, malo, 'x')).toThrow(TypeError)
    }
  })

  it('⚠️ nombre vacío NO lanza: conserva el anterior y lo dice (dato de usuario)', () => {
    // `crearParteConstruccion` SÍ lanza con un nombre vacío (model/edificio.js:137).
    // Aquí no puede subir esa excepción: un campo de texto que el usuario borra no
    // es un contrato roto, y reventar dentro de un `click` no es una respuesta.
    const original = edificioCompleto()
    for (const vacio of ['', '   ', '\t\n']) {
      const { edificio, detecciones } = sinMutar(original, (e) => conParteRenombrada(e, 0, vacio))
      expect(edificio.partes[0].nombre).toBe('Parte 1')
      expect(detecciones).toHaveLength(1)
      expect(detecciones[0].tipo).toBe(TIPO_EDIFICIO.RENOMBRADO_IGNORADO)
      expect(detecciones[0].severidad).toBe(SEVERIDAD.AVISO)
      expect(detecciones[0].datos).toEqual({ indice: 0, nombreAnterior: 'Parte 1' })
    }
  })

  it('un nombre con espacios alrededor se guarda LITERAL (el rótulo es del usuario)', () => {
    const { edificio } = conParteRenombrada(edificioCompleto(), 0, '  cuerpo principal ')
    expect(edificio.partes[0].nombre).toBe('  cuerpo principal ')
  })

  it('nombre que no es string LANZA TypeError', () => {
    const e = edificioCompleto()
    for (const malo of [42, null, undefined, ['x']]) {
      expect(() => conParteRenombrada(e, 0, malo)).toThrow(TypeError)
    }
  })
})

// ── conAtributos ──────────────────────────────────────────────────────────────

describe('conAtributos', () => {
  it('fija un subconjunto y deja el resto como estaba', () => {
    const original = edificioCompleto()
    const { edificio, detecciones } = sinMutar(original, (e) =>
      conAtributos(e, { numeroViviendas: 9, anioReforma: 2020 }),
    )
    expect(detecciones).toEqual([])
    expect(edificio.numeroViviendas).toBe(9)
    expect(edificio.anioReforma).toBe(2020)
    expect(edificio.usoDominante).toBe('residencial')
    expect(edificio.superficieConstruida).toBe(312.5)
    expect(original.numeroViviendas).toBe(3)
  })

  it('null VACÍA el atributo; undefined significa «no tocar»', () => {
    const { edificio } = conAtributos(edificioCompleto(), {
      anioReforma: null,
      numeroViviendas: undefined,
    })
    expect(edificio.anioReforma).toBeNull()
    expect(edificio.numeroViviendas).toBe(3)
  })

  it('una clave desconocida LANZA RangeError: un typo no puede ser «no ha pasado nada»', () => {
    const e = edificioCompleto()
    expect(() => conAtributos(e, { numeroVivienda: 3 })).toThrow(RangeError)
    expect(() => conAtributos(e, { plantasSobreRasante: 2 })).toThrow(RangeError) // van por parte
    expect(() => conAtributos(e, { refcat: 'x' })).toThrow(RangeError) // eso es conRefcat
  })

  it('`parciales` que no es objeto plano LANZA TypeError', () => {
    const e = edificioCompleto()
    for (const malo of [null, undefined, 42, 'usoDominante', ['usoDominante']]) {
      expect(() => conAtributos(e, malo)).toThrow(TypeError)
    }
  })

  it('en SIMPLIFICADO no guarda nada y lo DICE (no cambia el modelo por su cuenta)', () => {
    const original = edificioSimplificado()
    const { edificio, detecciones } = sinMutar(original, (e) =>
      conAtributos(e, { numeroViviendas: 9, usoDominante: 'residencial' }),
    )
    expect(edificio.modelo).toBe('SIMPLIFICADO')
    expect('numeroViviendas' in edificio).toBe(false)
    expect('usoDominante' in edificio).toBe(false)
    expect(detecciones).toHaveLength(1)
    expect(detecciones[0].tipo).toBe(TIPO_EDIFICIO.ATRIBUTO_NO_MAPEADO)
    expect(detecciones[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(detecciones[0].mensaje).toContain('uso dominante')
    expect(detecciones[0].mensaje).toContain('nº de viviendas')
    expect(detecciones[0].datos.atributosIgnorados).toEqual(['numeroViviendas', 'usoDominante'])
  })

  it('en SIMPLIFICADO sin cambios efectivos no inventa avisos', () => {
    const { detecciones } = conAtributos(edificioSimplificado(), { numeroViviendas: undefined })
    expect(detecciones).toEqual([])
  })

  it('NO duplica la validación de valores: la hace el modelo, y LANZA', () => {
    const e = edificioCompleto()
    expect(() => conAtributos(e, { anioConstruccion: '1998' })).toThrow(TypeError)
    expect(() => conAtributos(e, { estadoConservacion: 'NUEVO' })).toThrow(RangeError)
  })

  it('ROTULO_ATRIBUTO cubre los siete y está congelado', () => {
    expect(Object.keys(ROTULO_ATRIBUTO).sort()).toEqual([...ATRIBUTOS_COMPLETO].sort())
    expect(Object.isFrozen(ROTULO_ATRIBUTO)).toBe(true)
  })
})

// ── La regla 2: la geometría oficial sobrevive intacta a las cuatro ───────────

describe('las mutaciones y la geometría oficial (regla de oro 2)', () => {
  it('`construccionOficial` sigue igual y CONGELADA después de mutar', () => {
    const original = edificioCompleto()
    const mutados = [
      conModelo(original, MODELO_EDIFICIO.SIMPLIFICADO).edificio,
      conRefcat(original, 'X').edificio,
      conParteRenombrada(original, 0, 'v').edificio,
      conAtributos(original, { numeroViviendas: 1 }).edificio,
    ]
    for (const e of mutados) {
      expect(e.construccionOficial).toEqual(original.construccionOficial)
      expect(e.construccionOficial).not.toBe(original.construccionOficial)
      expect(Object.isFrozen(e.construccionOficial)).toBe(true)
      expect(() => {
        e.construccionOficial[0].nombre = 'mutado'
      }).toThrow(TypeError)
      // Y sigue clonable, que es lo que el historial necesita.
      expect(structuredClone(e.construccionOficial)).toEqual(original.construccionOficial)
    }
  })

  it('encadenar las cuatro no pierde nada por el camino', () => {
    const a = conRefcat(edificioCompleto(), '1234567AB1234C').edificio
    const b = conParteRenombrada(a, 2, 'garaje').edificio
    const c = conAtributos(b, { numeroInmuebles: 7 }).edificio
    const d = conModelo(c, MODELO_EDIFICIO.SIMPLIFICADO).edificio

    expect(d.refcat).toBe('1234567AB1234C')
    expect(d.partes.map((p) => p.nombre)).toEqual(['Parte 1', 'Parte 2', 'garaje'])
    expect(d.partes[2].recinto).toBeNull() // la parte sin geometría sigue sin ella
    expect(d.parcelaContexto).toHaveLength(1)
    expect(d.construccionOficial).toHaveLength(1)
    expect('numeroInmuebles' in d).toBe(false) // se perdió al simplificar, avisado
    expect(c.numeroInmuebles).toBe(7) // y el paso anterior lo conserva
  })
})

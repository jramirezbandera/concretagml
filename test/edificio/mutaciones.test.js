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
  conIdLocal,
  conModelo,
  conParteAnadida,
  conParteEliminada,
  conParteRedibujada,
  conParteRenombrada,
  conPlantas,
  conRefcat,
  conTipoParte,
} from '../../edificio/mutaciones.js'
import { SEVERIDAD, TIPO_EDIFICIO, nombreParteGenerico } from '../../edificio/_comun.js'
import {
  ATRIBUTOS_COMPLETO,
  ESTADO_CONSERVACION,
  MODELO_EDIFICIO,
  ORIGEN_PARTE,
  TIPO_PARTE,
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
    // ⭐ F21 · `precisionMetros` SOBREVIVE al paso a SIMPLIFICADO, y ésa es la
    // diferencia que la separa de los siete: no es un atributo semántico del
    // edificio, así que cambiar de modelo no puede borrarla.
    expect(Object.keys(edificio).sort()).toEqual(
      [
        'construccionOficial',
        'idLocal',
        'modelo',
        'parcelaContexto',
        'partes',
        'precisionMetros',
        'refcat',
      ].sort(),
    )
  })

  it('⛔ F21 · la precisión declarada SOBREVIVE a toda mutación, incluida la de modelo', () => {
    // Sin `precisionMetros` en `reconstruir`, `crearEdificio` le pone su `null` por
    // defecto y CUALQUIER mutación —renombrar una parte, teclear la RC, cambiar de
    // modelo— borra en silencio un dato que el técnico va a firmar. Es el mismo
    // agujero que F12 tapó con `idLocal`, y aquí se comprueba sobre las tres
    // mutaciones que tocan cosas distintas del objeto.
    const original = crearEdificio({
      ...edificioCompleto(),
      precisionMetros: 0.01,
    })
    expect(original.precisionMetros).toBe(0.01)

    expect(conModelo(original, MODELO_EDIFICIO.SIMPLIFICADO).edificio.precisionMetros).toBe(0.01)
    expect(conRefcat(original, '9398516VK3799G').edificio.precisionMetros).toBe(0.01)
    expect(conParteRenombrada(original, 0, 'Cuerpo').edificio.precisionMetros).toBe(0.01)

    // MITAD ANTI-VACUIDAD: `0.01` no es el valor por defecto, así que un `null`
    // que se colara aquí no podría confundirse con «es que siempre valió eso».
    expect(crearEdificio({}).precisionMetros).toBeNull()
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

// ── conIdLocal (F12 · T4.3) ───────────────────────────────────────────────────
//
// Sin identidad no hay autoguardado: `app/cableado-expediente.js` distingue «otro
// documento» de «una edición» comparando `idLocal`, y con `null` a los dos lados esa
// comparación dice «es el mismo» siempre.

describe('conIdLocal', () => {
  it('pone la identidad y no toca nada más', () => {
    const original = edificioCompleto()
    const { edificio, detecciones } = sinMutar(original, (e) => conIdLocal(e, 'UTM.dxf'))
    expect(edificio.idLocal).toBe('UTM.dxf')
    expect(detecciones).toEqual([])
    expect(edificio.refcat).toBe(original.refcat)
    expect(edificio.partes).toEqual(original.partes)
    for (const clave of ATRIBUTOS_COMPLETO) {
      expect(edificio[clave]).toEqual(original[clave])
    }
  })

  it('acepta null («todavía sin identidad») y no normaliza lo que le den', () => {
    expect(conIdLocal(edificioCompleto(), null).edificio.idLocal).toBeNull()
    // Un nombre de fichero con espacios alrededor se guarda LITERAL: es lo que consta,
    // y corregirlo por su cuenta es lo mismo que `conRefcat` se prohíbe.
    expect(conIdLocal(edificioCompleto(), ' plano final.dxf ').edificio.idLocal).toBe(
      ' plano final.dxf ',
    )
  })

  it('LANZA con undefined: si no, borraría la identidad en silencio', () => {
    expect(() => conIdLocal(edificioCompleto(), undefined)).toThrow(TypeError)
    expect(() => conIdLocal(edificioCompleto(), 42)).toThrow(TypeError)
  })

  it('⛔ LANZA con un texto en blanco: una identidad falsa es peor que ninguna', () => {
    // El día que se archivara, un `''` pisaría a otro registro sin decir nada. Lo
    // impide `crearEdificio` y esta prueba comprueba que la mutación no lo esquiva.
    expect(() => conIdLocal(edificioCompleto(), '')).toThrow(TypeError)
    expect(() => conIdLocal(edificioCompleto(), '   ')).toThrow(TypeError)
  })

  it('la identidad SOBREVIVE a las otras mutaciones: `reconstruir` la arrastra', () => {
    // Sin esto, renombrar una parte borraría la identidad del documento y el
    // autoguardado tomaría la edición siguiente por la llegada de otro edificio.
    const conNombre = conIdLocal(edificioCompleto(), 'UTM.dxf').edificio
    expect(conParteRenombrada(conNombre, 0, 'nave').edificio.idLocal).toBe('UTM.dxf')
    expect(conRefcat(conNombre, '1234567AB1234C').edificio.idLocal).toBe('UTM.dxf')
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

/* ══════════════════════════════════════════════════════════════════════════ *
 * F12 · T1.2 — LAS CINCO QUE HACEN QUE LA LISTA DE PARTES SEA UNA LISTA      *
 *                                                                            *
 * Además de lo de siempre (no mutan, misma forma, índice fuera de rango       *
 * LANZA y dato de usuario NO), aquí se defiende:                              *
 *   · que `idLocal` SOBREVIVE a las nueve — sin eso el autoguardado dejaría   *
 *     de reconocer el borrador que él mismo escribió;                         *
 *   · que en una piscina las plantas no son cero, es que NO APLICAN, por los  *
 *     dos caminos (asignarlas y cambiar el tipo);                             *
 *   · que redibujar NO cambia `origen`: eso dice de dónde ENTRÓ la geometría, *
 *     no quién la ha tocado después.                                          *
 * ══════════════════════════════════════════════════════════════════════════ */

describe('F12 · conParteAnadida', () => {
  it('añade al final, sin contorno, y lo DICE', () => {
    const r = sinMutar(edificioSimplificado(), (e) => conParteAnadida(e))
    expect(r.edificio.partes).toHaveLength(4)
    const nueva = r.edificio.partes[3]
    expect(nueva.recinto).toBeNull()
    expect(nueva.plantasSobreRasante).toBeNull()
    expect(nueva.plantasBajoRasante).toBeNull()
    expect(r.detecciones.map((d) => d.tipo)).toEqual([TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA])
    expect(r.detecciones[0].severidad).toBe(SEVERIDAD.INFO)
  })

  it('⭐ el nombre por defecto sale de `nombreParteGenerico`, como las tres vías de entrada', () => {
    // Si esto divergiera, la aplicación acabaría con dos convenciones de nombre
    // para el mismo objeto en la misma lista. Lo dice el barrel con esas palabras.
    const r = conParteAnadida(edificioSimplificado())
    expect(r.edificio.partes[3].nombre).toBe(nombreParteGenerico(3))
    expect(r.edificio.partes[3].nombre).toBe('Parte 4')
  })

  it('el nombre genérico describe la POSICIÓN, no la historia', () => {
    // Tras quitar una de tres, la siguiente vuelve a ser «Parte 3».
    const sinLaSegunda = conParteEliminada(edificioSimplificado(), 1).edificio
    expect(conParteAnadida(sinLaSegunda).edificio.partes[2].nombre).toBe('Parte 3')
  })

  it('el origen es siempre DIBUJADA, y no se puede elegir', () => {
    expect(conParteAnadida(edificioSimplificado()).edificio.partes[3].origen).toBe(
      ORIGEN_PARTE.DIBUJADA,
    )
  })

  it('un nombre en blanco NO es un aviso aquí: nadie ha borrado nada', () => {
    // Al contrario que en `conParteRenombrada`, donde vaciar el campo SÍ avisa.
    const r = conParteAnadida(edificioSimplificado(), { nombre: '   ' })
    expect(r.edificio.partes[3].nombre).toBe('Parte 4')
    expect(r.detecciones.map((d) => d.tipo)).toEqual([TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA])
  })

  it('acepta el tipo, y una piscina nace sin plantas', () => {
    const r = conParteAnadida(edificioSimplificado(), { nombre: 'piscina', tipo: TIPO_PARTE.OTRA })
    expect(r.edificio.partes[3].tipo).toBe(TIPO_PARTE.OTRA)
    expect(r.edificio.partes[3].plantasSobreRasante).toBeNull()
  })

  it('un tipo con typo LANZA: no puede degradar en silencio a PRINCIPAL', () => {
    expect(() => conParteAnadida(edificioSimplificado(), { tipo: 'PISCINA' })).toThrow(RangeError)
  })
})

describe('F12 · conParteEliminada', () => {
  it('quita la parte y dice LO QUE SE LLEVA, con sus vértices', () => {
    const r = sinMutar(edificioSimplificado(), (e) => conParteEliminada(e, 0))
    expect(r.edificio.partes.map((p) => p.nombre)).toEqual(['Parte 2', 'Parte 3'])
    const d = r.detecciones[0]
    expect(d.tipo).toBe(TIPO_EDIFICIO.PARTE_ELIMINADA)
    expect(d.severidad).toBe(SEVERIDAD.AVISO)
    expect(d.datos.nVertices).toBe(4)
    expect(d.mensaje).toContain('Parte 1')
    expect(d.mensaje).toContain('4 vértices')
  })

  it('distingue quitar una fila vacía de quitar un contorno dibujado', () => {
    // La tercera parte del andamiaje no tiene recinto.
    const d = conParteEliminada(edificioSimplificado(), 2).detecciones[0]
    expect(d.datos.nVertices).toBeNull()
    expect(d.mensaje).toContain('no tenía contorno')
  })

  it('índice fuera de rango LANZA (contrato del programador)', () => {
    expect(() => conParteEliminada(edificioSimplificado(), 3)).toThrow(RangeError)
    expect(() => conParteEliminada(edificioSimplificado(), -1)).toThrow(RangeError)
    expect(() => conParteEliminada(edificioSimplificado(), 1.5)).toThrow(TypeError)
  })
})

describe('F12 · conPlantas', () => {
  it('aplica lo que es un número de plantas, sin decir nada', () => {
    const r = sinMutar(edificioSimplificado(), (e) => conPlantas(e, 0, { sobre: 3, bajo: 1 }))
    expect(r.edificio.partes[0].plantasSobreRasante).toBe(3)
    expect(r.edificio.partes[0].plantasBajoRasante).toBe(1)
    expect(r.detecciones).toEqual([])
    expect(r.edificio.partes[1].plantasSobreRasante).toBeNull()
  })

  it('`undefined` es NO TOCAR y `null` es VACIAR — como en conAtributos', () => {
    const conAmbas = conPlantas(edificioSimplificado(), 0, { sobre: 3, bajo: 2 }).edificio
    const soloSobre = conPlantas(conAmbas, 0, { sobre: 5 }).edificio
    expect(soloSobre.partes[0].plantasSobreRasante).toBe(5)
    expect(soloSobre.partes[0].plantasBajoRasante).toBe(2) // intacta: no se mencionó
    const vaciada = conPlantas(soloSobre, 0, { bajo: null }).edificio
    expect(vaciada.partes[0].plantasBajoRasante).toBeNull()
    expect(vaciada.partes[0].plantasSobreRasante).toBe(5)
  })

  it('cero es un número de plantas legítimo: es la parte solo bajo rasante', () => {
    // `part10` del fixture real trae exactamente esto, y no es un error.
    const r = conPlantas(edificioSimplificado(), 0, { sobre: 0, bajo: 1 })
    expect(r.edificio.partes[0].plantasSobreRasante).toBe(0)
    expect(r.detecciones).toEqual([])
  })

  it('⛔ un decimal o un negativo NO se guardan, y NO lanzan: vienen de un teclado', () => {
    const r = conPlantas(edificioSimplificado(), 0, { sobre: 2.5, bajo: -1 })
    expect(r.edificio.partes[0].plantasSobreRasante).toBeNull()
    expect(r.edificio.partes[0].plantasBajoRasante).toBeNull()
    expect(r.detecciones.map((d) => d.tipo)).toEqual([TIPO_EDIFICIO.PLANTAS_NO_VALIDAS])
    expect(r.detecciones[0].datos.ignorados).toHaveLength(2)
  })

  it('lo válido entra aunque lo otro no: no es todo o nada', () => {
    const r = conPlantas(edificioSimplificado(), 0, { sobre: 4, bajo: 'dos' })
    expect(r.edificio.partes[0].plantasSobreRasante).toBe(4)
    expect(r.edificio.partes[0].plantasBajoRasante).toBeNull()
    expect(r.detecciones[0].datos.ignorados).toEqual([{ clave: 'bajo', valor: 'dos' }])
  })

  it('⛔ en una parte OTRA las plantas NO APLICAN, y se contesta a ESA pregunta', () => {
    const conPiscina = conParteAnadida(edificioSimplificado(), {
      nombre: 'piscina',
      tipo: TIPO_PARTE.OTRA,
    }).edificio
    const r = conPlantas(conPiscina, 3, { sobre: 2.5 })
    // Ni siquiera se queja del 2,5: sería contestar a la pregunta equivocada.
    expect(r.detecciones.map((d) => d.tipo)).toEqual([TIPO_EDIFICIO.PLANTAS_NO_APLICAN])
    expect(r.detecciones[0].datos.motivo).toBe('ASIGNACION')
    expect(r.detecciones[0].mensaje).toContain('no son cero')
    expect(r.edificio.partes[3].plantasSobreRasante).toBeNull()
  })

  it('a una OTRA sin pedirle nada no se le avisa de nada', () => {
    const conPiscina = conParteAnadida(edificioSimplificado(), { tipo: TIPO_PARTE.OTRA }).edificio
    expect(conPlantas(conPiscina, 3, {}).detecciones).toEqual([])
  })

  it('`plantas` que no es objeto plano LANZA (contrato del programador)', () => {
    expect(() => conPlantas(edificioSimplificado(), 0, null)).toThrow(TypeError)
    expect(() => conPlantas(edificioSimplificado(), 0, [2, 1])).toThrow(TypeError)
  })
})

describe('F12 · conTipoParte', () => {
  it('cambia el tipo y no toca nada más', () => {
    const r = sinMutar(edificioSimplificado(), (e) => conTipoParte(e, 0, TIPO_PARTE.OTRA))
    expect(r.edificio.partes[0].tipo).toBe(TIPO_PARTE.OTRA)
    expect(r.edificio.partes[0].recinto).toEqual(edificioSimplificado().partes[0].recinto)
    expect(r.edificio.partes[1].tipo).toBe(TIPO_PARTE.PRINCIPAL)
  })

  it('⛔ pasar a OTRA con plantas puestas las BORRA, y lo anuncia con lo que valían', () => {
    const conPlantasPuestas = conPlantas(edificioSimplificado(), 0, { sobre: 3, bajo: 1 }).edificio
    const r = conTipoParte(conPlantasPuestas, 0, TIPO_PARTE.OTRA)
    expect(r.edificio.partes[0].plantasSobreRasante).toBeNull()
    expect(r.edificio.partes[0].plantasBajoRasante).toBeNull()
    const d = r.detecciones[0]
    expect(d.tipo).toBe(TIPO_EDIFICIO.PLANTAS_NO_APLICAN)
    expect(d.datos.motivo).toBe('CAMBIO_DE_TIPO')
    expect(d.datos.sobreRasante).toBe(3)
    expect(d.datos.bajoRasante).toBe(1)
  })

  it('sin plantas que perder NO avisa: dos `null` que se van no son noticia', () => {
    expect(conTipoParte(edificioSimplificado(), 0, TIPO_PARTE.OTRA).detecciones).toEqual([])
  })

  it('volver a PRINCIPAL deja las plantas vacías: no se inventa ninguna', () => {
    const conPlantasPuestas = conPlantas(edificioSimplificado(), 0, { sobre: 3 }).edificio
    const aOtra = conTipoParte(conPlantasPuestas, 0, TIPO_PARTE.OTRA).edificio
    const vuelta = conTipoParte(aOtra, 0, TIPO_PARTE.PRINCIPAL).edificio
    expect(vuelta.partes[0].plantasSobreRasante).toBeNull()
  })

  it('un tipo con typo LANZA', () => {
    expect(() => conTipoParte(edificioSimplificado(), 0, 'OTRO')).toThrow(RangeError)
  })
})

describe('F12 · conParteRedibujada', () => {
  const nuevoRecinto = () => ({
    tipo: 'EXTERIOR',
    vertices: [
      [1, 1],
      [5, 1],
      [5, 5],
    ],
  })

  it('reemplaza el contorno y no toca el resto de la parte', () => {
    const r = sinMutar(edificioSimplificado(), (e) => conParteRedibujada(e, 0, nuevoRecinto()))
    expect(r.edificio.partes[0].recinto.vertices).toHaveLength(3)
    expect(r.edificio.partes[0].nombre).toBe('Parte 1')
    expect(r.detecciones).toEqual([])
  })

  it('⛔ NO cambia `origen`: eso dice de dónde ENTRÓ, no quién la ha tocado', () => {
    // Si cambiara aquí, la primera vez que alguien moviera un vértice el edificio
    // dejaría de saber de qué fichero salió, y lo haría en silencio.
    const r = conParteRedibujada(edificioSimplificado(), 0, nuevoRecinto())
    expect(r.edificio.partes[0].origen).toBe(ORIGEN_PARTE.DXF)
  })

  it('da geometría a la parte que no la tenía, sin decir nada', () => {
    const r = conParteRedibujada(edificioSimplificado(), 2, nuevoRecinto())
    expect(r.edificio.partes[2].recinto.vertices).toHaveLength(3)
    expect(r.detecciones).toEqual([])
  })

  it('QUITAR el contorno sí avisa: la parte deja de verse en el mapa', () => {
    const r = conParteRedibujada(edificioSimplificado(), 0, null)
    expect(r.edificio.partes[0].recinto).toBeNull()
    expect(r.detecciones.map((d) => d.tipo)).toEqual([TIPO_EDIFICIO.PARTE_SIN_GEOMETRIA])
    expect(r.detecciones[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(r.detecciones[0].datos.nVerticesAnteriores).toBe(4)
  })

  it('quitar lo que ya no estaba no avisa de nada', () => {
    expect(conParteRedibujada(edificioSimplificado(), 2, null).detecciones).toEqual([])
  })

  it('copia el recinto: el modelo no comparte referencia con quien lo dibujó', () => {
    const vivo = nuevoRecinto()
    const r = conParteRedibujada(edificioSimplificado(), 0, vivo)
    vivo.vertices[0][0] = 999
    expect(r.edificio.partes[0].recinto.vertices[0][0]).toBe(1)
  })
})

describe('F12 · lo que las NUEVE tienen que respetar', () => {
  it('⭐ `idLocal` sobrevive a las nueve: sin él el autoguardado pierde el borrador', () => {
    const base = crearEdificio({
      idLocal: 'EXP-edificio-1',
      modelo: MODELO_EDIFICIO.COMPLETO,
      partes: partesDeEjemplo(),
    })
    const cadena = [
      (e) => conRefcat(e, '9398516VK3799G'),
      (e) => conParteRenombrada(e, 0, 'vivienda'),
      (e) => conAtributos(e, { numeroViviendas: 2 }),
      (e) => conParteAnadida(e, { nombre: 'porche' }),
      (e) => conPlantas(e, 0, { sobre: 2 }),
      (e) => conTipoParte(e, 3, TIPO_PARTE.OTRA),
      (e) =>
        conParteRedibujada(e, 1, {
          tipo: 'EXTERIOR',
          vertices: [
            [0, 0],
            [3, 0],
            [3, 3],
          ],
        }),
      (e) => conParteEliminada(e, 2),
      (e) => conModelo(e, MODELO_EDIFICIO.SIMPLIFICADO),
    ]
    let e = base
    for (const paso of cadena) {
      e = paso(e).edificio
      expect(e.idLocal, 'una mutación ha perdido la identidad').toBe('EXP-edificio-1')
    }
    expect(e.partes.map((p) => p.nombre)).toEqual(['vivienda', 'Parte 2', 'porche'])
  })

  it('las CINCO nuevas devuelven {edificio, detecciones}, como las cuatro de F11', () => {
    const e = edificioSimplificado()
    for (const r of [
      conParteAnadida(e),
      conParteEliminada(e, 0),
      conPlantas(e, 0, { sobre: 1 }),
      conTipoParte(e, 0, TIPO_PARTE.OTRA),
      conParteRedibujada(e, 0, null),
    ]) {
      expect(Object.keys(r).sort()).toEqual(['detecciones', 'edificio'])
      expect(Array.isArray(r.detecciones)).toBe(true)
    }
  })

  it('ninguna acepta algo que no sea un Edificio', () => {
    for (const fn of [
      () => conParteAnadida(null),
      () => conParteEliminada({ partes: 'no' }, 0),
      () => conPlantas(undefined, 0, {}),
      () => conTipoParte([], 0, TIPO_PARTE.OTRA),
      () => conParteRedibujada({}, 0, null),
    ]) {
      expect(fn).toThrow(TypeError)
    }
  })
})

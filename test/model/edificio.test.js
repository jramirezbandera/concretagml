import { describe, it, expect } from 'vitest'
import {
  crearEdificio,
  crearParteConstruccion,
  MODELO_EDIFICIO,
  TIPO_PARTE,
  ESTADO_CONSERVACION,
  ORIGEN_PARTE,
  ATRIBUTOS_COMPLETO,
} from '../../model/edificio.js'

// Recinto plano de ejemplo (UTM, [x,y], anillo SIN cerrar). No se importa
// model/parcela.js: aquí el recinto es un objeto plano recibido.
const recintoEjemplo = () => ({
  tipo: 'EXTERIOR',
  vertices: [
    [440123.45, 4100200.1],
    [440150.0, 4100200.1],
    [440150.0, 4100230.5],
    [440123.45, 4100230.5],
  ],
})

describe('constantes exportadas', () => {
  it('MODELO_EDIFICIO, TIPO_PARTE, ESTADO_CONSERVACION, ORIGEN_PARTE tienen los valores del shape', () => {
    expect(MODELO_EDIFICIO).toEqual({ SIMPLIFICADO: 'SIMPLIFICADO', COMPLETO: 'COMPLETO' })
    expect(TIPO_PARTE).toEqual({ PRINCIPAL: 'PRINCIPAL', OTRA: 'OTRA' })
    expect(ESTADO_CONSERVACION).toEqual({
      FUNCIONAL: 'FUNCIONAL',
      EN_CONSTRUCCION: 'EN_CONSTRUCCION',
      RUINOSO: 'RUINOSO',
      DERRUIDO: 'DERRUIDO',
    })
    expect(ORIGEN_PARTE).toEqual({
      DXF: 'DXF',
      LIST: 'LIST',
      TXT: 'TXT',
      GML_EXISTENTE: 'GML_EXISTENTE',
      WFS: 'WFS',
      DIBUJADA: 'DIBUJADA',
    })
  })
})

describe('crearParteConstruccion', () => {
  it('aplica los defaults correctos', () => {
    const parte = crearParteConstruccion({ nombre: 'cuerpo principal', origen: ORIGEN_PARTE.DIBUJADA })
    expect(parte).toEqual({
      nombre: 'cuerpo principal',
      tipo: 'PRINCIPAL', // default
      recinto: null, // default: pendiente de dibujar
      plantasSobreRasante: null,
      plantasBajoRasante: null,
      origen: 'DIBUJADA',
    })
  })

  it('parte PRINCIPAL conserva las plantas indicadas', () => {
    const parte = crearParteConstruccion({
      nombre: 'vivienda',
      tipo: TIPO_PARTE.PRINCIPAL,
      recinto: recintoEjemplo(),
      plantasSobreRasante: 2,
      plantasBajoRasante: 1,
      origen: ORIGEN_PARTE.DXF,
    })
    expect(parte.plantasSobreRasante).toBe(2)
    expect(parte.plantasBajoRasante).toBe(1)
    expect(parte.recinto.vertices).toHaveLength(4)
  })

  it('parte OTRA (piscina) fuerza plantas a null, nunca 0 (invariante O11)', () => {
    const parte = crearParteConstruccion({
      nombre: 'piscina',
      tipo: TIPO_PARTE.OTRA,
      recinto: recintoEjemplo(),
      // Aunque se pasen plantas, deben anularse por ser tipo OTRA:
      plantasSobreRasante: 2,
      plantasBajoRasante: 0,
      origen: ORIGEN_PARTE.DIBUJADA,
    })
    expect(parte.tipo).toBe('OTRA')
    expect(parte.plantasSobreRasante).toBeNull()
    expect(parte.plantasBajoRasante).toBeNull()
    // Explícito: no es 0.
    expect(parte.plantasSobreRasante).not.toBe(0)
    expect(parte.plantasBajoRasante).not.toBe(0)
  })

  it('recinto null es válido (parte pendiente de dibujar)', () => {
    const parte = crearParteConstruccion({ nombre: 'garaje', origen: ORIGEN_PARTE.LIST })
    expect(parte.recinto).toBeNull()
  })

  it('es un POJO plano sin métodos ni prototipo de clase', () => {
    const parte = crearParteConstruccion({ nombre: 'x', origen: ORIGEN_PARTE.TXT })
    expect(Object.getPrototypeOf(parte)).toBe(Object.prototype)
    expect(Object.values(parte).some((v) => typeof v === 'function')).toBe(false)
  })
})

describe('crearEdificio · defaults y modelo SIMPLIFICADO', () => {
  it('aplica los defaults correctos y por defecto es SIMPLIFICADO', () => {
    const edificio = crearEdificio()
    expect(edificio.refcat).toBeNull()
    expect(edificio.modelo).toBe('SIMPLIFICADO')
    expect(edificio.partes).toEqual([])
    expect(edificio.parcelaContexto).toBeNull()
    expect(edificio.construccionOficial).toBeNull()
  })

  // ── F12 · T1.1 · la identidad ──────────────────────────────────────────────
  // Sin `idLocal` un Edificio no se puede archivar ni autoguardar. Es
  // ASIMÉTRICO con `crearParcela`, que lo exige, y la asimetría está razonada en
  // la cabecera de la fábrica: un edificio puede empezar vacío, y exigirlo
  // obligaría a inventarlo.

  it('nace SIN identidad, y `null` es un estado legítimo («aún no se archiva»)', () => {
    expect(crearEdificio().idLocal).toBeNull()
    expect('idLocal' in crearEdificio()).toBe(true)
  })

  it('conserva el `idLocal` que se le da, literal', () => {
    expect(crearEdificio({ idLocal: 'ES.SDGC.BU.9398516VK3799G' }).idLocal).toBe(
      'ES.SDGC.BU.9398516VK3799G',
    )
    // No se recorta ni se normaliza: el identificador es del documento que lo trae.
    expect(crearEdificio({ idLocal: ' con espacios ' }).idLocal).toBe(' con espacios ')
  })

  it('⛔ LANZA con una identidad FALSA: vacía o solo espacios', () => {
    // Éste es el caso que justifica la validación. Un `''` pasaría por
    // identidad, y el día que se archivara pisaría a otro registro en silencio.
    expect(() => crearEdificio({ idLocal: '' })).toThrow(TypeError)
    expect(() => crearEdificio({ idLocal: '   ' })).toThrow(TypeError)
    expect(() => crearEdificio({ idLocal: 7 })).toThrow(TypeError)
    expect(() => crearEdificio({ idLocal: {} })).toThrow(TypeError)
    // …y `undefined` NO lanza: es «no me lo has dicho», que es el defecto.
    expect(() => crearEdificio({ idLocal: undefined })).not.toThrow()
  })

  it('el mensaje dice las DOS salidas: texto no vacío o null', () => {
    expect(() => crearEdificio({ idLocal: '' })).toThrow(/no vac[íi]o o null/i)
  })

  it('SIMPLIFICADO OMITE los atributos semánticos (undefined, sin clave)', () => {
    const edificio = crearEdificio({ modelo: MODELO_EDIFICIO.SIMPLIFICADO })
    for (const clave of ATRIBUTOS_COMPLETO) {
      expect(clave in edificio).toBe(false)
      expect(edificio[clave]).toBeUndefined()
    }
    // El shape SIMPLIFICADO tiene exactamente estas claves.
    // `idLocal` entra en F12 · T1.1 (la identidad, sin la cual no se archiva) y
    // `precisionMetros` en F21: ⭐ está AQUÍ y no entre los siete de arriba a
    // propósito —la precisión del levantamiento no es un atributo del edificio,
    // sino del trabajo, y el ICUC la exige también en el recorrido corto—.
    expect(Object.keys(edificio).sort()).toEqual(
      [
        'idLocal',
        'refcat',
        'modelo',
        'partes',
        'parcelaContexto',
        'construccionOficial',
        'precisionMetros',
      ].sort(),
    )
    // Y sin declararla vale `null`, que es «no consta» y sale `xsi:nil`.
    expect(edificio.precisionMetros).toBeNull()
  })

  it('ignora atributos semánticos aunque se pasen si el modelo es SIMPLIFICADO', () => {
    const edificio = crearEdificio({
      modelo: MODELO_EDIFICIO.SIMPLIFICADO,
      usoDominante: 'residencial',
      numeroViviendas: 3,
    })
    expect('usoDominante' in edificio).toBe(false)
    expect('numeroViviendas' in edificio).toBe(false)
  })
})

describe('crearEdificio · modelo COMPLETO', () => {
  it('INCLUYE los atributos semánticos aportados', () => {
    const edificio = crearEdificio({
      modelo: MODELO_EDIFICIO.COMPLETO,
      usoDominante: 'residencial',
      estadoConservacion: ESTADO_CONSERVACION.FUNCIONAL,
      anioConstruccion: 1998,
      anioReforma: 2015,
      numeroInmuebles: 4,
      numeroViviendas: 3,
      superficieConstruida: 312.5,
    })
    expect(edificio.modelo).toBe('COMPLETO')
    expect(edificio.usoDominante).toBe('residencial')
    expect(edificio.estadoConservacion).toBe('FUNCIONAL')
    expect(edificio.anioConstruccion).toBe(1998)
    expect(edificio.anioReforma).toBe(2015)
    expect(edificio.numeroInmuebles).toBe(4)
    expect(edificio.numeroViviendas).toBe(3)
    expect(edificio.superficieConstruida).toBe(312.5)
  })

  it('COMPLETO expone todas las claves semánticas (null cuando no se aportan)', () => {
    const edificio = crearEdificio({ modelo: MODELO_EDIFICIO.COMPLETO })
    for (const clave of ATRIBUTOS_COMPLETO) {
      expect(clave in edificio).toBe(true)
      expect(edificio[clave]).toBeNull()
    }
  })
})

describe('invariantes del modelo de edificio', () => {
  it('las plantas van por parte, nunca por el edificio', () => {
    const edificio = crearEdificio({
      modelo: MODELO_EDIFICIO.COMPLETO,
      partes: [crearParteConstruccion({ nombre: 'v', plantasSobreRasante: 2, origen: ORIGEN_PARTE.DXF })],
    })
    expect('plantasSobreRasante' in edificio).toBe(false)
    expect('plantasBajoRasante' in edificio).toBe(false)
    expect(edificio.partes[0].plantasSobreRasante).toBe(2)
  })

  it('NO existe campo de envolvente derivada (es F12, no se almacena)', () => {
    const edificio = crearEdificio({ modelo: MODELO_EDIFICIO.COMPLETO })
    for (const prohibida of ['envolvente', 'envelope', 'geometria', 'geometry', 'contorno', 'huella']) {
      expect(prohibida in edificio).toBe(false)
    }
  })

  it('construccionOficial se guarda como copia INDEPENDIENTE, intacta y CONGELADA (regla 2)', () => {
    const oficial = [
      crearParteConstruccion({
        nombre: 'registrado',
        recinto: recintoEjemplo(),
        plantasSobreRasante: 1,
        origen: ORIGEN_PARTE.WFS,
      }),
    ]
    const snapshot = structuredClone(oficial)
    const edificio = crearEdificio({ construccionOficial: oficial })
    // Copia independiente (no comparte referencia con la entrada)...
    expect(edificio.construccionOficial).not.toBe(oficial)
    // ...intacta LITERAL (mismo valor, sin renormalizar)...
    expect(edificio.construccionOficial).toEqual(snapshot)
    // ...y congelada en profundidad: mutarla LANZA (barrera, no promesa).
    expect(() => {
      edificio.construccionOficial[0].plantasSobreRasante = 99
    }).toThrow(TypeError)
    expect(() => {
      edificio.construccionOficial[0].recinto.vertices[0][0] = 0
    }).toThrow(TypeError)
    // Mutar la ENTRADA tras crear tampoco afecta a lo guardado.
    oficial[0].nombre = 'mutado'
    expect(edificio.construccionOficial[0].nombre).toBe('registrado')
    // structuredClone de lo congelado devuelve copia mutable (undo/redo OK).
    const clon = structuredClone(edificio.construccionOficial)
    clon[0].plantasSobreRasante = 3
    expect(clon[0].plantasSobreRasante).toBe(3)
  })

  it('partes y parcelaContexto se copian defensivamente (mutar la entrada no afecta)', () => {
    const parte = crearParteConstruccion({
      nombre: 'cuerpo',
      recinto: recintoEjemplo(),
      plantasSobreRasante: 2,
      origen: ORIGEN_PARTE.DXF,
    })
    const contexto = [recintoEjemplo()]
    const partes = [parte]
    const edificio = crearEdificio({ partes, parcelaContexto: contexto })

    expect(edificio.partes).not.toBe(partes)
    expect(edificio.partes[0]).not.toBe(parte)
    expect(edificio.parcelaContexto).not.toBe(contexto)

    parte.plantasSobreRasante = 99
    contexto[0].vertices[0][0] = 0
    expect(edificio.partes[0].plantasSobreRasante).toBe(2)
    expect(edificio.parcelaContexto[0].vertices[0][0]).toBe(440123.45)
  })

  it('las coordenadas son UTM [x,y] (regla 3): valores metricos, no grados', () => {
    const parte = crearParteConstruccion({
      nombre: 'p',
      recinto: recintoEjemplo(),
      origen: ORIGEN_PARTE.DIBUJADA,
    })
    const [x, y] = parte.recinto.vertices[0]
    expect(x).toBeGreaterThan(1000) // easting UTM, no una longitud en grados
    expect(y).toBeGreaterThan(1_000_000) // northing UTM ~4·10⁶
  })
})

describe('validación de dominio (regla 1: ningún error silencioso — auditoría A4)', () => {
  it("'modelo' inválido LANZA: un typo no degrada en silencio a SIMPLIFICADO", () => {
    expect(() => crearEdificio({ modelo: 'Completo' })).toThrow(RangeError)
    expect(() => crearEdificio({ modelo: 'COMPLETO ' })).toThrow(RangeError)
    expect(() => crearEdificio({ modelo: 42 })).toThrow(RangeError)
  })

  it("'tipo' de parte inválido LANZA: no se trata en silencio como PRINCIPAL", () => {
    expect(() =>
      crearParteConstruccion({ nombre: 'x', tipo: 'PISCINA', origen: ORIGEN_PARTE.DIBUJADA }),
    ).toThrow(RangeError)
  })

  it("'origen' de parte inválido LANZA", () => {
    expect(() => crearParteConstruccion({ nombre: 'x', origen: 'INVENTADO' })).toThrow(RangeError)
    expect(() => crearParteConstruccion({ nombre: 'x' })).toThrow(RangeError) // ausente
  })

  it("'nombre' es obligatorio (string no vacío)", () => {
    expect(() => crearParteConstruccion({ origen: ORIGEN_PARTE.DIBUJADA })).toThrow(TypeError)
    expect(() => crearParteConstruccion({ nombre: '', origen: ORIGEN_PARTE.DIBUJADA })).toThrow(TypeError)
  })

  it("'estadoConservacion' inválido LANZA en modelo COMPLETO", () => {
    expect(() =>
      crearEdificio({ modelo: MODELO_EDIFICIO.COMPLETO, estadoConservacion: 'NUEVO' }),
    ).toThrow(RangeError)
  })

  it('plantas no numéricas LANZAN (número finito o null)', () => {
    expect(() =>
      crearParteConstruccion({ nombre: 'x', plantasSobreRasante: '2', origen: ORIGEN_PARTE.DXF }),
    ).toThrow(TypeError)
    expect(() =>
      crearParteConstruccion({ nombre: 'x', plantasBajoRasante: NaN, origen: ORIGEN_PARTE.DXF }),
    ).toThrow(TypeError)
  })
})

describe('el shape sobrevive a structuredClone (POJO plano, regla 4)', () => {
  it('copia profunda equivalente con referencias no compartidas', () => {
    const edificio = crearEdificio({
      refcat: '9398516VK3799G',
      modelo: MODELO_EDIFICIO.COMPLETO,
      partes: [
        crearParteConstruccion({
          nombre: 'cuerpo principal',
          recinto: recintoEjemplo(),
          plantasSobreRasante: 2,
          plantasBajoRasante: 1,
          origen: ORIGEN_PARTE.DXF,
        }),
        crearParteConstruccion({
          nombre: 'piscina',
          tipo: TIPO_PARTE.OTRA,
          recinto: recintoEjemplo(),
          origen: ORIGEN_PARTE.DIBUJADA,
        }),
      ],
      parcelaContexto: [recintoEjemplo()],
      construccionOficial: [
        crearParteConstruccion({ nombre: 'oficial', recinto: recintoEjemplo(), origen: ORIGEN_PARTE.WFS }),
      ],
      usoDominante: 'residencial',
      estadoConservacion: ESTADO_CONSERVACION.FUNCIONAL,
      anioConstruccion: 1998,
      superficieConstruida: 312.5,
    })

    const copia = structuredClone(edificio)

    // Equivalente en valor...
    expect(copia).toEqual(edificio)
    // ...pero sin referencias compartidas en ningún nivel.
    expect(copia).not.toBe(edificio)
    expect(copia.partes).not.toBe(edificio.partes)
    expect(copia.partes[0]).not.toBe(edificio.partes[0])
    expect(copia.partes[0].recinto).not.toBe(edificio.partes[0].recinto)
    expect(copia.partes[0].recinto.vertices).not.toBe(edificio.partes[0].recinto.vertices)
    expect(copia.parcelaContexto).not.toBe(edificio.parcelaContexto)
    expect(copia.construccionOficial).not.toBe(edificio.construccionOficial)

    // Mutar la copia no toca el original (base de undo/redo).
    copia.partes[0].plantasSobreRasante = 99
    expect(edificio.partes[0].plantasSobreRasante).toBe(2)
  })
})

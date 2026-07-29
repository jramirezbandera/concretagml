import { describe, expect, it } from 'vitest'
import {
  CLASE,
  ETIQUETA,
  MARGEN_PERIMETRO_M,
  MARGEN_SUPERFICIE_RELATIVO,
  claseDeducidaDe,
  margen,
} from '../../diagnostico/margen.js'
import { normalizarRefcat } from '../../services/catastro.js'

// F07 · diagnostico/margen.js — el margen oficial de identidad del Catastro.
//
// Este fichero prueba sobre todo LO QUE EL MÓDULO NO HACE, porque es ahí donde está
// el requisito. La spec admite el margen (±0,50 m urbana / ±2,00 m rústica, ≤5 % de
// superficie; BOE-A-2020-12111) como **capa informativa etiquetada**, y lo prohíbe
// como veredicto: existe un umbral oficial, pero es criterio de IDENTIDAD, no
// aprobado/suspenso. La razón de fondo está en la spec y conviene tenerla delante al
// leer estos tests: una discrepancia grande a menudo significa que la geometría
// CATASTRAL está mal, y ése es justo el motivo del expediente. Un umbral presupone
// que Catastro es la referencia buena, falso en los casos de uso.
//
// Las dos referencias con las que se comprueba la heurística son REALES y ya están
// en el repo: `9398516VK3799G` (urbana, la parcela de todos los fixtures) y
// `29041A00800099` (rústica, el `placeholder` del campo de `index.html`).

const URBANA_REAL = '9398516VK3799G'
const RUSTICA_REAL = '29041A00800099'

describe('diagnostico/margen.js · las cifras de la norma', () => {
  it('±0,50 m urbana y ±2,00 m rústica en perímetro (BOE-A-2020-12111)', () => {
    expect(MARGEN_PERIMETRO_M[CLASE.URBANA]).toBe(0.5)
    expect(MARGEN_PERIMETRO_M[CLASE.RUSTICA]).toBe(2)
  })

  it('≤5 % en superficie, como FRACCIÓN y no como porcentaje', () => {
    // 0,05 y no 5: la misma convención que `relativo` en `diagnostico/bandas.js` y
    // en `edit/metricas.js`, para que se puedan comparar sin convertir nada.
    expect(MARGEN_SUPERFICIE_RELATIVO).toBe(0.05)
    expect(MARGEN_SUPERFICIE_RELATIVO).not.toBe(5)
  })

  it('el margen de superficie NO depende de la clase: es un número, no un mapa', () => {
    // Darle forma de `{URBANA, RUSTICA}` con el mismo valor dos veces insinuaría que
    // puede divergir, y la norma no lo distingue.
    expect(typeof MARGEN_SUPERFICIE_RELATIVO).toBe('number')
  })

  it('las constantes están congeladas: la norma no se «ajusta» en caliente', () => {
    expect(Object.isFrozen(CLASE)).toBe(true)
    expect(Object.isFrozen(MARGEN_PERIMETRO_M)).toBe(true)
  })

  it('CLASE tiene exactamente dos clases y ninguna DESCONOCIDA', () => {
    // «No se sabe» no es una clase de suelo: es la ausencia de dato, y se
    // representa con el `null` de `claseDeducidaDe`. Un `CLASE.DESCONOCIDA`
    // terminaría teniendo un margen asignado «por si acaso», la peor respuesta
    // posible — sería inventarse la mitad de la norma.
    expect(CLASE).toEqual({ URBANA: 'URBANA', RUSTICA: 'RUSTICA' })
  })

  it('la etiqueta es EXACTAMENTE la de la spec', () => {
    // La etiqueta ES parte del requisito: es lo que impide que la cifra se lea como
    // un aprobado. «tolerancia», «límite» o «máximo admisible» cambiarían el
    // significado de lo que se muestra, así que la redacción no es libre.
    expect(ETIQUETA).toBe('margen de identidad del Catastro')
  })
})

describe('diagnostico/margen.js · margen() ENUNCIA y no compara', () => {
  it('devuelve el margen de urbana', () => {
    expect(margen(CLASE.URBANA)).toEqual({
      perimetroM: 0.5,
      superficieRelativo: 0.05,
      etiqueta: ETIQUETA,
    })
  })

  it('devuelve el margen de rústica', () => {
    expect(margen(CLASE.RUSTICA)).toEqual({
      perimetroM: 2,
      superficieRelativo: 0.05,
      etiqueta: ETIQUETA,
    })
  })

  it('la etiqueta viaja DENTRO del resultado', () => {
    // A propósito: quien recibe las cifras recibe en el mismo objeto el texto con
    // el que está obligado a presentarlas, así que no hay forma de pintar el número
    // sin tener la etiqueta a mano. Es la única defensa que un módulo puro puede
    // montar contra que su cifra acabe en pantalla como un aprobado.
    expect(margen(CLASE.URBANA).etiqueta).toBe(ETIQUETA)
    expect(margen(CLASE.RUSTICA).etiqueta).toBe(ETIQUETA)
  })

  it('NO recibe la parcela: no puede comparar porque no ve nada que comparar', () => {
    // `margen` tiene aridad 1 y ese argumento es la clase de suelo. No hay hueco en
    // la firma para una superficie, un perímetro ni una geometría, y eso es el
    // diseño: un módulo que no ve la parcela no puede dictaminar sobre ella.
    expect(margen).toHaveLength(1)
  })

  it('no hay ninguna clave de veredicto en el retorno (regla de oro 9)', () => {
    const PROHIBIDAS =
      /^(ok|valido|válido|apto|aprobado|dentro|cumple|supera|excede|semaforo|semáforo|nivel|color|estado|veredicto)/i

    for (const clase of Object.values(CLASE)) {
      const resultado = margen(clase)
      for (const clave of Object.keys(resultado)) {
        expect(clave).not.toMatch(PROHIBIDAS)
      }
      // Forma EXACTA, no «contiene»: así añadir un `{dentroDeMargen: true}` en el
      // futuro sale rojo aquí en vez de pasar desapercibido.
      expect(Object.keys(resultado).sort()).toEqual([
        'etiqueta',
        'perimetroM',
        'superficieRelativo',
      ])
    }
  })

  it('el módulo entero no exporta ninguna función de comparación', () => {
    // El guardián de arriba mira el retorno; éste mira la SUPERFICIE PÚBLICA. Si
    // alguien añade un `cumpleMargen(parcela, clase)`, este test cae.
    const PROHIBIDAS = /^(cumple|valida|comprueba|evalua|evalúa|juzga|califica|dentro)/i
    for (const nombre of Object.keys({
      CLASE,
      ETIQUETA,
      MARGEN_PERIMETRO_M,
      MARGEN_SUPERFICIE_RELATIVO,
      claseDeducidaDe,
      margen,
    })) {
      expect(nombre).not.toMatch(PROHIBIDAS)
    }
  })
})

describe('diagnostico/margen.js · margen() con clase que no lo es', () => {
  it('LANZA sin clase, y el mensaje dice que hay que preguntarla, no suponerla', () => {
    // No hay «margen por defecto»: elegir uno en silencio sería inventarse la mitad
    // de la norma. Cuando no se sabe la clase lo que corresponde es preguntar.
    expect(() => margen(null)).toThrow(TypeError)
    expect(() => margen(undefined)).toThrow(TypeError)
    expect(() => margen(null)).toThrow(/preguntarla, no suponerla/)
  })

  it('LANZA con una clase inventada, y el mensaje nombra las dos válidas', () => {
    expect(() => margen('MIXTA')).toThrow(TypeError)
    expect(() => margen('MIXTA')).toThrow(/URBANA/)
    expect(() => margen('MIXTA')).toThrow(/RUSTICA/)
  })

  it('LANZA con minúsculas: la clase es una constante, no un texto libre', () => {
    expect(() => margen('urbana')).toThrow(TypeError)
  })
})

describe('diagnostico/margen.js · claseDeducidaDe() es una HEURÍSTICA declarada', () => {
  it('deduce RÚSTICA de la referencia real del placeholder de index.html', () => {
    const deducida = claseDeducidaDe(RUSTICA_REAL)
    expect(deducida.clase).toBe(CLASE.RUSTICA)
    expect(deducida.deducida).toBe(true)
    expect(deducida.criterio).toContain(RUSTICA_REAL)
    expect(deducida.criterio).toMatch(/pol[íi]gono/i)
  })

  it('deduce URBANA de la referencia real de todos los fixtures del proyecto', () => {
    const deducida = claseDeducidaDe(URBANA_REAL)
    expect(deducida.clase).toBe(CLASE.URBANA)
    expect(deducida.deducida).toBe(true)
    expect(deducida.criterio).toContain(URBANA_REAL)
  })

  it('`deducida` es SIEMPRE true: esta función propone, nunca decide', () => {
    // El campo existe para que la fase 4 pueda guardar `{clase, deducida: false}`
    // cuando la elija una persona en el `<select>`, y para que la UI sepa que lo
    // que muestra es una propuesta y lo rotule como tal.
    expect(claseDeducidaDe(URBANA_REAL).deducida).toBe(true)
    expect(claseDeducidaDe(RUSTICA_REAL).deducida).toBe(true)
  })

  it('`criterio` es texto presentable tal cual, no un código', () => {
    // Es lo que se le enseña al usuario para que sepa de dónde sale la propuesta.
    // Un `criterio: 'RE_RUSTICA'` no le diría nada a nadie.
    const { criterio } = claseDeducidaDe(RUSTICA_REAL)
    expect(criterio.length).toBeGreaterThan(40)
    expect(criterio).toMatch(/^La referencia /)
    expect(criterio.trim()).toBe(criterio)
  })

  it('la letra de sector no tiene que ser una `A`', () => {
    // Anclar en la `A` habría dejado fuera casos legítimos sin ganar nada: lo que
    // discrimina es que haya una letra en la 6.ª posición seguida de ocho dígitos,
    // o sea que la referencia lleve código de polígono y parcela.
    expect(claseDeducidaDe('29041B00800099').clase).toBe(CLASE.RUSTICA)
    expect(claseDeducidaDe('29041Z00800099').clase).toBe(CLASE.RUSTICA)
  })

  it('devuelve null —y no una clase a medias— cuando no reconoce la forma', () => {
    for (const basura of ['', 'BUENOS DIAS', '123', 'AAAAAAAAAAAAAA', '29041A0080009']) {
      expect(claseDeducidaDe(basura)).toBeNull()
    }
  })

  it('no lanza nunca: su entrada es dato del usuario', () => {
    // Un `null` de un campo vacío no es un bug del programador, así que aquí no se
    // lanza (a diferencia de `margen`, cuya clase la resuelve la UI antes de llamar).
    for (const noEsString of [null, undefined, 1536, {}, [], NaN, () => {}]) {
      expect(() => claseDeducidaDe(noEsString)).not.toThrow()
      expect(claseDeducidaDe(noEsString)).toBeNull()
    }
  })

  it('espera la referencia YA NORMALIZADA: con espacios o minúsculas no deduce', () => {
    // No normaliza ella a propósito: importar `normalizarRefcat` arrastraría la capa
    // de red a un módulo puro, y reescribir la normalización aquí crearía una
    // SEGUNDA definición que puede divergir. El coste de no reconocer una
    // referencia es solo que la UI pregunte.
    expect(claseDeducidaDe('9398516 VK3799G')).toBeNull()
    expect(claseDeducidaDe('9398516vk3799g')).toBeNull()
  })

  it('…y encadenada con `normalizarRefcat` sí deduce, que es como la va a llamar la app', () => {
    // La frontera queda demostrada: la normalización es de `services/`, la
    // deducción de `diagnostico/`, y juntas cubren lo que el usuario teclea.
    expect(claseDeducidaDe(normalizarRefcat('9398516 VK3799G')).clase).toBe(CLASE.URBANA)
    expect(claseDeducidaDe(normalizarRefcat('  29041a00800099  ')).clase).toBe(CLASE.RUSTICA)
  })

  it('la referencia de INMUEBLE, recortada por `normalizarRefcat`, deduce igual', () => {
    // La de 20 caracteres es la de los recibos del IBI, la que la gente tiene a
    // mano. `normalizarRefcat` se queda con sus 14 primeros, que SON la parcela.
    expect(claseDeducidaDe(normalizarRefcat('9398516VK3799G0001XX')).clase).toBe(CLASE.URBANA)
  })

  it('deducir una forma NO es verificar una existencia', () => {
    // `0000000XX0000X` es la referencia inventada con la que F05 midió el
    // `NO_ENCONTRADO` del servicio: tiene forma urbana y se deduce urbana. El módulo
    // no tiene red y no puede saber si la parcela existe; tampoco lo pretende.
    expect(claseDeducidaDe('0000000XX0000X').clase).toBe(CLASE.URBANA)
  })

  it('no comprueba el dígito de control, igual que `normalizarRefcat`', () => {
    // Misma razón que está escrita en el JSDoc de `normalizarRefcat`: el algoritmo
    // de los dos caracteres de control no está verificado contra el servicio en este
    // proyecto, y un falso negativo bloquearía un caso legítimo. Esta referencia
    // tiene forma correcta y control arbitrario, y se deduce sin protestar.
    expect(claseDeducidaDe('1234567AB0001Z').clase).toBe(CLASE.URBANA)
  })
})

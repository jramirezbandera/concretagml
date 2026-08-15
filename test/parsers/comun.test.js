/* -------------------------------------------------------------------------- *
 * test/parsers/comun.test.js — Contrato y tokenizador compartido (F01, T1.1)  *
 *                                                                            *
 * Sin fixtures en disco: strings inline (list/txt no existen aún). Cubre:     *
 *   - autodetectarSeparadorDecimal: ',' vs '.' (incl. coma como delimitador). *
 *   - extraerPares: pares con cabeceras/etiquetas, descarte de Z, corte por   *
 *     `separador`, separador decimal declarado.                               *
 *   - crearDeteccion: LANZA ante tipo/severidad inválidos (regla de oro 1).   *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import {
  TIPO_DETECCION,
  SEVERIDAD,
  SUJETO,
  SUJETOS,
  SUJETO_CONSTRUCCION,
  SUJETO_POR_DEFECTO,
  crearDeteccion,
  autodetectarSeparadorDecimal,
  declinar,
  extraerPares,
} from '../../parsers/_comun.js'

// ── TIPO_DETECCION / SEVERIDAD ────────────────────────────────────────────────

describe('parsers/_comun — vocabulario común', () => {
  it('TIPO_DETECCION expone el léxico requerido y está congelado', () => {
    for (const k of [
      'SEPARADOR_DECIMAL',
      'Z_DESCARTADA',
      'SEPARADOR_POLIGONO',
      'ARCO_DISCRETIZADO',
      'ENTIDAD_NO_SOPORTADA',
      'SWAP_XY',
      'GRADOS',
      'CIERRE',
      'HUSO_AMBIGUO',
    ]) {
      expect(TIPO_DETECCION[k]).toBe(k)
    }
    expect(Object.isFrozen(TIPO_DETECCION)).toBe(true)
    expect(() => {
      TIPO_DETECCION.NUEVO = 'X'
    }).toThrow()
  })

  it('SEVERIDAD tiene INFO/AVISO/ERROR y está congelada', () => {
    expect(SEVERIDAD).toEqual({ INFO: 'INFO', AVISO: 'AVISO', ERROR: 'ERROR' })
    expect(Object.isFrozen(SEVERIDAD)).toBe(true)
  })
})

// ── crearDeteccion ────────────────────────────────────────────────────────────

describe('parsers/_comun — crearDeteccion', () => {
  it('devuelve un POJO plano con tipo/mensaje/severidad', () => {
    const d = crearDeteccion(TIPO_DETECCION.Z_DESCARTADA, 'Z fuera', SEVERIDAD.INFO)
    expect(d).toEqual({ tipo: 'Z_DESCARTADA', mensaje: 'Z fuera', severidad: 'INFO' })
    // POJO sin prototipo de clase ni métodos (regla de oro 4).
    expect(Object.getPrototypeOf(d)).toBe(Object.prototype)
  })

  it('incluye `datos` sólo cuando se aporta', () => {
    const sin = crearDeteccion(TIPO_DETECCION.CIERRE, 'no cierra', SEVERIDAD.AVISO)
    expect('datos' in sin).toBe(false)
    const con = crearDeteccion(TIPO_DETECCION.CIERRE, 'no cierra', SEVERIDAD.AVISO, { gap: 0.2 })
    expect(con.datos).toEqual({ gap: 0.2 })
  })

  it('LANZA (RangeError) ante tipo inválido — regla de oro 1', () => {
    expect(() => crearDeteccion('NO_EXISTE', 'x', SEVERIDAD.INFO)).toThrow(RangeError)
  })

  it('LANZA (RangeError) ante severidad inválida — regla de oro 1', () => {
    expect(() => crearDeteccion(TIPO_DETECCION.GRADOS, 'x', 'CRITICO')).toThrow(RangeError)
    expect(() => crearDeteccion(TIPO_DETECCION.GRADOS, 'x', 'info')).toThrow(RangeError) // case-sensitive
  })

  it('LANZA (TypeError) ante mensaje vacío o `datos` no-objeto', () => {
    expect(() => crearDeteccion(TIPO_DETECCION.GRADOS, '', SEVERIDAD.INFO)).toThrow(TypeError)
    expect(() => crearDeteccion(TIPO_DETECCION.GRADOS, 'ok', SEVERIDAD.INFO, [1, 2])).toThrow(TypeError)
    expect(() => crearDeteccion(TIPO_DETECCION.GRADOS, 'ok', SEVERIDAD.INFO, null)).toThrow(TypeError)
  })
})

// ── autodetectarSeparadorDecimal ──────────────────────────────────────────────

describe('parsers/_comun — autodetectarSeparadorDecimal', () => {
  it("punto decimal, columnas por espacio → '.'", () => {
    const txt = '439250.35 4479664.55\n439260.10 4479670.20'
    expect(autodetectarSeparadorDecimal(txt)).toBe('.')
  })

  it("coma decimal, columnas por punto y coma → ','", () => {
    const txt = '439250,35;4479664,55\n439260,10;4479670,20'
    expect(autodetectarSeparadorDecimal(txt)).toBe(',')
  })

  it("coma decimal, columnas por espacio → ','", () => {
    const txt = '439250,35 4479664,55\n439260,10 4479670,20'
    expect(autodetectarSeparadorDecimal(txt)).toBe(',')
  })

  it("caso peliagudo: punto decimal + coma como separador de columnas → '.'", () => {
    // La coma es delimitador, no decimal; el punto gana el recuento \d?\d.
    expect(autodetectarSeparadorDecimal('439250.35, 4479664.55')).toBe('.') // con espacio
    expect(autodetectarSeparadorDecimal('439250.35,4479664.55')).toBe('.') // sin espacio
  })

  it("coords enteras (sin decimales) → '.' por defecto (elección segura)", () => {
    expect(autodetectarSeparadorDecimal('439250 4479664\n439260 4479670')).toBe('.')
  })

  it('LANZA si no recibe un string', () => {
    expect(() => autodetectarSeparadorDecimal(42)).toThrow(TypeError)
    expect(() => autodetectarSeparadorDecimal(['a'])).toThrow(TypeError)
  })
})

// ── extraerPares ──────────────────────────────────────────────────────────────

describe('parsers/_comun — extraerPares', () => {
  it('extrae pares saltando cabeceras y etiquetas mezcladas', () => {
    const lineas = [
      'LWPOLYLINE   Layer: "0"', // cabecera: 0 números → se salta
      'Vertices seguido', // etiqueta sin números → se salta
      '439250.35 4479664.55',
      '', // línea en blanco → se salta
      '439260.10   4479670.20',
    ]
    const { anillos } = extraerPares(lineas)
    expect(anillos).toEqual([
      [
        [439250.35, 4479664.55],
        [439260.1, 4479670.2],
      ],
    ])
  })

  it('⛔ H1 · en salida de LIST, un rótulo con números («Total: 2 vertices») NO es un vértice', () => {
    // ⛔ Este test ESQUIVABA el problema con un slice(0,5) que dejaba fuera la
    // línea del rótulo (auditoría 2026-08-15, H1). Ahora entra entera: con el
    // texto claramente en formato LIST (líneas X=/Y=), SOLO esas líneas son
    // vértices; el rótulo con dos números se salta.
    const lineas = [
      'LWPOLYLINE   Layer: "0"',
      'Ubicación:  X= 439250.35  Y= 4479664.55  Z= 0.0000',
      '',
      'Ubicación:  X= 439260.10  Y= 4479670.20  Z= 0.0000',
      'Total: 2 vertices', // 2 números — la versión anterior lo leía como [2, 2]
    ]
    const { anillos } = extraerPares(lineas)
    expect(anillos).toEqual([
      [
        [439250.35, 4479664.55],
        [439260.1, 4479670.2],
      ],
    ])
  })

  it('siempre emite UNA Deteccion SEPARADOR_DECIMAL con el separador elegido', () => {
    const { detecciones } = extraerPares('439250.35 4479664.55')
    const sep = detecciones.filter((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL)
    expect(sep).toHaveLength(1)
    expect(sep[0].severidad).toBe(SEVERIDAD.INFO)
    expect(sep[0].datos).toEqual({ separador: '.', autodetectado: true })
  })

  it('respeta un separador decimal FORZADO por opts (sin autodetección)', () => {
    const { anillos, detecciones } = extraerPares('439250,35 4479664,55', { separadorDecimal: ',' })
    expect(anillos).toEqual([[[439250.35, 4479664.55]]])
    const sep = detecciones.find((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL)
    expect(sep.datos).toEqual({ separador: ',', autodetectado: false })
  })

  it('formato LIST de AutoCAD (X= Y= Z=): toma X,Y y descarta Z con su Deteccion', () => {
    const list = [
      'at point, X= 439250.3500  Y= 4479664.5500  Z= 0.0000',
      'at point, X= 439260.1000  Y= 4479670.2000  Z= 0.0000',
    ]
    const { anillos, detecciones } = extraerPares(list)
    expect(anillos).toEqual([
      [
        [439250.35, 4479664.55],
        [439260.1, 4479670.2],
      ],
    ])
    const z = detecciones.filter((d) => d.tipo === TIPO_DETECCION.Z_DESCARTADA)
    expect(z).toHaveLength(1)
    expect(z[0].datos).toEqual({ vertices: 2 })
  })

  it('sin Z: no emite Deteccion Z_DESCARTADA', () => {
    const { detecciones } = extraerPares(['439250.35 4479664.55', '439260.10 4479670.20'])
    expect(detecciones.some((d) => d.tipo === TIPO_DETECCION.Z_DESCARTADA)).toBe(false)
  })

  it('parte en varios anillos por la palabra `separador` (case-insensitive) y lo detecta', () => {
    const lineas = [
      '439250.35 4479664.55',
      '439260.10 4479670.20',
      'SEPARADOR', // mayúsculas, con espacios el trim la deja exacta
      '  Separador  ', // se ignora como corte extra pero cuenta como corte
      '400000.00 4400000.00',
      '400010.00 4400010.00',
    ]
    const { anillos, detecciones } = extraerPares(lineas)
    expect(anillos).toEqual([
      [
        [439250.35, 4479664.55],
        [439260.1, 4479670.2],
      ],
      [
        [400000.0, 4400000.0],
        [400010.0, 4400010.0],
      ],
    ])
    // Dos líneas `separador` → dos detecciones SEPARADOR_POLIGONO (una por corte).
    const cortes = detecciones.filter((d) => d.tipo === TIPO_DETECCION.SEPARADOR_POLIGONO)
    expect(cortes).toHaveLength(2)
  })

  it('un `separador` simple divide en exactamente 2 anillos con 1 detección', () => {
    const { anillos, detecciones } = extraerPares([
      '10.0 20.0',
      'separador',
      '30.0 40.0',
    ])
    expect(anillos).toHaveLength(2)
    expect(detecciones.filter((d) => d.tipo === TIPO_DETECCION.SEPARADOR_POLIGONO)).toHaveLength(1)
  })

  it('acepta indistintamente un string crudo o un array de líneas', () => {
    const comoString = extraerPares('439250.35 4479664.55\n439260.10 4479670.20')
    const comoArray = extraerPares(['439250.35 4479664.55', '439260.10 4479670.20'])
    expect(comoString.anillos).toEqual(comoArray.anillos)
  })

  it('coma decimal autodetectada: parsea correctamente los pares', () => {
    const { anillos } = extraerPares(['439250,35 4479664,55', '439260,10 4479670,20'])
    expect(anillos).toEqual([
      [
        [439250.35, 4479664.55],
        [439260.1, 4479670.2],
      ],
    ])
  })

  it('LANZA ante entrada inválida (ni string ni array de strings) — regla de oro 1', () => {
    expect(() => extraerPares(42)).toThrow(TypeError)
    expect(() => extraerPares([1, 2])).toThrow(TypeError)
    expect(() => extraerPares('x', { separadorDecimal: ';' })).toThrow(RangeError)
  })

  it('entrada sin coordenadas → anillos vacío pero SEPARADOR_DECIMAL igualmente emitido', () => {
    const { anillos, detecciones } = extraerPares(['cabecera', 'sin numeros aqui'])
    expect(anillos).toEqual([])
    expect(detecciones.some((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL)).toBe(true)
  })
})

// ── ⛔ H1 · Los metadatos de arco de la LISTA (auditoría 2026-08-15) ──────────

describe('parsers/_comun — extraerPares · arcos de la LISTA (H1)', () => {
  // La salida real de LISTA sobre una polilínea con un arco: por cada arco,
  // líneas Curvatura/Centro/Radio ADEMÁS del vértice. La línea `Centro:` trae
  // 3 números y entraba como VÉRTICE (el centro del arco dentro del anillo,
  // con bloqueos: [] y cero avisos).
  const LISTA_CON_ARCO = [
    'Ubicación:  X= 0.0000  Y= 0.0000  Z= 0.0000',
    'Curvatura: 1.0000',
    'Centro: X= 5.0000  Y= 0.0000  Z= 0.0000',
    'Radio: 5.0000',
    'Ubicación:  X= 10.0000  Y= 0.0000  Z= 0.0000',
  ]

  it('⛔ la línea «Centro:» NO entra como vértice fantasma', () => {
    const { anillos } = extraerPares(LISTA_CON_ARCO)
    expect(anillos).toEqual([
      [
        [0, 0],
        [10, 0],
      ],
    ])
    // Y en concreto el centro [5, 0] no está en ningún anillo.
    expect(anillos[0]).not.toContainEqual([5, 0])
  })

  it('la Curvatura (bulge) NO se tira: se devuelve en `curvaturas` con su vértice', () => {
    const { curvaturas } = extraerPares(LISTA_CON_ARCO)
    expect(curvaturas).toEqual([{ anillo: 0, vertice: 0, b: 1 }])
  })

  it('en un volcado TXT puro (sin X=/Y=) `curvaturas` es [] y nada cambia', () => {
    const { anillos, curvaturas } = extraerPares(['439250.35 4479664.55', '439260.10 4479670.20'])
    expect(curvaturas).toEqual([])
    expect(anillos[0]).toHaveLength(2)
  })

  it('una «Curvatura» sin vértice previo se AVISA, no se ignora en silencio', () => {
    const { curvaturas, detecciones } = extraerPares([
      'Curvatura: 0.5', // antes de cualquier vértice: no hay tramo al que atarla
      'Ubicación:  X= 10.0  Y= 20.0  Z= 0.0',
    ])
    expect(curvaturas).toEqual([])
    const aviso = detecciones.find((d) => d.tipo === TIPO_DETECCION.FORMATO_NO_SOPORTADO)
    expect(aviso).toBeTruthy()
    expect(aviso.severidad).toBe(SEVERIDAD.AVISO)
  })
})

// ── ⛔ H2 · Líneas con 4 o más números (auditoría 2026-08-15) ─────────────────

describe('parsers/_comun — extraerPares · líneas con ≥4 números (H2)', () => {
  it('⛔ un volcado «x1 y1 x2 y2» NO se traga la mitad de los pares con el cuento de la Z', () => {
    // Antes: nums.length >= 3 → zCount++ y se quedaba con los DOS primeros: la
    // mitad de los vértices perdidos con el mensaje FALSO «Se descartó la
    // coordenada Z». Ahora: la línea se omite ENTERA y se dice la verdad (ERROR).
    const { anillos, detecciones } = extraerPares([
      '439250.35 4479664.55 439260.10 4479670.20',
      '439270.00 4479680.00 439280.00 4479690.00',
    ])
    expect(anillos).toEqual([]) // nada importado a medias
    expect(detecciones.some((d) => d.tipo === TIPO_DETECCION.Z_DESCARTADA)).toBe(false) // sin mentira
    const err = detecciones.find((d) => d.tipo === TIPO_DETECCION.FORMATO_NO_SOPORTADO)
    expect(err).toBeTruthy()
    expect(err.severidad).toBe(SEVERIDAD.ERROR)
    expect(err.datos.lineas).toBe(2)
    expect(err.mensaje).toMatch(/4 o más números/)
  })

  it('3 números siguen siendo un par + Z plausible (comportamiento intacto)', () => {
    const { anillos, detecciones } = extraerPares(['439250.35 4479664.55 0.00'])
    expect(anillos).toEqual([[[439250.35, 4479664.55]]])
    expect(detecciones.some((d) => d.tipo === TIPO_DETECCION.Z_DESCARTADA)).toBe(true)
    expect(detecciones.some((d) => d.tipo === TIPO_DETECCION.FORMATO_NO_SOPORTADO)).toBe(false)
  })

  it('mezcla: las líneas buenas entran y las de ≥4 números se declaran', () => {
    const { anillos, detecciones } = extraerPares([
      '439250.35 4479664.55',
      '1 439260.10 4479670.20 0.00', // índice + X + Y + Z: no soportado
      '439270.00 4479680.00',
    ])
    expect(anillos).toEqual([
      [
        [439250.35, 4479664.55],
        [439270.0, 4479680.0],
      ],
    ])
    expect(detecciones.find((d) => d.tipo === TIPO_DETECCION.FORMATO_NO_SOPORTADO).datos.lineas).toBe(1)
  })
})

// ── ⛔ H5/H6 · Separador decimal: enteros con coma, miles, científica ─────────

describe('parsers/_comun — autodetección: enteros con coma de columna (H5) y notación científica (H6)', () => {
  it('⛔ H5 · «439250,4479664» (enteros, coma de columna) → gana "." y salen pares', () => {
    // Antes: la coma contaba como decimal (\d,\d → 1 a 0), cada línea se fundía
    // en UN número, TODAS se saltaban y el fichero moría en SIN_GEOMETRIA.
    expect(autodetectarSeparadorDecimal('439250,4479664\n439260,4479670')).toBe('.')
    const { anillos, detecciones } = extraerPares(['439250,4479664', '439260,4479670'])
    expect(anillos).toEqual([
      [
        [439250, 4479664],
        [439260, 4479670],
      ],
    ])
    // La decisión no trivial queda contada en la propia detección (regla 1).
    const sep = detecciones.find((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL)
    expect(sep.datos.separador).toBe('.')
    expect(sep.datos.motivo).toBe('PARES_SOBRE_COMA')
  })

  it('H5 · el formato español con miles «4.479.664,55» ya no se destroza', () => {
    // Antes: los puntos de millar «ganaban» el recuento (3 a 2) → '.' → cada
    // número se partía en pedazos (439.25, 35, 4.479, 664.55…).
    expect(autodetectarSeparadorDecimal('439.250,35 4.479.664,55')).toBe(',')
    const { anillos, detecciones } = extraerPares(['439.250,35 4.479.664,55'])
    expect(anillos).toEqual([[[439250.35, 4479664.55]]])
    expect(detecciones.find((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL).datos.motivo).toBe(
      'MILES_ES',
    )
  })

  it('H5 · la coma decimal DE VERDAD (con decimales) sigue ganando como siempre', () => {
    expect(autodetectarSeparadorDecimal('439250,35 4479664,55')).toBe(',')
    const { anillos } = extraerPares(['439250,35 4479664,55'])
    expect(anillos).toEqual([[[439250.35, 4479664.55]]])
  })

  it('H6 · notación científica: «4.3925e5» es UN número, no dos', () => {
    // Antes tokenizaba como 4.3925 y 5 → un vértice [4.3925, 5] inventado.
    const { anillos } = extraerPares(['4.3925e5 4.4796645e6'])
    expect(anillos).toEqual([[[439250, 4479664.5]]])
  })
})

// ── ⭐ F14 · DE QUÉ HABLAN LOS MENSAJES DE ESTA CAPA ─────────────────────────

describe('parsers/_comun — el SUJETO de los mensajes (F14)', () => {
  it('los dos sujetos traen LAS CUATRO formas, y se recorre el objeto', () => {
    // Un sujeto nuevo al que le falte una clave imprimiría `undefined` dentro de un
    // aviso. Se recorre el catálogo en vez de nombrar los dos a mano.
    expect(SUJETOS.length).toBeGreaterThan(1)
    for (const clave of SUJETOS) {
      for (const forma of ['nominativo', 'genitivo', 'escueto', 'guia']) {
        expect(typeof SUJETO[clave][forma], `${clave}.${forma}`).toBe('string')
        expect(SUJETO[clave][forma].length, `${clave}.${forma} está vacío`).toBeGreaterThan(0)
      }
      expect(Object.isFrozen(SUJETO[clave])).toBe(true)
    }
    expect(Object.isFrozen(SUJETO)).toBe(true)
  })

  it('⛔ los textos de PARCELA son los de siempre, byte a byte', () => {
    // La disciplina de T1.5: la rama que no cambia tiene que decir EXACTAMENTE lo
    // que decía. Estos tres literales son los que estaban en `importar.js` y en
    // `dxf.js` antes de F14.
    expect(SUJETO.PARCELA.nominativo).toBe('La parcela')
    expect(SUJETO.PARCELA.genitivo).toBe('de la parcela')
    expect(SUJETO.PARCELA.escueto).toBe('de parcela')
    expect(SUJETO.PARCELA.guia).toBe(
      'Deja solo la polilínea de la parcela en la capa 0 y ejecuta LIMPIA (PURGE); ' +
        'no se importan bloques, INSERT, xref ni splines.',
    )
  })

  it('⭐ la GUÍA de la construcción NO es la de parcela con otro sustantivo', () => {
    // Una construcción tiene una polilínea POR PARTE —trece en el edificio real—,
    // así que «deja SOLO la polilínea» le haría perder doce. Es el único de los
    // cuatro textos que no es una declinación sino otro consejo.
    expect(SUJETO.CONSTRUCCION.guia).not.toContain('Deja solo la polilínea')
    expect(SUJETO.CONSTRUCCION.guia).toContain('una por parte')
    // Y lo que SÍ vale igual sigue estando: el PURGE y la lista de lo que no entra.
    expect(SUJETO.CONSTRUCCION.guia).toContain('LIMPIA (PURGE)')
    expect(SUJETO.CONSTRUCCION.guia).toContain('splines')
  })

  it('ninguna forma de CONSTRUCCION dice «parcela»', () => {
    for (const forma of Object.values(SUJETO.CONSTRUCCION)) {
      expect(forma.toLowerCase()).not.toContain('parcela')
    }
  })

  it('el defecto y la clave de construcción están EN el catálogo', () => {
    // Si alguien renombra una clave, esto sale rojo en vez de dejar a `declinar`
    // cayéndose al defecto en silencio.
    expect(SUJETOS).toContain(SUJETO_POR_DEFECTO)
    expect(SUJETOS).toContain(SUJETO_CONSTRUCCION)
    expect(SUJETO_POR_DEFECTO).toBe('PARCELA')
  })

  it('⛔ `declinar` con basura NO lanza: se cae al defecto', () => {
    // Se llama desde DENTRO de un parser, en mitad de un fichero que el usuario
    // acaba de soltar: reventar ahí cambiaría un aviso sobre el dato por un fallo
    // del programa. Quien sí lanza es `importar`, que es donde el error es del
    // programador.
    for (const basura of [undefined, null, '', 'PARCELITA', 42, {}]) {
      expect(() => declinar(basura)).not.toThrow()
      expect(declinar(basura)).toBe(SUJETO[SUJETO_POR_DEFECTO])
    }
    expect(declinar(SUJETO_CONSTRUCCION)).toBe(SUJETO.CONSTRUCCION)
  })
})

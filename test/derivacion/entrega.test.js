/* -------------------------------------------------------------------------- *
 * test/derivacion/entrega.test.js — F17 · tarea 3.1                            *
 *                                                                              *
 * `prepararEntrega` es el orquestador de la fase: deriva, valida CADA pieza,    *
 * comprueba que el conjunto CIERRE, propone el acto jurídico y escribe UN       *
 * `.gml` con N `gml:featureMember`. No mide nada por su cuenta; su trabajo es   *
 * **pararse en cuanto algo no cuadra**.                                         *
 *                                                                              *
 * Lo que este fichero defiende, por orden de importancia:                       *
 *                                                                              *
 *   1. ⛔ **QUE UN EXPEDIENTE QUE NO CIERRA NO SALGA.** Es el fallo que devuelve *
 *      IVG negativo, y el que la aplicación no sabía evitar hasta hoy. Se       *
 *      comprueba dejando fuera una pieza y comprobando que `puedeEntregarse`    *
 *      cae **aunque el XML se pudiera escribir perfectamente**.                 *
 *   2. ⛔ **QUE MIRAR `xml !== null` NO BASTE.** Hay un test que lo dice con ese *
 *      nombre: el documento puede estar escrito y el conjunto no cerrar.        *
 *   3. ⭐ **EL EXPEDIENTE DE ORO, REPRODUCIDO**: derivando sobre la geometría    *
 *      oficial de `7136910UF1473N` salen dos miembros con los namespaces y los  *
 *      `localId` del envío que obtuvo IVG positivo, y `areaValueTotal` **466**, *
 *      que es exactamente lo que la Sede computó como AFECTADAS.                *
 *   4. Que cada pieza pase la validación ENTERA, no una versión ligera.         *
 *   5. El snapshot que alimenta `npm run validar:xsd`.                          *
 *                                                                              *
 * Proyecto Vitest `node`.                                                       *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

import { prepararEntrega } from '../../derivacion/entrega.js'
import { SEVERIDAD, TIPO_DERIVACION } from '../../derivacion/_comun.js'
import { NAMESPACE_CATASTRO, NAMESPACE_LOCAL } from '../../derivacion/identidad.js'
import { TIPO_OPERACION } from '../../derivacion/operacion.js'
import { derivarCesion } from '../../derivacion/cesion.js'
import { recortarVecinos } from '../../derivacion/vecino.js'
import { parsearGml } from '../../gml/parse.js'
import { nombreFicheroGml } from '../../gml/descargar.js'

// ── Arnés ────────────────────────────────────────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')
const REFCAT_ORO = '7136910UF1473N'

/** La geometría OFICIAL del expediente de oro (`SPEC.md` §7.1, IVG positivo). */
const ORO = parsearGml(
  readFileSync(join(RAIZ, 'test', 'fixtures', 'gml', `cp_parcela_${REFCAT_ORO}.gml`), 'utf8').replaceAll(
    '\r\n',
    '\n',
  ),
).parcelas[0].recintos

const X_MAX = Math.max(...ORO[0].vertices.map((v) => v[0]))

/** Recorta el anillo por `x ≤ lim`: «mover el lindero este hacia dentro». */
const recortar = (abierto, lim) => {
  const salida = []
  for (let i = 0; i < abierto.length; i++) {
    const a = abierto[i]
    const b = abierto[(i + 1) % abierto.length]
    const dentroA = a[0] <= lim
    const dentroB = b[0] <= lim
    if (dentroA) salida.push(a)
    if (dentroA !== dentroB) {
      const t = (lim - a[0]) / (b[0] - a[0])
      salida.push([lim, a[1] + t * (b[1] - a[1])])
    }
  }
  return salida
}

/** La parcela del oro con el lindero este movido `d` metros hacia dentro. */
const parcelaRecortada = (d) => ({
  idLocal: 'p1',
  refcat: REFCAT_ORO,
  recintos: [{ tipo: 'EXTERIOR', vertices: recortar(ORO[0].vertices, X_MAX - d) }],
  geometriaOficial: ORO,
  origen: 'WFS',
})

const rect = (x0, y0, x1, y1) => [
  {
    tipo: 'EXTERIOR',
    vertices: [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
  },
]

const tipos = (e) => e.detecciones.map((d) => d.tipo)
const ARGS = { srs: 'EPSG:25830' }

// ── 1 · ⭐ El expediente de oro, reproducido ─────────────────────────────────

describe('prepararEntrega · el expediente que la Sede aceptó', () => {
  const entrega = prepararEntrega({ parcela: parcelaRecortada(3), ...ARGS })

  it('⭐ sale con DOS miembros, con los namespaces y los `localId` del envío real', () => {
    expect(entrega.puedeEntregarse).toBe(true)
    expect(entrega.bloqueos).toEqual([])
    expect(entrega.nMiembros).toBe(2)
    expect(entrega.miembros.map((m) => m.identidad.refcat)).toEqual([
      REFCAT_ORO,
      `${REFCAT_ORO}.1`,
    ])
    expect(entrega.miembros.map((m) => m.identidad.namespaceInspire)).toEqual([
      NAMESPACE_CATASTRO,
      NAMESPACE_LOCAL,
    ])
  })

  it('⭐ `areaValueTotal` es 466: lo mismo que la Sede computó como AFECTADAS', () => {
    // La cifra externa de `SPEC.md` §7.1, y la única de este proyecto donde tres
    // fuentes independientes coinciden. Que salga sola de la cadena entera —parsear,
    // derivar, redondear, sumar— es lo que hace que la cadena valga.
    expect(entrega.resumenGml.areaValueTotal).toBe(466)
  })

  it('propone SEGREGACIÓN, y la propone con su porqué a la vista', () => {
    expect(entrega.operacion.tipo).toBe(TIPO_OPERACION.SEGREGACION)
    expect(entrega.operacion.propuesto).toBe(true)
    expect(entrega.operacion.formaMedida).toBe(true)
    expect(entrega.operacion.porQue).toMatch(/alta que el Catastro todavía no tiene/)
  })

  it('el conjunto CIERRA, y se comprueba antes de escribir nada', () => {
    expect(entrega.cierre.cierra).toBe(true)
    expect(entrega.cierre.miembros).toHaveLength(2)
  })

  it('emite UN documento de perfil ENTREGA con dos `gml:featureMember`', () => {
    expect(entrega.xml).not.toBeNull()
    expect(entrega.xml.match(/<gml:featureMember>/g)).toHaveLength(2)
    expect(entrega.xml).toContain('<gml:FeatureCollection')
    expect(entrega.xml).not.toContain('wfs:FeatureCollection')
    expect(entrega.resumenGml.subibleALaSede).toBe(true)
  })

  it('la única detección es la que dice que se ha mirado todo y sale', () => {
    expect(tipos(entrega)).toEqual([TIPO_DERIVACION.ENTREGA_LISTA])
    expect(entrega.detecciones[0].severidad).toBe(SEVERIDAD.INFO)
    expect(entrega.detecciones[0].mensaje).toMatch(/466,21 m² del contorno oficial/)
  })

  it('⚠️ NO nombra el fichero, pero da lo que hace falta para nombrarlo', () => {
    // `gml/descargar.js` necesita `Blob` y se queda fuera del barrel raíz, así que
    // esta capa no puede llamarlo. Devuelve `refcat` y `nMiembros`, que es todo.
    expect(entrega.refcat).toBe(REFCAT_ORO)
    const nombre = nombreFicheroGml({
      refcat: entrega.refcat,
      fecha: new Date('2026-08-05T10:00:00Z'),
      miembros: entrega.nMiembros,
    })
    expect(nombre).toMatch(/^expediente_7136910UF1473N_/)
    expect(nombre.endsWith('.gml')).toBe(true)
  })

  it('⭐ el documento emitido queda como snapshot, y de ahí lo lee `validar:xsd`', async () => {
    // `npm run validar:xsd -- --estricto` lo valida contra `cp/4.0` a secas, que es
    // lo que carga el IVG. Un snapshot que nadie valida es un fichero; éste es el
    // gate de esquema del expediente de varias parcelas.
    await expect(entrega.xml).toMatchFileSnapshot(
      '../gml/__snapshots__/expediente-entrega.gml',
    )
  })
})

// ── 2 · ⛔ Un expediente que no cierra NO sale ───────────────────────────────

describe('prepararEntrega · lo que impide entregar', () => {
  it('⛔ dejar fuera la cesión: se dice, y la entrega se BLOQUEA', () => {
    const e = prepararEntrega({ parcela: parcelaRecortada(3), ...ARGS, incluidas: [] })
    expect(e.puedeEntregarse).toBe(false)
    expect(e.bloqueos).toEqual([TIPO_DERIVACION.CONJUNTO_NO_CIERRA])
    // La exclusión se NOMBRA con su superficie: no desaparece en silencio.
    const excluida = e.detecciones.find((d) => d.tipo === TIPO_DERIVACION.PIEZA_EXCLUIDA)
    expect(excluida.severidad).toBe(SEVERIDAD.AVISO)
    expect(excluida.datos.area).toBeGreaterThan(20)
    expect(excluida.mensaje).toMatch(/volverá negativo/)
  })

  it('⛔⭐ y el XML se podría escribir perfectamente: por eso no basta `xml !== null`', () => {
    // El fichero de UNA parcela sería un GML impecable y válido contra el XSD. Lo
    // que estaría mal es el EXPEDIENTE, y eso no lo ve ningún validador de esquema.
    const e = prepararEntrega({ parcela: parcelaRecortada(3), ...ARGS, incluidas: [] })
    expect(e.xml).toBeNull() // no se escribe, precisamente para que no se suba
    expect(e.miembros).toHaveLength(1)
    expect(e.miembros[0].validacion.puedeGenerar).toBe(true) // la geometría está bien
    expect(e.cierre.cierra).toBe(false) // lo que falla es el conjunto
  })

  it('sin `geometriaOficial` no hay expediente que armar, y se dice', () => {
    const e = prepararEntrega({
      parcela: { idLocal: 'dibujada', refcat: null, recintos: rect(0, 0, 20, 10) },
      ...ARGS,
    })
    expect(e.puedeEntregarse).toBe(false)
    expect(e.bloqueos).toEqual([TIPO_DERIVACION.SIN_GEOMETRIA_OFICIAL])
    expect(e.xml).toBeNull()
    expect(e.miembros).toEqual([])
  })

  it('⛔ la parcela que CRECE tampoco sale: el sobrante estaría incompleto', () => {
    const e = prepararEntrega({
      parcela: {
        idLocal: 'p1',
        refcat: REFCAT_ORO,
        recintos: rect(0, 0, 22, 10),
        geometriaOficial: rect(0, 0, 20, 10),
      },
      ...ARGS,
    })
    expect(e.puedeEntregarse).toBe(false)
    expect(e.bloqueos).toEqual([TIPO_DERIVACION.CRECE_FUERA])
  })

  it('⛔ una pieza que no pasa la validación bloquea, y dice que es de la aplicación', () => {
    // Se fuerza con un SRS de otro huso: los vértices del oro caen fuera y la regla
    // de huso de F02 lo marca como error bloqueante en TODOS los miembros.
    const e = prepararEntrega({ parcela: parcelaRecortada(3), srs: 'EPSG:25829' })
    expect(e.puedeEntregarse).toBe(false)
    expect(e.bloqueos).toContain(TIPO_DERIVACION.PIEZA_INVALIDA)
    const dePieza = e.detecciones.find((d) => d.datos?.esCesion === true)
    expect(dePieza.mensaje).toMatch(/lo ha calculado la aplicación|calculado la aplicación/)
  })
})

// ── 3 · Cada pieza pasa la validación ENTERA ────────────────────────────────

describe('prepararEntrega · la cesión se valida como cualquier otra parcela', () => {
  const e = prepararEntrega({ parcela: parcelaRecortada(3), ...ARGS })

  it('los DOS miembros traen su validación completa, no solo la propia', () => {
    // La tentación es validar solo la parcela del usuario «porque las cesiones las
    // calcula el programa». Justo al revés: una pieza del sobrante es geometría que
    // NADIE ha mirado, salida de un motor booleano sobre dos contornos suyos.
    for (const m of e.miembros) {
      expect(m.validacion).toMatchObject({ puedeGenerar: true })
      expect(Array.isArray(m.validacion.errores)).toBe(true)
      expect(Array.isArray(m.validacion.avisos)).toBe(true)
    }
  })

  it('la parcela propia va la PRIMERA y con `orden` 0; las cesiones detrás', () => {
    expect(e.miembros[0]).toMatchObject({ orden: 0, esCesion: false })
    expect(e.miembros.slice(1).every((m) => m.esCesion)).toBe(true)
    // El orden de los miembros del fichero es el de la lista, y el de la lista es el
    // determinista de `cesion.js`: dos corridas dan el mismo `localId` a la misma pieza.
    const otra = prepararEntrega({ parcela: parcelaRecortada(3), ...ARGS })
    expect(otra.miembros.map((m) => m.identidad.refcat)).toEqual(
      e.miembros.map((m) => m.identidad.refcat),
    )
  })
})

// ── 4 · El nombre del usuario, y dónde NO llega ─────────────────────────────

describe('prepararEntrega · el nombre de una pieza es para las personas', () => {
  const e = prepararEntrega({
    parcela: parcelaRecortada(3),
    ...ARGS,
    nombres: { 1: '  Cesión al vial  ' },
  })

  it('llega a la etiqueta del miembro, recortado', () => {
    expect(e.miembros[1].nombre).toBe('Cesión al vial')
    expect(e.miembros[1].etiqueta).toBe('Cesión al vial')
  })

  it('⛔ y NO llega al `.gml`: el `localId` está MEDIDO (O19)', () => {
    // Desviación consciente del plan, escrita en la cabecera del módulo y en la
    // ficha: meter texto libre en el `localId` cambiaría el único identificador de
    // finca que este proyecto ha visto aceptar con IVG positivo.
    expect(e.xml).not.toContain('Cesión al vial')
    expect(e.xml).toContain(`<base:localId>${REFCAT_ORO}.1</base:localId>`)
  })

  it('sin nombre, la etiqueta es el `localId`: nunca queda un miembro sin nombrar', () => {
    const sinNombre = prepararEntrega({ parcela: parcelaRecortada(3), ...ARGS })
    expect(sinNombre.miembros[1].nombre).toBeNull()
    expect(sinNombre.miembros[1].etiqueta).toBe(`${REFCAT_ORO}.1`)
  })
})

// ── 5 · Contrato ────────────────────────────────────────────────────────────

describe('prepararEntrega · lo que LANZA es contrato roto', () => {
  it('lanza sin objeto, sin parcela o sin SRS', () => {
    expect(() => prepararEntrega()).toThrow(TypeError)
    expect(() => prepararEntrega({ srs: 'EPSG:25830' })).toThrow(/parcela/)
    expect(() => prepararEntrega({ parcela: parcelaRecortada(3) })).toThrow(/'srs'/)
  })

  it('⛔ lanza si `incluidas` pide una pieza que esta FOTO no tiene', () => {
    // No es una elección del usuario: es que la pantalla está mirando un sobrante
    // distinto del que se va a entregar. Decisión 3C — editar la parcela invalida la
    // foto entera, y reconciliar por número sería pegar un nombre a otra finca.
    expect(() =>
      prepararEntrega({ parcela: parcelaRecortada(3), ...ARGS, incluidas: [1, 7] }),
    ).toThrow(/FOTO distinta/)
  })

  it('acepta la FOTO ya derivada, y entrega EXACTAMENTE lo que se revisó', () => {
    const parcela = parcelaRecortada(3)
    const cesion = derivarCesion({
      recintos: parcela.recintos,
      geometriaOficial: parcela.geometriaOficial,
    })
    const e = prepararEntrega({ parcela, ...ARGS, cesion })
    expect(e.cesion).toBe(cesion)
    expect(e.puedeEntregarse).toBe(true)
  })
})

// ── F23 · el colindante recortado entra en el expediente ─────────────────────

describe('prepararEntrega · ⛔ CRECE_FUERA deja de bloquear cuando el recorte lo explica', () => {
  // ⚠️ Sobre coordenadas UTM REALES (huso 30, junto al expediente 29050A01000144).
  // Con rectángulos en el origen la validación de huso los rechaza —y hace bien: la
  // desproyección cae fuera de España—, así que un test escrito en 0..10 mediría el
  // guardián de huso en vez de lo que dice medir.
  const X0 = 388590
  const Y0 = 4082390
  const caja = (a, b, c, d) => rect(X0 + a, Y0 + b, X0 + c, Y0 + d)

  // El contorno oficial ocupa 0..10; la medición se corre 2 m al este, así que
  // suelta 0..2 por el oeste (20 m²) y se come 10..12 del vecino (20 m²).
  const OFICIAL = caja(0, 0, 10, 10)
  const MEDIDA = caja(2, 0, 12, 10)
  const VECINA = { refcat: 'V1', recintos: caja(10, 0, 20, 10) }
  const parcela = { idLocal: 'P-1', refcat: 'RC1', recintos: MEDIDA, geometriaOficial: OFICIAL }

  const cesionDe = () => derivarCesion({ recintos: MEDIDA, geometriaOficial: OFICIAL })
  const recorteDe = (vecinas) =>
    recortarVecinos({ recintos: MEDIDA, vecinas, fuera: cesionDe().puerta.piezas })

  it('SIN recorte sigue bloqueando: es el guardián original y no se ha aflojado', () => {
    const e = prepararEntrega({ parcela, srs: ARGS.srs, cesion: cesionDe() })
    expect(e.puedeEntregarse).toBe(false)
    expect(e.bloqueos).toContain('CRECE_FUERA')
    expect(e.xml).toBeNull()
  })

  it('⛔ con las vecinas SIN consultar (null) TAMPOCO se abre', () => {
    // «No le quito a nadie» y «no he mirado» son afirmaciones opuestas, y la
    // segunda no puede abrir una puerta.
    const e = prepararEntrega({ parcela, srs: ARGS.srs, cesion: cesionDe(), recorte: recorteDe(null) })
    expect(e.puedeEntregarse).toBe(false)
    expect(e.bloqueos).toContain('CRECE_FUERA')
  })

  it('⭐ CON el recorte se abre, el vecino entra como miembro y el conjunto CIERRA', () => {
    const e = prepararEntrega({
      parcela,
      srs: ARGS.srs,
      cesion: cesionDe(),
      recorte: recorteDe([VECINA]),
    })

    expect(e.puedeEntregarse).toBe(true)
    expect(e.bloqueos).toEqual([])
    // La parcela, su cesión del oeste, y el vecino recortado.
    expect(e.nMiembros).toBe(3)
    const porRc = e.miembros.map((m) => m.identidad.refcat)
    expect(porRc).toContain('V1')
    // El vecino conserva su referencia REAL bajo el namespace del Catastro: no es
    // un alta, es la misma finca con otro lindero.
    const vecino = e.miembros.find((m) => m.identidad.refcat === 'V1')
    expect(vecino.identidad.namespaceInspire).toBe('ES.SDGC.CP')
    expect(vecino.esVecino).toBe(true)

    // ⭐ Y el cierre, que es lo que decide si el IVG saldrá positivo. La diana ya
    // no es «mi contorno» sino los DOS oficiales que el expediente modifica.
    expect(e.cierre.cierra).toBe(true)
    expect(e.cierre.suma.areaOficial).toBeCloseTo(200, 6) // 100 mía + 100 del vecino
    expect(e.cierre.cobertura.cumple).toBe(true)
    expect(e.cierre.solapes.cumple).toBe(true)
    expect(e.xml).not.toBeNull()
  })

  it('⛔ la detección CRECE_FUERA SIGUE en la lista: deja de bloquear, no se borra', () => {
    // El usuario tiene derecho a leer que su medición se sale, aunque el expediente
    // ya explique a quién. Borrarla sería entregar en silencio.
    const e = prepararEntrega({
      parcela,
      srs: ARGS.srs,
      cesion: cesionDe(),
      recorte: recorteDe([VECINA]),
    })
    expect(e.detecciones.map((d) => d.tipo)).toContain('CRECE_FUERA')
  })

  it('⛔ un expediente entregable TIENE que traer fichero', () => {
    // El defecto que apareció al medir sobre el expediente real: la puerta se abría,
    // los miembros se componían, y un `if` intermedio que seguía mirando ERROR en
    // crudo devolvía antes del cierre. Salía `puedeEntregarse: true` con `xml: null`,
    // que es peor que quedarse bloqueado.
    const e = prepararEntrega({
      parcela,
      srs: ARGS.srs,
      cesion: cesionDe(),
      recorte: recorteDe([VECINA]),
    })
    expect(e.puedeEntregarse).toBe(true)
    expect(e.xml, 'entregable y sin xml es la peor combinación posible').not.toBeNull()
    expect(e.cierre, 'entregable sin haber comprobado el cierre').not.toBeNull()
  })
})

// ── F23 · ⛔ el colindante SIN referencia catastral ──────────────────────────

describe('prepararEntrega · ⛔ un colindante SIN referencia NO tumba la entrega', () => {
  // ⭐ EL DEFECTO, MEDIDO (auditoría del 2026-08-16). `Vecina.refcat` es
  // `string|null` por contrato y `app/colindantes.js` produce `null` A PROPÓSITO
  // cuando el WFS no devuelve la referencia («no se inventa nada»), o sea que el
  // estado es LEGÍTIMO y alcanzable. `prepararEntrega` lo componía con
  // `identidadDeParcela({refcat: v.refcat, idLocal: v.refcat})` —el MISMO campo
  // dos veces, así que sin referencia no hay respaldo— y LANZABA un `TypeError`
  // de contrato interno. La pantalla lo enseñaba tal cual: «No se ha podido
  // componer el expediente: identidadDeParcela: hace falta refcat o idLocal…»,
  // que no dice ni qué pasa ni qué hacer, y el expediente no salía nunca.
  //
  // Mismo terreno UTM real que el bloque de arriba, y por el mismo motivo: con
  // rectángulos en el origen la validación de huso los rechaza (y hace bien).
  const X0 = 388590
  const Y0 = 4082390
  const caja = (a, b, c, d) => rect(X0 + a, Y0 + b, X0 + c, Y0 + d)

  const OFICIAL = caja(0, 0, 10, 10)
  const MEDIDA = caja(2, 0, 12, 10)
  const parcela = { idLocal: 'P-1', refcat: 'RC1', recintos: MEDIDA, geometriaOficial: OFICIAL }

  /** La colindante a la que la medición le come 10..12 × 0..10 = 20 m². */
  const SIN_REFERENCIA = { refcat: null, recintos: caja(10, 0, 20, 10) }
  const CON_REFERENCIA = { refcat: 'V1', recintos: caja(10, 0, 20, 10) }

  const cesionDe = () => derivarCesion({ recintos: MEDIDA, geometriaOficial: OFICIAL })
  const recorteDe = (vecinas) =>
    recortarVecinos({ recintos: MEDIDA, vecinas, fuera: cesionDe().puerta.piezas })
  const entregaCon = (vecinas) =>
    prepararEntrega({ parcela, srs: ARGS.srs, cesion: cesionDe(), recorte: recorteDe(vecinas) })

  it('⭐ NO lanza: el `refcat: null` de una vecina es un estado del CONTRATO', () => {
    expect(() => entregaCon([SIN_REFERENCIA])).not.toThrow()
  })

  it('⛔ y tampoco sale: no se le quita terreno a quien el fichero no puede nombrar', () => {
    const e = entregaCon([SIN_REFERENCIA])
    expect(e.puedeEntregarse).toBe(false)
    expect(e.bloqueos).toContain(TIPO_DERIVACION.PIEZA_INVALIDA)
    expect(e.xml).toBeNull()
    // Sus trozos NO se han colado como miembros con una identidad inventada.
    expect(e.miembros.some((m) => m.esVecino === true)).toBe(false)
  })

  it('⭐ la detección la puede leer un técnico: nombra la superficie y qué hacer', () => {
    const e = entregaCon([SIN_REFERENCIA])
    const d = e.detecciones.find((x) => x.datos?.sinReferencia !== undefined)
    expect(d, 'no hay ninguna detección del colindante sin referencia').toBeDefined()
    expect(d.severidad).toBe(SEVERIDAD.ERROR)
    expect(d.datos.sinReferencia).toBe(1)
    expect(d.datos.area).toBeCloseTo(20, 6)
    expect(d.mensaje).toMatch(/referencia catastral/)
    expect(d.mensaje).toMatch(/colindantes/)
  })

  it('⛔ y NINGUNA detección le enseña al usuario el contrato interno del módulo', () => {
    // Lo que se veía antes en pantalla. Un mensaje que cita una función de
    // `derivacion/identidad.js` es un fallo del programa disfrazado de aviso.
    const e = entregaCon([SIN_REFERENCIA])
    for (const d of e.detecciones) {
      expect(d.mensaje, `«${d.mensaje}»`).not.toMatch(/identidadDe(Parcela|Cesion)/)
    }
  })

  it('⛔ `CRECE_FUERA` vuelve a bloquear: el exceso ya no está explicado', () => {
    // La puerta se abre porque cada metro que la medición se sale está atribuido a
    // un vecino «que entra recortado unas líneas más abajo». Un vecino que no
    // puede entrar rompe esa premisa, así que la puerta se cierra otra vez.
    expect(entregaCon([SIN_REFERENCIA]).bloqueos).toContain(TIPO_DERIVACION.CRECE_FUERA)
    // ANTI-VACUIDAD: con la MISMA geometría y la referencia puesta, sale entero.
    const buena = entregaCon([CON_REFERENCIA])
    expect(buena.puedeEntregarse).toBe(true)
    expect(buena.xml).not.toBeNull()
  })
})

// ── ⛔ La astilla del ENGANCHE tumbaba el fichero entero ─────────────────────

describe('prepararEntrega · ⛔ una pieza que no se puede escribir NO tumba el expediente', () => {
  // ⭐ EL DEFECTO, TAL COMO LO ENCONTRÓ EL AUTOR (2026-08-10, `6346726UF8664N`).
  // Al enganchar la medición a los linderos oficiales, entre las dos líneas queda
  // una astilla de milímetros. La aplicación la ofrecía como finca, el escritor de
  // GML no le encontraba punto de referencia y devolvía `xml: null`… **para el
  // documento entero**. La pantalla lo contaba como «el expediente NO cierra sobre
  // el contorno oficial» cuando el conjunto cerraba: suma, cero solape y cobertura,
  // las tres. El autor se fue a buscar un problema de cierre que no existía y
  // concluyó que la aplicación ya no dejaba hacer el caso.
  //
  // Aquí el lindero este se mueve medio milímetro: los dos bordes de la astilla
  // caen en la misma coordenada al redondear a 2 decimales.
  const parcela = parcelaRecortada(0.0005)
  const cesion = derivarCesion({
    recintos: parcela.recintos,
    geometriaOficial: parcela.geometriaOficial,
  })

  it('la cesión la marca `emitible: false` en vez de callársela', () => {
    expect(cesion.piezas.length).toBeGreaterThan(0)
    expect(cesion.piezas.every((p) => p.emitible === false)).toBe(true)
    expect(cesion.nNoEmitibles).toBe(cesion.piezas.length)
    expect(tipos(cesion)).toContain(TIPO_DERIVACION.PIEZA_NO_EMITIBLE)
    // AVISO y no ERROR: bloquear aquí sería el defecto otra vez, con otro nombre.
    const d = cesion.detecciones.find((x) => x.tipo === TIPO_DERIVACION.PIEZA_NO_EMITIBLE)
    expect(d.severidad).toBe(SEVERIDAD.AVISO)
    expect(cesion.puedeEntregarse).toBe(true)
  })

  it('⭐ el expediente SALE, con su fichero, y la astilla no va dentro', () => {
    const e = prepararEntrega({ parcela, ...ARGS })
    expect(e.puedeEntregarse, `bloqueos: ${e.bloqueos.join(', ')}`).toBe(true)
    expect(e.xml).not.toBeNull()
    // Un solo miembro: la parcela. Ninguna astilla se ha colado como finca.
    expect(e.nMiembros).toBe(1)
    expect(e.miembros.every((m) => m.esCesion !== true)).toBe(true)
  })

  it('⛔ y el conjunto CIERRA: la astilla no era superficie que faltara', () => {
    // La otra mitad del hecho. Si dejar fuera la astilla abriera un hueco real, el
    // arreglo habría cambiado un bloqueo honesto por un fichero malo.
    const e = prepararEntrega({ parcela, ...ARGS })
    expect(e.cierre.cierra).toBe(true)
    expect(e.cierre.suma.cumple).toBe(true)
    expect(e.cierre.cobertura.cumple).toBe(true)
  })

  it('⛔ pedirla EXPRESAMENTE tampoco la mete: no es una preferencia, es imposible', () => {
    // `incluidas` es lo que manda la pantalla. Fiar la defensa a que la casilla esté
    // desmarcada sería fiarla a la interfaz, y al otro lado hay un fichero que
    // alguien firma — la misma doctrina que hace a `entregar()` repetir la puerta.
    const e = prepararEntrega({
      parcela,
      ...ARGS,
      incluidas: cesion.piezas.map((p) => p.orden),
    })
    expect(e.puedeEntregarse).toBe(true)
    expect(e.xml).not.toBeNull()
    expect(e.nMiembros).toBe(1)
    // Y se DICE que se ha pedido y no ha entrado, que es distinto de callarlo.
    expect(tipos(e)).toContain(TIPO_DERIVACION.PIEZA_NO_EMITIBLE)
  })
})

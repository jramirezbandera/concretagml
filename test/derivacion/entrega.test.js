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

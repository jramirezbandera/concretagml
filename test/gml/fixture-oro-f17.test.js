/* -------------------------------------------------------------------------- *
 * test/gml/fixture-oro-f17.test.js — F17 · fase 0                              *
 *                                                                              *
 * `cp_parcela_7136910UF1473N.gml` es la geometría OFICIAL del único expediente  *
 * de este proyecto donde tres fuentes independientes coinciden sobre la misma   *
 * superficie y donde además hay un IVG POSITIVO detrás (CSV `XMWPXCN9J8DB9J89`, *
 * `SPEC.md` §7.1). Es contra ese número contra el que F17 tiene que demostrar   *
 * que un expediente de varias parcelas CIERRA.                                  *
 *                                                                              *
 * Este fichero existe por el mismo motivo que `fixtures-derivados.test.js`:     *
 * **una procedencia que nadie ejecuta es prosa**. Aquí se ejecuta en tres       *
 * direcciones:                                                                  *
 *                                                                              *
 *   1. QUE EL FICHERO SEA EL FICHERO. El SHA-256 se LEE de                      *
 *      `test/fixtures/gml/PROCEDENCIA.md` y se comprueba contra los bytes del   *
 *      disco, así que ni el fichero ni el documento pueden envejecer sin que    *
 *      esto se ponga rojo.                                                      *
 *   2. QUE TRAIGA EL CASO QUE PROMETE. Se pasa por `parsearGml` y `superficie`  *
 *      de verdad y se afirman las cifras de la ficha, una a una.                *
 *   3. ⭐ QUE LA ARITMÉTICA DEL CIERRE SEA LA QUE F17 VA A REPRODUCIR. La suma   *
 *      de las dos piezas que la Sede aceptó contra el shoelace de esta          *
 *      geometría deja un residuo de 0,0064 m², y esa cifra es la que obliga a   *
 *      que el comprobador de conjunto afirme con TOLERANCIA DECLARADA y no con  *
 *      un `==`. Escrita aquí, la decisión deja de ser una opinión del plan.     *
 *                                                                              *
 * ⛔ LO QUE ESTE FICHERO NO PUEDE COMPROBAR: el `.gml` de dos `featureMember`    *
 * que se subió NO está versionado (ver el último párrafo de su ficha en         *
 * `PROCEDENCIA.md`). Las superficies de las dos piezas se citan aquí desde la   *
 * tabla de `SPEC.md` §7.1, que es documentación, no un fichero medido. Mientras *
 * siga así, el punto 3 demuestra la ARITMÉTICA del cierre, no la geometría.     *
 *                                                                              *
 * Proyecto Vitest `node`.                                                       *
 * -------------------------------------------------------------------------- */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

import { parsearGml } from '../../gml/parse.js'
import { DIALECTO, TIPO_GML } from '../../gml/_comun.js'
import { TIPO_RECINTO } from '../../model/parcela.js'
import { superficie } from '../../geo/area.js'

// ── Arnés ────────────────────────────────────────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')
const DIR_FIXTURES = join(RAIZ, 'test', 'fixtures', 'gml')
const NOMBRE = 'cp_parcela_7136910UF1473N.gml'

/**
 * Lee normalizando a LF, por el mismo motivo que `fixtures-derivados.test.js`:
 * `.gitattributes` fija `eol=lf` para estos `.gml`, pero un árbol de trabajo
 * extraído con `core.autocrlf=true` puede tenerlos con CRLF, y entonces los
 * bytes del disco dependerían de la historia del checkout de cada uno.
 */
const leerLf = (nombre) => readFileSync(join(DIR_FIXTURES, nombre), 'utf8').replaceAll('\r\n', '\n')

const sha256 = (texto) => createHash('sha256').update(Buffer.from(texto, 'utf8')).digest('hex')

const PROCEDENCIA = readFileSync(join(DIR_FIXTURES, 'PROCEDENCIA.md'), 'utf8')
const TEXTO = leerLf(NOMBRE)
const LEIDO = parsearGml(TEXTO)
const PARCELA = LEIDO.parcelas[0]

/** Las dos piezas que la Sede aceptó, tal y como las publica `SPEC.md` §7.1. */
const PIEZAS_ENTREGADAS = Object.freeze([
  { localId: '7136910UF1473N', namespace: 'ES.SDGC.CP', areaValue: 445, shoelace: 445.34 },
  { localId: '7136910UF1473N.1', namespace: 'ES.LOCAL.CP', areaValue: 21, shoelace: 20.88 },
])

// ── 1 · El fichero es el fichero ─────────────────────────────────────────────

describe('el expediente de oro es el que su procedencia dice', () => {
  it('el SHA-256 que publica PROCEDENCIA.md es el de los bytes del disco', () => {
    // Se lee del documento, NO se escribe aquí: si alguien toca el fixture y no
    // toca la ficha (o al revés), esto sale rojo nombrando las dos cifras.
    const bloque = PROCEDENCIA.split(`## \`${NOMBRE}\``)[1]
    expect(bloque, `PROCEDENCIA.md no tiene la ficha de ${NOMBRE}`).toBeDefined()
    const declarado = bloque.match(/SHA-256 `([0-9a-f]{64})`/)?.[1]
    expect(declarado, 'la ficha no publica el SHA-256 del fichero guardado').toBeDefined()
    expect(sha256(TEXTO)).toBe(declarado)
  })

  it('la ficha publica también el SHA-256 del ORIGINAL con CRLF, que es otro', () => {
    // El fichero llega del WFS con CRLF y aquí se guarda con LF (`.gitattributes`).
    // Los dos hashes tienen que estar escritos y ser distintos: con uno solo no se
    // podría comprobar la descarga contra el original byte a byte.
    const bloque = PROCEDENCIA.split(`## \`${NOMBRE}\``)[1]
    const hashes = [...bloque.matchAll(/`([0-9a-f]{64})`/g)].map((m) => m[1])
    expect(hashes.length, 'la ficha tiene que publicar DOS hashes: original y guardado').toBe(2)
    expect(new Set(hashes).size).toBe(2)
    expect(hashes).toContain(sha256(TEXTO))
  })

  it('la ficha dice de qué stored query salió y por qué llamada', () => {
    const bloque = PROCEDENCIA.split(`## \`${NOMBRE}\``)[1]
    expect(bloque).toContain('STOREDQUERIE_ID=GetParcel')
    expect(bloque).toContain('urlGetParcel')
    expect(bloque).toContain('XMWPXCN9J8DB9J89')
  })
})

// ── 2 · Trae el caso que promete ─────────────────────────────────────────────

describe('el expediente de oro trae lo que F17 necesita medir', () => {
  it('es una descarga del WFS en CP 4.0, soportada y sin bloqueos', () => {
    expect(LEIDO.dialecto).toBe(DIALECTO.CP_4_0_WFS)
    expect(LEIDO.soportado).toBe(true)
    expect(LEIDO.resumen.bloqueos).toEqual([])
    expect(LEIDO.parcelas).toHaveLength(1)
  })

  it('es la parcela 7136910UF1473N, con la identidad de una parcela del Catastro', () => {
    // La pareja `localId`↔`namespace` es UNA afirmación y no dos ajustes
    // (`SPEC.md` §3.1, trampa 2). La matriz va bajo `ES.SDGC.CP`; la cesión que
    // salió de ella fue `ES.LOCAL.CP`, y de ese contraste vive el override O19.
    expect(PARCELA.refcat).toBe('7136910UF1473N')
    expect(PARCELA.localId).toBe('7136910UF1473N')
    expect(PARCELA.namespaceInspire).toBe('ES.SDGC.CP')
    expect(PARCELA.srs).toBe('EPSG:25830')
  })

  it('⭐ declara 466 m² y su shoelace da 466,2141: las dos cifras de la ficha', () => {
    expect(PARCELA.areaValue).toBe(466)
    expect(superficie(PARCELA.recintos)).toBeCloseTo(466.2141, 4)
  })

  it('es UN exterior de 12 vértices, sin huecos y HORARIO', () => {
    expect(PARCELA.recintos).toHaveLength(1)
    expect(PARCELA.recintos[0].tipo).toBe(TIPO_RECINTO.EXTERIOR)
    expect(PARCELA.recintos[0].vertices).toHaveLength(12)
    expect(PARCELA.nSurfaceMembers).toBe(1)
    expect(PARCELA.orientacion).toEqual([-1])
  })

  it('miente sobre su encoding, igual que la otra descarga del mismo servicio', () => {
    // Declara ISO-8859-1 y sus bytes son UTF-8. Que dos descargas independientes,
    // con nueve días de diferencia, mientan igual, dice que es del SERVICIO y no
    // de una descarga concreta. No se corrige: es el caso real del guardián.
    expect(TEXTO).toContain('encoding="ISO-8859-1"')
    expect(LEIDO.detecciones.map((d) => d.tipo)).toContain('ENCODING_DECLARADO')
  })

  it('⛔ el parcelario NO trae todavía la segregación, y por eso sirve', () => {
    // Descargado dos días DESPUÉS del IVG positivo, el Catastro sigue publicando
    // la matriz entera. Eso es exactamente lo que la aplicación tiene delante
    // cuando alguien deriva un sobrante: la geometría oficial es el ANTES.
    const matriz = PIEZAS_ENTREGADAS[0]
    expect(PARCELA.areaValue).not.toBe(matriz.areaValue)
    expect(PARCELA.areaValue).toBe(
      PIEZAS_ENTREGADAS.reduce((suma, p) => suma + p.areaValue, 0),
    )
  })
})

// ── 3 · ⭐ La aritmética del cierre que F17 tiene que reproducir ──────────────

describe('el cierre del conjunto: por qué la tolerancia se DECLARA', () => {
  const oficial = superficie(PARCELA.recintos)
  const entregado = PIEZAS_ENTREGADAS.reduce((suma, p) => suma + p.shoelace, 0)

  it('la suma de las dos piezas entregadas da los 466,22 de SPEC §7.1', () => {
    expect(entregado).toBeCloseTo(466.22, 2)
  })

  it('⛔ el residuo contra la geometría oficial NO es cero: son 0,00595 m²', () => {
    // Ruido de cuantización a 2 decimales sobre 466 m² con ~90 m de perímetro, no
    // un hueco. ESTA es la razón de que el comprobador de conjunto afirme con
    // tolerancia DECLARADA; un `==` sobre float64 redondeado saldría falso sobre
    // el único expediente que la Sede ha aceptado.
    //
    // ⚠️ `SPEC.md` §7.1 publica **0,0064** y aquí sale **0,00595**, y no es una
    // contradicción: aquella cifra se calculó con las superficies SIN REDONDEAR de
    // las dos piezas, y las que la ficha publica ya vienen redondeadas a 2
    // decimales (445,34 y 20,88). Reproducir el 0,0064 exigiría el `.gml` de dos
    // miembros que se subió, y ese fichero NO está versionado (ver la cabecera).
    // Los 0,00045 m² de diferencia entre las dos cuentas son 4,5 cm².
    //
    // Para lo que esta prueba defiende da igual cuál de las dos sea: las dos son
    // MAYORES QUE CERO, que es lo que mata al `==`.
    const residuo = Math.abs(entregado - oficial)
    expect(residuo).toBeGreaterThan(0)
    expect(residuo).toBeCloseTo(0.00595, 5)
    expect(residuo).toBeLessThan(0.01)
  })

  it('y la Sede lo dio por bueno: 466 en su panel, que es lo redondeado', () => {
    // La tercera fuente. `AFECTADAS 466 m²` en el panel del IVG coincide con el
    // `areaValue` del WFS y con el redondeo de nuestro shoelace: tres caminos
    // independientes al mismo entero.
    expect(Math.round(oficial)).toBe(466)
    expect(Math.round(entregado)).toBe(466)
    expect(PARCELA.areaValue).toBe(466)
  })
})

import { describe, expect, it } from 'vitest'

import {
  ASIENTOS,
  MARCA_NUESTRA,
  MARCA_VENDOR,
  REBANADAS,
  TECHO,
  bytes,
  comparar,
  informe,
  partirHoja,
} from '../../scripts/presupuesto-css.mjs'

// test/scripts/presupuesto-css.test.js — Rework de UI · T10.
//
// El medidor del presupuesto de la hoja se prueba como cualquier otro módulo de
// este repositorio, y por un motivo concreto: es un GUARDIÁN, y un guardián sin
// pruebas es una intención. Aquí se prueban las piezas puras —el corte
// nuestro/vendor, el contraste con el registro y el informe—; los cuatro
// caminos de E/S (sin `dist/`, `dist` viejo, dos hojas, y la costura rota) se
// verificaron por mutación sobre el artefacto real el 2026-08-04 y están
// anotados en `scripts/smoke-navegador/GUION.md` §21.

/** Una hoja de mentira con la misma FORMA que la de verdad: lo nuestro y detrás el vendor. */
const hoja = (nuestro, vendor) => `${nuestro}${MARCA_VENDOR}${vendor}`

describe('scripts/presupuesto-css · el corte entre lo nuestro y el vendor', () => {
  it('parte por la primera regla de leaflet.css y cuenta BYTES, no caracteres', () => {
    // La cabecera lleva acentos y una «ñ» a propósito: `estilos/app.css` está
    // lleno de comentarios en español, y contar `.length` en vez de bytes daría
    // una cifra menor que la del fichero que se descarga.
    const nuestro = '.gml-app{content:"añadido"}'
    const partido = partirHoja(hoja(nuestro, '{a:b}'))

    expect(partido.nuestro).toBe(Buffer.byteLength(nuestro, 'utf8'))
    expect(partido.nuestro).toBeGreaterThan(nuestro.length) // anti-vacuidad del párrafo de arriba
    expect(partido.total).toBe(partido.nuestro + partido.vendor)
  })

  it('se niega a medir si no encuentra la marca del vendor', () => {
    // Sin costura no hay reparto posible: dar el total entero como «nuestro»
    // sería una cifra plausible y falsa, que es peor que no medir.
    expect(() => partirHoja('.gml-app{color:red}')).toThrow(/no se puede separar/i)
  })

  it('se niega a medir si la marca aparece dos veces', () => {
    expect(() => partirHoja(hoja('.gml-a{}', `x${MARCA_VENDOR}y`))).toThrow(/aparece 2 veces/i)
  })

  it('se niega a medir si detrás del vendor quedan selectores nuestros', () => {
    // Que Leaflet vaya al final es un hecho MEDIDO en doce builds, no una
    // promesa de Vite. El día que Vite cambie el orden, esto sale rojo en vez
    // de atribuirle a este proyecto 15 kB que no ha escrito.
    expect(() => partirHoja(hoja('.gml-a{}', `.x{} ${MARCA_NUESTRA}b{}`))).toThrow(/ha dejado de ser el final/i)
  })
})

describe('scripts/presupuesto-css · el registro y el techo', () => {
  const ultimo = ASIENTOS[ASIENTOS.length - 1]
  const medir = (nuestro, vendor = 15095) => ({ total: nuestro + vendor, nuestro, vendor })

  it('está en verde cuando lo construido coincide con el último asiento', () => {
    const v = comparar({ total: ultimo.total, nuestro: ultimo.nuestro })
    expect(v.problemas).toEqual([])
    expect(v.ok).toBe(true)
  })

  it('sale ROJO cuando la hoja se mueve un solo byte sin anotarse', () => {
    const v = comparar({ total: ultimo.total + 1, nuestro: ultimo.nuestro + 1 })
    expect(v.ok).toBe(false)
    // El mensaje tiene que llevar las DOS cifras y el delta: sin ellas, quien
    // lo lea tiene que volver a medir a mano para saber qué anotar.
    expect(v.problemas[0]).toContain(ultimo.hito)
    expect(v.problemas[0]).toContain(bytes(ultimo.nuestro))
    expect(v.problemas[0]).toContain('+1 B')
  })

  it('NO exige el techo mientras queden rebanadas por cerrar (criterio 10)', () => {
    // El criterio dice literalmente que durante la migración puede subir. Hoy
    // la hoja está 3.949 B por encima del techo y eso NO es un fallo todavía.
    const v = comparar(medir(TECHO.nuestro + 10_000))
    expect(v.pendientes.length).toBeGreaterThan(0)
    expect(v.problemas.join(' ')).not.toContain('techo')
  })

  it('SÍ exige el techo en cuanto las cinco rebanadas están anotadas', () => {
    const cerradasTodas = REBANADAS.map((r, i) => ({
      hito: `hito ${i}`,
      commit: '0000000',
      rebanada: r,
      nota: 'de mentira',
      total: TECHO.total,
      nuestro: TECHO.nuestro,
      vendor: TECHO.total - TECHO.nuestro,
    }))
    const conUltimo = (nuestro) => [
      ...cerradasTodas.slice(0, -1),
      { ...cerradasTodas[cerradasTodas.length - 1], nuestro, total: nuestro + 15095 },
    ]

    // Justo EN el techo es rojo: el criterio dice «menos de», no «como mucho».
    const enElTecho = comparar(medir(TECHO.nuestro), { asientos: conUltimo(TECHO.nuestro) })
    expect(enElTecho.pendientes).toEqual([])
    expect(enElTecho.ok).toBe(false)
    expect(enElTecho.problemas.join(' ')).toContain('techo')

    // Un byte por debajo, verde.
    const porDebajo = comparar(medir(TECHO.nuestro - 1), { asientos: conUltimo(TECHO.nuestro - 1) })
    expect(porDebajo.problemas).toEqual([])
  })

  // ── ⛔ AQUÍ HUBO UN GUARDIÁN DE NO-DIVERGENCIA Y SE RETIRÓ EL 2026-08-08 ────
  //
  // Decía `expect(REBANADAS).toEqual([...PASOS])`, y existía porque las dos listas
  // están escritas a mano en dos ficheros (`scripts/` no puede importar
  // `app/navegacion.js` sin llevarse media aplicación a un script de tooling).
  //
  // **Se retira porque su premisa dejó de ser cierta, no para poner algo en
  // verde.** `REBANADAS` es el troceado del rework de UI —un proyecto de migración
  // que terminó, con su quinta rebanada SIN CERRAR a propósito— y `PASOS` es el
  // recorrido vivo de la aplicación. Coincidían porque el rework se organizó por
  // pantallas; el día que el rail bajó de cinco peldaños a tres, esta prueba
  // obligaba a reescribir el registro histórico **y**, de paso, cerraba las cinco
  // rebanadas y hacía exigible el techo del criterio 10 por un cambio de
  // navegación. El razonamiento entero está en `scripts/presupuesto-css.mjs`.
  //
  // Lo que SÍ seguía teniendo sentido de aquel guardián —cazar una errata en el
  // campo `rebanada` de un asiento— se conserva aquí abajo.
  it('cada asiento apunta a una rebanada que EXISTE, y la quinta sigue abierta', () => {
    for (const a of ASIENTOS) {
      if (a.rebanada === null) continue
      expect(REBANADAS, `el asiento «${a.hito}» cierra una rebanada que no existe`).toContain(
        a.rebanada,
      )
    }
    // ⚠️ Y la deuda declarada sigue declarada. Si algún día alguien cierra la
    // quinta, que sea porque ha bajado la hoja del techo y no de rebote: esta
    // línea le obliga a venir aquí a borrarla, y el `comparar` de al lado le va a
    // pedir los bytes.
    const cerradas = new Set(ASIENTOS.map((a) => a.rebanada).filter(Boolean))
    expect(cerradas.has('informe'), 'la quinta rebanada se ha cerrado sin anotarlo').toBe(false)
  })

  it('el techo ES la medición de F11, no un número aparte', () => {
    // La línea base del rework es el commit de F11: el criterio 10 pide acabar
    // por debajo de donde se empezó. Si alguien retoca el techo sin tocar el
    // asiento (o al revés), el presupuesto pasaría a medirse contra una cifra
    // que no corresponde a ninguna build.
    const f11 = ASIENTOS.find((a) => a.hito === 'F11')
    expect(f11).toBeDefined()
    expect({ total: f11.total, nuestro: f11.nuestro }).toEqual({ ...TECHO })
  })

  it('cada asiento cuadra y lleva su causa escrita', () => {
    expect(ASIENTOS.length).toBeGreaterThan(0)
    for (const a of ASIENTOS) {
      expect(a.vendor, `el asiento «${a.hito}» no cuadra`).toBe(a.total - a.nuestro)
      expect(a.nuestro, `el asiento «${a.hito}» no tiene parte nuestra`).toBeGreaterThan(0)
      // Un número sin causa no se puede revisar después, que es justo el
      // agujero que T10 viene a tapar.
      expect(a.nota.length, `el asiento «${a.hito}» no dice qué cambió`).toBeGreaterThan(20)
      expect(a.commit, `el asiento «${a.hito}» no dice de qué commit sale`).toMatch(
        /^(?:[0-9a-f]{7,40}|\(sin commitear\))$/,
      )
      if (a.rebanada !== null) expect(REBANADAS).toContain(a.rebanada)
    }
  })

  it('ninguna rebanada se cierra dos veces', () => {
    const cerradas = ASIENTOS.map((a) => a.rebanada).filter((r) => r !== null)
    expect(cerradas).toEqual([...new Set(cerradas)])
  })

  it('el vendor es el MISMO en los doce hitos medidos', () => {
    // Es el hecho que sostiene toda la corrección de T10: si Leaflet fuera
    // variable, no se podría decir que los saltos históricos son nuestros.
    const vendores = new Set(ASIENTOS.map((a) => a.vendor))
    expect([...vendores]).toEqual([15095])
  })
})

describe('scripts/presupuesto-css · lo que se imprime', () => {
  it('publica las tres cifras y dice cuál es la presupuestada', () => {
    const medido = { total: 61108, nuestro: 46013, vendor: 15095 }
    const texto = informe(medido, comparar(medido))

    expect(texto).toContain(bytes(medido.total))
    expect(texto).toContain(bytes(medido.nuestro))
    expect(texto).toContain(bytes(medido.vendor))
    expect(texto).toContain('Leaflet')
    expect(texto).toContain('El techo NO se exige')
  })

  it('escribe los millares como el resto del repositorio, también a cuatro cifras', () => {
    // En español el separador de millares NO se pone por defecto en números de
    // cuatro cifras: sin `useGrouping: 'always'` esto diría «3949 B» al lado de
    // «61.108 B» y parecerían de sitios distintos.
    expect(bytes(3949)).toBe('3.949 B')
    expect(bytes(61108)).toBe('61.108 B')
    expect(bytes(-3949)).toBe('-3.949 B')
  })
})

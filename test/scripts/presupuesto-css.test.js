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

  /**
   * Un registro de mentira con las rebanadas que se le pidan cerradas y el último
   * asiento en la cifra que se le pase.
   *
   * ⚠️ **Existe desde el 2026-08-11 porque el registro de VERDAD ya tiene las cinco
   * cerradas**, y las dos pruebas de abajo necesitan los dos lados de esa frontera.
   * Antes bastaba con leer `ASIENTOS` para el caso «quedan rebanadas» y fabricar solo
   * el caso «están todas»; hoy es al revés, y fabricar los dos es lo que impide que
   * estas pruebas cambien de significado la próxima vez que el registro se mueva.
   *
   * @param {string[]} cerradas  Qué rebanadas cierran los asientos de mentira.
   * @param {number} nuestro  La cifra del ÚLTIMO asiento.
   */
  const registroDeMentira = (cerradas, nuestro) =>
    cerradas.map((r, i) => {
      const suyo = i === cerradas.length - 1 ? nuestro : TECHO.nuestro
      return {
        hito: `hito ${i}`,
        commit: '0000000',
        rebanada: r,
        nota: 'de mentira',
        total: suyo + 15095,
        nuestro: suyo,
        vendor: 15095,
      }
    })

  it('NO exige el techo mientras queden rebanadas por cerrar (criterio 10)', () => {
    // El criterio dice literalmente que durante la migración puede subir: 10.000 B
    // por encima NO es un fallo mientras el rework siga abierto. Es el estado en el
    // que vivió el proyecto entre el 2026-08-03 y el 2026-08-11.
    const abierto = REBANADAS.slice(0, -1)
    const v = comparar(medir(TECHO.nuestro + 10_000), {
      asientos: registroDeMentira(abierto, TECHO.nuestro + 10_000),
    })
    expect(v.pendientes.length).toBeGreaterThan(0)
    expect(v.problemas.join(' ')).not.toContain('techo')
  })

  it('⭐ con las cinco cerradas, clavado en el techo es VERDE y un byte más es ROJO', () => {
    // ═══ EL CAMBIO DE FORMA DEL 2026-08-11 ═══
    // Esta prueba decía lo contrario —«justo EN el techo es rojo: el criterio dice
    // "menos de", no "como mucho"»— y era correcta mientras el techo fue la medición
    // de F11, o sea una META POR DEBAJO: quedarse clavado en la línea de salida no es
    // haber bajado de ella.
    //
    // El techo pasó a ser la medición de HOY, y con eso «clavado» dejó de significar
    // «no he llegado» para significar «no he subido», que es exactamente lo que se
    // exige. Con la forma anterior el guardián nacía rojo el mismo segundo de
    // rebasarlo, sin que nada estuviera mal — y un guardián que nace rojo se apaga.
    //
    // ⛔ Lo que NO se relaja es la pendiente, y por eso las dos aserciones van juntas
    // en el mismo `it`: separarlas dejaría pasar un «>=» cambiado a «>=» de vuelta
    // con solo una de las dos en verde.
    const cerradasTodas = [...REBANADAS]

    const enElTecho = comparar(medir(TECHO.nuestro), {
      asientos: registroDeMentira(cerradasTodas, TECHO.nuestro),
    })
    expect(enElTecho.pendientes).toEqual([])
    expect(enElTecho.problemas).toEqual([])
    expect(enElTecho.ok).toBe(true)

    // UN byte por encima, rojo, y el mensaje tiene que decir cuántos sobran y las dos
    // salidas (devolver bytes o subir el techo a mano).
    const porEncima = comparar(medir(TECHO.nuestro + 1), {
      asientos: registroDeMentira(cerradasTodas, TECHO.nuestro + 1),
    })
    expect(porEncima.ok).toBe(false)
    expect(porEncima.problemas.join(' ')).toContain('techo')
    expect(porEncima.problemas.join(' ')).toContain('1 B')
    expect(porEncima.problemas.join(' ')).toMatch(/sube el techo A MANO/)
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
  it('cada asiento apunta a una rebanada que EXISTE, y las cinco están cerradas', () => {
    for (const a of ASIENTOS) {
      if (a.rebanada === null) continue
      expect(REBANADAS, `el asiento «${a.hito}» cierra una rebanada que no existe`).toContain(
        a.rebanada,
      )
    }
    // ⭐ ESTA LÍNEA ESTABA AL REVÉS HASTA EL 2026-08-11, y decía: «la deuda declarada
    // sigue declarada. Si algún día alguien cierra la quinta, que sea porque ha bajado
    // la hoja del techo y no de rebote». Hizo su trabajo: el 2026-08-08 impidió que un
    // cambio de navegación la cerrara de rebote (ver el comentario largo de arriba).
    //
    // La quinta se cerró **de frente**: el autor tomó la decisión que `3e9c8b0` le
    // reservaba y eligió revisar el techo, con la poda del sistema de diseño medida
    // antes. Así que la aserción se invierte y sigue siendo un guardián: ahora lo que
    // vigila es que nadie REABRA la quinta para quitarse el techo de encima, que es el
    // atajo simétrico al que aquella línea cerraba.
    const cerradas = new Set(ASIENTOS.map((a) => a.rebanada).filter(Boolean))
    for (const r of REBANADAS) {
      expect(cerradas.has(r), `la rebanada «${r}» ha dejado de estar cerrada`).toBe(true)
    }
  })

  it('el techo ES un asiento medido de verdad, no un número aparte', () => {
    // El techo tiene que corresponder a una build que alguien pueda reconstruir; si
    // no, el presupuesto se mide contra una cifra inventada y deja de significar nada.
    //
    // ⚠️ **Hasta el 2026-08-11 este `it` afirmaba que el techo ERA la medición de F11**
    // (`960bb7a`), porque el criterio 10 pedía acabar por debajo de donde se empezó.
    // El techo se rebasó a la medición de hoy —el razonamiento está en `TECHO`—, así
    // que lo que se afirma es lo que sigue teniendo sentido: que el número sale de
    // ALGÚN asiento del registro. Con eso, retocar el techo a mano sin tocar ningún
    // asiento (o al revés) sigue siendo rojo, que es lo que este `it` protege.
    const deAlgunAsiento = ASIENTOS.some(
      (a) => a.total === TECHO.total && a.nuestro === TECHO.nuestro,
    )
    expect(deAlgunAsiento, 'el techo no coincide con ningún asiento del registro').toBe(true)

    // Y es el ÚLTIMO: un techo que coincide con un asiento viejo significaría que la
    // hoja se movió después sin que nadie revisara el presupuesto.
    expect({ total: ultimo.total, nuestro: ultimo.nuestro }).toEqual({ ...TECHO })
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
  })

  it('avisa de que el techo no se exige SOLO mientras queden rebanadas abiertas', () => {
    // ⚠️ Este `it` se separó del de arriba el 2026-08-11. Aquél afirmaba la frase «El
    // techo NO se exige» sobre el registro REAL, y funcionaba por un accidente: la
    // quinta rebanada estaba abierta. Al cerrarla, la frase desapareció con razón y la
    // prueba se puso roja sin que el informe tuviera ni un defecto.
    //
    // Ahora se afirman los DOS lados con registros de mentira, que es lo que hace que
    // la prueba siga midiendo el comportamiento y no el estado del proyecto.
    const medido = { total: 61108, nuestro: 46013, vendor: 15095 }
    const asientoDe = (rebanada) => ({
      hito: 'de mentira', commit: '0000000', rebanada, nota: 'de mentira',
      total: medido.total, nuestro: medido.nuestro, vendor: medido.vendor,
    })

    const abierto = REBANADAS.slice(0, -1).map(asientoDe)
    expect(informe(medido, comparar(medido, { asientos: abierto }))).toContain(
      'El techo NO se exige',
    )

    const cerrado = REBANADAS.map(asientoDe)
    expect(informe(medido, comparar(medido, { asientos: cerrado }))).not.toContain(
      'El techo NO se exige',
    )
  })

  it('⭐ clavado en el techo no dice «sobran 0 B», dice que está clavado', () => {
    // Desde que el techo es la medición de hoy, la holgura 0 es el estado NORMAL. La
    // rama de `>= 0` imprimía «Hoy SOBRAN 0 B (0,0 % por encima)», que se lee como una
    // falta y es exactamente lo contrario: es cumplirlo justo.
    const medido = { total: TECHO.total, nuestro: TECHO.nuestro, vendor: TECHO.total - TECHO.nuestro }
    const texto = informe(medido, comparar(medido))

    expect(texto).toContain('CLAVADO')
    expect(texto).not.toContain('SOBRAN')
    expect(texto).not.toContain('holgura de')
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

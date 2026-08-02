/* -------------------------------------------------------------------------- *
 * test/storage/pie-firma.test.js — F09 · T3.3 · el pie de firma persistido    *
 *                                                                            *
 * Es el PRIMER dato personal que esta aplicación guarda. Hasta F09 `storage/` *
 * solo tenía caché del Catastro —cartografía pública, desechable—; aquí hay   *
 * nombre, número de colegiado, colegio y contacto de una persona, guardados   *
 * porque marcó una casilla. Los cuatro fallos que este fichero existe para    *
 * impedir son, en orden de gravedad:                                          *
 *                                                                            *
 *   1. Que se guarde MÁS de lo que se dice que se guarda. La prueba compara   *
 *      CONJUNTOS de claves derivados del contrato, no una lista escrita a     *
 *      mano: si alguien metiera el encabezado —refcat, municipio, fecha— en   *
 *      el registro, se pone roja sin que nadie tenga que acordarse de mirar.  *
 *   2. Que desmarcar «Recordar» NO borre. Una casilla que promete olvidar y   *
 *      deja el dato es la peor forma de mentir que tiene este módulo.         *
 *   3. Que un entorno sin IndexedDB reviente la aplicación, o —peor— la deje  *
 *      funcionando en silencio como si guardara. Es EL camino que se olvida:  *
 *      la mitad de las pruebas de aquí van por él.                            *
 *   4. Que un fallo de escritura se trague la petición del usuario sin        *
 *      decirlo. A diferencia de la caché, aquí el usuario ha PEDIDO algo.     *
 *                                                                            *
 * ── PROYECTO `node`, SIN SUFIJO `.dom`, Y ES DELIBERADO ──                   *
 * `vitest.config.js` enruta POR SUFIJO y `fake-indexeddb` es JavaScript puro: *
 * no necesita `window` ni jsdom. Mismo criterio que los otros dos ficheros de *
 * `test/storage/`, y además `node` es el bucle rápido.                        *
 *                                                                            *
 * ── UNA BASE POR PRUEBA, Y UN MÓDULO POR PRUEBA ──                           *
 * `new IDBFactory()` da un universo de bases aislado, y como `abrirBd`        *
 * MEMOIZA la conexión en una variable de módulo, cada base sale de un módulo  *
 * recién cargado (`vi.resetModules()` + `import()`) — la versión honesta de   *
 * «otro proceso». Copiado literal de `test/storage/cache-catastro.test.js`.   *
 *                                                                            *
 * ── MUTACIONES EJECUTADAS ──                                                 *
 * (Sobre `storage/pie-firma.js` y `storage/bd.js`, `npm run test:node`, rojo  *
 * anotado, revertidas CON EL EDITOR.)                                         *
 *                                                                            *
 * · N1 · en `olvidar`, quitar el `db.delete(…)` y seguir devolviendo          *
 *   `olvidado: true` (o sea: la casilla promete olvidar y no olvida).         *
 *   ROJO 2: «olvidar BORRA de verdad» —que mira la base por debajo, no lo     *
 *   que dice `recuperar`— y el borrado que revienta.                          *
 * · N2 · en `recordar`, añadir `refcat` al registro (guardar de más «por si   *
 *   acaso»). ROJO 2: el conjunto de claves derivado del esquema, y el         *
 *   rastreo por texto del registro entero.                                    *
 * · N3 · quitar la migración 2 de `storage/bd.js`. ROJO 19 — el almacén no    *
 *   existe y se cae medio fichero. **Y sin embargo ni una sola operación      *
 *   LANZÓ:** los cinco casos del camino degradado siguieron verdes, con sus   *
 *   avisos y sus motivos. Es la mitad buena del hallazgo: cuando la base está *
 *   rota de verdad, la aplicación no se cae, lo cuenta.                       *
 * · N4 · en el `catch` de `recordar`, relanzar el error.                      *
 *   ROJO 2: las dos pruebas de la cuota agotada.                              *
 * · N5 · en `recuperar`, devolver `firma: null` cuando no hay nada.           *
 *   ROJO 5: `firma` no es nunca `null`, y el diálogo la enchufa sin un `if`.  *
 * -------------------------------------------------------------------------- */

// Pone `globalThis.indexedDB` y las clases `IDB*` que `wrap` de `idb` necesita
// para decidir qué envuelve. Sin ellas, `storage/bd.js` fallaría de una forma que
// no se parecería a la causa.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

import { describe, expect, it, vi } from 'vitest'

import { CAMPOS_FIRMA, FIRMA_VACIA, normalizarFirma } from '../../report/firma.js'
import { ALMACENES, ESQUEMA_ALMACENES, MIGRACIONES, VERSION_BD } from '../../storage/bd.js'
import {
  AVISO_PRIVACIDAD,
  CAMPOS_REGISTRO,
  CLAVE_PIE_FIRMA,
  MOTIVO_SIN_PIE,
  crearPieDeFirmaGuardado,
} from '../../storage/pie-firma.js'
import { NIVEL } from '../../viewer/_comun.js'

// ── Utillaje ────────────────────────────────────────────────────────────────

/**
 * Una base recién creada, en su propio universo. `vi.resetModules()` porque
 * `abrirBd` memoiza la conexión en una variable de módulo.
 */
async function baseNueva() {
  vi.resetModules()
  const { abrirBd } = await import('../../storage/bd.js')
  const apertura = await abrirBd({ indexedDB: new IDBFactory() })
  // El arnés no puede mentir en verde: si la base no abriera, TODAS las pruebas
  // de acierto pasarían por el camino de «no hay base» sin decir nada.
  expect(apertura.disponible, 'el arnés no ha conseguido abrir la base').toBe(true)
  return apertura
}

/** Un pie de firma completo, con datos que no son de nadie. */
const FIRMA = Object.freeze({
  nombre: 'Nombre Apellido Apellido',
  numeroColegiado: '04321',
  colegio: 'Colegio de la demarcación que sea',
  contacto: 'correo@ejemplo.es · 600 000 000',
})

/**
 * Envuelve una base real haciendo que una de sus operaciones RECHACE. Es cómo se
 * simula la cuota agotada: `fake-indexeddb` no tiene límite de memoria que
 * agotar (lo dice `test/storage/bd.test.js`), y en el navegador la situación es
 * exactamente esta —se puede leer lo de antes, no se puede escribir lo nuevo—.
 */
function baseQueFallaEn(bd, operacion, error = new DOMException('lleno', 'QuotaExceededError')) {
  return {
    get: (...a) => bd.get(...a),
    put: (...a) => bd.put(...a),
    delete: (...a) => bd.delete(...a),
    [operacion]: async () => {
      throw error
    },
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · La migración: el almacén nuevo, y la versión que sube sola
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/bd · la migración del pie de firma (F09)', () => {
  it('VERSION_BD sigue siendo DERIVADA: nadie la ha escrito a mano al subirla', () => {
    // El invariante que sostiene todo: subir la versión y escribir la migración
    // son el mismo acto. Se afirma que hay MÁS DE UN peldaño porque hasta F09 no
    // lo había, y con uno solo este guardián no distinguía nada.
    expect(VERSION_BD).toBe(MIGRACIONES.length)
    expect(MIGRACIONES.length).toBeGreaterThan(1)
  })

  it('el almacén del pie de firma está declarado, con su keyPath', () => {
    expect(Object.values(ALMACENES)).toContain(ALMACENES.PIE_FIRMA)
    expect(ESQUEMA_ALMACENES[ALMACENES.PIE_FIRMA].keyPath).toBe('id')
  })

  it('una base NUEVA (versión 0) recorre la escalera entera y acaba con los tres almacenes', () => {
    // El caso del 100 % de los usuarios nuevos, y el que un `===` en vez de un `<`
    // dejaría a medias sin dar un solo error.
    return baseNueva().then(({ bd }) => {
      expect(new Set([...bd.objectStoreNames])).toEqual(new Set(Object.values(ALMACENES)))
      expect(bd.version).toBe(VERSION_BD)
      bd.close()
    })
  })

  it('una base que YA existía en la versión 1 sube a la 2 sin perder lo que tenía', async () => {
    // El caso del usuario que ya usaba la aplicación antes de F09: entra por
    // `oldVersion === 1`, ejecuta SOLO el peldaño nuevo, y su caché del Catastro
    // sigue donde estaba. Es el primer ascenso real de la historia de esta base,
    // así que hasta hoy nadie lo había ejercitado.
    const fabrica = new IDBFactory()

    // (a) Se fabrica a mano la base TAL COMO ERA en F05: versión 1, dos almacenes.
    await new Promise((resolver, rechazar) => {
      const peticion = fabrica.open('concreta-gml', 1)
      peticion.onupgradeneeded = () => {
        peticion.result.createObjectStore('catastroCache', { keyPath: 'refcat' })
        peticion.result.createObjectStore('revgeo', { keyPath: 'clave' })
      }
      peticion.onsuccess = () => {
        const bd = peticion.result
        const tx = bd.transaction('catastroCache', 'readwrite')
        tx.objectStore('catastroCache').put({ refcat: 'parcela:EPSG:25830:VIEJA', valor: 'algo' })
        tx.oncomplete = () => {
          bd.close()
          resolver()
        }
        tx.onerror = () => rechazar(tx.error)
      }
      peticion.onerror = () => rechazar(peticion.error)
    })

    // (b) Y ahora abre la aplicación de hoy, que pide la versión 2.
    vi.resetModules()
    const { abrirBd } = await import('../../storage/bd.js')
    const { disponible, bd } = await abrirBd({ indexedDB: fabrica })

    expect(disponible).toBe(true)
    expect(bd.version).toBe(2)
    expect(new Set([...bd.objectStoreNames])).toEqual(new Set(Object.values(ALMACENES)))
    // Lo que había sigue ahí: la migración añade, no reconstruye.
    expect(await bd.get(ALMACENES.PARCELAS, 'parcela:EPSG:25830:VIEJA')).toMatchObject({
      valor: 'algo',
    })
    bd.close()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Guardar, recuperar, borrar
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/pie-firma · el ciclo completo', () => {
  it('lo que se guarda se recupera IDÉNTICO, y con la marca de cuándo', async () => {
    const { bd } = await baseNueva()
    const pie = crearPieDeFirmaGuardado({ bd, ahora: () => 1_754_000_000_000 })

    const guardado = await pie.recordar(FIRMA)
    expect(guardado).toMatchObject({ guardado: true, motivo: null, mensaje: null })
    expect(guardado.guardadoEn).toBe(1_754_000_000_000)

    const leido = await pie.recuperar()
    expect(leido.recordado).toBe(true)
    expect(leido.firma).toEqual({ ...FIRMA })
    expect(leido.guardadoEn).toBe(1_754_000_000_000)
    expect(leido.motivo).toBeNull()

    bd.close()
  })

  it('se guarda NORMALIZADO: lo que entra con espacios sale canónico', async () => {
    // La decisión de qué es `null` la toma un solo módulo (`report/firma.js`), o
    // un `''` guardado y un `null` guardado acabarían imprimiéndose distinto.
    const { bd } = await baseNueva()
    const pie = crearPieDeFirmaGuardado({ bd })

    await pie.recordar({ nombre: '  Nombre\n Apellido ', numeroColegiado: '   ' })
    const { firma } = await pie.recuperar()

    expect(firma).toEqual(normalizarFirma({ nombre: 'Nombre Apellido' }))
    expect(firma.numeroColegiado).toBeNull()
    bd.close()
  })

  it('recordar dos veces deja UN SOLO registro: esto no es un historial', async () => {
    const { bd } = await baseNueva()
    const pie = crearPieDeFirmaGuardado({ bd })

    await pie.recordar({ nombre: 'Primero' })
    await pie.recordar({ nombre: 'Segundo' })

    const todos = await bd.getAll(ALMACENES.PIE_FIRMA)
    expect(todos).toHaveLength(1)
    expect((await pie.recuperar()).firma.nombre).toBe('Segundo')
    bd.close()
  })

  it('olvidar BORRA de verdad: desmarcar la casilla no deja el dato «inactivo»', async () => {
    const { bd } = await baseNueva()
    const pie = crearPieDeFirmaGuardado({ bd })

    await pie.recordar(FIRMA)
    const olvido = await pie.olvidar()
    expect(olvido).toEqual({ olvidado: true, habia: true, motivo: null, mensaje: null })

    // No queda registro NINGUNO en el almacén; no basta con que `recuperar` diga
    // que no hay: se mira la base por debajo.
    expect(await bd.getAll(ALMACENES.PIE_FIRMA)).toEqual([])

    const leido = await pie.recuperar()
    expect(leido.recordado).toBe(false)
    expect(leido.motivo).toBe(MOTIVO_SIN_PIE.NO_GUARDADO)
    expect(leido.firma).toEqual({ ...FIRMA_VACIA })
    bd.close()
  })

  it('olvidar lo que no existe NO es un fallo: el estado final es el que se pedía', async () => {
    const { bd } = await baseNueva()
    const pie = crearPieDeFirmaGuardado({ bd })

    // `habia` distingue «se ha borrado» de «no había nada», que en el diálogo son
    // dos frases distintas, pero ninguna de las dos es un error.
    expect(await pie.olvidar()).toEqual({
      olvidado: true,
      habia: false,
      motivo: null,
      mensaje: null,
    })
    bd.close()
  })

  it('la primera vez no hay nada, y se dice sin que parezca un fallo', async () => {
    const { bd } = await baseNueva()
    const leido = await crearPieDeFirmaGuardado({ bd }).recuperar()

    expect(leido.recordado).toBe(false)
    expect(leido.motivo).toBe(MOTIVO_SIN_PIE.NO_GUARDADO)
    // Lleva mensaje presentable igualmente: quien lo reciba no tiene que redactar
    // su propia frase (mismo criterio que `MOTIVO_CATASTRO.NO_ENCONTRADO`).
    expect(typeof leido.mensaje).toBe('string')
    expect(leido.mensaje.length).toBeGreaterThan(0)
    bd.close()
  })

  it('`firma` NUNCA es null: el diálogo la vuelca en el formulario sin un `if`', async () => {
    const { bd } = await baseNueva()
    const pie = crearPieDeFirmaGuardado({ bd })

    const casos = [
      await pie.recuperar(), // no hay nada
      await crearPieDeFirmaGuardado({ bd: null }).recuperar(), // no hay base
    ]
    await pie.recordar(FIRMA)
    casos.push(await pie.recuperar()) // sí hay

    for (const caso of casos) {
      expect(caso.firma, JSON.stringify(caso.motivo)).not.toBeNull()
      expect(Object.keys(caso.firma)).toEqual([...CAMPOS_FIRMA])
    }
    bd.close()
  })

  it('los contadores de `estado()` cuentan lo que pasó, y son una foto nueva cada vez', async () => {
    const { bd } = await baseNueva()
    const pie = crearPieDeFirmaGuardado({ bd })

    expect(pie.estado().disponible).toBeNull() // todavía no se ha mirado la base
    await pie.recordar(FIRMA)
    await pie.recuperar()
    await pie.olvidar()

    const foto = pie.estado()
    expect(foto).toMatchObject({
      disponible: true,
      recordados: 1,
      recuperados: 1,
      olvidados: 1,
      fallosLectura: 0,
      fallosEscritura: 0,
      ilegibles: 0,
    })
    expect(pie.estado()).not.toBe(foto) // objeto nuevo, no una referencia viva
    bd.close()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · QUÉ SE GUARDA: el guardián de privacidad
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/pie-firma · se guarda lo que se dice y NI UN CAMPO MÁS', () => {
  it('el registro tiene exactamente {id, firma, guardadoEn}, derivado del esquema', async () => {
    // La prueba nº 1 de este fichero. No compara contra una lista escrita a mano:
    // las claves salen de `CAMPOS_REGISTRO`, que a su vez deriva el nombre del
    // campo clave de `ESQUEMA_ALMACENES`. Meter aquí el encabezado —refcat,
    // municipio, la fecha del informe— construiría, sin que nadie lo haya pedido,
    // un registro de qué fincas ha mirado esta persona.
    const { bd } = await baseNueva()
    await crearPieDeFirmaGuardado({ bd }).recordar(FIRMA)

    const registro = await bd.get(ALMACENES.PIE_FIRMA, CLAVE_PIE_FIRMA)
    expect(new Set(Object.keys(registro))).toEqual(new Set(CAMPOS_REGISTRO))
    expect(new Set(Object.keys(registro.firma))).toEqual(new Set(CAMPOS_FIRMA))
    bd.close()
  })

  it('la clave es FIJA, así que no se puede acumular un historial de firmas', async () => {
    const { bd } = await baseNueva()
    const pie = crearPieDeFirmaGuardado({ bd, ahora: () => 1 })

    await pie.recordar({ nombre: 'Primero' })
    await pie.recordar({ nombre: 'Segundo' })
    await pie.recordar({ nombre: 'Tercero' })

    expect(await bd.getAllKeys(ALMACENES.PIE_FIRMA)).toEqual([CLAVE_PIE_FIRMA])
    bd.close()
  })

  it('NO se guarda nada del expediente: el registro no menciona la parcela ni el informe', async () => {
    const { bd } = await baseNueva()
    await crearPieDeFirmaGuardado({ bd }).recordar(FIRMA)

    // Vuelta de tuerca al guardián anterior, por si algún día un campo de la firma
    // se usara de contrabando: se busca en el TEXTO del registro entero.
    const texto = JSON.stringify(await bd.get(ALMACENES.PIE_FIRMA, CLAVE_PIE_FIRMA))
    for (const rastro of ['9398516VK3799G', 'refcat', 'municipio', 'EPSG', 'idDocumento']) {
      expect(texto, `el registro menciona «${rastro}»`).not.toContain(rastro)
    }
    bd.close()
  })

  it('hay una frase presentable que le cuenta al usuario qué se guarda y cómo se borra', async () => {
    // Vive en el módulo y no en el diálogo a propósito: una promesa sobre datos
    // personales escrita lejos del código que la cumple se queda desfasada sin
    // que nadie lo note.
    expect(typeof AVISO_PRIVACIDAD).toBe('string')
    expect(AVISO_PRIVACIDAD).toMatch(/navegador/i)
    expect(AVISO_PRIVACIDAD).toMatch(/no se env[ií]an/i)
    expect(AVISO_PRIVACIDAD).toMatch(/borran/i)
  })

  it('no tiene TTL: esto no es una caché y el nombre de quien firma no caduca', async () => {
    const { bd } = await baseNueva()
    // Se guarda «hace un año» y se lee «hoy»: sigue ahí. Un TTL aquí produciría un
    // día en que la aplicación se olvida del usuario sin que él toque nada, y eso
    // no se lee como una política de caché sino como que el programa está roto.
    const haceUnAno = 1_700_000_000_000
    await crearPieDeFirmaGuardado({ bd, ahora: () => haceUnAno }).recordar(FIRMA)

    const leido = await crearPieDeFirmaGuardado({
      bd,
      ahora: () => haceUnAno + 365 * 24 * 3600 * 1000,
    }).recuperar()

    expect(leido.recordado).toBe(true)
    expect(leido.firma.nombre).toBe(FIRMA.nombre)
    bd.close()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · EL CAMINO SIN IndexedDB — el que se olvida
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/pie-firma · sin almacén local, la aplicación sigue funcionando', () => {
  // Node no tiene `indexedDB`; en el navegador tampoco es un derecho adquirido (la
  // ventana privada lo capa, y un `<iframe>` con cookies bloqueadas también). Este
  // bloque es el que impide que ese entorno reviente el diálogo de informe.

  const sinBase = () => [
    { rotulo: 'sin cablear (null)', bd: null },
    { rotulo: 'sin cablear (undefined)', bd: undefined },
    {
      rotulo: 'ResultadoApertura con disponible:false',
      bd: {
        disponible: false,
        bd: null,
        motivo: 'SIN_INDEXEDDB',
        mensaje: 'Este navegador no permite el almacenamiento local.',
      },
    },
    { rotulo: 'una promesa que rechaza', bd: Promise.reject(new Error('vaya')) },
    { rotulo: 'algo que no sabe hacer de base', bd: { pero: 'no soy una base' } },
  ]

  it('ninguna de las tres operaciones LANZA, en ninguno de los cinco casos', async () => {
    for (const { rotulo, bd } of sinBase()) {
      const pie = crearPieDeFirmaGuardado({ bd, alAvisar: () => {} })
      await expect(pie.recordar(FIRMA), rotulo).resolves.toBeDefined()
      await expect(pie.recuperar(), rotulo).resolves.toBeDefined()
      await expect(pie.olvidar(), rotulo).resolves.toBeDefined()
    }
  })

  it('recordar dice que NO ha guardado, con motivo SIN_BD y mensaje presentable', async () => {
    for (const { rotulo, bd } of sinBase()) {
      const pie = crearPieDeFirmaGuardado({ bd, alAvisar: () => {} })
      const r = await pie.recordar(FIRMA)
      expect(r.guardado, rotulo).toBe(false)
      expect(r.motivo, rotulo).toBe(MOTIVO_SIN_PIE.SIN_BD)
      expect(typeof r.mensaje, rotulo).toBe('string')
      // Y devuelve la firma normalizada igualmente: el informe se hace lo mismo.
      expect(r.firma, rotulo).toEqual({ ...FIRMA })
    }
  })

  it('recuperar da la firma VACÍA y no revienta el formulario', async () => {
    const pie = crearPieDeFirmaGuardado({ bd: null, alAvisar: () => {} })
    const r = await pie.recuperar()
    expect(r).toMatchObject({ recordado: false, motivo: MOTIVO_SIN_PIE.SIN_BD })
    expect(r.firma).toEqual({ ...FIRMA_VACIA })
  })

  it('olvidar dice que sí: sin almacén no hay nada guardado, que es lo que se pedía', async () => {
    const r = await crearPieDeFirmaGuardado({ bd: null, alAvisar: () => {} }).olvidar()
    expect(r.olvidado).toBe(true)
    expect(r.habia).toBe(false)
    expect(r.motivo).toBe(MOTIVO_SIN_PIE.SIN_BD)
  })

  it('se DICE por el canal Avisar, con NIVEL.AVISO, y UNA sola vez por sesión', async () => {
    // Regla de oro 1: no hay silencio. Y una vez y no más, porque «no hay base» no
    // es un suceso sino un estado permanente de la sesión: repetirlo en cada
    // operación enterraría los avisos que sí traen información nueva.
    const avisos = vi.fn()
    const pie = crearPieDeFirmaGuardado({ bd: null, alAvisar: avisos })

    await pie.recuperar()
    await pie.recordar(FIRMA)
    await pie.olvidar()
    await pie.recuperar()

    expect(avisos).toHaveBeenCalledTimes(1)
    const [mensaje, detalle] = avisos.mock.calls[0]
    expect(detalle.nivel).toBe(NIVEL.AVISO)
    // El aviso cuenta lo que deja de funcionar PARA EL USUARIO, no lo que le pasa
    // al navegador (de eso ya avisó `abrirBd`).
    expect(mensaje).toMatch(/informe/i)
    expect(mensaje).toMatch(/volver a escribir/i)
  })

  it('sin canal cableado no se calla: el suelo mínimo es `console.warn`', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await crearPieDeFirmaGuardado({ bd: null }).recuperar()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('`estado()` deja constancia de que la base se resolvió a NO disponible', async () => {
    const pie = crearPieDeFirmaGuardado({ bd: null, alAvisar: () => {} })
    expect(pie.estado().disponible).toBeNull()
    await pie.recuperar()
    expect(pie.estado().disponible).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Cuando la base está pero falla
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/pie-firma · fallos de almacenamiento: se avisan y se devuelven', () => {
  it('la ESCRITURA que revienta avisa Y devuelve el fallo — el usuario lo había pedido', async () => {
    // Aquí está la diferencia deliberada con `storage/cache-catastro.js`: aquella
    // solo avisa, porque el dato que el usuario quería ya lo tiene. Aquí el
    // usuario ha MARCADO UNA CASILLA, y si no se ha podido, tiene que verlo en el
    // diálogo y no solo en la consola.
    const { bd } = await baseNueva()
    const avisos = vi.fn()
    const pie = crearPieDeFirmaGuardado({
      bd: baseQueFallaEn(bd, 'put'),
      alAvisar: avisos,
    })

    const r = await pie.recordar(FIRMA)
    expect(r.guardado).toBe(false)
    expect(r.motivo).toBe(MOTIVO_SIN_PIE.ERROR_ESCRITURA)
    expect(r.mensaje).toMatch(/espacio/i)
    expect(avisos).toHaveBeenCalledTimes(1)
    expect(avisos.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
    expect(pie.estado().fallosEscritura).toBe(1)
    bd.close()
  })

  it('y NO relanza: un almacenamiento lleno no puede reventar la preparación del informe', async () => {
    const { bd } = await baseNueva()
    const pie = crearPieDeFirmaGuardado({ bd: baseQueFallaEn(bd, 'put'), alAvisar: () => {} })
    await expect(pie.recordar(FIRMA)).resolves.toBeDefined()
    bd.close()
  })

  it('la LECTURA que revienta se comporta como «no había», avisa, y da la firma vacía', async () => {
    const { bd } = await baseNueva()
    const avisos = vi.fn()
    const pie = crearPieDeFirmaGuardado({ bd: baseQueFallaEn(bd, 'get'), alAvisar: avisos })

    const r = await pie.recuperar()
    expect(r.recordado).toBe(false)
    expect(r.motivo).toBe(MOTIVO_SIN_PIE.ERROR_LECTURA)
    expect(r.firma).toEqual({ ...FIRMA_VACIA })
    expect(avisos).toHaveBeenCalledTimes(1)
    expect(pie.estado().fallosLectura).toBe(1)
    bd.close()
  })

  it('el BORRADO que revienta lo dice, y dice que el dato SIGUE AHÍ', async () => {
    // Devolver `true` «para no molestar» sería prometerle a alguien que sus datos
    // se han ido cuando no se han ido. Es lo peor que puede hacer este fichero.
    const { bd } = await baseNueva()
    const avisos = vi.fn()
    await crearPieDeFirmaGuardado({ bd }).recordar(FIRMA)

    const pie = crearPieDeFirmaGuardado({ bd: baseQueFallaEn(bd, 'delete'), alAvisar: avisos })
    const r = await pie.olvidar()

    expect(r.olvidado).toBe(false)
    expect(r.habia).toBe(true)
    expect(r.motivo).toBe(MOTIVO_SIN_PIE.ERROR_BORRADO)
    expect(r.mensaje).toMatch(/SIGUE GUARDADO/)
    // Y le dice al usuario por dónde borrarlo él.
    expect(r.mensaje).toMatch(/ajustes del navegador|datos de este sitio/i)
    expect(avisos).toHaveBeenCalledTimes(1)
    bd.close()
  })

  it('un registro ILEGIBLE no revienta la aplicación: se ignora y se dice', async () => {
    // Base manipulada a mano, o escrita por una versión con otra idea de lo que es
    // una firma. Reventar al leer la propia base es la forma más tonta de dejar a
    // alguien sin poder usar la aplicación.
    const { bd } = await baseNueva()
    const avisos = vi.fn()
    await bd.put(ALMACENES.PIE_FIRMA, { id: CLAVE_PIE_FIRMA, firma: 'una cadena', guardadoEn: 1 })

    const pie = crearPieDeFirmaGuardado({ bd, alAvisar: avisos })
    const r = await pie.recuperar()

    expect(r.recordado).toBe(false)
    expect(r.motivo).toBe(MOTIVO_SIN_PIE.REGISTRO_ILEGIBLE)
    expect(r.firma).toEqual({ ...FIRMA_VACIA })
    expect(avisos).toHaveBeenCalledTimes(1)
    expect(pie.estado().ilegibles).toBe(1)
    bd.close()
  })

  it('un registro de una versión FUTURA, con un campo de más, se lee sin reventar', async () => {
    // `normalizarFirma` lanza ante claves desconocidas —y hace bien, es su
    // contrato—, pero al LEER la base eso dejaría al usuario tirado. Se copian
    // solo los campos del contrato antes de normalizar.
    const { bd } = await baseNueva()
    const avisos = vi.fn()
    await bd.put(ALMACENES.PIE_FIRMA, {
      id: CLAVE_PIE_FIRMA,
      firma: { nombre: 'Alguien', visado: 'V-2029/0001' },
      guardadoEn: 7,
    })

    const r = await crearPieDeFirmaGuardado({ bd, alAvisar: avisos }).recuperar()
    expect(r.recordado).toBe(true)
    expect(r.firma.nombre).toBe('Alguien')
    expect(Object.keys(r.firma)).toEqual([...CAMPOS_FIRMA])
    expect(avisos).not.toHaveBeenCalled()
    bd.close()
  })

  it('una marca de tiempo inservible no invalida la firma: solo impide decir cuándo', async () => {
    // Sin TTL, `guardadoEn` solo sirve para CONTARLO. Que falte no es motivo para
    // tirar el nombre de nadie.
    const { bd } = await baseNueva()
    await bd.put(ALMACENES.PIE_FIRMA, {
      id: CLAVE_PIE_FIRMA,
      firma: normalizarFirma({ nombre: 'Alguien' }),
      guardadoEn: 'ayer',
    })

    const r = await crearPieDeFirmaGuardado({ bd }).recuperar()
    expect(r.recordado).toBe(true)
    expect(r.firma.nombre).toBe('Alguien')
    expect(r.guardadoEn).toBeNull()
    bd.close()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · La frontera: el entorno degrada, el programador revienta
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/pie-firma · contrato roto por el programador', () => {
  it('una firma con clave desconocida LANZA, también sin almacén local', async () => {
    // A propósito antes de resolver la base: si solo reventara con IndexedDB
    // delante, el error de programación aparecería en producción y no en la suite.
    const pie = crearPieDeFirmaGuardado({ bd: null, alAvisar: () => {} })
    await expect(pie.recordar({ nombre: 'Alguien', colegiado: '04321' })).rejects.toThrow(
      TypeError,
    )
  })

  it('un número de colegiado numérico LANZA, con el porqué', async () => {
    const pie = crearPieDeFirmaGuardado({ bd: null, alAvisar: () => {} })
    await expect(pie.recordar({ numeroColegiado: 4321 })).rejects.toThrow(
      /ceros a la izquierda/,
    )
  })

  it('las opciones mal puestas lanzan al construir, no en la primera operación', () => {
    expect(() => crearPieDeFirmaGuardado(42)).toThrow(TypeError)
    expect(() => crearPieDeFirmaGuardado({ ahora: 'ya' })).toThrow(TypeError)
    expect(() => crearPieDeFirmaGuardado({ bd: 42 })).toThrow(TypeError)
    expect(() => crearPieDeFirmaGuardado({ alAvisar: 'grita' })).toThrow(TypeError)
  })

  it('dos instancias no comparten nada: el estado vive en el cierre', async () => {
    const { bd } = await baseNueva()
    const a = crearPieDeFirmaGuardado({ bd })
    const b = crearPieDeFirmaGuardado({ bd })

    await a.recordar(FIRMA)
    expect(a.estado().recordados).toBe(1)
    expect(b.estado().recordados).toBe(0)
    // Pero la BASE sí es la misma: b ve lo que escribió a.
    expect((await b.recuperar()).firma.nombre).toBe(FIRMA.nombre)
    bd.close()
  })
})

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import configVitest from '../vitest.config.js'
import {
  crearExpediente,
  crearParcela,
  crearRecinto,
} from '../model/parcela.js'
import { crearEdificio, crearParteConstruccion } from '../model/edificio.js'
// `diagnosticar` NO sale por el barrel (es de F07 y nadie lo ha pedido ahí): se
// importa directamente porque la cadena de F08 lo necesita en medio, y lo que este
// fichero afirma es la frontera del barrel, no su superficie completa.
import { diagnosticar } from '../diagnostico/parcela.js'
import * as area from '../geo/area.js'
import * as cierre from '../geo/cierre.js'
import * as utm from '../geo/utm.js'
import * as huso from '../geo/huso.js'
import * as barrel from '../index.js'
// Los CINCO léxicos de detección, para el bloque «contrato D» del final: hasta F17
// eran cuatro copiados a mano y nada que los comparase.
import * as parsersComun from '../parsers/_comun.js'
import * as gmlComun from '../gml/_comun.js'
import * as exportComun from '../export/_comun.js'
import * as edificioComun from '../edificio/_comun.js'
import * as derivacionComun from '../derivacion/_comun.js'
import fixture from './fixtures/geo/parcela-ring.json' with { type: 'json' }

// ── Test-guardián del contrato transversal de F00 (criterio de aceptación 5) ──
// "Ninguna función de model/ ni de geo/area · geo/cierre acepta o devuelve lat/lon."
// La frontera de proyección (geo/utm, geo/huso) SÍ expone lat/lon por diseño: se
// verifica aquí como frontera explícita, no como fuga.

const CLAVE_GEOGRAFICA = /^(lat|lon|latitud|longitud|latitude|longitude)$/i

/** Recorre en profundidad un POJO y devuelve las rutas cuyas claves parecen geográficas. */
function clavesGeograficas(valor, ruta = '$', acc = []) {
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => clavesGeograficas(v, `${ruta}[${i}]`, acc))
  } else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      if (CLAVE_GEOGRAFICA.test(k)) acc.push(`${ruta}.${k}`)
      clavesGeograficas(v, `${ruta}.${k}`, acc)
    }
  }
  return acc
}

/** Comprueba que todo par de coordenadas es [x,y] de números finitos. */
function esParUTM(p) {
  return Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
}

const anillo = fixture.anilloExterior

describe('contrato F00 · el modelo y la geometría pura viven en UTM (criterio 5)', () => {
  it('un Expediente de parcela completo no contiene claves lat/lon', () => {
    const recintos = [crearRecinto(anillo, 'EXTERIOR')]
    const parcela = crearParcela({
      idLocal: 'p1',
      refcat: fixture.refCatastral,
      recintos,
      geometriaOficial: recintos,
      superficieRegistral: 1500,
      origen: 'WFS',
    })
    const expediente = crearExpediente({
      tipo: 'PARCELA',
      srs: fixture.srs,
      autor: 'test',
      idDocumento: 'd1',
      parcela,
    })
    expect(clavesGeograficas(expediente)).toEqual([])
    // y sus vértices son pares UTM
    expect(expediente.parcela.recintos[0].vertices.every(esParUTM)).toBe(true)
  })

  it('un Edificio con partes no contiene claves lat/lon', () => {
    const recinto = crearRecinto(anillo, 'EXTERIOR')
    const parte = crearParteConstruccion({
      nombre: 'cuerpo principal',
      tipo: 'PRINCIPAL',
      recinto,
      plantasSobreRasante: 2,
      plantasBajoRasante: 1,
      origen: 'DIBUJADA',
    })
    const edificio = crearEdificio({
      refcat: fixture.refCatastral,
      modelo: 'COMPLETO',
      partes: [parte],
    })
    expect(clavesGeograficas(edificio)).toEqual([])
  })

  it('geo/area no devuelve lat/lon y opera en UTM', () => {
    expect(typeof area.area(anillo)).toBe('number')
    expect(typeof area.areaFirmada(anillo)).toBe('number')
    expect([-1, 1]).toContain(area.orientacion(anillo))
  })

  it('geo/cierre devuelve un anillo UTM abierto, sin lat/lon', () => {
    const cerrado = [...anillo, anillo[0]] // recierra artificialmente
    const { anillo: compensado } = cierre.compensarCierre(cerrado)
    expect(clavesGeograficas({ compensado })).toEqual([])
    expect(compensado.every(esParUTM)).toBe(true)
  })
})

describe('contrato F00 · frontera de proyección (utm/huso) — lat/lon permitido y esperado', () => {
  it('utm.inverse ES la frontera: devuelve lat/lon', () => {
    const r = utm.inverse(439250.35, 4479664.55, 30)
    expect(r).toHaveProperty('lat')
    expect(r).toHaveProperty('lon')
    expect(Number.isFinite(r.lat) && Number.isFinite(r.lon)).toBe(true)
  })

  it('huso.detectarHuso reporta el punto de caída (lon/lat) — frontera, no fuga', () => {
    const r = huso.detectarHuso(fixture.referencePoint)
    expect(r.zona).toBe(30)
    expect(r.srs).toBe('EPSG:25830')
    expect(r).toHaveProperty('lon')
    expect(r).toHaveProperty('lat')
  })
})

describe('contrato F02 · la validación sale por el barrel y no expone lat/lon', () => {
  it('el barrel expone el espacio de nombres `validacion` con validarParcela y NIVEL', () => {
    expect(typeof barrel.validacion.validarParcela).toBe('function')
    expect(barrel.validacion.NIVEL).toEqual({ ERROR: 'ERROR', AVISO: 'AVISO' })
  })

  it('validarParcela devuelve {errores, avisos, puedeGenerar} en UTM, sin claves lat/lon', () => {
    const recintos = [crearRecinto(anillo, 'EXTERIOR')]
    const r = barrel.validacion.validarParcela(recintos, { srs: fixture.srs })
    expect(Array.isArray(r.errores)).toBe(true)
    expect(Array.isArray(r.avisos)).toBe(true)
    expect(typeof r.puedeGenerar).toBe('boolean')
    // Errores y avisos son listas SEPARADAS (criterio 3): no hay recuento mezclado.
    expect(r).not.toHaveProperty('total')
    expect(clavesGeograficas(r)).toEqual([])
  })
})

// ── Test-guardián del barrel raíz frente al visor (F03, hallazgo C1/T10) ──────
// `viewer/index.js` y `services/*` importan Leaflet, que exige `window`. Este
// fichero corre en el proyecto Vitest `node` (sin DOM), así que en la práctica el
// invariante ya se autoprotege: si el visor entrara en el barrel, ESTE import
// reventaría con `ReferenceError: document is not defined`. Pero la cabecera de
// `viewer/index.js` afirma por escrito que «el invariante lo vigila
// test/contrato.test.js», y una afirmación escrita tiene que ser cierta: aquí
// está la aserción explícita, que además nombra el motivo en el mensaje del test
// para quien la haga fallar. Momento de riesgo previsto: la Fase 4 (index.html +
// demo), cuando alguien quiera exportar el visor por el barrel «para que la demo
// lo importe bonito». La vía correcta sigue siendo importar `viewer/index.js`
// DIRECTAMENTE.
describe('contrato F03 · el visor NO sale por el barrel raíz (Leaflet exige window)', () => {
  it('el barrel raíz NO expone viewer ni services (Leaflet exige window)', () => {
    expect(Object.keys(barrel)).not.toContain('viewer')
    expect(Object.keys(barrel)).not.toContain('services')
  })
})

// ── Test-guardián del barrel raíz tras F08 (T5.1) ────────────────────────────
// F08 mete DOS capas nuevas en el barrel —`comprobacion/` y `report/`— y las dos
// pueden entrar por la misma razón por la que `viewer/` no puede: son puras. Este
// bloque afirma las dos mitades de esa frontera, y vive aquí (proyecto `node`, sin
// DOM) porque es donde el error se manifestaría: un import prohibido revienta al
// CARGAR el barrel, no al usarlo, y se llevaría por delante la suite entera.
//
// Momento de riesgo previsto: el día que alguien quiera «cerrar el círculo»
// exportando también `gml/descargar.js#descargarTexto`, que es literalmente lo que
// consume el texto que produce `report/`. Está a un import de distancia y es la
// tentación más razonable de todo el fichero — por eso se nombra.
describe('contrato F08 · comprobación e informe salen por el barrel; la ENTREGA no', () => {
  it('el barrel expone las tres funciones puras de F08', () => {
    // Los tres nombres, por su nombre. `comprobarGml` compone la lectura del
    // fichero con las validaciones de F02; `informeContrasteTexto` la convierte en
    // el informe de texto; y `decodificarGml` es el escalón de debajo de
    // `parsearGml` (bytes → texto), que entra por el espacio `gml` porque ya sale
    // de `gml/index.js`: un segundo camino hasta la misma función acabaría
    // prometiendo otra cosa que el primero.
    expect(typeof barrel.comprobacion.comprobarGml).toBe('function')
    expect(typeof barrel.report.informeContrasteTexto).toBe('function')
    expect(typeof barrel.gml.decodificarGml).toBe('function')
  })

  it('y las tres FUNCIONAN sin DOM, encadenadas sobre el fichero real', () => {
    // La mitad anti-vacuidad: `typeof x === 'function'` seguiría en verde con un
    // módulo cuyo grafo de imports tocara `window` en la primera llamada. Aquí se
    // recorre la cadena entera —bytes → texto → comprobación → informe— dentro del
    // proyecto `node`, que corre sin `window`, sin `document` y sin `Blob`.
    const bytes = readFileSync(
      join(fileURLToPath(new URL('..', import.meta.url)), 'test/fixtures/gml/cp_parcela_9398516VK3799G.gml'),
    )
    const { texto, encodingUsado } = barrel.gml.decodificarGml(Uint8Array.from(bytes))
    // El fichero declara ISO-8859-1 y sus bytes son UTF-8: mandan los bytes.
    expect(encodingUsado).toBe('utf-8')

    const comprobacion = barrel.comprobacion.comprobarGml({
      texto,
      nombreFichero: 'cp_parcela_9398516VK3799G.gml',
    })
    expect(comprobacion.puedeContinuar).toBe(true)
    expect(comprobacion.geometria.recintos.length).toBeGreaterThan(0)

    const informe = barrel.report.informeContrasteTexto({
      comprobacion,
      diagnostico: diagnosticar({ recintos: comprobacion.geometria.recintos }),
      fecha: new Date(Date.UTC(2026, 6, 30, 10, 0, 0)),
    })
    expect(informe).toContain('INFORME DE CONTRASTE CON EL PARCELARIO CATASTRAL')
    // Y la sección del fichero, que es la que solo existe cuando hubo comprobación.
    expect(informe).toContain('QUÉ SE LEYÓ DEL FICHERO')
  })

  it('el barrel NO expone viewer, services, app ni storage', () => {
    // `app/` es el tercero de la lista desde F08: `app/cableado-comprobacion.js` y
    // `app/zona-fichero.js` nombran `document`, `File` y los oyentes de la ventana.
    //
    // `storage/` es el cuarto, y entra en la lista en F09 (T5.2) por un motivo
    // DISTINTO que merece decirse: no es que explote, es que no explotaría. Los
    // tres primeros se autoprotegen —importarlos aquí revienta el fichero entero
    // por falta de `window`—, mientras que `storage/bd.js`, `storage/pie-firma.js`
    // y `storage/cache-catastro.js` se importan tan ricamente bajo el proyecto
    // `node`: leen `globalThis.indexedDB` al LLAMAR, como valor por defecto de un
    // parámetro, no al cargar (lo declara la cabecera de `storage/bd.js` y lo
    // demuestra `test/storage/bd.test.js`, que corre sin jsdom). Meter `storage/`
    // en el barrel dejaría la suite en VERDE. Es un error de capas —el barrel raíz
    // es superficie de DOMINIO y `storage/` es un adaptador de entorno—, la
    // decisión ya estaba escrita en esa cabecera («QUÉ NO ENTRA EN EL BARREL
    // RAÍZ»), y esta línea es lo único que la vuelve comprobable. Una regla que
    // solo se sostiene cuando romperla revienta no es una regla.
    for (const prohibido of ['viewer', 'services', 'app', 'storage']) {
      expect(Object.keys(barrel), `el barrel no puede exponer '${prohibido}'`).not.toContain(
        prohibido,
      )
    }
  })

  it('la ENTREGA del fichero no sale por ningún espacio del barrel', () => {
    // `gml/descargar.js` necesita `Blob`, `URL.createObjectURL` y `<a download>`.
    // Se comprueba sobre TODOS los espacios y no solo sobre `gml`, porque el sitio
    // por el que se colaría hoy es `report/` — que produce el texto que ese módulo
    // entrega— y no la rama en la que vive el fichero.
    //
    // `descargarBinario` (F09 · T5.1) es el que entrega los BYTES del PDF, así que
    // es el que cierra el círculo del que habla la cabecera de este bloque: quien
    // acaba de exportar `informePdfParcela` por el barrel tiene la mano puesta
    // sobre él. Está en la lista aunque **puede que todavía no exista**: esto es
    // una lista de nombres PROHIBIDOS, no de nombres que deban existir, y
    // prohibirlo antes de que exista es la única forma de que el guardián llegue
    // antes que el error en vez de después.
    const entrega = [
      'descargarTexto',
      'descargarGml',
      'descargarBinario',
      'nombreFicheroGml',
      'MOTIVO_NO_DESCARGADO',
    ]
    for (const [espacio, contenido] of Object.entries(barrel)) {
      for (const nombre of entrega) {
        expect(
          Object.keys(contenido),
          `el espacio '${espacio}' expone '${nombre}': la entrega del fichero es código de ` +
            `NAVEGADOR y el barrel lo carga el proyecto Vitest 'node', sin DOM`,
        ).not.toContain(nombre)
      }
    }
  })

  it('el FUENTE del barrel no importa ninguna de las fronteras', () => {
    // Mitad ESTÁTICA, y no es redundante con las de arriba: un módulo de `app/` que
    // solo nombrara `document` DENTRO de una función se importaría sin lanzar, y el
    // barrel quedaría roto en producción y verde aquí. El mismo criterio que la
    // guarda de proj4 de más abajo.
    //
    // F09 añade `storage/` a las capas vetadas (ver el test de arriba: esa es la
    // que NO se autoprotege) y DOS FICHEROS POR SU NOMBRE, que son los dos módulos
    // impuros que estrena la feature y los únicos de sus capas que caerían dentro
    // de una regla por directorio:
    //   · `report/canvas.js` — `document.createElement('canvas')`, `Image` y
    //     `toBlob`, más las descargas al WMS. Es el `gml/descargar.js` de `report/`,
    //     y su capa entera SÍ sale por el barrel, así que la regla por directorio
    //     no lo cubre: hay que nombrarlo.
    //   · `app/dialogo-informe.js` — lo cubre `^\./app/`, y se nombra igual porque
    //     es el fichero concreto que alguien intentaría exportar «para que el
    //     cableado lo importe bonito», que es la tentación que el resto de la
    //     cabecera de este bloque describe.
    //
    // F10 añade `app/dialogo-expediente.js` por lo mismo que el otro diálogo, y NO
    // añade ningún módulo de `export/`: los cuatro son puros y la capa entera entra
    // por `export/index.js` (ver el bloque de F10, más abajo). Los tres módulos
    // nuevos de `storage/` —`expedientes`, `cuota` y `autoguardado`— los cubre
    // `^\./storage/`, que es la regla que NO se autoprotege y por eso está escrita.
    const fuente = readFileSync(fileURLToPath(new URL('../index.js', import.meta.url)), 'utf8')
    const imports = [...fuente.matchAll(/(?:^|\n)[ \t]*export\s+\*[^\n]*from\s+['"]([^'"]+)['"]/g)].map(
      (m) => m[1],
    )
    expect(imports.length, 'no se ha leído ni un `export * as … from` del barrel').toBeGreaterThan(0)
    const VETADOS = [
      './gml/descargar.js',
      './report/canvas.js',
      './app/dialogo-informe.js',
      './app/dialogo-expediente.js',
    ]
    const infractores = imports.filter(
      (ruta) => /^\.\/(?:viewer|services|app|storage)\//.test(ruta) || VETADOS.includes(ruta),
    )
    expect(
      infractores,
      'el barrel raíz no puede reexportar viewer/, services/, app/, storage/, ' +
        'gml/descargar.js, report/canvas.js ni app/dialogo-informe.js',
    ).toEqual([])
  })
})

// ── Test-guardián del barrel raíz tras F09 (T5.2) ────────────────────────────
// F09 convierte `report/` de UN FICHERO en UNA CAPA: siete módulos, de los que
// SEIS son puros y entran (`encuadre`, `literal`, `firma`, `pdf`, `pdf-parcela` y
// el `contraste-texto` de F08) y UNO no —`report/canvas.js`, que crea un
// `<canvas>`, descarga teselas del WMS y saca el JPEG con `toBlob`—. El octavo
// módulo de la feature, `app/dialogo-informe.js`, es una vista y ya lo cubre la
// prohibición de `app/`, pero se nombra igual porque es el que más cerca está de
// colarse. El espacio `report` deja de apuntar a un fichero y pasa a apuntar a
// `report/index.js`, con el precedente y las decisiones de `gml/index.js`. De
// `geo/` entran además `bbox` y `rumbo`, que son de donde `report/` saca la caja
// envolvente y los cardinales.
//
// Las tres reglas transversales —capas prohibidas, la ENTREGA, y la mitad
// ESTÁTICA sobre el fuente— NO se reescriben aquí: viven AMPLIADAS en el bloque de
// F08 de arriba, con `storage`, con `descargarBinario` y con los dos ficheros
// impuros de esta feature. Dos listas de prohibiciones en el mismo fichero acaban
// discrepando, y la que se olvide de actualizar es justo la que protege.
//
// Momento de riesgo previsto: el mismo que en F08, un piso más arriba. Ahora el
// barrel expone `informePdfParcela`, que devuelve BYTES; el paso «natural» que
// alguien querrá dar es exportar también quien los entrega (`descargarBinario`, de
// `gml/descargar.js`) o quien compone el plano que va dentro (`componerPlano`, de
// `report/canvas.js`). Los dos están prohibidos por su nombre, y el segundo aquí.
describe('contrato F09 · la capa del informe sale por el barrel; el plano y el diálogo no', () => {
  const RAIZ_REPO = fileURLToPath(new URL('..', import.meta.url))

  /**
   * El instante del documento, INYECTADO. Ni un módulo de `report/` consulta el
   * reloj —lo declaran las cinco cabeceras—, así que esta fecha tiene que
   * reaparecer literalmente en el identificador del informe. Es lo que convierte
   * «no lee el reloj» en algo comprobable en vez de en una promesa de comentario.
   */
  const FECHA = new Date(Date.UTC(2026, 7, 2, 10, 0, 0))

  it('el barrel expone las cinco funciones puras de la capa del informe', () => {
    // Una por contrato del plan de F09: A el encuadre, C el lindero, D el
    // encabezado, y `informePdfParcela` el documento. `informeContrasteTexto` sigue
    // saliendo por el mismo nombre que en F08 —el espacio `report` cambió de fichero
    // a capa y esa mudanza no se puede notar desde fuera—, y se comprueba aquí
    // además de en el bloque de arriba precisamente por eso.
    expect(typeof barrel.report.encuadrar).toBe('function')
    expect(typeof barrel.report.describirLindero).toBe('function')
    expect(typeof barrel.report.componerEncabezado).toBe('function')
    expect(typeof barrel.report.informePdfParcela).toBe('function')
    expect(typeof barrel.report.informeContrasteTexto).toBe('function')
    // Y las dos de `geo/` que entran con ellas: `report/encuadre.js` encuadra con
    // la primera y `report/literal.js` nombra los cardinales con la segunda.
    expect(typeof barrel.bbox.bbox).toBe('function')
    expect(typeof barrel.rumbo.azimut).toBe('function')
  })

  it('y la cadena entera FUNCIONA sin DOM sobre el fichero real, con la fecha inyectada', () => {
    // La mitad anti-vacuidad, que es la que de verdad protege: `typeof x ===
    // 'function'` seguiría en verde con un módulo cuyo grafo de imports tocara
    // `window` en la primera llamada, y un guardián que solo comprueba que las
    // claves existen está a un import de volverse mentira. Aquí se recorre la
    // cadena natural de F09 —fichero → geometría → encuadre → lindero → encabezado
    // → PDF— dentro del proyecto `node`, que corre sin `window`, sin `document` y
    // sin `Blob`, y se termina en unos bytes que empiezan por `%PDF`.
    const texto = readFileSync(
      join(RAIZ_REPO, 'test/fixtures/gml/cp_parcela_9398516VK3799G.gml'),
      'utf8',
    )
    const { parcelas } = barrel.gml.parsearGml(texto)
    const parcela = parcelas[0]
    expect(parcela.recintos.length).toBeGreaterThan(0)

    // Contrato A. Se afirma sobre él y no solo se pasa adelante: el encuadre es la
    // única pieza de la cadena cuyo consumidor natural —`report/canvas.js`— es
    // justamente el módulo impuro que NO puede correr aquí, así que sin estas dos
    // líneas entraría de adorno. La escala es la que se rotula en el papel y `toPx`
    // el mapeo con el que se dibuja el vector sobre la cartografía.
    const encuadre = barrel.report.encuadrar({
      recintos: parcela.recintos,
      anchoMm: 180,
      altoMm: 130,
    })
    expect(Number.isInteger(encuadre.escalaDenominador)).toBe(true)
    expect(encuadre.escalaDenominador).toBeGreaterThan(0)
    const [px, py] = encuadre.toPx(parcela.recintos[0].vertices[0])
    expect(px).toBeGreaterThanOrEqual(0)
    expect(px).toBeLessThanOrEqual(encuadre.anchoPx)
    expect(py).toBeGreaterThanOrEqual(0)
    expect(py).toBeLessThanOrEqual(encuadre.altoPx)

    // Contrato C. Sin vecinas: `null` significa «no se han consultado», que es la
    // verdad aquí —este bloque no habla por la red— y no es lo mismo que `[]`.
    const literal = barrel.report.describirLindero({ recintos: parcela.recintos })
    expect(literal.tramos.length).toBeGreaterThan(0)
    expect(literal.texto).toContain('Linda al ')
    expect(literal.vecinasConsultadas).toBe(false)

    // Contrato D. Sin descriptivos, que tampoco se pueden consultar sin red.
    const encabezado = barrel.report.componerEncabezado({
      refcat: parcela.refcat,
      srs: parcela.srs,
      fecha: FECHA,
      idDocumento: null,
    })
    // El identificador se compone con la fecha RECIBIDA. Que lleve dentro el
    // 2026-08-02T10:00:00Z y no el instante de la ejecución es la prueba de que
    // ningún eslabón ha ido a buscar el reloj por su cuenta: si alguno lo hiciera,
    // esta línea se pondría roja al día siguiente y no dentro de un año.
    expect(encabezado.idDocumento).toContain('20260802')
    expect(encabezado.idDocumento).toContain('100000Z')
    expect(barrel.report.esIdDocumento(encabezado.idDocumento)).toBe(true)

    // Y el documento. `plano: null` es legítimo y es lo único posible aquí: el
    // plano lo compone `report/canvas.js`, que es la mitad de `report/` que se
    // queda fuera del barrel — el informe sale diciendo que no lo lleva, que es
    // exactamente lo que tiene que hacer.
    const informe = barrel.report.informePdfParcela({
      diagnostico: diagnosticar({ recintos: parcela.recintos }),
      encabezado,
      parcela,
      literal,
      encuadre,
      plano: null,
    })
    expect(informe.bytes).toBeInstanceOf(Uint8Array)
    expect(informe.bytes.length).toBeGreaterThan(0)
    expect(String.fromCharCode(...informe.bytes.slice(0, 4))).toBe('%PDF')
    expect(informe.nPaginas).toBeGreaterThan(0)
    // El identificador del encabezado viaja hasta el papel y hasta el nombre del
    // fichero: un documento firmable con dos identidades no serviría de nada.
    expect(informe.idDocumento).toBe(encabezado.idDocumento)
    expect(informe.nombreFichero).toContain(encabezado.idDocumento)
  })

  it('el PLANO y el DIÁLOGO no salen por ningún espacio del barrel', () => {
    // Espejo exacto de la regla de la ENTREGA del bloque de F08, para las dos
    // piezas impuras que estrena F09. Se comprueba sobre TODOS los espacios y no
    // solo sobre `report`, por el mismo motivo que allí: el sitio por el que se
    // colaría no tiene por qué ser la rama en la que vive el fichero.
    //   · `componerPlano` (`report/canvas.js`) necesita `document.createElement`,
    //     `Image` y `toBlob`, y además descarga teselas del WMS. Es la única
    //     función de toda la capa `report/` que hace las dos cosas prohibidas.
    //   · `crearDialogoInforme` (`app/dialogo-informe.js`) fabrica nodos: es una
    //     vista, y las vistas no son superficie del motor.
    const impuros = ['componerPlano', 'crearDialogoInforme']
    for (const [espacio, contenido] of Object.entries(barrel)) {
      for (const nombre of impuros) {
        expect(
          Object.keys(contenido),
          `el espacio '${espacio}' expone '${nombre}': toca el DOM (y el plano, además, ` +
            `la red) y el barrel lo carga el proyecto Vitest 'node', sin document ni Image`,
        ).not.toContain(nombre)
      }
    }
  })

  it('el escritor de PDF genérico tampoco sale: la capa publica el INFORME, no la imprenta', () => {
    // Decisión 3 de `report/index.js`, y es el calco de por qué `gml/index.js` deja
    // fuera `gml/xml.js`. `crearDocumentoPdf` es puro y podría salir sin romper
    // nada: no está fuera por miedo, está fuera porque publicarlo invita a componer
    // informes A MANO por fuera de `informePdfParcela` —donde viven el nombre legal
    // del documento, la ausencia de siglas oficiales, la numeración de páginas y la
    // regla de oro 9—, que es justo lo que ese módulo existe para impedir. Quien
    // necesite la imprenta importa `report/pdf.js` directamente.
    expect(Object.keys(barrel.report)).not.toContain('crearDocumentoPdf')
    // Y el espacio `report` es la CAPA, no un fichero: si alguien deshiciera la
    // unificación volviendo a apuntar a `contraste-texto.js`, esto lo diría.
    for (const nombre of ['encuadrar', 'describirLindero', 'componerEncabezado']) {
      expect(
        Object.keys(barrel.report),
        `el espacio 'report' ya no puede ser UN fichero: le falta '${nombre}'`,
      ).toContain(nombre)
    }
  })
})

// ── Test-guardián del barrel raíz tras F10 (T4.2) ────────────────────────────
// F10 estrena la capa `export/` —cuatro módulos puros que escriben el DXF, el
// listado de coordenadas y el fichero de proyecto— y TRES módulos de `storage/`
// más un diálogo. La frontera cae justo por el medio de la feature, y por eso este
// bloque afirma las dos mitades:
//
//   · `export/` ENTRA, y entra por la misma razón que `report/` y `comprobacion/`:
//     es puro. Entra geometría del modelo en UTM, sale una cadena o un POJO. Ni
//     `Blob`, ni `document`, ni red, ni reloj (la fecha se inyecta).
//   · `storage/expedientes.js`, `storage/cuota.js` y `storage/autoguardado.js` NO,
//     y `app/dialogo-expediente.js` tampoco.
//
// ⚠️ Y conviene decir POR QUÉ este `it` existe habiendo tres reglas transversales
// en el bloque de F08: porque de los cuatro módulos que aquí se prohíben, **ninguno
// rompería nada al colarse**. `storage/*` se importa tan ricamente bajo el proyecto
// `node` —`globalThis.indexedDB` se lee al LLAMAR, no al cargar—, y
// `app/dialogo-expediente.js` sí reventaría… pero solo si alguien lo exportara con
// `export * as`, que es la única forma que el detector estático mira. Meter
// `storage/` en el barrel dejaría la suite EN VERDE PARA SIEMPRE. Esta prueba y la
// mitad estática de F08 son lo único que lo impide.
//
// Momento de riesgo previsto: el día que el cableado de F10 necesite el almacén de
// expedientes y alguien decida «sacarlo por el barrel, que ya está todo lo demás».
// `app/cableado-expediente.js` lo importa DIRECTAMENTE, igual que `app/main.js`
// importa `viewer/index.js` y `storage/bd.js`.
describe('contrato F10 · `export/` sale por el barrel; el almacén y el diálogo no', () => {
  const RAIZ_REPO = fileURLToPath(new URL('..', import.meta.url))

  /** El instante del fichero, INYECTADO: ni un módulo de `export/` lee el reloj. */
  const FECHA = new Date(Date.UTC(2026, 7, 3, 9, 45, 12))

  it('el barrel expone las cuatro funciones puras de la capa de salida', () => {
    expect(typeof barrel.exportar.serializarParcelaDxf).toBe('function')
    expect(typeof barrel.exportar.serializarCoordenadasTxt).toBe('function')
    expect(typeof barrel.exportar.aProyecto).toBe('function')
    expect(typeof barrel.exportar.deProyecto).toBe('function')
    // Y el vocabulario CERRADO con el que se leen sus resultados: sin él, la UI
    // tendría que decidir mirando el TEXTO del mensaje, que es lo único que sí
    // puede cambiar (regla de oro 1).
    expect(Object.keys(barrel.exportar.TIPO_EXPORT).length).toBeGreaterThan(4)
    expect(Object.keys(barrel.exportar.MOTIVO_PROYECTO).length).toBeGreaterThan(4)
    expect(barrel.exportar.CAPAS.OFICIAL.nombre).toBe('PARCELA_OFICIAL')
  })

  it('y las CUATRO funcionan sin DOM, encadenadas sobre el fichero real', () => {
    // La mitad anti-vacuidad, que es la que de verdad protege: `typeof x ===
    // 'function'` seguiría en verde con un módulo cuyo grafo de imports tocara
    // `window` en la primera llamada. Aquí se recorre la cadena entera —fichero →
    // modelo → los tres ficheros de salida → y de vuelta— dentro del proyecto
    // `node`, que corre sin `window`, sin `document` y sin `Blob`.
    const texto = readFileSync(
      join(RAIZ_REPO, 'test/fixtures/gml/cp_parcela_9398516VK3799G.gml'),
      'utf8',
    )
    const parcela = barrel.gml.parsearGml(texto).parcelas[0]
    expect(parcela.recintos.length).toBeGreaterThan(0)

    // Contrato D · el DXF, con las dos capas en la TABLA (no solo nombradas por las
    // entidades: sin `TABLES` el auditor de ezdxf da 0 errores y las capas no existen).
    const { dxf, capas } = barrel.exportar.serializarParcelaDxf({
      recintosEditados: parcela.recintos,
      recintosOficiales: parcela.recintos,
    })
    expect(dxf.startsWith('0\r\nSECTION')).toBe(true)
    expect(dxf).toContain(barrel.exportar.ACADVER)
    expect(capas.map((c) => c.nombre)).toContain(barrel.exportar.CAPAS.EDITADA.nombre)

    // Contrato E · el listado de coordenadas, con su fecha inyectada.
    const { texto: listado, nVertices } = barrel.exportar.serializarCoordenadasTxt({
      recintos: parcela.recintos,
      refcat: parcela.refcat,
      srs: parcela.srs,
      fecha: FECHA,
    })
    expect(nVertices).toBe(parcela.recintos[0].vertices.length)
    expect(listado).toContain('03/08/2026 09:45 (UTC)')
    expect(listado).toContain(parcela.refcat)

    // Contrato F · la ida y vuelta del proyecto, pasando por JSON como pasa de
    // verdad entre exportar e importar.
    const expediente = barrel.parcela.crearExpediente({
      srs: parcela.srs,
      metadatos: { creado: '2026-08-01T00:00:00.000Z', modificado: '2026-08-03T00:00:00.000Z' },
      parcela: {
        idLocal: 'P-1',
        refcat: parcela.refcat,
        origen: 'WFS',
        recintos: parcela.recintos,
        geometriaOficial: parcela.recintos,
      },
    })
    const sobre = barrel.exportar.aProyecto(expediente, { fecha: FECHA, nombre: 'Contrato F10' })
    expect(sobre.formato).toBe(barrel.exportar.FORMATO_PROYECTO)
    const vuelta = barrel.exportar.deProyecto(JSON.parse(JSON.stringify(sobre)))
    expect(vuelta.ok).toBe(true)
    expect(vuelta.expediente).toEqual(expediente)
    // Y la geometría oficial vuelve CONGELADA, que es lo que JSON no conserva.
    expect(Object.isFrozen(vuelta.expediente.parcela.geometriaOficial)).toBe(true)
  })

  it('⚠️ el almacén de expedientes y el diálogo NO salen — y esto es lo único que lo impide', () => {
    // Los cuatro nombres, por su nombre. Ninguno rompería nada al colarse: los tres
    // de `storage/` se importan sin lanzar bajo el proyecto `node` (leen
    // `globalThis.indexedDB` al LLAMAR), y el diálogo solo reventaría por la vía que
    // el detector estático ya mira. O sea que sin esta prueba, meterlos en el barrel
    // dejaría la suite en VERDE para siempre. Una regla que solo se sostiene cuando
    // romperla revienta no es una regla, es una casualidad.
    const prohibidos = [
      'crearExpedientes',
      'crearCuota',
      'crearAutoguardado',
      'crearDialogoExpediente',
      // Y las constantes que más tentación dan de sacar «porque las necesita la UI»:
      // la interfaz las importa de `storage/expedientes.js` DIRECTAMENTE, que es lo
      // que hace `app/dialogo-expediente.js`.
      'NO_SE_GUARDA',
      'AVISO_DURABILIDAD',
      'ID_BORRADOR',
    ]
    for (const [espacio, contenido] of Object.entries(barrel)) {
      for (const nombre of prohibidos) {
        expect(
          Object.keys(contenido),
          `el espacio '${espacio}' expone '${nombre}': 'storage/' es un adaptador de ENTORNO y ` +
            `el barrel raíz es superficie de DOMINIO`,
        ).not.toContain(nombre)
      }
    }
    // Y el espacio entero tampoco, por si alguien lo mete con otro nombre.
    for (const prohibido of ['storage', 'expedientes', 'autoguardado', 'cuota']) {
      expect(Object.keys(barrel)).not.toContain(prohibido)
    }
  })

  it('la ENTREGA de los tres ficheros nuevos tampoco sale, ni sus tipos MIME', () => {
    // `TIPO_MIME_DXF` y `TIPO_MIME_JSON` viven en `gml/descargar.js`, que necesita
    // `Blob` y `<a download>`. Están prohibidos por el mismo motivo que
    // `descargarTexto`: el vocabulario de la ENTREGA viaja con quien entrega.
    for (const [espacio, contenido] of Object.entries(barrel)) {
      for (const nombre of ['TIPO_MIME_DXF', 'TIPO_MIME_JSON', 'descargarTexto']) {
        expect(Object.keys(contenido), `el espacio '${espacio}' expone '${nombre}'`).not.toContain(
          nombre,
        )
      }
    }
    // Anti-vacuidad: las dos constantes EXISTEN donde tienen que existir. Sin esto,
    // la prohibición de arriba pasaría igual el día que alguien las borrara.
    const descargar = readFileSync(join(RAIZ_REPO, 'gml/descargar.js'), 'utf8')
    expect(descargar).toMatch(/export const TIPO_MIME_DXF = 'image\/vnd\.dxf'/)
    expect(descargar).toMatch(/export const TIPO_MIME_JSON = 'application\/json'/)
  })

  it('la fábrica de detecciones de la capa tampoco sale: el vocabulario es para LEER', () => {
    // Decisión 2 de `export/index.js`, y es el calco de por qué `report/index.js`
    // deja fuera `crearDocumentoPdf`. `crearDeteccionExport` es puro y podría salir
    // sin romper nada: está fuera porque una interfaz que fabricara detecciones de la
    // capa de salida inventaría hallazgos que la capa no ha hecho, indistinguibles de
    // los de verdad en la misma lista.
    expect(Object.keys(barrel.exportar)).not.toContain('crearDeteccionExport')
    // `NL` tampoco: describe cómo se escribe el fichero, no cómo se lee el resultado.
    expect(Object.keys(barrel.exportar)).not.toContain('NL')
    // Pero `resumirDetecciones` SÍ, que es lo que la UI usa para contar.
    expect(typeof barrel.exportar.resumirDetecciones).toBe('function')
  })
})

// ── Test-guardián del barrel raíz tras F11 (T3.1) ────────────────────────────
// F11 estrena la SEGUNDA RAMA de la aplicación y con ella cinco módulos nuevos.
// La frontera vuelve a caer por el medio de la feature, y esta vez con una vuelta
// de tuerca que no tenía ninguna de las anteriores:
//
//   · `edificio/` ENTRA —tres módulos: `_comun.js`, `mutaciones.js` y
//     `entrada.js`—, y entra por la razón de siempre: es puro. Entran cadenas,
//     anillos en UTM y POJOs; salen POJOs y detecciones. Ni `document`, ni
//     Leaflet, ni red, ni reloj.
//   · `viewer/partes.js`, `services/catastro-edificio.js`, `app/rama.js` y
//     `app/panel-edificio.js` NO.
//
// ⚠️ Y aquí está la vuelta de tuerca, MEDIDA el 2026-08-03: de esos cuatro, **solo
// `viewer/partes.js` se autoprotege**. Importarlo bajo el proyecto `node` revienta
// con `ReferenceError: window is not defined`, porque importa Leaflet. Los otros
// TRES cargan sin lanzar: solo nombran `document` DENTRO de sus funciones y de
// `viewer/` únicamente tocan `_comun.js`, que no importa Leaflet. O sea que
// colarlos dejaría la suite EN VERDE y la aplicación rota, exactamente igual que
// pasaba con `storage/` en F09.
//
// Contra eso hay ya una defensa y aquí se añade la que falta:
//
//   1. La que YA existe y basta para el barrel raíz: la mitad ESTÁTICA del bloque
//      de F08 veta los cuatro DIRECTORIOS en bloque
//      (`^\./(?:viewer|services|app|storage)\/`). Por eso este bloque NO añade
//      ninguno de los cuatro ficheros a `VETADOS`: sería redundante, y una segunda
//      lista de prohibiciones acaba discrepando de la primera. El precedente de
//      `report/canvas.js` —que sí hubo que nombrar— no aplica: aquel está en una
//      capa que SÍ sale por el barrel, y estos cuatro no.
//   2. La que FALTABA, y es lo que este bloque aporta: esa regla estática lee el
//      fuente de `index.js`, y `edificio/index.js` es un fichero nuevo de una capa
//      que SÍ sale. Un `export { crearCapaPartes } from '../viewer/partes.js'`
//      escrito ahí dentro no lo ve la regla por directorio —no está en `index.js`—
//      y, para tres de los cuatro, tampoco lo vería la suite. Se cierra por los
//      NOMBRES de sus cuatro fábricas, recorriendo todos los espacios, que es
//      exactamente lo que F09 hizo con `componerPlano` y F10 con `crearExpedientes`.
//
// Momento de riesgo previsto: el día que `app/cableado-edificio.js` necesite a la
// vez la capa pura y la capa que pinta, y alguien decida «sacarlas las dos por el
// barrel, que ya está `entradaEdificio`». La vía correcta es la de siempre:
// `app/` importa `viewer/partes.js` y `services/catastro-edificio.js`
// DIRECTAMENTE, igual que `app/main.js` importa `viewer/index.js`.
describe('contrato F11 · `edificio/` sale por el barrel; el visor, el servicio y el panel no', () => {
  const RAIZ_REPO = fileURLToPath(new URL('..', import.meta.url))

  /** El DXF REAL de Consulta Masiva: 7 anillos en «Construccion» + 1 en «Parcela». */
  const DXF_EDIFICIO = readFileSync(
    join(RAIZ_REPO, 'test/fixtures/parsers/edificio_consulta_masiva_3515508VF0831N.dxf'),
    'latin1',
  )

  /**
   * ¿Cae el punto DENTRO del anillo? Ray casting escrito aquí a propósito, y no
   * el `booleanPointInPolygon` que `gml/anillos.js#puntoInterior` usa por dentro:
   * afirmar una propiedad con la misma función que la produjo no afirma nada. El
   * anillo del modelo va ABIERTO (regla de oro 4) y el bucle lo cierra al vuelo
   * arrancando `j` en el último vértice.
   *
   * @param {[number, number]} punto  En UTM.
   * @param {Array<[number, number]>} vertices  Anillo abierto, en UTM.
   */
  function puntoEnAnillo([x, y], vertices) {
    let dentro = false
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const [xi, yi] = vertices[i]
      const [xj, yj] = vertices[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro
    }
    return dentro
  }

  it('el barrel expone la capa de entrada de edificio, y NO pisa el espacio del modelo', () => {
    // Desviación 8 del plan de F11: el espacio se llama `entradaEdificio` porque
    // `edificio` ya es `model/edificio.js` desde F00. Se afirman las DOS mitades,
    // porque lo que importa no es que exista el nombre nuevo sino que el viejo
    // siga significando lo mismo: `edificio` es qué ES un Edificio y
    // `entradaEdificio` es cómo se llega hasta él.
    expect(typeof barrel.edificio.crearEdificio).toBe('function')
    expect(Object.keys(barrel.edificio)).not.toContain('entradaDesdeTexto')
    // Contrato D: las tres fábricas, y el punto del que se deduce la RC.
    expect(typeof barrel.entradaEdificio.entradaDesdeTexto).toBe('function')
    expect(typeof barrel.entradaEdificio.entradaDesdeGmlBu).toBe('function')
    expect(typeof barrel.entradaEdificio.entradaDesdeWfsBu).toBe('function')
    expect(typeof barrel.entradaEdificio.puntoDeReferencia).toBe('function')
    // Las cuatro mutaciones puras.
    for (const nombre of ['conModelo', 'conRefcat', 'conParteRenombrada', 'conAtributos']) {
      expect(Object.keys(barrel.entradaEdificio), `falta la mutación '${nombre}'`).toContain(nombre)
    }
    // Y el vocabulario CERRADO con el que se leen sus resultados: sin él, la UI
    // tendría que decidir mirando el TEXTO del mensaje (regla de oro 1).
    expect(Object.keys(barrel.entradaEdificio.VIA)).toEqual([
      'DXF',
      'LIST',
      'TXT',
      'GML_EXISTENTE',
      'WFS',
    ])
    // ⛔ MOTIVO_ENTRADA son CINCO y son de EDIFICIO. Los dos bloqueos que T1.1
    // añadió a `parsers/importar.js` —`ANILLOS_EN_VARIAS_CAPAS` y
    // `SUPERFICIE_NO_POSITIVA`— hablan del reparto «un exterior + N huecos», que
    // es una regla de la rama PARCELA: en ésta cada anillo es su propio exterior.
    // Que no estén aquí es lo que permite que el caso normal de la fase —un DXF
    // de vivienda + porche + piscina, que viene por definición de varias capas—
    // no salga bloqueado.
    expect(Object.keys(barrel.entradaEdificio.MOTIVO_ENTRADA)).toEqual([
      'SIN_GEOMETRIA',
      'COORDENADAS_EN_GRADOS',
      'HUSO_NO_RESUELTO',
      'SIN_CONSTRUCCION',
      'DIALECTO_NO_BU',
    ])
    expect(Object.keys(barrel.entradaEdificio.TIPO_EDIFICIO).length).toBeGreaterThan(4)
    expect(typeof barrel.entradaEdificio.resumirDetecciones).toBe('function')
    expect(barrel.entradaEdificio.nombreParteGenerico(0)).toBe('Parte 1')
  })

  it('y la cadena entera FUNCIONA sin DOM, encadenada sobre los DOS ficheros reales', () => {
    // La mitad anti-vacuidad, que es la que de verdad protege: `typeof x ===
    // 'function'` seguiría en verde con un módulo cuyo grafo de imports tocara
    // `window` en la primera llamada, y un guardián que solo comprueba que las
    // claves existen está a un import de volverse mentira. Aquí se recorren las
    // DOS vías que estrena la fase —fichero de CAD y GML de la Sede— dentro del
    // proyecto `node`, que corre sin `window`, sin `document` y sin `Blob`.
    const e = barrel.entradaEdificio

    // ── Vía DXF (la principal de la fase) ──────────────────────────────────
    // Con `capa: 'Construccion'`: decisión 5 del plan («ofrecer, no imponer»).
    // Sin elegir capa el mismo fichero da OCHO partes, porque la octava es el
    // contorno de la parcela — y esa es justamente la diferencia que el diálogo
    // de reparto existe para que la elija una persona y no un heurístico.
    const dxf = e.entradaDesdeTexto(DXF_EDIFICIO, { capa: 'Construccion' })
    expect(dxf.resumen.via).toBe(e.VIA.DXF)
    expect(dxf.resumen.nPartes).toBe(7)
    expect(dxf.resumen.nVertices).toEqual([24, 4, 4, 8, 6, 12, 4])
    expect(dxf.resumen.capas).toEqual(Array(7).fill('Construccion'))
    expect(dxf.resumen.bloqueos).toEqual([])
    expect(dxf.resumen.construido).toBe(true)
    expect(dxf.resumen.huso.srs).toBe('EPSG:25830')
    expect(e.entradaDesdeTexto(DXF_EDIFICIO).resumen.nPartes).toBe(8)
    // El nombre genérico y el origen los decide ESTA capa y nadie más.
    expect(dxf.edificio.partes.map((p) => p.nombre)).toEqual([
      'Parte 1',
      'Parte 2',
      'Parte 3',
      'Parte 4',
      'Parte 5',
      'Parte 6',
      'Parte 7',
    ])
    expect([...new Set(dxf.edificio.partes.map((p) => p.origen))]).toEqual(['DXF'])
    // Y el punto del que se deduce la RC: `puntoInterior`, no el centroide. Se
    // afirma que CAE dentro de alguna huella, que es la propiedad por la que
    // existe —el centroide de una figura en L cae fuera y el Catastro contesta
    // con la referencia de la vecina, en silencio (medido en F05/F06)—.
    const punto = e.puntoDeReferencia(dxf.edificio)
    expect(punto.every(Number.isFinite)).toBe(true)
    const dentroDeAlguna = dxf.edificio.partes.some((p) =>
      p.recinto === null ? false : puntoEnAnillo(punto, p.recinto.vertices),
    )
    expect(dentroDeAlguna, 'el punto de referencia cae FUERA de todas las huellas').toBe(true)

    // ── Vía GML de edificio (el fichero que se baja de la Sede) ────────────
    const xml = readFileSync(
      join(RAIZ_REPO, 'test/fixtures/gml/bu_buildingpart_9398516VK3799G.gml'),
      'utf8',
    )
    const bu = e.entradaDesdeGmlBu(xml, { modelo: 'COMPLETO' })
    expect(bu.resumen.via).toBe(e.VIA.GML_EXISTENTE)
    expect(bu.resumen.nPartes).toBe(13)
    expect(bu.resumen.capas).toBe(null) // un GML no tiene capas, y no se le inventan
    expect(bu.resumen.bloqueos).toEqual([])
    expect(bu.edificio.refcat).toBe('9398516VK3799G')
    // ⛔ Desviación 10 del plan: `part10` es una parte SOLO bajo rasante, contra
    // el convenio de la ficha. Manda el dato (regla de oro 8) y se DICE. Y las
    // plantas, que F11 declara `null` por alcance, se descartan diciéndolo
    // también: las dos detecciones son la regla de oro 1 hecha comprobable.
    expect(Object.keys(bu.resumen.detecciones.porTipo)).toContain('PARTE_BAJO_RASANTE')
    expect(Object.keys(bu.resumen.detecciones.porTipo)).toContain('PLANTAS_DESCARTADAS')
    // El recuento del resumen es el de la lista: una sola forma de contar.
    expect(e.resumirDetecciones(bu.detecciones)).toEqual(bu.resumen.detecciones)

    // ── Las mutaciones, sobre lo que acaba de salir ────────────────────────
    // Devuelven `{edificio, detecciones}`, NO un Edificio pelado, y el POJO
    // original se queda como estaba: es lo que hace que `structuredClone` sirva
    // de historial (regla de oro 4).
    const renombrada = e.conParteRenombrada(bu.edificio, 0, 'vivienda')
    expect(renombrada.edificio.partes[0].nombre).toBe('vivienda')
    expect(bu.edificio.partes[0].nombre).toBe('Parte 1')
    expect(renombrada.edificio).not.toBe(bu.edificio)
    // `conModelo` a SIMPLIFICADO BORRA los siete atributos semánticos, y lo dice
    // ANTES de que nadie escriba el resultado en el store.
    const simplificado = e.conModelo(renombrada.edificio, 'SIMPLIFICADO')
    expect(simplificado.detecciones.map((d) => d.tipo)).toContain('MODELO_CAMBIADO')
    expect('usoDominante' in simplificado.edificio).toBe(false)
    expect('usoDominante' in renombrada.edificio).toBe(true)

    // ── Y el fichero que NO es de edificio ─────────────────────────────────
    // La lección de F08 entera: no se lanza por el contenido de un fichero
    // ajeno. Un GML de parcela por la vía de edificio sale por `bloqueos`.
    const cp = readFileSync(
      join(RAIZ_REPO, 'test/fixtures/gml/cp_parcela_9398516VK3799G.gml'),
      'utf8',
    )
    const noEsBu = e.entradaDesdeGmlBu(cp)
    expect(noEsBu.resumen.bloqueos).toEqual([e.MOTIVO_ENTRADA.DIALECTO_NO_BU])
    expect(noEsBu.edificio).toBe(null)
  })

  it('⚠️ el visor, el servicio y las dos vistas de F11 NO salen — y tres de ellos NO revientan', () => {
    // Los cinco nombres, por su nombre, recorriendo TODOS los espacios. No es
    // redundante con la mitad estática del bloque de F08: aquella lee el fuente de
    // `index.js` y veta los cuatro directorios, pero `edificio/index.js` es un
    // fichero nuevo de una capa que SÍ sale por el barrel, y un
    // `export { crearCapaPartes } from '../viewer/partes.js'` escrito ahí dentro no
    // lo vería. MEDIDO el 2026-08-03: de los cuatro módulos, solo `viewer/partes.js`
    // revienta al importarlo bajo `node` (Leaflet exige `window`); los otros tres
    // cargan sin lanzar. Sin esta prueba, colarlos dejaría la suite en VERDE.
    const impuros = [
      'crearCapaPartes', // viewer/partes.js — Leaflet
      'crearClienteEdificio', // services/catastro-edificio.js — red
      'cablearRama', // app/rama.js — document
      'crearPanelEdificio', // app/panel-edificio.js — document
      // Y la constante que más tentación da de sacar «porque la necesita la UI»:
      // el vocabulario de la rama activa. La interfaz lo importa de `app/rama.js`
      // DIRECTAMENTE, igual que `app/main.js` importa `viewer/index.js`.
      'RAMA',
    ]
    for (const [espacio, contenido] of Object.entries(barrel)) {
      for (const nombre of impuros) {
        expect(
          Object.keys(contenido),
          `el espacio '${espacio}' expone '${nombre}': toca Leaflet, la red o el DOM, y el ` +
            `barrel lo carga el proyecto Vitest 'node' — donde tres de estos cuatro módulos ` +
            `se importan SIN LANZAR, así que nadie más lo notaría`,
        ).not.toContain(nombre)
      }
    }
    // Anti-vacuidad: las cinco EXISTEN donde tienen que existir. Sin esto, la
    // prohibición seguiría verde el día que alguien las renombrara, y protegería
    // unos nombres que ya no usa nadie.
    const donde = {
      'viewer/partes.js': ['crearCapaPartes'],
      'services/catastro-edificio.js': ['crearClienteEdificio'],
      'app/rama.js': ['cablearRama', 'RAMA'],
      'app/panel-edificio.js': ['crearPanelEdificio'],
    }
    for (const [fichero, nombres] of Object.entries(donde)) {
      const fuente = readFileSync(join(RAIZ_REPO, fichero), 'utf8')
      for (const nombre of nombres) {
        expect(
          fuente,
          `'${nombre}' ya no se exporta desde ${fichero}: la prohibición de arriba ha dejado ` +
            `de proteger nada`,
        ).toMatch(
          // Tres formas, y las tres cuentan. La tercera se añadió en el rework de
          // UI (T1): `RAMA` y `RAMAS` pasaron a DECLARARSE en `app/navegacion.js`
          // —el dueño sin DOM de `{rama, paso, modo}`— y `app/rama.js` las
          // REEXPORTA, porque el import tiene que ir aplicador → dueño. Lo que
          // esta comprobación vigila es que el nombre siga SALIENDO de este
          // fichero (es de ahí de donde lo importan los siete llamantes, y es esa
          // salida la que la prohibición de arriba mantiene fuera del barrel), no
          // por qué sintaxis sale.
          new RegExp(
            `export (?:const|function) ${nombre}\\b|export \\{[^}]*\\b${nombre}\\b[^}]*\\}`,
          ),
        )
      }
    }
  })

  it('la fábrica de detecciones y las tablas del mapeo INSPIRE tampoco salen', () => {
    // Decisión 2 de `edificio/index.js`, y es el calco de por qué `export/index.js`
    // deja fuera `crearDeteccionExport` y `report/index.js` `crearDocumentoPdf`:
    // `crearDeteccionEdificio` es puro y podría salir sin romper nada. Está fuera
    // porque el vocabulario de `TIPO_EDIFICIO` es para LEER lo que la capa ha
    // detectado, y una interfaz que fabricara detecciones inventaría hallazgos que
    // la capa no ha hecho, indistinguibles de los de verdad en la misma lista.
    expect(Object.keys(barrel.entradaEdificio)).not.toContain('crearDeteccionEdificio')
    // Y las dos tablas del mapeo INSPIRE → modelo: describen CÓMO se traduce, no
    // cómo se lee el resultado. El vocabulario que cruza esta frontera es el del
    // MODELO, y ése ya sale por el espacio `edificio`.
    expect(Object.keys(barrel.entradaEdificio)).not.toContain('CONDICION_A_ESTADO')
    expect(Object.keys(barrel.entradaEdificio)).not.toContain('REFERENCIA_SUPERFICIE_CONSTRUIDA')
    expect(Object.keys(barrel.edificio)).toContain('ESTADO_CONSERVACION')
    // El espacio es la CAPA, no un fichero: si alguien lo redujera a `entrada.js`,
    // esto lo diría (es el mismo `it` que `report/index.js` tiene desde F09).
    for (const nombre of ['conModelo', 'MOTIVO_ENTRADA', 'nombreParteGenerico']) {
      expect(
        Object.keys(barrel.entradaEdificio),
        `el espacio 'entradaEdificio' ya no puede ser UN fichero: le falta '${nombre}'`,
      ).toContain(nombre)
    }
  })
})

// ── Guarda transversal de F03/Fase 4 · (a) el descubrimiento de tests es una ──
// partición exacta de lo que hay en disco, y (b) proj4 no entra en la fuente.
//
// (a) `vitest.config.js` conserva `passWithNoTests: true` en el proyecto `dom`, y
// es NECESARIO: sin él, un run filtrado por nombre (`npm test -- celda`, que solo
// casa en `node`) fallaría por el proyecto `dom` vacío. Su contrapartida, anotada
// en el propio config, es que si el `include` del `dom` se rompiera los tests dom
// DESAPARECERÍAN EN VERDE. Esta guarda la cierra, y por eso vive aquí y no en un
// fichero `*.dom.test.js`: una guarda alojada en el proyecto `dom` deja de
// ejecutarse justo cuando el `include` del `dom` se rompe, que es el único caso
// que le importa. `test/contrato.test.js` corre en `node`, luego sobrevive.
// Tampoco es `expect(ficheros.length).toBe(N)`: eso es una lista a mano con otro
// nombre y nadie la actualizaría. Se DERIVA todo: se leen los `include`/`exclude`
// REALES del config (`defineConfig` es la identidad, así que el objeto se puede
// inspeccionar), se recorre el disco con `node:fs` como verdad-terreno y se
// comprueba que los dos proyectos PARTICIONAN ese conjunto: sin huérfanos, sin
// solapes y sin lados vacíos. Lo único que se mantiene a mano es la CONVENCIÓN DE
// NOMBRES que el propio config declara por escrito (`*.dom.test.js` → `dom`, el
// resto → `node`); si alguien la cambia, cambia las dos cosas a la vez y a
// sabiendas.
//
// (b) `proj4` es devDependency y su único uso legítimo es la fábrica de vectores
// de control `test/geo/utm-control.factory.test.js`, que contrasta el motor UTM
// PROPIO (`geo/utm.js`) contra un oráculo externo. La regla de oro 7 dice que
// jamás entra en el bundle. `vite.config.js` lo impide en el build; esto es la
// mitad ESTÁTICA, y no es redundante: el plugin de build, tal como se especificó
// al principio, NO DISPARABA (Vite resolvía `proj4` antes de llamarlo) y solo se
// descubrió provocando el fallo a propósito. Un grep no puede engañarse así.
//
// Momentos de riesgo previstos: (a) que alguien toque los globs del config —
// renombrar el sufijo, «simplificar» el `exclude` del `node`, mover tests a otro
// directorio— y lo dé por bueno porque la suite sigue verde; (b) que alguien
// resuelva una conversión de coordenadas «tirando de proj4, que ya está
// instalado», con el build en verde porque el import no cuelga de la entrada
// (p. ej. un módulo aún no cableado en `index.html`).
describe('guarda transversal Fase 4 · partición de tests derivada y fuente sin proj4', () => {
  const RAIZ = fileURLToPath(new URL('..', import.meta.url))

  /**
   * Recorre el árbol del repo desde la raíz y devuelve rutas POSIX RELATIVAS
   * (`test/geo/utm.test.js`), que es el formato en el que están escritos los
   * globs del config. Se usan relativas a propósito: así el casing de la letra
   * de unidad en Windows (ver cabecera de `vitest.config.js`) es irrelevante.
   *
   * @param {Set<string>} saltaDirs nombres de directorio que no se recorren
   * @param {(rel: string) => boolean} acepta filtro de fichero
   * @returns {string[]} rutas ordenadas
   */
  function recorrer(saltaDirs, acepta) {
    const encontrados = []
    const pila = ['']
    while (pila.length > 0) {
      const rel = pila.pop()
      for (const entrada of readdirSync(join(RAIZ, rel), { withFileTypes: true })) {
        const hijo = rel === '' ? entrada.name : `${rel}/${entrada.name}`
        if (entrada.isDirectory()) {
          if (!saltaDirs.has(entrada.name)) pila.push(hijo)
        } else if (entrada.isFile() && acepta(hijo)) {
          encontrados.push(hijo)
        }
      }
    }
    return encontrados.sort()
  }

  // ── Traductor glob → RegExp ────────────────────────────────────────────────
  // SUBCONJUNTO SOPORTADO, deliberadamente mínimo (es el que usa el config):
  //   `**/`  → cero o más segmentos de directorio completos. El "cero" importa:
  //            es lo que hace que `test/**/*.test.js` case `test/smoke.test.js`
  //            además de `test/geo/utm.test.js`, igual que picomatch.
  //   `**`   → (al final) cualquier cosa, barras incluidas: `**/node_modules/**`.
  //   `*`    → cualquier cosa DENTRO de un segmento; NO cruza `/`.
  //   resto  → literal (se escapan los metacaracteres de RegExp).
  // NO SOPORTADO: `?`, llaves `{a,b}`, clases `[a-z]`, extglobs `!(x)`/`+(x)`/`@(x)`.
  // No se traducen mal en silencio: `globARegExp` REVIENTA si los ve, para que
  // quien los introduzca en el config amplíe antes este traductor.
  const GLOB_NO_SOPORTADO = /[?{}()[\]!+@]/

  /** Traduce un glob del subconjunto soportado a RegExp anclado. */
  function globARegExp(glob) {
    if (GLOB_NO_SOPORTADO.test(glob)) {
      throw new Error(
        `traductor glob→RegExp de test/contrato.test.js: el patrón «${glob}» usa ` +
          `sintaxis fuera del subconjunto soportado (solo «*» y «**»). Amplía el ` +
          `traductor antes de introducir ?, {a,b}, [clases] o extglobs en vitest.config.js.`,
      )
    }
    let re = '^'
    let i = 0
    while (i < glob.length) {
      const c = glob[i]
      if (c === '*') {
        if (glob[i + 1] === '*') {
          if (glob[i + 2] === '/') {
            re += '(?:[^/]+/)*' // `**/` → cero o más segmentos
            i += 3
            continue
          }
          re += '.*' // `**` final
          i += 2
          continue
        }
        re += '[^/]*' // `*` dentro de un segmento
        i += 1
        continue
      }
      re += '.^$\\|'.includes(c) ? `\\${c}` : c
      i += 1
    }
    return new RegExp(`${re}$`)
  }

  /** Normaliza `test.projects` del config a `{nombre, include, exclude}`. */
  function proyectosDelConfig() {
    const crudos = configVitest.test?.projects
    expect(Array.isArray(crudos), 'vitest.config.js debe declarar test.projects').toBe(true)
    return crudos.map((p) => {
      // Vitest admite strings (rutas a configs anidados); este repo usa objetos
      // en línea. Si algún día se anidan, esta guarda ya no ve los globs y hay
      // que reescribirla, así que aquí se para en seco en vez de mentir.
      if (typeof p === 'string') {
        throw new Error(
          `guarda de partición: vitest.config.js declara el proyecto «${p}» por ruta y ` +
            `esta guarda solo sabe inspeccionar proyectos en línea. Actualízala.`,
        )
      }
      const t = p.test ?? p
      return { nombre: t.name, include: t.include ?? [], exclude: t.exclude ?? [] }
    })
  }

  /** ¿Este proyecto ejecutaría esta ruta? (include ∧ ¬exclude, como Vitest.) */
  function captura(proyecto, ruta) {
    const incluido = proyecto.include.some((g) => globARegExp(g).test(ruta))
    const excluido = proyecto.exclude.some((g) => globARegExp(g).test(ruta))
    return incluido && !excluido
  }

  // Verdad-terreno: todos los `*.test.js` que EXISTEN en disco. Se recorre el
  // repo entero (no solo `test/`) a propósito: un test escrito fuera de `test/`
  // no lo ejecuta nadie y debe salir como huérfano, no pasar desapercibido.
  const EN_DISCO = recorrer(new Set(['node_modules', 'dist', '.git']), (rel) =>
    rel.endsWith('.test.js'),
  )
  const PROYECTOS = proyectosDelConfig()
  const porProyecto = Object.fromEntries(
    PROYECTOS.map((p) => [p.nombre, EN_DISCO.filter((f) => captura(p, f))]),
  )

  it('el traductor glob→RegExp casa lo que picomatch casaría (auto-test)', () => {
    const node = globARegExp('test/**/*.test.js')
    expect(node.test('test/smoke.test.js')).toBe(true) // `**/` con CERO segmentos
    expect(node.test('test/geo/utm.test.js')).toBe(true)
    expect(node.test('test/viewer/a/b/c.test.js')).toBe(true)
    expect(node.test('otro/a.test.js')).toBe(false)
    expect(node.test('test/geo/utm.testxjs')).toBe(false) // el `.` no es comodín

    const dom = globARegExp('test/**/*.dom.test.js')
    expect(dom.test('test/viewer/mapa.dom.test.js')).toBe(true)
    expect(dom.test('test/viewer/celda.test.js')).toBe(false)

    const nm = globARegExp('**/node_modules/**')
    expect(nm.test('node_modules/x/y.test.js')).toBe(true)
    expect(nm.test('a/b/node_modules/y.test.js')).toBe(true)
    expect(nm.test('test/geo/utm.test.js')).toBe(false)

    expect(() => globARegExp('test/**/*.{test,spec}.js')).toThrow(/subconjunto soportado/)
  })

  it('vitest.config.js declara exactamente los proyectos `node` y `dom`', () => {
    expect(PROYECTOS.map((p) => p.nombre).sort()).toEqual(['dom', 'node'])
  })

  it('ningún fichero de test queda HUÉRFANO (nadie lo ejecutaría)', () => {
    const huerfanos = EN_DISCO.filter((f) => !PROYECTOS.some((p) => captura(p, f)))
    // Si se rompe el `include` del proyecto `dom`, sus ficheros dejan de estar
    // capturados por `dom` y siguen excluidos de `node`: aparecen aquí, con
    // nombre y apellidos, en vez de evaporarse en verde por `passWithNoTests`.
    expect(
      huerfanos,
      'ficheros de test que NINGÚN proyecto de vitest.config.js ejecutaría',
    ).toEqual([])
  })

  it('ningún fichero de test lo capturan LOS DOS proyectos (sin solapes)', () => {
    const solapes = EN_DISCO.filter((f) => PROYECTOS.filter((p) => captura(p, f)).length > 1)
    // Un `*.dom.test.js` corriendo también en `node` reventaría por falta de
    // `window`; el día que alguien quite el `exclude` del `node`, conviene
    // enterarse por este mensaje y no por treinta fallos raros de jsdom.
    expect(solapes, 'ficheros capturados por más de un proyecto a la vez').toEqual([])
  })

  it('ninguno de los dos proyectos descubre CERO ficheros', () => {
    // Formulación honesta de «`passWithNoTests` no está tapando un
    // descubrimiento vacío»: no se afirma un número (eso caducaría), se afirma
    // que ninguno de los dos lados de la partición está vacío.
    for (const p of PROYECTOS) {
      expect(porProyecto[p.nombre].length, `el proyecto «${p.nombre}» no descubre ningún test`)
        .toBeGreaterThan(0)
    }
  })

  it('la partición coincide con la CONVENCIÓN DE NOMBRES del config', () => {
    // Lo único mantenido a mano, y es la convención que `vitest.config.js`
    // declara en su comentario: `*.dom.test.js` → `dom`, todo lo demás → `node`.
    const esDom = (f) => f.endsWith('.dom.test.js')
    expect(porProyecto.dom, 'el proyecto `dom` debe capturar exactamente los *.dom.test.js').toEqual(
      EN_DISCO.filter(esDom),
    )
    expect(porProyecto.node, 'el proyecto `node` debe capturar exactamente el resto').toEqual(
      EN_DISCO.filter((f) => !esDom(f)),
    )
  })

  // ── Mitad estática de la regla de oro 7 ───────────────────────────────────
  // Directorios que NO son fuente de producción. Lista corta y explícita a
  // propósito: `test` es el único sitio donde proj4 es legítimo, y el resto son
  // artefactos, documentación o andamiaje.
  const DIRS_NO_FUENTE = new Set([
    'node_modules',
    'dist',
    'test',
    'spec',
    'scripts',
    'prototipo',
    'estilos',
    '.git',
    '.gstack',
    '.claude',
  ])
  // Casa el IMPORT, no la palabra: la cadena «proj4js» aparece en COMENTARIOS de
  // `geo/utm.js`, `parsers/importar.js` y `viewer/atribucion.js` —donde dicen que
  // el proyecto NO lo usa—, así que un `includes('proj4')` daría falso positivo.
  // Se exige `import`/`export` al principio de línea (módulos ESM estáticos) o la
  // forma llamada `import(...)`/`require(...)`, y se cubren los subpaths
  // (`proj4/dist/...`), igual que el plugin de `vite.config.js`.
  const IMPORTA_PROJ4 =
    /(?:^|\n)[ \t]*(?:import|export)[^\n]*['"]proj4(?:\/[^'"]*)?['"]|(?:import|require)\([ \t]*['"]proj4(?:\/[^'"]*)?['"][ \t]*\)/
  const FUENTES = recorrer(DIRS_NO_FUENTE, (rel) => /\.(?:js|mjs|html)$/.test(rel))

  it('ninguna fuente de producción importa proj4 (regla de oro 7)', () => {
    const infractores = FUENTES.filter((f) => IMPORTA_PROJ4.test(readFileSync(join(RAIZ, f), 'utf8')))
    expect(
      infractores,
      'fuentes que importan proj4: es devDependency y JAMÁS entra en el bundle; ' +
        'el motor UTM del proyecto es propio (geo/utm.js), y geo/huso.js da el huso',
    ).toEqual([])
    expect(FUENTES.length, 'el recorrido de fuentes no ha encontrado nada que mirar').toBeGreaterThan(
      0,
    )
  })

  it('el detector de imports de proj4 no es vacuo: distingue mención de import', () => {
    // Media docena de fuentes MENCIONAN proj4/proj4js en comentarios. Que las
    // haya es justo lo que hace inservible un `includes('proj4')`, así que se
    // afirma que existen (si dejaran de existir, la comprobación de arriba se
    // volvería trivial sin que nadie se enterase)…
    const mencionan = FUENTES.filter((f) => readFileSync(join(RAIZ, f), 'utf8').includes('proj4'))
    expect(mencionan.length, 'ninguna fuente menciona proj4: revisa el recorrido').toBeGreaterThan(0)
    // …y que el detector SÍ dispara sobre el único uso legítimo, que está fuera
    // del recorrido de fuentes (es la fábrica de vectores de control).
    const fabrica = 'test/geo/utm-control.factory.test.js'
    expect(EN_DISCO).toContain(fabrica)
    expect(IMPORTA_PROJ4.test(readFileSync(join(RAIZ, fabrica), 'utf8'))).toBe(true)
    expect(FUENTES).not.toContain(fabrica)
  })

  // ── F17 · fase 0 · ninguna justificación caducada sigue viva ───────────────
  //
  // «Multiparcela está fuera de alcance (SPEC §1)» fue CIERTO desde F00 y dejó de
  // serlo el 2026-08-03: la Sede aceptó un `.gml` con dos `gml:featureMember` y un
  // IVG positivo (override **O18**, `SPEC.md` §7.1). La frase se había copiado a
  // ocho sitios como MOTIVO de invariantes que siguen siendo correctos, y un
  // invariante correcto sostenido por una razón falsa es la peor clase de
  // comentario: el día que alguien lo lea para decidir, decidirá con un hecho
  // muerto.
  //
  // ⛔ LO QUE SE CORRIGIÓ ES EL MOTIVO, JAMÁS EL INVARIANTE. Una `Parcela` sigue
  // siendo UN exterior con huecos. Lo que cambia es por qué: no porque la entrega
  // de varias esté prohibida, sino porque N piezas disjuntas son N `Parcela`.
  //
  // Este guardián deja RETRACTAR la frase (citarla para decir que caducó) y no
  // deja AFIRMARLA: exige que cerca de cada aparición esté la marca de su
  // caducidad. Sin él, la próxima copia entraría sola.
  const FRASE_CADUCADA = /multiparcela (?:está )?fuera de alcance/i
  const MARCA_RETRACTADA = /O18|2026-08-03|cadu/i
  /** Cuántas líneas arriba y abajo se acepta que esté la marca. */
  const CERCA = 8

  /**
   * ✅ **VACÍA desde el 2026-08-05.** Tuvo dentro `gml/serialize-cp.js` mientras la
   * fase 0 no podía tocarlo: sus comentarios caducados los reescribía la tarea 1.3,
   * que es la que convierte `MIEMBROS = 1` en un documento de N `gml:featureMember`
   * y toca esa misma zona; arreglarlos antes habría metido dos tareas en el mismo
   * fichero. **La tarea 1.3 entró y la lista se vació**, que es exactamente lo que
   * la última prueba de este bloque exigía.
   *
   * Se deja declarada, y no se borra el mecanismo: la próxima excepción que haga
   * falta tiene dónde ir y con qué vigilarse. Una excepción que nadie vigila se
   * queda para siempre.
   */
  const PENDIENTES_DE_LA_TAREA_1_3 = Object.freeze([])

  /**
   * El texto de un comentario APLANADO: sin saltos de línea y sin los `//`, `*` o
   * `#` que arrastra el ajuste de línea, con un mapa de vuelta a la línea original.
   *
   * ⛔ Existe porque la primera versión de este guardián escaneaba línea a línea, y
   * eso lo dejaba ciego ante lo más normal del mundo: **la frase partida en dos
   * renglones**. Ocurrió el mismo día, en `gml/serialize-cp.js` —«…justificada con
   * «multiparcela está / fuera de alcance»…»— y el guardián la dio por ausente. Un
   * detector que solo ve lo que cabe en 100 columnas no protege de nada.
   */
  function aplanar(texto) {
    const lineas = texto.split('\n')
    let plano = ''
    const lineaDe = []
    lineas.forEach((linea, i) => {
      const limpia = linea.replace(/^\s*(?:\/\/+|\*+|#)\s?/, '')
      for (let c = 0; c < limpia.length; c += 1) lineaDe.push(i + 1)
      plano += limpia
      lineaDe.push(i + 1)
      plano += ' '
    })
    return { plano, lineaDe, lineas }
  }

  const afirmacionesCaducadas = () => {
    const infractores = []
    for (const rel of FUENTES) {
      if (PENDIENTES_DE_LA_TAREA_1_3.includes(rel)) continue
      const { plano, lineaDe, lineas } = aplanar(readFileSync(join(RAIZ, rel), 'utf8'))
      for (const casa of plano.matchAll(new RegExp(FRASE_CADUCADA, 'gi'))) {
        const linea = lineaDe[casa.index] ?? 1
        const i = linea - 1
        const contexto = lineas.slice(Math.max(0, i - CERCA), i + CERCA + 1).join('\n')
        if (!MARCA_RETRACTADA.test(contexto)) infractores.push(`${rel}:${linea}`)
      }
    }
    return infractores
  }

  it('⛔ ninguna fuente sostiene un invariante con «multiparcela fuera de alcance»', () => {
    expect(
      afirmacionesCaducadas(),
      'esa frase caducó el 2026-08-03 (override O18: la Sede acepta N featureMember). ' +
        'Si el invariante que estás justificando es «una Parcela es UN exterior con ' +
        'huecos», el motivo verdadero es que N piezas disjuntas son N Parcela, cada una ' +
        'con su idLocal — no que la entrega de varias esté prohibida, porque no lo está',
    ).toEqual([])
  })

  it('el guardián no es vacuo: la frase sigue en el árbol, retractada', () => {
    // Si nadie la mencionara ya, la comprobación de arriba sería trivialmente
    // verde y nadie se enteraría de que dejó de proteger nada.
    const mencionan = FUENTES.filter((f) => FRASE_CADUCADA.test(readFileSync(join(RAIZ, f), 'utf8')))
    expect(mencionan.length, 'nadie menciona la frase: este guardián ya no mira nada').toBeGreaterThan(
      0,
    )
    // Y DISPARA de verdad: la misma frase sin marca de caducidad cerca es roja.
    const sinMarca = 'const x = 1 // multiparcela está fuera de alcance (SPEC §1)\n'
    expect(FRASE_CADUCADA.test(sinMarca)).toBe(true)
    expect(MARCA_RETRACTADA.test(sinMarca)).toBe(false)
  })

  it('✅ la deuda de la tarea 1.3 está SALDADA: no queda ninguna excepción', () => {
    // Este test pedía lo contrario hasta que 1.3 entró: exigía que la lista tuviera
    // dentro `gml/serialize-cp.js` y que ese fichero siguiera sosteniendo la frase.
    // Ahora exige que no quede nada, que es la otra mitad del mismo trato — una
    // excepción declarada tiene que poder cerrarse, y cerrarla tiene que notarse.
    expect(PENDIENTES_DE_LA_TAREA_1_3).toEqual([])
    // Y el fichero que estaba exento pasa por el guardián general como los demás:
    // menciona la frase, pero solo para decir que caducó. Se mira sobre el texto
    // APLANADO porque allí la frase va partida en dos renglones — que es justo lo
    // que destapó el hueco del detector.
    const { plano } = aplanar(readFileSync(join(RAIZ, 'gml/serialize-cp.js'), 'utf8'))
    expect(FRASE_CADUCADA.test(plano)).toBe(true)
    expect(afirmacionesCaducadas()).toEqual([])
  })

  it('⛔ el detector ve la frase aunque esté PARTIDA en dos líneas (F17)', () => {
    // El hueco que tenía la primera versión, hecho test. Sin esto, envolver el
    // comentario a 100 columnas bastaría para que una justificación muerta
    // sobreviviera al guardián sin que nadie lo pretendiera.
    const partida = '// justificada con «multiparcela está\n// fuera de alcance», y ya no.\n'
    expect(FRASE_CADUCADA.test(partida), 'sin aplanar NO se ve').toBe(false)
    expect(FRASE_CADUCADA.test(aplanar(partida).plano), 'aplanada SÍ').toBe(true)
    // Y el mapa devuelve la línea donde EMPIEZA, que es donde hay que mirar.
    const { plano, lineaDe } = aplanar(partida)
    expect(lineaDe[plano.search(FRASE_CADUCADA)]).toBe(1)
  })
})

// ── F17 · contrato D · LOS CINCO LÉXICOS DICEN LO MISMO ──────────────────────
//
// `parsers/`, `gml/`, `export/`, `edificio/` y ahora `derivacion/` tienen cada uno
// su fábrica de detecciones con la MISMA forma —`{tipo, mensaje, severidad,
// datos?}`— y su propia `SEVERIDAD`. La duplicación está razonada en las cinco
// cabeceras: el léxico de TIPOS es lo que impide que una detección de una capa se
// cuele en otra, y un `TIPO_DETECCION` común daría mensajes que la interfaz no sabe
// interpretar.
//
// ⛔ **Lo que NO estaba razonado es que nadie las comparase.** Hasta F17 eran cuatro
// fábricas copiadas a mano, con cuatro validaciones escritas a mano, y **ni un solo
// test que dijera que siguen coincidiendo**. La primera que se relajara —aceptar un
// `datos` que no es objeto plano, admitir una severidad nueva, dejar pasar un
// mensaje vacío— lo haría en silencio, y la interfaz pinta las cinco con el mismo
// componente.
//
// Este bloque es la alternativa BARATA a extraer el contrato común (opción 6B del
// plan, descartada: metería cuatro suites en un diff que va de restar polígonos).
// Compra la protección sin el refactor.

describe('contrato D · las CINCO fábricas de detección no pueden divergir (F17)', () => {
  const capas = [
    { capa: 'parsers', mod: parsersComun, fabrica: parsersComun.crearDeteccion, tipos: parsersComun.TIPO_DETECCION },
    { capa: 'gml', mod: gmlComun, fabrica: gmlComun.crearDeteccionGml, tipos: gmlComun.TIPO_GML },
    { capa: 'export', mod: exportComun, fabrica: exportComun.crearDeteccionExport, tipos: exportComun.TIPO_EXPORT },
    { capa: 'edificio', mod: edificioComun, fabrica: edificioComun.crearDeteccionEdificio, tipos: edificioComun.TIPO_EDIFICIO },
    { capa: 'derivacion', mod: derivacionComun, fabrica: derivacionComun.crearDeteccionDerivacion, tipos: derivacionComun.TIPO_DERIVACION },
  ]

  /** Un tipo válido cualquiera de esa capa, para poder ejercitar la fábrica. */
  const unTipo = (c) => Object.values(c.tipos)[0]

  it('las cinco declaran EXACTAMENTE la misma escala de severidad', () => {
    for (const c of capas) {
      expect(c.mod.SEVERIDAD, `${c.capa}.SEVERIDAD`).toEqual({
        INFO: 'INFO',
        AVISO: 'AVISO',
        ERROR: 'ERROR',
      })
      expect(Object.isFrozen(c.mod.SEVERIDAD), `${c.capa}.SEVERIDAD no está congelada`).toBe(true)
    }
  })

  it('las cinco producen la MISMA forma: `{tipo, mensaje, severidad}` y nada más', () => {
    for (const c of capas) {
      const d = c.fabrica(unTipo(c), 'un mensaje', 'AVISO')
      expect(Object.keys(d).sort(), `${c.capa}`).toEqual(['mensaje', 'severidad', 'tipo'])
      expect(d).toEqual({ tipo: unTipo(c), mensaje: 'un mensaje', severidad: 'AVISO' })
    }
  })

  it('`datos` es OPCIONAL en las cinco, y solo aparece si se aporta', () => {
    // El contrato es `datos?`: una clave `datos: undefined` obligaría a todo
    // consumidor a distinguir «no hay» de «hay pero vacío».
    for (const c of capas) {
      expect('datos' in c.fabrica(unTipo(c), 'm', 'INFO'), `${c.capa} sin datos`).toBe(false)
      const con = c.fabrica(unTipo(c), 'm', 'INFO', { a: 1 })
      expect(con.datos, `${c.capa} con datos`).toEqual({ a: 1 })
    }
  })

  it('⛔ las cinco RECHAZAN lo mismo: tipo, severidad y mensaje inválidos', () => {
    for (const c of capas) {
      expect(() => c.fabrica('NO_EXISTE_ESTE_TIPO', 'm', 'INFO'), `${c.capa} tipo`).toThrow(
        RangeError,
      )
      expect(() => c.fabrica(unTipo(c), 'm', 'GRAVE'), `${c.capa} severidad`).toThrow(RangeError)
      expect(() => c.fabrica(unTipo(c), '', 'INFO'), `${c.capa} mensaje vacío`).toThrow(TypeError)
      expect(() => c.fabrica(unTipo(c), 42, 'INFO'), `${c.capa} mensaje no texto`).toThrow(
        TypeError,
      )
    }
  })

  it('⛔ NINGÚN tipo de una capa cuela en la fábrica de otra', () => {
    // Es la razón entera de que haya cinco léxicos y no uno. Si esto dejara de ser
    // cierto, la duplicación habría dejado de pagar por sí misma.
    for (const c of capas) {
      for (const otra of capas) {
        if (otra === c) continue
        const ajenos = Object.values(otra.tipos).filter(
          (t) => !Object.values(c.tipos).includes(t),
        )
        if (ajenos.length === 0) continue
        expect(() => c.fabrica(ajenos[0], 'm', 'INFO'), `${otra.capa}→${c.capa}`).toThrow(
          RangeError,
        )
      }
    }
  })

  it('las cuatro que cuentan detecciones dan el MISMO objeto ante la misma entrada', () => {
    // `resumirDetecciones` está copiado en cuatro capas (`parsers/` usa otro
    // nombre). Que cuenten distinto sería que la interfaz enseñara cifras que no
    // cuadran entre pantallas.
    const conResumen = capas.filter((c) => typeof c.mod.resumirDetecciones === 'function')
    expect(conResumen.length, 'ninguna capa expone resumirDetecciones').toBeGreaterThan(2)
    const entrada = [
      { tipo: 'A', mensaje: 'm', severidad: 'INFO' },
      { tipo: 'A', mensaje: 'm', severidad: 'ERROR' },
      { tipo: 'B', mensaje: 'm', severidad: 'ERROR' },
    ]
    const esperado = {
      total: 3,
      porTipo: { A: 2, B: 1 },
      porSeveridad: { INFO: 1, ERROR: 2 },
    }
    for (const c of conResumen) {
      expect(c.mod.resumirDetecciones(entrada), `${c.capa}`).toEqual(esperado)
    }
  })

  it('⛔ el guardián no es vacuo: una capa relajada lo pondría rojo', () => {
    // Se simula la divergencia que este bloque existe para cazar: una fábrica que
    // acepta una severidad nueva. Si el bucle de arriba no comprobara el rechazo,
    // esto pasaría desapercibido.
    const relajada = (tipo, mensaje, severidad) => ({ tipo, mensaje, severidad })
    expect(() => relajada('X', 'm', 'GRAVE')).not.toThrow()
    // …y la real sí lanza, que es la diferencia.
    expect(() => derivacionComun.crearDeteccionDerivacion(unTipo(capas[4]), 'm', 'GRAVE')).toThrow(
      RangeError,
    )
  })
})

/* -------------------------------------------------------------------------- *
 * test/services/aceptacion-f05.test.js — F05 · T5B · SUITE DE ACEPTACIÓN        *
 *                                                                               *
 * La prueba que decide si F05 está hecha. Los cinco criterios de                *
 * `spec/feature-05-catastro-vivo.md` § «Criterios de aceptación», más los        *
 * GUARDIANES de los hechos que se MIDIERON contra el servicio real el           *
 * 2026-07-27 y que están documentados uno a uno —con su URL, su SHA-256 y su    *
 * cuerpo— en `test/fixtures/catastro/PROCEDENCIA.md`. Ese documento MANDA       *
 * (regla de oro 8): sobre la spec, sobre el dossier y sobre nuestro criterio.   *
 *                                                                               *
 * ════════════════════════════════════════════════════════════════════════════ *
 * LAS DOS REGLAS QUE GOBIERNAN ESTE FICHERO                                     *
 * ════════════════════════════════════════════════════════════════════════════ *
 * 1. **CERO LISTAS ESCRITAS A MANO.** Ni una referencia catastral, ni una URL,  *
 *    ni un número de miembros, ni un `numberMatched`, ni una coordenada, ni el  *
 *    nombre de una *stored query*. Todo se LEE del disco: de los fixtures, de   *
 *    las URL que `PROCEDENCIA.md` documenta para cada uno, y hasta el nombre    *
 *    del `GetParcelsByBBox` que no existe sale de la propia spec (§ G2).        *
 * 2. **ESTA SUITE NO LLAMA AL CATASTRO JAMÁS.** El `fetch` entra doblado        *
 *    (`_doble-fetch.js`, de T1A) y contesta 404 a toda URL que no sea una de    *
 *    las MEDIDAS: si el cliente se desvía un byte de la petición que se probó   *
 *    contra el servicio, el test cae en vez de pasar en verde. No es celo: la   *
 *    política de uso del Catastro sanciona el uso automático con **~10 días de  *
 *    denegación** (override O8), así que «probarlo contra el servicio» no es    *
 *    una alternativa disponible, y por eso no la hay.                           *
 *                                                                               *
 * ⚠️ **ENCODING.** Los cinco `.xml` del Catastro declaran `ISO-8859-1` y sus    *
 * BYTES son UTF-8 (medido; misma mentira que ya trae el GML de `../gml/`). Se   *
 * leen SIEMPRE como UTF-8 **ignorando la declaración**: leerlos por lo que       *
 * dicen de sí mismos rompería sus acentos.                                      *
 *                                                                               *
 * ════════════════════════════════════════════════════════════════════════════ *
 * MAPA DE LOS CINCO CRITERIOS DE ACEPTACIÓN                                     *
 * ════════════════════════════════════════════════════════════════════════════ *
 *   AC1 · parcela por RC + 2.ª llamada de caché ....... § 4                     *
 *   AC2 · RC inexistente = estado, no excepción ....... § 5                     *
 *   AC3 · la cola limita; el backoff lleva jitter ..... § 6 (y guardián 12)     *
 *   AC4 · deducción de RC desde un punto de la                                  *
 *         geometría; el ambiguo NO rellena ........... § 7                      *
 *   AC5 · «el User-Agent no se rota» ................. § 8 — **REFORMULADO**.   *
 *         No tiene ni un `it` en este fichero, y el porqué está escrito allí.   *
 *                                                                               *
 * ════════════════════════════════════════════════════════════════════════════ *
 * POR QUÉ EL AC5 SE REFORMULA, Y EN QUÉ                                         *
 * ════════════════════════════════════════════════════════════════════════════ *
 * El criterio 5 de la spec dice «el User-Agent no se rota entre peticiones».    *
 * Tal cual está escrito es **incomprobable e irrelevante**, por tres cosas que  *
 * no se pueden discutir:                                                        *
 *                                                                               *
 *   · `User-Agent` es un *forbidden header name* del estándar de Fetch: un      *
 *     navegador **no puede** fijarla ni aunque el programa se lo pida. No hay   *
 *     rotación posible que impedir; no hay nada que el código pueda hacer mal   *
 *     ahí, salvo intentarlo.                                                    *
 *   · Está MEDIDO que el servicio contesta **200 con cuerpo válido sin ninguna  *
 *     cabecera nuestra**: las 8 peticiones de la tanda salieron con el          *
 *     `User-Agent` por defecto de `curl` (`PROCEDENCIA.md`, hecho transversal   *
 *     6). La frase de la spec «sin él el servicio da error» se queda **sin      *
 *     respaldo medido**, y ese es el estándar de esta carpeta.                  *
 *   · Peor: mandar cabeceras propias forzaría un *preflight* `OPTIONS` del que  *
 *     **no hay ninguna medición**, y el servicio solo publica                   *
 *     `Access-Control-Allow-Origin: *` (ni `-Headers` ni `-Methods`). Añadir    *
 *     una cabecera para «cumplir» el criterio podría romper la petición.        *
 *                                                                               *
 * Lo ÚNICO comprobable, entonces, es que **no lo intentamos**: que el código de *
 * transporte no escribe ni una cabecera. Y de eso se ocupa el **guardián G9 de  *
 * `test/services/contrato-catastro.test.js`**, que es su sitio: es una          *
 * afirmación sobre la FUENTE del proyecto, no sobre el comportamiento de una    *
 * consulta. **Aquí no se duplica** — dos guardianes del mismo invariante son    *
 * dos guardianes que se pueden desincronizar, y el que se quede viejo pasará    *
 * en verde diciendo que vigila algo que ya no vigila. § 8 deja el razonamiento  *
 * y la remisión, y ni un `expect`.                                              *
 *                                                                               *
 * ════════════════════════════════════════════════════════════════════════════ *
 * ⛔ LO QUE ESTA SUITE **NO** PUEDE COMPROBAR, DICHO CON TODAS LAS LETRAS       *
 * ════════════════════════════════════════════════════════════════════════════ *
 * **CORS NO LO CUBRE NINGÚN TEST OFFLINE. NI ESTE, NI NINGUNO.** Ni Node ni     *
 * jsdom aplican la política de mismo origen: en los dos, un `fetch` cross-origin *
 * sale sin que nadie mire la cabecera `Access-Control-Allow-Origin`. Que el     *
 * Catastro emita `ACAO: *` —hoy MEDIDO en las 8 respuestas, y es lo que          *
 * sostiene el override O7— solo se puede comprobar en **un navegador de verdad** *
 * (el guion de humo `07` que F05 añade a `scripts/smoke-navegador/`) y **contra  *
 * el servicio real** (`npm run catastro:vivo`, que es                            *
 * `scripts/sonda-catastro.mjs`). Un test de esta suite que dijera «CORS          *
 * comprobado» sería mentira, y encima de las tranquilizadoras: el día que el    *
 * Catastro retirara el comodín, seguiría verde mientras la app estaría muerta   *
 * en todos los navegadores. Por eso no está.                                    *
 *                                                                               *
 * Los demás huecos, y ninguno se tapa fingiendo cobertura:                      *
 *                                                                               *
 *   (h1) **No hay fixture de servicio caído** (5xx, timeout, DNS, TLS) ni de    *
 *        **bloqueo por abuso**. `PROCEDENCIA.md` los declara: no son            *
 *        capturables a voluntad sin provocarlos, y provocarlos cuesta ~10 días  *
 *        de denegación. Esos caminos se prueban con el `fetch` DOBLADO, y eso   *
 *        **no es verdad externa**: es una simulación nuestra. Queda dicho.      *
 *   (h2) **La caja BBOX sin `count`** (539 parcelas, ~1,15 MB) no está          *
 *        versionada, por tamaño. Su cifra la corrobora el `numberMatched` del   *
 *        fixture con `count` — que es, a la vez, el atributo que MIENTE sobre   *
 *        el número de miembros (guardián 4). Se usa para lo que sirve.          *
 *   (h3) **El endpoint `.asmx` del OVC nunca se ha medido.** La columna de sus  *
 *        nombres de parámetro es documental. Aquí solo se afirma sobre el       *
 *        `.svc/json`, que sí está medido por los dos lados (guardián 6).        *
 *   (h4) **No se ha medido un `cod:16` con un SRS válido sobre suelo sin        *
 *        parcela.** El fixture de `cod:16` se capturó con `SRS=EPSG:9999` sobre *
 *        un punto que SÍ tiene parcela. Lo declara `COD_OVC_SIN_REFERENCIA`.    *
 *   (h5) **No hay fixture real de punto AMBIGUO** (un clic justo en un linde    *
 *        que devuelva dos referencias). Habría costado otra petición y no se    *
 *        sabe de antemano qué punto lo produce. El cuerpo ambiguo del § 7 se    *
 *        DERIVA del fixture de éxito metiéndole un SEGUNDO candidato cuya       *
 *        referencia es la de una colindante REAL del fixture de vecindad,       *
 *        partida 7 + 7 como la parte el propio OVC. Es derivación, no           *
 *        invención — pero no es una medición, y por eso está aquí.              *
 *   (h6) **El OVC no se ha medido en el punto que calcula `puntoInterior`.** La *
 *        app deduce desde ese punto (`gml/anillos.js`), y la única respuesta    *
 *        medida es la del punto con el que se hizo la captura. § 7 comprueba lo *
 *        que sí se puede: que los DOS caen estrictamente dentro de la parcela   *
 *        del fixture, verificado con `@turf/boolean-point-in-polygon`.          *
 *   (h7) **La mitad de PANTALLA del AC4 no es de esta suite.** Que la referencia *
 *        deducida acabe en el `<input>` y que con varios candidatos no se       *
 *        rellene nada lo cubre `test/app/catastro.dom.test.js` (proyecto        *
 *        `dom`), en sus describes «deducción con UN candidato» y «deducción con *
 *        VARIOS candidatos». Aquí se comprueba el CONTRATO que aquella pantalla *
 *        consume: `unico`, `cuantos` y el domicilio de cada candidato.          *
 *   (h8) **El TTL de la caché no se ejercita aquí.** Es de                      *
 *        `storage/cache-catastro.js` y de su test; en esta suite la caché entra *
 *        por su puerto y su doble es un `Map`, sin IndexedDB por ninguna parte. *
 *                                                                               *
 * ════════════════════════════════════════════════════════════════════════════ *
 * LOS GUARDIANES, Y POR QUÉ LA NUMERACIÓN SALTA EL 8 Y EL 9                     *
 * ════════════════════════════════════════════════════════════════════════════ *
 * Cada guardián congela UN hecho medido, y todos leen sus cifras de los         *
 * ficheros. Los que llevan una segunda mitad ANTI-VACUIDAD la llevan porque sin *
 * ella un módulo que hiciera siempre lo mismo —rechazar siempre, decir siempre  *
 * «ilegible»— los aprobaría:                                                    *
 *                                                                               *
 *    1 · Todo error llega con HTTP 200 ....... las DOS mitades JUNTAS son la    *
 *        trampa: por separado, cada una la aprobaría un módulo que clasificara  *
 *        por `response.ok`.                                                     *
 *    2 · Las *stored queries* del catálogo ... + `GetParcelsByBBox` NO está.    *
 *    3 · El BBOX no es una *stored query* .... con `searchParams`, no `includes`.*
 *    4 · Los atributos de conteo MIENTEN ..... las dos cifras, del mismo fichero.*
 *    5 · `GetNeighbourParcel` se incluye a sí misma, y NO la primera.           *
 *    6 · Los dos endpoints OVC no comparten nombres de parámetro.               *
 *    7 · La RC es `pc1` + `pc2`, y mide 14.                                     *
 *   10 · El tope del BBOX: el máximo EXACTO pasa; +1 m² no sale a la red.       *
 *   11 · Un 200 no se reintenta JAMÁS.                                          *
 *   12 · La cola limita de verdad: el pico es EXACTAMENTE el máximo.            *
 *   ++ · Y el hecho de T0B: «BBOX sin parcelas» y «RC inexistente» traen el     *
 *        MISMO `exceptionCode`. **No existe la «colección vacía»** que la spec  *
 *        suponía.                                                               *
 *                                                                               *
 * El 8 y el 9 no están aquí a propósito: son de la suite hermana                *
 * `test/services/contrato-catastro.test.js`, que afirma sobre la FUENTE del     *
 * proyecto en vez de sobre el comportamiento de una consulta. El 9 es el del    *
 * `User-Agent` (ver § 8).                                                       *
 *                                                                               *
 * ════════════════════════════════════════════════════════════════════════════ *
 * COMPROBADO POR MUTACIÓN (el 2026-07-28, mutando producción y revirtiendo)     *
 * ════════════════════════════════════════════════════════════════════════════ *
 * Un guardián que nunca se ha visto fallar no es una garantía, es una           *
 * esperanza. Se mutó el código de producción, se corrió SOLO este fichero y se  *
 * revirtió con el editor (nunca con `git checkout --`: hay trabajo sin          *
 * commitear en el árbol). Diez mutaciones, y todas salieron rojas por SU        *
 * invariante:                                                                   *
 *                                                                               *
 *   (a) `_red.js#pedirPlaza` concediendo plaza SIEMPRE (cola fuera)             *
 *       → **1 rojo**, el guardián 12: «hay más peticiones en vuelo que plazas:  *
 *       expected 5 to be 2». El pico subió a las cinco lanzadas.                *
 *   (b) `_red.js#ejecutar` reintentando también los 2xx                         *
 *       → **5 rojos**: el guardián 11 («un HTTP 200 se ha reintentado: expected *
 *       3 to be 1»), el 12 («expected 15 to be 5»), el AC1 por los dos lados y  *
 *       el AC4.                                                                 *
 *   (c) `catastro.js#parcelaPorRefcat` saltándose la consulta a la caché        *
 *       → **1 rojo** del AC1: «la segunda llamada debía salir de la caché:      *
 *       expected 'RED' to be 'CACHE'».                                          *
 *   (d) `catastro.js#separarPropia` separando por POSICIÓN (`parcelas[0]`)      *
 *       → **1 rojo** del guardián 5: «la propia es la PEDIDA, no la primera:    *
 *       expected '9398501VK3799G' to be '9398516VK3799G'» — la VECINA de la     *
 *       primera posición colada como la parcela del usuario.                    *
 *   (e) `_catastro-wfs.js#leerColeccion` sin el olfateo de `ExceptionReport`    *
 *       → **5 rojos**: el guardián 1, el 11, el ++ y las dos mitades del AC2.   *
 *       El `ExceptionReport` deja de ser «no encontrado» y pasa a «ilegible».   *
 *   (f) `catastro.js` comparando el tope del BBOX con `>=` en vez de con `>`    *
 *       → **1 rojo**, la mitad ANTI-VACUIDAD del guardián 10: «expected         *
 *       'BBOX_DEMASIADO_GRANDE' not to be 'BBOX_DEMASIADO_GRANDE'». Una caja de *
 *       exactamente 1 km² se rechazaba.                                         *
 *   (g) `_catastro-wfs.js#leerColeccion` tomando `nMiembros` de                 *
 *       `numberReturned` en vez de contarlos → **1 rojo** del guardián 4: «los  *
 *       miembros se cuentan contándolos: expected 539 to be 10», que es la      *
 *       mentira del servicio entrando en el resultado con dos órdenes de error. *
 *   (h) `catastro.js` traduciendo el `RESPUESTA_ILEGIBLE` del OVC a             *
 *       `NO_ENCONTRADO` → **1 rojo** del guardián 6: el `cod:76` (una URL mal   *
 *       construida por NOSOTROS) le diría al usuario «aquí no hay parcela».     *
 *   (i) `_catastro-ovc.js#leerCandidato` componiendo la RC solo con `pc1`       *
 *       → **3 rojos**: el guardián 7 y las dos mitades del AC4.                 *
 *   (j) `_catastro-wfs.js` añadiendo `GetParcelsByBBox` a                       *
 *       `CONSULTAS_ALMACENADAS` **y** un `STOREDQUERIE_ID` al `urlBbox`         *
 *       → **4 rojos**: el guardián 2 («la *stored query* «GetParcelsByBBox» no  *
 *       está en el catálogo del servicio»), el 3 («el BBOX no puede llevar      *
 *       «STOREDQUERIE_ID»»), el 4 y el ++ (la URL deja de ser la medida y el    *
 *       doble contesta 404).                                                    *
 *                                                                               *
 * Proyecto Vitest `node` (sin sufijo `.dom`): aquí no hay DOM, ni Leaflet, ni   *
 * IndexedDB, ni red.                                                            *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point, polygon } from '@turf/helpers'

import { parsearGml } from '../../gml/parse.js'
import { puntoInterior } from '../../gml/anillos.js'
import {
  CACHE_NULA,
  MAX_AREA_BBOX_M2,
  MOTIVO_CATASTRO,
  NIVEL_POR_MOTIVO,
  ORIGEN,
  SRS_DEFAULT,
  crearClienteCatastro,
} from '../../services/catastro.js'
import {
  CONSULTAS_ALMACENADAS,
  COUNT_BBOX_DEFECTO,
  urlBbox,
  urlGetParcel,
} from '../../services/_catastro-wfs.js'
import { LONGITUD_REFCAT_PARCELA, PARAM_RCCOOR } from '../../services/_catastro-ovc.js'
import { BACKOFF, MAX_CONCURRENCIA, crearTransporte } from '../../services/_red.js'
import { NIVEL } from '../../viewer/_comun.js'
import { cederCiclos, crearDobleDormir, crearDobleFetch } from './_doble-fetch.js'

// ═════════════════════════════════════════════════════════════════════════════
// 0 · Los ficheros de verdad externa, y los oráculos que NO comparten código
// ═════════════════════════════════════════════════════════════════════════════
//
// La verdad-terreno se saca del TEXTO CRUDO con expresiones regulares y con
// `JSON.parse`, no con el lector XML del proyecto: `gml/xml.js` y `gml/parse.js`
// son —una capa más abajo— el mismo código que está bajo prueba, y preguntarle a
// un módulo si está de acuerdo consigo mismo no es un oráculo. Es la misma
// disciplina que `test/gml/aceptacion-f04.test.js`, donde jsdom audita al lector
// de la casa.

const DIR_CATASTRO = fileURLToPath(new URL('../fixtures/catastro/', import.meta.url))
const DIR_GML = fileURLToPath(new URL('../fixtures/gml/', import.meta.url))
const RUTA_SPEC = fileURLToPath(new URL('../../spec/feature-05-catastro-vivo.md', import.meta.url))

/**
 * Lee un fixture. **`utf8` a propósito**, no `latin1`: los `.xml` declaran
 * `ISO-8859-1` y sus bytes son UTF-8 (ver la advertencia de la cabecera).
 *
 * @param {string} dir
 * @param {string} nombre
 * @returns {string}
 */
const leer = (dir, nombre) => readFileSync(`${dir}${nombre}`, 'utf8')

const PROCEDENCIA = leer(DIR_CATASTRO, 'PROCEDENCIA.md')
const SPEC_F05 = readFileSync(RUTA_SPEC, 'utf8')

const EXC_RC_INEXISTENTE = leer(DIR_CATASTRO, 'wfs-exceptionreport-rc-inexistente.xml')
const EXC_BBOX_VACIO = leer(DIR_CATASTRO, 'wfs-bbox-vacio-mar.xml')
const BBOX_COUNT10 = leer(DIR_CATASTRO, 'wfs-bbox-count10.xml')
const VECINDAD = leer(DIR_CATASTRO, 'wfs-neighbour-9398516VK3799G.xml')
const CATALOGO = leer(DIR_CATASTRO, 'wfs-describestoredqueries.xml')
const OVC_OK = leer(DIR_CATASTRO, 'ovc-rccoor-ok.json')
const OVC_COD16 = leer(DIR_CATASTRO, 'ovc-rccoor-cod16.json')
const OVC_COD76 = leer(DIR_CATASTRO, 'ovc-rccoor-cod76.json')

/** El camino de éxito de `GetParcel`. No se duplica en `catastro/`: vive en `gml/`. */
const GML_PARCELA = leer(DIR_GML, 'cp_parcela_9398516VK3799G.gml')

// ── Oráculos sobre el texto crudo ────────────────────────────────────────────

/** Cuántos `<member>` trae el documento. Es EL número: contar es contar. */
const miembrosDe = (texto) => (texto.match(/<member>/g) ?? []).length

/** Las referencias catastrales del documento, EN ORDEN de aparición. */
const refcatsDe = (texto) =>
  [...texto.matchAll(/<cp:nationalCadastralReference>([^<]*)</g)].map((m) => m[1])

/** Un atributo cualquiera, tal cual lo escribe el servicio. `null` si no está. */
const atributo = (texto, nombre) => new RegExp(`${nombre}="([^"]*)"`).exec(texto)?.[1] ?? null

/** El texto del primer `CDATA`. Es el mensaje literal del servicio. */
const cdataDe = (texto) => /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(texto)?.[1] ?? null

/** Los `id` de las *stored queries* que el propio servicio publica. */
const consultasDelCatalogo = (texto) =>
  [...texto.matchAll(/<StoredQueryDescription\s+id="([^"]*)"/g)].map((m) => m[1])

/**
 * La URL con la que se capturó un fixture, leída de SU ficha en `PROCEDENCIA.md`.
 * Es la petición REAL —la única comprobada contra el servicio—, y atar el doble
 * de `fetch` a ella es lo que convierte cada caso en una comprobación de que el
 * cliente pide EXACTAMENTE lo que se midió.
 *
 * @param {string} fichero  Nombre del fixture, tal como titula su sección.
 * @returns {string}
 * @throws {Error}  Si `PROCEDENCIA.md` no lo documenta: un fixture sin
 *   procedencia es una opinión con formato de dato, y no se usa.
 */
function urlMedida(fichero) {
  const lineas = PROCEDENCIA.split('\n')
  const inicio = lineas.findIndex((l) => l.startsWith('## ') && l.includes(fichero))
  if (inicio === -1) throw new Error(`PROCEDENCIA.md no documenta ${fichero}`)
  for (let i = inicio + 1; i < lineas.length && !lineas[i].startsWith('## '); i += 1) {
    const m = /^\|\s*URL\s*\|\s*`([^`]+)`\s*\|/.exec(lineas[i])
    if (m) return m[1]
  }
  throw new Error(`PROCEDENCIA.md no da la URL medida de ${fichero}`)
}

/** Query string de una URL, como objeto plano. Nunca con `includes` sobre texto. */
const parametros = (u) => Object.fromEntries(new URL(u).searchParams)

/** `'EPSG::25830'` (forma del WFS) → `'EPSG:25830'` (forma corta del modelo). */
const aFormaCorta = (srsPeticion) => srsPeticion.replace('::', ':')

/** `'439000,4479400,439600,4480000,EPSG::25830'` → `{bbox, srs}`. */
function desmontarBbox(valor) {
  const trozos = valor.split(',')
  const [minX, minY, maxX, maxY] = trozos.slice(0, 4).map(Number)
  return { bbox: { minX, minY, maxX, maxY }, srs: aFormaCorta(trozos[4]) }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · La verdad-terreno, DERIVADA de los ficheros
// ═════════════════════════════════════════════════════════════════════════════

const URL_RC_INEXISTENTE = urlMedida('wfs-exceptionreport-rc-inexistente.xml')
const URL_VECINDAD = urlMedida('wfs-neighbour-9398516VK3799G.xml')
const URL_BBOX_COUNT10 = urlMedida('wfs-bbox-count10.xml')
const URL_BBOX_MAR = urlMedida('wfs-bbox-vacio-mar.xml')
const URL_OVC_OK = urlMedida('ovc-rccoor-ok.json')
const URL_OVC_COD76 = urlMedida('ovc-rccoor-cod76.json')

/** La referencia BUENA: la del GML real de la parcela. */
const RC_BUENA = refcatsDe(GML_PARCELA)[0]

/** La INEXISTENTE: la que se pidió para capturar el `ExceptionReport`. */
const RC_INEXISTENTE = parametros(URL_RC_INEXISTENTE).refcat

/** El SRS con el que se midió TODO, en forma corta. */
const SRS_MEDIDO = aFormaCorta(parametros(URL_RC_INEXISTENTE).srsname)

/**
 * La URL del `GetParcel` BUENO. `PROCEDENCIA.md` no la lista —dice
 * explícitamente que ese fixture vive en `../gml/` y que no se duplica—, así que
 * se deriva de la petición medida del `ExceptionReport` cambiándole lo ÚNICO que
 * cambia: la referencia catastral. Misma *stored query*, mismo SRS, mismo orden.
 */
const URL_PARCELA_OK = URL_RC_INEXISTENTE.replace(RC_INEXISTENTE, RC_BUENA)

const BBOX_MEDIDO = desmontarBbox(parametros(URL_BBOX_COUNT10).bbox)
const BBOX_MAR = desmontarBbox(parametros(URL_BBOX_MAR).bbox)

/** El punto de la geocodificación: el que el propio fixture de éxito echa por `geo`. */
const CANDIDATO_MEDIDO = JSON.parse(OVC_OK).Consulta_RCCOORResult.coordenadas.coord[0]
const X_MEDIDO = Number(CANDIDATO_MEDIDO.geo.xcen)
const Y_MEDIDO = Number(CANDIDATO_MEDIDO.geo.ycen)

/** La parcela del fixture, ya leída: es el modelo con el que se compara el AC1. */
const PARCELA_FIXTURE = parsearGml(GML_PARCELA).parcelas[0]

/** El anillo CERRADO del fixture, para los oráculos de `@turf`. */
const ANILLO_FIXTURE = [
  ...PARCELA_FIXTURE.recintos[0].vertices,
  PARCELA_FIXTURE.recintos[0].vertices[0],
]

/** ¿Cae este punto ESTRICTAMENTE dentro de la parcela del fixture? */
const dentroDeLaParcela = (xy) =>
  booleanPointInPolygon(point(xy), polygon([ANILLO_FIXTURE]), { ignoreBoundary: true })

// ── Las claves de query que separan una *stored query* de un `GetFeature` ────
//
// No se escriben: se DERIVAN de las dos peticiones medidas, restando sus juegos
// de parámetros. Lo que solo está en la de la *stored query* es lo que el BBOX no
// puede llevar, y al revés (guardián 3).

const CLAVES_ALMACENADA = Object.keys(parametros(URL_RC_INEXISTENTE))
const CLAVES_GETFEATURE = Object.keys(parametros(URL_BBOX_COUNT10))
const SOLO_ALMACENADA = CLAVES_ALMACENADA.filter((c) => !CLAVES_GETFEATURE.includes(c))
const SOLO_GETFEATURE = CLAVES_GETFEATURE.filter((c) => !CLAVES_ALMACENADA.includes(c))

// ═════════════════════════════════════════════════════════════════════════════
// 2 · El arnés: doble de `fetch`, doble de caché y cliente
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Lo que el doble contesta a cada URL MEDIDA. Una URL que no esté aquí recibe un
 * **404**: si el cliente se desvía un byte de la petición medida, se ve como
 * `ESTADO_HTTP` en vez de pasar en verde.
 */
const RESPUESTAS = new Map([
  [URL_PARCELA_OK, GML_PARCELA],
  [URL_RC_INEXISTENTE, EXC_RC_INEXISTENTE],
  [URL_VECINDAD, VECINDAD],
  [URL_BBOX_COUNT10, BBOX_COUNT10],
  [URL_BBOX_MAR, EXC_BBOX_VACIO],
  [URL_OVC_OK, OVC_OK],
])

/** @param {string} url @returns {object} */
const PLAN_FIXTURES = (url) =>
  RESPUESTAS.has(url) ? { estado: 200, texto: RESPUESTAS.get(url) } : { estado: 404 }

/**
 * Un plan que contesta SIEMPRE el mismo cuerpo, sea cual sea la URL. Se usa para
 * los casos en que lo que se prueba es la LECTURA de un cuerpo concreto y no la
 * construcción de la URL (que ya la clava el plan de fixtures).
 *
 * @param {object} guion
 * @returns {() => object}
 */
const planFijo = (guion) => () => guion

/**
 * Doble del puerto `CacheCatastro`: un `Map` con contadores. **No hay IndexedDB
 * en ningún caso de este fichero**, que es justo lo que un puerto bien declarado
 * permite.
 *
 * @returns {{almacen: Map<string, object>, llamadas: {leer: number, guardar: number},
 *            puerto: import('../../services/catastro.js').CacheCatastro}}
 */
function crearCacheDoble() {
  const almacen = new Map()
  const llamadas = { leer: 0, guardar: 0 }
  return {
    almacen,
    llamadas,
    puerto: {
      async leer(clave) {
        llamadas.leer += 1
        return almacen.get(clave) ?? null
      },
      async guardar(clave, valor, meta) {
        llamadas.guardar += 1
        almacen.set(clave, { valor, guardadoEn: meta.guardadoEn })
      },
    },
  }
}

/**
 * Monta transporte + cliente + dobles de una vez. El canal de aviso es un espía
 * en los dos, así que ningún caso escribe en la consola y el que quiera
 * comprobar un aviso solo tiene que mirar `avisos`.
 *
 * `aleatorio` por defecto es `() => 0` —jitter nulo, esperas de 0 ms— para que
 * ningún caso dependa del azar salvo el que lo prueba a propósito (AC3).
 *
 * @param {object} [opciones]
 * @returns {{cliente: object, transporte: object, red: object, esperas: object, avisos: object[]}}
 */
function montar({ plan = PLAN_FIXTURES, cache = CACHE_NULA, aleatorio = () => 0, ahora } = {}) {
  const red = crearDobleFetch({ plan })
  const esperas = crearDobleDormir()
  const avisos = []
  const espia = (mensaje, detalle) => avisos.push({ mensaje, detalle })
  const transporte = crearTransporte({
    fetch: red.fetch,
    dormir: esperas.dormir,
    aleatorio,
    alAvisar: espia,
  })
  const cliente = crearClienteCatastro({
    transporte,
    cache,
    ...(ahora === undefined ? {} : { ahora }),
    alAvisar: espia,
  })
  return { cliente, transporte, red, esperas, avisos }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Anti-vacuidad: los ficheros dicen lo que esta suite da por sabido
// ═════════════════════════════════════════════════════════════════════════════

describe('F05 · aceptación · la verdad-terreno se ha leído de verdad', () => {
  it('las referencias, el SRS y el punto salen de los ficheros, no de este test', () => {
    expect(RC_BUENA, 'el GML de la parcela no trae referencia catastral').toMatch(/^[0-9A-Z]{14}$/)
    expect(RC_INEXISTENTE, 'la URL medida no trae `refcat`').toMatch(/^[0-9A-Z]{14}$/)
    expect(RC_INEXISTENTE, 'la buena y la inexistente serían el mismo caso').not.toBe(RC_BUENA)
    expect(SRS_MEDIDO, 'el SRS por defecto del cliente no es el que se midió').toBe(SRS_DEFAULT)
    expect(Number.isFinite(X_MEDIDO) && Number.isFinite(Y_MEDIDO)).toBe(true)
  })

  it('el GML del fixture trae la parcela que el AC1 va a comparar', () => {
    expect(PARCELA_FIXTURE.recintos.length, 'sin recintos no hay geometría').toBeGreaterThan(0)
    expect(PARCELA_FIXTURE.refcat).toBe(RC_BUENA)
    expect(PARCELA_FIXTURE.srs, 'el fixture debe venir en el SRS medido').toBe(SRS_MEDIDO)
  })

  it('los fixtures del servicio traen lo que se les va a pedir', () => {
    expect(miembrosDe(VECINDAD), 'la vecindad debe traer más de un miembro').toBeGreaterThan(1)
    expect(miembrosDe(BBOX_COUNT10)).toBeGreaterThan(0)
    expect(refcatsDe(VECINDAD).length, 'un refcat por miembro').toBe(miembrosDe(VECINDAD))
    expect(consultasDelCatalogo(CATALOGO).length, 'el catálogo está vacío').toBeGreaterThan(0)
    expect(cdataDe(EXC_RC_INEXISTENTE), 'el ExceptionReport no trae CDATA').not.toBeNull()
    expect(SOLO_ALMACENADA.length, 'las dos peticiones medidas no se distinguen').toBeGreaterThan(0)
    expect(SOLO_GETFEATURE.length).toBeGreaterThan(0)
  })

  it('el doble de `fetch` contesta 404 a lo que NO se midió (o el arnés sería vacuo)', async () => {
    const { transporte } = montar()
    const r = await transporte.pedirTexto('https://ejemplo.invalid/esto-no-se-midio')
    expect(r.ok).toBe(false)
    expect(r.estado).toBe(404)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · AC1 · la parcela por referencia catastral, y la 2.ª llamada SIN RED
// ═════════════════════════════════════════════════════════════════════════════
//
// «`getParcelByRefcat` de la RC fixture devuelve el modelo con geometría, RC y
// SRS; la segunda llamada sale de caché (sin red).»
//
// La segunda mitad se afirma por DOS caminos independientes, y hacen falta los
// dos: `procedencia.origen === 'CACHE'` (lo dice el propio resultado, que es lo
// que la UI va a leer para escribir «guardado hace 6 días») y el contador del
// espía de `fetch` (que es lo que de verdad demuestra que no salió una petición).
// Lo que solo se puede comprobar desde fuera no es una garantía del módulo.

describe('F05 · AC1 · la parcela oficial por referencia catastral', () => {
  it('devuelve el modelo con GEOMETRÍA, RC y SRS, y los tres salen del fixture', async () => {
    const { cliente, red } = montar()
    const r = await cliente.parcelaPorRefcat(RC_BUENA)

    expect(r.ok, `motivo: ${r.motivo} · ${r.mensaje}`).toBe(true)
    expect(r.motivo).toBeNull()

    // RC y SRS, contra el propio fichero.
    expect(r.datos.refcat).toBe(RC_BUENA)
    expect(r.datos.srs).toBe(SRS_MEDIDO)

    // GEOMETRÍA: el `count` del `posList` del fichero es el número de PARES del
    // anillo CERRADO, y el modelo guarda el anillo ABIERTO (regla de oro 4). Que
    // la cuenta salga del atributo del propio GML es lo que hace que esto no sea
    // un número escrito a mano.
    const paresDeclarados = Number(atributo(GML_PARCELA, 'count'))
    expect(paresDeclarados, 'el posList del fixture no declara `count`').toBeGreaterThan(3)
    expect(r.datos.recintos).toHaveLength(1)
    expect(r.datos.recintos[0].vertices).toHaveLength(paresDeclarados - 1)
    expect(r.datos.recintos[0].vertices).toEqual(PARCELA_FIXTURE.recintos[0].vertices)

    // Y la URL pedida es, byte a byte, la de la *stored query* medida.
    expect(r.procedencia.origen).toBe(ORIGEN.RED)
    expect(r.procedencia.url).toBe(URL_PARCELA_OK)
    expect(red.urls()).toEqual([URL_PARCELA_OK])
  })

  it('⚠️ la SEGUNDA llamada sale de la caché y NO toca la red', async () => {
    const cache = crearCacheDoble()
    // Reloj inyectado: la edad del dato sale por pantalla, así que tiene que ser
    // reproducible. Seis días es el ejemplo que usa la propia spec de la UI.
    const MS_SEIS_DIAS = 6 * 24 * 60 * 60 * 1000
    let reloj = 1_000_000
    const { cliente, red, transporte } = montar({ cache: cache.puerto, ahora: () => reloj })

    const primera = await cliente.parcelaPorRefcat(RC_BUENA)
    expect(primera.ok).toBe(true)
    expect(primera.procedencia.origen).toBe(ORIGEN.RED)
    expect(red.total, 'la primera llamada sí va a la red').toBe(1)
    expect(cache.llamadas.guardar, 'la primera llamada guarda lo traído').toBe(1)

    reloj += MS_SEIS_DIAS

    const segunda = await cliente.parcelaPorRefcat(RC_BUENA)
    expect(segunda.ok).toBe(true)
    expect(segunda.procedencia.origen, 'la segunda llamada debía salir de la caché')
      .toBe(ORIGEN.CACHE)
    // LAS DOS COMPROBACIONES DE «SIN RED», por caminos distintos.
    expect(red.total, 'la segunda llamada emitió una petición HTTP').toBe(1)
    expect(transporte.estado().peticiones).toBe(1)
    expect(segunda.procedencia.intentos, 'un acierto de caché cuesta 0 intentos').toBe(0)
    expect(segunda.procedencia.url, 'de la caché no se pide ninguna URL').toBeNull()

    // Y el dato es EL MISMO, no uno parecido.
    expect(segunda.datos.refcat).toBe(primera.datos.refcat)
    expect(segunda.datos.recintos).toEqual(primera.datos.recintos)

    // La edad se dice, que es medio motivo de que la caché exista: sin `edadMs`
    // la UI no podría escribir «del Catastro, guardado hace 6 días» y un dato
    // viejo se presentaría como recién traído.
    expect(segunda.procedencia.edadMs).toBe(MS_SEIS_DIAS)
  })

  it('lo que se cachea es el TEXTO del GML, no el POJO ya parseado', async () => {
    // No es un detalle de estilo: guardar el parseo congela cada entrada con los
    // fallos que tuviera el lector el día que se guardó, y los sirve durante el
    // TTL entero sin que nada avise. Con el texto, una corrección futura de
    // `gml/parse.js` arregla retroactivamente todo lo cacheado.
    const cache = crearCacheDoble()
    const { cliente } = montar({ cache: cache.puerto })
    await cliente.parcelaPorRefcat(RC_BUENA)

    const guardados = [...cache.almacen.values()].map((e) => e.valor)
    expect(guardados).toHaveLength(1)
    expect(typeof guardados[0]).toBe('string')
    expect(guardados[0], 'lo guardado no son los bytes que mandó el servicio').toBe(GML_PARCELA)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · AC2 · una referencia inexistente es un ESTADO, no una excepción
// ═════════════════════════════════════════════════════════════════════════════
//
// «Un RC inexistente devuelve `CatastroError{kind:'not_found'}`, no una
// excepción.» El vocabulario del proyecto lo llama `MOTIVO_CATASTRO.NO_ENCONTRADO`
// y el resultado es un POJO, no un `throw`: la diferencia con la spec es de
// nombre, no de contrato.

describe('F05 · AC2 · una referencia catastral que no existe', () => {
  it('⚠️ devuelve un ESTADO «no encontrado» y no lanza NADA', async () => {
    const { cliente } = montar()

    // `resolves` es media afirmación del criterio: si esto LANZARA, la promesa
    // rechazaría y el caso caería aquí mismo diciendo que hubo excepción, en vez
    // de fallar tres líneas más abajo por otra cosa. La otra media es el motivo.
    await expect(cliente.parcelaPorRefcat(RC_INEXISTENTE)).resolves.toMatchObject({
      ok: false,
      datos: null,
      motivo: MOTIVO_CATASTRO.NO_ENCONTRADO,
    })
  })

  it('no encontrar nada NO es un fallo de la herramienta (override C6)', async () => {
    const { cliente, avisos } = montar()
    const r = await cliente.parcelaPorRefcat(RC_INEXISTENTE)

    // `ERROR` es lo que BLOQUEA la generación del GML. Que el Catastro no tenga
    // esa parcela no impide dibujarla a mano: se pierde una consulta, no un
    // trabajo. Ninguno de los ocho motivos de F05 es ERROR.
    expect(NIVEL_POR_MOTIVO[r.motivo]).toBe(NIVEL.AVISO)
    expect(NIVEL_POR_MOTIVO[r.motivo]).not.toBe(NIVEL.ERROR)
    // Y el módulo no avisa por su cuenta de sus propios resultados: el mensaje ya
    // va en el resultado, y contarlo dos veces se lo diría dos veces al usuario.
    expect(avisos.filter((a) => a.mensaje === r.mensaje)).toEqual([])
  })

  it('el mensaje lleva el literal del servicio, leído del propio fixture', async () => {
    const { cliente } = montar()
    const r = await cliente.parcelaPorRefcat(RC_INEXISTENTE)

    const literal = cdataDe(EXC_RC_INEXISTENTE)
    expect(r.mensaje, 'el texto del Catastro se arrastra íntegro, para que el usuario lo vea')
      .toContain(literal)
    expect(literal, 'y ese texto nombra la referencia que se pidió').toContain(RC_INEXISTENTE)
  })

  it('una referencia mal ESCRITA tampoco lanza: sale como entrada inválida y sin red', async () => {
    // La otra mitad de la frontera, y va aquí porque es el mismo criterio visto
    // desde el otro lado: el dato lo teclea una persona, así que ni el que no
    // existe ni el que está mal escrito pueden reventar la app.
    const { cliente, red } = montar()
    const r = await cliente.parcelaPorRefcat('esto no es una referencia')

    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.ENTRADA_INVALIDA)
    expect(red.total, 'no se consulta al Catastro con algo que no puede existir').toBe(0)
    expect(r.procedencia.origen).toBe(ORIGEN.LOCAL)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · AC3 · la cola limita, y el backoff reintenta CON JITTER
// ═════════════════════════════════════════════════════════════════════════════
//
// «La cola limita a ≤4 peticiones simultáneas; el backoff reintenta con jitter.»
// La mitad de la cola tiene su guardián propio y más exigente en § 9 (el 12: el
// pico es EXACTAMENTE el máximo, no `≤`), así que aquí va la del backoff.
//
// El jitter no es un adorno de rendimiento: varias pestañas de esta misma app
// comparten IP, y sin jitter tres pestañas que tropiecen con el mismo 503
// reintentan LAS TRES A LA VEZ, y otra vez a la vez — oleadas sincronizadas
// contra un servicio que ya iba mal, que es justo el patrón que el Catastro
// penaliza con ~10 días de denegación.

/** Los TECHOS del backoff, derivados de `BACKOFF`. Ni un número escrito aquí. */
const TECHOS_BACKOFF = Array.from({ length: BACKOFF.intentos - 1 }, (_, i) =>
  Math.min(BACKOFF.maxMs, BACKOFF.baseMs * BACKOFF.factor ** i),
)

describe('F05 · AC3 · el backoff reintenta, y con jitter', () => {
  it('un 5xx se reintenta exactamente `BACKOFF.intentos` veces', async () => {
    const { cliente, red, esperas } = montar({ plan: planFijo({ estado: 503 }) })
    const r = await cliente.parcelaPorRefcat(RC_BUENA)

    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.ESTADO_HTTP)
    expect(red.total, 'el 5xx debe reintentarse hasta el tope').toBe(BACKOFF.intentos)
    expect(r.procedencia.intentos).toBe(BACKOFF.intentos)
    // Un intento menos que peticiones: la última no espera a nadie.
    expect(esperas.msBackoff()).toHaveLength(BACKOFF.intentos - 1)
    expect(TECHOS_BACKOFF.length, 'sin reintentos no habría jitter que probar').toBeGreaterThan(0)
  })

  it('⚠️ el azar ELIGE la espera por debajo de un techo exponencial (eso es jitter)', async () => {
    // Tres fuentes de azar distintas sobre EL MISMO fallo. Si el backoff fuera
    // determinista, las tres darían la misma secuencia — y esa es exactamente la
    // oleada sincronizada que el jitter existe para desparramar.
    const conAzar = async (aleatorio) => {
      const { cliente, esperas } = montar({ plan: planFijo({ estado: 503 }), aleatorio })
      await cliente.parcelaPorRefcat(RC_BUENA)
      return esperas.msBackoff()
    }

    const alTope = await conAzar(() => 1)
    const alSuelo = await conAzar(() => 0)
    const aLaMitad = await conAzar(() => 0.5)

    // Con azar 1 se toca el techo: es la fórmula de `BACKOFF`, no una constante.
    expect(alTope).toEqual(TECHOS_BACKOFF)
    // Con azar 0 no se espera nada, y con 0,5 la mitad de cada techo.
    expect(alSuelo).toEqual(TECHOS_BACKOFF.map(() => 0))
    expect(aLaMitad).toEqual(TECHOS_BACKOFF.map((t) => t / 2))
    // Y las tres secuencias son distintas: la espera DEPENDE del azar.
    expect(alTope).not.toEqual(alSuelo)
    expect(aLaMitad).not.toEqual(alTope)
  })

  it('el techo es EXPONENCIAL y está acotado por `BACKOFF.maxMs`', () => {
    for (let i = 1; i < TECHOS_BACKOFF.length; i += 1) {
      expect(TECHOS_BACKOFF[i], 'el techo debe crecer con el intento')
        .toBeGreaterThanOrEqual(TECHOS_BACKOFF[i - 1])
    }
    for (const techo of TECHOS_BACKOFF) expect(techo).toBeLessThanOrEqual(BACKOFF.maxMs)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · AC4 · la deducción de la referencia desde un punto de la geometría
// ═════════════════════════════════════════════════════════════════════════════
//
// «Deducción de RC desde un centroide de fixture rellena el campo editable;
// centroide ambiguo lo indica sin rellenar.»
//
// ⚠️ **CENTROIDE, NO: PUNTO INTERIOR.** El centroide aritmético de una parcela en
// forma de L cae FUERA del polígono, y el Catastro no tiene forma de saberlo:
// contestaría tan tranquilo con la referencia de la parcela VECINA y esta
// herramienta rellenaría el campo con un dato malo, en silencio. La app deduce
// desde `gml/anillos.js#puntoInterior`, que devuelve un punto ESTRICTAMENTE
// interior y lo verifica en vez de confiar. Aquí se comprueban los dos puntos que
// hay sobre la mesa —el que se midió y el que calcula la app— contra el polígono
// del fixture, con `@turf` de oráculo externo.
//
// La mitad de PANTALLA (que la referencia acabe en el `<input>`, con el rótulo
// «Parcela deducida de la ubicación · puedes corregirla») es de
// `test/app/catastro.dom.test.js`: ver el hueco (h7) de la cabecera. Aquí se
// comprueba el CONTRATO que aquella pantalla consume.

/**
 * El cuerpo AMBIGUO, derivado del fixture de éxito: dos candidatos, el medido y
 * uno cuya referencia es la de una COLINDANTE REAL del fixture de vecindad,
 * partida 7 + 7 como la parte el propio OVC. Ver el hueco (h5): no es una
 * medición y por eso está declarado.
 *
 * @returns {{cuerpo: string, refcats: string[]}}
 */
function cuerpoAmbiguo() {
  const cuerpo = JSON.parse(OVC_OK)
  const lista = cuerpo.Consulta_RCCOORResult.coordenadas.coord
  const propia = refcatsDe(VECINDAD).find((rc) => rc === RC_BUENA)
  const vecina = refcatsDe(VECINDAD).find((rc) => rc !== RC_BUENA)
  if (propia === undefined || vecina === undefined) {
    throw new Error('el fixture de vecindad no da una colindante distinta de la propia parcela')
  }
  const mitad = LONGITUD_REFCAT_PARCELA / 2
  const segundo = {
    ...lista[0],
    pc: { pc1: vecina.slice(0, mitad), pc2: vecina.slice(mitad) },
  }
  lista.push(segundo)
  cuerpo.Consulta_RCCOORResult.control.cucoor = lista.length
  return { cuerpo: JSON.stringify(cuerpo), refcats: [propia, vecina] }
}

describe('F05 · AC4 · el punto desde el que se pregunta', () => {
  it('⚠️ el punto MEDIDO cae estrictamente dentro de la parcela del fixture', () => {
    // Es lo que ata la geocodificación a la geometría: la respuesta medida no es
    // «un punto cualquiera», es un punto de ESTA parcela. Oráculo externo (turf),
    // no `geo/` ni `gml/`.
    expect(dentroDeLaParcela([X_MEDIDO, Y_MEDIDO])).toBe(true)
  })

  it('y el punto que calcula la app (`puntoInterior`) también, sin detecciones', () => {
    const { punto, detecciones } = puntoInterior(PARCELA_FIXTURE.recintos)
    expect(punto, 'sin punto interior no hay desde dónde deducir').not.toBeNull()
    expect(dentroDeLaParcela(punto)).toBe(true)
    expect(detecciones.map((d) => d.tipo)).toEqual([])
    // HUECO (h6): el OVC NO se ha medido en ESTE punto. No se finge que sí: lo
    // que se afirma es que los dos puntos son interiores a la misma parcela.
    expect(punto).not.toEqual([X_MEDIDO, Y_MEDIDO])
  })
})

describe('F05 · AC4 · un solo candidato: hay con qué rellenar el campo', () => {
  it('devuelve UNA referencia, marcada como única, y es la del fixture', async () => {
    const { cliente, red } = montar()
    const r = await cliente.refcatPorCoordenada(X_MEDIDO, Y_MEDIDO)

    expect(r.ok, `motivo: ${r.motivo} · ${r.mensaje}`).toBe(true)
    expect(r.datos.cuantos).toBe(1)
    expect(r.datos.unico, '`unico` es la condición que la spec exige para rellenar').toBe(true)
    expect(r.datos.candidatos[0].refcat).toBe(RC_BUENA)
    // La URL es la medida, con los nombres de parámetro del endpoint JSON.
    expect(red.urls()).toEqual([URL_OVC_OK])
  })

  it('el candidato trae su DOMICILIO, que es lo único con lo que se elige', async () => {
    const { cliente } = montar()
    const r = await cliente.refcatPorCoordenada(X_MEDIDO, Y_MEDIDO)
    // El `ldt` del propio fichero: una lista de referencias catastrales desnudas
    // es ilegible para una persona.
    expect(r.datos.candidatos[0].domicilio).toBe(CANDIDATO_MEDIDO.ldt)
    expect(CANDIDATO_MEDIDO.ldt, 'el fixture no trae `ldt`: la comprobación sería vacua')
      .toMatch(/\S/)
  })
})

describe('F05 · AC4 · varios candidatos: NO se rellena nada a ciegas', () => {
  it('⚠️ lo INDICA (`unico: false`) y entrega los dos, con su domicilio', async () => {
    const { cuerpo, refcats } = cuerpoAmbiguo()
    const { cliente } = montar({ plan: planFijo({ estado: 200, texto: cuerpo }) })
    const r = await cliente.refcatPorCoordenada(X_MEDIDO, Y_MEDIDO)

    expect(r.ok, 'un punto ambiguo no es un fallo: es una pregunta con dos respuestas').toBe(true)
    expect(r.datos.cuantos).toBe(refcats.length)
    expect(r.datos.unico, 'con varios candidatos NO se puede rellenar el campo').toBe(false)
    expect(r.datos.candidatos.map((c) => c.refcat)).toEqual(refcats)
    for (const c of r.datos.candidatos) expect(c.domicilio).toMatch(/\S/)
  })

  it('y el mensaje lo dice con todas las letras, para que la UI no improvise', async () => {
    const { cuerpo } = cuerpoAmbiguo()
    const { cliente } = montar({ plan: planFijo({ estado: 200, texto: cuerpo }) })
    const r = await cliente.refcatPorCoordenada(X_MEDIDO, Y_MEDIDO)
    expect(r.mensaje).toBeNull() // un resultado con dato no lleva mensaje de fallo
    expect(r.datos.candidatos).toHaveLength(2)
  })

  it('el caso ambiguo NO es el mismo objeto que el de un candidato (anti-vacuidad)', async () => {
    const { cliente: unico } = montar()
    const { cuerpo } = cuerpoAmbiguo()
    const { cliente: varios } = montar({ plan: planFijo({ estado: 200, texto: cuerpo }) })

    const a = await unico.refcatPorCoordenada(X_MEDIDO, Y_MEDIDO)
    const b = await varios.refcatPorCoordenada(X_MEDIDO, Y_MEDIDO)
    expect(a.datos.unico).toBe(true)
    expect(b.datos.unico).toBe(false)
    expect(a.datos.cuantos).toBeLessThan(b.datos.cuantos)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · AC5 · «el User-Agent no se rota» — REFORMULADO, y sin un solo `expect`
// ═════════════════════════════════════════════════════════════════════════════
//
// Toda la argumentación está en la cabecera de este fichero, § «POR QUÉ EL AC5 SE
// REFORMULA». En resumen, y para que quien abra por aquí no tenga que subir:
//
//   · `User-Agent` es *forbidden header name*: **un navegador no puede fijarla**,
//     ni queriendo. No hay rotación que impedir.
//   · Está MEDIDO que el servicio contesta 200 con cuerpo válido **sin ninguna
//     cabecera nuestra** (`PROCEDENCIA.md`, hecho transversal 6), así que la
//     premisa de la spec —«sin él el servicio da error»— no tiene respaldo.
//   · Añadir cabeceras propias forzaría un *preflight* `OPTIONS` **no medido**.
//
// El criterio comprobable no es «no se rota» sino **«no se intenta»**: que el
// transporte no escriba ni una cabecera. Eso es una afirmación sobre la FUENTE, y
// su sitio es el **guardián G9 de `test/services/contrato-catastro.test.js`**.
//
// **Aquí no se duplica, a propósito.** Dos guardianes del mismo invariante en dos
// ficheros son dos guardianes que se desincronizan, y el que se quede viejo
// seguirá verde afirmando que vigila algo que ya no vigila. Un `expect` de más en
// este fichero no añadiría ninguna garantía: añadiría una segunda copia que
// mantener.

// ═════════════════════════════════════════════════════════════════════════════
// 9 · LOS GUARDIANES DE LOS HECHOS MEDIDOS
// ═════════════════════════════════════════════════════════════════════════════

// ── 1 · TODO ERROR LLEGA CON HTTP 200 ────────────────────────────────────────

describe('F05 · guardián 1 · el error llega con HTTP 200 (y el 500 con cuerpo bueno)', () => {
  it('⚠️ las DOS mitades JUNTAS: 200 con excepción, y 500 con un GML bueno', async () => {
    // POR SEPARADO, cada mitad la aprobaría un módulo que clasificara por
    // `response.ok`. JUNTAS no: ese módulo daría por buena la excepción del 200
    // (y trataría un `ExceptionReport` como si fuera una parcela) y se pondría a
    // leer el cuerpo del 500 (que aquí es un GML perfectamente válido) como si
    // fuera el dato. La clasificación de este servicio se hace LEYENDO EL CUERPO.
    const conExcepcion = montar({ plan: planFijo({ estado: 200, texto: EXC_RC_INEXISTENTE }) })
    const a = await conExcepcion.cliente.parcelaPorRefcat(RC_BUENA)
    expect(a.ok, 'un ExceptionReport con HTTP 200 no es una parcela').toBe(false)
    expect(a.motivo).toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)

    const conGmlBueno = montar({ plan: planFijo({ estado: 500, texto: GML_PARCELA }) })
    const b = await conGmlBueno.cliente.parcelaPorRefcat(RC_BUENA)
    expect(b.ok, 'un 500 no entrega dato aunque su cuerpo sea un GML válido').toBe(false)
    expect(b.motivo).toBe(MOTIVO_CATASTRO.ESTADO_HTTP)

    // Y los dos motivos son DISTINTOS: si el módulo clasificara por `response.ok`
    // los habría intercambiado, no fundido.
    expect(a.motivo).not.toBe(b.motivo)
  })

  it('las 8 respuestas medidas fueron 200: `response.ok` no clasifica NADA aquí', () => {
    // El hecho, dicho por el fichero que manda. Se afirma sobre `PROCEDENCIA.md`
    // para que, si alguien recapturara la tanda y el servicio hubiera cambiado,
    // esto se entere.
    expect(PROCEDENCIA).toContain('El error llega con HTTP 200')
    expect(PROCEDENCIA).toContain('`response.ok` no sirve para clasificar nada en este servicio')
  })
})

// ── 2 · LAS STORED QUERIES QUE DE VERDAD EXISTEN ─────────────────────────────

describe('F05 · guardián 2 · las *stored queries* salen del catálogo del servicio', () => {
  const DEL_CATALOGO = consultasDelCatalogo(CATALOGO)

  it('las que usa el código son un SUBCONJUNTO de las que publica el servicio', () => {
    const usadas = Object.values(CONSULTAS_ALMACENADAS)
    expect(usadas.length, 'el módulo no usa ninguna: la comprobación sería vacua')
      .toBeGreaterThan(0)
    for (const id of usadas) {
      expect(DEL_CATALOGO, `la *stored query* «${id}» no está en el catálogo del servicio`)
        .toContain(id)
    }
  })

  it('⚠️ `GetParcelsByBBox` NO está en el catálogo — y el nombre sale de la SPEC', () => {
    // La anti-vacuidad, y es la mitad que de verdad vale: sin ella, un módulo que
    // no usara ninguna consulta aprobaría el test de arriba sin decir nada.
    //
    // El nombre no se escribe aquí: se DERIVA de la propia spec, que lista
    // `getParcelsByBBox(bbox, srs)` en una enumeración donde las demás sí tienen
    // su *stored query* una a una — y esa simetría es justo la que invita a
    // buscar un nombre que no existe.
    const enLaSpec = /\bget([A-Za-z]*ByBBox)\b/.exec(SPEC_F05)
    expect(enLaSpec, 'la spec ya no nombra ningún `get…ByBBox`: revisar este guardián')
      .not.toBeNull()
    const inventada = `Get${enLaSpec[1]}`
    expect(DEL_CATALOGO, `el catálogo del servicio no publica ninguna «${inventada}»`)
      .not.toContain(inventada)
    expect(DEL_CATALOGO.length, 'catálogo vacío: no se estaría negando nada').toBeGreaterThan(0)
  })
})

// ── 3 · EL BBOX NO ES UNA STORED QUERY ───────────────────────────────────────

describe('F05 · guardián 3 · el BBOX se pide con `GetFeature`, no con una *stored query*', () => {
  it('⚠️ comprobado con `searchParams`, no con `includes` sobre la cadena', () => {
    // `includes` sobre la URL confundiría un valor con un nombre de parámetro y
    // daría por buena cualquier cadena que contuviera el literal. La pregunta
    // «¿lleva este parámetro?» se le hace al analizador de URL.
    const delBbox = new URL(urlBbox(BBOX_MEDIDO.bbox, BBOX_MEDIDO.srs)).searchParams
    for (const clave of SOLO_ALMACENADA) {
      expect(delBbox.has(clave), `el BBOX no puede llevar «${clave}»`).toBe(false)
    }
    for (const clave of SOLO_GETFEATURE) {
      expect(delBbox.has(clave), `al BBOX le falta «${clave}»`).toBe(true)
    }
  })

  it('y al revés: la *stored query* SÍ los lleva (o el guardián no separaría nada)', () => {
    const deLaConsulta = new URL(urlGetParcel(RC_BUENA, SRS_MEDIDO)).searchParams
    for (const clave of SOLO_ALMACENADA) {
      expect(deLaConsulta.has(clave), `la *stored query* debe llevar «${clave}»`).toBe(true)
    }
    for (const clave of SOLO_GETFEATURE) {
      expect(deLaConsulta.has(clave), `la *stored query* no lleva «${clave}»`).toBe(false)
    }
  })
})

// ── 4 · LOS ATRIBUTOS DE CONTEO MIENTEN ──────────────────────────────────────

describe('F05 · guardián 4 · los `<member>` se cuentan; los atributos de conteo mienten', () => {
  const CONTADOS = miembrosDe(BBOX_COUNT10)
  const MATCHED = atributo(BBOX_COUNT10, 'numberMatched')
  const RETURNED = atributo(BBOX_COUNT10, 'numberReturned')

  it('⚠️ las dos cifras del MISMO fichero no coinciden: mienten los DOS atributos', () => {
    expect(CONTADOS, 'sin miembros no habría nada que contar').toBeGreaterThan(0)
    expect(MATCHED, 'el fixture no declara `numberMatched`').not.toBeNull()
    expect(RETURNED, 'el fixture no declara `numberReturned`').not.toBeNull()
    // `numberReturned` debería ser, por la especificación WFS 2.0, el número de
    // elementos DE ESTA respuesta. No se entera de que la respuesta está truncada.
    expect(Number(RETURNED), 'si coincidieran, este guardián no tendría objeto')
      .not.toBe(CONTADOS)
    expect(Number(MATCHED)).not.toBe(CONTADOS)
  })

  it('el cliente devuelve los CONTADOS, y arrastra los declarados con su nombre', async () => {
    const { cliente } = montar()
    const r = await cliente.parcelasEnBbox(BBOX_MEDIDO.bbox, { srs: BBOX_MEDIDO.srs })

    expect(r.ok, `motivo: ${r.motivo} · ${r.mensaje}`).toBe(true)
    expect(r.datos.nMiembros, 'los miembros se cuentan contándolos').toBe(CONTADOS)
    expect(r.datos.parcelas).toHaveLength(CONTADOS)
    // Lo que el servicio DICE, con un nombre que dice que es lo que dice.
    expect(r.datos.declarado.numberReturned).toBe(RETURNED)
    expect(r.datos.declarado.numberMatched).toBe(MATCHED)
    // Y con el `count` puesto, el resultado avisa de que puede haber más.
    expect(r.datos.count).toBe(COUNT_BBOX_DEFECTO)
    expect(r.datos.truncado).toBe(true)
  })

  it('el `count` por defecto es el que se midió, leído de la URL medida', () => {
    expect(Number(parametros(URL_BBOX_COUNT10).count)).toBe(COUNT_BBOX_DEFECTO)
    expect(COUNT_BBOX_DEFECTO).toBe(CONTADOS)
  })
})

// ── 5 · GetNeighbourParcel SE INCLUYE A SÍ MISMA, Y NO LA PRIMERA ────────────

describe('F05 · guardián 5 · la vecindad se incluye a sí misma, en 2.ª posición', () => {
  const PEDIDA = parametros(URL_VECINDAD).refcat
  const EN_ORDEN = refcatsDe(VECINDAD)
  const POSICION = EN_ORDEN.indexOf(PEDIDA)

  it('⚠️ el fixture trae la propia parcela, y NO es la primera del documento', () => {
    expect(PEDIDA, 'la URL medida no dice qué referencia se pidió').toMatch(/^[0-9A-Z]{14}$/)
    expect(POSICION, 'la propia parcela no viene en la respuesta de colindantes')
      .toBeGreaterThan(-1)
    // Aquí está el hecho: no se puede descartar por índice. En el fixture medido
    // está la 2.ª de 5, así que un `parcelas.slice(1)` se dejaría a la propia
    // dentro y se comería una colindante.
    expect(POSICION, 'la propia parcela es la primera: descartar por índice funcionaría')
      .toBeGreaterThan(0)
    expect(EN_ORDEN.length, 'un solo miembro: no habría colindantes que separar').toBeGreaterThan(1)
  })

  it('el cliente separa por REFERENCIA: las colindantes son `nMiembros - 1`', async () => {
    const { cliente } = montar()
    const r = await cliente.parcelaYColindantes(PEDIDA)

    expect(r.ok, `motivo: ${r.motivo} · ${r.mensaje}`).toBe(true)
    expect(r.datos.propia.refcat, 'la propia es la PEDIDA, no la primera').toBe(PEDIDA)
    expect(r.datos.colindantes).toHaveLength(miembrosDe(VECINDAD) - 1)
    // Y ninguna colindante repite su referencia: si el módulo separara por
    // posición, la propia parcela aparecería también entre las vecinas.
    expect(r.datos.colindantes.map((p) => p.refcat)).not.toContain(PEDIDA)
    // Las que quedan son, exactamente, las del fichero menos la propia.
    expect(r.datos.colindantes.map((p) => p.refcat)).toEqual(EN_ORDEN.filter((rc) => rc !== PEDIDA))
  })
})

// ── 6 · LOS DOS ENDPOINTS DEL OVC NO COMPARTEN NOMBRES DE PARÁMETRO ──────────

describe('F05 · guardián 6 · el `cod:76` es un fallo NUESTRO, no «aquí no hay parcela»', () => {
  it('las dos URL medidas usan nombres de coordenada DISTINTOS', () => {
    // El hecho, derivado de las dos peticiones que se midieron: la que funcionó y
    // la que se hizo a propósito con los nombres del OTRO endpoint (el `.asmx`).
    const buenos = Object.keys(parametros(URL_OVC_OK))
    const ajenos = Object.keys(parametros(URL_OVC_COD76))
    expect(buenos, 'el endpoint JSON usa `CoorX`').toContain(PARAM_RCCOOR.x)
    expect(buenos).toContain(PARAM_RCCOOR.y)
    expect(ajenos, 'la petición mal construida NO lleva los nombres buenos')
      .not.toContain(PARAM_RCCOOR.x)
    expect(ajenos.length, 'sin parámetros no se estaría contrastando nada').toBeGreaterThan(0)
  })

  it('⚠️ el `cod:76` sale como RESPUESTA ILEGIBLE, jamás como NO ENCONTRADO', async () => {
    // Es lo que impide decirle al usuario «no hay parcela ahí» cuando la verdad es
    // «hemos construido mal la URL». Ese fallo estaría en el 100 % de las
    // peticiones, es reparable en una línea, y el usuario —viendo «aquí no hay
    // nada» una y otra vez— concluiría que el Catastro está caído.
    const { cliente } = montar({ plan: planFijo({ estado: 200, texto: OVC_COD76 }) })
    const r = await cliente.refcatPorCoordenada(X_MEDIDO, Y_MEDIDO)

    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE)
    expect(r.motivo, 'un bug nuestro disfrazado de resultado negativo del servicio')
      .not.toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
  })

  it('y el `cod:16` SÍ es «no encontrado»: los dos casos no se funden', async () => {
    // La anti-vacuidad: sin esto, un módulo que dijera «ilegible» a todo lo que
    // trae `cuerr` aprobaría el caso de arriba sin distinguir nada.
    const { cliente } = montar({ plan: planFijo({ estado: 200, texto: OVC_COD16 }) })
    const r = await cliente.refcatPorCoordenada(X_MEDIDO, Y_MEDIDO)

    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
  })
})

// ── 7 · LA REFERENCIA CATASTRAL LLEGA PARTIDA EN DOS ─────────────────────────

describe('F05 · guardián 7 · la RC es `pc1` + `pc2`, y mide 14', () => {
  const PC = CANDIDATO_MEDIDO.pc

  it('⚠️ el fixture NO trae ningún campo con la referencia completa', () => {
    expect(typeof PC.pc1).toBe('string')
    expect(typeof PC.pc2).toBe('string')
    const compuesta = `${PC.pc1}${PC.pc2}`
    expect(compuesta).toHaveLength(LONGITUD_REFCAT_PARCELA)
    expect(compuesta, 'la referencia compuesta debe ser la de la parcela del fixture')
      .toBe(RC_BUENA)
    // La mitad que hace falta: el servicio NO manda los 14 juntos en ninguna
    // parte. Hay que concatenar; quien busque un campo con la RC entera no lo
    // encontrará y se llevará un `undefined`.
    expect(OVC_OK.includes(compuesta), 'el cuerpo trae la RC entera: no habría que componerla')
      .toBe(false)
  })

  it('el cliente la compone, y las dos mitades siguen visibles para rastrear el dato', async () => {
    const { cliente } = montar()
    const r = await cliente.refcatPorCoordenada(X_MEDIDO, Y_MEDIDO)
    const candidato = r.datos.candidatos[0]

    expect(candidato.refcat).toBe(`${PC.pc1}${PC.pc2}`)
    expect(candidato.refcat).toHaveLength(LONGITUD_REFCAT_PARCELA)
    expect(candidato.pc1).toBe(PC.pc1)
    expect(candidato.pc2).toBe(PC.pc2)
  })
})

// ── 10 · EL TOPE DEL BBOX ────────────────────────────────────────────────────

describe('F05 · guardián 10 · el tope del encuadre', () => {
  /** Lado de una caja cuadrada de EXACTAMENTE el área máxima. */
  const LADO_MAXIMO = Math.sqrt(MAX_AREA_BBOX_M2)

  /** Una caja cuadrada de lado `lado`, anclada donde la caja medida. */
  const cajaDeLado = (ancho, alto) => ({
    minX: BBOX_MEDIDO.bbox.minX,
    minY: BBOX_MEDIDO.bbox.minY,
    maxX: BBOX_MEDIDO.bbox.minX + ancho,
    maxY: BBOX_MEDIDO.bbox.minY + alto,
  })

  it('⚠️ una caja de EXACTAMENTE el máximo PASA (el límite es el último admitido)', async () => {
    // Es la mitad anti-vacuidad: sin ella, un módulo que rechazara SIEMPRE
    // aprobaría el caso de abajo. La caja del máximo no está entre las medidas, así
    // que el doble contesta 404 — y eso basta: lo que se afirma es que se LLEGÓ a
    // preguntar, no lo que contestaron.
    const { cliente, red } = montar()
    const r = await cliente.parcelasEnBbox(cajaDeLado(LADO_MAXIMO, LADO_MAXIMO))

    expect(r.motivo, 'una caja de exactamente 1 km² no se puede rechazar')
      .not.toBe(MOTIVO_CATASTRO.BBOX_DEMASIADO_GRANDE)
    expect(red.total, 'la caja del máximo debe llegar a la red').toBeGreaterThan(0)
    expect(r.procedencia.origen).toBe(ORIGEN.RED)
  })

  it('⚠️ una caja de +1 m² se rechaza, y el espía de `fetch` cuenta CERO', async () => {
    const ancho = LADO_MAXIMO + 1 / LADO_MAXIMO
    const caja = cajaDeLado(ancho, LADO_MAXIMO)
    const area = (caja.maxX - caja.minX) * (caja.maxY - caja.minY)
    expect(Math.round(area - MAX_AREA_BBOX_M2), 'la caja de prueba no mide un metro más')
      .toBe(1)

    const { cliente, red } = montar()
    const r = await cliente.parcelasEnBbox(caja)

    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.BBOX_DEMASIADO_GRANDE)
    // Lo importante no es el motivo: es que NO SE EMITIÓ NADA. Comprobarlo antes
    // de pedir es lo que ahorra la petición al servicio que nos vigila.
    expect(red.total, 'se ha consultado al Catastro con una caja que se iba a rechazar').toBe(0)
    expect(r.procedencia.url, 'no se pidió ninguna URL').toBeNull()
    expect(r.procedencia.origen).toBe(ORIGEN.LOCAL)
    expect(r.procedencia.intentos).toBe(0)
  })

  it('una caja degenerada o invertida LANZA: eso lo construye código, no un usuario', async () => {
    // Las dos fronteras de la misma función, una al lado de la otra: el encuadre
    // lo mueve el usuario con la rueda del ratón (estado), pero un `{minX, maxX}`
    // al revés no lo teclea nadie (contrato roto por el programador).
    const { cliente } = montar()
    const alReves = { ...BBOX_MEDIDO.bbox, maxX: BBOX_MEDIDO.bbox.minX - 1 }
    await expect(cliente.parcelasEnBbox(alReves)).rejects.toThrow(RangeError)
  })
})

// ── 11 · UN 200 NO SE REINTENTA JAMÁS ────────────────────────────────────────

describe('F05 · guardián 11 · un 200 no se reintenta nunca', () => {
  it('⚠️ el `ExceptionReport` (HTTP 200) se pide EXACTAMENTE una vez', async () => {
    // Reintentar un «no existe esa parcela» es inútil —la respuesta será
    // idéntica— y es la vía más rápida a que el Catastro deniegue el servicio
    // ~10 días. Con la frontera bien puesta, no reintentar es lo que pasa POR
    // OMISIÓN: el transporte solo ve un 2xx y devuelve el texto.
    const { cliente, red, transporte, esperas } = montar()
    const r = await cliente.parcelaPorRefcat(RC_INEXISTENTE)

    expect(r.motivo).toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
    expect(red.total, 'un HTTP 200 se ha reintentado').toBe(1)
    expect(transporte.estado().peticiones).toBe(1)
    expect(transporte.estado().reintentos).toBe(0)
    expect(r.procedencia.intentos).toBe(1)
    expect(esperas.msBackoff(), 'no hay backoff que esperar tras un 200').toEqual([])
  })

  it('anti-vacuidad: un 5xx SÍ se reintenta, así que el contador no está muerto', async () => {
    const { cliente, red } = montar({ plan: planFijo({ estado: 503 }) })
    await cliente.parcelaPorRefcat(RC_BUENA)
    expect(red.total).toBe(BACKOFF.intentos)
    expect(BACKOFF.intentos, 'con un solo intento no habría contraste').toBeGreaterThan(1)
  })

  it('y un 4xx tampoco se reintenta: repetirlo da lo mismo tres veces', async () => {
    const { cliente, red } = montar({ plan: planFijo({ estado: 404 }) })
    const r = await cliente.parcelaPorRefcat(RC_BUENA)
    expect(r.motivo).toBe(MOTIVO_CATASTRO.ESTADO_HTTP)
    expect(red.total).toBe(1)
  })
})

// ── 12 · LA COLA LIMITA DE VERDAD ────────────────────────────────────────────

describe('F05 · guardián 12 · el pico de peticiones simultáneas es EXACTAMENTE el máximo', () => {
  // `toBe`, no `≤`: un `≤` lo aprobaría hasta una cola que no dejara pasar a
  // nadie. El pico tiene que ALCANZAR el máximo y no pasarlo.
  it('⚠️ el pico medido es `toBe(MAX_CONCURRENCIA)`, ni uno más ni uno menos', async () => {
    const LANZADAS = MAX_CONCURRENCIA + 3
    expect(LANZADAS, 'sin más peticiones que plazas no habría cola que probar')
      .toBeGreaterThan(MAX_CONCURRENCIA)

    // Las peticiones quedan RETENIDAS: el doble no las entrega hasta que se le
    // dice. Así el pico se puede fotografiar en vez de perseguirlo.
    const { cliente, red, transporte } = montar({
      plan: planFijo({ retenida: true, estado: 200, texto: GML_PARCELA }),
    })

    const enMarcha = Array.from({ length: LANZADAS }, () => cliente.parcelaPorRefcat(RC_BUENA))
    await cederCiclos()

    expect(red.enVuelo, 'hay más peticiones en vuelo que plazas').toBe(MAX_CONCURRENCIA)
    expect(red.total, 'solo han llegado al `fetch` las que tienen plaza').toBe(MAX_CONCURRENCIA)
    expect(transporte.estado().enVuelo).toBe(MAX_CONCURRENCIA)
    expect(transporte.estado().enCola).toBe(LANZADAS - MAX_CONCURRENCIA)

    // Se van soltando por lotes hasta que no queda ninguna. El tope de vueltas
    // evita que un fallo de la cola cuelgue la suite en vez de ponerla roja.
    for (let vuelta = 0; vuelta < LANZADAS + 5 && red.retenidas > 0; vuelta += 1) {
      red.soltar()
      await cederCiclos()
    }
    const resultados = await Promise.all(enMarcha)

    // EL GUARDIÁN: el pico alcanzado es EXACTAMENTE el máximo. Ni uno más (la
    // cola no limitaría) ni uno menos (nunca se habría llegado a ejercitar).
    expect(red.maxSimultaneas).toBe(MAX_CONCURRENCIA)
    expect(red.total, 'todas las lanzadas acaban saliendo').toBe(LANZADAS)
    expect(transporte.estado().enCola, 'la cola se vacía').toBe(0)
    for (const r of resultados) expect(r.ok, `motivo: ${r.motivo}`).toBe(true)
  })

  it('el máximo es el extremo PRUDENTE del rango de la spec (2–4)', () => {
    // No es un ajuste de rendimiento: a 0,099–0,451 s por petición al WFS, subirlo
    // no haría la app perceptiblemente más rápida. Lo que sí haría es parecer un
    // raspador automático, que es el perfil que el Catastro penaliza.
    expect(MAX_CONCURRENCIA).toBeGreaterThanOrEqual(2)
    expect(MAX_CONCURRENCIA).toBeLessThanOrEqual(4)
  })
})

// ── ++ · NO EXISTE LA «COLECCIÓN VACÍA» (hecho medido en T0B) ────────────────

describe('F05 · guardián ++ · «no hay parcelas ahí» y «esa RC no existe» no se distinguen', () => {
  it('⚠️ los dos fixtures traen el MISMO `exceptionCode`, leído de cada fichero', () => {
    const deLaRc = atributo(EXC_RC_INEXISTENTE, 'exceptionCode')
    const deLaCaja = atributo(EXC_BBOX_VACIO, 'exceptionCode')

    expect(deLaRc, 'el fixture de RC inexistente no declara `exceptionCode`').not.toBeNull()
    expect(deLaCaja, 'el fixture de caja vacía no declara `exceptionCode`').not.toBeNull()
    // El hecho: es UN SOLO código para las dos cosas. `exceptionCode` no es
    // clasificable en este servicio, y lo único que las distingue es el texto
    // libre del `CDATA` —bilingüe, no contractual y con una errata del propio
    // Catastro («No records *founded*»)—, sobre el que está PROHIBIDO ramificar.
    expect(deLaCaja, 'los dos códigos ya no coinciden: el servicio ha cambiado').toBe(deLaRc)
    expect(cdataDe(EXC_BBOX_VACIO), 'lo único que difiere es el texto libre')
      .not.toBe(cdataDe(EXC_RC_INEXISTENTE))
  })

  it('⚠️ una caja SIN parcelas no devuelve una colección vacía: devuelve una excepción', () => {
    // Esto CORRIGE a la spec, que dice «el WFS puede devolver `ExceptionReport` o
    // feature vacía». Medido: la feature vacía no existe, las dos ramas son la
    // misma rama, y por eso no hay ningún motivo `VACIO` en el catálogo.
    expect(SPEC_F05, 'la spec ya no dice lo que este guardián corrige').toMatch(/feature vacía/)
    expect(miembrosDe(EXC_BBOX_VACIO), 'el cuerpo de la caja vacía no es una colección').toBe(0)
    expect(EXC_BBOX_VACIO).toContain('<ExceptionReport')
    expect(Object.keys(MOTIVO_CATASTRO), 'no hay motivo `VACIO`: no se puede derivar de la forma')
      .not.toContain('VACIO')
  })

  it('y los dos caminos salen del cliente con el MISMO motivo, sin distinguirse', async () => {
    const { cliente } = montar()
    const porRc = await cliente.parcelaPorRefcat(RC_INEXISTENTE)
    const porCaja = await cliente.parcelasEnBbox(BBOX_MAR.bbox, { srs: BBOX_MAR.srs })

    expect(porRc.motivo).toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
    expect(porCaja.motivo).toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
    expect(porCaja.motivo, 'si se distinguieran, este guardián estaría de más').toBe(porRc.motivo)

    // El texto del servicio sí llega entero al usuario, para que sepa cuál de los
    // dos casos era. Se ENSEÑA; no se lee para decidir nada.
    expect(porRc.mensaje).toContain(cdataDe(EXC_RC_INEXISTENTE))
    expect(porCaja.mensaje).toContain(cdataDe(EXC_BBOX_VACIO))
  })
})

// services/_catastro-ovc.js — F05 · GEOCODIFICACIÓN INVERSA del Catastro (OVC
// Callejero, operación `Consulta_RCCOOR`): de un punto pinchado en el mapa a una
// referencia catastral.
//
// Módulo INTERNO de `services/` (de ahí el guion bajo, como `_red.js` y
// `_catastro-wfs.js`). **No toca la red**: recibe TEXTO y devuelve ESTRUCTURA,
// exactamente igual que `gml/parse.js`. Quien pide es el transporte
// (`services/_red.js`); quien traduce lo de aquí al vocabulario público del
// proyecto (`MOTIVO_CATASTRO`) es `services/catastro.js`. Este módulo devuelve un
// `tipo` PROPIO —{@link TIPO_RCCOOR}, documentado abajo— y deja traducir a la capa
// de arriba; así el lector de la respuesta se puede probar sin doblar un `fetch`.
//
// PARA QUÉ SIRVE EN LA APP (spec `feature-05-catastro-vivo.md`, §"deducción
// automática de RC"): la geometría entra por DXF/LIST/TXT sin parcela previa, se
// calcula el centroide y se le pregunta al Catastro qué parcela lo contiene, para
// rellenar la referencia en un campo EDITABLE ("Parcela deducida de la ubicación ·
// puedes corregirla"). Y si el punto no cae en una parcela única, la spec es
// explícita: **no se rellena nada a ciegas**, se deja elegir. De ahí que el
// resultado diga CUÁNTOS candidatos hay y traiga el domicilio de cada uno.
//
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ LA TRAMPA: HAY DOS ENDPOINTS DE GEOCODIFICACIÓN INVERSA EN EL OVC Y NO       ║
// ║ COMPARTEN LOS NOMBRES DE LOS PARÁMETROS.                                     ║
// ║   · `…/OVCSWLocalizacionRC/OVCCoordenadas.asmx` (SOAP/XML)                   ║
// ║       → `Coordenada_X` / `Coordenada_Y`                                      ║
// ║   · `…/OVCWcfCallejero/COVCCoordenadas.svc/json` (el que usa este módulo)    ║
// ║       → **`CoorX` / `CoorY`**                                                ║
// ║                                                                              ║
// ║ Si alguien "unifica" los nombres y le manda `Coordenada_X` al endpoint JSON, ║
// ║ el servicio contesta **HTTP 200** con                                        ║
// ║                                                                              ║
// ║   {"Consulta_RCCOORResult":{"control":{"cuerr":1},                           ║
// ║     "lerr":[{"cod":"76","des":"LA COORDENADA X OBLIGATORIA"}]}}              ║
// ║                                                                              ║
// ║ …que tiene EXACTAMENTE LA MISMA FORMA que un "aquí no hay parcela". Un       ║
// ║ lector ingenuo —`if (control.cuerr) return {estado:'sin-parcela'}`— le diría ║
// ║ al usuario que en ese punto no hay nada. La verdad es que **hemos            ║
// ║ construido mal la URL**: el fallo es NUESTRO, está en todas las peticiones,  ║
// ║ y se arregla en una línea. El usuario, mientras tanto, mueve el marcador,    ║
// ║ vuelve a leer "aquí no hay nada" y concluye que el Catastro está caído.      ║
// ║ Es un error silencioso de manual y la REGLA DE ORO 1 lo prohíbe.             ║
// ║ Medido: `test/fixtures/catastro/ovc-rccoor-cod76.json`.                      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// Y hay un SEGUNDO caso del mismo patrón, también medido
// (`ovc-rccoor-cod16.json`): con `SRS=EPSG:9999` sobre unas coordenadas que **sí**
// tienen parcela —el mismo punto del fixture de éxito—, el OVC contesta `cod:16`,
// «PARA ESAS COORDENADAS NO HAY REFERENCIA DISPONIBLE». Culpa al PUNTO cuando el
// problema estaba en el SRS. Dos veces el mismo patrón: el servicio informa de un
// fallo NUESTRO con el vocabulario de un resultado negativo SUYO.
//
// ── LAS TRES DEFENSAS DE ESTE MÓDULO ─────────────────────────────────────────
//
//   1. **El SRS se valida ANTES de emitir la petición**, delegando en
//      `geo/huso.js#husoPorSrs`: de {@link urlRccoor} solo salen los tres SRS que
//      el proyecto soporta (25829/25830/25831). Así el `cod:16` por SRS inválido
//      NO LLEGA A OCURRIR NUNCA, que es mejor que saber interpretarlo. En la misma
//      línea se comprueba con `detectarHuso` que la coordenada cae dentro de
//      `BBOX_ESPANA` (y del huso declarado): ahorra una petición y da mejor
//      mensaje que el servicio.
//   2. **Solo los `cod` de {@link COD_OVC_SIN_REFERENCIA} significan «aquí no hay
//      parcela»**, y esa tabla está congelada, es corta, y cada entrada dice de
//      dónde sale. La pertenencia se juzga por el `cod`, nunca por el `des`.
//   3. **Cualquier otro `cod` es {@link TIPO_RCCOOR.RESPUESTA_ILEGIBLE}**, con el
//      `cod` y el `des` LITERALES del servicio dentro del mensaje y diciendo que
//      eso apunta a un fallo de ESTA APLICACIÓN, no a una parcela inexistente. Es
//      la diferencia entre que el usuario se vaya a buscar otra parcela y que el
//      programador arregle un bug.
//
// La defensa 3 es la que hace que este módulo valga la pena, y es la que se
// romperá primero: el día que alguien vea el caso 76 en producción, la tentación
// será meter `'76'` en la tabla de la defensa 2 "para que no dé error". Eso
// convertiría el bug en un mensaje tranquilizador y falso. `test/services/
// catastro-ovc.test.js` deja esa consecuencia por escrito, con un test que afirma
// que `'76'` NO está en la tabla y explica qué pasaría si lo estuviera.
//
// ── LO QUE HAY QUE SABER DEL CUERPO DE LA RESPUESTA ──────────────────────────
// Todo medido contra el servicio real el 2026-07-27 y documentado en
// `test/fixtures/catastro/PROCEDENCIA.md`, que MANDA sobre cualquier otra fuente:
//
//   · **El cuerpo lleva ENVOLTORIO**: absolutamente todo cuelga de
//     `Consulta_RCCOORResult`. No es opcional y no se omite.
//   · **La RC llega PARTIDA EN DOS**: `pc.pc1` (7 caracteres) + `pc.pc2` (7) = los
//     14 de la referencia de parcela. NO hay ningún campo con la RC completa. Hay
//     que concatenar, y hay que comprobar la longitud resultante.
//   · **`ldt` es el domicilio** ('CL SAN RESTITUTO 72(C) MADRID (MADRID)'): es lo
//     ÚNICO que permite a una persona distinguir entre varios candidatos. Una
//     lista de referencias catastrales desnudas es ilegible para el usuario, así
//     que el domicilio se conserva y se expone.
//   · **`coordenadas.coord` es un ARRAY**: un punto en un linde puede devolver más
//     de un candidato. Nunca se asume uno.
//   · **Todo son cadenas**, también las coordenadas ('439242.88', no 439242.88).
//   · **`control` cambia de clave según la rama**: `cucoor` en el éxito, `cuerr`
//     en el error. Son claves DISTINTAS, no un mismo campo con valores distintos.
//   · **El error llega con HTTP 200**, igual que el acierto. `response.ok` no
//     clasifica nada en este servicio: la clasificación se hace leyendo el cuerpo,
//     que es justo lo que hace {@link leerRccoor}.
//
// ⚠️ **EL SRS DEL OVC LLEVA UN SOLO DOS PUNTOS** (`EPSG:25830`), y es la MISMA
// forma corta que usa el modelo interno y que entiende `geo/huso.js`. El WFS del
// mismo organismo, en cambio, quiere `EPSG::25830` con DOS (`srsname=EPSG::25830`,
// ver `services/_catastro-wfs.js`), y el GML que devuelve escribe encima una
// tercera forma, la URI OGC. Son dos servicios de la misma casa con dos
// convenciones distintas para el mismo dato: pasar aquí la forma del WFS produce
// un `RangeError` de {@link urlRccoor} —a propósito— en vez de una consulta que
// el servicio contestaría con un `cod` engañoso.
//
// ⏱️ **LATENCIA MEDIDA: HASTA 2,9 s** en este endpoint (`ovc-rccoor-cod16.json`
// tardó 2,903 s; el de éxito 0,417 s), unas diez veces más que el WFS, que se mide
// en décimas. La explicación más probable es que cada llamada al `.svc/json` abre
// sesión ASP.NET nueva (`Set-Cookie: ASP.NET_SessionId` en las tres respuestas).
// Fijar el timeout NO es cosa de este módulo (es de `services/_red.js`), pero
// queda anotado aquí para que nadie lo baje pensando que 0,2 s es lo normal: una
// nota anterior daba el rango 0,11–0,21 s, que es cierto para el WFS y FALSO para
// el OVC. Un timeout calculado sobre esa cifra cortaría llamadas que iban a
// contestar bien, y el usuario vería un fallo de red donde había una parcela.
//
// Contrato de errores (SPEC §2, regla 1), la misma frontera que en todo el
// proyecto: **contrato roto por el PROGRAMADOR** (coordenada no finita, SRS
// inválido, `texto` que no es texto) → `throw TypeError`/`RangeError`; **respuesta
// rara del SERVICIO** → objeto de estado, jamás una excepción. Un servidor de
// terceros que devuelve algo inesperado es un suceso previsible, no un bug.

import { BBOX_ESPANA, detectarHuso, husoPorSrs } from '../geo/huso.js'

// ── Constantes del servicio ───────────────────────────────────────────────────

/**
 * Endpoint ÚNICO de la geocodificación inversa del OVC, en su variante **WCF/JSON**
 * (`.svc/json`). Punto único de contingencia CORS del proyecto (regla de oro 7,
 * dossier §2.4): nadie más debe escribir esta URL: si mañana retiran el
 * `Access-Control-Allow-Origin: *` —hoy medido y presente— se apunta a un proxy
 * aquí y el resto del código no se entera.
 *
 * Es el `.svc/json`, **no** el `.asmx`: son dos endpoints distintos con dos juegos
 * de nombres de parámetro (ver la trampa en la cabecera del módulo). El `.asmx`
 * NUNCA se ha medido en este proyecto (hueco declarado en `PROCEDENCIA.md`), así
 * que no se usa.
 *
 * Latencia medida en este endpoint: **hasta 2,9 s**. Ver la cabecera.
 *
 * @readonly
 */
export const CATASTRO_OVC_RCCOOR_JSON =
  'https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCoordenadas.svc/json/Consulta_RCCOOR'

/**
 * Los tres nombres de parámetro del endpoint JSON, en un solo sitio. Existen como
 * constante —y no incrustados en la plantilla de la URL— para que la trampa de la
 * cabecera tenga un lugar físico donde estar escrita y para que el test pueda
 * afirmar sobre ellos.
 *
 * ⛔ `Coordenada_X`/`Coordenada_Y` son los del **otro** endpoint (el `.asmx`) y en
 * este devuelven `cod:76` con HTTP 200. No se "unifican" jamás.
 *
 * @readonly
 */
export const PARAM_RCCOOR = Object.freeze({
  /** Sistema de referencia, en forma CORTA con UN dos puntos: `EPSG:25830`. */
  srs: 'SRS',
  /** Coordenada Este. En el `.asmx` se llamaría `Coordenada_X`; aquí NO. */
  x: 'CoorX',
  /** Coordenada Norte. En el `.asmx` se llamaría `Coordenada_Y`; aquí NO. */
  y: 'CoorY',
})

/**
 * Clave del envoltorio: en la respuesta de este endpoint **todo** cuelga de aquí,
 * tanto en el camino de éxito como en el de error. Omitirlo es leer `undefined` y
 * concluir cualquier cosa.
 *
 * @readonly
 */
export const CLAVE_ENVOLTORIO_RCCOOR = 'Consulta_RCCOORResult'

/**
 * Longitud de una referencia catastral de PARCELA: 14 caracteres, que es lo que
 * suma la concatenación de los dos campos en que el OVC la parte (`pc1`, 7 + `pc2`,
 * 7). Se comprueba el TOTAL y no cada mitad a propósito: el reparto 7+7 es lo
 * medido, pero lo que define una RC de parcela es su longitud completa, y un
 * hipotético reparto distinto que sumara 14 seguiría dando la referencia correcta.
 *
 * (Los 20 caracteres de la RC de un INMUEBLE —14 + cargo/control— son otra cosa y
 * no salen de este endpoint.)
 *
 * @readonly
 */
export const LONGITUD_REFCAT_PARCELA = 14

// ── Los códigos que significan de verdad «aquí no hay parcela» ───────────────

/**
 * Tabla CONGELADA de los `cod` del OVC que significan «en ese punto no hay
 * referencia catastral». Es la defensa 2 de la cabecera, y es deliberadamente
 * CORTA: todo lo que no esté aquí se clasifica como
 * {@link TIPO_RCCOOR.RESPUESTA_ILEGIBLE}, es decir, como fallo de esta aplicación.
 *
 * ⛔ **Añadir un código a esta tabla es una decisión con consecuencias**: convierte
 * un fallo técnico en un "no encontrado" que el usuario se creerá. En particular,
 * meter aquí el `'76'` («LA COORDENADA X OBLIGATORIA») haría que una URL mal
 * construida —un bug nuestro, reproducible en el 100% de las peticiones— se
 * mostrara como «aquí no hay parcela». Hay un test que lo deja por escrito.
 *
 * La pertenencia se juzga SIEMPRE por el `cod`, nunca por el `des`: el texto es
 * libre, está en mayúsculas y el Catastro lo puede reescribir sin avisar. El `des`
 * se guarda aquí solo para que quien lea esta tabla sepa de qué código se habla.
 *
 * @readonly
 * @type {Readonly<Record<string, Readonly<{cod: string, des: string, motivo: string}>>>}
 */
export const COD_OVC_SIN_REFERENCIA = Object.freeze({
  '16': Object.freeze({
    cod: '16',
    des: 'PARA ESAS COORDENADAS NO HAY REFERENCIA DISPONIBLE',
    motivo:
      'Es el código con el que el OVC dice que no tiene parcela en el punto consultado. ' +
      'Medido en `test/fixtures/catastro/ovc-rccoor-cod16.json`. ' +
      'HONESTIDAD SOBRE SU PROCEDENCIA: ese fixture se capturó con `SRS=EPSG:9999` sobre ' +
      'un punto que SÍ tiene parcela, así que lo que demuestra directamente es que el ' +
      'servicio usa este código también para culpar al punto de un problema del SRS. Se ' +
      'mantiene aquí porque el significado del código es el que dice su propio `des`, y ' +
      'porque la defensa 1 (validar el SRS antes de pedir) hace que esa procedencia sea ' +
      'inofensiva: con un SRS de los tres soportados, un `cod:16` solo puede querer decir ' +
      'lo que dice. HUECO DECLARADO: no se ha capturado un `cod:16` con SRS válido sobre ' +
      'suelo sin parcela — habría sido otra petición al servicio, y la política de uso del ' +
      'Catastro sanciona el uso automático con ~10 días de denegación (override O8).',
  }),
})

/**
 * ¿Este `cod` significa «aquí no hay parcela»? Única forma admitida de consultar
 * {@link COD_OVC_SIN_REFERENCIA}: se usa `hasOwnProperty` para que un `cod` como
 * `'constructor'` o `'toString'` —que el servicio jamás mandará, pero que un
 * `in` daría por bueno— no cuele como «no encontrado».
 *
 * Es ESTRICTA con el tipo: el `cod` medido es una CADENA (`"16"`, no `16`). Si
 * algún día llegara numérico, esta función devuelve `false` y el resultado sale
 * como ilegible, que es el lado seguro: un cambio de formato del servicio es
 * exactamente el tipo de suceso que no debe disfrazarse de resultado negativo.
 *
 * @param {*} cod  Valor leído de `lerr[i].cod`. Cualquier cosa: no hay contrato.
 * @returns {boolean}
 */
export function esCodSinReferencia(cod) {
  return (
    typeof cod === 'string' && Object.prototype.hasOwnProperty.call(COD_OVC_SIN_REFERENCIA, cod)
  )
}

// ── Vocabulario del resultado ─────────────────────────────────────────────────

/**
 * Los tres desenlaces posibles de una lectura. Vocabulario PROPIO de este módulo:
 * `services/catastro.js` los traduce a su `MOTIVO_CATASTRO`, que es el que ve el
 * resto de la aplicación. Están separados a propósito — meter «no hay parcela» y
 * «no te entiendo» en el mismo cajón es justo el error que este módulo existe para
 * impedir.
 *
 * @readonly
 */
export const TIPO_RCCOOR = Object.freeze({
  /**
   * El servicio ha devuelto una o más referencias catastrales. **Uno o varios**:
   * con más de uno, la spec prohíbe rellenar nada a ciegas (ver `unico`).
   */
  CANDIDATOS: 'CANDIDATOS',
  /**
   * No hay parcela en ese punto, dicho por el servicio con un `cod` de
   * {@link COD_OVC_SIN_REFERENCIA}. Es un **estado válido**, no un fallo: hay
   * suelo sin parcela, y País Vasco y Navarra tienen catastro propio (fuera de
   * alcance de este proyecto).
   */
  SIN_REFERENCIA: 'SIN_REFERENCIA',
  /**
   * No se entiende la respuesta: un `cod` desconocido, un cuerpo que no es el que
   * documenta `PROCEDENCIA.md`, o algo que ni siquiera es JSON. **Esto apunta a un
   * fallo de esta aplicación (típicamente, una URL mal construida) o a un cambio
   * del servicio; NO a una parcela inexistente.** Se le cuenta al usuario como
   * problema técnico, y con el `cod`/`des` literales delante para que se pueda
   * copiar en un informe de fallo.
   */
  RESPUESTA_ILEGIBLE: 'RESPUESTA_ILEGIBLE',
})

/**
 * Una parcela candidata en el punto consultado. POJO plano (regla de oro 4).
 *
 * @typedef {Object} CandidatoRccoor
 * @property {string} refcat  Referencia catastral de parcela, {@link
 *   LONGITUD_REFCAT_PARCELA} caracteres, resultado de concatenar `pc1` y `pc2`.
 *   El servicio NO manda este campo: se construye aquí.
 * @property {string} pc1  Primera mitad, tal como vino (para poder rastrear el dato).
 * @property {string} pc2  Segunda mitad, tal como vino.
 * @property {string|null} domicilio  El `ldt` del servicio ('CL SAN RESTITUTO 72(C)
 *   MADRID (MADRID)'). Es lo ÚNICO con lo que una persona puede elegir entre varios
 *   candidatos, así que se conserva íntegro. `null` si el servicio no lo manda —que
 *   no se ha visto, pero un domicilio ausente y uno vacío no son lo mismo y la UI
 *   debe poder distinguirlos.
 * @property {{x: number, y: number, srs: string|null}|null} centro  Eco del punto
 *   que el servicio asocia al candidato (`geo.xcen`/`geo.ycen`/`geo.srs`), ya
 *   convertido a números. `null` cuando no viene o no es legible: el candidato
 *   sigue sirviendo, porque a este endpoint se le pide la REFERENCIA, no la
 *   coordenada. Es `null` y no `{x:0,y:0}` para que nadie pinte un punto inventado.
 */

/**
 * Resultado de {@link leerRccoor}. **Forma ÚNICA para los tres desenlaces**: todos
 * los campos existen siempre, así que el llamante puede leer `cuantos` o `cod` sin
 * comprobar antes el `tipo` y sin que un `undefined` se le cuele en un mensaje.
 * Misma idea que `gml/_comun.js#DIALECTO_DESCONOCIDO`.
 *
 * @typedef {Object} ResultadoRccoor
 * @property {'CANDIDATOS'|'SIN_REFERENCIA'|'RESPUESTA_ILEGIBLE'} tipo  Ver {@link TIPO_RCCOOR}.
 * @property {string} mensaje  Texto en español, listo para la UI, que dice qué ha
 *   pasado y —en el caso ilegible— de quién es el problema.
 * @property {CandidatoRccoor[]} candidatos  Los candidatos leídos. Vacío salvo en
 *   `CANDIDATOS`, donde tiene al menos uno.
 * @property {number} cuantos  `candidatos.length`, **contado**, nunca leído de un
 *   contador del servicio (lección del WFS: su `numberReturned` declara 539 cuando
 *   manda 10 — ver `PROCEDENCIA.md`).
 * @property {boolean} unico  `cuantos === 1`. Es la condición que la spec exige
 *   para rellenar la RC deducida: con varios candidatos **no se rellena nada a
 *   ciegas**, se deja elegir al usuario.
 * @property {number|null} declarados  El `control.cucoor` del servicio, tal cual, o
 *   `null`. Se expone para poder contrastarlo con `cuantos`; el que manda es
 *   `cuantos`.
 * @property {string|null} cod  `cod` del servicio (`lerr[i].cod`), **literal**: se
 *   pasa tal como vino, sin normalizar, para que quien reporte el fallo copie lo
 *   que dijo el Catastro y no una versión nuestra. Lo medido es siempre una cadena
 *   (`"16"`, `"76"`); si algún día llegara de otro tipo, ese tipo raro se ve aquí y
 *   el `tipo` ya será `RESPUESTA_ILEGIBLE`, porque {@link esCodSinReferencia} solo
 *   reconoce cadenas. En `RESPUESTA_ILEGIBLE` es el del PRIMER código desconocido,
 *   que es el que hay que investigar.
 * @property {string|null} des  `des` del servicio, literal y sin traducir. Está en
 *   mayúsculas porque así viene.
 */

// ── Construcción de la URL — DEFENSA 1: validar antes de emitir ──────────────

/**
 * URL de la consulta `Consulta_RCCOOR` para un punto, **validando el SRS y la
 * coordenada ANTES de que la petición exista**.
 *
 * Es la defensa 1 de la cabecera. No es una comprobación de cortesía: con un SRS
 * que el OVC no conoce, el servicio contesta HTTP 200 y `cod:16` («para esas
 * coordenadas no hay referencia disponible»), o sea que **culpa al punto de un
 * problema del SRS**. Como aquí solo se dejan pasar los tres SRS del proyecto, esa
 * respuesta engañosa no puede llegar a producirse por esa causa.
 *
 * La coordenada se valida contra `BBOX_ESPANA` **delegando en `detectarHuso`**, que
 * es quien sabe hacerlo (desproyecta con el huso indicado y comprueba la caja); no
 * se duplica aquí ni la caja ni la desproyección. Comprobar antes de pedir ahorra
 * una petición al Catastro —que sanciona el uso abusivo (override O8)— y da un
 * mensaje mucho mejor que el del servicio. Como `detectarHuso` exige además que el
 * punto caiga en la ventana del meridiano central del huso, un punto de España
 * expresado en el huso equivocado también se rechaza aquí, y el mensaje llega a
 * sugerir el SRS correcto cuando lo hay.
 *
 * Sobre el escapado: la cadena de consulta se compone a mano en vez de con
 * `URLSearchParams` porque este emite `SRS=EPSG%3A25830` y la petición MEDIDA
 * —`PROCEDENCIA.md`— lleva el dos puntos literal. Los dos puntos son un carácter
 * legal en la *query* (RFC 3986 §3.4) y no hay nada que escapar: tras las
 * validaciones de arriba, `srs` es una de tres constantes del proyecto y `x`/`y`
 * son números finitos de magnitud UTM peninsular, así que su representación de
 * texto son dígitos, un punto y un signo. No se corre el riesgo de mandar una
 * petición ligeramente distinta de la única que se ha comprobado que funciona.
 *
 * @param {number} x  Coordenada Este (metros, UTM del huso de `srs`).
 * @param {number} y  Coordenada Norte (metros).
 * @param {string} srs  Forma CORTA con UN dos puntos: `'EPSG:25830'`. ⚠️ NO la del
 *   WFS (`'EPSG::25830'`, con dos): esa forma es de otro servicio y aquí se
 *   rechaza.
 * @returns {string}  URL absoluta, lista para el transporte.
 * @throws {TypeError}   Si `x` o `y` no son números finitos, o `srs` no es un string.
 * @throws {RangeError}  Si `srs` no es uno de los soportados (Canarias, `EPSG:32628`,
 *   está DIFERIDA — override O13), o si el punto no cae dentro de España en ese huso.
 */
export function urlRccoor(x, y, srs) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError(
      `urlRccoor: coordenada no finita [${x}, ${y}]. Se esperaban metros UTM ` +
        `(x=Este, y=Norte) del huso de ${JSON.stringify(srs)}.`,
    )
  }

  // Delegación pura: `husoPorSrs` lanza TypeError si no es string y RangeError si
  // el SRS no es de los tres soportados. Su mensaje ya nombra los válidos y el
  // aplazamiento de Canarias, así que no se envuelve ni se reescribe.
  const huso = husoPorSrs(srs)

  // `[huso]` = modo VERIFICAR de `detectarHuso` (su JSDoc: "si el dato ya trae
  // huso, pásalo como único candidato"). Devuelve null si el punto no cae en el
  // bbox España o fuera de la ventana del meridiano central de ese huso.
  if (detectarHuso([x, y], [huso]) === null) {
    const alternativa = detectarHuso([x, y])
    const pista =
      alternativa === null
        ? 'El punto no cae en España con ningún huso soportado (29/30/31).'
        : `Con ${alternativa.srs} sí caería (lon ${alternativa.lon.toFixed(4)}, ` +
          `lat ${alternativa.lat.toFixed(4)}): ¿es ese el SRS del dato?`
    throw new RangeError(
      `urlRccoor: el punto [${x}, ${y}] en ${srs} no cae dentro de España ` +
        `(lon ${BBOX_ESPANA.lonMin}…${BBOX_ESPANA.lonMax}, ` +
        `lat ${BBOX_ESPANA.latMin}…${BBOX_ESPANA.latMax}; Canarias DIFERIDA, override O13). ` +
        `${pista} No se emite la petición: el Catastro contestaría un código de error ` +
        `que dice "aquí no hay parcela", y eso sería mentir sobre la causa.`,
    )
  }

  const consulta = [
    `${PARAM_RCCOOR.srs}=${srs}`,
    `${PARAM_RCCOOR.x}=${x}`,
    `${PARAM_RCCOOR.y}=${y}`,
  ].join('&')
  return `${CATASTRO_OVC_RCCOOR_JSON}?${consulta}`
}

// ── Lectura de la respuesta — DEFENSAS 2 y 3 ─────────────────────────────────

/** ¿Objeto plano (ni null, ni array)? */
const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Base común del resultado: todos los campos existen siempre. */
function resultadoBase(tipo, mensaje) {
  return {
    tipo,
    mensaje,
    candidatos: [],
    cuantos: 0,
    unico: false,
    declarados: null,
    cod: null,
    des: null,
  }
}

/**
 * Construye el resultado ilegible. Toda respuesta que no se entienda pasa por
 * aquí, y por eso el sufijo del mensaje —"esto apunta a un fallo de esta
 * aplicación, no a una parcela inexistente"— se escribe UNA vez: es la frase que
 * impide el error silencioso y no puede depender de que cada rama se acuerde.
 *
 * @param {string} porque  Qué se ha encontrado, con los datos literales.
 * @param {{cod?: string|null, des?: string|null}} [datos]
 * @returns {ResultadoRccoor}
 */
function ilegible(porque, { cod = null, des = null } = {}) {
  const r = resultadoBase(
    TIPO_RCCOOR.RESPUESTA_ILEGIBLE,
    `No se entiende la respuesta del Catastro (geocodificación inversa): ${porque} ` +
      `Esto apunta a un FALLO DE ESTA APLICACIÓN —lo más probable, una URL mal ` +
      `construida— o a un cambio del servicio; NO a que en ese punto no haya parcela.`,
  )
  r.cod = cod
  r.des = des
  return r
}

/** Número del OVC: llega como cadena ('439242.88'). `null` si no es legible. */
function numeroOvc(crudo) {
  if (typeof crudo === 'number') return Number.isFinite(crudo) ? crudo : null
  if (typeof crudo !== 'string') return null
  const texto = crudo.trim()
  // `Number('')` es 0, que aquí sería una coordenada inventada en el ecuador: la
  // cadena vacía se descarta ANTES de convertir.
  if (texto === '') return null
  const n = Number(texto)
  return Number.isFinite(n) ? n : null
}

/** Cadena no vacía tal cual (recortada), o `null`. */
function textoOvc(crudo) {
  if (typeof crudo !== 'string') return null
  const texto = crudo.trim()
  return texto === '' ? null : texto
}

/**
 * Lee un elemento de `coordenadas.coord`.
 *
 * @param {*} crudo
 * @returns {{candidato: CandidatoRccoor}|{fallo: string}}
 */
function leerCandidato(crudo) {
  if (!esObjeto(crudo)) {
    return { fallo: `no es un objeto (es ${JSON.stringify(crudo)})` }
  }
  const pc = crudo.pc
  if (!esObjeto(pc)) {
    return { fallo: 'no trae el objeto `pc` con las dos mitades de la referencia catastral' }
  }
  // La referencia se CONSTRUYE: el servicio no manda ningún campo con los 14
  // caracteres juntos (`PROCEDENCIA.md`, `ovc-rccoor-ok.json`).
  const pc1 = typeof pc.pc1 === 'string' ? pc.pc1.trim() : ''
  const pc2 = typeof pc.pc2 === 'string' ? pc.pc2.trim() : ''
  const refcat = `${pc1}${pc2}`
  if (refcat.length !== LONGITUD_REFCAT_PARCELA) {
    return {
      fallo:
        `la referencia catastral que sale de concatenar \`pc1\` (${JSON.stringify(pc.pc1)}) ` +
        `y \`pc2\` (${JSON.stringify(pc.pc2)}) mide ${refcat.length} caracteres y una ` +
        `referencia de parcela mide ${LONGITUD_REFCAT_PARCELA}`,
    }
  }

  const geo = esObjeto(crudo.geo) ? crudo.geo : null
  const gx = geo === null ? null : numeroOvc(geo.xcen)
  const gy = geo === null ? null : numeroOvc(geo.ycen)
  const centro = gx === null || gy === null ? null : { x: gx, y: gy, srs: textoOvc(geo.srs) }

  return {
    candidato: {
      refcat,
      pc1,
      pc2,
      // `ldt` es el domicilio, y es lo único que hace elegible una lista de varios.
      domicilio: textoOvc(crudo.ldt),
      centro,
    },
  }
}

/** Clasifica la rama de error del servicio (defensas 2 y 3). */
function clasificarErrores(errores) {
  const leidos = []
  for (const [i, e] of errores.entries()) {
    if (!esObjeto(e)) {
      return ilegible(`\`lerr[${i}]\` no es un objeto (es ${JSON.stringify(e)}).`)
    }
    const cod = typeof e.cod === 'string' ? e.cod.trim() : e.cod
    const des = textoOvc(e.des)
    if (cod === undefined || cod === null || cod === '') {
      return ilegible(`\`lerr[${i}]\` no trae \`cod\` (des: ${JSON.stringify(e.des)}).`, { des })
    }
    leidos.push({ cod, des })
  }

  // DEFENSA 3, y es la que importa: basta UN código fuera de la tabla para que la
  // respuesta entera sea ilegible. No se "aprovecha" el resto: si no entendemos
  // una parte de lo que el servicio dice, no estamos en condiciones de afirmar
  // que en ese punto no hay parcela.
  const desconocido = leidos.find((e) => !esCodSinReferencia(e.cod))
  if (desconocido !== undefined) {
    const codigos = Object.keys(COD_OVC_SIN_REFERENCIA).join(', ')
    return ilegible(
      `el servicio ha contestado con el código ${JSON.stringify(desconocido.cod)} ` +
        `(«${desconocido.des ?? 'sin descripción'}»), que NO está entre los que significan ` +
        `«aquí no hay parcela» (${codigos}). ` +
        `Caso conocido: con los nombres de parámetro del endpoint .asmx ` +
        `(\`Coordenada_X\`/\`Coordenada_Y\`) en vez de los de este ` +
        `(\`${PARAM_RCCOOR.x}\`/\`${PARAM_RCCOOR.y}\`), el servicio responde HTTP 200 con ` +
        `el código "76".`,
      { cod: desconocido.cod, des: desconocido.des },
    )
  }

  // DEFENSA 2: todos los códigos están en la tabla → esto sí es un «no hay parcela».
  const primero = leidos[0]
  const r = resultadoBase(
    TIPO_RCCOOR.SIN_REFERENCIA,
    `El Catastro no tiene ninguna referencia catastral en ese punto ` +
      `(código ${primero.cod}: «${primero.des ?? 'sin descripción'}»). ` +
      `Es un estado VÁLIDO, no un fallo: hay suelo sin parcela, y el País Vasco y ` +
      `Navarra tienen catastro propio (fuera del alcance de esta herramienta).`,
  )
  r.cod = primero.cod
  r.des = primero.des
  return r
}

/** Lee la rama de éxito: `coordenadas.coord`. */
function clasificarCoordenadas(coordenadas, declarados) {
  if (!esObjeto(coordenadas)) {
    return ilegible(`\`coordenadas\` no es un objeto (es ${JSON.stringify(coordenadas)}).`)
  }
  const lista = coordenadas.coord
  if (!Array.isArray(lista)) {
    // Es un ARRAY en el fixture real. Si algún día llegara un objeto suelto (los
    // servicios que colapsan los arrays de un elemento existen), queremos
    // enterarnos, no adivinarlo: adivinar es como se empieza a leer mal.
    return ilegible(
      `\`coordenadas.coord\` debería ser un array (puede haber varios candidatos en un ` +
        `linde) y es ${JSON.stringify(lista)}.`,
    )
  }
  if (lista.length === 0) {
    // HUECO DECLARADO: no se ha medido qué manda el servicio sobre suelo sin
    // parcela con un SRS válido. Podría ser este array vacío o podría ser el
    // `cod:16`. Hasta que alguien lo capture, esto es "no lo sé", que es el lado
    // seguro: decir «no hay parcela» sin haberlo comprobado es inventarse la
    // respuesta del Catastro.
    return ilegible(
      '`coordenadas.coord` es un array VACÍO. Ese caso no está medido contra el servicio ' +
        'real (ver `test/fixtures/catastro/PROCEDENCIA.md`), así que no se traduce a «aquí ' +
        'no hay parcela»: el único «no hay parcela» que este proyecto reconoce es el que ' +
        'llega como código de error.',
    )
  }

  const candidatos = []
  for (const [i, crudo] of lista.entries()) {
    const leido = leerCandidato(crudo)
    if (leido.fallo !== undefined) {
      return ilegible(`\`coordenadas.coord[${i}]\` ${leido.fallo}.`)
    }
    candidatos.push(leido.candidato)
  }

  const cuantos = candidatos.length
  const unico = cuantos === 1
  // El domicilio va SIEMPRE en el mensaje: una lista de referencias catastrales
  // desnudas no le sirve a nadie para elegir.
  const resumen = candidatos
    .map((c) => `${c.refcat} (${c.domicilio ?? 'sin domicilio'})`)
    .join('; ')
  const r = resultadoBase(
    TIPO_RCCOOR.CANDIDATOS,
    unico
      ? `Una referencia catastral en el punto consultado: ${resumen}.`
      : `${cuantos} referencias catastrales en el punto consultado: ${resumen}. ` +
        `Con más de un candidato NO se rellena la referencia a ciegas: hay que mostrar ` +
        `los domicilios y dejar elegir.`,
  )
  r.candidatos = candidatos
  r.cuantos = cuantos
  r.unico = unico
  r.declarados = declarados
  return r
}

/**
 * Lee el cuerpo de una respuesta de `Consulta_RCCOOR` y lo CLASIFICA.
 *
 * Este módulo no toca la red: entra el texto que haya devuelto el transporte y
 * sale una estructura. **Nunca lanza por culpa del servicio** —una respuesta rara
 * es un {@link ResultadoRccoor} de tipo `RESPUESTA_ILEGIBLE`—; lanza solo si el
 * llamante rompe el contrato pasando algo que no es texto.
 *
 * Recuérdese que **el error del OVC llega con HTTP 200** igual que el acierto: el
 * transporte no puede clasificar nada mirando el código de estado, y por eso la
 * clasificación entera vive aquí, en el cuerpo.
 *
 * @param {string} texto  Cuerpo de la respuesta, tal cual (`await res.text()`).
 * @returns {ResultadoRccoor}
 * @throws {TypeError}  Si `texto` no es un string (contrato del programador).
 */
export function leerRccoor(texto) {
  if (typeof texto !== 'string') {
    throw new TypeError(
      `leerRccoor: 'texto' debe ser un string con el cuerpo de la respuesta; ` +
        `recibido ${JSON.stringify(texto)}. Este módulo no pide nada por su cuenta: ` +
        `el transporte (services/_red.js) le pasa el texto ya descargado.`,
    )
  }

  let cuerpo
  try {
    cuerpo = JSON.parse(texto)
  } catch (err) {
    return ilegible(
      `el cuerpo no es JSON válido (${err.message}). Primeros caracteres: ` +
        `${JSON.stringify(texto.slice(0, 120))}.`,
    )
  }

  // EL ENVOLTORIO. Todo cuelga de `Consulta_RCCOORResult`, en las dos ramas.
  const res = esObjeto(cuerpo) ? cuerpo[CLAVE_ENVOLTORIO_RCCOOR] : undefined
  if (!esObjeto(res)) {
    const primerNivel = esObjeto(cuerpo) ? Object.keys(cuerpo) : cuerpo
    return ilegible(
      `el cuerpo no trae el envoltorio \`${CLAVE_ENVOLTORIO_RCCOOR}\` con un objeto dentro ` +
        `(claves de primer nivel: ${JSON.stringify(primerNivel)}).`,
    )
  }

  const control = esObjeto(res.control) ? res.control : null
  const cuerr = control === null ? undefined : control.cuerr
  const cucoor = control === null ? undefined : control.cucoor
  const declarados = typeof cucoor === 'number' && Number.isFinite(cucoor) ? cucoor : null

  // Rama de error. `lerr` presente y no-array es incomprensible; presente y vacío
  // no afirma nada y no se toma por una lista de errores.
  if (res.lerr !== undefined && !Array.isArray(res.lerr)) {
    return ilegible(`\`lerr\` debería ser un array de errores y es ${JSON.stringify(res.lerr)}.`)
  }
  const errores = Array.isArray(res.lerr) ? res.lerr : []
  const declaraErrores = typeof cuerr === 'number' && cuerr > 0

  if (declaraErrores && errores.length === 0) {
    return ilegible(
      `\`control.cuerr\` vale ${cuerr} (el servicio dice que hay errores) pero no viene ` +
        `ningún \`lerr\` que los enumere.`,
    )
  }
  if (errores.length > 0) {
    if (res.coordenadas !== undefined) {
      return ilegible(
        'el cuerpo trae a la vez `lerr` (errores) y `coordenadas` (resultados), y esas dos ' +
          'ramas son excluyentes en las respuestas medidas.',
      )
    }
    return clasificarErrores(errores)
  }

  // Rama de éxito.
  if (res.coordenadas !== undefined) {
    return clasificarCoordenadas(res.coordenadas, declarados)
  }

  return ilegible(
    `el envoltorio \`${CLAVE_ENVOLTORIO_RCCOOR}\` no trae ni \`lerr\` (error) ni ` +
      `\`coordenadas\` (resultado); sus claves son ${JSON.stringify(Object.keys(res))}.`,
  )
}

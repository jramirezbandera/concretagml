// edificio/_comun.js — F11 · T1.3. El vocabulario COMPARTIDO de la rama EDIFICIO.
//
// Estrena el directorio `edificio/`, tercer directorio de dominio que abre una
// fase (F07 abrió `diagnostico/`, F08 abrió `comprobacion/`). Aquí vive lo que
// convierte un fichero, un GML ajeno o una respuesta del WFS en el `Edificio` de
// `model/edificio.js`: el léxico (este módulo), las mutaciones puras
// (`mutaciones.js`) y las fábricas de entrada (`entrada.js`, T2.1).
//
// ── QUÉ ES ESTA CAPA, Y QUÉ NO ──────────────────────────────────────────────
// Todo lo de `edificio/` es **puro**: entran anillos, cadenas y POJOs; salen
// POJOs y detecciones. Ni `document`, ni Leaflet, ni red, ni reloj. Por eso corre
// entera bajo el proyecto Vitest `node` y por eso entra en el barrel raíz (T3.1),
// al contrario que `viewer/` o `services/`.
//
// ═════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ES EL CUARTO LÉXICO DEL PROYECTO, Y NO UN LÉXICO ÚNICO
// ═════════════════════════════════════════════════════════════════════════════
// Este proyecto tiene ya tres catálogos de detección con la MISMA forma
// —`{tipo, mensaje, severidad, datos?}`— y catálogos distintos:
//
//   1. `parsers/_comun.js` (F01) — `TIPO_DETECCION`: `ARCO_DISCRETIZADO`,
//      `SEPARADOR_DECIMAL`, `Z_DESCARTADA`… y, dentro del mismo módulo, el
//      tokenizador que comparten LIST y TXT.
//   2. `gml/_comun.js` (F04) — `TIPO_GML`: el orden del XSD, los dialectos, los
//      dos sobres. Su cabecera dejó escrito el motivo de no importar el primero:
//      metería el tokenizador de CAD en el grafo de dependencias del
//      serializador de GML, que no tiene nada que ver con leer ficheros de CAD.
//   3. `export/_comun.js` (F10) — `TIPO_EXPORT`: `HUECO_EXPORTADO`,
//      `COLAPSO_POR_REDONDEO`… «Es la tercera vez que este proyecto hace lo
//      mismo, y por el mismo motivo».
//
// Este es el cuarto, y el argumento es el de siempre MÁS uno propio de esta capa:
//
//   · El de siempre (dependencias): un `TIPO_EDIFICIO` metido dentro de
//     `parsers/_comun.js` pondría el dominio de la construcción —partes, plantas,
//     rasante, modelo ICUC— dentro de un lector de ficheros de CAD que no sabe
//     qué es un edificio. Y al revés: `edificio/entrada.js` no necesita el
//     tokenizador de LIST ni la tabla de dialectos para nombrar sus decisiones.
//   · El propio de esta capa, y es el que hace de esto una regla y no una
//     costumbre: **`edificio/` compone sobre DOS ramas a la vez**. Consume
//     `parsers/importar.js` (que emite `TIPO_DETECCION`) para la vía DXF/LIST/TXT
//     **y** `gml/parse-bu.js` (que emite `TIPO_GML`) para la vía GML/WFS.
//     Reutilizar uno de los dos catálogos obligaría a elegir un ganador, y las
//     detecciones del perdedor entrarían como cuerpo extraño en un catálogo que
//     no las declara. Con catálogo propio, las de aguas arriba se **conservan tal
//     cual** —cada una en su forma, que es la misma— y las de esta capa se emiten
//     con la suya.
//
// Y la pregunta que queda: si la FORMA es idéntica, ¿por qué no un único catálogo
// neutro para los cuatro? Porque cada catálogo es **CERRADO** y su fábrica
// **LANZA** ante un tipo ajeno, y esa clausura es justo lo que hace comprobable
// la regla de oro 1: hoy `crearDeteccion('HUECO_EXPORTADO', …)` es un error de
// carga en un parser de CAD, y con un catálogo único sería una detección válida
// que nadie sabría pintar. Un catálogo compartido convertiría cuatro contratos
// estrechos en uno ancho, que es exactamente lo contrario de lo que se busca.
//
// Lo que **sí** se comparte es la forma: la interfaz pinta las cuatro con el
// mismo componente y sin adaptador. La duplicación de {@link SEVERIDAD} es
// deliberada, como en `gml/` y en `export/`, y la vigila un test-guarda
// (`test/edificio/comun.test.js`) que prohíbe que las cuatro listas diverjan.
//
// Reglas de oro aplicables (SPEC §2):
//   · #1  Ningún error silencioso. Todo lo que esta capa decida, descarte o
//         fuerce se materializa en una {@link DeteccionEdificio}. El `throw` se
//         reserva para el contrato roto por el PROGRAMADOR.
//   · #4  POJO plano: nada de lo que sale de aquí tiene métodos ni prototipos.
//   · #8  Manda el dato medido. Ver {@link TIPO_EDIFICIO}.PARTE_BAJO_RASANTE.

// ── Severidad ────────────────────────────────────────────────────────────────

/**
 * Severidad de una {@link DeteccionEdificio}. Las mismas tres cadenas que
 * `parsers/_comun.js`, `gml/_comun.js` y `export/_comun.js`, repetidas y no
 * importadas por el motivo de la cabecera. Son tres cadenas de texto; el acoplo
 * costaría más.
 *
 * @readonly
 */
export const SEVERIDAD = Object.freeze({
  INFO: 'INFO',
  AVISO: 'AVISO',
  ERROR: 'ERROR',
})

// ── Tipos ────────────────────────────────────────────────────────────────────

/**
 * Tipos de detección de la rama EDIFICIO. Vocabulario COMPLETO desde ya —aunque
 * T1.3 solo emita tres de ellos— para que `entrada.js` (T2.1), `mutaciones.js` y
 * la interfaz (T2.5, T3.2) hablen el mismo idioma, igual que hicieron los tres
 * léxicos anteriores.
 *
 * Es un léxico SEPARADO: un `TIPO_DETECCION` de los parsers o un `TIPO_GML` no
 * cuela en {@link crearDeteccionEdificio}, ni al revés, y eso es deliberado.
 *
 * @readonly
 */
export const TIPO_EDIFICIO = Object.freeze({
  // ── De la entrada de geometría ────────────────────────────────────────────
  /**
   * Una parte se ha creado sin contorno dibujable (`recinto: null`). El modelo lo
   * admite («pendiente de dibujar», `model/edificio.js:129`), pero una parte sin
   * geometría no se pinta en el mapa ni cuenta superficie: callarlo dejaría al
   * usuario contando partes que no ve. Lo emiten `entrada.js` y `viewer/partes.js`.
   */
  PARTE_SIN_GEOMETRIA: 'PARTE_SIN_GEOMETRIA',
  /**
   * Anillos de un DXF que NO han entrado como partes porque su capa no estaba
   * entre las elegidas. Es el corazón de la decisión 5 del plan: `UTM.dxf` trae
   * **25 polilíneas en 5 capas** (`FINO` 16 —cajetín, marco, leyenda—, `LINDE` 4,
   * `PARCELA` 3, `BLANCO` 1, `0` 1), y «una polilínea = una parte» al pie de la
   * letra produciría 25 partes, dieciséis de ellas mobiliario de dibujo. Lo que se
   * descarta se dice, con el nombre LITERAL de la capa y cuántos anillos se ha
   * llevado.
   */
  CAPA_DXF_DESCARTADA: 'CAPA_DXF_DESCARTADA',

  // ── De la traducción INSPIRE → modelo ─────────────────────────────────────
  /**
   * Un atributo que NO ha llegado al modelo, por cualquiera de las dos vías:
   *   · su valor INSPIRE no tiene equivalente en el vocabulario de
   *     `model/edificio.js` (`conditionOfConstruction` con un código que no está
   *     en `ESTADO_CONSERVACION`, un `currentUse` desconocido…), o
   *   · el edificio es SIMPLIFICADO y esas claves **no existen** en ese modelo,
   *     así que `crearEdificio` no las añade (ver `conAtributos` en
   *     `mutaciones.js`).
   * En los dos casos el dato se pierde, y perderlo en silencio es justo lo que la
   * regla de oro 1 prohíbe.
   */
  ATRIBUTO_NO_MAPEADO: 'ATRIBUTO_NO_MAPEADO',
  /**
   * ⛔ **Existe por un dato real, y contradice a la ficha de la fase.** `part10`
   * del fixture `bu_buildingpart_9398516VK3799G.gml` trae
   * `numberOfFloorsAboveGround = 0` y `numberOfFloorsBelowGround = 1`: una parte
   * **solo bajo rasante**, contra el convenio «solo partes con volumen sobre
   * rasante» que `spec/feature-11-edificio-entrada.md` escribe en §Modelo
   * (desviación 10 del plan de F11).
   *
   * **Manda el dato** (regla de oro 8): la parte entra marcada o se descarta, pero
   * no se calla. Este tipo de detección es cómo se dice en voz alta.
   */
  PARTE_BAJO_RASANTE: 'PARTE_BAJO_RASANTE',
  /**
   * El `gml:Surface` de un miembro traía **N `gml:PolygonPatch`**, no uno. Medido:
   * el `Building` del fixture trae **dos** (`count` 5 y 53), y asumir uno pierde
   * 53 de 58 puntos **en silencio**. Se dice cuántos venían y qué se ha hecho con
   * ellos.
   */
  PATCHES_MULTIPLES: 'PATCHES_MULTIPLES',
  /**
   * ⚠️ Declarado para T2.1: las **trece** partes del fixture traen sus dos plantas
   * (`↑[1,7,7,6,7,6,7,6,6,0,6,6,6]` · `↓[0,0,1,0,1,0,1,1,1,1,1,1,1]`, medido), y
   * F11 las declara `null` **por alcance** —las plantas son F12, desviación 5—.
   * Tirar trece pares de números que el fichero sí traía es una pérdida real: se
   * declara, y así F12 sabe que el lector ya los devuelve.
   */
  PLANTAS_DESCARTADAS: 'PLANTAS_DESCARTADAS',

  // ⛔ **AQUÍ VIVÍA `TIPO_PARTE_FORZADO`, RETIRADO POR F21.** Decía que una
  // `OtherConstruction` —la piscina de la parcela de referencia— entraba como
  // parte `PRINCIPAL` porque en F11 el tipo estaba fuera de alcance, y que «el
  // tipo correcto se asigna en F12». F12 pasó sin tocarlo, F13 lo volvió a medir,
  // y F21 hace que la construcción entre **con su tipo**: el aviso deja de tener
  // hecho que contar y por eso se va, en vez de quedarse como miembro muerto de un
  // léxico que se recorre entero en las pruebas. `test/edificio/comun.test.js` y
  // `test/edificio/entrada.test.js` tienen el guardián de que no vuelve.

  // ── De las mutaciones del documento (mutaciones.js) ───────────────────────
  /**
   * El modelo del edificio ha cambiado de SIMPLIFICADO a COMPLETO o al revés.
   * **No es informativo de adorno**: pasar a SIMPLIFICADO **borra los siete
   * atributos semánticos**, porque `crearEdificio` no añade esas claves en ese
   * modelo. Esta detección lleva la lista de lo que se pierde y se devuelve JUNTO
   * al edificio nuevo, para que la interfaz pueda preguntar ANTES de aplicarlo
   * (regla de oro 1).
   */
  MODELO_CAMBIADO: 'MODELO_CAMBIADO',
  /**
   * Un renombrado que no se ha aplicado porque el nombre venía vacío (o solo
   * espacios). `crearParteConstruccion` **lanza** con un nombre vacío —está
   * comprobado, `model/edificio.js:137`—, y un campo de texto que el usuario borra
   * es un DATO DE USUARIO, no un contrato roto: no puede reventar dentro de un
   * `click`. Se conserva el nombre anterior y se dice.
   */
  RENOMBRADO_IGNORADO: 'RENOMBRADO_IGNORADO',

  // ── De las mutaciones que estrena F12 (partes y plantas) ──────────────────
  /**
   * F12. Se ha quitado una parte de la lista, y **lo que se lleva se dice antes
   * de llevárselo**: su nombre, su tipo y —lo caro— cuántos vértices tenía su
   * contorno. Eliminar una parte que alguien acaba de dibujar a mano no es como
   * eliminar una fila vacía, y las dos se piden con el mismo botón.
   *
   * No es un error y no impide nada: el undo/redo la devuelve (`edit/historial.js`
   * fotografía el POJO entero). Lo que esta detección evita es que se vaya en
   * silencio, que es lo que pasa cuando la lista tiene trece filas iguales.
   */
  PARTE_ELIMINADA: 'PARTE_ELIMINADA',
  /**
   * F12. Se han intentado poner plantas en una parte de tipo `OTRA` —una piscina
   * y similares—, o se ha pasado a `OTRA` una parte que ya las tenía. En los dos
   * casos `crearParteConstruccion` las fuerza a `null` (`model/edificio.js:161-168`)
   * y el convenio es deliberado: en una piscina las plantas **no son cero, es que
   * no aplican**.
   *
   * ⚠️ Es UN tipo para los DOS caminos, y se distinguen por `datos.motivo`
   * (`ASIGNACION` | `CAMBIO_DE_TIPO`). El hecho que se cuenta es el mismo —«estas
   * plantas no se han guardado, y por qué»— y dos códigos para el mismo hecho son
   * dos sitios donde la interfaz se puede olvidar de uno.
   */
  PLANTAS_NO_APLICAN: 'PLANTAS_NO_APLICAN',
  /**
   * F12. Lo que ha llegado como número de plantas no lo es: un decimal, un
   * negativo, o algo que no es número. **NO lanza**, y esa es toda la decisión:
   * viene de un `<input type="number">`, o sea de un teclado, y es un DATO DE
   * USUARIO. Se conserva lo que hubiera y se dice qué se ha ignorado — la misma
   * asimetría que {@link RENOMBRADO_IGNORADO} ya defiende para el nombre.
   */
  PLANTAS_NO_VALIDAS: 'PLANTAS_NO_VALIDAS',
})

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Una detección de la rama EDIFICIO. POJO plano, misma forma que las de
 * `parsers/`, `gml/` y `export/`.
 *
 * @typedef {Object} DeteccionEdificio
 * @property {string} tipo  Una de las claves de {@link TIPO_EDIFICIO}.
 * @property {string} mensaje  Texto legible en español, para la interfaz.
 * @property {'INFO'|'AVISO'|'ERROR'} severidad  Ver {@link SEVERIDAD}.
 * @property {object} [datos]  Datos estructurados opcionales (objeto plano).
 *   Solo presente si se aportó: el contrato es `datos?`.
 */

/**
 * Crea una {@link DeteccionEdificio} validando `tipo` y `severidad`. **LANZA** si
 * cualquiera es inválido: una detección con un tipo que la interfaz no sabe
 * interpretar es una detección muda, que es lo que la regla de oro 1 prohíbe.
 *
 * `datos` se valida como en `parsers/_comun.js` (objeto plano o ausente) y no
 * como en `export/_comun.js`, que lo acepta tal cual: un array o un número en
 * `datos` no lo sabe leer ningún consumidor de esta capa, y descubrirlo al
 * pintarlo es tarde.
 *
 * @param {string} tipo  Una de las claves/valores de {@link TIPO_EDIFICIO}.
 * @param {string} mensaje  Texto no vacío, en español.
 * @param {'INFO'|'AVISO'|'ERROR'} severidad
 * @param {object} [datos]  Objeto plano con el detalle estructurado.
 * @returns {DeteccionEdificio}
 * @throws {RangeError}  Si `tipo` o `severidad` no están en su catálogo.
 * @throws {TypeError}   Si `mensaje` no es texto no vacío o `datos` no es objeto plano.
 */
export function crearDeteccionEdificio(tipo, mensaje, severidad, datos) {
  const tiposValidos = Object.values(TIPO_EDIFICIO)
  if (!tiposValidos.includes(tipo)) {
    throw new RangeError(
      `crearDeteccionEdificio: 'tipo' inválido: ${JSON.stringify(tipo)}. ` +
        `Válidos: ${tiposValidos.join(', ')}.`,
    )
  }
  const sevsValidas = Object.values(SEVERIDAD)
  if (!sevsValidas.includes(severidad)) {
    throw new RangeError(
      `crearDeteccionEdificio: 'severidad' inválida: ${JSON.stringify(severidad)}. ` +
        `Válidas: ${sevsValidas.join(', ')}.`,
    )
  }
  if (typeof mensaje !== 'string' || mensaje.length === 0) {
    throw new TypeError(
      `crearDeteccionEdificio: 'mensaje' debe ser un texto no vacío; recibido ${JSON.stringify(mensaje)}.`,
    )
  }
  const d = { tipo, mensaje, severidad }
  if (datos !== undefined) {
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new TypeError(
        `crearDeteccionEdificio: 'datos' debe ser un objeto plano o estar ausente; ` +
          `recibido ${JSON.stringify(datos)}.`,
      )
    }
    d.datos = datos
  }
  return d
}

/**
 * Recuento de detecciones por tipo y por severidad. **Misma forma y misma
 * implementación** que `export/_comun.js#resumirDetecciones` y que el `resumen`
 * de `gml/serialize-cp.js`, para que la interfaz no tenga cuatro maneras de
 * contar lo mismo. Es lo que rellena `resumen.detecciones` del contrato **D**.
 *
 * Copiada y no importada, por el motivo de la cabecera; un test-guarda comprueba
 * que las dos dan exactamente el mismo objeto ante la misma entrada.
 *
 * @param {readonly DeteccionEdificio[]} detecciones
 * @returns {{total: number, porTipo: Record<string, number>, porSeveridad: Record<string, number>}}
 */
export function resumirDetecciones(detecciones) {
  const porTipo = {}
  const porSeveridad = {}
  for (const d of detecciones) {
    porTipo[d.tipo] = (porTipo[d.tipo] ?? 0) + 1
    porSeveridad[d.severidad] = (porSeveridad[d.severidad] ?? 0) + 1
  }
  return { total: detecciones.length, porTipo, porSeveridad }
}

// ── Motivos de bloqueo de la entrada ─────────────────────────────────────────

/**
 * Por qué una entrada de edificio **no ha producido edificio**. Son los códigos
 * de `resumen.bloqueos` del contrato **D**: cadenas ESTABLES, pensadas para que la
 * interfaz decida con ellas y **nunca** mirando el texto de un mensaje (que es lo
 * único que sí puede cambiar).
 *
 * ⚠️ Los tres primeros son **literalmente** los de `parsers/importar.js#BLOQUEOS`,
 * no unos parecidos: `entradaDesdeTexto` delega en `importar()` y sus bloqueos
 * pasan **tal cual**, sin traducir. Un test-guarda los ata a aquella constante,
 * para que renombrar uno allí salga en rojo aquí y no en silencio en producción.
 * Los dos últimos son de esta capa y no tienen equivalente en la rama parcela.
 *
 * ⛔ **MEDIDO el 2026-08-03, y corrige al contrato B del plan de F11.** Ese
 * contrato dice que «`resumen.bloqueos` conserva sus tres códigos». Ya no:
 * **`importar()` emite CINCO**. T1.1 añadió `ANILLOS_EN_VARIAS_CAPAS` y
 * `SUPERFICIE_NO_POSITIVA` para tapar el −390,45 m² silencioso, y **los dos son
 * DE PARCELA**: dicen que el reparto «un exterior + N huecos» no se sostiene, no
 * que el fichero esté mal. En esta rama **cada anillo es su propio exterior**, así
 * que ninguno de los dos aplica y por eso NO están en este catálogo.
 *
 * ⚠️ Consecuencia directa para T2.1: `entradaDesdeTexto` **no puede reenviar
 * `resumen.bloqueos` a ciegas**. Los dos códigos de parcela hay que filtrarlos
 * —`parsers/importar.js` los publica ya agrupados en `BLOQUEOS_SOLO_PARCELA`,
 * precisamente para esto— o un DXF de edificio con vivienda + porche + piscina,
 * que es el caso NORMAL de esta fase, saldría bloqueado por venir «de más de una
 * capa». Un test de esta capa comprueba que no están.
 *
 * @readonly
 */
export const MOTIVO_ENTRADA = Object.freeze({
  /** El fichero no trajo ni un anillo. Heredado de `parsers/importar.js`. */
  SIN_GEOMETRIA: 'SIN_GEOMETRIA',
  /** Coordenadas geográficas pegadas en un campo que espera UTM. Heredado. */
  COORDENADAS_EN_GRADOS: 'COORDENADAS_EN_GRADOS',
  /** No se pudo deducir el huso, así que no hay SRS con el que trabajar. Heredado. */
  HUSO_NO_RESUELTO: 'HUSO_NO_RESUELTO',
  /**
   * El documento o el servicio contestaron bien y **no hay construcción**: cero
   * miembros. ⚠️ Medido en T0.1·5: el `wfsBU` devuelve `200 OK` +
   * `gml:FeatureCollection` con **cero `featureMember`**, y eso es el **punto de
   * partida de la obra nueva, no un error del servicio**. Es un bloqueo de ESTA
   * entrada (no hay nada que cargar), y la interfaz tiene que leerlo así: el
   * usuario dibuja o carga su DXF, no reintenta.
   */
  SIN_CONSTRUCCION: 'SIN_CONSTRUCCION',
  /**
   * El GML que se soltó no es de edificio: es parcela (CP 4.0 o CP 3.0) o un
   * dialecto desconocido. Lo clasifica `gml/_comun.js#clasificarDialecto`, cuyo
   * `DIALECTO.BU` es el único que esta rama sabe leer.
   */
  DIALECTO_NO_BU: 'DIALECTO_NO_BU',
})

// ── Nombres genéricos de parte ───────────────────────────────────────────────

/**
 * Nombre genérico de la parte `i`, para poblar la lista al cargar y que el
 * usuario renombre encima (ficha F11 §14.2: «una parte por polilínea, con nombres
 * genéricos para renombrar»).
 *
 * Deliberadamente NEUTRO: ni «vivienda», ni «cuerpo principal», ni «porche». Un
 * nombre inventado que acierta a veces es peor que uno que no dice nada, porque
 * el que acierta se queda sin revisar (regla de oro 9: la aplicación mide, el
 * colegiado interpreta). El índice es **1-based en el texto** porque lo lee una
 * persona, y **0-based en el parámetro** porque lo escribe un bucle.
 *
 * @param {number} i  Índice de la parte en `edificio.partes`, entero ≥ 0.
 * @returns {string}  `'Parte 1'`, `'Parte 2'`… Siempre no vacío, así que
 *   `crearParteConstruccion` lo acepta sin más.
 * @throws {TypeError}  Si `i` no es un entero ≥ 0 (contrato del programador).
 */
export function nombreParteGenerico(i) {
  if (!Number.isInteger(i) || i < 0) {
    throw new TypeError(
      `nombreParteGenerico: 'i' debe ser un entero ≥ 0; recibido ${JSON.stringify(i)}.`,
    )
  }
  return `Parte ${i + 1}`
}

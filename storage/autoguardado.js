// storage/autoguardado.js — F10 · T3.3. EL DEBOUNCE del trabajo en curso.
//
// La pieza más pequeña de la fase y la única que el usuario no verá nunca: se sienta
// entre el store del visor y `storage/expedientes.js#guardarBorrador`, y su trabajo
// entero es **no escribir quince veces mientras alguien arrastra un vértice**.
//
// ── QUÉ HACE, EXACTAMENTE ──────────────────────────────────────────────────
// Recibe avisos de «esto ha cambiado» y, pasados {@link MS_AUTOGUARDADO} sin recibir
// ninguno más, escribe **el último estado** una sola vez. N cambios seguidos son UNA
// escritura, y la que se escribe es la última, no la primera.
//
// ── QUÉ NO HACE, Y ES LA MITAD DEL DISEÑO ──────────────────────────────────
//   · **No sabe qué es un expediente.** Lo recibe y lo pasa. Que dentro haya una
//     parcela, un edificio o un cuadrado le da igual.
//   · **No sabe qué es IndexedDB.** Llama a la función `guardar` que le den. En
//     producción es `expedientes.guardarBorrador`; en el test, un doble que cuenta.
//   · **No lee el reloj del sistema ni programa temporizadores globales por su
//     cuenta**: `ahora`, `programar` y `cancelar` entran por parámetro (ver abajo).
//   · **No avisa por el canal `Avisar`.** Corre solo, cada dos segundos, y un fallo
//     persistente llenaría el panel de tarjetas idénticas que nadie ha pedido. Lo que
//     hace es CONTAR los fallos consecutivos y ofrecérselos a quien le pasó
//     `alFallo`, que es quien sabe decirlo una vez y en el sitio bueno. Es la misma
//     distinción que ya hacen `storage/cache-catastro.js` y `storage/expedientes.js`
//     frente a `storage/pie-firma.js`: **avisa quien ha pedido algo explícitamente**.
//
// ── POR QUÉ LOS TEMPORIZADORES SE INYECTAN ─────────────────────────────────
// Este repositorio tiene **cero** `vi.useFakeTimers`, y no es casualidad: falsear el
// tiempo global rompe `fake-indexeddb`, que lo usa para sus propias transacciones —y
// las pruebas de esta misma carpeta viven de él—. El precedente de la casa es la
// inyección (`ahora` en `cache-catastro.js`, `pie-firma.js` y `expedientes.js`), así
// que aquí se inyectan también `programar` y `cancelar`. La consecuencia buena es que
// el test **no espera de verdad**: dispara el temporizador a mano y comprueba lo que
// pasa, en microsegundos y sin intermitencias.
//
// ── POR QUÉ `ms` NO ES UNA CLAVE DE `config/operativos.json` ───────────────
// Porque aquel fichero es de **tolerancias geométricas** —lo dice su propio `_nota`:
// «distancias/áreas en unidades SI, ángulos en grados»— y su test exige el juego de
// claves EXACTO («no hay claves de más ni de menos»). Meter aquí un número de
// milisegundos obligaría a tocar ese test para colar un dato que no es del mismo
// género. El precedente correcto es `MS_TTL` en `storage/cache-catastro.js:225`: la
// misma clase de número, en la misma capa, viviendo como constante de su módulo.
//
// ── DOS SUTILEZAS QUE NO SE VEN Y QUE SÍ MUERDEN ───────────────────────────
//
// **1 · Dos escrituras solapadas pueden dejar el estado VIEJO en la base.** Si el
// temporizador vuelve a saltar mientras el `put` anterior sigue en vuelo, salen dos
// escrituras a la MISMA clave y gana la que resuelva la última — que no tiene por qué
// ser la más nueva. El resultado sería un borrador que retrocede en el tiempo, y en un
// autoguardado eso no lo notaría nadie hasta el día que hiciera falta. Aquí no puede
// pasar: mientras hay una escritura en vuelo no se lanza otra, y si llega un cambio
// entretanto se vuelve a programar **cuando la anterior termina**.
//
// **2 · Un fallo no puede parar el autoguardado.** Se cuenta y se sigue. Un `catch`
// que se comiera el error y dejara de reprogramar convertiría un problema temporal
// —la base bloqueada un instante, la pestaña sin foco— en un «esto ya no guarda» que
// nadie ha decidido. Por eso `guardar` se llama dentro de un `try`: si LANZA en vez de
// devolver un resultado —lo hace `guardarBorrador` con un expediente que el modelo
// rechaza— se cuenta como fallo y se sigue. Un `throw` dentro del callback de un
// temporizador no lo caza nadie: se convertiría en un rechazo no gestionado y el
// autoguardado moriría en silencio, que es justo lo que la regla de oro 1 prohíbe.

// ── La cadencia ──────────────────────────────────────────────────────────────

/**
 * Cuánto se espera desde el último cambio antes de escribir: **2 segundos**.
 *
 * La ficha de la fase pide «debounce 1–3 s» y se toma el centro del rango. No es una
 * cifra medida y no se puede citar como si lo fuera; lo que sí está medido (fase 0 de
 * F10) es que **escribir cuesta 0,35 ms** —200 expedientes en 70 ms—, así que el
 * coste de la escritura no entra en la decisión: dos segundos no son un compromiso
 * con el rendimiento, son cuánto se tarda en soltar el ratón entre dos arrastres.
 *
 * @readonly
 */
export const MS_AUTOGUARDADO = 2000

/**
 * Los límites que la ficha declara. Se exportan para que el test los afirme sobre
 * {@link MS_AUTOGUARDADO} en vez de repetir los números, y para que quien cambie la
 * cadencia se choque con el rango en vez de descubrirlo leyendo la ficha.
 *
 * @readonly
 */
export const MS_AUTOGUARDADO_MIN = 1000
/** @readonly */
export const MS_AUTOGUARDADO_MAX = 3000

// ── Typedefs ─────────────────────────────────────────────────────────────────

/**
 * Contadores de una instancia. Fotografía nueva en cada llamada a `estado()`; no se
 * reinician nunca, porque un contador que se borra miente sobre lo que pasó (misma
 * disciplina que `services/_red.js` y `storage/cache-catastro.js`).
 *
 * @typedef {Object} EstadoAutoguardado
 * @property {boolean} pendiente  Hay un cambio esperando a que salte el temporizador.
 * @property {boolean} enVuelo    Hay una escritura en curso ahora mismo.
 * @property {number} cambios     Avisos de cambio recibidos.
 * @property {number} escrituras  Veces que se ha llamado a `guardar`. **La diferencia
 *   con `cambios` es exactamente lo que el debounce ha ahorrado.**
 * @property {number} guardados   Escrituras que salieron bien.
 * @property {number} fallos      Escrituras que salieron mal, en total.
 * @property {number} consecutivos  Fallos seguidos SIN un acierto en medio. Es la
 *   cifra con la que el cableado decide avisar una vez en vez de en cada intento.
 * @property {number|null} ultimoGuardadoEn  Marca de `ahora` del último acierto.
 * @property {*} ultimoError  La causa del último fallo, tal cual. `null` si no hubo.
 */

// ── La fábrica ───────────────────────────────────────────────────────────────

/**
 * Crea el autoguardado.
 *
 * ```js
 * const auto = crearAutoguardado({ guardar: (e) => expedientes.guardarBorrador(e) })
 * store.suscribir(() => auto.cambiado(expedienteDelStore()))
 * // …y al cerrar la pestaña, o al recuperar otro expediente:
 * await auto.ahoraMismo()
 * ```
 *
 * Es una factory (`crearX`), nunca una clase: todo el estado vive en el cierre, así
 * que dos instancias no comparten nada y cada prueba monta la suya.
 *
 * @param {object} opciones
 * @param {(estado: *) => (Promise<*>|*)} opciones.guardar  Qué hacer cuando toca
 *   escribir. En producción, `expedientes.guardarBorrador`. **Obligatorio**: un
 *   autoguardado sin destino es un temporizador caro.
 * @param {number} [opciones.ms=MS_AUTOGUARDADO]  Espera desde el último cambio.
 * @param {(fn: Function, ms: number) => *} [opciones.programar]  Por defecto,
 *   `setTimeout`. Inyectable: ver la cabecera.
 * @param {(id: *) => void} [opciones.cancelar]  Por defecto, `clearTimeout`.
 * @param {() => number} [opciones.ahora]  Reloj en milisegundos de época. Solo se usa
 *   para sellar `ultimoGuardadoEn`; la cadencia la lleva el temporizador.
 * @param {((info: {consecutivos: number, resultado: *, causa: *}) => void)|null} [opciones.alFallo=null]
 *   Se llama en CADA fallo, con cuántos van seguidos. Quien decide si eso se enseña —y
 *   cuántas veces— es el cableado, no este módulo.
 * @param {((info: {resultado: *}) => void)|null} [opciones.alGuardado=null]  Se llama
 *   en cada acierto. Sirve para el renglón «guardado hace un momento».
 * @returns {{cambiado: (estado: *) => void, ahoraMismo: () => Promise<*|null>, olvidar: () => void, destruir: () => void, estado: () => EstadoAutoguardado}}
 * @throws {TypeError}   Contrato roto por el programador.
 * @throws {RangeError}  Si `ms` no es un número finito y positivo.
 */
export function crearAutoguardado(opciones = {}) {
  if (!opciones || typeof opciones !== 'object' || Array.isArray(opciones)) {
    throw new TypeError(
      `crearAutoguardado: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`,
    )
  }
  const {
    guardar,
    ms = MS_AUTOGUARDADO,
    programar = (fn, espera) => setTimeout(fn, espera),
    cancelar = (id) => clearTimeout(id),
    ahora = () => Date.now(),
    alFallo = null,
    alGuardado = null,
  } = opciones

  if (typeof guardar !== 'function') {
    throw new TypeError(
      `crearAutoguardado: 'guardar' es obligatorio y debe ser una función; recibido ${typeof guardar}. ` +
        'Un autoguardado sin destino es un temporizador caro que no guarda nada.',
    )
  }
  for (const [clave, valor] of [
    ['programar', programar],
    ['cancelar', cancelar],
    ['ahora', ahora],
  ]) {
    if (typeof valor !== 'function') {
      throw new TypeError(
        `crearAutoguardado: '${clave}' debe ser una función; recibido ${typeof valor}.`,
      )
    }
  }
  for (const [clave, valor] of [
    ['alFallo', alFallo],
    ['alGuardado', alGuardado],
  ]) {
    if (valor !== null && typeof valor !== 'function') {
      throw new TypeError(
        `crearAutoguardado: '${clave}' debe ser una función o null; recibido ${typeof valor}.`,
      )
    }
  }
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
    throw new RangeError(
      `crearAutoguardado: 'ms' debe ser un número finito y positivo de milisegundos; ` +
        `recibido ${JSON.stringify(ms)}.`,
    )
  }

  /** @type {EstadoAutoguardado} */
  const cuenta = {
    pendiente: false,
    enVuelo: false,
    cambios: 0,
    escrituras: 0,
    guardados: 0,
    fallos: 0,
    consecutivos: 0,
    ultimoGuardadoEn: null,
    ultimoError: null,
  }

  /**
   * El ÚLTIMO estado avisado, que es el único que se escribirá. **Aquí está toda la
   * coalescencia**: no hay cola. Guardar los N estados intermedios y escribirlos en
   * orden no serviría de nada —el borrador es un registro único que se pisa— y
   * multiplicaría por N el trabajo que este módulo existe para evitar.
   *
   * @type {*}
   */
  let ultimo = null

  /** Identificador del temporizador vivo, o `null`. */
  let temporizador = null

  /** Si hay algo escribiéndose, su promesa. Impide dos escrituras solapadas. */
  let enVuelo = null

  /** Si `destruir()` ya corrió, nada vuelve a programarse. */
  let destruido = false

  function detener() {
    if (temporizador !== null) {
      cancelar(temporizador)
      temporizador = null
    }
  }

  function programarEscritura() {
    if (destruido || temporizador !== null) return
    temporizador = programar(() => {
      temporizador = null
      // Sin `await`: el callback de un temporizador no espera a nadie. La promesa se
      // guarda en `enVuelo` y sus fallos se cazan dentro de `escribir`.
      void escribir()
    }, ms)
  }

  /**
   * Escribe el último estado. **No se solapa con otra escritura** (sutileza 1 de la
   * cabecera) y **no se cae por un fallo** (sutileza 2).
   *
   * @returns {Promise<*|null>}  Lo que devolviera `guardar`, o `null` si no había nada
   *   que escribir o si `guardar` lanzó.
   */
  async function escribir() {
    if (enVuelo !== null) {
      // Ya hay una en curso. En cuanto termine reprogramará, porque `pendiente` sigue
      // en `true`; no se encola nada aquí.
      return enVuelo
    }
    if (!cuenta.pendiente) return null

    const estadoAEscribir = ultimo
    cuenta.pendiente = false
    cuenta.escrituras += 1
    cuenta.enVuelo = true

    const promesa = (async () => {
      try {
        const resultado = await guardar(estadoAEscribir)
        // Un resultado con `ok: false` es un fallo del ENTORNO que el almacén ya ha
        // devuelto bien formado; un resultado sin `ok` (o `undefined`) se toma por
        // bueno, para que un doble sencillo del test no tenga que fingir la forma.
        if (resultado && resultado.ok === false) {
          cuenta.fallos += 1
          cuenta.consecutivos += 1
          cuenta.ultimoError = resultado
          if (alFallo !== null) alFallo({ consecutivos: cuenta.consecutivos, resultado, causa: null })
        } else {
          cuenta.guardados += 1
          cuenta.consecutivos = 0
          cuenta.ultimoError = null
          cuenta.ultimoGuardadoEn = ahora()
          if (alGuardado !== null) alGuardado({ resultado })
        }
        return resultado
      } catch (causa) {
        // `guardar` ha LANZADO. Ver la sutileza 2: aquí no hay nadie más que pueda
        // cazarlo, y dejarlo salir mataría el autoguardado sin una sola señal.
        cuenta.fallos += 1
        cuenta.consecutivos += 1
        cuenta.ultimoError = causa
        if (alFallo !== null) alFallo({ consecutivos: cuenta.consecutivos, resultado: null, causa })
        return null
      } finally {
        enVuelo = null
        cuenta.enVuelo = false
        // Si mientras se escribía llegó otro cambio, ahora es cuando se programa.
        if (cuenta.pendiente) programarEscritura()
      }
    })()

    enVuelo = promesa
    return promesa
  }

  return {
    /**
     * «Esto ha cambiado.» Reinicia la espera: solo se escribe cuando pasen `ms` sin
     * un solo aviso más.
     *
     * @param {*} estado  Lo que habría que guardar SI el temporizador saltara ahora.
     *   Se queda con el último y tira los anteriores (ver `ultimo`).
     */
    cambiado(estado) {
      if (destruido) return
      cuenta.cambios += 1
      cuenta.pendiente = true
      ultimo = estado
      // Reiniciar la espera es LO QUE HACE que sea un debounce y no un intervalo: sin
      // esto, quince cambios en dos segundos escribirían al segundo dos igualmente,
      // en mitad del arrastre.
      detener()
      // Con una escritura en vuelo no se programa: lo hará su `finally`. Si no,
      // saldrían dos `put` a la misma clave y ganaría la que resolviera la última.
      if (enVuelo === null) programarEscritura()
    },

    /**
     * Escribe YA lo que hubiera pendiente, sin esperar al temporizador. Para el cierre
     * de la pestaña, para «Guardar» explícito y para antes de recuperar otro
     * expediente — si no, el borrador del anterior se escribiría encima del nuevo dos
     * segundos después.
     *
     * @returns {Promise<*|null>}  `null` si no había nada pendiente.
     */
    async ahoraMismo() {
      detener()
      if (enVuelo !== null) {
        // Esperar a la que está en vuelo y, si entretanto quedó algo pendiente,
        // escribirlo también: quien llama a esto quiere el estado ACTUAL en la base.
        await enVuelo
      }
      if (!cuenta.pendiente) return null
      return escribir()
    },

    /**
     * Olvida lo pendiente sin escribirlo. Es lo que hace «Descartar»: el borrador se
     * tira y programar su escritura lo resucitaría dos segundos después.
     */
    olvidar() {
      detener()
      cuenta.pendiente = false
      ultimo = null
    },

    /**
     * Apaga el autoguardado para siempre. **No escribe lo pendiente**: si hay que
     * guardarlo, se llama antes a `ahoraMismo()`. Hacerlo aquí sería una escritura
     * escondida dentro de un desmontaje, y este repo desmonta en orden inverso
     * precisamente para que eso no pase.
     */
    destruir() {
      destruido = true
      detener()
      cuenta.pendiente = false
      ultimo = null
    },

    /** Fotografía de los contadores. Objeto nuevo en cada llamada. */
    estado() {
      return { ...cuenta }
    },
  }
}

export default crearAutoguardado

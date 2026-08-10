// app/colindantes.js — F23 · tarea 2.1 · DÓNDE VIVEN LAS PARCELAS VECINAS.
//
// Un registro pequeño: guarda las colindantes que haya traído el Catastro, las
// traduce UNA vez, y avisa a quien las esté esperando.
//
// ── POR QUÉ EXISTE, Y POR QUÉ NO ES LO QUE LA SPEC DE F17 PREVEÍA ───────────
// La ficha de F17 apartó el colindante recortado a una «fase 2» y la describió
// como cara, con este motivo: «necesita sacar `vecinas` de la clausura de
// `app/cableado-diagnostico.js` al modelo». **Medido el 2026-08-10, eso no hacía
// falta.** Las vecinas no están secuestradas en ninguna clausura: su FUENTE es
// `app/cableado-catastro.js#alColindantes`, que es una suscripción pública con
// `Set` de oyentes y baja, y de la que ya cuelgan TRES consumidores (el diagnóstico
// de F07, el informe de F09 y el snap de la edición). `cableado-diagnostico.js` no
// es el dueño del dato: es un suscriptor más que se guarda una copia.
//
// Así que lo que faltaba no era un traslado, era **un sitio donde la copia esté una
// sola vez**. Antes de este módulo la traducción del resultado del Catastro a
// `{refcat, label, recintos}` estaba escrita DOS veces —`cableado-diagnostico.js` y
// `cableado-informe.js`, con una discrepancia real: una recortaba el `refcat` antes
// de decidir si estaba vacío y la otra no—. Aquí está una vez, y las dos la usan.
//
// ── ⛔ `null` Y `[]` NO SIGNIFICAN LO MISMO, Y ES LA MITAD DEL MÓDULO ───────
//
//     null → NO SE HA CONSULTADO.  No se sabe si hay colindantes.
//     []   → SE HA CONSULTADO y no hay ninguna. La parcela está aislada:
//            rodeada de viales, de dominio público o de suelo sin parcelar.
//
// Son afirmaciones opuestas **y la segunda tranquiliza**, que es exactamente el
// patrón de error que este proyecto persigue. En F07 la distinción se sostiene con
// `invasion.consultado`; aquí con el propio valor. Quien lo colapse a `[]` hará que
// `derivacion/vecino.js` declare sobre un vial un exceso que en realidad cae sobre
// la finca de un vecino, y eso es un expediente incompleto emitido con confianza.
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
// **No pide nada.** No conoce la red y no llama a `catastro.colindantes()`: se
// suscribe y espera. Pedir es una decisión de política —el override O8 del Catastro
// habla de denegación de servicio por uso abusivo, y la regla vigente es «una
// apertura, una petición»—, y esa decisión es de quien tiene una pantalla delante,
// no de un registro. Si nadie ha pedido, `get()` devuelve `null` y quien pregunte
// tiene que decirlo, no rellenarlo.
//
// Módulo sin DOM, sin Leaflet, sin red y sin reloj: solo estado y traducción.

/** @typedef {{vertices: Array<[number,number]>, tipo: string}} Recinto */

/**
 * Una parcela vecina, como la ven los consumidores.
 *
 * @typedef {Object} Vecina
 * @property {string|null} refcat  Su referencia catastral, o `null` si no consta.
 *   **Nunca cadena vacía**: quien la presente escribe «parcela sin referencia».
 * @property {string|null} label  El `cp:label` del parcelario — lo único que dice
 *   de un colindante sin gastar otra petición, y lo que permite escribir «linda con
 *   la parcela rotulada “16”» cuando no hay referencia catastral.
 * @property {Recinto[]} recintos  Su geometría. **Puede venir `[]`**, y se deja
 *   pasar a propósito: descartarla aquí la haría desaparecer sin dejar rastro, y
 *   quien la consuma la anota en sus `saltados` con el motivo.
 */

/**
 * Traduce las parcelas de un resultado del Catastro a {@link Vecina}.
 *
 * Es la ÚNICA traducción del proyecto, y estaba escrita dos veces antes de existir
 * este módulo. Se queda con el superconjunto de las dos: `label` lo usa el informe
 * de F09 y lo ignoran el diagnóstico y la derivación, que es más barato que tener
 * dos formas.
 *
 * ⚠️ No filtra la parcela propia. Ya lo hace `services/catastro.js` por referencia
 * catastral normalizada (override O15: `GetNeighbourParcel` se incluye a sí misma,
 * y devuelve 5 miembros para 4 colindantes — remedido el 2026-08-10 sobre
 * `29050A01000144`).
 *
 * @param {Array<object>} parcelas
 * @returns {Vecina[]}  Vacío si no es un array: no se inventa nada.
 */
export function traducirColindantes(parcelas) {
  if (!Array.isArray(parcelas)) return []
  return parcelas.map((p) => ({
    refcat: typeof p.refcat === 'string' && p.refcat.trim() !== '' ? p.refcat : null,
    label: typeof p.label === 'string' && p.label.trim() !== '' ? p.label : null,
    recintos: Array.isArray(p.recintos) ? p.recintos : [],
  }))
}

/**
 * El registro de colindantes: quién las tiene y quién se entera cuando llegan.
 *
 * ```js
 * const registro = crearRegistroColindantes({ catastro })
 * registro.get()                      // null mientras nadie las haya traído
 * const baja = registro.subscribe((v) => …)
 * registro.olvidar()                  // ha entrado otra parcela
 * registro.destruir()
 * ```
 *
 * @param {object} [opciones]
 * @param {object|null} [opciones.catastro=null]  El cableado de F05. Si trae
 *   `alColindantes(fn)`, el registro se suscribe solo y se puebla cuando cualquier
 *   otra parte de la aplicación traiga vecinas — **sin gastar una petición propia**.
 *   `null` deja el registro en modo manual (`adoptar` a mano), que es lo que usan
 *   los tests.
 * @returns {{get: () => (Vecina[]|null), consultado: () => boolean,
 *   subscribe: (fn: (vecinas: Vecina[]) => void) => (() => void),
 *   adoptar: (resultado: object) => void, olvidar: () => void,
 *   destruir: () => void}}
 * @throws {TypeError} Si `catastro` no es `null` y no publica `alColindantes`.
 */
export function crearRegistroColindantes({ catastro = null } = {}) {
  if (catastro !== null && typeof catastro.alColindantes !== 'function') {
    throw new TypeError(
      `crearRegistroColindantes: 'catastro' debe ser el cableado de F05 (el que publica ` +
        `alColindantes(fn)), o null para llevarlo a mano; recibido ${typeof catastro}. Sin esa ` +
        `suscripción el registro se quedaría en null para siempre y quien lo consulte creería ` +
        `que la parcela no tiene colindantes.`,
    )
  }

  let vivo = true
  /** @type {Vecina[]|null} `null` = NO SE HA CONSULTADO. Ver la cabecera. */
  let vecinas = null
  /** @type {Set<(vecinas: Vecina[]) => void>} */
  const oyentes = new Set()

  /** Avisa a los suscriptores. Un oyente roto no puede tumbar a los demás. */
  function emitir() {
    for (const fn of oyentes) {
      try {
        fn(vecinas)
      } catch (causa) {
        // Mismo criterio que `crearEstadoVista` y que `alColindantes`: se aísla,
        // pero NO se traga (regla de oro 1). Aquí no hay canal de avisos —este
        // módulo no conoce ninguno—, así que va a la consola, que es el único sitio
        // que le queda; quien quiera contarlo mejor lo hace en su propio oyente.
        console.error('app/colindantes.js: un oyente del registro ha fallado', causa)
      }
    }
  }

  /**
   * Adopta las colindantes de un resultado del Catastro.
   *
   * ⛔ Un resultado que NO trae `datos.colindantes` no se adopta y **no borra lo que
   * ya había**: `alColindantes` solo publica resultados buenos, pero llamar a esto
   * a mano con cualquier cosa no puede convertir «tengo cuatro vecinas» en «no se
   * han consultado». Para olvidarlas está {@link olvidar}, que es explícito.
   */
  function adoptar(resultado) {
    if (!vivo) return
    const lista = resultado?.datos?.colindantes
    if (!Array.isArray(lista)) return
    vecinas = traducirColindantes(lista)
    emitir()
  }

  // La suscripción al canal público de F05. **Cuesta CERO peticiones**: `Set` de
  // oyentes, así que este registro se puebla con las vecinas que traiga cualquier
  // otra parte de la aplicación —abrir el diagnóstico, o «Traer colindantes»— sin
  // pedir nada por su cuenta. Ver la cabecera: pedir es política, y no es suya.
  const bajaCatastro = catastro === null ? () => {} : catastro.alColindantes(adoptar)

  return {
    /** Las vecinas, o `null` si NO se han consultado. Ver la cabecera. */
    get: () => vecinas,

    /** `true` si alguna vez se han traído, aunque fueran cero. */
    consultado: () => vecinas !== null,

    subscribe(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(
          `crearRegistroColindantes.subscribe: 'fn' debe ser una función; recibido ${typeof fn}.`,
        )
      }
      oyentes.add(fn)
      return () => oyentes.delete(fn)
    },

    adoptar,

    /**
     * Ha entrado OTRA parcela: las vecinas de la anterior ya no son vecinas de
     * nada. Vuelve a `null` —no a `[]`— porque lo cierto es que no se han
     * consultado las de ésta, no que no tenga.
     */
    olvidar() {
      if (!vivo || vecinas === null) return
      vecinas = null
      emitir()
    },

    destruir() {
      if (!vivo) return
      vivo = false
      bajaCatastro()
      oyentes.clear()
    },
  }
}

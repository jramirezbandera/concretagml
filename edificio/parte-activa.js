// edificio/parte-activa.js — F12 · T3.1. EL STORE ADAPTADOR DE LA PARTE ACTIVA.
//
// La ficha pide que la geometría de la parte activa se edite «como la parcela»:
// arrastrar, insertar, eliminar, offset y snap. Todo eso ya existe y está medido
// —`viewer/edicion.js`, 1.500 líneas de F06—, pero está atado al store de PARCELA:
// lee `estado.get().recintos` y escribe con `estado.set({...parcela, recintos})`.
//
// Este módulo es el adaptador que hace que ese motor sirva sin tocarlo: **una
// fachada `{get, set, subscribe}` que por delante parece una parcela y por detrás
// es una parte de un edificio**. `crearEdicion` no se entera de nada.
//
//   const vista = crearVistaParteActiva(storeEdificio)
//   vista.seleccionar(2)                     // la parte 3 de la lista
//   const edicion = crearEdicion({ mapa, estado: vista, zona })
//
// Es la alternativa a las otras dos que se descartaron, y las dos razones están
// escritas: duplicar `viewer/edicion.js` daría un segundo sitio donde arreglar
// cada defecto de arrastre, y generalizarlo con un proyector obligaría a tocar el
// fichero más caliente de F06 con la rama de parcela en producción colgando de él.
//
// ═════════════════════════════════════════════════════════════════════════════
// LO QUE HAY QUE CLAVAR, Y POR QUÉ (esto es todo el diseño)
// ═════════════════════════════════════════════════════════════════════════════
//
// ── 1 · `get()` DEVUELVE EL MISMO OBJETO MIENTRAS NO CAMBIE NADA ────────────
// ⛔ **Sin esto el arrastre se arrastra a sí mismo.** `viewer/edicion.js` cachea
// el catálogo de dianas del snap y lo invalida comparando la IDENTIDAD del POJO
// (`estado.get() !== cache.parcela`, y está escrito en su cabecera). `ajustar` se
// llama en CADA FOTOGRAMA del arrastre: si `get()` fabricara una proyección nueva
// cada vez, la caché caería en todos los fotogramas y el catálogo —que recorre el
// parcelario oficial y las colindantes— se reconstruiría sesenta veces por
// segundo. Por eso la proyección se memoriza y solo se rehace cuando de verdad
// cambia el edificio o la parte elegida.
//
// ── 2 · EL POJO DEL STORE NO SE MUTA JAMÁS ──────────────────────────────────
// `set()` no parchea el edificio: llama a `conParteRedibujada`, que reconstruye
// con `crearEdificio`. Es lo mismo que hacen las otras ocho mutaciones y es lo que
// sostiene el undo/redo (regla de oro 4). Un adaptador que escribiera en sitio
// dejaría el historial guardando N veces el mismo objeto.
//
// ── 3 · SIN PARTE ELEGIDA, `get()` ES `null` ────────────────────────────────
// Y no un objeto vacío. `crearEdicion` ya sabe tratar un estado nulo —sus
// operaciones salen por «no hay geometría»— y `null` es la única respuesta que no
// miente: no es que la parte no tenga vértices, es que no hay parte.
// Lo mismo con una parte **pendiente de dibujar** (`recinto: null`): ahí sí hay
// parte, pero no hay contorno, y se proyecta `recintos: []`.
//
// ── 4 · LA SELECCIÓN SIGUE A LA PARTE, NO AL ÍNDICE ─────────────────────────
// ⛔ **Auditoría 2026-08-16 · hallazgo H2, MEDIA.** Hasta esa fecha la parte
// elegida era un ÍNDICE y nada más, y eso aguanta mientras la lista no se mueva.
// Se mueve: `conParteEliminada` quita un elemento y **corre hacia arriba todo lo
// que venía detrás**. Con partes A, B, C y «B» elegida (índice 1), eliminar «A»
// deja el índice 1 apuntando a **C**. El índice sigue siendo VÁLIDO —por eso el
// guard de `app/cableado-edificio.js`, que solo miraba `activa >= partes.length`,
// no lo veía— y `get()` pasa a proyectar otra parte: un `set()` posterior (el
// drop de un arrastre que estaba en vuelo) escribe la geometría de B **en C**.
// Medido: `C:999,0`. Sin un solo error por ninguna parte, que es la regla de oro
// 1 rota en el sitio más caro: la huella que después se serializa y se firma.
//
// Se corrige aquí y no en el cableado porque **aquí está el punto de escritura**:
// el cableado tiene su propio `activa` para pintar, pero quien mete vértices en
// una parte es esta fachada. Un arreglo que solo corrigiera el índice del panel
// dejaría el store adaptador escribiendo donde no era.
//
// ── Qué se usa como identidad, y por qué el NOMBRE ──
// El modelo NO da identificador de parte: `crearEdificio` reconstruye cada parte
// con `crearParteConstruccion`, así que **la identidad del objeto no sobrevive a
// ninguna mutación** y no sirve para nada. Lo único que identifica una parte para
// una persona —y lo que este proyecto YA usa como tal— es su `nombre`: es lo que
// `parteDeEdificio` publica y lo que `app/cableado-edificio.js#aplicarDelHistorial`
// compara para no aplicar la instantánea de una parte sobre otra. Duplicar ese
// criterio habría sido inventar un segundo.
//
// ── Y por qué solo se reconcilia cuando la lista ha ENCOGIDO ──
// Porque es la única forma de distinguir «se han llevado una parte de delante»
// de «han renombrado la que tengo elegida», que por nombre son indistinguibles.
// En el modelo solo hay una operación que quite partes (`conParteEliminada`) y
// una que las añada, y esa las pone AL FINAL: mientras la lista no encoja, el
// índice sigue apuntando a la misma parte y lo único que puede haber cambiado es
// su nombre — que se re-anota y ya está. Reconciliar por nombre sin esa guarda
// habría sido una cura peor que la enfermedad: renombrar la parte que estás
// editando la habría soltado.
//
// Si la lista ha encogido y la parte elegida ya no está en ninguna posición, es
// que era la eliminada: se DESELECCIONA. Heredar en silencio la parte que ocupa
// su hueco es exactamente el defecto de arriba.
//
// ⚠️ Lo que esta reconciliación **no** cubre es que entre otro DOCUMENTO con
// tantas partes o más: ahí no hay corrimiento que detectar y el nombre puede
// coincidir por casualidad. Ese es el hallazgo H3 y lo cierra
// `app/cableado-edificio.js`, que es quien sabe qué documento hay abierto.
//
// ── 5 · LOS SUSCRIPTORES DE ARRIBA SIGUEN VIVOS ─────────────────────────────
// Esta fachada **se suscribe al store del edificio** y reemite hacia los suyos. Lo
// que NO hace es sustituirlo: el panel, el mapa y el autoguardado siguen colgando
// del store de verdad. Un adaptador que se quedara los suscriptores sería un
// segundo dueño del estado, que es lo que el rework de UI existió para quitar.
//
// Módulo PURO: sin DOM, sin Leaflet, sin reloj. Proyecto Vitest `node`.

import { conParteRedibujada } from './mutaciones.js'

/**
 * @typedef {Object} VistaParteActiva
 * @property {() => (object|null)} get  La parte elegida con forma de parcela
 *   (`{recintos, idLocal, origen}`), o `null` si no hay ninguna elegida.
 * @property {(documento: object|null) => void} set  Escribe los `recintos` de
 *   vuelta en la parte, reconstruyendo el `Edificio`.
 * @property {(fn: Function) => (() => void)} subscribe  Igual que el store real.
 * @property {(i: number|null) => void} seleccionar  Elige la parte activa.
 * @property {() => (number|null)} seleccionada  Qué parte está elegida.
 * @property {() => void} destruir  Se da de baja del store del edificio.
 */

/**
 * Crea la vista editable de la parte activa de un edificio.
 *
 * @param {object} estadoEdificio  El SEGUNDO store (`crearEstadoVista`), cuyo
 *   documento es un `Edificio`. No se reemplaza ni se envuelve: se usa.
 * @param {object} [opciones]
 * @param {(detecciones: Array<object>) => void} [opciones.alDetectar]  Se le
 *   entregan las detecciones de `conParteRedibujada` cuando escribir produce
 *   alguna. **Se DEVUELVEN, no se aplican**: esta capa no decide si se avisa.
 * @returns {VistaParteActiva}
 * @throws {TypeError} Si `estadoEdificio` no sirve como store.
 */
export function crearVistaParteActiva(estadoEdificio, { alDetectar } = {}) {
  if (
    !estadoEdificio ||
    typeof estadoEdificio.get !== 'function' ||
    typeof estadoEdificio.set !== 'function' ||
    typeof estadoEdificio.subscribe !== 'function'
  ) {
    throw new TypeError(
      `crearVistaParteActiva: 'estadoEdificio' debe ser el store de crearEstadoVista ` +
        `({get,set,subscribe}); recibido ${JSON.stringify(estadoEdificio)}.`,
    )
  }
  if (alDetectar !== undefined && typeof alDetectar !== 'function') {
    throw new TypeError(
      `crearVistaParteActiva: 'alDetectar' debe ser una función o nada; ` +
        `recibido ${typeof alDetectar}.`,
    )
  }

  /** Índice de la parte elegida, o `null`. */
  let indice = null
  /**
   * El NOMBRE de la parte elegida la última vez que se comprobó, o `null`. Es la
   * identidad de trabajo de la decisión 4 de la cabecera: el modelo no da otra.
   */
  let nombreElegido = null
  /**
   * Cuántas partes tenía el edificio la última vez que se comprobó. Es lo que
   * distingue «se han llevado una parte» de «han renombrado la mía»; ver la
   * decisión 4.
   */
  let cuantasHabia = 0
  /** Suscriptores de ESTA fachada (el mapa y la tabla de la parte activa). */
  const suscriptores = new Set()

  // ── La memoria de la proyección (decisión 1 de la cabecera) ───────────────
  // Se guarda de qué edificio y de qué parte salió la última proyección. Mientras
  // las dos sigan siendo las MISMAS por identidad, se devuelve el mismo objeto.
  let cacheEdificio = null
  let cacheIndice = null
  let cacheParte = null
  let cacheProyeccion = null

  /** Las partes del edificio que hay ahora en el store, o `[]`. */
  function partesDeAhora() {
    const partes = estadoEdificio.get()?.partes
    return Array.isArray(partes) ? partes : []
  }

  /**
   * ⭐ Vuelve a poner el índice sobre la parte que se eligió, si la lista se ha
   * movido debajo. **Es el arreglo del hallazgo H2** y su porqué entero está en
   * la decisión 4 de la cabecera; aquí solo va la mecánica.
   *
   * Se llama en TODOS los sitios que leen o escriben la selección, no solo desde
   * el suscriptor del store: el `set` del store de arriba **no notifica si ocurre
   * dentro de otra notificación** (guarda anti-reentrada de `crearEstadoVista`),
   * así que fiarlo todo al aviso dejaría una ventana en la que el índice está
   * viejo. Reconciliar es comparar dos números en el caso normal.
   *
   * @returns {void}
   */
  function reconciliar() {
    if (indice === null) return
    const partes = partesDeAhora()

    // La lista NO ha encogido ⇒ nadie ha corrido hacia arriba: el índice sigue
    // apuntando a la misma parte y lo único que puede haber cambiado es su
    // nombre (renombrarla, o rehacer su contorno). Se re-anota y se sale.
    if (partes.length >= cuantasHabia) {
      cuantasHabia = partes.length
      nombreElegido = partes[indice]?.nombre ?? nombreElegido
      return
    }

    cuantasHabia = partes.length
    const donde = partes.findIndex((p) => p?.nombre === nombreElegido)
    if (donde !== -1) {
      // Se la han movido: se la sigue. La caché cae sola, porque mira el índice.
      indice = donde
      return
    }
    // No está en ninguna posición ⇒ la elegida ERA la que se han llevado. Se
    // deselecciona: heredar la parte que ocupa su hueco es el defecto entero.
    indice = null
    nombreElegido = null
  }

  /**
   * La parte `i` con forma de parcela. Es lo único que `viewer/edicion.js` mira:
   * `recintos`, y de ahí para abajo. Se añaden `idLocal` y `origen` porque
   * `sincronizacion.js` y las acotaciones los leen para rotular, y porque un
   * documento sin identidad ninguna es más raro de depurar que uno con ella.
   */
  function proyectar() {
    reconciliar()
    const edificio = estadoEdificio.get()
    if (edificio === null || indice === null) return null
    const parte = edificio.partes?.[indice]
    if (parte === undefined) return null

    // La caché mira las TRES cosas de las que depende la proyección: el edificio,
    // el índice y la parte concreta. Comparar solo el edificio bastaría hoy —toda
    // mutación lo reconstruye— pero dejaría la caché dependiendo de que nadie se
    // equivoque nunca, que es lo que la cabecera de `viewer/edicion.js` llama una
    // apuesta y no una caché.
    if (cacheEdificio === edificio && cacheIndice === indice && cacheParte === parte) {
      return cacheProyeccion
    }

    cacheEdificio = edificio
    cacheIndice = indice
    cacheParte = parte
    cacheProyeccion = {
      // `recinto: null` es «pendiente de dibujar»: hay parte, no hay contorno.
      recintos: parte.recinto === null || parte.recinto === undefined ? [] : [parte.recinto],
      idLocal: edificio.idLocal ?? null,
      origen: parte.origen,
      // Marca de procedencia para quien depure: esto NO es una Parcela del modelo
      // y no debe acabar en `crearParcela` ni en un expediente.
      parteDeEdificio: { indice, nombre: parte.nombre },
    }
    return cacheProyeccion
  }

  /** Avisa a los suscriptores de ESTA fachada con la proyección de ahora. */
  function notificar() {
    const documento = proyectar()
    for (const fn of suscriptores) fn(documento)
  }

  // Cuando el edificio cambia por CUALQUIER vía —otra mutación, un fichero nuevo,
  // un undo— la proyección cambia con él y hay que decirlo. Sin esto, mover un
  // vértice desde el panel no repintaría el mapa de la parte.
  //
  // ⚠️ `notificar()` proyecta, y proyectar RECONCILIA (decisión 4): quien reciba
  // este aviso ya se encuentra el índice puesto sobre la parte que eligió, no
  // sobre la que haya heredado su hueco.
  const bajaDelEdificio = estadoEdificio.subscribe(() => notificar())

  return {
    get: proyectar,

    /**
     * Escribe los `recintos` de vuelta en la parte activa.
     *
     * `viewer/edicion.js#aplicarRecintos` llama a esto con
     * `{...proyeccion, recintos: nuevos}`. De todo eso aquí solo se mira
     * `recintos`: lo demás son campos que la proyección puso y que no pintan nada
     * en el edificio.
     *
     * ⚠️ Escribir **sin parte elegida no lanza y no hace nada**. Podría llegar por
     * una carrera —soltar el arrastre justo después de deseleccionar—, y eso es un
     * suceso normal de una interfaz, no un contrato roto.
     */
    set(documento) {
      // ⭐ ANTES de mirar nada: si la lista se ha movido desde que se eligió, el
      // índice de este `set` es el de otra parte. Ver la decisión 4 — este es EL
      // punto de escritura que el hallazgo H2 protege.
      reconciliar()
      const edificio = estadoEdificio.get()
      if (edificio === null || indice === null) return
      if (indice >= (edificio.partes?.length ?? 0)) return

      const recintos = Array.isArray(documento?.recintos) ? documento.recintos : []
      // Una parte es UN anillo exterior (criterio de aceptación 4: sin huecos), así
      // que se toma el primero. Un `[]` es «se ha quedado sin contorno», que
      // `conParteRedibujada` sabe contar.
      const recinto = recintos.length === 0 ? null : recintos[0]

      const { edificio: nuevo, detecciones } = conParteRedibujada(edificio, indice, recinto)
      if (detecciones.length > 0 && alDetectar) alDetectar(detecciones)
      // El `set` del store de arriba dispara su propia cascada, y su suscriptor
      // —el de unas líneas más arriba— es quien notifica a los de esta fachada.
      estadoEdificio.set(nuevo)
    },

    subscribe(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`subscribe: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      suscriptores.add(fn)
      return () => suscriptores.delete(fn)
    },

    /**
     * Elige la parte activa. `null` deselecciona.
     *
     * Un índice fuera de rango **LANZA**: sale de un bucle o de un
     * `data-parte-indice`, así que es un contrato roto por el programador — la
     * misma asimetría de las nueve mutaciones.
     */
    seleccionar(i) {
      if (i === null) {
        if (indice === null) return
        indice = null
        nombreElegido = null
        notificar()
        return
      }
      if (!Number.isInteger(i)) {
        throw new TypeError(`seleccionar: 'i' debe ser un entero o null; recibido ${typeof i}.`)
      }
      const partes = partesDeAhora()
      const n = partes.length
      if (i < 0 || i >= n) {
        throw new RangeError(
          `seleccionar: 'i' fuera de rango: ${i}. El edificio tiene ${n} parte(s).`,
        )
      }
      // Se anotan las DOS cosas de las que depende la reconciliación, y siempre:
      // también cuando el índice no cambia, porque la lista de debajo sí puede
      // haber cambiado entre una elección y la siguiente.
      cuantasHabia = n
      nombreElegido = partes[i]?.nombre ?? null
      if (i === indice) return
      indice = i
      notificar()
    },

    /**
     * Qué parte está elegida, **ya reconciliada**: si la lista se ha movido, el
     * número que sale de aquí es el de AHORA. Quien lo use para pintar (el panel,
     * la capa de huellas) señala así la parte que de verdad se está editando.
     */
    seleccionada() {
      reconciliar()
      return indice
    },

    destruir() {
      bajaDelEdificio()
      suscriptores.clear()
      cacheEdificio = null
      cacheParte = null
      cacheProyeccion = null
    },
  }
}

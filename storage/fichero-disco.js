// storage/fichero-disco.js — 2026-09-25 · El expediente, autoguardado en un fichero
// del disco que elige el usuario.
//
// ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
// Sin backend, lo guardado vive en IndexedDB, y `storage/cuota.js` dejó medido que el
// navegador no se compromete a conservarlo. El remedio que la aplicación daba era
// «exporta el expediente a un fichero de proyecto»: un gesto manual que hay que
// acordarse de repetir, y cuyo fichero acaba en Descargas en vez de en la carpeta del
// encargo. Un técnico trabaja por carpetas de cliente —el DXF, el PDF, el GML— y su
// copia de seguridad (OneDrive, un NAS) ya cubre esas carpetas.
//
// Con la File System Access API (Chrome y Edge) el usuario elige UNA vez dónde va el
// `.json` y la aplicación lo reescribe sola en cada cambio. Este módulo es la mitad de
// almacenamiento de eso; quien decide cuándo escribir es `app/cableado-expediente.js`.
//
// ── QUÉ HACE ────────────────────────────────────────────────────────────────
//   · Elegir destino (`showSaveFilePicker`) y escribir en él, con los fallos del disco
//     traducidos a motivos: sin permiso, fichero movido o borrado, bloqueado por otro
//     programa.
//   · RECORDAR el último fichero entre sesiones: el `FileSystemFileHandle` se puede
//     guardar en IndexedDB, y en la sesión siguiente basta un clic —el navegador exige
//     un gesto para devolver el permiso de escritura— para seguir con él.
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
//   · No existe en Firefox ni en Safari, que no tienen la API: `disponible` es `false`
//     y la interfaz no enseña nada. El fichero de proyecto de siempre sigue ahí.
//   · No avisa por el canal al escribir: corre en cada cambio, y quien cuenta un fallo
//     UNA vez por racha es el cableado (mismo reparto que `storage/autoguardado.js`).
//     Sí avisa cuando falla RECORDAR, que es una petición explícita.
//   · No lee el reloj: `ahora` entra por parámetro.

import { NIVEL, resolverAvisar } from '../viewer/_comun.js'
import { ALMACENES } from './bd.js'

/** La clave del único registro del almacén. Ver `ALMACENES.VINCULOS`. */
export const CLAVE_VINCULO = 'ultimo'

/** Tipos que ofrece el selector de ficheros. Un proyecto es JSON. */
const TIPOS = Object.freeze([
  Object.freeze({
    description: 'Proyecto de Concreta GML',
    accept: Object.freeze({ 'application/json': Object.freeze(['.json']) }),
  }),
])

/**
 * `id` del selector: el navegador recuerda la última carpeta POR `id`, así que el
 * segundo encargo abre el selector donde se guardó el primero.
 */
const ID_SELECTOR = 'concreta-gml-proyecto'

/**
 * Por qué no se ha podido. Códigos estables, como `MOTIVO_CUOTA`.
 *
 * @readonly
 */
export const MOTIVO_DISCO = Object.freeze({
  /** El navegador no tiene la API (Firefox, Safari) o no hay ventana. */
  SIN_API: 'SIN_API',
  /** El usuario cerró el selector. **No es un fallo.** */
  CANCELADO: 'CANCELADO',
  /** El permiso de escritura no está concedido, o se ha retirado. */
  SIN_PERMISO: 'SIN_PERMISO',
  /** El fichero ya no está donde estaba: se ha movido o borrado. */
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  /** Otro programa lo tiene bloqueado, o el disco no deja modificarlo. */
  BLOQUEADO: 'BLOQUEADO',
  /** Cualquier otra cosa. */
  ERROR: 'ERROR',
  /** No hay almacén local donde recordar el fichero. */
  SIN_BD: 'SIN_BD',
})

/** El texto de cada motivo de escritura, con el nombre del fichero. */
export const mensajeDisco = (motivo, nombre) => {
  const f = `«${nombre}»`
  switch (motivo) {
    case MOTIVO_DISCO.SIN_PERMISO:
      return `El navegador ya no deja escribir en ${f}: el permiso se ha retirado.`
    case MOTIVO_DISCO.NO_ENCONTRADO:
      return `${f} ya no está donde estaba: se ha movido, renombrado o borrado.`
    case MOTIVO_DISCO.BLOQUEADO:
      return `${f} no se puede modificar: puede que otro programa lo tenga abierto.`
    case MOTIVO_DISCO.SIN_API:
      return 'Este navegador no deja guardar en un fichero del disco. El fichero de proyecto (.json) sigue funcionando.'
    default:
      return `No se ha podido escribir en ${f}.`
  }
}

/** De la excepción del navegador al motivo. Los nombres son los de la especificación. */
function motivoDe(error) {
  switch (error?.name) {
    case 'AbortError':
      return MOTIVO_DISCO.CANCELADO
    case 'NotAllowedError':
    case 'SecurityError':
      return MOTIVO_DISCO.SIN_PERMISO
    case 'NotFoundError':
      return MOTIVO_DISCO.NO_ENCONTRADO
    case 'NoModificationAllowedError':
    case 'InvalidStateError':
      return MOTIVO_DISCO.BLOQUEADO
    default:
      return MOTIVO_DISCO.ERROR
  }
}

/** ¿Sabe leer, escribir y borrar como una base de `idb`? Duck typing, como en `bd.js`. */
const esBase = (b) =>
  !!b && typeof b.get === 'function' && typeof b.put === 'function' && typeof b.delete === 'function'

/** ¿Tiene forma de `FileSystemFileHandle`? Lo mínimo que este módulo le pide. */
const esAsa = (a) => !!a && typeof a === 'object' && typeof a.createWritable === 'function'

/**
 * Crea el acceso al disco.
 *
 * @param {object} [opciones]
 * @param {*} [opciones.ventana=globalThis.window]  De donde sale `showSaveFilePicker`.
 *   Inyectable: jsdom no la tiene.
 * @param {*} [opciones.bd=null]  La promesa de `abrirBd`, su resultado o la base. `null`
 *   ⇒ se escribe igual, pero no se recuerda el fichero entre sesiones.
 * @param {() => number} [opciones.ahora]
 * @param {import('../viewer/_comun.js').Avisar|null} [opciones.alAvisar=null]
 * @throws {TypeError}  Contrato roto por el programador.
 */
export function crearFicheroDisco({
  ventana = globalThis.window ?? null,
  bd = null,
  ahora = () => Date.now(),
  alAvisar = null,
} = {}) {
  if (typeof ahora !== 'function') {
    throw new TypeError(`crearFicheroDisco: 'ahora' debe ser una función; recibido ${typeof ahora}.`)
  }
  const avisar = resolverAvisar(alAvisar)
  const disponible = typeof ventana?.showSaveFilePicker === 'function'

  let resuelta = null
  /** La base resuelta una sola vez, o `null`. Nunca lanza: sin base es un estado. */
  function base() {
    if (resuelta === null) {
      resuelta = (async () => {
        try {
          const abierta = await bd
          if (esBase(abierta)) return abierta
          if (abierta?.disponible === true && esBase(abierta.bd)) return abierta.bd
          return null
        } catch {
          return null
        }
      })()
    }
    return resuelta
  }

  return {
    /** Si este navegador deja guardar en un fichero del disco. */
    disponible,

    /**
     * Abre el selector de «Guardar como». Tiene que llamarse desde un gesto.
     *
     * @param {string} nombreSugerido
     * @returns {Promise<{ok: boolean, asa: *, nombre: string|null, motivo: string|null}>}
     */
    async elegirDestino(nombreSugerido) {
      if (!disponible) return { ok: false, asa: null, nombre: null, motivo: MOTIVO_DISCO.SIN_API }
      try {
        const asa = await ventana.showSaveFilePicker({
          suggestedName: nombreSugerido,
          types: TIPOS,
          id: ID_SELECTOR,
        })
        return { ok: true, asa, nombre: asa?.name ?? nombreSugerido, motivo: null }
      } catch (error) {
        return { ok: false, asa: null, nombre: null, motivo: motivoDe(error) }
      }
    },

    /**
     * Escribe `texto` entero en el fichero, sustituyendo lo que hubiera. **No lanza**:
     * el fallo vuelve como `{ok: false, motivo}`, que es la forma que
     * `storage/autoguardado.js` cuenta como fallo.
     *
     * @param {*} asa  El `FileSystemFileHandle`.
     * @param {string} texto
     */
    async escribir(asa, texto) {
      if (!esAsa(asa)) return { ok: false, motivo: MOTIVO_DISCO.ERROR, causa: null }
      let escritor = null
      try {
        escritor = await asa.createWritable()
        await escritor.write(texto)
        await escritor.close()
        return { ok: true, motivo: null, causa: null }
      } catch (error) {
        // Un escritor abierto que no se cierra deja un temporal «.crswap» junto al
        // fichero. `abort` lo descarta y el original queda como estaba.
        try {
          await escritor?.abort?.()
        } catch {
          /* ya no hay nada que salvar */
        }
        return { ok: false, motivo: motivoDe(error), causa: error }
      }
    },

    /**
     * ¿Se puede escribir ya, o hay que pedir permiso? Sin pedir nada.
     *
     * @returns {Promise<'granted'|'prompt'|'denied'>}
     */
    async permiso(asa) {
      try {
        return (await asa?.queryPermission?.({ mode: 'readwrite' })) ?? 'granted'
      } catch {
        return 'denied'
      }
    },

    /**
     * Pide el permiso de escritura. **Solo desde un gesto del usuario**: es lo que el
     * navegador exige para devolverlo en una sesión nueva.
     *
     * @returns {Promise<'granted'|'prompt'|'denied'>}
     */
    async pedirPermiso(asa) {
      try {
        return (await asa?.requestPermission?.({ mode: 'readwrite' })) ?? 'granted'
      } catch {
        return 'denied'
      }
    },

    /**
     * El contenido actual del fichero, como `File`.
     *
     * @returns {Promise<{ok: boolean, fichero: *, motivo: string|null}>}
     */
    async leer(asa) {
      try {
        return { ok: true, fichero: await asa.getFile(), motivo: null }
      } catch (error) {
        return { ok: false, fichero: null, motivo: motivoDe(error) }
      }
    },

    /**
     * Recuerda este fichero como el último, pisando el anterior.
     *
     * @param {*} asa
     * @returns {Promise<{ok: boolean, motivo: string|null}>}
     */
    async recordar(asa) {
      const db = await base()
      if (db === null) return { ok: false, motivo: MOTIVO_DISCO.SIN_BD }
      try {
        await db.put(ALMACENES.VINCULOS, {
          id: CLAVE_VINCULO,
          asa,
          nombre: asa?.name ?? null,
          vinculadoEn: ahora(),
        })
        return { ok: true, motivo: null }
      } catch (error) {
        avisar(
          `No se ha podido recordar «${asa?.name ?? 'el fichero'}» para la próxima sesión ` +
            `(${error?.message ?? error}). Se sigue guardando en él mientras esta pestaña esté abierta.`,
          { nivel: NIVEL.AVISO, causa: error },
        )
        return { ok: false, motivo: MOTIVO_DISCO.ERROR }
      }
    },

    /**
     * El último fichero recordado, si lo hay y tiene forma de fichero.
     *
     * @returns {Promise<{recordado: boolean, asa: *, nombre: string|null}>}
     */
    async ultimo() {
      const nada = { recordado: false, asa: null, nombre: null }
      const db = await base()
      if (db === null) return nada
      try {
        const registro = await db.get(ALMACENES.VINCULOS, CLAVE_VINCULO)
        if (!esAsa(registro?.asa)) return nada
        return { recordado: true, asa: registro.asa, nombre: registro.nombre ?? registro.asa.name ?? null }
      } catch {
        return nada
      }
    },

    /** Olvida el último fichero. Olvidar lo que no estaba no es un fallo. */
    async olvidar() {
      const db = await base()
      if (db === null) return { ok: true }
      try {
        await db.delete(ALMACENES.VINCULOS, CLAVE_VINCULO)
        return { ok: true }
      } catch (error) {
        return { ok: false, causa: error }
      }
    },
  }
}

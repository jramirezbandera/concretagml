// app/dialogo-pegado.js — F19 · T1 · El PEGADO de coordenadas.
//
// ── QUÉ CIERRA ESTE FICHERO ─────────────────────────────────────────────────
// `spec/feature-01-entrada-parcela.md:14` llama al pegado de la LISTA de AutoCAD
// **la vía principal** de entrada del técnico. `parsers/list.js` está escrito y en
// verde desde la fase 1. Y sin embargo, medido el 2026-08-06 con un grep sobre
// todo el repositorio: **no había ni un manejador de `paste` en producción**. La
// única aparición de la palabra en el proyecto era la deuda escrita en la ficha de
// F18, que es la que manda construir esto.
//
// No es alcance nuevo. Es el requisito de F01, doce fases después.
//
// ── POR QUÉ UN <dialog> Y NO UN Ctrl+V GLOBAL ───────────────────────────────
// Un manejador de `paste` en la ventana es lo más corto de teclear y lo más
// difícil de descubrir; y encima compite con el campo de la referencia catastral,
// donde F06 ya midió un fallo silencioso (un `maxlength` que recortaba lo pegado
// sin decir nada). Decisión 2 de la entrevista del 2026-08-06: un botón visible en
// la vía «Medición propia» que abre una pantalla con su campo. Lo que se pega se
// ve, y lo que se ha entendido se ve al lado antes de aceptar.
//
// ── ⭐ LA VISTA PREVIA ES LA MITAD DE LA FASE ────────────────────────────────
// Este diálogo **no interpreta nada**: se lo pide a quien sabe. `inspeccionar` lo
// aporta el cableado de la rama activa (`app/cableado-medicion.js` para parcela,
// `app/cableado-edificio.js` para edificio), y devuelve qué se ha entendido, con
// qué formato, y —solo la LISTA lo trae— **el cotejo de superficie con las dos
// cifras**: la que declara el dibujo y la que calcula la aplicación.
//
// Ese cotejo lo calcula `parsers/importar.js` desde F01 en `resumen.superficie` y
// **hasta hoy no lo leía nadie**. Se enseña **siempre**, coincidan o no las dos
// cifras (decisión 4): callar la comprobación cuando sale bien le quita al usuario
// la única prueba de que se ha hecho. Y va **antes de aceptar** porque es el único
// momento en el que todavía se puede cancelar (decisión 5).
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
//   · **No decide a qué rama va lo pegado.** Igual que el fichero de F18: lo
//     resuelve tarde `app/main.js` por la rama en pantalla.
//   · **No resuelve las detecciones.** De eso es dueño `app/dialogo-importacion.js`,
//     que se abre después si hay algo que decidir. Aquí solo se entra o se cancela.
//   · **No toca el store.** Devuelve el texto y se aparta.

import { NIVEL, resolverAvisar } from '../viewer/_comun.js'

// ── Textos de la pantalla ────────────────────────────────────────────────────

const TITULO = 'Pegar coordenadas'

/**
 * El apunte de debajo del título. Nombra **la LISTA de AutoCAD** —que es la vía
 * que el técnico conoce y la que da nombre a la fase— pero dice también que se
 * aceptan dos columnas, porque `importar()` autodetecta el formato y esconderlo
 * sería una restricción que no existe (decisión 3).
 */
const APUNTE =
  'Copia en AutoCAD el resultado del comando LISTA sobre la polilínea y pégalo aquí. También ' +
  'valen dos columnas de coordenadas, una por vértice.'

const ROTULO_CAMPO = 'Texto pegado'
const ROTULO_LECTURA = 'Lo que se ha entendido'

const BOTON_USAR = 'Usar estas coordenadas'
const BOTON_CANCELAR = 'Cancelar'

/** Cómo se llama lo pegado en el renglón de procedencia y en el `idLocal`. */
export const NOMBRE_PEGADO = 'coordenadas pegadas'

// ── Clases CSS, contrato con `estilos/app.css` ───────────────────────────────

const CLASE = Object.freeze({
  DIALOGO: 'gml-dialogo-pegado',
  CUERPO: 'gml-dialogo-pegado-cuerpo',
  TITULO: 'gml-dialogo-pegado-titulo',
  APUNTE: 'gml-dialogo-pegado-apunte',
  ETIQUETA: 'gml-dialogo-pegado-etiqueta',
  CAMPO: 'gml-dialogo-pegado-campo',
  LECTURA: 'gml-dialogo-pegado-lectura',
  TITULAR: 'gml-dialogo-pegado-titular',
  RENGLON: 'gml-dialogo-pegado-renglon',
  MOTIVO: 'gml-dialogo-pegado-motivo',
  PIE: 'gml-dialogo-pegado-pie',
  ESTADO: 'gml-dialogo-pegado-estado',
})

const ACCION = Object.freeze({ USAR: 'usar-pegado', CANCELAR: 'cancelar-pegado' })

const esTexto = (v) => typeof v === 'string' && v.trim() !== ''

/**
 * Fabrica la pantalla del pegado. **Fabrica su propio DOM**, como los diálogos de
 * F09, F10, F11 y F18: `index.html` aporta únicamente el botón que la abre.
 *
 * ```js
 * const pegado = crearDialogoPegado({ alAvisar: panel.avisar })
 * const texto = await pegado.abrir({ inspeccionar: medicion.inspeccionarTexto })
 * if (texto === null) return              // cancelado
 * medicion.alTexto(texto, NOMBRE_PEGADO)
 * ```
 *
 * @param {object} [opciones]
 * @param {Document} [opciones.documento=document]
 * @param {(mensaje: string, extra?: object) => void} [opciones.alAvisar]  Para lo
 *   que es defecto de programación, nunca para lo que decide el usuario.
 * @returns {{nodo: HTMLElement, abrir: (entrada: object) => Promise<string|null>,
 *            destruir: () => void}}
 */
export function crearDialogoPegado({ documento = document, alAvisar } = {}) {
  const doc = documento
  const avisar = resolverAvisar(alAvisar)

  if (!doc || typeof doc.createElement !== 'function') {
    throw new TypeError(
      `crearDialogoPegado: 'documento' debe ser un Document; recibido ${typeof doc}.`,
    )
  }

  let destruido = false
  let abierto = false
  let focoPrevio = null
  /** El `resolve` de la promesa en vuelo. `null` = no hay pantalla abierta. */
  let resolver = null
  /** El inspector de la rama que abrió. Se recibe en cada apertura. */
  let inspeccionar = null
  /** Lo último que dijo el inspector, para no volver a preguntarle al aceptar. */
  let lectura = { ok: false, titular: '', renglones: [], motivo: null }

  const crear = (etiqueta, clase, texto) => {
    const el = doc.createElement(etiqueta)
    if (clase) el.className = clase
    if (texto !== undefined) el.textContent = texto
    return el
  }

  const dialogo = crear('dialog', CLASE.DIALOGO)
  dialogo.setAttribute('aria-modal', 'true')
  dialogo.tabIndex = -1

  const cuerpo = crear('div', CLASE.CUERPO)
  const titulo = crear('h2', CLASE.TITULO, TITULO)
  titulo.id = 'gml-dialogo-pegado-titulo'
  dialogo.setAttribute('aria-labelledby', titulo.id)
  const apunte = crear('p', CLASE.APUNTE, APUNTE)

  const etiqueta = crear('label', CLASE.ETIQUETA, ROTULO_CAMPO)
  etiqueta.setAttribute('for', 'gml-dialogo-pegado-campo')
  const campo = doc.createElement('textarea')
  campo.className = CLASE.CAMPO
  campo.id = 'gml-dialogo-pegado-campo'
  campo.dataset.campo = 'pegado'
  campo.rows = 12
  campo.spellcheck = false
  // ⚠️ El campo es MONOESPACIADO por la misma razón que el nombre de la capa en el
  // diálogo de F18: aquí se leen columnas de números, y en una tipografía
  // proporcional las columnas no se alinean y un `0` se confunde con una `O`.
  campo.classList.add('gml-mono')

  const lecturaCaja = crear('div', CLASE.LECTURA)
  lecturaCaja.dataset.lectura = 'pegado'
  // Se anuncia sin robar el foco: el usuario sigue con las manos en el campo
  // mientras la vista previa cambia debajo. Mismo criterio que los `role="status"`
  // de las acciones de la pantalla de Entrada.
  lecturaCaja.setAttribute('role', 'status')
  const rotuloLectura = crear('h3', CLASE.TITULAR, ROTULO_LECTURA)
  const titular = crear('p', CLASE.TITULAR, '')
  titular.dataset.titular = 'pegado'
  const renglones = crear('ul', null)
  const motivo = crear('p', CLASE.MOTIVO, '')
  motivo.dataset.motivo = 'pegado'
  lecturaCaja.append(rotuloLectura, titular, renglones, motivo)

  const pie = crear('div', CLASE.PIE)
  const botonUsar = crear('button', 'gml-boton gml-boton--primario', BOTON_USAR)
  botonUsar.type = 'button'
  botonUsar.dataset.accion = ACCION.USAR
  const botonCancelar = crear('button', 'gml-boton gml-boton--secundario', BOTON_CANCELAR)
  botonCancelar.type = 'button'
  botonCancelar.dataset.accion = ACCION.CANCELAR
  pie.append(botonUsar, botonCancelar)

  const estado = crear('p', CLASE.ESTADO, '')
  estado.dataset.estado = 'dialogo-pegado'
  estado.setAttribute('role', 'status')
  estado.id = 'gml-dialogo-pegado-estado'
  botonUsar.setAttribute('aria-describedby', estado.id)

  cuerpo.append(titulo, apunte, etiqueta, campo, lecturaCaja, pie, estado)
  dialogo.append(cuerpo)
  doc.body.appendChild(dialogo)

  // ── Pintado ───────────────────────────────────────────────────────────────

  /**
   * Vuelve a preguntarle al inspector y repinta la vista previa y el botón.
   *
   * ⛔ **El botón se apaga CON el motivo escrito al lado, nunca mudo** (regla de
   * oro 1, y la misma regla que `repintarGate` en el diálogo de F18). Y el motivo
   * es lo que hace que la decisión 6 se sostenga: cuando lo pegado no sirve, esta
   * pantalla **no se cierra** — el texto sigue en el campo y debajo pone por qué,
   * así que se corrige y se reintenta sin volver al CAD a copiarlo otra vez.
   */
  function repintar() {
    lectura =
      typeof inspeccionar === 'function'
        ? inspeccionar(campo.value)
        : { ok: false, titular: '', renglones: [], motivo: null }

    titular.textContent = esTexto(lectura.titular) ? lectura.titular : ''
    renglones.replaceChildren()
    for (const texto of Array.isArray(lectura.renglones) ? lectura.renglones : []) {
      renglones.append(crear('li', CLASE.RENGLON, texto))
    }
    motivo.textContent = esTexto(lectura.motivo) ? lectura.motivo : ''
    botonUsar.disabled = lectura.ok !== true
  }

  // ── Apertura, cierre y desenlace ──────────────────────────────────────────

  /** Cierra el `<dialog>` de verdad, con la detección de capacidad de la casa. */
  function cerrarNodo() {
    if (typeof dialogo.close === 'function') {
      try {
        dialogo.close()
      } catch {
        dialogo.removeAttribute('open')
      }
    } else {
      dialogo.removeAttribute('open')
    }
  }

  /**
   * Único punto por el que sale esta pantalla. IDEMPOTENTE, por lo mismo que en
   * `dialogo-importacion.js`: el `close` que emite el navegador vuelve a entrar
   * aquí y se va por la primera línea.
   *
   * @param {string|null} desenlace  El texto pegado, o `null` si se ha cancelado.
   */
  function terminar(desenlace) {
    if (!abierto) return
    abierto = false
    cerrarNodo()

    const previo = focoPrevio
    focoPrevio = null
    if (previo && typeof previo.focus === 'function' && previo.isConnected) previo.focus()

    const resolverAhora = resolver
    resolver = null
    inspeccionar = null
    if (resolverAhora) resolverAhora(desenlace)
  }

  function alClic(evento) {
    const boton = evento.target?.closest?.('[data-accion]')
    if (!boton || !dialogo.contains(boton)) return
    if (boton.dataset.accion === ACCION.CANCELAR) terminar(null)
    if (boton.dataset.accion === ACCION.USAR && !botonUsar.disabled) terminar(campo.value)
  }

  /**
   * `input` y no `paste`: el evento de pegar se dispara ANTES de que el texto esté
   * en el campo —leerlo ahí daría siempre la lectura anterior— y además dejaría
   * fuera el texto escrito o corregido a mano, que es justo lo que la decisión 6
   * pide que se pueda hacer sin cerrar la pantalla.
   */
  const alEscribir = () => repintar()

  function alCancelar(evento) {
    evento.preventDefault?.()
    terminar(null)
  }

  function alTecla(evento) {
    if (evento.key === 'Escape' && abierto) {
      evento.preventDefault?.()
      terminar(null)
    }
  }

  dialogo.addEventListener('click', alClic)
  campo.addEventListener('input', alEscribir)
  dialogo.addEventListener('cancel', alCancelar)
  dialogo.addEventListener('keydown', alTecla)

  return {
    nodo: dialogo,

    /**
     * Enseña la pantalla y **espera**. Resuelve con el texto pegado, o con `null`
     * si el usuario cancela.
     *
     * @param {object} entrada
     * @param {(texto: string) => {ok: boolean, titular: string, renglones: string[],
     *   motivo: string|null}} entrada.inspeccionar  El de la rama activa.
     * @returns {Promise<string|null>}
     */
    abrir(entrada) {
      if (destruido) return Promise.resolve(null)
      if (abierto) terminar(null)

      if (typeof entrada?.inspeccionar !== 'function') {
        // Defecto de programación: sin inspector la pantalla no puede decir qué ha
        // entendido, y un «Usar estas coordenadas» que no ha mirado nada es
        // exactamente el botón que esta fase viene a no construir.
        avisar(
          'No se ha podido abrir la pantalla de pegar coordenadas. El detalle técnico está en la ' +
            'consola del navegador.',
          { nivel: NIVEL.ERROR },
        )
        console.error('[pegado] `abrir()` sin `inspeccionar`.')
        return Promise.resolve(null)
      }

      inspeccionar = entrada.inspeccionar
      campo.value = ''
      repintar()

      focoPrevio = doc.activeElement ?? null
      abierto = true
      if (typeof dialogo.showModal === 'function') {
        try {
          dialogo.showModal()
        } catch {
          dialogo.setAttribute('open', '')
        }
      } else {
        dialogo.setAttribute('open', '')
      }
      // El foco AL CAMPO: quien abre esto viene a pegar, y un `Ctrl+V` sin foco en
      // el campo no pega nada y parece que la pantalla no funciona.
      campo.focus()

      return new Promise((resuelve) => {
        resolver = resuelve
      })
    },

    /** Cierra lo que hubiera —resolviendo como cancelado— y se quita del DOM. */
    destruir() {
      if (destruido) return
      terminar(null)
      destruido = true
      dialogo.removeEventListener('click', alClic)
      campo.removeEventListener('input', alEscribir)
      dialogo.removeEventListener('cancel', alCancelar)
      dialogo.removeEventListener('keydown', alTecla)
      dialogo.remove()
    },
  }
}

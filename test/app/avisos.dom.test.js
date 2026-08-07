/* -------------------------------------------------------------------------- *
 * test/app/avisos.dom.test.js — F03 · Fase 5 · panel de avisos de la app       *
 *                                                                              *
 * Cierra el hueco que dejó la Fase 4: la tarea 4B.3 declaró sus criterios de    *
 * «Hecho» (50 llamadas iguales ⇒ UNA tarjeta ×50; 20 mensajes distintos ⇒ 12    *
 * tarjetas + resumen; chips con el nº de mensajes DISTINTOS) y los comprobó a   *
 * mano una vez, sin dejar ninguna prueba que los sostenga. La agrupación con    *
 * tope duro NO es un detalle de presentación: es la mitigación del riesgo R5    *
 * del plan de la fase (un `L.TileLayer` sin red emite un `tileerror` POR        *
 * TESELA, decenas por encuadre) y la primera UI de la regla de oro 1 del        *
 * proyecto — el único sitio donde un fallo de red se hace visible al usuario.   *
 *                                                                              *
 * Caja negra sobre `crearPanelAvisos({contenedor, chipError, chipAviso})`: se   *
 * afirma contra el DOM que el panel produce y contra el `resumen()` público,    *
 * nunca contra su estado interno.                                              *
 *                                                                              *
 * Proyecto Vitest `dom` (jsdom): el nombre `*.dom.test.js` lo enruta ahí. Hace  *
 * falta DOM real (`createElement`, `replaceChildren`, `dataset`), pero NO       *
 * Leaflet: `app/avisos.js` solo importa el vocabulario `NIVEL` a través de      *
 * `viewer/_comun.js`, que no carga el mapa.                                     *
 *                                                                              *
 * El tope de 12 se lee del propio módulo NO exportado a través de su efecto     *
 * (nº de tarjetas cuando se desborda), no como literal duplicado: si algún día  *
 * cambia, estas pruebas dicen QUÉ número rige en vez de fallar por dos sitios.  *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import { crearPanelAvisos } from '../../app/avisos.js'
import { NIVEL } from '../../viewer/_comun.js'

/** Marcado mínimo de `index.html` del que depende el panel (su contrato). */
function montarCascara() {
  document.body.innerHTML = `
    <span class="gml-chip" data-contador="ERROR">0 errores</span>
    <span class="gml-chip" data-contador="AVISO">0 avisos</span>
    <div id="avisos" class="gml-avisos"></div>
  `
  return {
    contenedor: document.getElementById('avisos'),
    chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
    chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
  }
}

const tarjetas = (contenedor) => [...contenedor.querySelectorAll('.gml-aviso')]
const textos = (contenedor) =>
  tarjetas(contenedor).map((t) => t.querySelector('.gml-aviso-texto').textContent)
const veces = (tarjeta) => {
  const nodo = tarjeta.querySelector('.gml-aviso-veces')
  return nodo === null ? null : nodo.textContent
}

/**
 * El tope de tarjetas NO se copia aquí como literal: se DESCUBRE desbordándolo
 * con más mensajes distintos de los que ningún tope razonable admitiría, y el
 * resto de las pruebas se derivan de lo medido. Así, el día que el tope cambie,
 * este fichero dice el número nuevo en su propio nombre de prueba en vez de
 * fallar por cinco sitios con un literal duplicado.
 *
 * Se calcula en tiempo de COLECCIÓN (jsdom ya tiene `document`) porque el
 * número aparece en el nombre de un `it`. Monta y desmonta su propia cáscara,
 * así que no toca la del `beforeEach`.
 */
const TOPE_TARJETAS = (() => {
  const propia = montarCascara()
  const suyo = crearPanelAvisos(propia)
  for (let i = 0; i < 100; i += 1) suyo.avisar(`sonda ${i}`, { nivel: NIVEL.AVISO })
  const medido = propia.contenedor.querySelectorAll('.gml-aviso').length
  suyo.destruir()
  document.body.innerHTML = ''
  return medido
})()

let cascara
let panel

beforeEach(() => {
  cascara = montarCascara()
  panel = crearPanelAvisos(cascara)
})

describe('app/avisos · contrato de construcción (regla de oro 1)', () => {
  // Contrato roto por el PROGRAMADOR ⇒ TypeError, igual que `viewer/mapa.js` y
  // `viewer/sincronizacion.js`. Se prueban los TRES parámetros por separado
  // porque cada uno tiene su propia guarda y su propio mensaje.
  it.each([
    ['contenedor', { chipError: 'chipError', chipAviso: 'chipAviso' }],
    ['chipError', { contenedor: 'contenedor', chipAviso: 'chipAviso' }],
    ['chipAviso', { contenedor: 'contenedor', chipError: 'chipError' }],
  ])('falta %s ⇒ TypeError que NOMBRA el parámetro', (ausente, presentes) => {
    const opciones = {}
    for (const [clave, cual] of Object.entries(presentes)) opciones[clave] = cascara[cual]
    expect(() => crearPanelAvisos(opciones)).toThrow(TypeError)
    expect(() => crearPanelAvisos(opciones)).toThrow(new RegExp(`'${ausente}'`))
  })

  it('sin argumento alguno ⇒ TypeError (no un «cannot destructure»)', () => {
    expect(() => crearPanelAvisos()).toThrow(TypeError)
  })

  it('un objeto que no es nodo del DOM ⇒ TypeError', () => {
    expect(() => crearPanelAvisos({ ...cascara, contenedor: { appendChild: 1 } })).toThrow(TypeError)
  })

  it('nace en estado vacío EXPLÍCITO, con los dos chips a cero y sin color', () => {
    expect(cascara.contenedor.querySelector('.gml-avisos-vacio').textContent).toBe('Sin avisos.')
    expect(tarjetas(cascara.contenedor)).toHaveLength(0)
    expect(cascara.chipError.textContent).toBe('0 errores')
    expect(cascara.chipAviso.textContent).toBe('0 avisos')
    expect(cascara.chipError.classList.contains('gml-chip--error')).toBe(false)
    expect(cascara.chipAviso.classList.contains('gml-chip--aviso')).toBe(false)
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 0 })
  })
})

describe('app/avisos · AGRUPACIÓN (riesgo R5: el muro de 200 tarjetas)', () => {
  it('50 llamadas IDÉNTICAS ⇒ UNA sola tarjeta con ×50', () => {
    for (let i = 0; i < 50; i += 1) {
      panel.avisar('No se ha podido cargar la tesela del IGN.', { nivel: NIVEL.AVISO })
    }
    const lista = tarjetas(cascara.contenedor)
    expect(lista).toHaveLength(1)
    expect(veces(lista[0])).toBe('×50')
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 1 })
  })

  it('el contador ×N está AUSENTE del DOM cuando solo ha ocurrido una vez', () => {
    panel.avisar('Una sola vez.', { nivel: NIVEL.AVISO })
    // Ausente, no oculto: es un nodo que no se crea (contrato de DOM de 4B.3).
    expect(veces(tarjetas(cascara.contenedor)[0])).toBeNull()
  })

  it('la clave agrupa por nivel Y texto: mismo texto con distinto nivel ⇒ DOS tarjetas', () => {
    panel.avisar('Mismo texto.', { nivel: NIVEL.ERROR })
    panel.avisar('Mismo texto.', { nivel: NIVEL.AVISO })
    expect(tarjetas(cascara.contenedor)).toHaveLength(2)
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 1, [NIVEL.AVISO]: 1 })
  })

  it('cada tarjeta lleva su nivel en `data-nivel` y su etiqueta en castellano', () => {
    panel.avisar('Bloqueo.', { nivel: NIVEL.ERROR })
    panel.avisar('Molestia.', { nivel: NIVEL.AVISO })
    const porNivel = Object.fromEntries(
      tarjetas(cascara.contenedor).map((t) => [
        t.dataset.nivel,
        t.querySelector('.gml-aviso-etiqueta').textContent,
      ]),
    )
    expect(porNivel).toEqual({ [NIVEL.ERROR]: 'Bloqueante', [NIVEL.AVISO]: 'Aviso' })
  })
})

describe('app/avisos · TOPE DURO de tarjetas y línea de resumen', () => {
  /** Desborda el tope con `n` mensajes distintos y devuelve lo que se ve. */
  function desbordarCon(n) {
    for (let i = 0; i < n; i += 1) panel.avisar(`Mensaje distinto nº ${i}.`, { nivel: NIVEL.AVISO })
    const resto = cascara.contenedor.querySelector('.gml-avisos-resto')
    return { visibles: tarjetas(cascara.contenedor).length, resto: resto && resto.textContent }
  }

  it(`el tope medido es un número finito y pequeño (hoy, ${TOPE_TARJETAS})`, () => {
    expect(Number.isInteger(TOPE_TARJETAS)).toBe(true)
    expect(TOPE_TARJETAS).toBeGreaterThan(0)
    // Si esto fallara, el tope habría dejado de topar y R5 estaría abierto: 100
    // mensajes distintos volverían a producir 100 tarjetas.
    expect(TOPE_TARJETAS).toBeLessThan(100)
  })

  it('justo EN el tope no aparece línea de resumen', () => {
    expect(desbordarCon(TOPE_TARJETAS)).toEqual({ visibles: TOPE_TARJETAS, resto: null })
  })

  it('uno por encima del tope ⇒ el tope de tarjetas y UNA línea, en SINGULAR', () => {
    expect(desbordarCon(TOPE_TARJETAS + 1)).toEqual({
      visibles: TOPE_TARJETAS,
      resto: '…y 1 aviso más.',
    })
  })

  it('20 mensajes distintos ⇒ el tope de tarjetas + resumen en PLURAL', () => {
    expect(desbordarCon(20)).toEqual({
      visibles: TOPE_TARJETAS,
      resto: `…y ${20 - TOPE_TARJETAS} avisos más.`,
    })
  })

  it('el desbordamiento NO falsea el recuento: los chips cuentan TODOS los grupos', () => {
    desbordarCon(20)
    // Lo que se topa es la LISTA, no la cuenta. Un chip que dijera «12 avisos»
    // habiendo 20 mentiría sobre el estado del expediente.
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 20 })
    expect(cascara.chipAviso.textContent).toBe('20 avisos')
  })
})

describe('app/avisos · ORDEN por recencia', () => {
  it('el más reciente va ARRIBA', () => {
    panel.avisar('Primero.', { nivel: NIVEL.AVISO })
    panel.avisar('Segundo.', { nivel: NIVEL.AVISO })
    expect(textos(cascara.contenedor)).toEqual(['Segundo.', 'Primero.'])
  })

  it('un mensaje YA VISTO que se repite vuelve a subir arriba (sigue siendo actividad)', () => {
    panel.avisar('Viejo.', { nivel: NIVEL.AVISO })
    panel.avisar('Nuevo.', { nivel: NIVEL.AVISO })
    panel.avisar('Viejo.', { nivel: NIVEL.AVISO })
    expect(textos(cascara.contenedor)).toEqual(['Viejo.', 'Nuevo.'])
    expect(veces(tarjetas(cascara.contenedor)[0])).toBe('×2')
  })
})

describe('app/avisos · el canal NUNCA lanza ante un dato raro de entrada', () => {
  // Este módulo ES el canal de avisos: si él lanzase, el fallo que intentaba
  // reportar se convertiría en una excepción sin reportar. Un dato raro de
  // ENTRADA no es un contrato roto por el programador.
  it.each([
    ['sin detalle', 'Texto.', undefined],
    ['detalle null', 'Texto.', null],
    ['nivel desconocido', 'Texto.', { nivel: 'CATASTROFE' }],
    ['nivel undefined', 'Texto.', { nivel: undefined }],
    ['mensaje null', null, { nivel: NIVEL.AVISO }],
    ['mensaje undefined', undefined, { nivel: NIVEL.AVISO }],
    ['mensaje vacío', '', { nivel: NIVEL.AVISO }],
    ['mensaje numérico', 42, { nivel: NIVEL.AVISO }],
    ['detalle con causa (un Event)', 'Texto.', { nivel: NIVEL.AVISO, causa: new Event('error') }],
  ])('%s ⇒ no lanza y deja UNA tarjeta', (_caso, mensaje, detalle) => {
    expect(() => panel.avisar(mensaje, detalle)).not.toThrow()
    expect(tarjetas(cascara.contenedor)).toHaveLength(1)
  })

  it('un nivel desconocido cae a AVISO, nunca a ERROR (no se inventan bloqueos)', () => {
    panel.avisar('Nivel raro.', { nivel: 'CATASTROFE' })
    expect(tarjetas(cascara.contenedor)[0].dataset.nivel).toBe(NIVEL.AVISO)
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 1 })
  })

  it('un mensaje sin texto se sustituye por relleno VISIBLE, nunca por una tarjeta muda', () => {
    panel.avisar(null, { nivel: NIVEL.AVISO })
    expect(textos(cascara.contenedor)[0]).toBe('Aviso sin mensaje.')
  })

  it('un mensaje numérico conserva el dato en vez de tirarlo', () => {
    panel.avisar(42, { nivel: NIVEL.AVISO })
    expect(textos(cascara.contenedor)[0]).toBe('42')
  })

  it('`causa` NO se pinta (puede ser un Event; es ruido para quien no programa)', () => {
    const causa = new Error('ENOTFOUND ovc.catastro.meh.es')
    panel.avisar('No se ha podido cargar la cartografía.', { nivel: NIVEL.ERROR, causa })
    expect(cascara.contenedor.textContent).not.toContain('ENOTFOUND')
  })
})

describe('app/avisos · CHIPS (contrato compartido con index.html y el CSS)', () => {
  it('cuentan mensajes DISTINTOS por nivel, no repeticiones', () => {
    panel.avisar('A.', { nivel: NIVEL.ERROR })
    for (let i = 0; i < 9; i += 1) panel.avisar('A.', { nivel: NIVEL.ERROR })
    panel.avisar('B.', { nivel: NIVEL.AVISO })
    panel.avisar('C.', { nivel: NIVEL.AVISO })
    expect(cascara.chipError.textContent).toBe('1 error')
    expect(cascara.chipAviso.textContent).toBe('2 avisos')
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 1, [NIVEL.AVISO]: 2 })
  })

  it('singular y plural correctos en ambos niveles', () => {
    panel.avisar('A.', { nivel: NIVEL.ERROR })
    panel.avisar('B.', { nivel: NIVEL.AVISO })
    expect([cascara.chipError.textContent, cascara.chipAviso.textContent]).toEqual([
      '1 error',
      '1 aviso',
    ])
  })

  it('el modificador de color se AÑADE a >0 y se QUITA al volver a cero', () => {
    panel.avisar('A.', { nivel: NIVEL.ERROR })
    expect(cascara.chipError.classList.contains('gml-chip--error')).toBe(true)
    panel.limpiar()
    expect(cascara.chipError.classList.contains('gml-chip--error')).toBe(false)
    expect(cascara.chipError.textContent).toBe('0 errores')
  })

  it('el chip nunca se oculta: a cero sigue visible y sigue diciendo cero', () => {
    // Ocultarlo haría «saltar» la fila de chips según el estado del expediente,
    // y quitaría la confirmación explícita de «cero errores».
    expect(cascara.chipError.hidden).toBe(false)
    panel.avisar('A.', { nivel: NIVEL.ERROR })
    panel.limpiar()
    expect(cascara.chipError.hidden).toBe(false)
  })

  it('`textContent` no borra el punto de color: lo pinta un ::before del CSS', () => {
    panel.avisar('A.', { nivel: NIVEL.ERROR })
    // Ningún hijo elemento dentro del chip ⇒ el punto no puede ser un <span>
    // que `textContent` arrastraría (contrato con index.html y estilos/app.css).
    expect(cascara.chipError.children).toHaveLength(0)
  })
})

describe('app/avisos · limpiar() y destruir()', () => {
  it('limpiar() vuelve al estado vacío explícito y deja el panel USABLE', () => {
    panel.avisar('A.', { nivel: NIVEL.ERROR })
    panel.limpiar()
    expect(cascara.contenedor.querySelector('.gml-avisos-vacio').textContent).toBe('Sin avisos.')
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 0 })
    panel.avisar('B.', { nivel: NIVEL.AVISO })
    expect(tarjetas(cascara.contenedor)).toHaveLength(1)
  })

  it('limpiar() reinicia el orden: tras limpiar, la recencia se cuenta de nuevo', () => {
    panel.avisar('Vieja.', { nivel: NIVEL.AVISO })
    panel.limpiar()
    panel.avisar('Primera.', { nivel: NIVEL.AVISO })
    panel.avisar('Segunda.', { nivel: NIVEL.AVISO })
    expect(textos(cascara.contenedor)).toEqual(['Segunda.', 'Primera.'])
  })

  it('destruir() vacía el contenedor y es IDEMPOTENTE', () => {
    panel.avisar('A.', { nivel: NIVEL.ERROR })
    panel.destruir()
    expect(cascara.contenedor.childNodes).toHaveLength(0)
    expect(() => panel.destruir()).not.toThrow()
    expect(cascara.contenedor.childNodes).toHaveLength(0)
  })

  it('tras destruir(), `avisar` es un no-op: no resucita el panel', () => {
    panel.destruir()
    expect(() => panel.avisar('Tarde.', { nivel: NIVEL.ERROR })).not.toThrow()
    expect(cascara.contenedor.childNodes).toHaveLength(0)
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 0 })
  })
})

describe('app/avisos · encaja como canal `Avisar` del visor', () => {
  it('`avisar` se puede pasar SUELTA como `alAvisar` (no depende de `this`)', () => {
    // `app/main.js` la pasa así: `alAvisar: panel.avisar`. Si el módulo pasara
    // a usar `this`, ese cableado se rompería en silencio.
    const { avisar } = panel
    expect(() => avisar('Desde el visor.', { nivel: NIVEL.AVISO })).not.toThrow()
    expect(textos(cascara.contenedor)).toEqual(['Desde el visor.'])
  })

  it('acepta el vocabulario NIVEL tal cual lo emite `validation/`', () => {
    // Recorrido DERIVADO: si algún día NIVEL crece, esta prueba lo ejercita
    // sola en vez de quedarse mirando dos literales.
    for (const nivel of Object.values(NIVEL)) {
      panel.avisar(`Nivel ${nivel}.`, { nivel })
    }
    const nivelesPintados = tarjetas(cascara.contenedor).map((t) => t.dataset.nivel)
    expect(new Set(nivelesPintados)).toEqual(new Set(Object.values(NIVEL)))
  })
})

/* ══ EL FILTRO Y EL DESTELLO (2026-08-07) ═══════════════════════════════════ *
 *                                                                             *
 * Los dos existen por la MISMA mudanza: la lista se fue de la columna a un     *
 * `<dialog>` (`app/dialogo-avisos.js`). El filtro es lo que accionan sus tres  *
 * pestañas; el destello es lo que sustituye a la tarjeta roja de 52 px que     *
 * antes aparecía sola en mitad del panel y que ahora no aparece en ningún      *
 * sitio hasta que alguien abre el diálogo.                                     *
 * ─────────────────────────────────────────────────────────────────────────── */

describe('app/avisos · el filtro por nivel', () => {
  /** Siembra 2 errores y 3 avisos, con textos reconocibles. */
  function sembrar() {
    panel.avisar('Error uno.', { nivel: NIVEL.ERROR })
    panel.avisar('Aviso uno.', { nivel: NIVEL.AVISO })
    panel.avisar('Error dos.', { nivel: NIVEL.ERROR })
    panel.avisar('Aviso dos.', { nivel: NIVEL.AVISO })
    panel.avisar('Aviso tres.', { nivel: NIVEL.AVISO })
  }

  it('sin filtro se ven las cinco; con filtro, solo las de su nivel', () => {
    sembrar()
    expect(panel.filtroActual()).toBeNull()
    expect(tarjetas(cascara.contenedor)).toHaveLength(5)

    panel.filtro(NIVEL.ERROR)
    expect(panel.filtroActual()).toBe(NIVEL.ERROR)
    expect(textos(cascara.contenedor)).toEqual(['Error dos.', 'Error uno.'])

    panel.filtro(NIVEL.AVISO)
    expect(textos(cascara.contenedor)).toEqual(['Aviso tres.', 'Aviso dos.', 'Aviso uno.'])

    panel.filtro(null)
    expect(tarjetas(cascara.contenedor)).toHaveLength(5)
  })

  it('⭐ los CHIPS cuentan el TOTAL, nunca lo filtrado', () => {
    // Es la regla de oro 1 aplicada al filtro: un «0 errores» porque está puesta
    // la pestaña de avisos sería el peor fallo mudo que este módulo puede tener.
    sembrar()
    panel.filtro(NIVEL.AVISO)
    expect(cascara.chipError.textContent).toBe('2 errores')
    expect(cascara.chipAviso.textContent).toBe('3 avisos')
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 2, [NIVEL.AVISO]: 3 })
  })

  it('⭐ el filtro se aplica ANTES del tope: los errores no se caen por recencia', () => {
    // El fallo que esta prueba impide: con el tope aplicado PRIMERO, los dos
    // errores —los más ANTIGUOS— quedarían fuera de las 12 tarjetas más recientes
    // y la pestaña «Errores» saldría VACÍA justo cuando se ha pinchado el chip
    // rojo para verlos.
    panel.avisar('Error viejísimo.', { nivel: NIVEL.ERROR })
    panel.avisar('Otro error viejo.', { nivel: NIVEL.ERROR })
    for (let i = 0; i < TOPE_TARJETAS * 2; i += 1) {
      panel.avisar(`Tesela ${i} que no carga.`, { nivel: NIVEL.AVISO })
    }
    // Sin filtro los dos errores NO se ven: el tope se los ha comido. Esto no es
    // el fallo, es la premisa — sin ella la prueba no probaría nada.
    expect(textos(cascara.contenedor)).not.toContain('Error viejísimo.')

    panel.filtro(NIVEL.ERROR)
    expect(textos(cascara.contenedor)).toEqual(['Otro error viejo.', 'Error viejísimo.'])
  })

  it('con el filtro puesto, el tope sigue rigiendo DENTRO del nivel', () => {
    for (let i = 0; i < TOPE_TARJETAS + 5; i += 1) {
      panel.avisar(`Aviso ${i}.`, { nivel: NIVEL.AVISO })
    }
    panel.filtro(NIVEL.AVISO)
    expect(tarjetas(cascara.contenedor)).toHaveLength(TOPE_TARJETAS)
    expect(cascara.contenedor.querySelector('.gml-avisos-resto').textContent).toBe(
      '…y 5 avisos más.',
    )
  })

  it('un filtro sin tarjetas lo DICE, y con el texto de su nivel', () => {
    panel.avisar('Solo un aviso.', { nivel: NIVEL.AVISO })
    panel.filtro(NIVEL.ERROR)
    // «Sin avisos.» bajo la pestaña «Errores» se leería como que no hay avisos.
    // Y sí los hay: hay uno.
    expect(cascara.contenedor.querySelector('.gml-avisos-vacio').textContent).toBe('Sin errores.')

    panel.filtro(NIVEL.AVISO)
    expect(cascara.contenedor.querySelector('.gml-avisos-vacio')).toBeNull()
  })

  it('un filtro con un valor que no está en NIVEL enseña TODO (no esconde nada)', () => {
    sembrar()
    for (const raro of ['error', 'ERRORES', 42, undefined, {}]) {
      panel.filtro(NIVEL.ERROR) // primero uno de verdad, para que haya algo que deshacer
      panel.filtro(raro)
      expect(panel.filtroActual(), `«${String(raro)}» ha filtrado algo`).toBeNull()
      expect(tarjetas(cascara.contenedor)).toHaveLength(5)
    }
  })

  it('un aviso NUEVO que no pasa el filtro no se pinta, pero SÍ cuenta en el chip', () => {
    panel.filtro(NIVEL.ERROR)
    panel.avisar('Tesela que no carga.', { nivel: NIVEL.AVISO })
    expect(tarjetas(cascara.contenedor)).toHaveLength(0)
    expect(cascara.chipAviso.textContent).toBe('1 aviso')
  })

  it('`alCambiar` recibe el recuento en cada repintado, y su fallo NO tumba el canal', () => {
    const propia = montarCascara()
    const recibidos = []
    const suyo = crearPanelAvisos({
      ...propia,
      alCambiar: (conteo) => {
        recibidos.push(conteo)
        throw new Error('el oyente se ha caído')
      },
    })
    // El primero es el del render inicial (todo a cero).
    expect(recibidos).toEqual([{ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 0 }])
    expect(() => suyo.avisar('Algo.', { nivel: NIVEL.ERROR })).not.toThrow()
    expect(recibidos.at(-1)).toEqual({ [NIVEL.ERROR]: 1, [NIVEL.AVISO]: 0 })
    // Y el aviso se pintó igualmente: un oyente roto no se lleva por delante la
    // única UI de la regla de oro 1.
    expect(textos(propia.contenedor)).toEqual(['Algo.'])
    suyo.destruir()
  })
})

describe('app/avisos · el destello del chip', () => {
  const DESTELLO = 'gml-chip--destello'

  it('el chip destella cuando su cuenta SUBE, y solo el suyo', () => {
    expect(cascara.chipError.classList.contains(DESTELLO)).toBe(false)
    panel.avisar('Un error.', { nivel: NIVEL.ERROR })
    expect(cascara.chipError.classList.contains(DESTELLO)).toBe(true)
    expect(cascara.chipAviso.classList.contains(DESTELLO)).toBe(false)
  })

  it('el destello se apaga SOLO, por temporizador', () => {
    // Por temporizador y no por `animationend`: con `prefers-reduced-motion` la
    // animación no corre, el evento no llega nunca y la clase se quedaría puesta
    // para siempre — el chip destellando eternamente por un error de hace media
    // hora es peor que no destellar.
    vi.useFakeTimers()
    try {
      const propia = montarCascara()
      const suyo = crearPanelAvisos(propia)
      suyo.avisar('Un error.', { nivel: NIVEL.ERROR })
      expect(propia.chipError.classList.contains(DESTELLO)).toBe(true)
      vi.advanceTimersByTime(2000)
      expect(propia.chipError.classList.contains(DESTELLO)).toBe(false)
      suyo.destruir()
    } finally {
      vi.useRealTimers()
    }
  })

  it('⛔ NO destella cuando la cuenta no sube: repetición o vaciado', () => {
    panel.avisar('Un error.', { nivel: NIVEL.ERROR })
    cascara.chipError.classList.remove(DESTELLO)

    // Repetición del MISMO mensaje: sube el `×N`, no sube la cuenta de mensajes
    // distintos. No hay nada nuevo que mirar, y destellar aquí enseñaría a
    // ignorar el destello (una tanda de teselas del IGN son decenas de llamadas).
    panel.avisar('Un error.', { nivel: NIVEL.ERROR })
    expect(cascara.chipError.classList.contains(DESTELLO)).toBe(false)

    panel.limpiar()
    expect(cascara.chipError.classList.contains(DESTELLO)).toBe(false)
  })

  it('destruir() no deja el destello pegado ni el temporizador vivo', () => {
    vi.useFakeTimers()
    try {
      const propia = montarCascara()
      const suyo = crearPanelAvisos(propia)
      suyo.avisar('Un error.', { nivel: NIVEL.ERROR })
      expect(propia.chipError.classList.contains(DESTELLO)).toBe(true)
      suyo.destruir()
      expect(propia.chipError.classList.contains(DESTELLO)).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})

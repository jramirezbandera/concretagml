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

import { describe, it, expect, beforeEach } from 'vitest'

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

/* -------------------------------------------------------------------------- *
 * test/viewer/cajon-contraste-edificio.dom.test.js — F14 · fase 4b            *
 *                                                                            *
 * El cajón del contraste de CONSTRUCCIÓN es una vista: fabrica nodos, los     *
 * rellena, los abre y los cierra. Lo que se prueba, por orden de importancia: *
 *                                                                            *
 *   1. **Los cuatro sabores de «no hay» se escriben DISTINTO.** Es media      *
 *      razón de ser de F14, y aquí es donde se ve: «no se ha consultado» no   *
 *      puede leerse como «no consta ninguna».                                 *
 *   2. **La regla de oro 9**: ni una palabra de veredicto, ni un color de     *
 *      mérito fuera de la sección de invasión.                                *
 *   3. **La pantalla honesta** —el motivo entero, con la frase que            *
 *      tranquiliza— y que las secciones comparativas digan su motivo en vez   *
 *      de un guion.                                                           *
 *   4. **El contrato de nodos y la NO colisión** con el cajón de parcela:     *
 *      ningún par atributo/valor repetido en el mismo documento (trampa M8).  *
 *                                                                            *
 * El contraste se construye A MANO: esta vista consume una FORMA, y montar el *
 * pipeline aquí acoplaría el test de la vista a la aritmética. Los casos con  *
 * cifras reales los prueba `test/diagnostico/edificio.test.js`.               *
 *                                                                            *
 * Proyecto Vitest `dom` (jsdom + Leaflet real, arnés `_ayuda-jsdom.js`).      *
 * -------------------------------------------------------------------------- */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { REGISTRO } from '../../diagnostico/edificio.js'
import {
  ALTO_COMO_CAJON,
  ALTO_COMO_PANTALLA,
  CLASE as CLASE_PARCELA,
  ESTILO_EN_EL_PANEL,
  ESTILO_SOBRE_EL_MAPA,
  SELECTOR as SELECTOR_PARCELA,
  crearCajonDiagnostico,
} from '../../viewer/cajon-diagnostico.js'
import {
  CLASE,
  CLASE_CONTENEDOR,
  CONSULTANDO,
  MOTIVO_INFORME_SIN_EDIFICIO,
  RESUMEN_REGISTRO,
  SELECTOR,
  TITULO,
  crearCajonContrasteEdificio,
} from '../../viewer/cajon-contraste-edificio.js'
import { montarMapa } from './_ayuda-jsdom.js'

const f2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const m2 = (v) => `${f2.format(v)} m²`

/** Un contraste con TODAS las secciones medidas. */
const COMPLETO = () => ({
  registro: { clave: REGISTRO.CONSULTADO, motivo: null },
  huella: {
    medida: 322.13,
    oficial: 318.5,
    diferencia: 3.63,
    nPiezasMedida: 2,
    nCarasOficial: 2,
    perimetroMedido: { exterior: 80, huecos: 0, total: 80 },
    perimetroOficial: { exterior: 79, huecos: 0, total: 79 },
  },
  solape: { area: 315.2, relativo: 0.978, piezas: [], nPiezas: 2 },
  diferencia: { area: 10.23 },
  centroides: { medido: [0, 0], oficial: [0, 0], distancia: 0.14 },
  enParcela: { superficieDentro: 300.5, superficieFuera: 21.63, relativo: 0.9329 },
  invasion: {
    consultado: true,
    invasiones: [{ refcat: '9398515VK3799G', area: 2.64, piezas: [] }],
    descartadas: [{ refcat: '9398501VK3799G', area: 1.2e-4, grosor: 7.1e-5, nPiezas: 1 }],
  },
  omisiones: [],
  saltados: [],
})

/** El contraste que sale cuando el Catastro dice que NO CONSTA nada. */
const HONESTO = () => ({
  registro: {
    clave: REGISTRO.SIN_CONSTRUCCIONES,
    motivo:
      'No consta construcción registrada en el Catastro para esta parcela, así que no hay nada ' +
      'con lo que contrastar. No es un problema: el contraste es un paso opcional y el GML que ' +
      'se genera es plenamente válido sin él.',
  },
  huella: {
    medida: 322.13,
    oficial: null,
    diferencia: null,
    nPiezasMedida: 2,
    nCarasOficial: null,
    perimetroMedido: { exterior: 80, huecos: 0, total: 80 },
    perimetroOficial: null,
  },
  solape: null,
  diferencia: null,
  centroides: null,
  enParcela: null,
  invasion: { consultado: false, invasiones: [], descartadas: [] },
  omisiones: [
    { que: 'solape', motivo: 'MOTIVO-SOLAPE' },
    { que: 'diferencia', motivo: 'MOTIVO-DIFERENCIA' },
    { que: 'centroides', motivo: 'MOTIVO-CENTROIDES' },
    { que: 'enParcela', motivo: 'MOTIVO-EN-PARCELA' },
  ],
  saltados: [],
})

const vivos = []

function montar() {
  const { mapa, destruir } = montarMapa()
  const cajon = crearCajonContrasteEdificio({ mapa })
  vivos.push({ cajon, destruir })
  const raiz = mapa.getContainer().ownerDocument
  return { cajon, mapa, doc: raiz, q: (sel) => raiz.querySelector(sel) }
}

afterEach(() => {
  while (vivos.length > 0) {
    const { cajon, destruir } = vivos.pop()
    cajon.destruir()
    destruir()
  }
})

// ── 1 · El contrato de nodos ─────────────────────────────────────────────────

describe('F14 · cajón de contraste de edificio · el marcado', () => {
  it('TODOS los selectores del contrato existen desde el primer momento', () => {
    const { q } = montar()
    // Antes de pintar nada: es cuando el cableado los busca.
    for (const [nombre, selector] of Object.entries(SELECTOR)) {
      expect(q(selector), `${nombre} (${selector}) no está en el cajón recién montado`).not.toBeNull()
    }
  })

  it('el contenedor lleva clase PROPIA y no la del cajón de parcela', () => {
    const { q } = montar()
    const raiz = q(`.${CLASE_CONTENEDOR}`)
    expect(raiz).not.toBeNull()
    // ⛔ Reutilizar `gml-cajon-diagnostico` habría costado 0 bytes de CSS y roto
    // los cinco guiones de humo que la resuelven con `document.querySelector`: se
    // quedarían con el PRIMERO del documento. Es la trampa M8 de F07.
    expect(raiz.classList.contains(CLASE_PARCELA.CONTENEDOR)).toBe(false)
  })

  it('⭐ las clases de los HIJOS sí son las del cajón de parcela: CSS a coste cero', () => {
    // Sus reglas en `estilos/app.css` no llevan contenedor delante
    // (`.gml-app .gml-cajon-cifra`), así que alcanzan a los dos cajones.
    for (const clave of ['TITULAR', 'SECCION', 'CIFRA', 'INVASION']) {
      expect(CLASE[clave]).toBe(CLASE_PARCELA[clave])
    }
  })

  it('⛔ ningún par atributo/valor colisiona con el cajón de PARCELA', () => {
    // Los dos cajones viven en el MISMO documento —se montan los dos al arrancar y
    // se turnan por rama—, así que un valor repetido dejaría a uno de los dos mudo
    // y sin síntoma: `querySelector` se queda con el primero.
    const { mapa, doc } = montar()
    const otro = crearCajonDiagnostico({ mapa })
    try {
      for (const [nombre, selector] of Object.entries(SELECTOR)) {
        expect(
          doc.querySelectorAll(selector).length,
          `${nombre} (${selector}) casa más de un nodo con los DOS cajones montados`,
        ).toBe(1)
      }
      for (const [nombre, selector] of Object.entries(SELECTOR_PARCELA)) {
        expect(
          doc.querySelectorAll(selector).length,
          `el cajón de edificio ha duplicado ${nombre} (${selector}) del cajón de parcela`,
        ).toBe(1)
      }
    } finally {
      otro.destruir()
    }
  })

  it('el titular es DESCRIPTIVO y no dictamina (regla de oro 9)', () => {
    const { q } = montar()
    expect(q(SELECTOR.TITULAR).textContent).toBe(TITULO)
    expect(TITULO.toLowerCase()).not.toMatch(/válid|correct|apta|conform|error/)
  })
})

// ── 2 · Los cuatro sabores de «no hay» ───────────────────────────────────────

describe('F14 · los cuatro sabores de «no hay» se escriben DISTINTO', () => {
  it('los tres resúmenes son distintos entre sí, y CONSULTADO no tiene', () => {
    const conTexto = Object.entries(RESUMEN_REGISTRO).filter(([, v]) => v !== null)
    expect(conTexto).toHaveLength(3)
    expect(new Set(conTexto.map(([, v]) => v)).size).toBe(3)
    expect(RESUMEN_REGISTRO[REGISTRO.CONSULTADO]).toBeNull()
    // ⛔ Y el de «no se ha consultado» NO puede decir que no hay ninguna: son
    // afirmaciones opuestas y la segunda tranquiliza.
    expect(RESUMEN_REGISTRO[REGISTRO.NO_CONSULTADO].toLowerCase()).not.toContain('no consta')
    expect(RESUMEN_REGISTRO[REGISTRO.NO_SE_HA_PODIDO].toLowerCase()).not.toContain('no consta')
  })

  it('la celda de la huella oficial dice CUÁL de los tres «no hay» es', () => {
    const { cajon, q } = montar()
    for (const clave of [REGISTRO.NO_CONSULTADO, REGISTRO.SIN_CONSTRUCCIONES, REGISTRO.NO_SE_HA_PODIDO]) {
      cajon.pintar({ ...HONESTO(), registro: { clave, motivo: 'da igual' } })
      expect(q(SELECTOR.OFICIAL).textContent).toBe(RESUMEN_REGISTRO[clave])
      expect(q(SELECTOR.DIFERENCIA_HUELLA).textContent).toBe(RESUMEN_REGISTRO[clave])
    }
  })

  it('⭐ LA PANTALLA HONESTA: el motivo entero arriba, con la frase que tranquiliza', () => {
    const { cajon, q } = montar()
    const c = HONESTO()
    cajon.pintar(c)
    const renglon = q(SELECTOR.REGISTRO)
    expect(renglon.textContent).toBe(c.registro.motivo)
    expect(renglon.textContent).toContain('plenamente válido')
    // Y se VE: un motivo escrito en un nodo `display:none` es no decir nada.
    expect(renglon.style.display).not.toBe('none')
  })

  it('sin motivo el renglón del registro se OCULTA, no se queda en blanco', () => {
    const { cajon, q } = montar()
    cajon.pintar(COMPLETO())
    // No tener nada que decir tiene que costar CERO píxeles.
    expect(q(SELECTOR.REGISTRO).textContent).toBe('')
    expect(q(SELECTOR.REGISTRO).style.display).toBe('none')
  })

  it('⛔ una sección omitida escribe SU MOTIVO, nunca un guion', () => {
    const { cajon, q } = montar()
    cajon.pintar(HONESTO())
    expect(q(SELECTOR.SOLAPE).textContent).toBe('MOTIVO-SOLAPE')
    expect(q(SELECTOR.DIFERENCIA).textContent).toBe('MOTIVO-DIFERENCIA')
    expect(q(SELECTOR.CENTROIDES).textContent).toBe('MOTIVO-CENTROIDES')
    // Las dos celdas de «en parcela» dicen el mismo motivo: falta el mismo dato.
    expect(q(SELECTOR.EN_PARCELA).textContent).toBe('MOTIVO-EN-PARCELA')
    expect(q(SELECTOR.FUERA).textContent).toBe('MOTIVO-EN-PARCELA')
    // Y en ninguna hay un `—` a secas, que se leería como «cero» o «nada que
    // reseñar» en vez de «este dato falta».
    for (const sel of [SELECTOR.SOLAPE, SELECTOR.CENTROIDES, SELECTOR.EN_PARCELA]) {
      expect(q(sel).textContent).not.toBe('—')
    }
  })

  it('⛔ «no se ha consultado» la invasión NUNCA se escribe como «ninguna»', () => {
    const { cajon, q } = montar()
    cajon.pintar(HONESTO())
    const texto = q(SELECTOR.INVASION).textContent
    expect(texto).toContain('no se ha consultado')
    expect(texto).not.toContain('ninguna')
  })

  it('y consultada y sin invasiones sí dice «ninguna», que es otra cosa', () => {
    const { cajon, q } = montar()
    cajon.pintar({
      ...COMPLETO(),
      invasion: { consultado: true, invasiones: [], descartadas: [] },
    })
    expect(q(SELECTOR.INVASION).textContent).toContain('ninguna')
    expect(q(SELECTOR.INVASION).textContent).not.toContain('no se ha consultado')
  })
})

// ── 3 · Las cifras y la regla de oro 9 ───────────────────────────────────────

describe('F14 · las cifras', () => {
  it('la huella medida lleva superficie y recuento de piezas', () => {
    const { cajon, q } = montar()
    cajon.pintar(COMPLETO())
    expect(q(SELECTOR.MEDIDA).textContent).toBe(`${m2(322.13)} · 2 piezas`)
    expect(q(SELECTOR.OFICIAL).textContent).toBe(`${m2(318.5)} · 2 caras`)
    // El SIGNO es información: +3,63 no es lo mismo que 3,63.
    expect(q(SELECTOR.DIFERENCIA_HUELLA).textContent).toBe(`+${m2(3.63)}`)
  })

  it('el plural del recuento es de verdad («1 pieza», no «1 piezas»)', () => {
    const { cajon, q } = montar()
    const c = COMPLETO()
    c.huella.nPiezasMedida = 1
    c.huella.nCarasOficial = 1
    cajon.pintar(c)
    expect(q(SELECTOR.MEDIDA).textContent).toContain('1 pieza')
    expect(q(SELECTOR.MEDIDA).textContent).not.toContain('1 piezas')
    expect(q(SELECTOR.OFICIAL).textContent).toContain('1 cara')
  })

  it('el × 100 del porcentaje vive en la VISTA, no en el modelo', () => {
    const { cajon, q } = montar()
    cajon.pintar(COMPLETO())
    // `relativo: 0.978` es una FRACCIÓN. Si el modelo devolviera ya el porcentaje,
    // aquí saldría «97,80 %» de 97,8 → 9.780,00 %.
    expect(q(SELECTOR.SOLAPE).textContent).toContain('97,80 %')
    expect(q(SELECTOR.EN_PARCELA).textContent).toContain('93,29 %')
  })

  it('⛔ ni una palabra de veredicto en el DOM pintado (regla de oro 9)', () => {
    const { cajon, q } = montar()
    cajon.pintar(COMPLETO())
    const texto = q(`.${CLASE_CONTENEDOR}`).textContent.toLowerCase()
    for (const palabra of ['válido', 'valido', 'correcto', 'incorrecto', 'apta', 'apto', 'conforme']) {
      expect(texto, `el cajón dictamina: contiene «${palabra}»`).not.toContain(palabra)
    }
  })

  it('⛔ el ÁMBAR solo en la invasión, y solo cuando la hay', () => {
    const { cajon, q } = montar()
    const AMBAR = 'rgb(146, 64, 14)'
    cajon.pintar(COMPLETO())
    const conAmbar = [...q(`.${CLASE_CONTENEDOR}`).querySelectorAll('*')].filter(
      (el) => el.style.color === AMBAR,
    )
    expect(conAmbar.length).toBeGreaterThan(0)
    // Todos dentro de la sección de invasión, y ninguno fuera: teñir de alarma una
    // cifra de superficie sería dictaminar que la discrepancia es grande.
    expect(conAmbar.every((el) => q(SELECTOR.INVASION).contains(el))).toBe(true)

    // Y sin invasión, ni un nodo ámbar: «no lo sé» no se pinta de alarma.
    cajon.pintar(HONESTO())
    expect(
      [...q(`.${CLASE_CONTENEDOR}`).querySelectorAll('*')].filter((el) => el.style.color === AMBAR),
    ).toHaveLength(0)
  })

  it('lo DESCARTADO se puede ver, con su área y su criterio', () => {
    const { cajon, q } = montar()
    cajon.pintar(COMPLETO())
    const texto = q(SELECTOR.INVASION).textContent
    expect(texto).toContain('1 solape')
    expect(texto).toContain('milímetro')
  })
})

// ── 4 · Los botones y sus motivos ────────────────────────────────────────────

describe('F14 · los dos botones del pie', () => {
  it('«Preparar informe» nace apagado CON su motivo escrito', () => {
    const { q } = montar()
    expect(q(SELECTOR.PREPARAR).disabled).toBe(true)
    // Regla de oro 1: el botón y su porqué, en el mismo instante. Un botón gris y
    // mudo no se distingue de uno roto.
    expect(q(SELECTOR.ESTADO_INFORME).textContent).toBe(MOTIVO_INFORME_SIN_EDIFICIO)
  })

  it('⭐ el motivo habla de la CONSTRUCCIÓN, no del contraste', () => {
    // El informe de construcción se emite igual sin contrastar (ficha §17), así
    // que mandar a la gente a hacer el contraste sería mandarla a un paso opcional.
    expect(MOTIVO_INFORME_SIN_EDIFICIO).toContain('construcción')
    expect(MOTIVO_INFORME_SIN_EDIFICIO).toContain('opcional')
  })

  it('se enciende al pintar y se apaga al vaciar, con el motivo de vuelta', () => {
    const { cajon, q } = montar()
    cajon.pintar(COMPLETO())
    expect(q(SELECTOR.PREPARAR).disabled).toBe(false)
    expect(q(SELECTOR.ESTADO_INFORME).textContent).toBe('')

    cajon.pintar(null)
    expect(q(SELECTOR.PREPARAR).disabled).toBe(true)
    expect(q(SELECTOR.ESTADO_INFORME).textContent).toBe(MOTIVO_INFORME_SIN_EDIFICIO)
  })

  it('⭐ se enciende también SIN contraste: el informe declarativo es legítimo', () => {
    const { cajon, q } = montar()
    cajon.pintar(HONESTO())
    expect(q(SELECTOR.PREPARAR).disabled).toBe(false)
  })

  it('al encender NO se pisa un acuse ya escrito', () => {
    const { cajon, q } = montar()
    cajon.pintar(COMPLETO())
    cajon.estadoInforme('Descargado «informe.pdf».')
    // `pintar` corre en cada cambio del modelo: vaciar el renglón sin condición se
    // llevaría por delante el acuse un instante después de escribirlo.
    cajon.pintar(COMPLETO())
    expect(q(SELECTOR.ESTADO_INFORME).textContent).toBe('Descargado «informe.pdf».')
  })

  it('`consultando(true)` apaga la consulta Y LO DICE; al acabar borra solo su aviso', () => {
    const { cajon, q } = montar()
    cajon.consultando(true)
    expect(q(SELECTOR.CONSULTAR).disabled).toBe(true)
    expect(q(SELECTOR.ESTADO).textContent).toBe(CONSULTANDO)

    cajon.consultando(false)
    expect(q(SELECTOR.CONSULTAR).disabled).toBe(false)
    expect(q(SELECTOR.ESTADO).textContent).toBe('')

    // Y si el llamante ya escribió el desenlace, `consultando(false)` no se lo come.
    cajon.consultando(true)
    cajon.estado('Construcción registrada traída del Catastro.')
    cajon.consultando(false)
    expect(q(SELECTOR.ESTADO).textContent).toBe('Construcción registrada traída del Catastro.')
  })

  it('los dos canales avisan, y `destruir` los deja sordos', () => {
    const { cajon, q } = montar()
    const consultar = vi.fn()
    const preparar = vi.fn()
    cajon.alConsultar(consultar)
    cajon.alPreparar(preparar)
    cajon.pintar(COMPLETO())

    q(SELECTOR.CONSULTAR).click()
    q(SELECTOR.PREPARAR).click()
    expect(consultar).toHaveBeenCalledTimes(1)
    expect(preparar).toHaveBeenCalledTimes(1)

    cajon.destruir()
    expect(() => cajon.destruir()).not.toThrow()
  })

  it('varios oyentes conviven: un `= fn` desengancharía al primero en silencio', () => {
    const { cajon, q } = montar()
    const a = vi.fn()
    const b = vi.fn()
    cajon.alConsultar(a)
    const baja = cajon.alConsultar(b)
    q(SELECTOR.CONSULTAR).click()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    baja()
    q(SELECTOR.CONSULTAR).click()
    expect(a).toHaveBeenCalledTimes(2)
    expect(b).toHaveBeenCalledTimes(1)
  })
})

// ── 5 · Cajón o pantalla ─────────────────────────────────────────────────────

describe('F14 · cajón sobre el mapa vs. pantalla en el panel', () => {
  it('nace como CAJÓN, igual que su hermano: un visor a pelo se comporta como F07', () => {
    const { cajon, q } = montar()
    expect(cajon.comoPantalla()).toBe(false)
    expect(cajon.anfitrion()).toBeNull()
    expect(q(`.${CLASE_CONTENEDOR}`).style.maxHeight).toBe(ALTO_COMO_CAJON)
  })

  it('`comoPantalla(true)` sin anfitrión solo sube el tope de alto', () => {
    const { cajon, q } = montar()
    cajon.comoPantalla(true)
    expect(q(`.${CLASE_CONTENEDOR}`).style.maxHeight).toBe(ALTO_COMO_PANTALLA)
  })

  it('⭐ con anfitrión SE MUDA al panel y se viste de panel', () => {
    const { cajon, doc } = montar()
    const seccion = doc.createElement('section')
    doc.body.append(seccion)
    cajon.anfitrion(seccion)
    cajon.comoPantalla(true)

    const raiz = doc.querySelector(`.${CLASE_CONTENEDOR}`)
    // Se MUEVE el nodo, no se fabrica otro: un segundo juego de `[data-contraste]`
    // en el documento dejaría uno de los dos mudo (trampa M8).
    expect(raiz.parentNode).toBe(seccion)
    expect(doc.querySelectorAll(`.${CLASE_CONTENEDOR}`)).toHaveLength(1)
    // ⚠️ Se compara contra lo que el NAVEGADOR devuelve al asignar el mismo valor,
    // no contra el literal: jsdom normaliza `'0 12px 10px'` a `'0px 12px 10px'`, y
    // un `toBe` contra la constante daría rojo sobre un estilo aplicado
    // correctamente. Lo que hay que afirmar es que el juego del PANEL ha entrado
    // entero, no cómo serializa el CSSOM.
    const patron = doc.createElement('div')
    for (const [propiedad, valor] of Object.entries(ESTILO_EN_EL_PANEL)) {
      patron.style[propiedad] = valor
      expect(raiz.style[propiedad], `el estilo de panel no ha aplicado ${propiedad}`).toBe(
        patron.style[propiedad],
      )
    }
    // Y las dos vestimentas declaran LAS MISMAS claves —se hereda la garantía del
    // cajón hermano—, que es lo que impide que algo se quede pegado al mudar.
    expect(Object.keys(ESTILO_EN_EL_PANEL).sort()).toEqual(Object.keys(ESTILO_SOBRE_EL_MAPA).sort())
  })

  it('devolverlo a `null` lo lleva de vuelta a la esquina del mapa', () => {
    const { cajon, doc, mapa } = montar()
    const seccion = doc.createElement('section')
    doc.body.append(seccion)
    cajon.anfitrion(seccion)
    cajon.comoPantalla(true)
    cajon.anfitrion(null)
    const raiz = doc.querySelector(`.${CLASE_CONTENEDOR}`)
    expect(seccion.contains(raiz)).toBe(false)
    expect(mapa.getContainer().contains(raiz)).toBe(true)
  })

  it('⛔ `anfitrion(undefined)` LEE y no escribe: una lectura silenciosa sería peor', () => {
    const { cajon } = montar()
    expect(cajon.anfitrion()).toBeNull()
    expect(() => cajon.anfitrion(42)).toThrow(TypeError)
    expect(() => cajon.comoPantalla('sí')).toThrow(TypeError)
  })

  it('⛔ siendo PANTALLA, el ✕ pide SALIR y no vacía nada', () => {
    const { cajon, q } = montar()
    const salir = vi.fn()
    cajon.alSalir(salir)
    cajon.abrir()
    cajon.comoPantalla(true)
    q(SELECTOR.CERRAR).click()
    expect(salir).toHaveBeenCalledTimes(1)
    // Sigue abierto: quien decide a dónde se sale es la navegación, no esta vista.
    expect(cajon.abierto()).toBe(true)
    expect(q(SELECTOR.CERRAR).getAttribute('aria-label')).toContain('Salir')
  })

  it('siendo CAJÓN, el ✕ cierra y `alSalir` no dispara', () => {
    const { cajon, q } = montar()
    const salir = vi.fn()
    const cerrar = vi.fn()
    cajon.alSalir(salir)
    cajon.alCerrar(cerrar)
    cajon.abrir()
    q(SELECTOR.CERRAR).click()
    expect(cajon.abierto()).toBe(false)
    expect(cerrar).toHaveBeenCalledTimes(1)
    expect(salir).not.toHaveBeenCalled()
  })

  it('⛔ una PANTALLA no se cierra al tocar el mapa ni con Escape', () => {
    const { cajon, doc } = montar()
    cajon.abrir()
    cajon.comoPantalla(true)
    doc.body.click()
    expect(cajon.abierto()).toBe(true)
    doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cajon.abierto()).toBe(true)
  })

  it('un CAJÓN sí se descarta con el clic de fuera y con Escape', () => {
    const { cajon, doc } = montar()
    cajon.abrir()
    doc.body.click()
    expect(cajon.abierto()).toBe(false)

    cajon.abrir()
    doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Escape' }))
    expect(cajon.abierto()).toBe(false)
  })

  it('el clic que ABRE no cuenta como clic fuera', () => {
    const { cajon, doc } = montar()
    const boton = doc.createElement('button')
    doc.body.append(boton)
    boton.addEventListener('click', (evento) => cajon.abrir(evento))
    boton.click()
    // Sin esta guarda el cajón se abriría y se cerraría en el mismo gesto, y desde
    // fuera parecería que el botón no hace nada.
    expect(cajon.abierto()).toBe(true)
  })

  it('un gesto dentro de un `<dialog>` no cierra el cajón', () => {
    const { cajon, doc } = montar()
    const dialogo = doc.createElement('dialog')
    const dentro = doc.createElement('button')
    dialogo.append(dentro)
    doc.body.append(dialogo)
    cajon.abrir()
    dentro.click()
    expect(cajon.abierto()).toBe(true)
  })
})

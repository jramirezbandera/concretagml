/* -------------------------------------------------------------------------- *
 * test/app/main-arranque-vacio.dom.test.js — la app arranca SIN NADA           *
 *                                                            (2026-08-07)      *
 *                                                                              *
 * Petición del autor: *«borra los datos de partida por defecto del módulo, para *
 * que empiece sin nada precargado»*. Hasta ese día `app/main.js` metía en el     *
 * store la parcela de demostración —la real 9398516VK3799G, copiada dentro del   *
 * código— **en el arranque y siempre**, y el usuario aterrizaba editando un dato  *
 * que no era suyo, saltándose el primer peldaño del recorrido que el propio rail  *
 * anuncia.                                                                       *
 *                                                                              *
 * ── ⛔ POR QUÉ ESTE FICHERO EXISTE APARTE, Y NO ES UNA MANÍA ──                 *
 * Los otros cuatro ficheros que arrancan `app/main.js` (`main-edicion`,         *
 * `main-gml`, `main-comprobacion`, `main-edificio`) miden la app **con parcela**  *
 * y desde hoy la piden con `?demo=real`. Un módulo ES-M se evalúa **una sola     *
 * vez** por fichero de test, así que el arranque VACÍO —que es el de producción— *
 * no cabe en ninguno de ellos: o se importa con query o sin ella, no las dos.     *
 * Sin este fichero, **el camino normal de la aplicación no lo ejercitaría nadie**. *
 *                                                                              *
 * ── ⭐ EL DEFECTO QUE VIGILA, MEDIDO EN NAVEGADOR ANTES DE ESCRIBIRLO ──        *
 * La primera sonda del cambio dejó la aplicación así: rail vacío, sin            *
 * `data-paso`, mapa en blanco, panel enseñando los seis bloques a la vez… y **la  *
 * consola limpia**. Parecían cuatro defectos de maquetación y era UNO: un        *
 * `const ID_LOCAL_DEMO = parcela.idLocal` que lanzaba `TypeError` en el paso 1 de *
 * `app/main.js`, o sea antes del panel de avisos, del visor y del rail. En        *
 * pantalla quedaba `index.html` sin vestir de JavaScript, y **nadie lo contaba**   *
 * porque el error ocurre antes de que exista el canal que lo contaría.            *
 *                                                                              *
 * De ahí la forma de la primera prueba de aquí: **que el import no lance** es la  *
 * afirmación, no el preámbulo.                                                   *
 *                                                                              *
 * ── QUÉ NO SE PRUEBA AQUÍ ──                                                    *
 * Nada de lo que ya tiene suite: ni la navegación (`navegacion.dom.test.js`), ni  *
 * el rail, ni la ficha, ni los cableados. Solo el CONTRATO DEL ARRANQUE VACÍO.    *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, vi } from 'vitest'

import { SRS_DEMO } from '../../app/demo-datos.js'
import { PASO } from '../../app/navegacion.js'
import { RAMA } from '../../app/rama.js'
import { husoPorSrs } from '../../geo/huso.js'
import { ORIGEN_PARCELA, TIPO_RECINTO, crearParcela, crearRecinto } from '../../model/parcela.js'
import { crearBarraEdicion } from '../../viewer/barra-edicion.js'
import { crearCajonComprobacion } from '../../viewer/cajon-comprobacion.js'
import { crearCajonDiagnostico } from '../../viewer/cajon-diagnostico.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearListaSobrante } from '../../viewer/lista-sobrante.js'
import { VARIANTE, crearCapaPiezas } from '../../viewer/piezas.js'
import { crearSenalMiembro } from '../../viewer/senal-miembro.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

const RAIZ = join(import.meta.dirname, '..', '..')

// ── Los dobles ───────────────────────────────────────────────────────────────

const arranque = vi.hoisted(() => ({
  /** Opciones con las que `app/main.js` montó el visor. */
  opciones: null,
  /** Lo que el visor vio en el store al montarse. Es la lectura que importa. */
  estadoAlMontar: undefined,
  peticiones: [],
}))

let mapaVivo = null
let barraViva = null
let diagnosticoVivo = null
let comprobacionViva = null
let sobranteVivo = null

/** Lo que `crearVisor` monta sobre el mapa. Ver el comentario del doble. */
function montarCromoDelMapa() {
  const { mapa } = montarMapa()
  crearPanes(mapa)
  barraViva = crearBarraEdicion({ mapa })
  mapaVivo = mapa
  diagnosticoVivo = {
    cajon: crearCajonDiagnostico({ mapa }),
    contraste: crearContraste({ mapa, zona: husoPorSrs(SRS_DEMO) }),
  }
  comprobacionViva = crearCajonComprobacion({ mapa })
  sobranteVivo = {
    lista: crearListaSobrante({ documento: document }),
    capa: crearCapaPiezas({ mapa, zona: husoPorSrs(SRS_DEMO) }),
    capaFuera: crearCapaPiezas({
      mapa,
      zona: husoPorSrs(SRS_DEMO),
      variante: VARIANTE.FUERA,
    }),
    capaVecinos: crearCapaPiezas({
      mapa,
      zona: husoPorSrs(SRS_DEMO),
      variante: VARIANTE.VECINO,
    }),
    senal: crearSenalMiembro({ mapa, zona: husoPorSrs(SRS_DEMO) }),
  }
}

/**
 * `crearVisor` doblado, y **el doble reproduce el contrato que importa**: el
 * `viewer/index.js` de verdad **LANZA** si no hay ni geometría en el store ni
 * `opciones.vistaInicial` (`encuadrar`), y lo hace a propósito. Con la app
 * arrancando vacía, esa rama es la normal, así que un doble que se tragara la
 * falta de `vistaInicial` dejaría pasar el fallo que tumba la aplicación entera.
 *
 * Se PARTE del módulo real (`importarOriginal`) y solo se sustituye `crearVisor`,
 * por lo mismo que en `main-edificio.dom.test.js`: otros módulos importan de ahí
 * `encuadrarSobreRecintos`, y un doble de una sola clave convertiría cada export
 * nuevo del visor en un fallo de importación de este fichero.
 */
vi.mock('../../viewer/index.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    crearVisor: (contenedor, opciones) => {
      arranque.opciones = opciones
      arranque.estadoAlMontar = opciones.estado.get()
      if (!opciones.vistaInicial && (opciones.estado.get()?.recintos ?? []).length === 0) {
        throw new TypeError(
          'crearVisor (doble): sin geometría y sin `vistaInicial`. El visor de verdad lanza aquí, ' +
            'y con la app arrancando vacía ésta es la rama normal.',
        )
      }
      // ⚠️ El cromo que `crearVisor` monta SOBRE EL MAPA se monta DE VERDAD, con
      // los módulos de producción y no con copias. No es celo: tres cableados de
      // `app/main.js` van FUERA de todo `try` y hacen duck typing de decenas de
      // métodos (la barra de edición, los dos cajones, las dos piezas del
      // sobrante). Con dobles a mano, el arranque lanza y este fichero no
      // recolecta ni un test — que es exactamente lo que pasó al escribirlo.
      // Mismo arnés y mismo motivo que `main-edificio.dom.test.js`.
      montarCromoDelMapa()
      return {
        mapa: mapaVivo,
        estado: opciones.estado,
        capas: {},
        acotaciones: null,
        edicion: {
          snapActivo: () => true,
          tolerancia: () => 0.2,
          ladoSeleccionado: () => null,
          alCambiarSeleccion: () => () => {},
          // El modo borrar (2026-08-10): el doble solo tiene que existir. Lo que
          // `cablearEdicion` le pide es leerlo, escribirlo y suscribirse.
          modoBorrar: () => false,
          alCambiarModoBorrar: () => () => {},
          // El modo insertar (2026-08-18): gemelo del de arriba, y por lo mismo.
          modoInsertar: () => false,
          alCambiarModoInsertar: () => () => {},
          fijarColindantes() {},
          // Los puntos sueltos del levantamiento (2026-08-19). El doble solo tiene
          // que EXISTIR: quien comprueba que se le pasan los buenos es
          // `main-edicion.dom.test.js`.
          fijarPuntos() {},
          desplazarSeleccion: () => ({ aplicado: false, modo: null, detecciones: [] }),
          activa: (v) => v,
        },
        barraEdicion: {
          control: barraViva.control,
          dibujoVisible() {},
          dibujoEnCurso() {},
        },
        colindantes: { pintar() {}, limpiar() {}, destruir() {} },
        puntosLevantamiento: { pintar() {}, limpiar() {}, destruir() {} },
        diagnostico: diagnosticoVivo,
        comprobacion: comprobacionViva,
        sobrante: sobranteVivo,
        destruir() {},
      }
    },
  }
})

/** Lo único que tocaría la red. `peticiones` vacío = el arranque no consulta nada. */
vi.mock('../../services/_red.js', async (importarOriginal) => {
  const original = await importarOriginal()
  return {
    ...original,
    crearTransporte: () => ({
      async pedirTexto(url) {
        arranque.peticiones.push(url)
        throw new Error(`prueba: el arranque en vacío no debería tocar la red (${url})`)
      },
      estado: () => ({ peticiones: arranque.peticiones.length }),
      destruir() {},
    }),
  }
})

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────

const CASCARA = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body([^>]*)>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/main-arranque-vacio.dom.test.js: no se ha encontrado el <body> de index.html. La ' +
        'cáscara de estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  const clase = /class="([^"]*)"/i.exec(encontrado[1])
  // TODOS los atributos de la etiqueta de apertura: `innerHTML` no los copia y
  // `app/rama.js` lanza sin `.gml-app`, `app/pantalla.js` sin `data-app`.
  const atributos = [...encontrado[1].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map(([, n, v]) => [
    n,
    v,
  ])
  return { clase: clase === null ? '' : clase[1], atributos, cuerpo: encontrado[2] }
})()

document.body.className = CASCARA.clase
for (const [nombre, valor] of CASCARA.atributos) document.body.setAttribute(nombre, valor)
document.body.innerHTML = CASCARA.cuerpo

// ⛔ **SIN `?demo=`, Y ES LA AFIRMACIÓN ENTERA DEL FICHERO.** Los otros cuatro
// ficheros que arrancan `app/main.js` ponen `?demo=real` aquí. Éste no pone nada
// a propósito: mide el arranque de PRODUCCIÓN. Se limpia la query en vez de darla
// por vacía porque el proyecto Vitest comparte entorno entre ficheros y un
// `?demo=real` heredado convertiría este fichero en una copia de los otros —en
// verde y sin medir nada—.
window.history.replaceState({}, '', '/')

// El arranque REAL, una sola vez. Si lanzara, el fichero entero falla aquí.
await import('../../app/main.js')

const q = (sel) => document.querySelector(sel)

describe('app/main · arranca SIN NADA precargado', () => {
  it('⭐ el arranque NO lanza y monta la aplicación entera', () => {
    // La forma de esta prueba es deliberada: el defecto real no fue una parcela
    // mal pintada, fue que `app/main.js` reventaba en el paso 1 y **no montaba
    // nada**, con la consola limpia. Se comprueban tres piezas de tres pasos
    // distintos del ensamblaje (3, 5 y 14): si el arranque se hubiera caído a
    // medias, alguna faltaría.
    expect(q('.gml-dialogo-avisos'), 'paso 3: el canal de avisos').not.toBeNull()
    expect(arranque.opciones, 'paso 5: el visor').not.toBeNull()
    expect(document.querySelectorAll('.gml-rail-pasos li').length, 'paso 14: el rail').toBe(
      Object.keys(PASO).length,
    )
  })

  it('⭐ el store de parcela nace VACÍO', () => {
    // Se lee lo que VIO el visor al montarse, que es el store de verdad de la
    // aplicación y no una copia: `crearVisor` lo recibe por `opciones.estado`.
    expect(arranque.estadoAlMontar).toBeNull()
    expect(arranque.opciones.estado.get()).toBeNull()
  })

  it('⛔ el visor recibe `vistaInicial`, o la aplicación no arranca', () => {
    // `viewer/index.js#encuadrar` LANZA sin geometría y sin `vistaInicial`. Con
    // el store vacío ésa es la rama normal, así que esta opción pasó de ser un
    // extra a ser un requisito del arranque. Se comprueba la FORMA, que es lo que
    // el visor valida: `{centro:[lat,lon], zoom}`.
    const vista = arranque.opciones.vistaInicial
    expect(vista, 'sin esto `crearVisor` lanza y no arranca nada').toBeDefined()
    expect(Array.isArray(vista.centro)).toBe(true)
    expect(vista.centro).toHaveLength(2)
    for (const n of vista.centro) expect(Number.isFinite(n)).toBe(true)
    expect(Number.isFinite(vista.zoom)).toBe(true)
    // España entera: la decisión del autor. Se comprueba el ENCUADRE, no las
    // cifras exactas —afinar el centro no puede poner roja una prueba—, pero sí
    // que sigue mirando a la península y no a un punto cualquiera.
    const [lat, lon] = vista.centro
    expect(lat, 'el centro se ha ido de la península en latitud').toBeGreaterThan(35)
    expect(lat).toBeLessThan(44)
    expect(lon, 'el centro se ha ido de la península en longitud').toBeGreaterThan(-10)
    expect(lon).toBeLessThan(4)
    expect(vista.zoom, 'un zoom de país, no de parcela').toBeLessThanOrEqual(8)
  })

  it('⛔ el eyebrow NO dice «Parcela de demostración» sobre un store vacío', () => {
    // Es el fallo silencioso que este cambio podía introducir, y no es teórico:
    // hasta hoy `rotuloDelDato(null)` caía a «Parcela de demostración», que era
    // el lado conservador **mientras siempre hubiera una demo dentro**. Sin ella,
    // esa frase inventa un dato — en el rótulo que existe para declarar de dónde
    // viene el dato.
    const eyebrow = q('[data-eyebrow]').textContent.trim()
    expect(eyebrow).not.toMatch(/demostraci[oó]n/i)
    expect(eyebrow).not.toMatch(/Catastro/i)
    expect(eyebrow.length, 'un rótulo vacío no dice nada; tiene que DECIR que no hay').toBeGreaterThan(0)
  })

  // ── Los dos indicadores de qué hay cargado (2026-08-08) ───────────────────

  it('⭐ los dos indicadores dicen que NO hay nada, con palabras y no solo con color', () => {
    // Existen porque desde que hay dos puertas hay dos geometrías que pueden estar
    // o no estar por separado, y de eso depende qué se va a generar. Un indicador
    // que solo cambiara de COLOR sería invisible para quien no distingue esos dos
    // colores, justo sobre el dato que se acaba firmando.
    const medicion = q('[data-capa="medicion"]')
    const oficial = q('[data-capa="oficial"]')

    expect(medicion.dataset.presente).toBe('false')
    expect(oficial.dataset.presente).toBe('false')
    expect(medicion.textContent.trim()).toBe('Sin levantamiento')
    expect(oficial.textContent.trim()).toBe('Sin parcelario')
  })

  it('⭐ y se encienden por SEPARADO: cuatro estados, no dos', () => {
    const estado = arranque.opciones.estado
    const medicion = q('[data-capa="medicion"]')
    const oficial = q('[data-capa="oficial"]')
    const anillo = [
      [439300, 4479650],
      [439310, 4479650],
      [439310, 4479660],
      [439300, 4479660],
    ]
    const conGeometria = (conOficial) =>
      crearParcela({
        idLocal: 'mi-levantamiento',
        origen: ORIGEN_PARCELA.DXF,
        recintos: [crearRecinto(anillo, TIPO_RECINTO.EXTERIOR)],
        geometriaOficial: conOficial ? [crearRecinto(anillo, TIPO_RECINTO.EXTERIOR)] : null,
      })

    // El store de este fichero es del ARRANQUE REAL y lo comparten todas las
    // pruebas: se devuelve a `null` pase lo que pase, o un fallo aquí pondría rojas
    // a las de después por un motivo que no es el suyo.
    try {
      // Solo levantamiento: el estado del .dxf recién importado.
      estado.set(conGeometria(false))
      expect(medicion.dataset.presente).toBe('true')
      expect(medicion.textContent.trim()).toBe('Levantamiento')
      expect(oficial.dataset.presente).toBe('false')

      // Y con el parcelario de fondo encima: los dos, que es lo que deja la puerta 2.
      estado.set(conGeometria(true))
      expect(medicion.dataset.presente).toBe('true')
      expect(oficial.dataset.presente).toBe('true')
      expect(oficial.textContent.trim()).toBe('Parcelario del Catastro')
    } finally {
      estado.set(null)
    }

    expect(medicion.dataset.presente).toBe('false')
    expect(oficial.dataset.presente).toBe('false')
  })

  it('⛔ INFORMAN, no controlan: no son botones ni llevan `data-accion`', () => {
    // Es la línea del alcance. El día que se conviertan en selectores de capa
    // activa, esta feature se ha desbordado hacia el sistema general de capas —que
    // está fuera a propósito— y esta prueba es donde se entera.
    for (const sel of ['[data-capa="medicion"]', '[data-capa="oficial"]']) {
      const nodo = q(sel)
      expect(nodo.tagName).toBe('SPAN')
      expect(nodo.dataset.accion).toBeUndefined()
      expect(nodo.closest('button')).toBeNull()
    }
  })

  it('el marcado de `index.html` tampoco miente durante el instante previo', () => {
    // Lo que se ve ANTES de que corra el JavaScript. Decía «Parcela cargada», que
    // era verdad un segundo después mientras la app arrancaba con la demo dentro
    // y es falso desde que arranca vacía. No es cosmética: es la primera línea de
    // la pantalla.
    const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
    const encontrado = /<p class="gml-eyebrow" data-eyebrow>([^<]*)<\/p>/i.exec(html)
    expect(encontrado, 'ha cambiado el marcado del eyebrow en index.html').not.toBeNull()
    expect(encontrado[1].trim()).not.toMatch(/cargada/i)
  })

  it('se aterriza en Entrada y en la rama PARCELA', () => {
    // Sin parcela no hay nada que validar, editar ni diagnosticar: el único paso
    // que tiene sentido es el primero. Lo decide `app/navegacion.js` con los
    // hechos que le da `main.js`; aquí solo se comprueba que el arranque vacío no
    // deja la aplicación en un paso al que no se puede ir.
    expect(document.body.dataset.paso).toBe(PASO.ENTRADA)
    expect(document.body.dataset.rama).toBe(RAMA.PARCELA)
  })

  it('los peldaños que necesitan parcela están apagados Y dicen por qué', () => {
    // Regla de oro 1 aplicada al rail: un peldaño apagado y mudo deja al usuario
    // pulsando algo que no responde. Con la app arrancando vacía esto pasa de ser
    // un caso raro a ser lo primero que se ve.
    for (const paso of [PASO.EDICION, PASO.DIAGNOSTICO]) {
      const li = q(`[data-paso="${paso}"]`)
      const boton = li?.querySelector('button')
      expect(boton, `el rail no tiene el peldaño «${paso}»`).not.toBeNull()
      expect(boton.disabled, `«${paso}» tendría que estar apagado sin parcela`).toBe(true)
      // El motivo vive en `.gml-rail-motivo`, DENTRO del botón. No vale restar
      // textos: el `textContent` del botón ya lo lleva incluido.
      const motivo = li.querySelector('.gml-rail-motivo')
      expect(motivo, `«${paso}» está apagado y MUDO: no tiene .gml-rail-motivo`).not.toBeNull()
      expect(motivo.textContent.trim().length, `«${paso}» tiene el motivo VACÍO`).toBeGreaterThan(0)
    }
  })

  it('⛔ el arranque en vacío NO consulta la red', () => {
    // Una aplicación que arranca sin datos no tiene a quién preguntar por ellos.
    // Si esto se rompe, es que alguien ha metido una carga automática — y el
    // autor pidió exactamente lo contrario.
    expect(arranque.peticiones).toEqual([])
  })

  it('el arranque en vacío no produce ni un ERROR, y no se queja de la carga', () => {
    // ⚠️ **NO se afirma «cero avisos», y hay que decir por qué o el número de
    // arriba parecería un despiste.** En jsdom no hay IndexedDB, así que
    // `storage/` avisa —con razón— de que no se podrá guardar entre sesiones:
    // dos tarjetas de nivel AVISO que son del ENTORNO DE PRUEBA, no del producto.
    // Medido en Chrome el mismo día con la aplicación recién abierta: **0 errores
    // y 0 avisos**. Afirmar aquí un cero que solo es cierto fuera de aquí sería
    // atar esta prueba a que el arnés nunca cambie.
    //
    // Lo que sí es del producto y sí se afirma: **ni un ERROR**, y **ningún aviso
    // que hable de cargar datos**. Un arranque que no carga nada no tiene de qué
    // quejarse sobre la carga.
    expect(q('.gml-chip[data-contador="ERROR"]').textContent).toBe('0 errores')

    const textos = [...document.querySelectorAll('#avisos .gml-aviso')].map((t) => ({
      nivel: t.dataset.nivel,
      texto: t.querySelector('.gml-aviso-texto').textContent,
    }))
    expect(textos.filter((a) => a.nivel === 'ERROR')).toEqual([])
    for (const { texto } of textos) {
      expect(texto, `un aviso del arranque habla de la parcela: «${texto.slice(0, 60)}…»`).not.toMatch(
        /parcela|recinto|v[eé]rtice|geometr[ií]a/i,
      )
    }
  })
})

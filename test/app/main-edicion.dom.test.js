/* -------------------------------------------------------------------------- *
 * test/app/main-edicion.dom.test.js — F06 · T5.1 · la edición, cableada        *
 *                                                                              *
 * `edit/` (historial, métricas, snap, offset, vértices) y `viewer/edicion.js`   *
 * están terminados y probados; mientras nadie los enchufe a la pantalla, toda   *
 * F06 es código muerto. El cableado de este fichero es lo que la convierte en   *
 * producto, y son los criterios de aceptación **4** (superficie / perímetro /   *
 * Δcatastral durante el arrastre) y **5** (undo/redo revierten operaciones      *
 * completas) los que se juegan aquí.                                            *
 *                                                                              *
 * ── QUÉ SE PRUEBA AQUÍ, Y QUÉ NO ──                                            *
 * NO se vuelven a probar el historial (`test/edit/historial.test.js`), las      *
 * métricas (`test/edit/metricas.test.js`), el offset, el snap ni la interacción *
 * del mapa (`test/viewer/edicion.dom.test.js`). Se prueba el CABLE: que la pila *
 * nazca SEMBRADA, que los botones y los atajos la sigan, que los atajos se      *
 * callen dentro de un campo de texto, que undo/redo NO ensucien la pila, que la *
 * ficha se repinte por el canal en vivo y por el del store con la MISMA         *
 * función, y que las colindantes lleguen APLANADAS a las dianas del enganche    *
 * y SIN APLANAR a la capa que las dibuja — dos formas del mismo resultado, dos  *
 * consumidores, y un reparto que no se puede unificar sin romper una de las dos.*
 *                                                                              *
 * ── Y DESDE F07 · T5.1, TRES HECHOS DEL ARRANQUE QUE SOLO SE VEN AQUÍ ──       *
 * El diagnóstico tiene su propia suite completa (`diagnostico.dom.test.js`),    *
 * pero hay cosas que no son de ninguna función sino del ORDEN del arranque: con *
 * qué opciones se monta el visor y cómo nace el CTA del pie. El único sitio que *
 * las tiene capturadas es este fichero, por el doble de la decisión 3 y su      *
 * `arranque.opciones`. Un fichero nuevo duplicaría todo este arnés para tres    *
 * afirmaciones.                                                                *
 *                                                                              *
 * ── DECISIÓN 1 · DOS NIVELES, Y LOS DOS HACEN FALTA ──                         *
 *   · **El ENSAMBLAJE real** — se importa `app/main.js` una vez, con la cáscara *
 *     de `index.html` ya montada, y se afirma sobre lo que quedó cableado. Es   *
 *     la única forma de comprobar cosas que no son de ninguna función sino del  *
 *     ORDEN del arranque: que el visor se monta con edición, que la pila que    *
 *     recibe está sembrada, y que el canal en vivo llega a la ficha.            *
 *     ⚠️ Los nodos del arranque se capturan ANTES de que ningún `beforeEach`    *
 *     remonte la cáscara. Siguen siendo los que `app/main.js` tiene en la mano  *
 *     —aunque queden fuera del documento— y un nodo desprendido conserva su     *
 *     `textContent`: por eso estas afirmaciones siguen valiendo después.        *
 *   · **`cablearEdicion` a pelo** — con su propio store, su propia pila y un    *
 *     doble de `visor.edicion`, para poder poner el sistema en estados que el   *
 *     arranque no alcanza (una pila con historia, un lado seleccionado, una     *
 *     consulta de colindantes que responde).                                    *
 *                                                                              *
 * ── DECISIÓN 2 · EL MARCADO SE LEE DE SU FUENTE, NO SE COPIA ──                *
 * Igual que en `main-gml.dom.test.js` y por lo mismo: el marcado es CONTRATO    *
 * (los `data-accion`, los `data-campo`, el `disabled` con el que nacen los      *
 * tres botones, el `20` en centímetros del campo de tolerancia). Una copia a    *
 * mano podría quedarse en verde con la fuente ya rota.                          *
 *                                                                              *
 * ⚠️ Desde el traslado de F06 esa fuente son DOS. La cáscara —el panel, la      *
 * ficha, el botón «Generar GML»— se lee del `<body>` de `index.html`; los       *
 * SIETE nodos de las herramientas de edición ya no están ahí: los fabrica       *
 * `viewer/barra-edicion.js` en una barra flotante sobre el mapa, y quien la     *
 * monta es `crearVisor`. Aquí se montan las dos, y en ese orden.                *
 *                                                                              *
 * ── DECISIÓN 3 · SE DOBLA `viewer/index.js`, Y NADA MÁS ──                     *
 * `crearVisor` monta un `L.Map` real, y nada de eso tiene que ver con cablear   *
 * un botón. El doble CAPTURA sus opciones —de ahí salen el store, la pila y el  *
 * canal `alPrevisualizar` del ensamblaje— y devuelve una `edicion` de mentira   *
 * que registra lo que le piden. Todo lo demás (el store, el panel, el           *
 * historial, las métricas) es REAL.                                             *
 *                                                                              *
 * ⚠️ Y desde el traslado, `crearVisor` tiene un SEGUNDO efecto sobre el         *
 * documento: monta la barra, o sea los siete nodos que `cablearEdicion` busca   *
 * por selector. El doble tiene que reproducirlo, o estaría doblando algo        *
 * distinto de lo que hace el original —y `cablearEdicion` lanzaría en el        *
 * `[data-accion="deshacer"]` que nadie habría creado—. Se reproduce llamando    *
 * a `crearBarraEdicion` DE VERDAD, sobre un `L.Map` del arnés compartido        *
 * (`test/viewer/_ayuda-jsdom.js#montarMapa`), y NO inyectando una copia del     *
 * marcado: una copia sería una segunda redacción de esos siete nodos, que se    *
 * desincroniza en silencio del módulo que los fabrica —este repo ya tiene esa   *
 * cicatriz en `viewer/_comun.js#validarVistaInicial`, un validador duplicado    *
 * que ya había divergido— y que además dejaría estas pruebas ciegas a un        *
 * cambio de contrato de la barra. Con la barra de verdad, si cambia, se         *
 * enteran aquí. Lo que la decisión 3 se sigue ahorrando es todo lo demás del    *
 * visor: capas, WMS, tabla, sincronización y encuadre.                          *
 *                                                                              *
 * ⚠️ Desde F07 ese segundo efecto son TRES piezas: la barra, el CAJÓN del       *
 * diagnóstico y su CAPA DE CONTRASTE. Las tres se montan de verdad, y por el    *
 * mismo argumento: `cablearDiagnostico` comprueba por duck typing los diez      *
 * métodos del cajón y los dos de la capa antes de cablear nada, así que un      *
 * doble escrito a mano sería otra segunda redacción — y este fichero no         *
 * recolectaría ni un test el día que a esas dos APIs les cambie una firma.      *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { crearDialogoAvisos } from '../../app/dialogo-avisos.js'
import { SRS_DEMO, parcelaDemo } from '../../app/demo-datos.js'
import { OPERATIVOS } from '../../config/operativos.js'
import {
  commit,
  crearHistorial,
  puedeDeshacer,
  puedeRehacer,
  // ⚠️ La API de la pila se llama `undo`/`redo`; los `deshacer`/`rehacer` de este
  // fichero son los BOTONES que devuelve `cablear(...)`. Se importan con alias para
  // que los dos nombres no se crucen: dos cosas distintas con el mismo nombre en el
  // mismo fichero es como se cuela un test que pasa midiendo otra.
  undo as deshacerPila,
  redo as rehacerPila,
} from '../../edit/historial.js'
import { metricas } from '../../edit/metricas.js'
import { husoPorSrs } from '../../geo/huso.js'
import { crearParcela, crearRecinto, ORIGEN_PARCELA, TIPO_RECINTO } from '../../model/parcela.js'
import { NIVEL, crearEstadoVista } from '../../viewer/_comun.js'
import { CLASE_BARRA, crearBarraEdicion } from '../../viewer/barra-edicion.js'
import { crearCajonComprobacion } from '../../viewer/cajon-comprobacion.js'
import { crearCajonDiagnostico } from '../../viewer/cajon-diagnostico.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearListaSobrante } from '../../viewer/lista-sobrante.js'
import { VARIANTE, crearCapaPiezas } from '../../viewer/piezas.js'
import { crearSenalMiembro } from '../../viewer/senal-miembro.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

// ── EL CROMO DEL MAPA: el segundo efecto de `crearVisor` sobre el documento ──

/** Cómo desmontar el cromo vivo ahora mismo (y su mapa), o `null` si no hay. */
let desmontarCromoVivo = null

/** El `L.Map` del arnés, vivo. F11: lo consume `viewer/partes.js` (ver abajo). */
let mapaVivo = null

/** El cajón y la capa de F07 vivos, para que el doble los entregue. */
let diagnosticoVivo = null

/**
 * La barra de edición VIVA. Se montaba desde F06 —`cablearEdicion` lanza sin sus
 * siete nodos— pero no se guardaba, porque hasta F18 ninguna prueba de este fichero
 * le pedía nada. «Dibujar recinto» sí: es la única herramienta que se ESCONDE, y
 * comprobarlo sobre un doble sería comprobar el doble.
 */
let barraViva = null

/** El cajón de F08 vivo, ídem. Va SUELTO, como en el visor real. */
let comprobacionViva = null

/** La lista y la capa de F17 vivas. Van JUNTAS, como en el visor real. */
let sobranteVivo = null

/**
 * Pone en el documento lo que `crearVisor` monta SOBRE EL MAPA cuando la edición y
 * el diagnóstico están activos, **con los módulos que lo fabrican en producción y
 * no con copias** (decisión 3):
 *
 *   · los SIETE nodos de las herramientas de edición (`crearBarraEdicion`). Sin
 *     ellos `cablearEdicion` lanza al buscar `[data-accion="deshacer"]`.
 *   · el CAJÓN y la CAPA DE CONTRASTE de F07 (`crearCajonDiagnostico` +
 *     `crearContraste`). Sin ellos `cablearDiagnostico` lanza: comprueba por duck
 *     typing los diez métodos del cajón y los dos de la capa, así que un doble
 *     escrito a mano sería una segunda redacción de esas dos APIs que se
 *     desincroniza en silencio.
 *   · el CAJÓN DE COMPROBACIÓN de F08 (`crearCajonComprobacion`), por lo mismo:
 *     `cablearComprobacion` —paso 9 del ensamblaje, también fuera del `try` del
 *     Catastro— comprueba por duck typing los siete métodos que le pide.
 *
 * Hay que repetirlo en cada `beforeEach`, porque {@link montarCascara} vacía el
 * `<body>` y se lleva por delante el contenedor del mapa, que es donde vive todo
 * esto.
 *
 * IDEMPOTENTE en el sentido que hace falta: desmonta lo anterior antes de montar lo
 * siguiente. Sin eso quedarían dos barras (o sea, los siete nodos por duplicado,
 * que es justo el fallo que G16 vigila en `index.html`), dos cajones y una pila de
 * oyentes de `document` sobre controles ya muertos.
 */
function montarCromoDelMapa() {
  desmontarCromoDelMapa()
  const { mapa, destruir: destruirMapa } = montarMapa()
  crearPanes(mapa)
  const barra = crearBarraEdicion({ mapa })
  const cajon = crearCajonDiagnostico({ mapa })
  // El huso se DERIVA del SRS del expediente con la misma función que usa la app;
  // escribir «30» aquí sería una tercera copia de ese dato.
  const contraste = crearContraste({ mapa, zona: husoPorSrs(SRS_DEMO) })
  const cajonComprobacion = crearCajonComprobacion({ mapa })
  // F17: las dos piezas del sobrante, DE VERDAD (ver el doble).
  const listaSobrante = crearListaSobrante({ documento: document })
  const capaPiezas = crearCapaPiezas({ mapa, zona: husoPorSrs(SRS_DEMO) })
  const capaFuera = crearCapaPiezas({
    mapa,
    zona: husoPorSrs(SRS_DEMO),
    variante: VARIANTE.FUERA,
  })
  const capaVecinos = crearCapaPiezas({
    mapa,
    zona: husoPorSrs(SRS_DEMO),
    variante: VARIANTE.VECINO,
  })
  // ⚠️ F11: el `L.Map` DE VERDAD se guarda y va al doble. Hasta aquí el
  // `visor.mapa` era `{on, off}` —lo justo que consume `cablearCatastro` por duck
  // typing—, y desde F11 hay un segundo consumidor, `viewer/partes.js`, que
  // necesita `addLayer`/`removeLayer`/`getPane` para pintar las huellas.
  mapaVivo = mapa
  barraViva = barra
  diagnosticoVivo = { cajon, contraste }
  comprobacionViva = cajonComprobacion
  const senalMiembro = crearSenalMiembro({ mapa, zona: husoPorSrs(SRS_DEMO) })
  sobranteVivo = {
    lista: listaSobrante,
    capa: capaPiezas,
    capaFuera,
    capaVecinos,
    senal: senalMiembro,
  }
  desmontarCromoVivo = () => {
    senalMiembro.destruir()
    capaPiezas.destruir()
    listaSobrante.destruir()
    cajonComprobacion.destruir()
    contraste.destruir()
    cajon.destruir()
    barra.destruir()
    destruirMapa()
    mapaVivo = null
    barraViva = null
    diagnosticoVivo = null
    comprobacionViva = null
    sobranteVivo = null
  }
}

/** Quita el cromo vivo y su mapa. No hace nada si no hay ninguno. */
function desmontarCromoDelMapa() {
  if (desmontarCromoVivo === null) return
  const desmontar = desmontarCromoVivo
  desmontarCromoVivo = null
  desmontar()
}

// ── El doble de `crearVisor`, que además es el sensor del ensamblaje ─────────

/**
 * `vi.mock` se IZA por encima de todo, así que su fábrica no puede leer un
 * `const` de este módulo (zona muerta). `vi.hoisted` es la vía oficial para
 * compartir un objeto con ella.
 */
const arranque = vi.hoisted(() => ({
  /** Opciones con las que `app/main.js` montó el visor. */
  opciones: null,
  /** Opciones con las que `app/main.js` cableó el Catastro. */
  catastro: null,
  /**
   * Los oyentes de colindantes que `app/main.js` ha registrado en el cableado.
   * Desde F07 eran DOS —el del snap de F06 y el del diagnóstico— y desde que las
   * vecinas por fin se DIBUJAN son TRES. Ver el doble.
   */
  oyentesColindantes: new Set(),
  /** Lo que se le ha pedido a los dobles de `visor.edicion` y `visor.colindantes`. */
  registro: {
    snapActivo: [],
    tolerancia: [],
    colindantes: [],
    desplazamientos: [],
    /** Cada llamada a `visor.colindantes.pintar`, con su argumento tal cual. */
    pintadas: [],
    /** Cuántas veces se ha llamado a `visor.colindantes.limpiar`. */
    limpiezas: 0,
    /** Cada `visor.puntosLevantamiento.pintar`, con su argumento tal cual. */
    puntosPintados: [],
    /** Cada `visor.edicion.fijarPuntos`, ídem. Tienen que ir SIEMPRE en pareja. */
    puntosFijados: [],
  },
}))

vi.mock('../../viewer/index.js', async (importarOriginal) => ({
  // ⚠️ F11: se PARTE del módulo real y solo se sustituye `crearVisor`. Antes el
  // doble era un objeto literal con una sola clave, y eso convertía cualquier
  // export NUEVO del visor en un fallo de importación de este fichero — que es lo
  // que pasó al exportar `encuadrarSobreRecintos` (T1.5), que consume
  // `app/cableado-edificio.js`. Con `importOriginal` el doble es exactamente lo
  // que dice ser: el visor real con el montaje sustituido.
  ...(await importarOriginal()),
  crearVisor: (_contenedor, opciones) => {
    arranque.opciones = opciones
    // El segundo efecto del original sobre el documento: si el doble no lo
    // reprodujera, `cablearEdicion` lanzaría al buscar `[data-accion="deshacer"]`
    // y este fichero no recolectaría ni un test. Ver la decisión 3. Desde F07 monta
    // además el cajón y la capa del diagnóstico, por lo mismo.
    montarCromoDelMapa()
    let tau = opciones.edicion && opciones.edicion.tolerancia
    return {
      mapa: mapaVivo,
      estado: opciones.estado,
      capas: {},
      acotaciones: null,
      edicion: {
        snapActivo(valor) {
          if (valor !== undefined) arranque.registro.snapActivo.push(valor)
          return true
        },
        tolerancia(metros) {
          if (metros !== undefined) {
            arranque.registro.tolerancia.push(metros)
            tau = metros
          }
          return tau
        },
        ladoSeleccionado: () => null,
        alCambiarSeleccion: () => () => {},
        modoBorrar: () => false,
        alCambiarModoBorrar: () => () => {},
        // El modo insertar (2026-08-18): gemelo del de arriba, y por lo mismo.
        modoInsertar: () => false,
        alCambiarModoInsertar: () => () => {},
        fijarPuntos(puntos) {
          arranque.registro.puntosFijados.push(puntos)
        },
        fijarColindantes(recintos) {
          arranque.registro.colindantes.push(recintos)
        },
        desplazarSeleccion(distancia) {
          arranque.registro.desplazamientos.push(distancia)
          return { aplicado: false, modo: null, detecciones: [] }
        },
      },
      // La capa de PARCELAS VECINAS. Se DOBLA —al revés que el cajón de F07— por
      // el mismo criterio que `edicion`: `app/main.js` no le hace duck typing, solo
      // la LLAMA, y lo que aquí se prueba es CON QUÉ la llama (parcelas sin
      // aplanar, no los recintos que recibe el snap). Lo que la capa hace con eso
      // —contornos, emergentes, panes— vive en `test/viewer/colindantes.dom.test.js`
      // y su montaje, en `test/viewer/index.dom.test.js`.
      colindantes: {
        pintar(vecinas) {
          arranque.registro.pintadas.push(vecinas)
        },
        limpiar() {
          arranque.registro.limpiezas++
        },
        destruir() {},
      },
      // ⭐ (2026-08-19) La capa de puntos sueltos. Se dobla por el mismo criterio
      // que `colindantes`: aquí se prueba CON QUÉ la llama `app/main.js`; lo que
      // la capa hace con eso vive en `test/viewer/puntos-levantamiento.dom.test.js`.
      puntosLevantamiento: {
        pintar(puntos) {
          arranque.registro.puntosPintados.push(puntos)
        },
        limpiar() {},
        destruir() {},
      },
      // ⭐ (2026-08-19) La barra del mapa, LA DE VERDAD —la acaba de montar
      // `montarCromoDelMapa`—, y no un doble: `app/main.js` le empuja la cuenta de
      // puntos con `puntosVisible(n)` y lo que se quiere vigilar es que ese número
      // llegue A LA BARRA QUE EL USUARIO VE, no a un objeto escrito aquí que diría
      // que sí a cualquier cosa. Es el mismo criterio que el cajón de F07.
      barraEdicion: barraViva,
      // Las dos piezas de F07, LAS DE VERDAD (las ha montado `montarCromoDelMapa`
      // sobre un `L.Map` real). No se doblan por lo mismo que la barra: el cableado
      // del diagnóstico comprueba los diez métodos del cajón por duck typing, así
      // que un doble escrito a mano sería una segunda redacción de esa API.
      diagnostico: diagnosticoVivo,
      // La de F08, ídem, y SUELTA como en el visor real (`visor.comprobacion`, no
      // `visor.comprobacion.cajon`): F07 son dos piezas inseparables y F08 es una.
      comprobacion: comprobacionViva,
      // Y las de F17, ídem: `cablearDerivacion` hace duck typing de once métodos
      // de la lista y cuatro de la capa, y va fuera de todo `try`.
      sobrante: sobranteVivo,
      destruir() {},
    }
  },
}))

// ── El doble de `cablearCatastro`, que es el otro extremo del cable ──────────
//
// Se dobla SOLO la función de cableado (sus selectores y el resto del módulo se
// dejan pasar con `importOriginal`, porque `app/main.js` los usa en su `catch`).
// Doblarlo aquí compra dos cosas que el módulo real no puede dar:
//   · llegar a los DOS GANCHOS de F06 (`alCargarParcela` y el oyente de
//     colindantes) sin una consulta real al WFS, y
//   · ejercitar el PUENTE del arranque —`if (typeof catastro.alColindantes ===
//     'function')`— con un cableado que sí lo publica.
// El cableado de verdad tiene su propia suite (`test/app/catastro.dom.test.js`)
// y además se ejercita entero en `main-gml.dom.test.js`, que no lo dobla.
//
// ⚠️ `alColindantes` guarda los oyentes en un SET, como el módulo real, y no en una
// variable suelta. Lo hacía —`arranque.alColindantes = fn`— y desde F07 dejó de
// valer: hay DOS suscriptores (el snap de F06 y el diagnóstico), así que la
// variable se quedaba con el segundo y `arranque.alColindantes(...)` publicaba a
// uno solo. Es exactamente el fallo contra el que avisa el JSDoc del módulo real
// («un `alColindantes = fn` desengancharía al primero en silencio»), cometido en su
// propio doble. Se publica con {@link publicarColindantes}, que avisa a los dos.
vi.mock('../../app/cableado-catastro.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    cablearCatastro: (opciones) => {
      arranque.catastro = opciones
      return {
        cargar: async () => null,
        deducir: async () => null,
        colindantes: async () => null,
        alColindantes(fn) {
          arranque.oyentesColindantes.add(fn)
          return () => arranque.oyentesColindantes.delete(fn)
        },
        destruir() {},
      }
    },
  }
})

/** Publica un resultado de colindantes a TODOS los suscriptores, como el real. */
const publicarColindantes = (resultado) => {
  expect(
    arranque.oyentesColindantes.size,
    'nadie se ha suscrito a alColindantes: el puente del arranque no se ha montado',
  ).toBeGreaterThan(0)
  for (const fn of arranque.oyentesColindantes) fn(resultado)
}

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')

const CASCARA_INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body([^>]*)>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/main-edicion.dom.test.js: no se ha encontrado el <body> de index.html. La ' +
        'cáscara de estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  const clase = /class="([^"]*)"/i.exec(encontrado[1])
  // ⚠️ TODOS los atributos de la etiqueta de apertura, no solo la clase.
  // `innerHTML` copia lo de DENTRO del <body> y nada de su etiqueta, así que lo
  // que lleve puesto el <body> real hay que reponerlo a mano. Hasta el rework de
  // UI bastaba con `class` (`app/rama.js` LANZA sin `.gml-app`); desde T6 el
  // <body> lleva además `data-app="cascara"`, que es el gancho de
  // `app/pantalla.js`, y sin él el arranque entero revienta. Se copian todos para
  // que el próximo atributo que aparezca no vuelva a romper estos cuatro ficheros.
  const atributos = [...encontrado[1].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map(([, n, v]) => [
    n,
    v,
  ])
  return { clase: clase === null ? '' : clase[1], atributos, cuerpo: encontrado[2] }
})()

const CUERPO_INDEX = CASCARA_INDEX.cuerpo

/**
 * Monta la cáscara real en el documento del test.
 *
 * ⚠️ Se lleva por delante TODO lo que hubiera en el `<body>`, incluida la barra
 * de edición (que vive dentro del contenedor del mapa). Quien la use en un
 * `beforeEach` tiene que volver a montarla: ver {@link montarCromoDelMapa}.
 *
 * ⚠️ **Y repone la CLASE del `<body>`, que hasta F11 se perdía.** El `innerHTML`
 * copia lo de DENTRO del `<body>` y nada de su etiqueta de apertura, así que la
 * cáscara venía sin `gml-app`. Daba igual hasta que dejó de darlo: `app/rama.js`
 * resuelve `.gml-app` para colgar ahí el `data-rama` y **LANZA** si no está — un
 * contrato del programador legítimo, porque la clase está en `index.html` desde F03.
 */
function montarCascara() {
  document.body.className = CASCARA_INDEX.clase
  for (const [nombre, valor] of CASCARA_INDEX.atributos) {
    document.body.setAttribute(nombre, valor)
  }
  document.body.innerHTML = CUERPO_INDEX
}

// La cáscara TIENE que existir antes de importar `app/main.js`: su código de
// nivel superior busca los nodos con `nodo(...)`, que LANZA si falta alguno. La
// BARRA no se monta aquí a propósito: en producción la monta `crearVisor`, o sea
// el import de la línea siguiente, y este fichero reproduce ese orden.
montarCascara()

// ⭐ **`?demo=real` ES OBLIGATORIO DESDE EL 2026-08-07**, y va ANTES del import.
// Ese día la aplicación dejó de arrancar con la parcela de demostración dentro
// (petición del autor: «que empiece sin nada precargado») y el store nace `null`.
// Este fichero mide la EDICIÓN y la ficha del pie sobre geometría real, así que
// sin esta línea no está probando de menos: está probando otra cosa —14 casos
// caían con `Cannot read properties of null`—.
//
// `history.replaceState` y no `location.search = …`: en jsdom la asignación
// directa intenta navegar y no llega a ninguna parte. Y va antes del `import`
// porque `app/main.js` lee la query **en su código de nivel superior**: puesta
// después, el módulo ya habría decidido arrancar vacío.
window.history.replaceState({}, '', '?demo=real')

const {
  cablearEdicion,
  cablearGeneracionGml,
  SELECTOR_BOTON_DESHACER,
  SELECTOR_BOTON_REHACER,
  SELECTOR_CAMPO_SNAP,
  SELECTOR_CAMPO_TOLERANCIA,
  SELECTOR_CAMPO_OFFSET,
  SELECTOR_BOTON_OFFSET,
  SELECTOR_BOTON_BORRAR,
  SELECTOR_ESTADO_EDICION,
  SELECTOR_BOTON_GML,
  MENSAJE_SIN_PUNTOS_QUE_QUITAR,
  mensajePuntosQuitados,
  quitarPuntosLevantamiento,
} = await import('../../app/main.js')

/**
 * Los nodos que `app/main.js` capturó AL ARRANCAR. Se guardan ahora, antes de
 * que el primer `beforeEach` remonte la cáscara: a partir de ese momento el
 * documento tiene otros, pero estos siguen siendo los que el ensamblaje escribe
 * (y un nodo desprendido conserva su `textContent`).
 */
const DEL_ARRANQUE = Object.freeze({
  superficie: document.querySelector('[data-ficha="superficie"]'),
  perimetro: document.querySelector('[data-ficha="perimetro"]'),
  delta: document.querySelector('[data-ficha="delta-catastral"]'),
  vertices: document.querySelector('[data-ficha="vertices"]'),
  colindantes: document.querySelector('[data-ficha="colindantes"]'),
  tolerancia: document.querySelector(SELECTOR_CAMPO_TOLERANCIA),
  snap: document.querySelector(SELECTOR_CAMPO_SNAP),
  // F07 · el CTA del pie y su renglón. Se capturan aquí por lo mismo que el resto.
  botonDiagnosticar: document.querySelector('[data-accion="diagnosticar"]'),
  estadoDiagnosticar: document.querySelector('[data-estado="diagnosticar"]'),
  // ⭐ F24 · «Quitar los puntos». Se captura AQUÍ y no dentro del test por el
  // motivo de siempre, pero agravado: este botón no está en `index.html`, lo
  // fabrica `viewer/barra-edicion.js` cuando `crearVisor` monta la barra —o sea
  // durante el `import` de arriba—, y es a ESE nodo al que el ensamblaje le colgó
  // su oyente. Cada `montar()` posterior rehace la barra entera, así que un
  // `querySelector` desde un `it()` devolvería un botón NUEVO y mudo, y el test
  // pasaría en verde midiendo un clic que no llega a ninguna parte.
  botonQuitarPuntos: document.querySelector('[data-accion="quitar-puntos"]'),
  // Y el panel de avisos SOBRE EL QUE ESCRIBE el ensamblaje. `crearDialogoAvisos`
  // se quedó con los nodos de la cáscara de entonces; el `#avisos` que devuelve un
  // `querySelector` desde un `it()` es el de la cáscara remontada, y está mudo.
  avisos: document.querySelector('#avisos'),
})

/** El store REAL del ensamblaje (el mismo objeto que comparten las tres vistas). */
const estadoDelArranque = arranque.opciones.estado
/** La pila REAL del ensamblaje. */
const historialDelArranque = arranque.opciones.historial
/** El canal en vivo que `app/main.js` le entregó al visor. */
const previsualizarDelArranque = arranque.opciones.alPrevisualizar

// ── Datos ────────────────────────────────────────────────────────────────────

/** Cuadrado de 10 × 10 m con un hueco de 2 × 2 m. Superficie neta: 96 m². */
function parcelaConHueco({ superficieCatastral = null } = {}) {
  return crearParcela({
    idLocal: 'prueba-hueco',
    refcat: null,
    origen: ORIGEN_PARCELA.LIST,
    superficieCatastral,
    recintos: [
      crearRecinto(
        [
          [439300, 4479650],
          [439310, 4479650],
          [439310, 4479660],
          [439300, 4479660],
        ],
        TIPO_RECINTO.EXTERIOR,
      ),
      crearRecinto(
        [
          [439304, 4479654],
          [439306, 4479654],
          [439306, 4479656],
          [439304, 4479656],
        ],
        TIPO_RECINTO.HUECO,
      ),
    ],
  })
}

/** Cuadrado simple de 10 × 10 m (100 m² exactos), sin huecos. */
function parcelaCuadrada({ superficieCatastral = null, lado = 10 } = {}) {
  return crearParcela({
    idLocal: 'prueba-cuadrada',
    refcat: null,
    origen: ORIGEN_PARCELA.LIST,
    superficieCatastral,
    recintos: [
      crearRecinto(
        [
          [439300, 4479650],
          [439300 + lado, 4479650],
          [439300 + lado, 4479650 + lado],
          [439300, 4479650 + lado],
        ],
        TIPO_RECINTO.EXTERIOR,
      ),
    ],
  })
}

/** El contorno EXTERIOR cruzado consigo mismo: error bloqueante de F02. */
function parcelaCruzada() {
  return crearParcela({
    idLocal: 'prueba-cruzada',
    origen: ORIGEN_PARCELA.LIST,
    recintos: [
      crearRecinto(
        [
          [439300, 4479650],
          [439324, 4479666],
          [439324, 4479650],
          [439300, 4479666],
        ],
        TIPO_RECINTO.EXTERIOR,
      ),
    ],
  })
}

/** Los anillos (solo vértices) de una parcela, como los entrega `sincronizar`. */
const anillosDe = (parcela) => parcela.recintos.map((r) => r.vertices.map((v) => [v[0], v[1]]))

// ── Arnés de `cablearEdicion` ────────────────────────────────────────────────

/**
 * Doble de `visor.edicion` con la superficie que consume `cablearEdicion` y la
 * memoria justa para poder afirmar sobre ella. No imita a `viewer/edicion.js`:
 * registra lo que le piden.
 */
function crearEdicionFalsa({ desplazamiento = { aplicado: true, modo: 'MITER', detecciones: [] } } = {}) {
  let snap = true
  let tau = OPERATIVOS.snapMetros
  let seleccion = null
  const oyentes = new Set()
  // El modo borrar, con su propio juego de oyentes: `cablearEdicion` cierra el
  // lazo por la suscripción (pulsar pide, la suscripción pinta), así que un doble
  // que no notificara dejaría el botón sin `aria-pressed` y la prueba en verde
  // sobre nada.
  let borrando = false
  const oyentesBorrar = new Set()
  // El modo insertar (2026-08-18), con su propio juego de oyentes y por lo mismo.
  // ⚠️ Y aquí el doble tiene que imitar UNA cosa más que en borrar: los dos modos
  // son EXCLUYENTES en `viewer/edicion.js`, así que encender uno apaga el otro **y
  // lo anuncia**. Un doble que no lo hiciera dejaría pasar en verde el defecto que
  // más probable es: los dos botones pulsados a la vez.
  let insertando = false
  const oyentesInsertar = new Set()
  // F18 · el interruptor de los cuatro gestos del mapa. Nace ENCENDIDO, como el
  //  de `viewer/edicion.js`: el dibujo lo apaga mientras dura y lo repone al salir.
  let editando = true

  return {
    llamadas: {
      snapActivo: [],
      tolerancia: [],
      colindantes: [],
      desplazar: [],
      modoBorrar: [],
      modoInsertar: [],
      /** F18 · cada `activa(x)` que el dibujo le manda. */
      activa: [],
    },
    /** Simula un clic del mapa que selecciona (o suelta) un lindero. */
    seleccionar(ref) {
      seleccion = ref
      for (const fn of oyentes) fn(ref)
    },
    modoBorrar(valor) {
      if (valor !== undefined) {
        this.llamadas.modoBorrar.push(valor)
        // Como el real: solo se anuncia si CAMBIA de verdad.
        if (valor !== borrando) {
          borrando = valor
          // Como el real: al ENCENDER, apaga a su hermano y lo anuncia.
          if (borrando && insertando) {
            insertando = false
            for (const fn of oyentesInsertar) fn(false)
          }
          for (const fn of oyentesBorrar) fn(borrando)
        }
      }
      return borrando
    },
    alCambiarModoBorrar(fn) {
      oyentesBorrar.add(fn)
      return () => oyentesBorrar.delete(fn)
    },
    /** Apaga el modo POR FUERA, como hacen `Escape` y salir de Edición. */
    apagarModoBorrarDesdeElVisor() {
      if (!borrando) return
      borrando = false
      for (const fn of oyentesBorrar) fn(false)
    },
    modoInsertar(valor) {
      if (valor !== undefined) {
        this.llamadas.modoInsertar.push(valor)
        if (valor !== insertando) {
          insertando = valor
          if (insertando && borrando) {
            borrando = false
            for (const fn of oyentesBorrar) fn(false)
          }
          for (const fn of oyentesInsertar) fn(insertando)
        }
      }
      return insertando
    },
    alCambiarModoInsertar(fn) {
      oyentesInsertar.add(fn)
      return () => oyentesInsertar.delete(fn)
    },
    /** Gemela de {@link apagarModoBorrarDesdeElVisor}: `Escape`, salir de Edición. */
    apagarModoInsertarDesdeElVisor() {
      if (!insertando) return
      insertando = false
      for (const fn of oyentesInsertar) fn(false)
    },
    snapActivo(valor) {
      if (valor !== undefined) {
        this.llamadas.snapActivo.push(valor)
        snap = valor
      }
      return snap
    },
    tolerancia(metros) {
      if (metros !== undefined) {
        this.llamadas.tolerancia.push(metros)
        tau = metros
      }
      return tau
    },
    ladoSeleccionado: () => seleccion,
    alCambiarSeleccion(fn) {
      oyentes.add(fn)
      return () => oyentes.delete(fn)
    },
    /**
     * F18 · el interruptor de los CUATRO gestos del mapa. El dibujo lo apaga
     * mientras dura y lo repone al terminar, y aquí se apunta cada llamada porque
     * «se apagó y se volvió a encender» es exactamente lo que hay que medir.
     */
    activa(valor) {
      if (valor !== undefined) {
        this.llamadas.activa.push(valor)
        editando = valor
      }
      return editando
    },
    /**
     * F18 · el gancho de enganche. Devuelve el punto TAL CUAL —«no tengo opinión»,
     * que es una respuesta legítima de `viewer/edicion.js#ajustar`—: lo que aquí se
     * prueba es el recorrido del recinto hasta el store, no el snap, que tiene su
     * propia suite en `test/edit/snap.test.js`.
     */
    ajustar: (utm) => ({ punto: utm, enganchado: false, tipo: null }),
    fijarPuntos() {},
    fijarColindantes(recintos) {
      this.llamadas.colindantes.push(recintos)
    },
    desplazarSeleccion(distancia) {
      this.llamadas.desplazar.push(distancia)
      return desplazamiento
    },
  }
}

/** Lo que hay montado en cada prueba. Se destruye en el `afterEach`. */
let montado = null

/**
 * Monta panel + store + historial SEMBRADO + cableado de la edición sobre la
 * cáscara ya presente en el documento.
 *
 * @param {object|null} parcelaInicial
 * @param {object} [extra]  Opciones que sustituyen a las de por defecto.
 */
function cablear(parcelaInicial, extra = {}) {
  const estado = crearEstadoVista(parcelaInicial)
  const historial = crearHistorial()
  // La MISMA siembra que hace `app/main.js` (decisión 1 de F06): sin ella la
  // primera edición del usuario sería irreversible.
  commit(historial, estado.get())

  const panel = crearDialogoAvisos({ documento: document })
  const edicion = extra.edicion ?? crearEdicionFalsa()
  const colindantesContadas = []

  const cableado = cablearEdicion({
    estado,
    historial,
    edicion,
    panel,
    alContarColindantes: (cuantas) => colindantesContadas.push(cuantas),
    ...extra,
  })

  montado = {
    estado,
    historial,
    panel,
    edicion,
    cableado,
    colindantesContadas,
    deshacer: document.querySelector(SELECTOR_BOTON_DESHACER),
    rehacer: document.querySelector(SELECTOR_BOTON_REHACER),
    snap: document.querySelector(SELECTOR_CAMPO_SNAP),
    tolerancia: document.querySelector(SELECTOR_CAMPO_TOLERANCIA),
    offsetCampo: document.querySelector(SELECTOR_CAMPO_OFFSET),
    offsetBoton: document.querySelector(SELECTOR_BOTON_OFFSET),
    borrar: document.querySelector(SELECTOR_BOTON_BORRAR),
    renglon: document.querySelector(SELECTOR_ESTADO_EDICION),
  }
  return montado
}

/** Deja correr la cola de microtareas (donde se refrescan los dos botones). */
const cederMicrotarea = () => Promise.resolve()

/**
 * Una operación de edición como la que hacen `sincronizacion.js` y `edicion.js`:
 * `estado.set(clon)` y DESPUÉS `commit`, en ese orden.
 *
 * Ese orden es justo el que obliga a `cablearEdicion` a leer la pila en una
 * MICROTAREA: un suscriptor del store corre dentro del `set`, o sea antes del
 * `commit`, y vería la pila sin la operación que acaba de ocurrir. Por eso este
 * ayudante es `async` y hay que esperarlo antes de mirar los botones — en la
 * pantalla real ese hueco dura menos que un fotograma.
 */
async function editar(estado, historial, parcelaNueva) {
  estado.set(parcelaNueva)
  commit(historial, parcelaNueva)
  await cederMicrotarea()
}

/** Dispara un atajo de teclado sobre `destino` (por defecto, el `<body>`). */
function teclear(tecla, { ctrl = true, shift = false, meta = false, destino = null } = {}) {
  const evento = new KeyboardEvent('keydown', {
    key: tecla,
    ctrlKey: ctrl,
    shiftKey: shift,
    metaKey: meta,
    bubbles: true,
    cancelable: true,
  })
  ;(destino ?? document.body).dispatchEvent(evento)
  return evento
}

/** Textos de las tarjetas del panel de avisos. */
const textosDelPanel = () =>
  [...document.querySelectorAll('#avisos .gml-aviso-texto')].map((t) => t.textContent)

/**
 * Ídem, pero del panel QUE EL ENSAMBLAJE ESCRIBE (ver `DEL_ARRANQUE.avisos`).
 *
 * ⛔ Sin esto, un test sobre lo que `app/main.js` avisa lee el `#avisos` de la
 * cáscara remontada —siempre vacío— y `.at(-1)` devuelve `undefined`. Un
 * `toContain` sobre esa lista pasaría en verde sin haber leído nada.
 */
const textosDelPanelDelArranque = () =>
  [...(DEL_ARRANQUE.avisos?.querySelectorAll('.gml-aviso-texto') ?? [])].map((t) => t.textContent)

/** ¿Está el renglón en estado de error (el modificador rojo del CSS)? */
const renglonEnError = (renglon) => renglon.classList.contains('gml-accion-estado--error')

// Las DOS fuentes del marcado, en el mismo orden que en producción: la cáscara
// (de `index.html`) y después la barra (de `viewer/barra-edicion.js`, montada
// por `crearVisor`). Sin la segunda, los siete nodos que `cablearEdicion` busca
// no existirían a partir del primer test.
beforeEach(() => {
  desmontarCromoDelMapa()
  montarCascara()
  montarCromoDelMapa()
})
afterEach(() => {
  // Los atajos viven en `document`: sin esta baja, el cableado de una prueba
  // seguiría escuchando en la siguiente.
  if (montado !== null) montado.cableado.destruir()
  montado = null
  // ⚠️ **Y se CIERRA cualquier gesto de arrastre simulado** (auditoría
  // 2026-08-16). Varias pruebas de este fichero llaman al canal en vivo con un
  // `refVertice` —o sea, simulan un fotograma de `drag`— y ninguna simulaba el
  // `dragend`; desde que `app/main.js` inhibe el atajo durante el arrastre, ese
  // gesto a medias se colaba en la prueba siguiente y le apagaba el `Ctrl+Z`.
  // Se cierra soltando el ratón —el oyente lo tiene el cableado del ARRANQUE,
  // que en este fichero nunca se destruye— y no repintando la ficha con anillos
  // vacíos: eso borraría las cifras que `DEL_ARRANQUE` conserva y que la
  // siguiente sección afirma.
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})

// ── 1 · El ENSAMBLAJE: lo que solo se puede comprobar arrancando ─────────────

describe('app/main · el arranque monta la edición (F06)', () => {
  it('el visor se monta CON edición y con la tolerancia EXPLÍCITA de `operativos`', () => {
    // `edicion` es una lista de claves CERRADA: una errata lanzaría. Que la τ
    // viaje explícita es lo que ata los 20 cm del campo a los 0,2 m del modelo.
    expect(arranque.opciones.edicion).toEqual({ tolerancia: OPERATIVOS.snapMetros })
  })

  it('el visor recibe la pila del historial, YA SEMBRADA', () => {
    // Sin la semilla, `puedeDeshacer` (que exige `indice > 0`) dejaría la PRIMERA
    // edición del usuario fuera del alcance del undo, y para siempre.
    expect(historialDelArranque).not.toBeNull()
    expect(historialDelArranque.pila).toHaveLength(1)
    expect(historialDelArranque.indice).toBe(0)
    expect(puedeDeshacer(historialDelArranque)).toBe(false)
  })

  it('el visor recibe el canal EN VIVO como opción de primer nivel', () => {
    expect(typeof previsualizarDelArranque).toBe('function')
  })

  it('la casilla del snap manda: su estado inicial se le empuja al visor', () => {
    expect(DEL_ARRANQUE.snap.checked, 'la barra la trae marcada').toBe(true)
    expect(arranque.registro.snapActivo).toContain(true)
  })

  it('los 20 cm del campo y los metros del visor coinciden POR CONSTRUCCIÓN', () => {
    // El campo se teclea en CENTÍMETROS y el visor trabaja en METROS: la
    // conversión es de esta capa. Se afirma la equivalencia, no el literal «20»:
    // si mañana `operativos.json` dijera otra cosa, el campo tendría que seguirla.
    const cm = Number(DEL_ARRANQUE.tolerancia.value)
    expect(Number.isFinite(cm)).toBe(true)
    expect(cm / 100).toBeCloseTo(OPERATIVOS.snapMetros, 10)
  })
})

describe('app/main · la ficha del pie arranca MEDIDA, no con los guiones del HTML', () => {
  it('superficie, perímetro y vértices salen de `edit/metricas.js`', () => {
    // Se DERIVA de las métricas de la parcela demo en vez de copiar cifras: si el
    // dataset cambia, la prueba lo sigue.
    const esperado = metricas(parcelaDemo().recintos, { superficieCatastral: null })

    expect(DEL_ARRANQUE.vertices.textContent).toBe(String(esperado.nVertices))
    expect(DEL_ARRANQUE.superficie.textContent).toContain(
      esperado.superficie.toFixed(2).replace('.', ','),
    )
    expect(DEL_ARRANQUE.perimetro.textContent).toContain(
      esperado.perimetro.exterior.toFixed(2).replace('.', ','),
    )
    expect(DEL_ARRANQUE.perimetro.textContent.endsWith(' m')).toBe(true)
  })

  it('el Δ catastral DICE que no hay con qué comparar, en vez de pintar «0,00»', () => {
    // La demo no trae superficie declarada, así que `deltaCatastral` es `null`.
    // Un «0,00 m²» afirmaría que no hay discrepancia, que es lo contrario de lo
    // que sabemos —y la versión tranquilizadora—.
    expect(metricas(parcelaDemo().recintos, {}).deltaCatastral).toBeNull()
    expect(DEL_ARRANQUE.delta.textContent).not.toMatch(/0,00/)
    expect(DEL_ARRANQUE.delta.textContent.length).toBeGreaterThan(0)
    expect(DEL_ARRANQUE.delta.textContent).not.toBe('—')
  })

  it('los colindantes siguen diciendo «Sin consultar»: nadie los ha pedido', () => {
    expect(DEL_ARRANQUE.colindantes.textContent).toBe('Sin consultar')
  })
})

// ── 2 · Criterio de aceptación 4: las medidas, EN VIVO ───────────────────────

describe('app/main · el canal en vivo repinta la ficha durante el arrastre (criterio 4)', () => {
  /** Deja el store del ensamblaje como estaba, pase lo que pase. */
  const original = estadoDelArranque.get()
  afterEach(() => estadoDelArranque.set(original))

  it('mover un vértice cambia superficie y perímetro SIN tocar el store', () => {
    const antes = {
      superficie: DEL_ARRANQUE.superficie.textContent,
      perimetro: DEL_ARRANQUE.perimetro.textContent,
    }
    const parcelaAntes = estadoDelArranque.get()

    // Un vértice desplazado 5 m: es lo que `sincronizacion.js` entrega en cada
    // fotograma, anillos EN VUELO que aún no han pasado por el store.
    const anillos = anillosDe(parcelaAntes)
    anillos[0][0] = [anillos[0][0][0] + 5, anillos[0][0][1] + 5]
    previsualizarDelArranque(anillos, { recinto: 0, indice: 0 })

    expect(DEL_ARRANQUE.superficie.textContent).not.toBe(antes.superficie)
    expect(DEL_ARRANQUE.perimetro.textContent).not.toBe(antes.perimetro)
    // …y el modelo sigue intacto: el arrastre no escribe hasta el `dragend`.
    expect(estadoDelArranque.get()).toBe(parcelaAntes)
  })

  it('la cifra en vivo es EXACTAMENTE la que dan las métricas de esos anillos', () => {
    // Es la prueba de que los dos caminos (vivo y store) pintan con la misma
    // función: si divergieran, la que se vería mal es justo esta.
    const parcela = estadoDelArranque.get()
    const anillos = anillosDe(parcela)
    anillos[0][1] = [anillos[0][1][0] + 3, anillos[0][1][1]]

    previsualizarDelArranque(anillos, null)

    const esperado = metricas(
      anillos.map((vertices, i) => ({ ...parcela.recintos[i], vertices })),
      { superficieCatastral: null },
    )
    expect(DEL_ARRANQUE.superficie.textContent).toContain(
      esperado.superficie.toFixed(2).replace('.', ','),
    )
  })

  it('un `set` en el store vuelve a dejar la ficha en la geometría asentada', () => {
    const anillos = anillosDe(estadoDelArranque.get())
    anillos[0][0] = [anillos[0][0][0] + 40, anillos[0][0][1] + 40]
    previsualizarDelArranque(anillos, null)
    const enVuelo = DEL_ARRANQUE.superficie.textContent

    estadoDelArranque.set(original)

    expect(DEL_ARRANQUE.superficie.textContent).not.toBe(enVuelo)
    expect(DEL_ARRANQUE.superficie.textContent).toContain(
      metricas(original.recintos, {}).superficie.toFixed(2).replace('.', ','),
    )
  })

  it('el Δ catastral se mueve con el arrastre cuando SÍ hay superficie declarada', () => {
    // El criterio 4 lo pide expresamente: «diferencia respecto a la superficie
    // catastral en vivo si hay parcela oficial cargada».
    estadoDelArranque.set(parcelaCuadrada({ superficieCatastral: 100 }))
    // Medida (100 m²) y declarada (100 m²) coinciden: la diferencia es cero, que
    // aquí sí es una cifra —hay con qué comparar— y por eso se escribe.
    expect(DEL_ARRANQUE.delta.textContent).toMatch(/0,00\s*m²/)

    // Se saca un vértice 1 m: el cuadrado pasa a trapecio y gana superficie.
    const anillos = anillosDe(estadoDelArranque.get())
    anillos[0][1] = [anillos[0][1][0] + 1, anillos[0][1][1]]
    previsualizarDelArranque(anillos, { recinto: 0, indice: 1 })

    const esperado = metricas(
      anillos.map((vertices, i) => ({ tipo: TIPO_RECINTO.EXTERIOR, vertices })),
      { superficieCatastral: 100 },
    )
    expect(esperado.deltaCatastral.absoluto).toBeGreaterThan(0)
    // Con SIGNO: «+5,00 m²» dice algo que «5,00 m²» no dice.
    expect(DEL_ARRANQUE.delta.textContent).toContain(
      `+${esperado.deltaCatastral.absoluto.toFixed(2).replace('.', ',')} m²`,
    )
    expect(DEL_ARRANQUE.delta.textContent).toContain('%')
  })

  it('con hueco, el perímetro dice el del EXTERIOR y suma los huecos aparte', () => {
    estadoDelArranque.set(parcelaConHueco())
    // Exterior 4 × 10 = 40 m; hueco 4 × 2 = 8 m. Ni se callan ni se funden.
    expect(DEL_ARRANQUE.perimetro.textContent).toContain('40,00 m')
    expect(DEL_ARRANQUE.perimetro.textContent).toContain('8,00 m')
    // Y la superficie sí es la NETA (100 − 4): la asimetría es real.
    expect(DEL_ARRANQUE.superficie.textContent).toContain('96,00')
  })
})

// ── 3 · Criterio de aceptación 5: undo/redo ──────────────────────────────────

describe('app/main · deshacer y rehacer (criterio 5)', () => {
  it('tras UNA sola edición ya se puede deshacer, y el undo devuelve la original', async () => {
    // El caso que rompería una pila sin sembrar: la PRIMERA edición.
    const inicial = parcelaCuadrada()
    const { estado, historial, deshacer } = cablear(inicial)
    expect(deshacer.disabled, 'al arrancar no hay nada que deshacer').toBe(true)

    await editar(estado, historial, parcelaCuadrada({ lado: 20 }))

    expect(puedeDeshacer(historial)).toBe(true)
    expect(deshacer.disabled).toBe(false)

    deshacer.click()

    expect(estado.get().recintos[0].vertices).toEqual(inicial.recintos[0].vertices)
    expect(deshacer.disabled).toBe(true)
  })

  it('el botón se enciende aunque el `commit` llegue DESPUÉS del `set`', async () => {
    // El orden real de los dos módulos que commitean. Leyendo la pila DENTRO del
    // `set` (que es cuando corren los suscriptores del store) el botón se
    // quedaría un paso por detrás para siempre: encendido por la operación
    // anterior, nunca por la que se acaba de hacer.
    const { estado, historial, deshacer } = cablear(parcelaCuadrada())
    estado.set(parcelaCuadrada({ lado: 20 }))
    commit(historial, estado.get())

    await cederMicrotarea()
    expect(deshacer.disabled).toBe(false)
  })

  it('el botón de rehacer se enciende al deshacer, y rehacer restaura', async () => {
    const { estado, historial, deshacer, rehacer } = cablear(parcelaCuadrada())
    const editada = parcelaCuadrada({ lado: 20 })
    await editar(estado, historial, editada)

    deshacer.click()
    expect(puedeRehacer(historial)).toBe(true)
    expect(rehacer.disabled).toBe(false)

    rehacer.click()
    expect(estado.get().recintos[0].vertices).toEqual(editada.recintos[0].vertices)
    expect(rehacer.disabled).toBe(true)
  })

  it('⚠️ undo y redo NO ensucian la pila: solo mueven el índice', async () => {
    // No se da por hecho, se mide. Un `commit` al deshacer convertiría el propio
    // deshacer en una operación deshacible y borraría la rama de rehacer; y un
    // suscriptor del store que commiteara haría lo mismo por la puerta de atrás.
    const { estado, historial, deshacer, rehacer } = cablear(parcelaCuadrada())
    await editar(estado, historial, parcelaCuadrada({ lado: 20 }))
    await editar(estado, historial, parcelaCuadrada({ lado: 30 }))

    const alturaAntes = historial.pila.length
    expect(alturaAntes).toBe(3)
    expect(historial.indice).toBe(2)

    deshacer.click()
    deshacer.click()
    expect(historial.pila).toHaveLength(alturaAntes)
    expect(historial.indice).toBe(0)

    rehacer.click()
    expect(historial.pila).toHaveLength(alturaAntes)
    expect(historial.indice).toBe(1)
    // La rama de rehacer sigue entera: si `deshacer` hubiera commiteado, el
    // tercer snapshot se habría perdido en el primer undo.
    expect(puedeRehacer(historial)).toBe(true)
  })

  it('la instantánea es INDEPENDIENTE: deshacer no devuelve el objeto mutado', async () => {
    const { estado, historial, deshacer } = cablear(parcelaCuadrada())
    const antes = estado.get()
    await editar(estado, historial, parcelaCuadrada({ lado: 20 }))

    deshacer.click()

    expect(estado.get()).not.toBe(antes) // es un clon del snapshot…
    expect(estado.get().recintos[0].vertices).toEqual(antes.recintos[0].vertices) // …idéntico
  })

  it('sin nada que deshacer, pulsar NO revienta y el renglón lo dice', () => {
    const { deshacer, rehacer, cableado, renglon } = cablear(parcelaCuadrada())
    expect(deshacer.disabled).toBe(true)

    // `click()` sobre un botón deshabilitado no dispara nada, así que se llama a
    // la acción directamente: es el camino que sí alcanza el atajo de teclado.
    expect(() => cableado.deshacer()).not.toThrow()
    expect(renglon.textContent).toMatch(/deshacer/i)
    expect(() => cableado.rehacer()).not.toThrow()
    expect(renglon.textContent).toMatch(/rehacer/i)
    expect(deshacer.disabled).toBe(true)
    expect(rehacer.disabled).toBe(true)
  })

  it('los botones NUNCA pierden su marcado: se les toca el `disabled`, no el texto', async () => {
    const { estado, historial, deshacer, rehacer } = cablear(parcelaCuadrada())
    await editar(estado, historial, parcelaCuadrada({ lado: 20 }))
    deshacer.click()

    // ⚠️ **Lo que hay dentro cambió el 2026-08-10 y lo que se vigila NO.** Hasta
    // ese día era un `<kbd>` con el atajo; desde que la barra es de iconos son el
    // `<svg>` del dibujo y el `<span>` con el nombre accesible. En las dos épocas
    // el peligro es el mismo y por eso la prueba sigue aquí: un `textContent = …`
    // sobre estos dos botones —la forma natural de escribir «Deshacer (3)»— se
    // llevaría por delante el marcado y dejaría dos botones VACÍOS, invisibles y
    // sin nombre, sin que nada avise.
    for (const boton of [deshacer, rehacer]) {
      expect(boton.querySelector('svg'), 'el icono dibujado dentro del botón').not.toBeNull()
      const nombre = boton.querySelector('.gml-barra-rotulo')
      expect(nombre, 'el nombre accesible dentro del botón').not.toBeNull()
      expect(nombre.textContent.trim().length, 'y no vacío').toBeGreaterThan(0)
    }
  })
})

// ── 4 · Los atajos de teclado ────────────────────────────────────────────────

// ═════════════════════════════════════════════════════════════════════════════
// Auditoría 2026-08-16 · A cada instantánea, su store
// ═════════════════════════════════════════════════════════════════════════════
//
// La pila es de las DOS ramas a propósito (decisión de F12: «`Ctrl+Z` es UNA
// tecla y el usuario no lleva la cuenta de en qué rama la pulsa»), pero el
// aplicador escribía SIEMPRE en el store de parcela. Medido: editar el vértice de
// una huella de edificio y pulsar `Ctrl+Z` metía la proyección de la parte
// —`{recintos, idLocal, origen, parteDeEdificio}`— dentro de la parcela del
// expediente, invisible mientras durara la rama y firmable al volver.
//
// La marca `parteDeEdificio` la pone `edificio/parte-activa.js` diciendo
// literalmente que «no debe acabar en `crearParcela` ni en un expediente». Estas
// pruebas son las que exigen que alguien la lea.

describe('app/main · el historial compartido no cruza las ramas', () => {
  /** Una proyección de parte activa, como la que commitea la rama EDIFICIO. */
  const huella = (indice = 0, nombre = 'cuerpo principal') => ({
    recintos: [{ vertices: [[440000, 4470000], [440010, 4470000], [440010, 4470010]] }],
    idLocal: 'ES.SDGC.BU.EJEMPLO',
    origen: 'DXF',
    parteDeEdificio: { indice, nombre },
  })

  /**
   * Una edición de la rama EDIFICIO: commitea en la pila COMPARTIDA y **no toca
   * el store de parcela**, que es exactamente lo que hace la rama real (escribe
   * en `vistaParteActiva` y commitea aquí). Usar el `editar` de arriba metería la
   * huella en la parcela como parte del montaje y la prueba se probaría a sí
   * misma.
   *
   * ⚠️ Por eso mismo el gesto de estas pruebas es el ATAJO y no el botón: sin
   * `estado.set` no corre ningún suscriptor del store de parcela, así que nadie
   * refresca los botones y «Deshacer» sigue apagado. Es fiel a la pantalla real
   * —donde el usuario en la rama de edificio tiene la barra oculta y la tecla a
   * mano— y es el camino por el que se midió el defecto.
   */
  async function editarEdificio(historial, proyeccion) {
    commit(historial, proyeccion)
    await cederMicrotarea()
  }

  it('⭐ una instantánea de EDIFICIO no entra jamás en el store de parcela', async () => {
    const inicial = parcelaCuadrada()
    const aplicadas = []
    const { estado, historial, renglon } = cablear(inicial, {
      esDeEdificio: (i) => i?.parteDeEdificio != null,
      aplicarDeEdificio: (i) => {
        aplicadas.push(i)
        return true
      },
    })

    // DOS ediciones de la huella, que es el gesto medido: `undo` devuelve la
    // instantánea ANTERIOR, así que con una sola lo que sale es la parcela de
    // partida —y esa sí es de la parcela—. Es a partir de la segunda cuando lo
    // que se saca de la pila es una huella.
    await editarEdificio(historial, huella())
    await editarEdificio(historial, huella())
    teclear('z')

    // Lo que se deshace va a su dueño, y la parcela queda INTACTA.
    expect(aplicadas.length, 'la instantánea tenía que ir a la rama de edificio').toBe(1)
    expect(aplicadas[0].parteDeEdificio).toEqual({ indice: 0, nombre: 'cuerpo principal' })
    expect(estado.get().parteDeEdificio, 'la huella NO puede acabar en la parcela').toBeUndefined()
    expect(estado.get().recintos[0].vertices).toEqual(inicial.recintos[0].vertices)
    // Y no se hace en silencio: el renglón dice de quién era.
    expect(renglon.textContent).toContain('Era una edición del edificio')
  })

  it('si la parte elegida es OTRA, no se escribe nada y la pila no se descuadra', async () => {
    // Aplicar la geometría de una parte sobre otra sería cambiar una corrupción
    // por otra. Se prefiere no deshacer —reversible y visible— y contarlo.
    const { estado, historial, renglon } = cablear(parcelaCuadrada(), {
      esDeEdificio: (i) => i?.parteDeEdificio != null,
      aplicarDeEdificio: () => false, // la rama dice que esa parte no es la suya
    })

    await editarEdificio(historial, huella(3, 'porche'))
    await editarEdificio(historial, huella(3, 'porche'))
    const indiceAntes = historial.indice
    teclear('z')

    expect(historial.indice, 'el índice tiene que volver a donde estaba').toBe(indiceAntes)
    expect(estado.get().parteDeEdificio).toBeUndefined()
    expect(renglon.textContent).toContain('otra parte del edificio')
    // Sigue habiendo algo que deshacer: la operación NO se ha consumido.
    expect(puedeDeshacer(historial)).toBe(true)
  })

  it('sin rama de edificio montada, deshacer una parcela funciona como siempre', async () => {
    // Anti-vacuidad: los valores por defecto de las dos opciones dicen «no hay
    // edificio», que es la verdad en una pantalla que solo monta la parcela.
    const inicial = parcelaCuadrada()
    const { estado, historial, deshacer } = cablear(inicial)

    await editar(estado, historial, parcelaCuadrada({ lado: 20 }))
    deshacer.click()

    expect(estado.get().recintos[0].vertices).toEqual(inicial.recintos[0].vertices)
  })
})

describe('app/main · atajos de deshacer/rehacer', () => {
  /** Deja la pila con una edición hecha, lista para deshacerse. */
  async function conHistoria() {
    const arnes = cablear(parcelaCuadrada())
    await editar(arnes.estado, arnes.historial, parcelaCuadrada({ lado: 20 }))
    return arnes
  }

  it('`Ctrl+Z` deshace', async () => {
    const { historial } = await conHistoria()
    teclear('z')
    expect(historial.indice).toBe(0)
  })

  it('`Ctrl+Y` rehace', async () => {
    const { historial } = await conHistoria()
    teclear('z')
    teclear('y')
    expect(historial.indice).toBe(1)
  })

  it('`Ctrl+Shift+Z` rehace también (las dos formas existen en el mundo real)', async () => {
    const { historial } = await conHistoria()
    teclear('z')
    teclear('z', { shift: true })
    expect(historial.indice).toBe(1)
  })

  it('`Meta` cuenta como `Ctrl` (macOS)', async () => {
    const { historial } = await conHistoria()
    teclear('z', { ctrl: false, meta: true })
    expect(historial.indice).toBe(0)
  })

  it('sin modificador no pasa nada: la «z» a secas se escribe, no deshace', async () => {
    const { historial } = await conHistoria()
    teclear('z', { ctrl: false })
    expect(historial.indice).toBe(1)
  })

  it('⚠️ dentro de un `<input>` el atajo NO se roba: es el deshacer del navegador', async () => {
    // Las celdas de coordenada de la tabla de vértices SON inputs. Robar ahí el
    // `Ctrl+Z` revertiría la geometría mientras el usuario corrige un dígito.
    const { historial, tolerancia } = await conHistoria()
    const evento = teclear('z', { destino: tolerancia })

    expect(historial.indice, 'la pila no se ha movido').toBe(1)
    expect(evento.defaultPrevented, 'el navegador conserva su atajo').toBe(false)
  })

  it('y tampoco en el campo de la referencia catastral ni en un `contentEditable`', async () => {
    const { historial } = await conHistoria()
    teclear('z', { destino: document.querySelector('[data-campo="refcat"]') })
    expect(historial.indice).toBe(1)

    const editable = document.createElement('div')
    // jsdom no calcula `isContentEditable` desde el atributo: se fija a mano, que
    // es lo que el navegador expondría.
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    document.body.appendChild(editable)
    teclear('z', { destino: editable })
    expect(historial.indice).toBe(1)
  })

  it('el atajo se CONSUME cuando es nuestro, también si no hay nada que deshacer', () => {
    cablear(parcelaCuadrada())
    const evento = teclear('z')
    expect(evento.defaultPrevented).toBe(true)
  })

  it('`destruir()` retira el oyente del documento', async () => {
    const { historial, cableado } = await conHistoria()
    cableado.destruir()
    teclear('z')
    expect(historial.indice).toBe(1)
  })

  // ── ⛔ Auditoría 2026-08-16 · H3 · el atajo bajo un `<dialog>` MODAL ────────
  //
  // `esCampoDeTexto` era el ÚNICO filtro del atajo, y cubre el caso de escribir.
  // No cubre el de mirar: los diálogos de la aplicación son modales de verdad
  // (`dialogo-expediente.js`, `dialogo-avisos.js`, `dialogo-diccionario.js` los
  // abren con `showModal()`), y dentro de ellos se navega con el teclado por
  // BOTONES, no por campos. Escenario medido: se abre «Expediente», se recorre la
  // lista de proyectos guardados —el foco queda en un botón de fila— y se pulsa
  // `Ctrl+Z`, que es el gesto natural ahí. La geometría de detrás se deshacía; el
  // mapa y el renglón están tapados por el velo, así que NADA lo decía, y el
  // autoguardado persistía la geometría ya revertida.
  //
  // El diálogo de estas pruebas es el REAL (`crearDialogoAvisos`, el mismo panel
  // que el cableado recibe): no se fabrica un `<dialog>` a mano, que sería una
  // segunda redacción de cómo abre un modal esta aplicación.
  //
  // MUTACIÓN MEDIDA (aplicada a `app/main.js`, corrida `npm run test:dom -- main-edicion`
  // y revertida con el editor): anular la guarda `hayDialogoModalAbierto(documento)`
  // → **4 rojos**, los cuatro de aquí. El quinto —el `<dialog>` NO modal— sigue
  // verde, que es lo que prueba que la guarda distingue y no apaga por `open`.

  describe('⛔ con un `<dialog>` MODAL abierto', () => {
    it('`Ctrl+Z` NO deshace, y el navegador conserva su atajo', async () => {
      const { historial, panel } = await conHistoria()
      panel.abrir()

      const evento = teclear('z')

      expect(historial.indice, 'la geometría de detrás del velo se ha deshecho').toBe(1)
      expect(evento.defaultPrevented, 'el atajo no es nuestro aquí').toBe(false)
    })

    it('`Ctrl+Y` tampoco rehace: son el mismo atajo y el mismo motivo', async () => {
      const { historial, panel } = await conHistoria()
      // Deshacer ANTES de abrir, para que haya algo que rehacer.
      teclear('z')
      expect(historial.indice).toBe(0)

      panel.abrir()
      teclear('y')
      expect(historial.indice).toBe(0)
    })

    it('⚠️ y NO se inhibe en silencio: lo dice en el renglón y en el panel', async () => {
      // Regla de oro 1 con una vuelta de tuerca: el renglón está DETRÁS del velo,
      // así que el usuario no lo lee hasta cerrar. Por eso va además al panel de
      // avisos, que conserva lo dicho (y agrupa las repeticiones con su `×N`, así
      // que insistir con el atajo no lo llena de tarjetas iguales).
      const { panel, renglon } = await conHistoria()
      panel.abrir()

      teclear('z')
      teclear('z')

      expect(renglon.textContent).toMatch(/ventana/i)
      const tarjetas = textosDelPanel().filter((t) => /ventana/i.test(t))
      expect(tarjetas, 'el panel no ha recogido nada').toHaveLength(1)
    })

    it('⚠️ cerrado el diálogo, el atajo vuelve (el guardián no es una inhibición fija)', async () => {
      const { historial, panel } = await conHistoria()
      panel.abrir()
      teclear('z')
      expect(historial.indice).toBe(1)

      panel.cerrar()
      teclear('z')
      expect(historial.indice).toBe(0)
    })

    it('⛔⛔ un `<dialog>` abierto que NO es modal no inhibe nada', async () => {
      // **El guardián que impide el arreglo fácil.** `document.querySelector(
      // 'dialog[open]')` a secas daría también con el informe presentado COMO
      // PANTALLA, que `app/dialogo-informe.js#presentar` abre con `show()` —no con
      // `showModal()`— justamente para que lo de detrás siga vivo: allí el rail
      // navega, el mapa se ve y `aria-modal` dice «false» para no mentirle al
      // lector de pantalla. Apagar el undo ahí sería romper una pantalla de
      // trabajo por arreglar otra cosa.
      const { historial } = await conHistoria()
      const comoPantalla = document.createElement('dialog')
      comoPantalla.setAttribute('open', '')
      comoPantalla.setAttribute('aria-modal', 'false')
      document.body.appendChild(comoPantalla)

      teclear('z')
      expect(historial.indice).toBe(0)
    })
  })

  // ── ⛔ Auditoría 2026-08-16 · H4 · el atajo DURANTE un arrastre ─────────────
  //
  // La otra mitad del defecto que `viewer/sincronizacion.js` cerró por su lado.
  // Allí, un `Ctrl+Z` a mitad de arrastre cambiaba la forma del anillo bajo los
  // pies del gesto y el `dragend` escribía la coordenada en el vértice
  // equivocado; ahora el arrastre RENUNCIA, lo dice con `NIVEL.ERROR` y repinta.
  // Eso cierra el daño, pero el usuario pierde el gesto: suelta el ratón y le
  // dicen «no se ha aplicado, repítelo». La mitad de esta capa es no llegar ahí:
  // mientras haya un arrastre en curso, el atajo NO deshace.
  //
  // El arrastre se detecta por el `refVertice` del canal en vivo, que es el
  // parámetro que `AlPrevisualizar` (viewer/sincronizacion.js) define justo para
  // esto: no `null` en cada `drag`, `null` al final de cada `render()`.
  //
  // MUTACIONES MEDIDAS (mismo método que arriba):
  //   · anular la guarda `arrastrandoVertice` del atajo → **4 rojos**, los cuatro
  //     de aquí, y ninguno de los del diálogo: son dos piezas independientes.
  //   · quitar los dos oyentes de `mouseup`/`pointerup` (la red de seguridad) →
  //     **9 rojos**: el de «el puntero se va» y OCHO por contagio, porque sin ella
  //     un gesto simulado y no cerrado apaga el `Ctrl+Z` de las pruebas
  //     siguientes. Es el mismo síntoma que tendría el usuario, medido por
  //     accidente: la bandera alta deja el atajo muerto hasta que algo la baje.

  describe('⛔ mientras se ARRASTRA un vértice', () => {
    /** Un fotograma de arrastre, como los que emite `sincronizacion.js`. */
    const fotogramaDeArrastre = () =>
      previsualizarDelArranque(anillosDe(parcelaCuadrada()), { recinto: 0, indice: 2 })
    /** El render del final del gesto: los anillos DEL ESTADO y `refVertice: null`. */
    const renderDelEstado = () => previsualizarDelArranque(anillosDe(parcelaCuadrada()), null)

    it('`Ctrl+Z` no deshace: el gesto no se pierde, en vez de perderse con aviso', async () => {
      const { historial } = await conHistoria()
      fotogramaDeArrastre()

      const evento = teclear('z')

      expect(historial.indice, 'la forma ha cambiado bajo los pies del arrastre').toBe(1)
      expect(evento.defaultPrevented).toBe(false)
      renderDelEstado()
    })

    it('⚠️ y lo dice: un atajo que no responde y no explica es un atajo roto', async () => {
      const { renglon } = await conHistoria()
      fotogramaDeArrastre()
      teclear('z')
      expect(renglon.textContent).toMatch(/arrastr/i)
      renderDelEstado()
    })

    it('⚠️ soltado el vértice, el atajo vuelve', async () => {
      const { historial } = await conHistoria()
      fotogramaDeArrastre()
      teclear('z')
      expect(historial.indice).toBe(1)

      // El `render()` del final del gesto, que es lo que devuelve la verdad.
      renderDelEstado()
      teclear('z')
      expect(historial.indice).toBe(0)
    })

    it('⛔ y vuelve TAMBIÉN si el gesto no llega a su `dragend` (el puntero se va)', async () => {
      // Red de seguridad, y no es celo: un arrastre que nunca recibe `dragend`
      // —el puntero sale de la ventana— dejaría la bandera alta y el `Ctrl+Z`
      // MUERTO en silencio, que es el mismo hallazgo 2.11 que `sincronizacion.js`
      // ya se encontró con su propio render diferido. Un arrastre no puede
      // sobrevivir a que se suelte el botón del ratón, así que ahí se baja.
      const { historial } = await conHistoria()
      fotogramaDeArrastre()
      teclear('z')
      expect(historial.indice).toBe(1)

      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      teclear('z')
      expect(historial.indice).toBe(0)
    })
  })
})

// ── 5 · Los tres controles del bloque ────────────────────────────────────────

describe('app/main · la casilla y la tolerancia del enganche', () => {
  it('la casilla escribe en `visor.edicion.snapActivo`', () => {
    const { snap, edicion } = cablear(parcelaCuadrada())
    snap.checked = false
    snap.dispatchEvent(new Event('change', { bubbles: true }))
    expect(edicion.llamadas.snapActivo.at(-1)).toBe(false)

    snap.checked = true
    snap.dispatchEvent(new Event('change', { bubbles: true }))
    expect(edicion.llamadas.snapActivo.at(-1)).toBe(true)
  })

  it('⚠️ la tolerancia se teclea en CENTÍMETROS y baja al visor en METROS', () => {
    const { tolerancia, edicion } = cablear(parcelaCuadrada())
    tolerancia.value = '50'
    tolerancia.dispatchEvent(new Event('change', { bubbles: true }))
    expect(edicion.llamadas.tolerancia.at(-1)).toBeCloseTo(0.5, 10)
  })

  it('`0` es válido: apaga el enganche y no se corrige ni se avisa', () => {
    const { tolerancia, edicion, panel } = cablear(parcelaCuadrada())
    tolerancia.value = '0'
    tolerancia.dispatchEvent(new Event('change', { bubbles: true }))

    expect(edicion.llamadas.tolerancia.at(-1)).toBe(0)
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 0 })
  })

  it.each([
    ['vacía', ''],
    ['negativa', '-5'],
  ])('una tolerancia %s es DATO MALO: avisa, revierte y NO lanza', (_caso, valor) => {
    const { tolerancia, edicion, panel, renglon } = cablear(parcelaCuadrada())
    const antes = edicion.tolerancia()

    expect(() => {
      tolerancia.value = valor
      tolerancia.dispatchEvent(new Event('change', { bubbles: true }))
    }).not.toThrow()

    // Ni se aplica…
    expect(edicion.tolerancia()).toBe(antes)
    // …ni se deja el campo con lo ilegible dentro…
    expect(Number(tolerancia.value)).toBeCloseTo(antes * 100, 10)
    // …ni se calla (panel + renglón, como el resto del fichero).
    expect(panel.resumen()[NIVEL.AVISO]).toBe(1)
    expect(renglonEnError(renglon)).toBe(true)
  })
})

describe('app/main · el desplazamiento de lindero (offset)', () => {
  it('el botón nace apagado y se enciende con la SELECCIÓN', () => {
    const { offsetBoton, edicion, renglon } = cablear(parcelaCuadrada())
    expect(offsetBoton.disabled).toBe(true)

    // ⚠️ AQUÍ ya no se exige que el renglón traiga el motivo AL ARRANCAR, y no es
    // un aflojamiento de la regla de oro 1 («un botón gris y mudo es un error
    // silencioso»): es que el motivo cambió de sitio el 2026-07-29, cuando los
    // controles se fueron del panel a la barra flotante SOBRE EL MAPA. Escrito en
    // el renglón, el mismo texto pasaba de ser una nota de 11 px al pie de un
    // bloque a un cartel de tres líneas plantado sobre la ortofoto que no se iba
    // hasta la primera edición. Quien lo garantiza ahora, cada uno donde el
    // usuario lo va a buscar:
    //   · `viewer/barra-edicion.js` emite `[data-motivo="offset"]` DENTRO del
    //     desplegable del offset, y `estilos/app.css` lo enseña justamente
    //     mientras el botón está apagado (regla de hermano sobre `:disabled`);
    //   · el panel de ayuda del botón «?» lo dice en su primera línea.
    // Los dos tienen su propia prueba en `test/viewer/barra-edicion.dom.test.js`.
    // Lo que este fichero SÍ sigue exigiendo es lo de abajo: que apagarlo por una
    // acción del usuario (deseleccionar) se cuente en el momento en que ocurre.
    expect(renglon.textContent, 'el arranque no planta un cartel sobre el mapa').toBe('')

    edicion.seleccionar({ recinto: 0, indice: 1 })
    expect(offsetBoton.disabled).toBe(false)

    edicion.seleccionar(null)
    expect(offsetBoton.disabled).toBe(true)
    expect(renglon.textContent, 'apagarlo por un gesto del usuario SÍ se cuenta').toMatch(
      /lindero/i,
    )
  })

  it('la distancia baja en METROS, tal cual, incluido el `0`', () => {
    const { offsetBoton, offsetCampo, edicion } = cablear(parcelaCuadrada())
    edicion.seleccionar({ recinto: 0, indice: 0 })

    offsetCampo.value = '0.5'
    offsetBoton.click()
    expect(edicion.llamadas.desplazar).toEqual([0.5])

    // El «desplazar 0 m» lo cuenta `viewer/edicion.js`: adelantarnos aquí sería
    // una segunda redacción del mismo suceso.
    offsetCampo.value = '0'
    offsetBoton.click()
    expect(edicion.llamadas.desplazar).toEqual([0.5, 0])
  })

  it('una distancia ilegible avisa y NO llega a `desplazarSeleccion`', () => {
    const { offsetBoton, offsetCampo, edicion, panel, renglon } = cablear(parcelaCuadrada())
    edicion.seleccionar({ recinto: 0, indice: 0 })

    offsetCampo.value = ''
    expect(() => offsetBoton.click()).not.toThrow()

    expect(edicion.llamadas.desplazar).toEqual([])
    expect(panel.resumen()[NIVEL.AVISO]).toBe(1)
    expect(renglonEnError(renglon)).toBe(true)
    // Y NO se le borra al usuario lo que estaba escribiendo: aquí no hay ningún
    // «valor vigente» del modelo al que revertir.
    expect(offsetCampo.value).toBe('')
  })

  it('las detecciones NO se publican dos veces: de eso ya se encargó el visor', () => {
    // `viewer/edicion.js` suelta en el panel, verbatim, cada detección de
    // `edit/offset.js`. Republicarlas aquí obligaría a leerlo todo dos veces.
    const edicion = crearEdicionFalsa({
      desplazamiento: {
        aplicado: true,
        modo: 'BEVEL',
        detecciones: [{ tipo: 'BISEL_APLICADO', mensaje: 'Se ha biselado la esquina.' }],
      },
    })
    const { offsetBoton, offsetCampo, panel } = cablear(parcelaCuadrada(), { edicion })
    edicion.seleccionar({ recinto: 0, indice: 0 })

    offsetCampo.value = '1'
    offsetBoton.click()

    expect(textosDelPanel()).not.toContain('Se ha biselado la esquina.')
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 0 })
  })

  it('cuando el offset no se aplica, el renglón lo dice y remite al panel', () => {
    const edicion = crearEdicionFalsa({
      desplazamiento: { aplicado: false, modo: null, detecciones: [] },
    })
    const { offsetBoton, offsetCampo, renglon } = cablear(parcelaCuadrada(), { edicion })
    edicion.seleccionar({ recinto: 0, indice: 0 })

    offsetCampo.value = '1'
    offsetBoton.click()

    expect(renglonEnError(renglon)).toBe(true)
    expect(renglon.textContent).toMatch(/panel de avisos/i)
  })
})

// ── 5 bis · El conmutador del modo borrar (2026-08-10) ───────────────────────
//
// Lo que se prueba aquí es EL SENTIDO DEL LAZO, que es donde está el fallo fácil:
// el botón PIDE y la suscripción PINTA. Un cableado que pintara el `aria-pressed`
// al pulsar pasaría los dos primeros tests y fallaría el tercero, que es el que
// importa — porque los tres caminos por los que el modo se apaga solo (`Escape`,
// salir de Edición, `destruir`) van por ahí y por ningún otro sitio.

describe('app/main · el botón «Borrar vértices» conmuta el modo del visor', () => {
  it('nace apagado, encendido y sin motivo que dar', () => {
    const { borrar } = cablear(parcelaCuadrada())
    expect(borrar.getAttribute('aria-pressed')).toBe('false')
    expect(borrar.disabled, 'armar el modo se puede hacer siempre').toBe(false)
  })

  it('pulsarlo ARMA el modo, y volver a pulsarlo lo desarma', () => {
    const { borrar, edicion } = cablear(parcelaCuadrada())

    borrar.click()
    expect(edicion.llamadas.modoBorrar).toEqual([true])
    expect(edicion.modoBorrar()).toBe(true)

    borrar.click()
    expect(edicion.llamadas.modoBorrar).toEqual([true, false])
    expect(edicion.modoBorrar()).toBe(false)
  })

  it('el `aria-pressed` y el renglón siguen al VISOR, no a la pulsación', () => {
    const { borrar, edicion, renglon } = cablear(parcelaCuadrada())

    borrar.click()
    expect(borrar.getAttribute('aria-pressed')).toBe('true')
    expect(renglon.textContent, 'un modo destructivo se anuncia').toMatch(/modo borrar/i)

    // ⭐ EL CASO QUE DECIDE: el modo se apaga por un camino que el botón no ve
    // (`Escape`, o salir de la pantalla de Edición). Si el cableado pintara el
    // botón al pulsarlo en vez de al ser notificado, aquí se quedaría hundido
    // sobre un modo que ya no está armado — y el usuario pincharía en el mapa
    // esperando borrar.
    edicion.apagarModoBorrarDesdeElVisor()
    expect(borrar.getAttribute('aria-pressed')).toBe('false')
    expect(renglon.textContent).toMatch(/apagado/i)
  })

  it('`destruir()` retira el oyente del botón y la baja del modo', () => {
    const { borrar, edicion, cableado } = cablear(parcelaCuadrada())
    cableado.destruir()

    borrar.click()
    expect(edicion.llamadas.modoBorrar, 'el botón ya no pide nada').toEqual([])
  })
})

// ── 6 · Los dos ganchos que se le entregan al Catastro ───────────────────────

describe('app/main · una parcela nueva REINICIA el historial (decisión 2 de F06)', () => {
  it('deshacer no devuelve la parcela anterior: la pila empieza de cero', () => {
    const { estado, historial, cableado, deshacer, renglon } = cablear(parcelaCuadrada())
    editar(estado, historial, parcelaCuadrada({ lado: 20 }))
    expect(puedeDeshacer(historial)).toBe(true)

    const traida = parcelaConHueco({ superficieCatastral: 96 })
    estado.set(traida) // lo que hace `cablearCatastro` antes de llamar al gancho
    cableado.alCargarParcela(traida)

    expect(historial.pila).toHaveLength(1)
    expect(historial.indice).toBe(0)
    expect(puedeDeshacer(historial)).toBe(false)
    expect(deshacer.disabled).toBe(true)
    // Y se dice: un botón que se apaga solo, sin motivo, se lee como un fallo.
    expect(renglon.textContent.length).toBeGreaterThan(0)
  })

  it('suelta las colindantes de la parcela anterior (ya no lindan con nada)', () => {
    const { cableado, edicion, colindantesContadas } = cablear(parcelaCuadrada())
    cableado.alColindantes({
      ok: true,
      datos: { colindantes: [parcelaCuadrada(), parcelaConHueco()] },
    })
    expect(edicion.llamadas.colindantes.at(-1).length).toBeGreaterThan(0)

    cableado.alCargarParcela(parcelaCuadrada({ lado: 30 }))

    expect(edicion.llamadas.colindantes.at(-1)).toEqual([])
    expect(colindantesContadas.at(-1)).toBeNull()
  })

  it('⭐ y suelta también el REGISTRO, que es la tercera pieza (auditoría 2026-08-16)', () => {
    // Las dianas del enganche y el recuento se soltaban desde F06; el registro de
    // `app/colindantes.js` —el que lee `cablearDerivacion` para repartir el exceso
    // entre los vecinos— no lo soltaba NADIE: su `olvidar()` no tenía un solo
    // llamante en la aplicación. Medido: con las vecinas de A y la parcela B
    // cargada, el exceso de B se repartía contra las fincas de A y, como el
    // registro seguía diciendo «consultado», se declaraba entero sobre VIAL sin
    // emitir el aviso de vecinas sin consultar — y eso abre «Descargar expediente».
    let soltadas = 0
    const { cableado } = cablear(parcelaCuadrada(), {
      alSoltarColindantes: () => {
        soltadas += 1
      },
    })

    cableado.alCargarParcela(parcelaCuadrada({ lado: 30 }))
    expect(soltadas, 'el registro tenía que olvidar al entrar otra parcela').toBe(1)

    // Y por la SEGUNDA puerta también: «Traer el parcelario de fondo» no cambia la
    // geometría de trabajo, pero las vecinas siguen siendo las de antes. Es la
    // misma razón por la que esta función ya soltaba las dianas y el recuento.
    cableado.alCambiarOficial(parcelaCuadrada({ lado: 30 }))
    expect(soltadas).toBe(2)
  })

  it('sin registro montado, soltar las colindantes no revienta', () => {
    // Anti-vacuidad del valor por defecto: una pantalla sin registro (tests, uso
    // como librería) tiene que seguir cargando parcelas.
    const { cableado, colindantesContadas } = cablear(parcelaCuadrada())
    expect(() => cableado.alCargarParcela(parcelaCuadrada({ lado: 30 }))).not.toThrow()
    expect(colindantesContadas.at(-1)).toBeNull()
  })

  it('tras el reinicio, la primera edición vuelve a ser deshacible', async () => {
    const { estado, historial, cableado, deshacer } = cablear(parcelaCuadrada())
    const traida = parcelaCuadrada({ lado: 15 })
    estado.set(traida)
    cableado.alCargarParcela(traida)

    editar(estado, historial, parcelaCuadrada({ lado: 25 }))
    await cederMicrotarea()

    expect(deshacer.disabled).toBe(false)
    deshacer.click()
    expect(estado.get().recintos[0].vertices).toEqual(traida.recintos[0].vertices)
  })
})

describe('app/main · las colindantes llegan APLANADAS a las dianas del enganche', () => {
  it('⚠️ `fijarColindantes` recibe RECINTOS, no parcelas', () => {
    // Pasarle parcelas sin aplanar LANZA en `viewer/edicion.js` (a propósito: no
    // aportarían ni una diana y el snap parecería roto sin motivo).
    const { cableado, edicion } = cablear(parcelaCuadrada())
    const vecinas = [parcelaCuadrada(), parcelaConHueco()]

    cableado.alColindantes({ ok: true, datos: { colindantes: vecinas } })

    const recibidos = edicion.llamadas.colindantes.at(-1)
    expect(recibidos).toHaveLength(3) // 1 exterior + (1 exterior + 1 hueco)
    for (const recinto of recibidos) {
      expect(Array.isArray(recinto.vertices), 'cada elemento es un RECINTO').toBe(true)
      expect(recinto.recintos, 'y no una parcela').toBeUndefined()
    }
  })

  it('el recuento sale por el callback de la ficha, no escribiendo en el `<dd>`', () => {
    const { cableado, colindantesContadas } = cablear(parcelaCuadrada())
    cableado.alColindantes({ ok: true, datos: { colindantes: [parcelaCuadrada()] } })
    expect(colindantesContadas).toEqual([1])
  })

  it('cero colindantes SÍ es una respuesta: se cuenta el 0', () => {
    const { cableado, colindantesContadas, edicion } = cablear(parcelaCuadrada())
    cableado.alColindantes({ ok: true, datos: { colindantes: [] } })

    expect(colindantesContadas).toEqual([0])
    expect(edicion.llamadas.colindantes.at(-1)).toEqual([])
  })

  it('⛔ y NO escribe en el renglón de la barra: ese texto ya lo da el panel', () => {
    // Este `it` afirmaba lo CONTRARIO hasta el 2026-08-18 —que el renglón se
    // llenaba— y se ha dado la vuelta a propósito, así que conviene decir por qué
    // para que nadie lo «arregle» de vuelta.
    //
    // El desenlace de la consulta de vecinas ya lo escribe
    // `app/cableado-catastro.js#colindantes` en `[data-estado="traer-colindantes"]`,
    // que es el renglón `role="status"` PROPIO de «Traer colindantes» desde el
    // 2026-08-16. Escribirlo TAMBIÉN aquí contaba el mismo hecho dos veces, en dos
    // sitios de la pantalla, y encima ponía el texto encima del mapa —lejos del
    // botón que se acababa de pulsar—. De los dieciséis mensajes de este cableado
    // era el único que tenía casa en otro sitio, y el único que no describía una
    // acción del usuario SOBRE EL MAPA.
    //
    // Se afirma con las dos cardinalidades porque la redacción retirada tenía una
    // rama para cada una: si vuelve, vuelve por una de las dos.
    const conCero = cablear(parcelaCuadrada())
    conCero.cableado.alColindantes({ ok: true, datos: { colindantes: [] } })
    expect(conCero.renglon.textContent).toBe('')

    const conVecinas = cablear(parcelaCuadrada())
    conVecinas.cableado.alColindantes({
      ok: true,
      datos: { colindantes: [parcelaCuadrada(), parcelaCuadrada()] },
    })
    expect(conVecinas.renglon.textContent).toBe('')
  })

  it('una consulta que FALLA no borra las dianas ni inventa un recuento', () => {
    // Una consulta que falla no es una consulta que devuelve cero vecinas, y el
    // motivo ya lo ha contado `cableado-catastro.js` en su propio renglón.
    const { cableado, edicion, colindantesContadas } = cablear(parcelaCuadrada())
    cableado.alColindantes({ ok: true, datos: { colindantes: [parcelaCuadrada()] } })
    const dianas = edicion.llamadas.colindantes.length

    cableado.alColindantes({ ok: false, datos: null, motivo: 'RED' })
    cableado.alColindantes(null)

    expect(edicion.llamadas.colindantes).toHaveLength(dianas)
    expect(colindantesContadas).toEqual([1])
  })
})

// ── 7 · El cable ENTERO: del Catastro a la ficha, por el ensamblaje real ─────

describe('app/main · los dos ganchos que el arranque le entrega al Catastro', () => {
  const original = estadoDelArranque.get()

  /**
   * Lo que hace el cableado real por la **puerta 1** («Empezar desde el Catastro»):
   * un `set` y después LOS DOS ganchos, el del documento primero. Se imita aquí en
   * vez de llamar a `alCargarParcela` a secas porque desde el 2026-08-08 ese gancho
   * ya no lo hace todo: es la mitad del documento.
   */
  const traerSustituyendo = (parcela) => {
    estadoDelArranque.set(parcela)
    arranque.catastro.alCargarParcela(parcela)
    arranque.catastro.alCambiarOficial(parcela)
  }

  /** Y por la **puerta 2** («Traer el parcelario de fondo»): solo el del parcelario. */
  const traerSoloElFondo = (parcela) => {
    estadoDelArranque.set(parcela)
    arranque.catastro.alCambiarOficial(parcela)
  }

  afterEach(() => {
    // Se deja el ensamblaje como estaba: su store, su pila y su ficha. El propio
    // gancho de «parcela nueva» es lo que devuelve las tres cosas a cero.
    traerSustituyendo(original)
    estadoDelArranque.set(original)
  })

  it('el arranque le pasa LOS DOS ganchos y le registra los oyentes de colindantes', () => {
    expect(typeof arranque.catastro.alCargarParcela).toBe('function')
    // ⭐ El segundo es el de la puerta de contexto. Sin él, traer el parcelario de
    // fondo dejaría colgadas las dianas de snap de la parcela anterior.
    expect(typeof arranque.catastro.alCambiarOficial).toBe('function')
    // CINCO suscriptores: el snap de F06, el diagnóstico de F07, la CAPA que las
    // dibuja (desde el arreglo del check visual), el INFORME de F09 —que necesita
    // las vecinas para atribuir cada lindero en la descripción literaria— y, desde
    // el 2026-08-10, el REGISTRO de `app/colindantes.js`, que las guarda para que la
    // derivación pueda decir a quién le quita terreno la geometría medida.
    //
    // ⭐ Ninguno de los cinco **dispara una consulta propia**: todos se cuelgan de la
    // que hace el cajón del diagnóstico al abrirse. Por eso el quinto costó CERO
    // peticiones, que es lo que el override O8 exige («una apertura, una petición»)
    // y lo que hizo que la fase 2 de F23 fuera barata: la ficha de F17 la había
    // estimado cara suponiendo que había que sacar las vecinas de una clausura, y
    // resultó que su fuente ya era este canal público.
    //
    // Que sean cinco y no uno es exactamente el contrato del cableado del Catastro
    // (un `Set`, no un callback: «el segundo en llegar no puede desalojar al
    // primero»), y este número es lo que lo afirma desde el arranque real. Eran dos
    // hasta que las vecinas se pintaron, tres hasta F09 y cuatro hasta F23; si
    // alguna vez BAJA, alguien ha desenchufado a uno.
    expect(arranque.oyentesColindantes.size, 'el puente del arranque').toBe(5)
  })

  it('traer una parcela REINICIA la pila del arranque (deshacer no la devuelve)', () => {
    const traida = parcelaCuadrada({ superficieCatastral: 100 })
    traerSustituyendo(traida)

    expect(historialDelArranque.pila).toHaveLength(1)
    expect(historialDelArranque.indice).toBe(0)
    expect(puedeDeshacer(historialDelArranque)).toBe(false)
  })

  it('las colindantes llegan a las dianas APLANADAS y a la ficha CONTADAS', () => {
    // El recorrido completo: resultado del WFS → `flatMap` a recintos →
    // `visor.edicion.fijarColindantes` → callback → `<dd data-ficha>`.
    expect(DEL_ARRANQUE.colindantes.textContent).toBe('Sin consultar')

    publicarColindantes({
      ok: true,
      datos: { colindantes: [parcelaCuadrada(), parcelaConHueco()] },
    })

    const dianas = arranque.registro.colindantes.at(-1)
    expect(dianas).toHaveLength(3) // 1 exterior + (1 exterior + 1 hueco)
    for (const recinto of dianas) expect(Array.isArray(recinto.vertices)).toBe(true)
    // Y la ficha deja por fin de decir «Sin consultar».
    expect(DEL_ARRANQUE.colindantes.textContent).toBe('2')
  })

  it('cargar otra parcela suelta el recuento: esas vecinas ya no lindan con nada', () => {
    publicarColindantes({ ok: true, datos: { colindantes: [parcelaCuadrada()] } })
    expect(DEL_ARRANQUE.colindantes.textContent).toBe('1')

    traerSustituyendo(parcelaCuadrada({ lado: 30 }))

    expect(DEL_ARRANQUE.colindantes.textContent).toBe('Sin consultar')
    expect(arranque.registro.colindantes.at(-1)).toEqual([])
  })

  // ── LA PUERTA 2: fondo nuevo bajo la misma parcela (2026-08-08) ────────────

  it('⭐ el fondo NO reinicia la pila: el «deshacer» del usuario sobrevive', () => {
    // Es el agravante 1 del defecto original: `alCargarParcela` reiniciaba el
    // historial, así que la medición borrada tampoco volvía con Ctrl+Z.
    const medida = parcelaCuadrada({ lado: 12 })
    traerSustituyendo(medida)
    commit(historialDelArranque, parcelaCuadrada({ lado: 14 })) // una edición
    expect(puedeDeshacer(historialDelArranque)).toBe(true)

    traerSoloElFondo(parcelaCuadrada({ lado: 14, superficieCatastral: 196 }))

    expect(historialDelArranque.pila).toHaveLength(2)
    expect(puedeDeshacer(historialDelArranque)).toBe(true)
  })

  it('⭐ y REENCUADRA la pila: el primer Ctrl+Z no hace desaparecer el fondo', () => {
    // Sin `reencuadrar`, deshacer devolvería un snapshot anterior SIN oficial y el
    // parcelario se iría de la pantalla sin que nada lo explicara.
    const medida = parcelaCuadrada({ lado: 12 })
    traerSustituyendo(medida)
    commit(historialDelArranque, parcelaCuadrada({ lado: 14 }))

    const conFondo = crearParcela({
      idLocal: 'prueba-cuadrada',
      origen: ORIGEN_PARCELA.LIST,
      recintos: parcelaCuadrada({ lado: 14 }).recintos,
      geometriaOficial: parcelaCuadrada({ lado: 20 }).recintos,
    })
    traerSoloElFondo(conFondo)

    // Todos los snapshots llevan ya el fondo, el presente y el pasado.
    for (const instantanea of historialDelArranque.pila) {
      expect(instantanea.geometriaOficial).not.toBeNull()
      expect(instantanea.geometriaOficial).toHaveLength(1)
    }
  })

  it('⭐ pero SÍ suelta las dianas y el recuento: son las vecinas de otra parcela', () => {
    // Criterio 3 del diseño: cargar A, traer sus colindantes, traer el fondo de B, y
    // comprobar que no queda ni una diana de A. Es la regresión que introduciría el
    // cambio si el gancho se hubiera partido mal.
    traerSustituyendo(parcelaCuadrada({ lado: 12 }))
    publicarColindantes({ ok: true, datos: { colindantes: [parcelaCuadrada()] } })
    expect(DEL_ARRANQUE.colindantes.textContent).toBe('1')

    traerSoloElFondo(parcelaCuadrada({ lado: 12, superficieCatastral: 144 }))

    expect(arranque.registro.colindantes.at(-1)).toEqual([])
    expect(DEL_ARRANQUE.colindantes.textContent).toBe('Sin consultar')
  })

  it('⭐ y borra del MAPA los contornos de las vecinas del fondo anterior', () => {
    // `viewer/index.js` los suelta en el cambio de IDENTIDAD, y aquí la identidad no
    // se mueve: la parcela de trabajo sigue siendo la misma. Sin la llamada explícita
    // quedarían contornos fantasma diciendo «esto linda con lo tuyo».
    traerSustituyendo(parcelaCuadrada({ lado: 12 }))
    publicarColindantes({ ok: true, datos: { colindantes: [parcelaCuadrada()] } })
    const antes = arranque.registro.limpiezas

    traerSoloElFondo(parcelaCuadrada({ lado: 12, superficieCatastral: 144 }))

    expect(arranque.registro.limpiezas).toBeGreaterThan(antes)
  })

  // ── Las vecinas, DIBUJADAS (el defecto del check visual) ──────────────────
  //
  // Se traían del Catastro desde F05, las usaban por dentro el snap de F06 y la
  // invasión de F07, y no las pintaba NADIE: la ficha decía «12 parcelas
  // colindantes» y el mapa seguía exactamente igual.

  it('el visor se monta CON la capa de parcelas vecinas', () => {
    // Sin esto `visor.colindantes` vale `null` y el suscriptor que las pinta no
    // tendría dónde pintarlas (reventaría en el primer «Traer colindantes»).
    expect(arranque.opciones.colindantes).toBe(true)
  })

  it('al llegar las colindantes SE PINTAN, y a la capa llegan SIN APLANAR', () => {
    const antes = arranque.registro.pintadas.length
    const vecinas = [parcelaCuadrada(), parcelaConHueco()]

    publicarColindantes({ ok: true, datos: { colindantes: vecinas } })

    expect(
      arranque.registro.pintadas.length,
      'nadie ha pintado las vecinas: falta el suscriptor que las dibuja',
    ).toBe(antes + 1)
    const pintadas = arranque.registro.pintadas.at(-1)
    // DOS parcelas, no TRES recintos: la capa necesita la referencia catastral de
    // cada vecina para su emergente, y eso es justo lo que el aplanado pierde.
    expect(pintadas).toHaveLength(2)
    for (const vecina of pintadas) {
      expect(Array.isArray(vecina.recintos), 'una vecina sin `recintos`: viene aplanada').toBe(true)
      expect('refcat' in vecina, 'una vecina sin `refcat`: viene aplanada').toBe(true)
    }
  })

  it('EL REPARTO NO SE HA ROTO: el snap sigue recibiendo los recintos aplanados', () => {
    // La misma publicación alimenta a los dos consumidores con formas DISTINTAS
    // del mismo resultado. Unificarlas dejaría los emergentes mudos (si se aplana
    // para todos) o el snap sin dianas (si no se aplana para nadie).
    publicarColindantes({
      ok: true,
      datos: { colindantes: [parcelaCuadrada(), parcelaConHueco()] },
    })

    const dianas = arranque.registro.colindantes.at(-1)
    expect(dianas).toHaveLength(3) // 1 exterior + (1 exterior + 1 hueco)
    for (const recinto of dianas) expect(Array.isArray(recinto.vertices)).toBe(true)
    expect(arranque.registro.pintadas.at(-1)).toHaveLength(2)
    // Y la ficha, que es el tercer consumidor, sigue contando PARCELAS.
    expect(DEL_ARRANQUE.colindantes.textContent).toBe('2')
  })

  it('una consulta que FALLA no borra los contornos que hubiera', () => {
    // Mismo criterio que las dianas del enganche: una consulta que falla no es una
    // consulta que devuelve cero vecinas, y `cableado-catastro.js` ya la ha contado
    // en su renglón y en el panel.
    publicarColindantes({ ok: true, datos: { colindantes: [parcelaCuadrada()] } })
    const pintadas = arranque.registro.pintadas.length

    publicarColindantes({ ok: false, datos: null })

    expect(arranque.registro.pintadas).toHaveLength(pintadas)
  })
})

// ── 8 · «Generar GML» se re-evalúa también con las operaciones nuevas ────────

describe('app/main · el botón «Generar GML» sigue al store tras un undo', () => {
  it('deshacer una edición que rompía la parcela vuelve a encender el botón', () => {
    const estado = crearEstadoVista(parcelaCuadrada())
    const historial = crearHistorial()
    commit(historial, estado.get())
    const panel = crearDialogoAvisos({ documento: document })
    const gml = cablearGeneracionGml({ estado, panel, srs: SRS_DEMO })
    const edicionCableada = cablearEdicion({
      estado,
      historial,
      edicion: crearEdicionFalsa(),
      panel,
    })
    const boton = document.querySelector(SELECTOR_BOTON_GML)
    expect(boton.disabled).toBe(false)

    // Una edición que cruza el contorno consigo mismo: F02 bloquea.
    editar(estado, historial, parcelaCruzada())
    expect(boton.disabled).toBe(true)

    edicionCableada.deshacer()

    // El estado del botón corresponde al estado RESTAURADO, no al anterior.
    expect(boton.disabled).toBe(false)

    edicionCableada.rehacer()
    expect(boton.disabled).toBe(true)

    edicionCableada.destruir()
    gml.destruir()
  })
})

// ── 9 · Contrato con la barra de edición ─────────────────────────────────────

describe('app/main · el marcado de las herramientas de edición es CONTRATO', () => {
  it.each([
    ['el botón de deshacer', SELECTOR_BOTON_DESHACER],
    ['el botón de rehacer', SELECTOR_BOTON_REHACER],
    ['la casilla del snap', SELECTOR_CAMPO_SNAP],
    ['la tolerancia', SELECTOR_CAMPO_TOLERANCIA],
    ['la distancia del offset', SELECTOR_CAMPO_OFFSET],
    ['el botón del offset', SELECTOR_BOTON_OFFSET],
    ['el renglón de estado', SELECTOR_ESTADO_EDICION],
  ])('falta %s ⇒ lanza NOMBRANDO el selector', (_caso, selector) => {
    document.querySelector(selector).remove()
    const estado = crearEstadoVista(parcelaCuadrada())
    const historial = crearHistorial()
    commit(historial, estado.get())
    expect(() =>
      cablearEdicion({ estado, historial, edicion: crearEdicionFalsa(), panel: null }),
    ).toThrow(selector)
  })

  it('la guarda NO es vacua: la barra trae los siete nodos y su estado inicial', () => {
    for (const selector of [
      SELECTOR_BOTON_DESHACER,
      SELECTOR_BOTON_REHACER,
      SELECTOR_CAMPO_SNAP,
      SELECTOR_CAMPO_TOLERANCIA,
      SELECTOR_CAMPO_OFFSET,
      SELECTOR_BOTON_OFFSET,
      SELECTOR_ESTADO_EDICION,
    ]) {
      expect(document.querySelector(selector), selector).not.toBeNull()
    }
    // Los tres botones nacen apagados y la casilla marcada (ver la barra).
    for (const selector of [SELECTOR_BOTON_DESHACER, SELECTOR_BOTON_REHACER, SELECTOR_BOTON_OFFSET]) {
      expect(document.querySelector(selector).disabled, selector).toBe(true)
    }
    expect(document.querySelector(SELECTOR_CAMPO_SNAP).checked).toBe(true)
    // Y el renglón se anuncia sin robar el foco.
    expect(document.querySelector(SELECTOR_ESTADO_EDICION).getAttribute('role')).toBe('status')
  })

  it('un visor SIN edición no se cablea a medias: lanza diciendo por qué', () => {
    const estado = crearEstadoVista(parcelaCuadrada())
    const historial = crearHistorial()
    commit(historial, estado.get())
    expect(() => cablearEdicion({ estado, historial, edicion: null, panel: null })).toThrow(
      /edicion/i,
    )
  })

  it('un historial que no es el POJO de `crearHistorial` es contrato roto', () => {
    const estado = crearEstadoVista(parcelaCuadrada())
    expect(() =>
      cablearEdicion({ estado, historial: { deshacer() {} }, edicion: crearEdicionFalsa() }),
    ).toThrow(/historial/i)
  })
})

// ── F07 · T5.1 — el DIAGNÓSTICO en el ensamblaje ─────────────────────────────
//
// Vive en este fichero y no en uno propio por una razón concreta: lo que hay que
// afirmar son hechos del ARRANQUE (con qué opciones se montó el visor, cómo nace el
// CTA), y el único sitio del proyecto que los tiene capturados es este —el doble de
// `crearVisor` de la decisión 3 y su `arranque.opciones`—. Un fichero nuevo
// duplicaría ese arnés entero (cáscara real, dos dobles, el cromo del mapa) para
// tres afirmaciones. El CABLEADO en sí tiene su propia suite completa, con su propio
// arnés y sin doblar nada del visor: `test/app/diagnostico.dom.test.js`.

describe('app/main · F07 · el diagnóstico, montado y cableado en el arranque', () => {
  it('el visor se monta con `diagnostico: true`', () => {
    // `true` y no un objeto: las dos claves que admite valen aquí lo que sus
    // defectos, y escribirlas fingiría una decisión que no se ha tomado.
    expect(arranque.opciones.diagnostico).toBe(true)
  })

  it('el cajón del arranque existe y nace CERRADO', () => {
    // Montar el diagnóstico no es abrirlo: un cajón que se abriera solo taparía el
    // mapa con algo que nadie ha pedido.
    expect(diagnosticoVivo).not.toBeNull()
    expect(diagnosticoVivo.cajon.abierto()).toBe(false)
  })

  it('con la parcela de demo, el CTA nace ENCENDIDO', () => {
    // `parcelaDemo()` trae `geometriaOficial` —es la parcela REAL del Catastro, y su
    // contorno medido nace igual al oficial—, así que hay contra qué contrastar. Es
    // lo que se ve al abrir la app, y el `disabled` del HTML tiene que haberse
    // levantado ya: `subscribe` no notifica al suscribirse, así que esto solo pasa
    // si el cableado calcula el primer estado a mano.
    expect(parcelaDemo().geometriaOficial).not.toBeNull()
    expect(DEL_ARRANQUE.botonDiagnosticar.disabled).toBe(false)
  })

  it('el renglón del CTA se anuncia sin robar el foco', () => {
    expect(DEL_ARRANQUE.estadoDiagnosticar.getAttribute('role')).toBe('status')
  })

  // ⚠️ LO QUE **NO** SE PUEDE PROBAR AQUÍ, y por qué está escrito:
  // «la superficie de la ficha y la del cajón coinciden» —el invariante de los dos
  // suscriptores— no cabe en este fichero. El cajón del ARRANQUE lo destruye el
  // primer `beforeEach` (`desmontarCromoDelMapa`), así que a partir del primer test
  // el cajón que hay en `diagnosticoVivo` es otro, y NO está cableado: `pintar`
  // sobre él no lo llama nadie. Capturarlo antes tampoco vale, porque `destruir()`
  // lo deja inerte a propósito.
  //
  // Ese invariante es de la ACEPTACIÓN de F07 y se afirma en
  // `test/diagnostico/aceptacion-f07.dom.test.js`, que monta la app entera sin
  // doblar el visor — que es la única forma de tener las dos vistas vivas a la vez.
})

// ── F18 · «Dibujar recinto» en la rama PARCELA ──────────────────────────────
//
// Desde F12 se dibuja un recinto vértice a vértice, pero solo en la rama EDIFICIO.
// Aquí se blinda la otra mitad, que es la que da sentido a importar un
// levantamiento de PUNTOS SUELTOS: las dianas ya estaban (paso 9) y faltaba la
// herramienta con la que unirlas.
//
// Se dibuja sobre el `L.Map` REAL del arnés y con la BARRA REAL, no con dobles: lo
// que se prueba es que el clic acaba en el store y que el botón dice la verdad, y
// las dos cosas pasan por piezas que ya existen.

describe('app/main · «Dibujar recinto» en la rama PARCELA (F18)', () => {
  /** Los tres clics y el doble que cierra. Es el gesto del usuario, sin atajos. */
  function dibujarTriangulo(mapa) {
    for (const [lat, lng] of [
      [40.45, -3.7],
      [40.4501, -3.7],
      [40.4501, -3.6999],
    ]) {
      mapa.fire('click', { latlng: { lat, lng } })
    }
    mapa.fire('dblclick', { latlng: { lat: 40.4501, lng: -3.6999 } })
  }

  /** El cableado con las dos piezas del dibujo puestas y la barra REAL. */
  function cablearConDibujo(parcelaInicial = parcelaCuadrada()) {
    return cablear(parcelaInicial, { mapa: mapaVivo, srs: SRS_DEMO, barra: barraViva })
  }

  const botonDibujar = () => document.querySelector('[data-accion="dibujar-recinto"]')

  it('sin el mando, la palabra no aparece y el botón no dibuja nada', () => {
    // El mando lo empuja `aplicarEdicion`, que es de `app/main.js`. Un cableado
    // recién montado NO lo tiene: la pantalla nace en Entrada, no en Edición.
    const m = cablearConDibujo()
    expect(botonDibujar().hidden).toBe(true)
    expect(m.cableado.alternarDibujo()).toBe(false)
    expect(m.cableado.dibujando()).toBe(false)
    // Y la edición sigue encendida: nadie la ha apagado para dibujar.
    expect(m.edicion.activa()).toBe(true)
  })

  it('con el mando, la palabra aparece y el trazo cerrado SUSTITUYE al exterior', () => {
    const m = cablearConDibujo()
    m.cableado.mandoDeDibujo(true)
    expect(botonDibujar().hidden).toBe(false)

    const verticesAntes = m.estado.get().recintos[0].vertices.length
    m.cableado.alternarDibujo()
    expect(m.cableado.dibujando()).toBe(true)

    dibujarTriangulo(mapaVivo)

    const recintos = m.estado.get().recintos
    expect(recintos).toHaveLength(1)
    expect(recintos[0].vertices.length).toBeGreaterThanOrEqual(3)
    expect(recintos[0].vertices.length).not.toBe(verticesAntes)
    expect(m.cableado.dibujando()).toBe(false)
  })

  it('⛔ mientras se dibuja, la edición está APAGADA — y vuelve al cerrar', () => {
    // Los dos módulos escuchan `click` en el MISMO mapa. Sin apagar la edición, el
    // clic que pone una esquina seleccionaría además un lindero de la parcela vieja
    // —y con «Borrar vértices» armado le borraría uno—.
    const m = cablearConDibujo()
    m.cableado.mandoDeDibujo(true)

    m.cableado.alternarDibujo()
    expect(m.edicion.activa()).toBe(false)
    expect(m.edicion.llamadas.activa.at(-1)).toBe(false)

    dibujarTriangulo(mapaVivo)
    expect(m.edicion.activa()).toBe(true)
  })

  it('⛔ «Escape» cancela, repone la edición y despega el botón', () => {
    // EL CASO QUE NO TENÍA CANAL. De las cinco formas de terminar un dibujo, solo
    // cerrar bien avisaba; `Escape` paraba el trazo dentro de `viewer/dibujo.js` sin
    // decírselo a nadie. Aquí eso dejaría la edición apagada PARA SIEMPRE.
    const m = cablearConDibujo()
    m.cableado.mandoDeDibujo(true)
    m.cableado.alternarDibujo()
    mapaVivo.fire('click', { latlng: { lat: 40.45, lng: -3.7 } })
    expect(m.edicion.activa()).toBe(false)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(m.cableado.dibujando()).toBe(false)
    expect(m.edicion.activa()).toBe(true)
    expect(botonDibujar().getAttribute('aria-pressed')).toBe('false')
    // Y el store no se ha tocado: cancelar no es cerrar.
    expect(m.estado.get().recintos).toHaveLength(1)
    expect(m.estado.get().recintos[0].vertices.length).toBe(parcelaCuadrada().recintos[0].vertices.length)
  })

  it('perder el mando cancela el trazo a medias y esconde la palabra', () => {
    // Un dibujo a medias que sobreviviera a un cambio de pantalla volvería a la vida
    // sobre otra geometría. Es lo que el modo borrar ya tiene prohibido por escrito.
    const m = cablearConDibujo()
    m.cableado.mandoDeDibujo(true)
    m.cableado.alternarDibujo()
    mapaVivo.fire('click', { latlng: { lat: 40.45, lng: -3.7 } })

    m.cableado.mandoDeDibujo(false)

    expect(m.cableado.dibujando()).toBe(false)
    expect(botonDibujar().hidden).toBe(true)
    expect(m.edicion.activa()).toBe(true)
  })

  it('⭐ el recinto dibujado se DESHACE como cualquier otra edición', async () => {
    // La red que hace admisible reemplazar el exterior: el dibujo commitea, así que
    // `Ctrl+Z` devuelve la parcela entera. Sin el commit, cuatro clics serían
    // irreversibles.
    const m = cablearConDibujo()
    const antes = m.estado.get().recintos[0].vertices.length
    m.cableado.mandoDeDibujo(true)
    m.cableado.alternarDibujo()
    dibujarTriangulo(mapaVivo)
    await cederMicrotarea()

    expect(m.cableado.deshacer()).toBe(true)
    expect(m.estado.get().recintos[0].vertices.length).toBe(antes)
  })

  it('⛔ los huecos se pierden con el exterior, y se DICE con su número', () => {
    // `recintos[0]` es el EXTERIOR y los demás son HUECOS (modelo §4.3), así que
    // sustituir el primero se los lleva. Callarlo sería perder trabajo en silencio.
    const conHueco = crearParcela({
      idLocal: 'prueba-dibujo',
      origen: ORIGEN_PARCELA.LIST,
      recintos: [
        crearRecinto(parcelaCuadrada().recintos[0].vertices, TIPO_RECINTO.EXTERIOR),
        crearRecinto(
          [
            [440010, 4480010],
            [440020, 4480010],
            [440020, 4480020],
          ],
          TIPO_RECINTO.HUECO,
        ),
      ],
    })
    const m = cablearConDibujo(conHueco)
    m.cableado.mandoDeDibujo(true)
    m.cableado.alternarDibujo()
    dibujarTriangulo(mapaVivo)

    expect(m.estado.get().recintos).toHaveLength(1)
    const dicho = textosDelPanel().join(" ")
    expect(dicho).toMatch(/hueco/i)
    expect(dicho).toMatch(/Ctrl\+Z|Deshacer/i)
  })

  it('sin parcela abierta, el recinto NO se tira en silencio', () => {
    const m = cablearConDibujo(null)
    m.cableado.mandoDeDibujo(true)
    m.cableado.alternarDibujo()
    dibujarTriangulo(mapaVivo)

    expect(m.estado.get()).toBeNull()
    expect(textosDelPanel().join(" ")).toMatch(/no hay ninguna parcela abierta/i)
  })
})

// ── ⛔ El defecto del 2026-08-19: «no me deja borrar por más que pincho» ──────
//
// Reportado con captura: un recinto de TRES vértices, la papelera ROJA —armada,
// prometiendo— y ni un borrado. La aplicación tenía razón y lo estaba diciendo:
// quitar un vértice de tres deja un segmento, así que edit/vertices.js lo rechaza
// SIEMPRE. Pero lo decía DESPUÉS del gesto, en una tarjeta del panel plegado y
// agrupada como «×6» — que es como seis intentos se leen como «1 error» en la
// cabecera.
//
// El defecto no era el rechazo: era dejar ARMAR un modo que no podía actuar ni una
// sola vez. Y tenía un hermano peor, introducido por F18 · paso 10: con un dibujo
// en curso la edición está apagada, así que el modo se armaba igual y los clics no
// borraban NI AVISABAN — silencio absoluto.

describe('app/main · «Borrar vértices» no se arma si no puede borrar nada', () => {
  /** Un triángulo: el mínimo. Ningún vértice suyo se puede quitar. */
  const triangulo = () =>
    crearParcela({
      idLocal: 'prueba-triangulo',
      origen: ORIGEN_PARCELA.LIST,
      recintos: [
        crearRecinto(
          [
            [439300, 4479650],
            [439310, 4479650],
            [439310, 4479660],
          ],
          TIPO_RECINTO.EXTERIOR,
        ),
      ],
    })

  it('⛔ con un recinto en el mínimo, el botón nace APAGADO y con su motivo', async () => {
    const m = cablear(triangulo(), { barra: barraViva })
    await cederMicrotarea()

    expect(m.borrar.disabled).toBe(true)
    // El motivo va en la PISTA, que es donde el usuario mira cuando un icono no
    // responde, y de paso en el nombre accesible.
    expect(m.borrar.dataset.pista).toMatch(/mínimo de 3|no se pueda borrar/i)
  })

  it('con un cuadrado sí se puede: el botón está vivo y sin motivo pegado', async () => {
    const m = cablear(parcelaCuadrada(), { barra: barraViva })
    await cederMicrotarea()

    expect(m.borrar.disabled).toBe(false)
    expect(m.borrar.dataset.pista).not.toMatch(/mínimo de 3/i)
  })

  it('⭐ y se DESARMA solo cuando la geometría baja al mínimo borrando', async () => {
    // El camino normal para llegar aquí: se borran vértices hasta dejar tres.
    // Dejar la papelera roja sobre un modo que ya no puede actuar es la misma
    // mentira, alcanzada por el otro lado.
    const m = cablear(parcelaCuadrada(), { barra: barraViva })
    await cederMicrotarea()
    m.borrar.click()
    expect(m.edicion.modoBorrar()).toBe(true)

    await editar(m.estado, m.historial, triangulo())

    expect(m.edicion.modoBorrar()).toBe(false)
    expect(m.borrar.disabled).toBe(true)
  })

  it('un hueco con vértices de sobra basta: se pregunta por ANILLO, no por la parcela', async () => {
    // Con un exterior de 3 y un hueco de 4, del hueco SÍ se puede quitar. Preguntar
    // «¿tiene la parcela más de 3 vértices?» daría true también con dos recintos de
    // tres, donde no se puede tocar ninguno.
    const conHueco = crearParcela({
      idLocal: 'prueba-mixta',
      origen: ORIGEN_PARCELA.LIST,
      recintos: [
        crearRecinto(triangulo().recintos[0].vertices, TIPO_RECINTO.EXTERIOR),
        crearRecinto(
          [
            [439302, 4479652],
            [439304, 4479652],
            [439304, 4479654],
            [439302, 4479654],
          ],
          TIPO_RECINTO.HUECO,
        ),
      ],
    })
    const m = cablear(conHueco, { barra: barraViva })
    await cederMicrotarea()
    expect(m.borrar.disabled).toBe(false)
  })

  it('⛔ …y DOS recintos de tres no suman: no se puede tocar ninguno', async () => {
    // El caso que distingue «por anillo» de «en total», y lo pidió una mutación que
    // sobrevivía: sumando vértices salen 6 —más de 3— y el botón se encendería
    // sobre una geometría en la que ningún borrado es posible. Es el mismo defecto
    // reportado, alcanzado por una geometría distinta.
    const dosTriangulos = crearParcela({
      idLocal: 'prueba-dos-triangulos',
      origen: ORIGEN_PARCELA.LIST,
      recintos: [
        crearRecinto(triangulo().recintos[0].vertices, TIPO_RECINTO.EXTERIOR),
        crearRecinto(
          [
            [439302, 4479652],
            [439304, 4479652],
            [439304, 4479654],
          ],
          TIPO_RECINTO.HUECO,
        ),
      ],
    })
    const m = cablear(dosTriangulos, { barra: barraViva })
    await cederMicrotarea()
    expect(m.borrar.disabled).toBe(true)
  })
})

describe('app/main · dibujar, borrar e insertar son EXCLUYENTES (2026-08-19)', () => {
  const conDibujo = () =>
    cablear(parcelaCuadrada(), { mapa: mapaVivo, srs: SRS_DEMO, barra: barraViva })

  it('⛔ armar «Borrar» con un trazo a medias lo CANCELA: nada de clics mudos', async () => {
    // Desde F18 · paso 10 el dibujo apaga la edición mientras dura. Sin esto, el
    // modo se armaba igual y `alClicMapa` salía antes de mirarlo: papelera roja y
    // clics que no borran NI AVISAN.
    const m = conDibujo()
    await cederMicrotarea()
    m.cableado.mandoDeDibujo(true)
    m.cableado.alternarDibujo()
    expect(m.cableado.dibujando()).toBe(true)
    expect(m.edicion.activa()).toBe(false)

    m.borrar.click()

    expect(m.cableado.dibujando()).toBe(false)
    // Y la edición vuelve, que es lo que hace que el modo recién armado sirva.
    expect(m.edicion.activa()).toBe(true)
    expect(m.edicion.modoBorrar()).toBe(true)
  })

  it('y al revés: empezar a dibujar DESARMA los dos modos', async () => {
    const m = conDibujo()
    await cederMicrotarea()
    m.borrar.click()
    expect(m.edicion.modoBorrar()).toBe(true)

    m.cableado.mandoDeDibujo(true)
    m.cableado.alternarDibujo()

    expect(m.edicion.modoBorrar()).toBe(false)
    expect(m.edicion.modoInsertar()).toBe(false)
    expect(m.cableado.dibujando()).toBe(true)
  })
})

// ── ⭐ Los puntos sueltos del levantamiento (2026-08-19) ─────────────────────
//
// ⛔ **`viewer/edicion.js#fijarPuntos` llevaba desde el paso 9 de F18 escrito,
// documentado y con catorce pruebas, y su único llamante en todo el repo era su
// propia prueba.** El enganche a lo medido existía en el catálogo de
// `edit/snap.js` y no había forma de llegar a él desde la aplicación. Este bloque
// es el guardián de que ese cable no se vuelva a soltar, y de que no se suelte a
// medias: enseñar los puntos sin engancharlos, o al revés, es peor que ninguna de
// las dos cosas — el usuario apuntaría a un sitio y el vértice caería en otro.
describe('app/main · los puntos del levantamiento se PINTAN y ENGANCHAN, siempre a la vez', () => {
  const NUBE = [
    [439237, 4479655],
    [439257, 4479655],
    [439257, 4479675],
  ]

  const conPuntos = (puntos) =>
    crearParcela({
      idLocal: 'levantamiento.dxf',
      // Cero recintos: es el estado real de un fichero de campo importado SIN unir.
      recintos: [],
      puntosLevantamiento: puntos,
      origen: ORIGEN_PARCELA.DXF,
    })

  beforeEach(() => {
    arranque.registro.puntosPintados.length = 0
    arranque.registro.puntosFijados.length = 0
  })

  it('⭐ una parcela con puntos y CERO recintos llega a las dos piezas', () => {
    estadoDelArranque.set(conPuntos(NUBE))
    expect(arranque.registro.puntosPintados.at(-1)).toEqual(NUBE)
    expect(arranque.registro.puntosFijados.at(-1)).toEqual(NUBE)
  })

  it('⛔ y llegan EXACTAMENTE los mismos: dibujo y enganche no pueden divergir', () => {
    estadoDelArranque.set(conPuntos(NUBE))
    expect(arranque.registro.puntosPintados.at(-1)).toEqual(arranque.registro.puntosFijados.at(-1))
    expect(arranque.registro.puntosPintados).toHaveLength(arranque.registro.puntosFijados.length)
  })

  it('va por el STORE, así que sirve para TODAS las puertas y no solo para importar', () => {
    // Recuperar un expediente guardado, abrir un proyecto y `Ctrl+Z` escriben en
    // el mismo sitio. Colgarlo del gancho de la medición habría dejado esas tres
    // sin puntos, y la diferencia no se ve hasta que alguien intenta apuntar.
    estadoDelArranque.set(conPuntos(NUBE))
    estadoDelArranque.set(conPuntos([[439300, 4479700]]))
    expect(arranque.registro.puntosFijados.at(-1)).toEqual([[439300, 4479700]])
  })

  it('una parcela SIN puntos los suelta: los del expediente anterior no se quedan', () => {
    estadoDelArranque.set(conPuntos(NUBE))
    estadoDelArranque.set(parcelaCuadrada())
    expect(arranque.registro.puntosPintados.at(-1)).toEqual([])
    expect(arranque.registro.puntosFijados.at(-1)).toEqual([])
  })

  it('y `null` en el store tampoco revienta ni deja dianas colgadas', () => {
    estadoDelArranque.set(conPuntos(NUBE))
    expect(() => estadoDelArranque.set(null)).not.toThrow()
    expect(arranque.registro.puntosFijados.at(-1)).toEqual([])
  })
})

// ── ⭐ F24 · Quitar la nube: el único mando que se la lleva ───────────────────
//
// ⛔ **EL HUECO QUE ESTO CIERRA.** Los puntos viven en el modelo, así que se
// guardan con el expediente, viajan en el fichero de proyecto y se vuelven a
// pintar cada vez que se recupera. En cuanto el contorno está dibujado encima
// dejan de servir para nada, y hasta hoy la única forma de perderlos era no
// haberlos importado: con 88 puntos sobre una parcela ya cerrada, el mapa se
// quedaba tapado para siempre.
//
// Lo que se mide aquí es el MODELO y la RED. Que el botón exista, se esconda sin
// puntos y lleve la cuenta en el nombre lo mide `test/viewer/barra-edicion.dom.test.js`;
// que el clic del usuario llegue de verdad hasta aquí lo mide el navegador
// (`scripts/smoke-navegador/28-puntos-sueltos.js`), que es la única herramienta que
// ve el botón que se pulsa.
describe('app/main · «Quitar los puntos» vacía la nube y deja una red para volver', () => {
  const NUBE = [
    [439237, 4479655],
    [439257, 4479655],
    [439257, 4479675],
  ]

  const conPuntos = (puntos) =>
    crearParcela({
      idLocal: 'levantamiento.dxf',
      refcat: '1234567VK4713D',
      recintos: [],
      puntosLevantamiento: puntos,
      origen: ORIGEN_PARCELA.DXF,
    })

  const original = estadoDelArranque.get()
  const indiceOriginal = historialDelArranque.indice
  afterEach(() => {
    estadoDelArranque.set(original)
    historialDelArranque.indice = indiceOriginal
  })

  it('⭐ el botón que el ensamblaje cableó lleva la CUENTA, y se va con la nube', () => {
    // El nodo es el de `crearVisor`, no uno recién montado: ver `DEL_ARRANQUE`.
    const boton = DEL_ARRANQUE.botonQuitarPuntos
    expect(boton, 'la barra no fabricó el botón').not.toBeNull()

    estadoDelArranque.set(conPuntos(NUBE))
    expect(boton.hidden).toBe(false)
    expect(boton.dataset.pista).toContain('3 puntos sueltos')

    // Y sin puntos se esconde SOLO, por el store: es la misma suscripción que
    // pinta la capa y fija las dianas, no un tercer sitio que se pueda quedar viejo.
    estadoDelArranque.set(parcelaCuadrada())
    expect(boton.hidden).toBe(true)
  })

  it('⭐ vacía `puntosLevantamiento` y NO toca nada más del expediente', () => {
    estadoDelArranque.set(conPuntos(NUBE))
    const antes = estadoDelArranque.get()

    quitarPuntosLevantamiento()

    const despues = estadoDelArranque.get()
    expect(despues.puntosLevantamiento).toEqual([])
    // La lección de F21 por el otro lado: allí se perdía un campo que un
    // compositor no arrastraba; aquí no se compone nada, se clona el expediente
    // entero, y por eso lo demás tiene que seguir clavado.
    expect(despues.idLocal).toBe(antes.idLocal)
    expect(despues.refcat).toBe(antes.refcat)
    expect(despues.recintos).toEqual(antes.recintos)
    expect(despues.origen).toBe(antes.origen)
    // Objeto NUEVO, no el mismo mutado: el store publica por identidad.
    expect(despues).not.toBe(antes)
  })

  it('⛔ lo DICE, con la cuenta y nombrando el atajo que lo devuelve', () => {
    // Lo que se acaba de borrar vino de un fichero que el usuario puede no tener a
    // mano. Decir solo «quitados» sería contar la pérdida sin contar la salida.
    estadoDelArranque.set(conPuntos(NUBE))
    quitarPuntosLevantamiento()
    // Se busca en TODA la lista y no en `.at(-1)`: el panel conserva lo dicho
    // antes (el aviso de IndexedDB del arranque, por ejemplo) y agrupa las
    // repeticiones, así que el orden de las tarjetas no es asunto de este test.
    const dichos = textosDelPanelDelArranque()
    expect(dichos).toContain(mensajePuntosQuitados(3))
    expect(mensajePuntosQuitados(3)).toContain('3 puntos sueltos')
    expect(mensajePuntosQuitados(3)).toContain('Ctrl+Z')
  })

  it('⭐ LA RED: commitea, así que la pila devuelve la nube entera', () => {
    // Ésta es la prueba que hace admisible que un botón se lleve 88 puntos de un
    // clic. Sin el `commit` —o con él ANTES del `set`— el mando sería irreversible
    // y la promesa que el propio botón hace en su nombre, mentira.
    estadoDelArranque.set(conPuntos(NUBE))
    commit(historialDelArranque, estadoDelArranque.get())

    quitarPuntosLevantamiento()
    expect(puedeDeshacer(historialDelArranque)).toBe(true)

    const previa = deshacerPila(historialDelArranque)
    expect(previa.puntosLevantamiento).toEqual(NUBE)

    // Y rehacer los vuelve a quitar: la operación es una más de la pila, no un
    // caso aparte.
    const siguiente = rehacerPila(historialDelArranque)
    expect(siguiente.puntosLevantamiento).toEqual([])
  })

  it('sin puntos que quitar NO revienta, no escribe y lo dice', () => {
    // No debería llegar —el botón está escondido—, pero un clic que no hace nada y
    // no lo cuenta es la regla de oro 1 rota por omisión.
    estadoDelArranque.set(parcelaCuadrada())
    const antes = estadoDelArranque.get()
    const commitsAntes = historialDelArranque.pila.length

    expect(() => quitarPuntosLevantamiento()).not.toThrow()

    expect(estadoDelArranque.get()).toBe(antes)
    expect(historialDelArranque.pila.length).toBe(commitsAntes)
    expect(textosDelPanelDelArranque()).toContain(MENSAJE_SIN_PUNTOS_QUE_QUITAR)
  })

  it('con el store en `null` tampoco revienta', () => {
    estadoDelArranque.set(null)
    expect(() => quitarPuntosLevantamiento()).not.toThrow()
    expect(textosDelPanelDelArranque()).toContain(MENSAJE_SIN_PUNTOS_QUE_QUITAR)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T2 · EL CABLEADO EMPUJA LA SELECCIÓN AL RENGLÓN DE SITUACIÓN (2026-08-19)
// ═════════════════════════════════════════════════════════════════════════════
//
// Los DOS canales, y por qué hay dos. `cablearEdicion` escribe en:
//
//   · el `role="status"` (`anunciar`, que se llamaba `decir` hasta T3) — lo de siempre, **oculto salvo error**, con las
//     frases en pasado para el lector de pantalla. Aquí NO se ha tocado nada, y
//     estas pruebas lo afirman explícitamente para que se note si algún día pasa.
//   · `barra.ladoSeleccionado(...)` — el renglón VISIBLE de la barra, en presente.
//     Es el único empujón nuevo de T2: insertar, borrar y dibujar ya se reflejaban.

describe('app/main · T2 · la selección alimenta el renglón de situación', () => {
  const situacion = () => document.querySelector(`.${CLASE_BARRA.SITUACION}`)

  it('seleccionar un lindero lo ENSEÑA, y soltarlo lo esconde', () => {
    const m = cablear(parcelaCuadrada(), { barra: barraViva })
    expect(situacion().hidden, 'el arranque no planta un cartel sobre el mapa').toBe(true)

    m.edicion.seleccionar({ anillo: 0, indice: 0 })
    expect(situacion().hidden).toBe(false)
    expect(situacion().textContent).toBe('Lindero seleccionado')

    m.edicion.seleccionar(null)
    expect(situacion().hidden).toBe(true)
  })

  it('⛔ y el `role="status"` sigue EXACTAMENTE como estaba: oculto y en pasado', () => {
    const m = cablear(parcelaCuadrada(), { barra: barraViva })
    m.edicion.seleccionar({ anillo: 0, indice: 0 })

    // El texto de siempre, con su redacción de siempre (transición, no estado).
    expect(m.renglon.textContent).toMatch(/ya puedes desplazarlo/i)
    // Y sigue recortado a 1 px: lo escribe `RENGLON_OCULTO` para todo lo que no
    // sea un error. Si esto se rompe, ha vuelto el cartel del 2026-08-18.
    expect(m.renglon.style.position).toBe('absolute')
    expect(m.renglon.style.width).toBe('1px')
  })

  it('⚠️ los dos nodos dicen cosas DISTINTAS a la vez, y eso es el diseño', () => {
    const m = cablear(parcelaCuadrada(), { barra: barraViva })
    m.edicion.seleccionar({ anillo: 0, indice: 0 })

    // El de los desenlaces habla en PASADO de la transición; el visible habla en
    // PRESENTE del estado. Que digan lo mismo sería la señal de que sobra uno.
    expect(m.renglon.textContent).toMatch(/ya puedes desplazarlo/i)
    expect(situacion().textContent).toBe('Lindero seleccionado')
    expect(situacion().textContent).not.toBe(m.renglon.textContent)
  })

  it('sin barra el cableado NO revienta (hay montajes sin visor)', () => {
    // `barra` es opcional y por eso el empujón va con doble `?.`. Un montaje sin
    // visor tiene que seguir escribiendo el `role="status"` y nada más.
    const m = cablear(parcelaCuadrada())
    expect(() => m.edicion.seleccionar({ anillo: 0, indice: 0 })).not.toThrow()
    expect(m.renglon.textContent).toMatch(/ya puedes desplazarlo/i)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T10 · EL DOBLE ANUNCIO, SOBRE EL CABLEADO DE VERDAD (2026-08-20)
// ═════════════════════════════════════════════════════════════════════════════
//
// `test/viewer/barra-edicion.dom.test.js` ya vigila que el renglón visible no sea
// anunciable, pero lo hace sobre la barra SOLA. El fallo que el diseño marcó como
// crítico solo puede darse aquí: hacen falta los DOS canales escribiendo a la vez
// sobre el mismo hecho, y el único que los tiene a los dos es `cablearEdicion`.
//
// ⚠️ **Es el más silencioso de todos los huecos de aquella tabla**: si al renglón
// de situación le faltara el `aria-hidden`, en pantalla no se notaría nada en
// absoluto y quien va por lector de pantalla oiría cada selección DOS VECES.
describe('app/main · T10 · con los dos canales vivos, ningún hecho se oye dos veces', () => {
  /**
   * Lo que un lector de pantalla LEERÍA de un subárbol. Se salta lo que lleva
   * `aria-hidden="true"` y lo que está `hidden`; **no** se salta lo recortado a
   * 1×1 px, que es justo lo que sigue anunciándose (ver `RENGLON_OCULTO`).
   */
  const textoAnunciable = (raiz, excepto = null) => {
    const trozos = []
    const bajar = (n) => {
      if (n.nodeType === 3) return void trozos.push(n.textContent)
      if (n.nodeType !== 1) return
      if (n === excepto) return
      if (n.hidden || n.getAttribute('aria-hidden') === 'true') return
      for (const hijo of n.childNodes) bajar(hijo)
    }
    bajar(raiz)
    return trozos.join(' ').replace(/\s+/g, ' ').trim()
  }

  const situacion = () => document.querySelector(`.${CLASE_BARRA.SITUACION}`)

  /**
   * Lo que se anuncia de la barra **descontando el `role="status"`**, que es el
   * único que TIENE que anunciar estos hechos.
   *
   * ⚠️ **Y descontarlo no es hacerle un favor a la prueba: sin eso la prueba no
   * puede afirmar nada.** Los dos canales dicen cosas distintas —«Lindero
   * seleccionado» en presente contra «Lindero seleccionado: ya puedes
   * desplazarlo.» en pasado— pero el corto es PREFIJO del largo, así que buscar el
   * texto visible por toda la barra siempre lo encuentra… en el nodo correcto.
   * La primera versión de este `it` se puso roja justo por ahí. Lo que hay que
   * afirmar es «además del `role="status"`, nadie más lo dice».
   */
  const restoDeLaBarra = () =>
    textoAnunciable(
      situacion().closest(`.${CLASE_BARRA.CONTENEDOR}`),
      document.querySelector(`.${CLASE_BARRA.ESTADO}`),
    )

  it('⭐ el hecho se VE una vez y se OYE una vez, y no son el mismo nodo', () => {
    const m = cablear(parcelaCuadrada(), { barra: barraViva })
    m.edicion.seleccionar({ anillo: 0, indice: 0 })

    // Se ve: el renglón de la barra, en presente.
    expect(situacion().hidden).toBe(false)
    expect(situacion().textContent).toBe('Lindero seleccionado')

    // Se oye: el `role="status"`, en pasado y recortado a 1 px.
    expect(m.renglon.textContent).toMatch(/ya puedes desplazarlo/i)
    expect(textoAnunciable(m.renglon)).toBe(m.renglon.textContent)

    // Y lo que se ve NO se oye: quitando el `role="status"`, en la barra no queda
    // ni una palabra del renglón visible.
    expect(restoDeLaBarra()).not.toContain('Lindero seleccionado')
  })

  it('⛔ y con un modo armado ADEMÁS de la selección, sigue sin duplicarse', () => {
    // El caso peor: los dos canales escribiendo a la vez sobre dos hechos, con el
    // renglón visible uniéndolos con « · ». Si el `aria-hidden` cayera, aquí se
    // oirían cuatro cosas donde hay dos.
    const m = cablear(parcelaCuadrada(), { barra: barraViva })
    m.edicion.seleccionar({ anillo: 0, indice: 0 })
    m.borrar.click()

    expect(situacion().textContent).toContain('Lindero seleccionado')
    expect(situacion().textContent).toContain('Modo borrar')

    const anunciable = restoDeLaBarra()
    for (const frase of situacion().textContent.split(' · ')) {
      expect(anunciable, `«${frase}» se oiría además de verse`).not.toContain(frase)
    }
  })

  it('⛔ la cautela: la barra NO se ha quedado muda para conseguirlo', () => {
    // Sin esta prueba, un `aria-hidden` puesto de más —en la fila, en el
    // contenedor— dejaría a las dos de arriba en verde por la vía equivocada: sin
    // nada que anunciar tampoco hay nada duplicado. Y sería un defecto mucho peor
    // que el que vienen a evitar.
    const m = cablear(parcelaCuadrada(), { barra: barraViva })
    m.edicion.seleccionar({ anillo: 0, indice: 0 })

    const anunciable = restoDeLaBarra()
    expect(anunciable).toContain('Deshacer')
    expect(anunciable).toContain('Ayuda sobre los gestos de edición')
  })
})

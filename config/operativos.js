// config/operativos.js — Cargador ÚNICO de las tolerancias operativas del proyecto.
//
// POR QUÉ EXISTE ESTE MÓDULO (F06, tarea T1.2). Hasta aquí el cargador vivía
// dentro de `validation/_comun.js`, porque F02 fue quien primero necesitó leer
// `config/operativos.json`. La capa de EDICIÓN (`edit/`, F06) necesita ahora
// `snapMetros`, y con el cargador donde estaba la única forma de obtenerlo sería
// `import { OPERATIVOS } from '../validation/_comun.js'`: la edición dependería
// de la validación PARA LEER UNA CONSTANTE. Es una dependencia al revés —la
// validación mira lo que la edición produce, no al contrario— y sin ninguna
// contrapartida. Así que el cargador baja a un módulo NEUTRO que no depende de
// nadie (su único import es el propio JSON), y `validation/_comun.js` lo
// RE-EXPORTA para no romper a sus consumidores. Mismo patrón, y por el mismo
// motivo, que `NIVEL` en `viewer/_comun.js`: una sola definición en todo el
// proyecto ⇒ un solo objeto en memoria ⇒ imposible que dos capas trabajen con
// tolerancias distintas creyendo que son las mismas.
//
// Regla de oro 9 (SPEC §2): estas cifras son decisiones de INGENIERÍA —hasta
// dónde llega la aritmética, qué es indistinguible del ruido, qué cabe en la
// pantalla—, NO umbrales-veredicto. La app mide y señala; el colegiado
// interpreta y firma. Por eso el fichero se llama `operativos.json` y por eso
// `config/umbrales.json` está PROHIBIDO. Ninguna de estas claves decide si algo
// es «válido»; deciden cómo se calcula o cómo se dibuja.
//
// Este módulo NO importa nada del proyecto: es una hoja del grafo de
// dependencias, y debe seguir siéndolo. Si algún día una tolerancia necesita
// derivarse de otra, se deriva AQUÍ, no en el consumidor.

import OPERATIVOS_RAW from './operativos.json' with { type: 'json' }

/**
 * Tolerancias operativas del proyecto (`config/operativos.json`), CONGELADAS
 * (`Object.freeze`) para que ningún consumidor pueda reescribir una cifra en
 * caliente y dejar al resto del programa midiendo con otra regla.
 *
 * Es la ÚNICA lectura del JSON en todo el proyecto. Quien necesite una
 * tolerancia importa de aquí (o de `validation/_comun.js`, que re-exporta este
 * mismo objeto para sus consumidores históricos de F02).
 *
 * ── F02 · validación ────────────────────────────────────────────────────────
 * @property {number} duplicadoMetros     1 mm. Dos vértices consecutivos más
 *   juntos que esto son el mismo punto capturado dos veces, no un lado.
 * @property {number} segmentoCortoMetros 5 cm. Lado sospechosamente corto para
 *   un lindero real: se AVISA, no se corrige.
 * @property {number} colinealidadGrados  179,9°. Ángulo interior por encima del
 *   cual el vértice no aporta forma (es un punto de paso, no una esquina).
 * @property {number} superficieMinimaM2  1 m². Por debajo, una «parcela» que
 *   casi seguro es un error de unidades o de escala: se AVISA.
 * @property {number} areaNulaM2          1e-6 m². Área indistinguible de cero
 *   en float64 sobre coordenadas UTM trasladadas a origen local.
 * @property {number} maxVertices         500. Techo por el que el visor y el
 *   GML dejan de ser manejables; se AVISA, nunca se trunca.
 *
 * ── F06 · edición ───────────────────────────────────────────────────────────
 * @property {number} snapMetros          **0,2 m (20 cm).** Tolerancia de snap
 *   por defecto que fija `spec/feature-06-edicion-parcela.md`: si la proyección
 *   del cursor sobre un vértice o lindero cae a menos de esta distancia, se
 *   engancha. La cifra no es arbitraria: es del mismo orden que la precisión de
 *   captura del propio Catastro (**<25 cm**, 85% ≤20 cm — SPEC §3, «tolerancias
 *   oficiales de identidad»). Enganchar por debajo del error del dato de
 *   referencia sería fingir una precisión que el parcelario no tiene. Es
 *   CONFIGURABLE por el usuario y desactivable con tecla modificadora: este
 *   valor es el punto de partida, no una ley.
 * @property {number} senoMinimoOffset    **0,01** (≈ 0,57°). Seno del ángulo
 *   mínimo entre dos rectas para considerarlas NO paralelas al calcular el
 *   offset de un lindero. El vértice nuevo sale de intersectar la recta
 *   desplazada con la del lado adyacente, y el denominador de esa intersección
 *   es proporcional a `sin θ`: por debajo de este seno la intersección es
 *   numéricamente inestable (el punto se va al infinito por ruido de float64) y
 *   la operación cae a su fallback documentado (traslación / bisel) en vez de
 *   devolver una coordenada basura con toda naturalidad.
 * @property {number} miterLimiteFactor   **4.** Tope de la razón
 *   `longitud del miter / distancia de offset` antes de biselar la esquina. Es
 *   exactamente el `stroke-miterlimit` por defecto de SVG (θ ≈ 29°), y se elige
 *   por la MISMA razón que allí: al desplazar dos lados en paralelo, la
 *   velocidad a la que se aleja el vértice de intersección diverge como
 *   `1/sin(θ/2)`, así que en ángulos agudos un offset de centímetros mueve la
 *   esquina metros. Reutilizar la constante de SVG no es pereza: es la cifra
 *   que décadas de renderizado vectorial han dado por razonable para el mismo
 *   fenómeno geométrico.
 * @property {number} acotacionMinimaPx   **44 px.** Longitud mínima EN PÍXELES
 *   que debe medir un lado EN PANTALLA para que se le pinte su acotación. Va en
 *   píxeles y no en metros a propósito, y es la única clave del fichero que no
 *   está en unidades SI: lo que hace ilegible una cota es que el número no
 *   quepa entre sus extremos, y eso depende del zoom, no del terreno. Un lindero
 *   de 3 m es perfectamente acotable ampliado y no lo es en la vista general;
 *   un umbral en metros acertaría en un zoom y mentiría en todos los demás.
 *
 * @type {Readonly<{
 *   duplicadoMetros: number, segmentoCortoMetros: number, colinealidadGrados: number,
 *   superficieMinimaM2: number, areaNulaM2: number, maxVertices: number,
 *   snapMetros: number, senoMinimoOffset: number, miterLimiteFactor: number,
 *   acotacionMinimaPx: number,
 * }>}
 */
export const OPERATIVOS = Object.freeze({ ...OPERATIVOS_RAW })

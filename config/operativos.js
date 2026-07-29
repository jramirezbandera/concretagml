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
 * ── F07 · diagnóstico de encaje ─────────────────────────────────────────────
 * Regla de oro 9 (SPEC §2), subrayado porque es donde más fácil es
 * confundirse: la app MIDE y el colegiado interpreta y firma. Ninguna de las
 * tres claves siguientes decide si una diferencia, una invasión o una
 * desviación son «aceptables» — deciden hasta dónde llega la aritmética (paso
 * de muestreo), qué es indistinguible del ruido de redondeo (grosor mínimo) y
 * qué cabe en la pantalla (px mínimos). Por eso `grosorInvasionMinimoM` NO es
 * un umbral de «invasión válida»: las intersecciones que caen por debajo se
 * siguen calculando y se devuelven en una lista `descartadas` con su área y su
 * grosor (regla de oro 1, nada desaparece en silencio); esta clave solo decide
 * en qué lista entra cada una. Y el margen OFICIAL de identidad (±0,50 m urbana
 * / ±2,00 m rústica, ≤5 % de superficie — BOE-A-2020-12111) NO está aquí ni lo
 * estará nunca: es una cifra de una norma publicada, no una decisión de
 * ingeniería de este proyecto, y vive en `diagnostico/margen.js` con la cita
 * del BOE al lado, para que nadie la trate como si fuera ajustable.
 *
 * @property {number} pasoDesviacionMetros  **0,3 m.** Paso de muestreo, EN
 *   METROS SOBRE EL TERRENO, con el que F07 recorre un lado del recinto
 *   editado para medir su desviación contra el contorno oficial (proyección
 *   punto→segmento en cada muestra, mínimo sobre todos los segmentos del
 *   contorno). Elegido para que un lindero de unos 30 m —tamaño típico de un
 *   lado urbano— dé exactamente 30 / 0,3 = **100 muestras**, del orden que
 *   pide la spec, no 3: con solo 3 muestras el punto de desviación MÁXIMA
 *   (el que se acota y resalta, §10.5) puede caer entre dos de ellas y
 *   quedar sin medir. El coste está acotado por diseño y no por el paso: el
 *   techo de vértices es `maxVertices` (500), así que en el caso más extremo
 *   pensable —un recinto de 500 vértices con lados del orden de esos mismos
 *   30 m, perímetro ≈ 15 km— el muestreo generaría del orden de 15000 / 0,3 =
 *   50000 puntos, cada uno comparado contra los ≤500 segmentos del contorno
 *   oficial: ~25 millones de proyecciones punto-segmento. Es mucho para un
 *   `requestAnimationFrame`, pero el diagnóstico se dispara UNA VEZ por
 *   operación («Diagnosticar»), no en cada fotograma de pan/zoom — la misma
 *   distinción que ya hace `viewer/acotaciones.js` entre medir en vivo y
 *   medir bajo demanda.
 * @property {number} grosorInvasionMinimoM  **0,001 m (1 mm).** Por debajo de
 *   este GROSOR, una pieza de intersección de la parcela con una colindante NO
 *   se trata como invasión: es astilla de ruido de redondeo en un lindero
 *   compartido. Dos parcelas vecinas declaran, cada una por su lado, la MISMA
 *   línea de lindero, pero el GML del WFS serializa coordenadas a 2 decimales
 *   (regla de oro 11, `gml/xml.js#elem`) — un paso de cuantización de 0,01 m.
 *   Cuando `turf.intersect()` cruza los dos polígonos, esa línea nominalmente
 *   única aparece como dos casi-paralelas separadas por ese paso de redondeo, y
 *   el hueco entre ellas es una tira de área que no representa NINGÚN solape
 *   real sobre el terreno.
 *
 *   ⛔ **ESTA CLAVE SUSTITUYE A `areaInvasionMinimaM2` (10⁻⁴ m²), QUE VIVIÓ
 *   MEDIO DÍA Y LA MEDICIÓN REFUTÓ** (2026-07-29). Aquella se calibró por
 *   analogía con `areaNulaM2` —elevar al cuadrado el paso de cuantización:
 *   (10⁻² m)² = 10⁻⁴ m²—, que supone la astilla CUADRADA. Medida sobre el
 *   fixture real (`test/fixtures/catastro/wfs-neighbour-9398516VK3799G.xml`),
 *   **la astilla es una AGUJA**: un triángulo de tres puntos casi colineales,
 *   1,72 m de base y 0,14 mm de altura. Su área es `≈ ½·L·δ` —con `L` la
 *   longitud del lindero compartido en METROS y `δ ≤ 5·10⁻³ m` el desvío de
 *   redondeo—, no `δ²`. Consecuencia medida: las dos astillas reales
 *   (1,23 cm² y 3,77 cm²) SUPERABAN el umbral, así que la parcela oficial
 *   «invadía» a dos de sus cuatro colindantes oficiales **sin que nadie
 *   hubiera tocado un vértice**. Era el falso positivo exacto que la clave
 *   existía para evitar, y en el único sitio donde la regla de oro 9 admite
 *   ámbar.
 *
 *   **Por qué el GROSOR y no un área más grande.** El área de la aguja crece
 *   con `L`, que es la longitud del lindero: cualquier umbral de área hay que
 *   recalibrarlo según lo largo que sea el lindero, y subirlo hasta cubrir el
 *   peor caso (7,5·10⁻² m² con L = 30 m) se tragaría invasiones pequeñas de
 *   verdad. El grosor **no depende de `L`**: una aguja de redondeo mide
 *   décimas de milímetro de ancho por larga que sea, y una invasión real mide
 *   centímetros. Sobre las piezas medidas la separación es de tres órdenes de
 *   magnitud (0,071 mm la astilla real; 4,9 cm una franja invadida de 2 m ×
 *   5 cm), así que la cifra no está apretada por ningún lado.
 *
 *   **Y el valor no se inventa: es `duplicadoMetros`.** Ese 1 mm ya significa
 *   en este fichero «dos puntos más juntos que esto son el mismo punto». Una
 *   pieza más delgada que la distancia a la que consideramos dos puntos
 *   idénticos es, por definición, una pieza entre dos linderos que
 *   consideramos idénticos. Se declara como clave propia y no se lee
 *   `duplicadoMetros` directamente porque son dos decisiones distintas que hoy
 *   coinciden, y el día que una cambie no debe arrastrar a la otra.
 *
 *   **Por qué NO viola la regla de oro 9:** no decide si una invasión es
 *   aceptable —eso es indelegablemente del colegiado que firma—, decide si lo
 *   que `turf.intersect()` devolvió ES una intersección o es ruido numérico
 *   del redondeo del propio WFS. Un umbral de ÁREA sí se acercaba a un
 *   veredicto («una invasión de 5 cm² no cuenta»); uno de grosor dice algo
 *   distinto: «esto no es una superficie, es la misma línea escrita dos veces
 *   con 1 cm de precisión». Y lo descartado no se pierde: F07 lo reporta en
 *   `descartadas` con su área Y su grosor, así que un técnico que desconfíe de
 *   esta cifra puede comprobarla él mismo.
 * @property {number} cotaDiagnosticoMinimaPx  **12 px.** Longitud mínima EN
 *   PÍXELES DE PANTALLA para rotular una cota del diagnóstico (p. ej. la
 *   desviación máxima de un lindero). NO comparte valor con
 *   `acotacionMinimaPx` (44 px), y la razón es la misma que separa ambos
 *   casos: los 44 px de `acotacionMinimaPx` acotan cuánto necesita el RÓTULO
 *   para caber EN LÍNEA, centrado entre los dos extremos del lado que mide —
 *   ahí no hay más sitio que el que deja el propio lado. Una cota de
 *   diagnóstico, en cambio, lleva LÍNEA GUÍA (SPEC feature-07, «Representación»):
 *   el rótulo puede colocarse en cualquier hueco libre del lienzo y solo la
 *   línea guía apunta al segmento medido, así que el límite de 44 px —pensado
 *   para que quepa un texto— no aplica aquí. Lo que sí sigue haciendo falta es
 *   que el segmento señalado sea un hueco REAL y no un punto: por debajo de
 *   unos pocos píxeles, el punto medido y el punto oficial se dibujan
 *   solapados (el marcador de vértice del visor mide 10 px de lado,
 *   `viewer/sincronizacion.js#LADO_VERTICE_PX`) y una línea guía apuntando
 *   a «la diferencia entre estos dos puntos» sería un dedo señalando al
 *   aire. 12 px reutiliza el mismo orden de magnitud que ya usa este visor
 *   para «distancia mínima distinguible con el puntero»
 *   (`viewer/edicion.js#UMBRAL_PUNTERIA_PX`, también 12 px): es el suelo de
 *   resolución PERCEPTIVA de este mapa, no el suelo de caber-un-texto.
 *
 * @type {Readonly<{
 *   duplicadoMetros: number, segmentoCortoMetros: number, colinealidadGrados: number,
 *   superficieMinimaM2: number, areaNulaM2: number, maxVertices: number,
 *   snapMetros: number, senoMinimoOffset: number, miterLimiteFactor: number,
 *   acotacionMinimaPx: number, pasoDesviacionMetros: number,
 *   grosorInvasionMinimoM: number, cotaDiagnosticoMinimaPx: number,
 * }>}
 */
export const OPERATIVOS = Object.freeze({ ...OPERATIVOS_RAW })

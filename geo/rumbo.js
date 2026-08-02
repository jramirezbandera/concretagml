// geo/rumbo.js — Rumbo de un lado: azimut topográfico, cuadrante cardinal y el
// nombre con el que se escribe en un lindero. Módulo PURO (sin DOM, sin red,
// sin reloj, sin Turf) y HOJA del grafo de dependencias, igual que
// `geo/metrica.js`: no importa nada, ni siquiera de `geo/`.
//
// POR QUÉ EXISTE (F09, tarea T1.2). La descripción literaria del lindero
// (`report/literal.js`, spec/feature-09 §«Descripción literaria») escribe frases
// como «Linda al Norte, en línea recta de 12,45 m, con la parcela 98 del
// polígono 8». La longitud ya la da `geo/metrica.js#longitudesDeLados`; el
// colindante lo da el WFS (F05). Lo que faltaba era el «al Norte»: la
// ORIENTACIÓN de cada lado respecto al Norte.
//
// Y no estaba. Lo más parecido que hay en el proyecto es
// `validation/_comun.js#anguloVertice(prev, v, next)` (línea 196), y **no
// sirve**: da el ángulo INTERIOR en un vértice, en [0, 180] y sin signo. Mide la
// FORMA del polígono —si una esquina es aguda, si tres vértices son casi
// colineales—, que es lo que F02 necesitaba para detectar degeneraciones. Un
// ángulo interior de 90° no dice si esa esquina mira al Este o al Sur: no hay
// referencia externa en la fórmula, solo dos vectores comparados entre sí. El
// rumbo es otra pregunta —la dirección de UN lado respecto a UN eje fijo, el
// Norte— y por eso vive en un fichero propio y no como un parámetro más de
// aquella función.
//
// Regla de oro 6, por la vía explícita: `turf.bearing` está en la lista de
// PROHIBIDAS (SPEC §2.6, junto a `distance`, `length` y `area`) porque es un
// azimut GEODÉSICO sobre grados, y aquí las coordenadas son metros UTM. El
// rumbo de este módulo es PLANO sobre la proyección, coherente con
// `geo/metrica.js` (hipotenusa, no distancia esférica) y con `geo/area.js`
// (shoelace, no área geodésica).
//
// LA CONVENCIÓN, que es todo el contenido de este fichero. El azimut
// topográfico se mide **desde el Norte y en sentido HORARIO**: N=0°, E=90°,
// S=180°, O=270°. El ángulo matemático de toda la vida —el de la trigonometría,
// `Math.atan2(dy, dx)`— se mide desde el eje X y en sentido ANTIHORARIO. NO son
// el mismo número: azimut = 90° − ángulo matemático (mod 360). De ahí que aquí
// se llame `Math.atan2(dEste, dNorte)`, con los argumentos en ese orden y no en
// el habitual.
//
// La trampa no es teórica, y tiene un cebo: las dos convenciones COINCIDEN
// exactamente en 45° y en 225°. Un test que solo comprobara la diagonal NE
// pasaría en verde con la fórmula equivocada, y el informe diría que un lindero
// da al Este cuando da al Norte —el error está justo a 90°, no en un decimal—
// sin que nada se rompa hasta que lo lea un registrador. Por eso el control de
// este módulo son LOS EJES (N/E/S/O), que es donde las dos convenciones se
// separan al máximo.
//
// PRECISIÓN (regla de oro 5). Como `geo/metrica.js` y al contrario que
// `geo/area.js` o `geo/centroide.js`, aquí NO hace falta trasladar a origen
// local: `atan2` opera sobre DIFERENCIAS de coordenadas, que ya son pequeñas
// (decenas de metros). La cancelación catastrófica viene de multiplicar
// coordenadas absolutas (Norte ≈ 4,48·10⁶) entre sí, y eso aquí no ocurre.
//
// Regla de oro 9 — la aplicación mide, el colegiado interpreta. Un rumbo es un
// HECHO: no hay lindero «bien orientado» ni «mal orientado», y en este fichero
// no hay ni una palabra de mérito. `nombreCardinal` devuelve un topónimo, no un
// dictamen.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ ESTO ES NORTE DE CUADRÍCULA, NO NORTE GEOGRÁFICO. Léelo antes de usar el
// módulo, porque no se ve en el resultado.
//
// El azimut que sale de aquí se mide contra el eje +Y de la proyección, que es
// el Norte de CUADRÍCULA. El Norte geográfico —el del meridiano que pasa por la
// parcela— está girado respecto a él un ángulo con nombre propio: la
// CONVERGENCIA DE MERIDIANOS. Vale 0 sobre el meridiano central del huso y crece
// con la latitud y con la distancia a él (≈ Δλ·sen φ); en el norte de la
// península, cerca del borde del huso, **pasa de 2°**.
//
// Y no es una corrección teórica que nadie sepa calcular: `geo/utm.js` ya la
// devuelve, función `convergencia(lat, lon, zona)` (línea 237), que documenta su
// signo como «bearing del Norte de cuadrícula respecto al Norte geográfico,
// horario» — o sea, azimut geográfico = azimut de cuadrícula + convergencia,
// normalizado. Con la geográfica del punto (`geo/utm.js#inverse`) es una línea.
//
// AQUÍ NO SE APLICA, y es una decisión, no un olvido. Un lindero se describe por
// cuadrantes de 45°, y para que 2° cambien el cuadrante el rumbo tiene que caer
// a menos de 2° de un borde: son 4° alrededor de cada uno de los ocho bordes,
// 32° de 360, menos del 9% de los rumbos posibles. Casi nunca cambia nada.
//
// Pero «casi nunca» no es «nunca»: en ese 9% la frase saldría con el cardinal
// del vecino y nadie lo notaría, que es exactamente el error silencioso que
// prohíbe la regla de oro 1. Así que queda ESCRITO en lugar de arreglado a
// medias. Quien redacte el informe sabe que el rumbo es de cuadrícula —lo mismo
// que la flecha de norte del plano, que en UTM apunta a +Y (spec §11.3)— y quien
// algún día necesite el geográfico (contrastar con un rumbo magnético, o con un
// plano antiguo orientado al Norte verdadero) sabe qué función le falta y dónde
// está. Este módulo no la llama porque es puro y no sabe de husos ni de
// geográficas: recibe dos puntos y ya está.
// ─────────────────────────────────────────────────────────────────────────────

/** Grados por radián. Local: este módulo no importa nada (es hoja). */
const GRADOS_POR_RADIAN = 180 / Math.PI

/** Amplitud de cada uno de los ocho sectores cardinales, en grados. */
const SECTOR_GRADOS = 45

/** Medio sector: la distancia del rumbo que nombra a cada uno de sus bordes. */
const SEMISECTOR_GRADOS = SECTOR_GRADOS / 2 // 22,5

/**
 * @typedef {'N'|'NE'|'E'|'SE'|'S'|'SO'|'O'|'NO'} Cuadrante
 *   Códigos en ESPAÑOL: la 'O' es Oeste (no 'W'), y por tanto 'SO' y 'NO'.
 */

/**
 * Los ocho cuadrantes EN SENTIDO HORARIO desde el Norte, que es el orden en que
 * los indexa {@link cuadrante} y el mismo en que recorre el lindero la
 * descripción literaria (spec/feature-09: «recorrido horario desde el vértice
 * más al NO»).
 * @type {readonly Cuadrante[]}
 */
const CUADRANTES = Object.freeze(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'])

/**
 * Nombre con el que cada cuadrante se escribe en un lindero. Ver la nota de
 * decisión en {@link nombreCardinal}.
 */
const NOMBRES = Object.freeze({
  N: 'Norte',
  NE: 'Noreste',
  E: 'Este',
  SE: 'Sudeste',
  S: 'Sur',
  SO: 'Sudoeste',
  O: 'Oeste',
  NO: 'Noroeste',
})

/** True si `P` es un punto plano válido: `[x, y]` con ambos finitos. */
function esPuntoFinito(P) {
  return Array.isArray(P) && P.length === 2 && Number.isFinite(P[0]) && Number.isFinite(P[1])
}

/**
 * Guarda de contrato (regla de oro 1), mismo criterio que
 * `geo/segmento.js#exigirPunto`: un dato malformado es un bug del PROGRAMA —no
 * un caso geométrico— y suena en el sitio, nombrando el argumento y lo recibido.
 */
function exigirPunto(valor, nombre, funcion) {
  if (!esPuntoFinito(valor)) {
    throw new TypeError(
      `${funcion}: ${nombre} debe ser [x,y] con dos números finitos (UTM, m); ` +
        `recibido ${JSON.stringify(valor)}.`,
    )
  }
}

/**
 * Azimut topográfico del lado `a` → `b`: grados en **[0, 360)** medidos **desde
 * el Norte y en sentido HORARIO**.
 *
 *   Norte 0° · Este 90° · Sur 180° · Oeste 270°
 *
 * Es `Math.atan2(dEste, dNorte)` —Este primero— y **no** el `Math.atan2(dy, dx)`
 * de costumbre, que da el ángulo matemático desde el eje X y en sentido
 * antihorario. Los dos coinciden en 45° y en 225° y en ningún otro rumbo; en los
 * ejes se diferencian en 90°, que es un cuadrante entero. Ver la cabecera del
 * módulo.
 *
 * El azimut es de NORTE DE CUADRÍCULA (eje +Y de la proyección UTM), no de Norte
 * geográfico: la diferencia es la convergencia de meridianos y **no se aplica**.
 * El porqué, y la función que la calcularía, están en la cabecera del módulo.
 *
 * **Dos puntos coincidentes ⇒ `null`, y es una decisión.** Un punto no define
 * dirección alguna: no hay «casi lo mismo» que devolver. Devolver 0 sería lo
 * peor posible, porque 0 es un rumbo LEGÍTIMO (el Norte) y el informe publicaría
 * «linda al Norte» donde no hay lindero, sin que nada suene. Y no lanza, a
 * diferencia de un [x,y] malformado: un vértice DUPLICADO es un dato posible del
 * modelo —llega así de un DXF o de un GML real— y detectarlo es trabajo de la
 * validación (F02), no de esta función pura; mismo criterio que
 * `geo/segmento.js`, que describe el segmento degenerado en vez de lanzar, y que
 * `geo/centroide.js`, que devuelve `null` cuando el centroide es indefinido. El
 * llamante tiene que tratar el `null` (`cuadrante(null)` lanza a propósito).
 *
 * **Sin umbral**: coincidentes significa idénticos, no «casi». Decidir a partir
 * de qué distancia dos vértices son el mismo es una tolerancia, y las
 * tolerancias de este proyecto no se inventan en `geo/` (comparar con
 * `geo/segmento.js#LONGITUD_NULA_METROS`, que existe porque allí la pregunta es
 * si un segmento sirve para EDITAR). Un lado de 1 mm tiene un rumbo perfectamente
 * definido; que ese lado no debiera existir lo dice F02.
 *
 * @param {[number,number]} a  Origen del lado, UTM [x=Este, y=Norte] en metros.
 * @param {[number,number]} b  Extremo del lado, UTM.
 * @returns {number|null}  Azimut en grados [0, 360), o `null` si `a` y `b` son
 *   el mismo punto.
 * @throws {TypeError} Si `a` o `b` no son `[x,y]` con dos números finitos.
 */
export function azimut(a, b) {
  exigirPunto(a, 'a', 'azimut')
  exigirPunto(b, 'b', 'azimut')

  // Diferencias, no coordenadas absolutas: por eso este módulo no traslada a
  // origen local (regla de oro 5; ver cabecera).
  const dEste = b[0] - a[0]
  const dNorte = b[1] - a[1]

  if (dEste === 0 && dNorte === 0) return null

  // Este PRIMERO. Es la línea entera del fichero.
  const grados = Math.atan2(dEste, dNorte) * GRADOS_POR_RADIAN

  // `atan2` devuelve (−180, 180]. El doble módulo lleva el negativo a [0, 360) y
  // nunca produce 360: si `grados` es tan pequeño que `grados + 360` redondea a
  // 360 exacto, el `% 360` final lo devuelve a 0 — que es el mismo rumbo.
  return ((grados % 360) + 360) % 360
}

/**
 * Cuadrante cardinal de un azimut: ocho sectores de 45°, cada uno **centrado en
 * el rumbo que nombra**. El sector 'N' es por tanto [337,5°, 360) ∪ [0°, 22,5°),
 * el 'NE' es [22,5°, 67,5°), y así.
 *
 * **Criterio en los bordes: el borde pertenece al sector que EMPIEZA.** Cada
 * sector es el intervalo semiabierto [centro − 22,5°, centro + 22,5°), de modo
 * que 22,5° exactos son 'NE' (no 'N') y 337,5° exactos son 'N' (no 'NO'). Es la
 * misma regla en los ocho bordes, sin excepciones, y es lo que hace que los ocho
 * sectores PARTAN la circunferencia: ningún azimut cae en dos, ninguno se queda
 * fuera. Un criterio a medias —«hacia el norte redondeo arriba, hacia el sur
 * abajo»— daría cuadrantes distintos según de qué lado del punto flotante caiga
 * la cuenta, que es la clase de resultado que no se puede reproducir ni
 * defender.
 *
 * (Los últimos dígitos del azimut que llega aquí son ruido de `atan2`, así que
 * dar EXACTAMENTE en un borde es un caso de test, no del campo. Precisamente por
 * eso el criterio tiene que estar escrito: el día que ocurra, no se decide.)
 *
 * @param {number} azimutGrados  Azimut en grados, en [0, 360) — el que devuelve
 *   {@link azimut}.
 * @returns {Cuadrante}
 * @throws {TypeError} Si no es un número finito. En particular con `null`, que
 *   es lo que devuelve {@link azimut} para dos puntos coincidentes: tratarlo
 *   como 0 lo convertiría en «Norte» en silencio.
 * @throws {RangeError} Si está fuera de [0, 360).
 */
export function cuadrante(azimutGrados) {
  if (!Number.isFinite(azimutGrados)) {
    throw new TypeError(
      `cuadrante: se esperaba un azimut en grados (número finito); ` +
        `recibido ${JSON.stringify(azimutGrados)}. ` +
        `Si viene de azimut(), recuerda que devuelve null cuando los dos puntos coinciden: ` +
        `eso es «no hay rumbo» y hay que tratarlo antes, porque 0 es el Norte, un rumbo legítimo.`,
    )
  }
  if (azimutGrados < 0 || azimutGrados >= 360) {
    throw new RangeError(
      `cuadrante: el azimut debe estar en [0, 360); recibido ${azimutGrados}. ` +
        `Fuera de rango casi siempre significa que alguien sumó 180° para el rumbo inverso ` +
        `y no volvió a normalizar: ((g % 360) + 360) % 360.`,
    )
  }

  // 'N' es el único sector que envuelve el 0, así que se resuelve aparte; con él
  // fuera, los otros siete son un tramo continuo y el índice sale de una
  // división entera. Desplazar medio sector es lo que centra cada sector en su
  // rumbo en lugar de hacerlo empezar en él.
  if (azimutGrados >= 360 - SEMISECTOR_GRADOS || azimutGrados < SEMISECTOR_GRADOS) {
    return CUADRANTES[0]
  }
  return CUADRANTES[Math.floor((azimutGrados + SEMISECTOR_GRADOS) / SECTOR_GRADOS)]
}

/**
 * Nombre del cuadrante tal como se ESCRIBE en un lindero: 'Norte', 'Noreste',
 * 'Este', 'Sudeste', 'Sur', 'Sudoeste', 'Oeste', 'Noroeste'. El consumidor es la
 * descripción literaria (`report/literal.js`), un texto que el colegiado firma y
 * que puede acabar copiado en una escritura: «Linda al Norte, en línea recta de
 * 12,45 m, con…».
 *
 * **«Sudeste» y no «Sureste» — decisión, no descuido.** La RAE admite las dos
 * (y también «nordeste»); lo que no admite un documento es alternarlas. El
 * módulo fija UNA porque dos informes de la misma firma tienen que leerse igual.
 * Se eligen las formas con -d-, «Sudeste» y «Sudoeste», por dos razones: son las
 * etimológicas, que el DPD sigue dando como preferentes en el uso culto, y son
 * las tradicionales en la prosa registral y notarial, que es donde va a parar
 * este texto («linda al Sudoeste con…» no le chirría a nadie que lea
 * escrituras). En el Norte, en cambio, la simetría no existe: «nordeste» se usa,
 * pero «nordoeste» no existe, así que el par norte se queda en 'Noreste' /
 * 'Noroeste', que sí son coherentes entre sí. Cambiar de criterio, si alguna vez
 * se quiere, es tocar esta tabla y nada más: los CÓDIGOS de {@link cuadrante}
 * ('SE', 'SO') son los mismos con una grafía y con la otra, así que la geometría
 * no se entera.
 *
 * **Mayúscula inicial**, también a propósito: es la forma en que aparecen los
 * puntos cardinales cuando nombran los linderos de una finca. Si el redactor los
 * quiere en minúscula, `toLowerCase()` es suyo; la operación inversa exigiría
 * saber si la palabra abre frase, y eso este módulo no lo sabe.
 *
 * @param {Cuadrante} cuadrante  Código de {@link cuadrante} (mayúsculas, español).
 * @returns {string}  Nombre cardinal en español.
 * @throws {TypeError} Si no es uno de los ocho códigos. Sin comodines ni
 *   minúsculas toleradas: devolver '' o `undefined` por un código mal escrito
 *   dejaría el hueco en la frase («Linda al , en línea recta de…»), y eso es un
 *   error silencioso (regla de oro 1).
 */
export function nombreCardinal(cuadrante) {
  // `Object.hasOwn` y no `NOMBRES[cuadrante] === undefined`: con 'constructor' o
  // 'toString' la búsqueda directa encontraría algo HEREDADO de Object.prototype
  // y devolvería una función donde el informe espera un topónimo.
  if (typeof cuadrante !== 'string' || !Object.hasOwn(NOMBRES, cuadrante)) {
    throw new TypeError(
      `nombreCardinal: cuadrante debe ser uno de ${CUADRANTES.join(', ')}; ` +
        `recibido ${JSON.stringify(cuadrante)}.`,
    )
  }
  return NOMBRES[cuadrante]
}

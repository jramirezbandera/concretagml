// diagnostico/margen.js — F07 · El margen OFICIAL de identidad, que se ENUNCIA.
//
// ── LO IMPORTANTE DE ESTE MÓDULO ES LO QUE NO HACE ──────────────────────────
// No compara nada. No devuelve booleanos. No sabe qué mide la parcela, ni la ha
// visto, ni tiene forma de recibirla: `margen(clase)` **enuncia** el margen
// aplicable a esa clase de suelo y ahí acaba su trabajo. Enfrentarlo con las
// cifras de `diagnostico/desviacion.js` o de `diagnostico/bandas.js` es decisión
// del colegiado que interpreta y firma, no de una función (SPEC §2, regla de oro
// 9). Si algún día alguien añade aquí un `margen(clase, medido)` que devuelva
// `dentroDeMargen: true`, habrá convertido una capa informativa en el veredicto
// que la spec prohíbe, y con una sola línea.
//
// ── POR QUÉ EL UMBRAL EXISTE Y AUN ASÍ NO ES UN VEREDICTO ───────────────────
// El margen es real y está publicado: **±0,50 m urbana / ±2,00 m rústica de
// perímetro y ≤5 % de superficie** (BOE-A-2020-12111). Pero es criterio de
// **IDENTIDAD** —«¿estamos hablando de la misma finca?»—, no de aprobado/suspenso.
// Y la razón de fondo está en la spec (`spec/feature-07-diagnostico-parcela.md`,
// «Cómo se presenta», y §10.4): **una discrepancia grande a menudo significa que
// la geometría CATASTRAL está mal**, y ése es justamente el motivo por el que se
// abre el expediente. Un umbral presupone que Catastro es la referencia buena, y
// eso es falso precisamente en los casos de uso de esta herramienta: quien mide
// una parcela y encuentra 3 m de diferencia no ha suspendido un examen, ha
// encontrado el error que venía a documentar. Por eso el override del dossier
// (S6/C8) lo admite como **capa informativa etiquetada** —de ahí {@link ETIQUETA},
// que es literalmente el texto de la spec— y jamás como semáforo ni como parámetro
// configurable.
//
// ── POR QUÉ LAS CIFRAS ESTÁN AQUÍ Y NO EN `config/` ─────────────────────────
// `config/operativos.json` es de tolerancias de INGENIERÍA: hasta dónde llega la
// aritmética, qué es indistinguible del ruido, qué cabe en la pantalla. Estas tres
// cifras son de una NORMA PUBLICADA: no las decidimos nosotros, no se ajustan y no
// se «afinan» — cambiarlas solo puede hacerse porque cambie el BOE. Ponerlas en un
// fichero de configuración las presentaría como ajustables, que es la mitad del
// camino hacia el `config/umbrales.json` PROHIBIDO por la regla de oro 9. Viven
// aquí, en constantes exportadas, **con la cita del BOE al lado de cada una**; el
// JSDoc de `config/operativos.js` ya dice que es aquí donde tienen que estar, y
// este fichero es la otra mitad de ese acuerdo.
//
// ── LA HEURÍSTICA, LLAMADA POR SU NOMBRE ────────────────────────────────────
// `claseDeducidaDe` es una HEURÍSTICA sobre la FORMA de la referencia catastral,
// y por eso lo lleva en el nombre y devuelve `deducida: true` y un `criterio` en
// texto. La estructura de las dos formas está en el JSDoc de
// `services/catastro.js#normalizarRefcat`:
//   · RÚSTICA  `29041A00800099` = provincia(2) + municipio(3) + LETRA de sector +
//     polígono(3) + parcela(5). Lleva **código de polígono y parcela**.
//   · URBANA   `9398516VK3799G` = finca(7 dígitos) + hoja de plano(2 letras +
//     4 dígitos) + control(1 letra). **No** lleva polígono/parcela: lleva hoja.
// Las dos formas son mutuamente excluyentes (en la rústica los caracteres 8 y 9
// son dígitos; en la urbana son letras), así que el orden en que se prueban no
// cambia el resultado — hay un test que lo afirma, para que no se convierta en
// una dependencia oculta del orden.
//
// **Sin dígito de control**, por la MISMA razón por la que `normalizarRefcat` no
// lo comprueba (lee su JSDoc, trampa 5): el algoritmo de los dos caracteres de
// control no está verificado contra el servicio en este proyecto y un falso
// negativo bloquearía un caso legítimo. Aquí el coste de equivocarse es aún menor
// y por eso la heurística es ESTRICTA: `null` significa «no se puede deducir» y lo
// único que pasa entonces es que la UI pide al usuario que elija. **Y la propuesta
// nunca decide sola**: en la fase 4 va a un `<select>` que el usuario puede
// cambiar —de ahí `deducida`, que distingue «lo propuso la app» de «lo eligió una
// persona»—, porque la clase de suelo la sabe el técnico y no una expresión
// regular.
//
// Módulo PURO: sin DOM, sin red, sin estado. En particular **no importa
// `services/catastro.js`**: arrastraría la capa de red a un módulo puro. Ver
// {@link claseDeducidaDe} para qué implica eso en la normalización de la entrada.

import { describir } from './_comun.js'

/**
 * Las dos clases de suelo que distingue el margen oficial.
 *
 * No hay una tercera ni un `DESCONOCIDA`: «no se sabe» no es una clase de suelo,
 * es la ausencia de dato, y se representa con el `null` de
 * {@link claseDeducidaDe} — un `CLASE.DESCONOCIDA` terminaría teniendo un margen
 * asignado «por si acaso», que es la peor de las respuestas posibles.
 *
 * @type {Readonly<{URBANA: 'URBANA', RUSTICA: 'RUSTICA'}>}
 */
export const CLASE = Object.freeze({ URBANA: 'URBANA', RUSTICA: 'RUSTICA' })

/**
 * Margen oficial de identidad en PERÍMETRO, en metros, por clase de suelo:
 * **±0,50 m urbana / ±2,00 m rústica**.
 *
 * Fuente: **BOE-A-2020-12111** (Resolución conjunta de la D.G. de Seguridad
 * Jurídica y Fe Pública y la D.G. del Catastro). Recogido en SPEC §3,
 * «Tolerancias oficiales de identidad», y en el override S6/C8 del dossier.
 *
 * Se refiere al perímetro **EXTERIOR**, que es lo que se describe en una
 * escritura y lo que se pisa: por eso `geo/metrica.js#perimetro` devuelve los tres
 * números desglosados (exterior / huecos / total) en vez de uno, y quien compare
 * con este margen tiene que usar `exterior`. Un patio no entra.
 *
 * @type {Readonly<{URBANA: number, RUSTICA: number}>}
 */
export const MARGEN_PERIMETRO_M = Object.freeze({
  [CLASE.URBANA]: 0.5,
  [CLASE.RUSTICA]: 2,
})

/**
 * Margen oficial de identidad en SUPERFICIE: **≤5 %**, expresado como FRACCIÓN
 * (0.05), igual que el `relativo` de `diagnostico/bandas.js` y de
 * `edit/metricas.js` — el × 100 es de presentación.
 *
 * Fuente: **BOE-A-2020-12111**, misma resolución. No depende de la clase de suelo
 * (a diferencia del de perímetro), y por eso es un número y no un mapa: darle
 * forma de `{URBANA, RUSTICA}` con el mismo valor dos veces insinuaría que puede
 * divergir.
 *
 * @type {number}
 */
export const MARGEN_SUPERFICIE_RELATIVO = 0.05

/**
 * La etiqueta con la que esta capa se presenta al usuario, **literalmente** la de
 * la spec (SPEC §2 regla de oro 9 y el override S6/C8:
 * «capa informativa etiquetada "margen de identidad del Catastro"»).
 *
 * Está exportada para que la UI no la escriba a mano: la etiqueta ES parte del
 * requisito —lo que impide que la cifra se lea como un aprobado— y una redacción
 * distinta en la pantalla («tolerancia», «límite», «máximo admisible») cambiaría
 * el significado de lo que se muestra. Un test comprueba que es exactamente ésta.
 *
 * @type {string}
 */
export const ETIQUETA = 'margen de identidad del Catastro'

/**
 * Forma de la referencia catastral RÚSTICA: 5 dígitos (provincia + municipio),
 * **una letra** y 8 dígitos (polígono + parcela). `29041A00800099`.
 *
 * La letra es casi siempre `A`, pero se acepta cualquiera a propósito: identifica
 * el sector y hay provincias que usan otras. Lo que discrimina no es QUÉ letra es,
 * sino que haya **una letra en la 6.ª posición seguida de 8 dígitos** — o sea, que
 * la referencia lleve código de polígono y parcela, que es lo propio del
 * parcelario rústico. Anclar en la letra `A` habría dejado fuera casos legítimos
 * sin ganar nada.
 */
const RE_RUSTICA = /^[0-9]{5}[A-Z][0-9]{8}$/

/**
 * Forma de la referencia catastral URBANA: 7 dígitos de finca, **2 letras** de
 * hoja de plano, 4 dígitos y 1 letra de control. `9398516VK3799G`.
 *
 * Estricta a propósito (dígitos donde hay dígitos): el precio de un falso `null`
 * es que la UI pregunte, y el de un falso positivo es proponer una clase
 * equivocada. Con esa asimetría, estrechar es la opción correcta.
 */
const RE_URBANA = /^[0-9]{7}[A-Z]{2}[0-9]{4}[A-Z]$/

/**
 * Propone la clase de suelo a partir de la FORMA de la referencia catastral.
 * **Heurística**, no comprobación: ver la cabecera de este fichero.
 *
 * ```js
 * claseDeducidaDe('29041A00800099')
 * // → { clase: 'RUSTICA', deducida: true, criterio: 'La referencia 29041A00800099 lleva…' }
 * claseDeducidaDe('9398516VK3799G')  // → { clase: 'URBANA', … }
 * claseDeducidaDe('BUENOS DIAS')     // → null
 * ```
 *
 * **Espera la referencia YA NORMALIZADA** tal como la devuelve
 * `services/catastro.js#normalizarRefcat`: 14 caracteres, mayúsculas y sin
 * espacios. No normaliza ella, y es deliberado: importar `normalizarRefcat`
 * arrastraría la capa de red (`services/`) dentro de un módulo puro de
 * `diagnostico/`, y reescribir la normalización aquí crearía una SEGUNDA
 * definición que puede divergir de la primera — exactamente lo que le pasó a
 * `exigirRef` entre `edit/_comun.js` y sus copias, y que la cabecera de
 * `diagnostico/_comun.js` cuenta como lección. Como el coste de no reconocer una
 * referencia es solo que la UI pregunte, la elección es fácil.
 *
 * No comprueba que la parcela EXISTA —no puede, es un módulo sin red— sino que la
 * referencia tenga forma de una u otra. `0000000XX0000X`, la referencia inventada
 * con la que se midió el `NO_ENCONTRADO` del servicio, tiene forma urbana y se
 * deduce urbana: deducir una forma no es verificar una existencia.
 *
 * No lanza nunca: su entrada es dato del usuario (o `null` de un campo vacío), y
 * eso no es un bug del programador. Cualquier cosa que no sea un string reconocible
 * da `null`.
 *
 * @param {*} refcat  Referencia catastral de PARCELA (14 caracteres), normalizada.
 * @returns {{clase: 'URBANA'|'RUSTICA', deducida: true, criterio: string}|null}
 *   `deducida` es siempre `true` porque esta función SIEMPRE propone: existe para
 *   que la fase 4 pueda guardar `{clase, deducida: false}` cuando la elija una
 *   persona en el `<select>`, y para que la UI sepa que lo que muestra es una
 *   propuesta. `criterio` es el texto que se le enseña al usuario para que sepa de
 *   dónde sale. `null` = no se puede deducir ⇒ que elija el usuario.
 */
export function claseDeducidaDe(refcat) {
  if (typeof refcat !== 'string') return null

  if (RE_RUSTICA.test(refcat)) {
    return {
      clase: CLASE.RUSTICA,
      deducida: true,
      criterio:
        `La referencia ${refcat} lleva código de polígono y parcela (una letra ` +
        `seguida de ocho dígitos), propio del parcelario RÚSTICO.`,
    }
  }

  if (RE_URBANA.test(refcat)) {
    return {
      clase: CLASE.URBANA,
      deducida: true,
      criterio:
        `La referencia ${refcat} no lleva código de polígono y parcela, sino hoja ` +
        `de plano (dos letras y cuatro dígitos), propia del parcelario URBANO.`,
    }
  }

  return null
}

/**
 * ENUNCIA el margen oficial de identidad aplicable a una clase de suelo. No
 * compara, no juzga y no ve la parcela (ver la cabecera: eso es el punto).
 *
 * ```js
 * margen(CLASE.URBANA)  // → { perimetroM: 0.5, superficieRelativo: 0.05, etiqueta: 'margen de identidad del Catastro' }
 * ```
 *
 * La `etiqueta` viaja DENTRO del resultado a propósito: quien recibe estas cifras
 * recibe en el mismo objeto el texto con el que está obligado a presentarlas, así
 * que no hay forma de pintar el número sin tener la etiqueta a mano. Es la única
 * defensa que un módulo puro puede montar contra que su cifra acabe en pantalla
 * como un aprobado.
 *
 * `clase` es obligatoria y no admite `null`: cuando no se sabe la clase, lo que
 * corresponde es preguntar al usuario (lo que señala el `null` de
 * {@link claseDeducidaDe}), no enunciar «el margen por defecto» — no existe tal
 * cosa, y elegir uno en silencio sería inventarse la mitad de la norma.
 *
 * @param {'URBANA'|'RUSTICA'} clase  Una de {@link CLASE}.
 * @returns {{perimetroM: number, superficieRelativo: number, etiqueta: string}}
 *   `perimetroM` en METROS (sobre el perímetro EXTERIOR, ver
 *   {@link MARGEN_PERIMETRO_M}); `superficieRelativo` como FRACCIÓN (0,05 = 5 %).
 *   **Ni una clave de veredicto**: no hay `ok`, ni `dentroDeMargen`, ni `nivel`,
 *   ni `color` (regla de oro 9, y hay un test que lo afirma).
 * @throws {TypeError} Si `clase` no es `CLASE.URBANA` ni `CLASE.RUSTICA`. Es
 *   contrato del programador: la clase la resuelve la UI antes de llegar aquí.
 */
export function margen(clase) {
  if (clase !== CLASE.URBANA && clase !== CLASE.RUSTICA) {
    throw new TypeError(
      `margen: 'clase' debe ser CLASE.URBANA ('${CLASE.URBANA}') o CLASE.RUSTICA ` +
        `('${CLASE.RUSTICA}'); recibido ${describir(clase)}. Si no se sabe la clase, ` +
        `hay que preguntarla, no suponerla.`,
    )
  }

  return {
    perimetroM: MARGEN_PERIMETRO_M[clase],
    superficieRelativo: MARGEN_SUPERFICIE_RELATIVO,
    etiqueta: ETIQUETA,
  }
}

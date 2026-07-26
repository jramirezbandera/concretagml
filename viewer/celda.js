// viewer/celda.js — F03 · Tarea 2A.2 (validación pura de una celda de coordenada)
//
// Por qué existe: la review de ingeniería del plan de F03 (hallazgo C7/T8) marcó
// que la validación de la celda editable de la tabla de vértices NUNCA debe
// inyectar NaN en el modelo, NUNCA debe mutar el estado a media edición, y un
// dato malo del usuario debe producir un aviso legible, no una excepción. Este
// módulo aísla esa lógica en una función PURA con sus propios tests para que el
// módulo grande que sincroniza tabla↔mapa (`viewer/sincronizacion.js`, de otro
// agente) solo tenga que llamarla y decidir qué hacer con el resultado.
//
// Por qué es puro y Leaflet-free: sin esto, cada test tendría que arrastrar
// jsdom + Leaflet solo para probar un parseo de texto. Al no tocar el DOM, su
// test vive en el proyecto Vitest `node` (rápido, sin entorno simulado) y el
// contrato queda blindado por tabla de casos.
//
// Quién lo consume: `viewer/sincronizacion.js` (por escribir) llama a
// `parsearCoordenada` por cada celda editada de la tabla de vértices; si
// `ok:false`, muestra `motivo` al usuario y NO toca el modelo (regla de oro 1:
// ningún error silencioso, pero tampoco un throw por un dato de usuario).

import { autodetectarSeparadorDecimal } from '../parsers/_comun.js'

/** Coordenada con exponente, p.ej. "1e5" o "1,2e-3". Solo para dar un motivo específico. */
const RE_EXPONENCIAL = /^-?\d+([.,]\d+)?[eE][-+]?\d+$/

/** Forma final válida cuando el separador decimal elegido es '.': entero u opcionalmente con parte decimal. */
const RE_NUMERO_PUNTO = /^-?\d+(\.\d+)?$/

/** Forma final válida cuando el separador decimal elegido es ',': coma obligatoria entre dígitos. */
const RE_NUMERO_COMA = /^-?\d+,\d+$/

/**
 * Describe el tipo de un valor no-string para un mensaje de error legible.
 * @param {*} valor
 * @returns {string}
 */
function describirTipo(valor) {
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return 'un array'
  return typeof valor
}

/**
 * Parsea el texto de una celda de coordenada UTM tecleada a mano por el
 * usuario. Función PURA: no toca el DOM ni el modelo, solo interpreta texto.
 *
 * Separador decimal: reutiliza {@link autodetectarSeparadorDecimal} de
 * `parsers/_comun.js`, que cuenta apariciones `\d.\d` vs `\d,\d` y elige el
 * separador que más veces actúa como decimal (empate o ausencia → '.').
 * Esa heurística documenta explícitamente su límite: "no se contemplan
 * separadores de millar". Por eso este módulo NO le pasa nunca un texto que
 * contenga AMBOS caracteres ('.' y ',') — eso se rechaza aquí mismo, ANTES de
 * llamar a la heurística, como "ambiguo": adivinar cuál de los dos es el
 * separador de millar (`1.234,56` vs `1,234.56`) puede colar un valor 1000×
 * equivocado en una coordenada catastral. Es preferible pedir al usuario que
 * reescriba la celda.
 *
 * Notación exponencial (`"1e5"`) se rechaza a propósito aunque `Number()` la
 * entendería: una coordenada UTM no se teclea así, y admitirla abriría la
 * puerta a valores absurdos (o a errores de imprenta que "casualmente"
 * parsean) en un campo que alimenta un polígono catastral.
 *
 * Contrato de "nunca lanza": esta función es llamada por un handler de DOM
 * que puede recibir cualquier cosa (incluida entrada que no es ni siquiera
 * string). El `throw` en este proyecto se reserva a contratos rotos por el
 * PROGRAMADOR; aquí el "programador" es un handler de UI que no debe tener
 * que envolver la llamada en try/catch. Por eso toda entrada rara —
 * `null`/`undefined`/número/objeto, o cualquier fallo interno inesperado— se
 * traduce a `{ok:false}` con un motivo, nunca a una excepción.
 *
 * @param {string} texto  Lo que el usuario tiene escrito en la celda.
 * @returns {{ok:true, valor:number} | {ok:false, motivo:string}}
 *   Si `ok:true`, `valor` es SIEMPRE un número finito (jamás NaN/Infinity).
 */
export function parsearCoordenada(texto) {
  try {
    if (typeof texto !== 'string') {
      return {
        ok: false,
        motivo: `La celda debe contener texto; se recibió ${describirTipo(texto)}.`,
      }
    }

    const t = texto.trim()
    if (t === '') {
      return { ok: false, motivo: 'La celda está vacía.' }
    }

    // Ambos separadores presentes: no se adivina cuál es el de millar (ver
    // JSDoc). Se rechaza ANTES de tocar autodetectarSeparadorDecimal.
    if (t.includes('.') && t.includes(',')) {
      return {
        ok: false,
        motivo: `Use un único separador decimal: '${t}' es ambiguo (¿coma o punto de miles?).`,
      }
    }

    if (RE_EXPONENCIAL.test(t)) {
      return {
        ok: false,
        motivo: `No se admite notación exponencial ('${t}'); escriba el número completo.`,
      }
    }

    // A partir de aquí, t contiene como mucho UNO de los dos separadores, así
    // que la heurística de F01 (pensada para volcados con muchos números) es
    // segura de reutilizar tal cual sobre una sola celda.
    const separador = autodetectarSeparadorDecimal(t)

    let valor
    if (separador === ',') {
      if (!RE_NUMERO_COMA.test(t)) {
        return { ok: false, motivo: `'${t}' no es un número válido.` }
      }
      valor = Number(t.replace(',', '.'))
    } else {
      if (!RE_NUMERO_PUNTO.test(t)) {
        return { ok: false, motivo: `'${t}' no es un número válido.` }
      }
      valor = Number(t)
    }

    // Cinturón y tirantes del invariante "jamás NaN": con las regex anteriores
    // esto no debería poder fallar, pero si alguna vez lo hace, se rechaza en
    // vez de devolver un valor no-finito.
    if (!Number.isFinite(valor)) {
      return { ok: false, motivo: `'${t}' no es un número válido.` }
    }

    return { ok: true, valor }
  } catch {
    // Nunca debería llegarse aquí (ver arriba), pero el contrato de esta
    // función es no lanzar jamás ante entrada de usuario: si algo interno
    // falla de forma inesperada, se traduce a un aviso legible.
    //
    // COSTE ASUMIDO de este `catch` sin binding (auditoría de coherencia 2C.2):
    // el objeto de error se PIERDE. El contrato de retorno es
    // `{ok:false, motivo}` y no tiene hueco para una `causa`, así que
    // `viewer/sincronizacion.js` tampoco puede propagarla al canal de aviso. Si
    // algún día esta rama llega a dispararse de verdad, NO habrá ningún rastro
    // de por qué. Es aceptable porque está demostrado inalcanzable (las regex
    // anteriores filtran todo lo que `Number()` podría atragantar, y ninguna
    // llamada de aquí puede lanzar), pero si alguna vez hay que diagnosticarla:
    // capturar el error (`catch (error)`) y añadir `causa` al contrato de
    // retorno — ambos ficheros a la vez, no solo uno.
    return { ok: false, motivo: 'No se ha podido interpretar el valor de la celda.' }
  }
}

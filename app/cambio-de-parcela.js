// app/cambio-de-parcela.js — F25 · tarea 2.2 · CAMBIAR DE PARCELA DENTRO DEL EXPEDIENTE.
//
// El corazón de `app/main.js#activarParcela`, sacado aquí para que se pueda probar sin
// montar la aplicación entera. Une tres piezas que no se conocen —el conjunto
// (`app/conjunto.js`), el historial (`edit/historial.js`) y el store— en el ÚNICO
// orden que funciona:
//
//   1. Se aparta la historia de la que sale y el conjunto activa la que entra.
//   2. Se restaura la historia de la que entra, o se siembra si es la primera vez.
//   3. El `set`, con la marca de «cambio de parcela» levantada SOLO mientras dura.
//
// Al revés no vale: si el `set` fuera antes de restaurar, los suscriptores que leen el
// historial al notificarse (los botones de deshacer) verían la pila de la otra parcela.
//
// Lo que NO hace —y es de `app/main.js`— es soltar las colindantes ni la referencia
// deducida: son piezas de la pantalla, no del cambio.

import { apartar, reiniciar, restaurar } from '../edit/historial.js'

/**
 * @param {object} args
 * @param {object} args.conjunto  El de `app/conjunto.js`.
 * @param {import('../edit/historial.js').Historial} args.historial  La pila ÚNICA.
 * @param {{set: (p: object) => void}} args.estado  El store de parcela.
 * @param {string} args.idLocal  La parcela que entra.
 * @param {(instantanea: object) => boolean} [args.esDeEdificio]  Si una instantánea
 *   es de la rama Edificio. La pila es UNA para las dos ramas, y si lleva alguna del
 *   edificio no se reparte por parcelas: apartarla con la parcela haría que, al volver,
 *   un Ctrl+Z devolviera un edificio de otro momento. Se empieza de cero.
 * @param {(levantada: boolean) => void} [args.marcar]  Levanta y baja la marca de
 *   cambio de parcela alrededor del `set`.
 * @returns {{cambiado: boolean, deshacerReiniciado: boolean}}  `deshacerReiniciado`
 *   es `true` solo cuando se tiró la historia por llevar instantáneas del edificio:
 *   es lo que hay que decirle al usuario.
 * @throws {Error}  Si el conjunto no tiene esa parcela (lo lanza `conjunto.activar`).
 */
export function cambiarDeParcela({ conjunto, historial, estado, idLocal, esDeEdificio = () => false, marcar = () => {} }) {
  if (idLocal === conjunto.activa()) return { cambiado: false, deshacerReiniciado: false }
  const conEdificio = historial.pila.some((i) => esDeEdificio(i) === true)
  const { parcela, apartado, cambiado } = conjunto.activar(idLocal, conEdificio ? null : apartar(historial))
  if (!cambiado) return { cambiado: false, deshacerReiniciado: false }
  if (apartado === null || conEdificio) reiniciar(historial, parcela)
  else restaurar(historial, apartado)
  marcar(true)
  try {
    estado.set(parcela)
  } finally {
    marcar(false)
  }
  return { cambiado: true, deshacerReiniciado: conEdificio }
}

export default cambiarDeParcela

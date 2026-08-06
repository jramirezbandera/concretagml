/* -------------------------------------------------------------------------- *
 * test/app/dialogo-pegado.dom.test.js — F19 · T1                              *
 *                                                                            *
 * `spec/feature-01-entrada-parcela.md:14` llama al pegado de la LISTA de      *
 * AutoCAD LA VÍA PRINCIPAL de entrada del técnico. `parsers/list.js` está en  *
 * verde desde la fase 1 y, medido el 2026-08-06, NO HABÍA NI UN MANEJADOR DE  *
 * `paste` en producción: la única aparición de la palabra en todo el          *
 * repositorio era la deuda escrita en la ficha de F18.                        *
 *                                                                            *
 * Lo que se guarda aquí:                                                      *
 *   · Que la vista previa dice lo que se ha entendido ANTES de aceptar, con   *
 *     las DOS cifras de superficie —el cotejo que `importar()` calcula desde  *
 *     F01 y que hasta hoy no leía nadie—.                                     *
 *   · Que un texto que no sirve NO cierra la pantalla: deja el texto y el     *
 *     motivo (decisión 6, y es lo que evita el viaje de vuelta al CAD).       *
 *   · Que el botón nunca está apagado sin motivo escrito (regla de oro 1).    *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { crearDialogoPegado, NOMBRE_PEGADO } from '../../app/dialogo-pegado.js'
import { serializarCoordenadasTxt } from '../../export/coordenadas.js'
import { crearRecinto } from '../../model/parcela.js'
import {
  PEGADO_SIN_GEOMETRIA,
  PEGADO_VACIO,
  MENSAJE_ES_LISTADO_PROPIO,
  inspeccionarTexto,
} from '../../app/cableado-medicion.js'

const LIST_REAL = readFileSync(join(process.cwd(), 'test/fixtures/parsers/LIST.txt'), 'utf8')

/**
 * El `.txt` de replanteo que exporta esta misma aplicación, **generado por el
 * exportador de verdad**.
 *
 * ⛔ **No se escribe a mano, y el motivo está medido en F18 (M4):** la frase que
 * lo delata NO viaja literal —`parrafo()` la envuelve a 70 columnas—, así que una
 * imitación escrita a ojo no la reconoce el detector. La primera versión de esta
 * prueba la escribió a mano y salió ROJA, que es exactamente lo que tenía que
 * pasar: la imitación no era el fichero.
 */
const listadoPropio = () =>
  serializarCoordenadasTxt({
    recintos: [crearRecinto(ANILLO)],
    refcat: '9398516VK3799G',
    srs: 'EPSG:25830',
    fecha: new Date(Date.UTC(2026, 7, 6)),
  }).texto

const ANILLO = [
  [298755.5889, 4090054.3788],
  [298755.8939, 4090054.3763],
  [298755.8139, 4090059.4292],
  [298756.1654, 4090063.3345],
]

const dialogos = []
const abrir = (inspector = inspeccionarTexto) => {
  const d = crearDialogoPegado({ documento: document })
  dialogos.push(d)
  const promesa = d.abrir({ inspeccionar: inspector })
  return { d, promesa }
}

/** Escribir en el campo como lo haría el usuario: valor + `input`. */
const pegar = (d, texto) => {
  const campo = d.nodo.querySelector('[data-campo="pegado"]')
  campo.value = texto
  campo.dispatchEvent(new window.Event('input', { bubbles: true }))
  return campo
}

const botonUsar = (d) => d.nodo.querySelector('[data-accion="usar-pegado"]')
const motivo = (d) => d.nodo.querySelector('[data-motivo="pegado"]').textContent
const titular = (d) => d.nodo.querySelector('[data-titular="pegado"]').textContent

afterEach(() => {
  for (const d of dialogos.splice(0)) d.destruir()
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('app/dialogo-pegado · la pantalla', () => {
  it('nace con el campo vacío, el botón apagado y EL MOTIVO escrito', () => {
    const { d } = abrir()
    expect(d.nodo.querySelector('[data-campo="pegado"]').value).toBe('')
    expect(botonUsar(d).disabled).toBe(true)
    // ⛔ Regla de oro 1: un botón apagado sin motivo al lado es un botón roto.
    expect(motivo(d)).toBe(PEGADO_VACIO)
  })

  it('el foco va AL CAMPO, no al botón: quien abre esto viene a pegar', () => {
    const { d } = abrir()
    expect(document.activeElement).toBe(d.nodo.querySelector('[data-campo="pegado"]'))
  })

  it('el campo es monoespaciado (aquí se leen columnas de números)', () => {
    const { d } = abrir()
    expect(d.nodo.querySelector('[data-campo="pegado"]').classList.contains('gml-mono')).toBe(true)
  })

  it('sin `inspeccionar` no se abre: un botón que no ha mirado nada no decide nada', () => {
    const avisos = []
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = crearDialogoPegado({ documento: document, alAvisar: (m) => avisos.push(m) })
    dialogos.push(d)
    return d.abrir({}).then((salida) => {
      expect(salida).toBeNull()
      expect(avisos).toHaveLength(1)
    })
  })
})

describe('app/dialogo-pegado · la vista previa', () => {
  it('⭐ con la LISTA real dice los vértices, el formato y LAS DOS CIFRAS de superficie', () => {
    const { d } = abrir()
    pegar(d, LIST_REAL)

    // 11 vértices, un contorno, y el formato con el nombre que usa el técnico.
    expect(titular(d)).toMatch(/11 vértices/)
    expect(titular(d)).toMatch(/un contorno/)
    expect(titular(d)).toMatch(/LISTA de AutoCAD/)

    // ⭐ El cotejo, que `importar()` calcula desde F01 en `resumen.superficie` y
    // que hasta F19 no leía NADIE en toda la aplicación. Las dos cifras, siempre:
    // el dibujo declara 61,0450 y la app calcula 61,0450 (difieren en 0,00003 m²).
    const renglones = [...d.nodo.querySelectorAll('.gml-dialogo-pegado-renglon')].map(
      (li) => li.textContent,
    )
    const superficie = renglones.find((t) => t.includes('Superficie'))
    expect(superficie).toBeDefined()
    expect(superficie).toMatch(/61,0450/) // la declarada por AutoCAD
    expect(superficie).toMatch(/coinciden/)
    // Y el huso donde cae, que es la otra cosa que se sabe sin tocar nada.
    expect(renglones.some((t) => /huso 30/.test(t))).toBe(true)

    expect(botonUsar(d).disabled).toBe(false)
    expect(motivo(d)).toBe('')
  })

  it('⛔ y si las dos cifras NO coinciden lo dice, con la diferencia', () => {
    // El mismo listado con el «Área:» cambiado: es el caso que hace útil el
    // cotejo —un dibujo cuya superficie declarada no es la de su geometría—.
    const { d } = abrir()
    pegar(d, LIST_REAL.replace('61.0450', '75.0000'))
    const texto = d.nodo.textContent
    expect(texto).toMatch(/75,0000/)
    expect(texto).toMatch(/61,0450/)
    expect(texto).toMatch(/NO coinciden/)
    // Se AVISA y se deja seguir: la app no sabe cuál de las dos cifras está mal,
    // y decidirlo por el usuario sería inventarse un veredicto.
    expect(botonUsar(d).disabled).toBe(false)
  })

  it('un texto sin coordenadas apaga el botón, dice por qué y NO cierra la pantalla', () => {
    const { d } = abrir()
    const campo = pegar(d, 'Estimado cliente:\n\nAdjunto le remito el informe solicitado.')

    expect(botonUsar(d).disabled).toBe(true)
    expect(motivo(d)).toBe(PEGADO_SIN_GEOMETRIA)
    // ⭐ Decisión 6, y es la que evita el viaje de vuelta al CAD: el texto sigue
    // ahí para corregirlo, y la pantalla sigue abierta.
    expect(campo.value).toMatch(/Estimado cliente/)
    expect(d.nodo.isConnected).toBe(true)
  })

  it('y corregirlo vuelve a encender el botón, sin cerrar y volver a abrir', () => {
    const { d } = abrir()
    pegar(d, 'no hay nada aquí')
    expect(botonUsar(d).disabled).toBe(true)
    pegar(d, LIST_REAL)
    expect(botonUsar(d).disabled).toBe(false)
    expect(motivo(d)).toBe('')
  })

  it('⛔ el listado de replanteo PROPIO se reconoce aquí también, y con su motivo', () => {
    // La otra puerta que abre F19 al mismo fichero que F18 midió: sin esto, el
    // usuario recibiría «no se ha podido resolver el huso», que es un bloqueo del
    // catálogo, plausible, y mentira.
    const { d } = abrir()
    pegar(d, listadoPropio())
    expect(botonUsar(d).disabled).toBe(true)
    expect(motivo(d)).toBe(MENSAJE_ES_LISTADO_PROPIO)
  })

  it('unas coordenadas en grados SÍ dejan seguir: la revisión ofrecerá proyectarlas', async () => {
    // ⚠️ `ok` no es `construida`. Un pegado en grados no construye parcela, y aun
    // así el camino sigue: la pantalla de revisión (F19 · T2) ofrece proyectar.
    // Apagar aquí el botón dejaría al usuario sin la corrección que existe.
    const { d, promesa } = abrir()
    pegar(d, '-4.42143 36.72130\n-4.42133 36.72130\n-4.42133 36.72140\n-4.42143 36.72140')
    expect(botonUsar(d).disabled).toBe(false)
    botonUsar(d).click()
    await expect(promesa).resolves.toMatch(/-4\.42143/)
  })
})

describe('app/dialogo-pegado · el desenlace', () => {
  it('«Usar estas coordenadas» resuelve con el TEXTO pegado, tal cual', async () => {
    const { d, promesa } = abrir()
    pegar(d, LIST_REAL)
    botonUsar(d).click()
    await expect(promesa).resolves.toBe(LIST_REAL)
  })

  it('«Cancelar» resuelve `null` y no se lleva nada por delante', async () => {
    const { d, promesa } = abrir()
    pegar(d, LIST_REAL)
    d.nodo.querySelector('[data-accion="cancelar-pegado"]').click()
    await expect(promesa).resolves.toBeNull()
  })

  it('`Escape` cancela igual (en jsdom no hay `showModal`, y aun así)', async () => {
    const { d, promesa } = abrir()
    d.nodo.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await expect(promesa).resolves.toBeNull()
  })

  it('abrir dos veces resuelve la anterior como cancelada, sin dejar promesas colgando', async () => {
    const d = crearDialogoPegado({ documento: document })
    dialogos.push(d)
    const primera = d.abrir({ inspeccionar: inspeccionarTexto })
    const segunda = d.abrir({ inspeccionar: inspeccionarTexto })
    await expect(primera).resolves.toBeNull()
    d.nodo.querySelector('[data-accion="cancelar-pegado"]').click()
    await expect(segunda).resolves.toBeNull()
  })

  it('cada apertura empieza EN BLANCO: lo de la vez anterior no se hereda', () => {
    const d = crearDialogoPegado({ documento: document })
    dialogos.push(d)
    d.abrir({ inspeccionar: inspeccionarTexto })
    pegar(d, LIST_REAL)
    d.nodo.querySelector('[data-accion="cancelar-pegado"]').click()

    d.abrir({ inspeccionar: inspeccionarTexto })
    expect(d.nodo.querySelector('[data-campo="pegado"]').value).toBe('')
    expect(botonUsar(d).disabled).toBe(true)
  })

  it('`destruir()` cierra lo que hubiera, resuelve `null` y se quita del DOM', async () => {
    const d = crearDialogoPegado({ documento: document })
    const promesa = d.abrir({ inspeccionar: inspeccionarTexto })
    d.destruir()
    await expect(promesa).resolves.toBeNull()
    expect(d.nodo.isConnected).toBe(false)
    d.destruir() // idempotente
  })

  it('el nombre de lo pegado se dice en un solo sitio, y no es «fichero»', () => {
    // Llamar «fichero» a lo que el usuario acaba de pegar es una afirmación falsa
    // sobre el origen del dato, justo en el renglón que existe para decirlo.
    expect(NOMBRE_PEGADO).not.toMatch(/fichero/i)
    expect(NOMBRE_PEGADO).toMatch(/pegad/i)
  })
})

describe('app/cableado-medicion · inspeccionarTexto (la función pura de la vista previa)', () => {
  it('sin texto no es un error: es el estado de partida', () => {
    expect(inspeccionarTexto('').motivo).toBe(PEGADO_VACIO)
    expect(inspeccionarTexto('   ').ok).toBe(false)
  })

  it('cuenta los vértices de TODOS los anillos, no solo del primero', () => {
    const dos = '0 0\n10 0\n10 10\nseparador\n298750 4090050\n298760 4090050\n298760 4090060'
    const { titular } = inspeccionarTexto(dos)
    expect(titular).toMatch(/6 vértices/)
    expect(titular).toMatch(/2 contornos/)
  })

  it('⛔ no lanza NUNCA: es la puerta de un texto de fuera', () => {
    for (const basura of [' ', '<<<>>>', '4090050', '.'.repeat(5000)]) {
      expect(() => inspeccionarTexto(basura)).not.toThrow()
    }
  })
})

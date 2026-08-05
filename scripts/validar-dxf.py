"""Abre ficheros DXF con `ezdxf` y dice si un CAD podría abrirlos SIN ARREGLARLOS.

Lo invoca `scripts/validar-dxf.mjs`. Es el gemelo de `validar-xsd.py` y existe por
la misma razón: **un oráculo que no es nuestro**.

── ⛔ POR QUÉ ESTE FICHERO EXISTE, Y NO ES CELO ─────────────────────────────
Medido el 2026-08-03, al escribir F10: el DXF del override O12 al pie de la letra
—sin los marcadores de subclase `100`— **no abre** (`DXFStructureError`), y
`parsers/dxf.js` —nuestro propio lector— **lo lee tan feliz**: dos anillos,
coordenadas exactas, cero detecciones. O sea que la prueba de ida y vuelta que
iba a ser la red de seguridad habría salido VERDE con un fichero que no abre en
ninguna parte.

F10 lo corrigió y dejó en `test/export/dxf.test.js` los hechos de aquella
ablación escritos a mano sobre los bytes. Lo que NO dejó es forma de volver a
preguntárselo a un lector de verdad: el oráculo corría fuera de la suite y se
ejecutó una vez. Esto lo hace repetible.

── LAS TRES COSAS QUE COMPRUEBA, Y POR QUÉ CADA UNA ────────────────────────
  1. **Abre con `readfile`, no con `recover`.** La diferencia es todo el asunto:
     `recover` está para rescatar ficheros rotos, así que usarlo aquí sería
     preguntar «¿se puede salvar?» en vez de «¿está bien?».
  2. **El auditor no encuentra NADA que arreglar**: 0 errores y **0 arreglos**.
     Un fichero que el lector tiene que arreglar al abrirlo no es un fichero que
     se pueda firmar, y los arreglos de ezdxf son silenciosos.
  3. ⭐ **Las capas que las entidades NOMBRAN existen en la tabla LAYER.** Es la
     trampa gorda de F10: sin la sección TABLES, ezdxf abre el fichero, ve las
     polilíneas y el auditor da 0 y 0 — pero preguntarle al documento si esas
     capas están devuelve `False`. El criterio «abre en CAD con las dos capas
     separadas» fallaría entero sin que nada avisara.

Uso:  python validar-dxf.py <fichero.dxf> [fichero.dxf ...]
Sale con 0 si TODOS pasan, 1 si alguno no, 2 si no pudo ni intentarlo.
"""

import sys


def describir(entrada):
    """Un `ErrorEntry` de ezdxf, en una línea que se pueda leer.

    ⚠️ HACE FALTA: `ErrorEntry` no define `__str__`, así que interpolarlo tal cual
    imprime `<ezdxf.audit.ErrorEntry object at 0x…>`. Se vio en la primera
    verificación por mutación de este script: cazaba el defecto y **no sabía
    decir cuál era**, que es media regla de oro 1 sin cumplir.
    """
    codigo = getattr(entrada, "code", None)
    mensaje = (getattr(entrada, "message", "") or "").strip()
    entidad = getattr(entrada, "entity", None)
    nombre = ""
    if entidad is not None:
        try:
            nombre = f" [{entidad.dxftype()}#{entidad.dxf.get('handle', '?')}]"
        except Exception:  # noqa: BLE001 — describir no puede ser lo que rompa
            nombre = " [entidad]"
    return f"({codigo}) {mensaje or 'sin mensaje'}{nombre}"


def main(argv):
    # ⚠️ HACE FALTA EN WINDOWS, y costó una corrida: la consola sale en `cp1252`,
    # así que el primer `✓` que se imprime revienta con `UnicodeEncodeError` y el
    # script muere con traza —o sea, el validador «falla» por un carácter y no por
    # el fichero—. `errors='replace'` es la red de debajo: preferimos un símbolo
    # feo a perder el veredicto.
    for flujo in (sys.stdout, sys.stderr):
        try:
            flujo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):  # pragma: no cover — Python muy viejo
            pass

    ficheros = argv[1:]
    if not ficheros:
        print("validar-dxf.py: no se ha pasado ningún fichero.", file=sys.stderr)
        return 2

    try:
        import ezdxf
    except ImportError:
        print(
            "validar-dxf.py: falta el paquete 'ezdxf'. Instálalo con:\n"
            "  python -m pip install ezdxf",
            file=sys.stderr,
        )
        return 2

    print(f"ezdxf {ezdxf.__version__}")
    malos = 0

    for ruta in ficheros:
        problemas = []
        try:
            # `readfile`, NUNCA `recover`: ver la cabecera.
            doc = ezdxf.readfile(ruta)
        except Exception as causa:  # noqa: BLE001 — cualquier fallo aquí es «no abre»
            print(f"  ✗ {ruta}")
            print(f"      NO ABRE: {type(causa).__name__}: {causa}")
            malos += 1
            continue

        auditor = doc.audit()
        for error in auditor.errors:
            problemas.append(f"el auditor da un ERROR: {describir(error)}")
        for arreglo in auditor.fixes:
            # Un arreglo NO es un aprobado: es el lector tapando un defecto.
            problemas.append(f"el auditor ARREGLA algo al abrirlo: {describir(arreglo)}")

        capas_declaradas = {capa.dxf.name for capa in doc.layers}
        usadas = {}
        for entidad in doc.modelspace():
            usadas.setdefault(entidad.dxf.layer, 0)
            usadas[entidad.dxf.layer] += 1

        for nombre, cuantas in sorted(usadas.items()):
            if nombre not in capas_declaradas:
                problemas.append(
                    f"la capa «{nombre}» la nombran {cuantas} entidad(es) y NO ESTÁ en la "
                    "tabla LAYER: en el CAD no existe, aunque el fichero abra"
                )

        if problemas:
            print(f"  ✗ {ruta}")
            for p in problemas:
                print(f"      {p}")
            malos += 1
        else:
            entidades = sum(usadas.values())
            capas = ", ".join(sorted(usadas)) or "(ninguna)"
            print(f"  ✓ {ruta}  ·  {entidades} entidad(es) en [{capas}]")

    return 1 if malos else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

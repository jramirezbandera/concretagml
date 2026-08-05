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

── ⛔ Y POR QUÉ ADEMÁS MIRA LOS BYTES CRUDOS, QUE ES LO QUE FALTABA ─────────
El **2026-08-05** un usuario abrió en **ZWCAD 2023** el DXF que esta aplicación
exportaba y el programa se quedó en blanco y bloqueado. La causa: el fichero
declaraba `$ACADVER = AC1015` (R2000) **sin emitir nada de lo que R2000 exige**
—ni `CLASSES`, ni la tabla `BLOCK_RECORD`, ni `BLOCKS` con `*Model_Space` (que es
quien POSEE a las entidades), ni `OBJECTS` con el diccionario raíz—.

⚠️ **Y este script daba verde.** `ezdxf` **rellena por su cuenta las tablas y
secciones que faltan al cargar**, así que su modelo siempre las tiene y
preguntárselo a él responde por el modelo, nunca por el fichero. Un DXF R12
correcto, un R2000 completo y aquel R2000 mentiroso pasan los tres idénticos:
`readfile` sin quejas y auditor a 0/0.

De ahí que ahora haya DOS pasadas, y que la segunda **no toque ezdxf**:
  · la de ezdxf, que juzga si el fichero se puede leer y si hay que arreglarlo;
  · la de los BYTES, que juzga si el fichero **cumple la versión que dice ser**.
Ninguna de las dos sustituye a la otra, y ninguna sustituye a abrirlo en un CAD:
esto lo destapó una persona, no una máquina.

── LAS COSAS QUE COMPRUEBA, Y POR QUÉ CADA UNA ─────────────────────────────
  1. **Abre con `readfile`, no con `recover`.** La diferencia es todo el asunto:
     `recover` está para rescatar ficheros rotos, así que usarlo aquí sería
     preguntar «¿se puede salvar?» en vez de «¿está bien?».
  2. **El auditor no encuentra NADA que arreglar**: 0 errores y **0 arreglos**.
     Un fichero que el lector tiene que arreglar al abrirlo no es un fichero que
     se pueda firmar, y los arreglos de ezdxf son silenciosos.
  3. ⭐ **Las capas que las entidades NOMBRAN existen en la tabla LAYER.** Es la
     trampa gorda de F10: sin la sección TABLES, ezdxf abre el fichero, ve las
     polilíneas y el auditor da 0 y 0 — pero preguntarle al documento si esas
     capas están devuelve `False`.
  4. ⭐ **La versión declarada se CUMPLE** (sobre los bytes). Si el fichero dice
     R13 o superior, tiene que traer `CLASSES`, `BLOCK_RECORD`, `BLOCKS` con
     `*Model_Space` y `OBJECTS`. Es el defecto de ZWCAD, y es el único de los
     cuatro que ezdxf no puede ver.
  5. **Ningún tipo de línea nombrado por una capa se queda sin declarar** (sobre
     los bytes, por lo mismo: ezdxf se inventa la tabla LTYPE si falta).

Uso:  python validar-dxf.py <fichero.dxf> [fichero.dxf ...]
Sale con 0 si TODOS pasan, 1 si alguno no, 2 si no pudo ni intentarlo.
"""

import sys

# Desde R13 el formato introdujo el grafo de handles: las entidades las posee un
# `BLOCK_RECORD`, los objetos no gráficos viven en `OBJECTS` bajo un diccionario
# raíz, y `CLASSES` declara las clases no fijas. Declarar una versión de aquí para
# arriba es comprometerse a traer todo eso. (Medido sobre AC1015, que es lo que
# emitíamos.)
PRIMERA_VERSION_CON_ESQUELETO = 1012

ESQUELETO_EXIGIDO = {
    "sección CLASSES": lambda e: "CLASSES" in e["secciones"],
    "sección BLOCKS": lambda e: "BLOCKS" in e["secciones"],
    "sección OBJECTS": lambda e: "OBJECTS" in e["secciones"],
    "tabla BLOCK_RECORD": lambda e: "BLOCK_RECORD" in e["tablas"],
    "bloque *Model_Space": lambda e: any(b.upper() == "*MODEL_SPACE" for b in e["bloques"]),
}


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


def leer_estructura(ruta):
    """Qué trae el FICHERO, leído a pelo. Sin ezdxf, y esa es toda la gracia.

    ezdxf rellena al cargar lo que falta, así que su documento siempre tiene todas
    las tablas. Preguntarle a él «¿tenía este fichero la tabla BLOCK_RECORD?»
    responde que sí incluso cuando no estaba. Aquí se leen los pares (código,
    valor) tal cual vienen.
    """
    with open(ruta, "r", encoding="latin1", errors="replace") as f:
        lineas = [l.rstrip("\r\n") for l in f]

    est = {
        "acadver": None,
        "secciones": [],
        "tablas": [],
        "bloques": [],
        "ltypes_declarados": set(),
        "ltypes_usados": set(),
    }
    seccion = None
    esperando = None  # 'seccion' | 'tabla' | 'bloque' | 'acadver'
    tabla = None
    registro = None

    i = 0
    while i + 1 < len(lineas):
        codigo = lineas[i].strip()
        valor = lineas[i + 1].strip()
        i += 2

        if codigo == "0" and valor == "SECTION":
            esperando = "seccion"
            continue
        if esperando == "seccion" and codigo == "2":
            seccion = valor
            est["secciones"].append(valor)
            esperando = None
            continue
        if codigo == "0" and valor == "ENDSEC":
            seccion, tabla, registro = None, None, None
            continue

        if seccion == "HEADER":
            if codigo == "9":
                esperando = "acadver" if valor == "$ACADVER" else None
            elif esperando == "acadver" and codigo == "1":
                est["acadver"] = valor
                esperando = None
        elif seccion == "TABLES":
            if codigo == "0" and valor == "TABLE":
                esperando = "tabla"
            elif esperando == "tabla" and codigo == "2":
                tabla = valor
                est["tablas"].append(valor)
                esperando = None
            elif codigo == "0" and valor == "ENDTAB":
                tabla, registro = None, None
            elif codigo == "0":
                registro = valor
            elif tabla == "LTYPE" and registro == "LTYPE" and codigo == "2":
                est["ltypes_declarados"].add(valor)
            elif tabla == "LAYER" and registro == "LAYER" and codigo == "6":
                est["ltypes_usados"].add(valor)
        elif seccion == "BLOCKS":
            if codigo == "0" and valor == "BLOCK":
                esperando = "bloque"
            elif esperando == "bloque" and codigo == "2":
                est["bloques"].append(valor)
                esperando = None

    return est


def version_numerica(acadver):
    """`'AC1015'` → `1015`. `None` si no hay versión o no se entiende.

    Un fichero SIN `$ACADVER` es R12 por convenio —así son los del Catastro—, y
    eso no es un defecto: es no prometer nada.
    """
    if not acadver or not acadver.upper().startswith("AC"):
        return None
    try:
        return int(acadver[2:])
    except ValueError:
        return None


def problemas_de_estructura(est):
    """Lo que el fichero promete y no cumple. Devuelve una lista de frases."""
    problemas = []

    numero = version_numerica(est["acadver"])
    if numero is not None and numero >= PRIMERA_VERSION_CON_ESQUELETO:
        faltan = [nombre for nombre, hay in ESQUELETO_EXIGIDO.items() if not hay(est)]
        if faltan:
            problemas.append(
                f"declara «{est['acadver']}» y NO trae: {', '.join(faltan)}. "
                "Un lector estricto aplica las reglas de esa versión y se queda sin "
                "suelo donde apoyar las entidades — ZWCAD 2023 se quedó en blanco y "
                "bloqueado con un fichero así el 2026-08-05, y ezdxf lo aprobaba"
            )

    huerfanos = sorted(est["ltypes_usados"] - est["ltypes_declarados"])
    if huerfanos:
        problemas.append(
            f"la(s) capa(s) nombran el/los tipo(s) de línea {', '.join(huerfanos)} y no está(n) "
            "en la tabla LTYPE: es una referencia colgando fuera del fichero"
        )

    return problemas


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

        # ── Pasada 1: los BYTES. Va PRIMERO a propósito: es la que ezdxf no puede
        # hacer, porque para cuando él tiene un documento ya ha rellenado los huecos.
        try:
            est = leer_estructura(ruta)
        except OSError as causa:
            print(f"  ✗ {ruta}")
            print(f"      NO SE PUEDE LEER: {type(causa).__name__}: {causa}")
            malos += 1
            continue
        problemas.extend(problemas_de_estructura(est))

        # ── Pasada 2: ezdxf, el lector independiente.
        try:
            # `readfile`, NUNCA `recover`: ver la cabecera.
            doc = ezdxf.readfile(ruta)
        except Exception as causa:  # noqa: BLE001 — cualquier fallo aquí es «no abre»
            print(f"  ✗ {ruta}")
            for p in problemas:
                print(f"      {p}")
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
            version = est["acadver"] or "sin declarar (R12)"
            print(f"  ✓ {ruta}  ·  {version}  ·  {entidades} entidad(es) en [{capas}]")

    return 1 if malos else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

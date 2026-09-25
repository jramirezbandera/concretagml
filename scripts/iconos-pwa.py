"""scripts/iconos-pwa.py — los iconos del manifiesto de la aplicación instalable.

Dibuja EL MISMO recinto que el favicon SVG en línea de `index.html` —el trapecio
amarillo `#FFD600` sobre el cuadro `#0F172A`— a los tamaños que pide el manifiesto
(`public/manifest.webmanifest`). Se generan con este script y se versionan los PNG:
así nadie tiene que tener PIL para construir, y quien cambie el favicon sabe dónde
rehacer los iconos.

    python scripts/iconos-pwa.py

Tres ficheros en `public/iconos/`:
  · icono-192.png y icono-512.png, con las esquinas redondeadas del favicon (rx 7/32);
  · icono-maskable-512.png, a sangre y sin redondear: el sistema operativo le pone su
    propia máscara. El recinto ya cabe entero en la zona segura (círculo de radio
    0,4 del lado): su vértice más alejado del centro está a 10,7/32 = 0,33.

Se dibuja a 4× y se reduce con LANCZOS, que es lo que da el borde suave que el SVG
tiene de serie.
"""

from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "public" / "iconos"

FONDO = "#0F172A"
RECINTO = "#FFD600"
# El `path` del favicon, en su caja de 32×32: M7.5 22.5 11.5 8.5 24.5 11.5 21 24.5Z
VERTICES = [(7.5, 22.5), (11.5, 8.5), (24.5, 11.5), (21.0, 24.5)]
TRAZO = 2.3
RADIO = 7.0
SUPER = 4


def dibujar(lado: int, redondeado: bool) -> Image.Image:
    grande = lado * SUPER
    escala = grande / 32
    imagen = Image.new("RGBA", (grande, grande), (0, 0, 0, 0))
    lienzo = ImageDraw.Draw(imagen)
    if redondeado:
        lienzo.rounded_rectangle((0, 0, grande - 1, grande - 1), radius=RADIO * escala, fill=FONDO)
    else:
        lienzo.rectangle((0, 0, grande - 1, grande - 1), fill=FONDO)
    puntos = [(x * escala, y * escala) for x, y in VERTICES]
    ancho = round(TRAZO * escala)
    lienzo.line(puntos + puntos[:2], fill=RECINTO, width=ancho, joint="curve")
    # `joint="curve"` redondea las uniones intermedias, y cerrar con los DOS primeros
    # puntos repetidos hace que la del primer vértice también lo sea (stroke-linejoin).
    return imagen.resize((lado, lado), Image.LANCZOS)


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    for nombre, lado, redondeado in [
        ("icono-192.png", 192, True),
        ("icono-512.png", 512, True),
        ("icono-maskable-512.png", 512, False),
    ]:
        dibujar(lado, redondeado).save(DESTINO / nombre, optimize=True)
        print(f"public/iconos/{nombre}")


if __name__ == "__main__":
    main()

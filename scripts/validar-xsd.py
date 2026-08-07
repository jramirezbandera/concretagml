"""Valida ficheros GML contra un XSD oficial de INSPIRE (parcela o edificio).

Lo invoca `scripts/validar-xsd.mjs` cuando encuentra Python con `lxml` y no
encuentra `xmllint`. Es el mismo trabajo que hace `xmllint --schema`, con dos
diferencias que importan:

  * cachea en disco cada XSD que descarga (`esquemas/cache/`), así que la primera
    ejecución tarda y las siguientes son inmediatas y funcionan sin red;
  * valida contra UN solo esquema, el que se le pase. Para parcela eso significa
    `cp/4.0` A SECAS, sin cargar `wfs/2.0`, que es exactamente lo que hace el
    validador del IVG. Ahí está la gracia: un GML con raíz `wfs:FeatureCollection`
    —la DESCARGA del servicio del Catastro— pasa si le das los dos esquemas y
    falla si le das solo el de parcela. Ese fallo es el que la Sede devolvió el
    2026-07-27 y el motivo de que este script exista de verdad y no como
    intención.

⚠️ **Y el 2026-08-06 el edificio enseñó el otro lado de la misma moneda.** El
fichero de edificio que la app producía **validaba contra su esquema** y el ICUC
lo **rechazaba**: le faltaba `xmlns:xlink` en la raíz, que ni el XSD exige ni la
ayuda oficial menciona. Traducción, que es la de siempre y conviene tenerla a
mano: **que esto diga OK no garantiza que la Sede lo acepte; que falle sí
garantiza que hay un problema.** Es una red asimétrica y así hay que leerla.

Uso:  python validar-xsd.py <dir-cache> <ns> <url-xsd> <fichero.gml> [...]
Sale con 0 si TODOS validan, con 1 si alguno no, con 2 si no pudo ni intentarlo.
"""

import hashlib
import os
import sys
import urllib.request

XSD_CP40 = 'https://inspire.ec.europa.eu/schemas/cp/4.0/CadastralParcels.xsd'
NS_CP40 = 'http://inspire.ec.europa.eu/schemas/cp/4.0'

DRIVER = '''<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:import namespace="%s" schemaLocation="%s"/>
</xs:schema>'''


def main(argv):
    if len(argv) < 5:
        sys.stderr.write('uso: validar-xsd.py <dir-cache> <ns> <url-xsd> <fichero.gml> [...]\n')
        return 2
    cache, ns, xsd, ficheros = argv[1], argv[2], argv[3], argv[4:]

    # El `base_url` del esquema envoltorio es el DIRECTORIO, no el propio XSD: si
    # se le da la URL del fichero, libxml2 considera que el envoltorio ES ese
    # fichero y rechaza el import con «The schema must not import/include/redefine
    # itself».
    base_driver = xsd.rsplit('/', 1)[0] + '/'
    driver = DRIVER % (ns, xsd)

    try:
        from lxml import etree
    except ImportError:
        sys.stderr.write('lxml no disponible\n')
        return 2

    os.makedirs(cache, exist_ok=True)

    def parece_esquema(datos):
        """¿Estos bytes son un XSD, o son otra cosa con `200 OK`?

        ⛔ MEDIDO EL 2026-08-06, y por eso existe esta guarda. Todo
        `inspire.ec.europa.eu/draft-schemas/…` —la ruta que declara el
        `xsi:schemaLocation` de cualquier fichero GML de edificio del Catastro—
        contesta **`200 OK` con 376.809 bytes de `text/html`**: la página «Inspire
        Registry - Page not found». Sin esta comprobación, esos bytes se guardan
        en la caché con extensión `.xsd`, el esquema no se puede construir y el
        script informa de que el FICHERO no valida — acusando al GML de un defecto
        que es del servidor del esquema. Es la misma trampa que el WFS del Catastro
        (F05): el `200` no dice nada.
        """
        cabeza = datos[:400].lstrip()
        return cabeza.startswith(b'<?xml') or b'<xs:schema' in cabeza or b'<schema' in cabeza

    def descargar(url):
        ruta = os.path.join(cache, hashlib.sha1(url.encode()).hexdigest() + '.xsd')
        if not os.path.exists(ruta):
            peticion = urllib.request.Request(url, headers={'User-Agent': 'concreta-gml'})
            with urllib.request.urlopen(peticion, timeout=90) as respuesta:
                datos = respuesta.read()
                tipo = respuesta.headers.get('Content-Type', '(sin Content-Type)')
            if not parece_esquema(datos):
                # NO se guarda en la caché: si se guardara, el fallo sobreviviría a
                # la siguiente ejecución y además sin red, que es la peor forma de
                # envenenarla.
                raise ValueError(
                    'la respuesta no es un XSD (Content-Type: %s, %d bytes). '
                    'La URL contesta 200 pero devuelve otra cosa.' % (tipo, len(datos))
                )
            with open(ruta, 'wb') as destino:
                destino.write(datos)
            sys.stderr.write('  [xsd] descargado %s\n' % url)
        with open(ruta, 'rb') as origen:
            return origen.read()

    class ResolverConCache(etree.Resolver):
        def resolve(self, url, pubid, context):
            if url.startswith('http://') or url.startswith('https://'):
                try:
                    return self.resolve_string(descargar(url), context, base_url=url)
                except Exception as error:  # noqa: BLE001 - se informa y se sigue
                    sys.stderr.write('  [xsd] NO se pudo traer %s: %s\n' % (url, error))
                    return None
            return None

    parser = etree.XMLParser(load_dtd=False, no_network=False)
    parser.resolvers.add(ResolverConCache())

    try:
        arbol = etree.fromstring(driver.encode('utf-8'), parser, base_url=base_driver)
        esquema = etree.XMLSchema(arbol)
    except Exception as error:  # noqa: BLE001
        sys.stderr.write('no se pudo construir el esquema: %s\n' % error)
        return 2

    fallos = 0
    for fichero in ficheros:
        nombre = os.path.basename(fichero)
        try:
            documento = etree.parse(fichero)
        except Exception as error:  # noqa: BLE001
            print('  FALLO  %s -> XML mal formado: %s' % (nombre, error))
            fallos += 1
            continue
        if esquema.validate(documento):
            print('  OK     %s' % nombre)
        else:
            fallos += 1
            print('  FALLO  %s' % nombre)
            for entrada in esquema.error_log:
                print('           linea %s: %s' % (entrada.line, entrada.message))
    return 1 if fallos else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))

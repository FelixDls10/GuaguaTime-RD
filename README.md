# GuaguaTime RD

Simulador de rutas, tiempos y costos del transporte publico dominicano. Permite comparar opciones de movilidad entre sectores de Santo Domingo, considerando condiciones como lluvia, hora pico y paros de transporte.

## Caracteristicas

- Busqueda de rutas entre 20 sectores de Santo Domingo (Gazcue, Naco, Zona Colonial, Piantini, Los Mina, etc.)
- Comparacion por **tiempo**, **costo** y **transbordos**
- Condiciones de viaje configurables (lluvia, hora pico, paro)
- Mapa esquematico de la ruta seleccionada
- Historial de busquedas y favoritos (almacenados en localStorage)
- Modo claro / oscuro
- Modo ahorro (animaciones reducidas)
- Soporte bilingue: espanol e ingles
- PWA instalable con Service Worker para uso offline

## Modos de transporte

| Modo | Costo base (RD$) |
|------|-------------------|
| Guagua | 25 |
| Carro publico | 30 - 35 |
| Motoconcho | 60+ (variable segun distancia) |
| OMSA | 15 - 20 |
| Metro | 20 |
| Teleferico | 20 |

## Instrucciones de ejecucion

### Opcion 1: Abrir directamente en el navegador

1. Abrir el archivo `index.html` directamente en un navegador web.
2. La aplicacion incluye un fallback XHR que permite cargar los datos JSON incluso usando el protocolo `file://`.

### Opcion 2: Servidor local (recomendado)

Usar cualquier servidor HTTP estatico. Ejemplos:

```bash
# Con Python 3
python -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000

# Con Live Server de VS Code
# Click derecho en index.html > "Open with Live Server"
```

Luego abrir `http://localhost:8000` en el navegador.

### Opcion 3: Instalar como PWA

Al acceder desde un servidor HTTPS o localhost, el navegador ofrecera instalar la app como aplicacion independiente gracias al manifest y Service Worker incluidos.

## Estructura del proyecto

```
GuaguaTime-RD/
├── index.html              # Pagina principal
├── app.js                  # Logica de la aplicacion
├── styles.css              # Estilos
├── sw.js                   # Service Worker para cache offline
├── GuaguaTimeRDiso.png     # Logo
└── data/
    ├── sectores.json       # Sectores con coordenadas para el mapa
    ├── rutas.json          # Rutas predefinidas con tramos
    ├── condiciones.json    # Condiciones de viaje
    ├── i18n-es.json        # Traducciones espanol
    ├── i18n-en.json        # Traducciones ingles
    ├── lugares-interes.json# Puntos de interes
    └── manifest.json       # Manifest PWA
```

## Criterios de calculo

### 1. Tiempo base

Se suma el campo `time_min` de cada tramo (segmento) de la ruta:

```
tiempo_base = SUM(segmento.time_min)
```

### 2. Impacto de condiciones sobre el tiempo

Por cada condicion activa, el tiempo se multiplica acumulativamente:

```
tiempo_total = tiempo_base x (1 + condicion1.time_pct / 100) x (1 + condicion2.time_pct / 100) x ...
```

Los porcentajes de cada condicion son:

| Condicion | Incremento de tiempo | Costo extra (RD$) |
|-----------|---------------------|--------------------|
| Lluvia | +25% | +10 |
| Hora pico | +40% | +0 |
| Paro de transporte | +60% | +15 |

**Ejemplo:** Una ruta de 20 min con lluvia y hora pico:
`20 x 1.25 x 1.40 = 35 min`

### 3. Costo total

Se suma el costo base de cada tramo mas el costo extra de todas las condiciones activas:

```
costo_total = SUM(segmento.cost) + SUM(condicion_activa.cost_extra)
```

### 4. Transbordos

Cantidad de cambios de vehiculo en la ruta:

```
transbordos = cantidad_de_tramos - 1
```

### 5. Busqueda de rutas

La busqueda sigue tres niveles de prioridad:

1. **Rutas directas:** Se buscan rutas predefinidas entre origen y destino (incluyendo rutas en direccion inversa).
2. **Rutas via hubs:** Si no hay rutas directas, se intenta combinar dos rutas pasando por sectores intermedios (Gazcue, Naco, Zona Colonial, Los Prados, Arroyo Hondo).
3. **Rutas sinteticas:** Si no se encuentra ninguna combinacion, se generan rutas estimadas usando la distancia Manhattan entre coordenadas del mapa: `distancia = |x1 - x2| + |y1 - y2|`, con tiempo estimado `max(10, distancia / 12)` minutos.

### 6. Ordenamiento

Los resultados se pueden ordenar por:
- **Tiempo** (por defecto) — menor tiempo total primero
- **Costo** — menor costo total primero
- **Transbordos** — menor cantidad de transbordos primero

## Tecnologias

- HTML5, CSS3, JavaScript vanilla (ES5 compatible)
- Google Fonts (Inter) y Material Icons
- PWA con Service Worker
- Sin dependencias ni frameworks externos

# Ideas de mejoras (relevamiento 2026-11-06)

Salió de tres análisis en paralelo sobre el código de master: visual, funcionalidades y lógica contraintuitiva. Son propuestas para priorizar; nada de esto está implementado.

Esfuerzo: S = chico, M = medio, L = grande.

---

## A. Visual: "Noche de estadio"

**Cómo está hoy:** Tailwind v4 con tokens en `src/app/globals.css`. Casi todo se arma con `Card` y listas `divide-y`. No hay librerías de animación ni `loading.tsx` (skeletons). Next 16.3 trae `<ViewTransition>` nativo sin configurar nada (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`).

**Recomendación técnica:** CSS puro + `ViewTransition`. Sumar `canvas-confetti` (~6 kB) para los festejos y `motion` solo si se hace el swipe con física.

### Top 5

| # | Propuesta | Archivos | Esf. |
|---|---|---|---|
| 1 | Transiciones entre vistas (la fila del partido "se abre" en el detalle) + skeletons con shimmer | `partidos/page.tsx`, `partidos/[id]/page.tsx`, nuevos `loading.tsx` | S |
| 2 | Goles con botones − / + grandes, el marcador hace pop, vibración y confetti al guardar una victoria | `GolesInput.tsx`, `GolesEditor.tsx` | S |
| 3 | "Próximo partido" destacado arriba con cuenta regresiva y aro de confirmados (8/10); el marcador se vuelve tablero de estadio y el día del partido entra en "modo Match Day" | `partidos/page.tsx`, `Marcador.tsx` | M |
| 4 | Carta de jugador tipo figurita: rating, marco bronce/plata/oro y brillo holográfico (la pieza más compartible para TikTok) | `PlantelGrid.tsx`, `jugadores/[id]/page.tsx`, nuevo `CartaJugador.tsx` | M |
| 5 | Votar tocando figuritas en vez de `<select>`; podio 3D en estadísticas | `VotoSelects.tsx`, `estadisticas/page.tsx` | M |

### Más ideas por módulo

- **Confirmación:** deslizar la ficha a la derecha para "Juego" y a la izquierda para "No juego".
- **Convocados:** vista "vestuario" en 3 columnas con una barra apilada arriba.
- **Partido:** timeline vertical (convocatoria → resultado → votación → cierre) para ordenar una página de 844 líneas; goleadores dibujados sobre la cancha (reusando `PitchLines`).
- **Estadísticas:** barras proporcionales que se llenan al entrar en pantalla.
- **Perfil:**
  - Radar de atributos (coordinar con Pro).
  - Logros como insignias con efecto de "desbloqueo".
- **Agenda:**
  - Mapa de calor graduado según pueden/total.
  - Pintar horas arrastrando.
- **Desafíos:** formato "VS" con escudos enfrentados y H2H (historial entre los dos grupos).
- **Navegación:**
  - Indicador deslizante en el bottom nav.
  - Puntos en "Partidos" cuando hay algo para votar o confirmar.
- **Login y unirse:** líneas de cancha animadas; el escudo del grupo grande en la invitación.

### Lenguaje visual

- **Paleta:** césped (acción), oro (solo gloria), rojo (solo derrota o peor), cal (líneas), plata y bronce.
- **Números:** Geist Mono extrabold con `tabular-nums`.
- **Formas:** 3 niveles (Hero / Card / Fila).
- **Movimiento:** tokens en `@theme` (`--ease-pop`, `--dur-fast/base/hero`).
- **Vibración:** helper `src/lib/haptics.ts`. Todo respeta `prefers-reduced-motion`.

---

## B. Funcionalidades: más protagonismo al jugador

**Cómo está hoy:** el jugador solo confirma, vota y crea encuestas. Desafíos, goles, convocatoria y configuración son todos del admin.

### Base de canchas

Ya existe una parte: `canchas` por grupo (migraciones 0026 y 0027), con trigger desde `partidos.lugar`, más renombrar y unificar en Admin. Falta ciudad y coordenadas.

**Modelo sugerido:**
- `ciudades`, y una columna `grupos.ciudad_id`.
- `canchas_lugares`: la cancha real compartida, con dirección, lat/lng, estado pendiente/verificada/fusionada y quién la creó.
- `canchas.lugar_id`, que puede quedar vacío. La cancha de cada grupo sigue siendo un alias local, así que no se rompe nada.

**De dónde salen los datos:**
- Carga manual a partir de las canchas que ya usan los grupos.
- Aportes de usuarios con moderación.
- OSM: gratis, licencia ODbL, cobertura irregular.
- Google Places: pago, y no permite guardar los datos en una base propia (solo `place_id`).

**Riesgos:**
- Arranque en frío: directorio vacío con pocos grupos por ciudad.
- Privacidad: el grupo elige si aparecer, y nunca se muestran jugadores ni ubicación.
- Moderación.

**Etapas:**
- **E0 (S):** "Mis canchas" en el perfil, con partidos, goles y G/E/P por `cancha_id`. No cambia el modelo.
- **E1 (M):** dirección y coordenadas en la cancha + `grupos.ciudad_id` + "Cómo llegar" en el partido.
- **E2 (M):** canchas compartidas, con sugerencia "¿es la misma que usa otro grupo?" y fusión moderada.
- **E3 (L):** directorio de grupos que eligen aparecer, por ciudad, con "Desafiar" y "Me falta uno". Encararlo recién cuando haya varias ciudades con 2 o más grupos.
- **E4:** reseñas de cancha.

### Funcionalidades para el jugador

| # | Funcionalidad | Esf. | Plan |
|---|---|---|---|
| 1 | **El jugador carga sus goles** y el admin aprueba (se aprueba solo a las 24 h) | M | Free |
| 2 | **Hilo, comentarios y reacciones** por partido y por gol | M | Free |
| 3 | **Pronósticos** del marcador antes del partido + tabla de pronosticadores | S-M | Free |
| 4 | **Canchas E0–E1** (historial + "Cómo llegar") | S-M | Free básico / detalle Pro |
| 5 | **"Me falta uno"** dentro del grupo: avisa por push a quienes tienen disponibilidad | M | Free |
| 6 | Logros guardados con aviso push e imagen para compartir | M | Mixto |
| 7 | Racha de asistencia visible ("no la cortes") | S | Free |
| 8 | Perfil público para compartir `/j/[slug]` (sirve para crecer) | M | Free |
| 9 | Resumen de temporada "Wrapped" (ya está en el plan Pro, en pausa) | M | A decidir |
| 10 | Formaciones guardadas, propuestas y votadas por los jugadores | M | Free |
| 11 | Calificar la cancha (1 a 5) junto con el voto | S | Free |
| 12 | El jugador propone un desafío y el admin lo aprueba | S-M | Free |

El pago de la cancha con "Ya pagué" ya está diseñado en `plan-pro.md`: conviene priorizar ese diseño en lugar de hacer uno nuevo.

---

## C. Arreglos de lógica y UX

### Top 10

| # | Hallazgo | Dónde | Esf. |
|---|---|---|---|
| 1 | **Empate que no se puede definir = todos ganan.** Es intencional (`desempate.ts`: "cuentan todos los empatados"), pero si 10 personas votan a 10 distintos hay 10 MVP. Revisar la regla: sin ganador, criterio de desempate o tope. | `src/lib/desempate.ts`, `get_ranking_votos` (0029) | M |
| 2 | **No se puede corregir quién jugó** después de cargar el resultado. Además se borran los `no_juega`. Hoy la única salida es borrar el partido. | `partidos.ts:293`, `:506` | M |
| 3 | **No hay "Cancelar partido":** borrar no avisa a los convocados. | `partidos.ts:248` | M |
| 4 | **"Editar partido" escondido** en Admin, y `editarPartido` no valida la fecha ni reinicia las confirmaciones. | `admin.ts:82`, `admin/page.tsx:222` | S |
| 5 | **Los nombres de equipos de Reglas se pisan** con cada partido "entre nosotros". El texto "los cambios aplican a partidos sin goles" no es cierto para todas las opciones. | `partidos.ts:193`, `:322`; `admin/page.tsx:191` | S |
| 6 | **Goles de un desafío por corregir bloquean** crear partidos y desafíos en todo el grupo. Mejor un aviso. | `goles-por-corregir.ts`, `partidos.ts:125` | S |
| 7 | Mejor y Peor se guardan por separado: puede quedar uno solo. Y el error dice "mínimo" cuando el admin apagó la votación. (Que el voto no se pueda cambiar es a propósito.) | `votos.ts:33`, `:139` | S |
| 8 | **Convocar "entre nosotros" obliga a armar los equipos** de entrada. Mejor convocar primero y sortear o armar con los confirmados. | `partidos.ts:149` | M |
| 9 | **El "mínimo para votar" no cuenta invitados**, pero el texto dice "cuentan los dos equipos". El cierre manual a las 24 h es poco claro. | `ReglasFields.tsx:64`, `votacion.ts:12` | S |
| 10 | **Cambiar el modo de disponibilidad invierte todo sin avisar.** | `disponibilidad.ts:123` | S |

### Otros

- **Desafíos:** demasiados estados. "Vencido" es solo visual, el plazo de carga es distinto al de los partidos comunes y el marcador y los goles se cargan por separado.
- **Admins:** cualquiera puede sacar al creador. El último que sale borra el grupo (ya está anotado como pendiente).
- **Pedir aprobación:** está en la tab "Grupo" en vez de "Reglas". Al rechazar a alguien no se le avisa.
- **Defaults distintos** entre grupos viejos y nuevos (Peor y Confirmación).
- **Terminología mezclada:** convocados / jugadores / quiénes jugaron, y "Nosotros" en lugar del nombre del grupo.

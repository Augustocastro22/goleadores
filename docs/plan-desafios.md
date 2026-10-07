# Plan: desafíos entre grupos

Estado: **para más adelante**, no está empezado. Antes de implementar, leer
las guías de `node_modules/next/dist/docs/` que toquen (ver AGENTS.md).

## Idea

El admin de un grupo desafía a otro grupo, el otro acepta y queda armado el
partido para los dos. Después de jugarlo, cualquiera de los dos propone el
marcador y el otro lo confirma o contrapropone. Si no se ponen de acuerdo, el
partido cuenta igual adentro de cada grupo pero queda **sin verificar** entre
los grupos.

## Decisiones tomadas

- **Cómo se encuentra al otro grupo:** con un **código de desafío** propio de
  cada grupo, distinto del de invitación (el de invitación sirve para entrar al
  grupo y no hay que compartirlo con extraños). No hay buscador de grupos.
- **Dos partidos vinculados**, uno en cada grupo, más una fila de desafío que
  comparten. Cada grupo sigue con su convocatoria, confirmación, goles,
  votación de MVP/Peor y estadísticas. El otro grupo ve el desafío (nombre,
  escudo, fecha, estado, marcador), nunca los jugadores ni los votos del otro.
- **Marcador aparte:** el marcador del desafío (ej: 6-5) se propone por
  separado. Cada grupo carga los goles de sus jugadores como hoy. Lo que no
  sumen los jugadores va a `goles_otros` (invitados, goles en contra). Cargar
  más goles de jugadores que los del marcador propio da error.
- **Lo interno nunca depende del otro grupo:** goles, MVP, Peor y partidos
  jugados cuentan apenas se cargan, con o sin acuerdo sobre el marcador.
- **El resultado se propone solo después del partido** (fecha y hora pasadas,
  `partidoYaPaso`), y lo puede proponer **cualquiera de los dos**.
- **Contrapropuesta en vez de rechazo:** "no, fue otro resultado" obliga a poner
  el marcador correcto y le vuelve al otro. Se puede ir y volver las veces que
  haga falta. Cualquiera puede cortar con "no nos ponemos de acuerdo" y queda
  sin verificar.
- **Auto-aceptación fija en 3 días** para cualquier propuesta pendiente
  (resultado o fecha nueva), igual para todos los grupos. No es configurable:
  como afecta al otro grupo, un grupo podría poner 90 días y dejarlo colgado.
- **Suspender:** cualquiera de los dos admins, mientras no se jugó. Queda
  registrado quién suspendió.
- **Reprogramar:** al suspender (o después, o sin suspender) se puede proponer
  fecha/hora/lugar nuevos. El partido no cambia hasta que el otro acepta.
- **Avisos:** lo que hay que responder les llega a los admins; lo que afecta al
  partido les llega también a los convocados. Una reprogramación les llega a
  los convocados **recién cuando se confirma**, no mientras es una propuesta.
- **Reconfirmar al reprogramar:** si el grupo pide confirmación
  (`pedir_confirmacion`), al confirmarse la fecha nueva todos los convocados
  vuelven a `pendiente` y se les pide que confirmen de nuevo. Si no pide
  confirmación, solo se les avisa la fecha nueva. En los dos casos, el admin ve
  quién tiene un bloqueo de disponibilidad ese día (`bloqueaFecha`).

## Estados

Del desafío:

```
pendiente ──► aceptado ──► (jugado: pasa la fecha)
   │  │          │  ▲
   │  │          ▼  │ (se acepta fecha nueva)
   │  │       suspendido
   │  ▼          │
   │ rechazado   ▼
   ▼          cancelado
 vencido (nadie respondió antes de la fecha)
```

Del resultado (solo una vez jugado):

```
sin_cargar ──► en_discusion ──► verificado      (aceptan, o pasan 3 días sin respuesta)
                     │
                     └────────► sin_verificar   ("no nos ponemos de acuerdo")
```

## Base de datos (migración nueva)

- `grupos.codigo_desafio`: único, se genera como `codigo_invitacion` y se puede
  regenerar desde /admin.
- `desafios`: `grupo_desafiante_id`, `grupo_desafiado_id`, `fecha`, `hora`,
  `lugar`, `estado`, `resultado_estado`, `goles_desafiante` /
  `goles_desafiado` (los verificados), `suspendido_por_grupo_id`, `motivo`,
  `creado_por`, `created_at`, `updated_at`. Para la reprogramación pendiente:
  `propuesta_fecha` / `propuesta_hora` / `propuesta_lugar` /
  `propuesta_por_grupo_id` / `propuesta_vence_en` (hay como mucho una por vez).
- `desafio_resultados`: una fila por propuesta de marcador (`propuesto_por_grupo_id`,
  los dos goles, `estado`: pendiente / aceptada / reemplazada, `vence_en`).
  Queda el historial del ida y vuelta.
- `partidos.desafio_id` (nullable), único por `(desafio_id, grupo_id)`.
- **RLS:** los miembros de cualquiera de los dos grupos leen el desafío y sus
  propuestas. Todas las escrituras van por funciones `security definer`
  (`crear_desafio`, `responder_desafio`, `suspender_desafio`,
  `proponer_fecha`, `responder_fecha`, `proponer_resultado`,
  `aceptar_resultado`, `cortar_resultado`). Validan que sea admin del lado
  que corresponde y que la transición de estado sea válida. Hace falta
  `security definer` porque al aceptar se crean partidos en el grupo del otro.
- **Si se borra un grupo:** las FKs a los grupos con `on delete set null`, y el
  desafío pasa a cancelado si no se jugó. El partido del otro grupo sigue
  existiendo (si se jugó, queda como partido interno). Revisar junto con el
  pendiente de "Eliminar grupo" / soft delete.

## Lógica y acciones

- `src/lib/desafios.ts`, con tests como `confirmacion.test.ts`: transiciones
  válidas, a quién le toca responder, vencimientos, si una propuesta igual a la
  pendiente cuenta como aceptarla, y cómo se arma `goles_otros` a partir del
  marcador.
- `src/lib/actions/desafios.ts`: las server actions que llaman a las funciones
  de arriba y mandan los push.
- **Partidos existentes:**
  - `createPartido` no cambia. Los partidos de desafío los crea
    `responder_desafio` sin convocados, y cada admin convoca con el
    `ConvocadosEditor` de siempre, todos en el Equipo 1 (sin Equipo 2).
  - `rival` = nombre del otro grupo.
  - `deletePartido` y `editarPartido` se bloquean para partidos de desafío: se
    usa suspender, cancelar o reprogramar.
  - `guardarGolesPartido` sigue igual (abre la votación como hoy), pero valida
    contra el marcador propio y calcula `goles_otros` solo.
  - Con el marcador verificado (o con la última propuesta propia si quedó sin
    verificar) se fijan `goles_rival` y `goles_otros` del partido de cada grupo.
- **Cron** (diario, como `cerrar-votaciones`; ver si conviene sumarlo a esa ruta
  por el límite de crons del plan de Vercel):
  - Acepta propuestas de resultado o de fecha vencidas (3 días).
  - Pasa a `vencido` los desafíos pendientes cuya fecha ya pasó.

## Avisos

| Evento | A quién |
|---|---|
| Te desafiaron | Admins del desafiado |
| Aceptaron / rechazaron tu desafío | Admins del desafiante |
| Cancelaron (antes de aceptar) | Admins del otro |
| Suspendieron | Admins del otro + convocados de los dos |
| Proponen fecha nueva | Admins del otro |
| Se confirmó la fecha nueva | Admins + convocados de los dos ("confirmá si jugás" si el grupo pide confirmación) |
| Rechazaron la fecha nueva | Admins del que la propuso |
| Proponen resultado / contrapropuesta | Admins del otro |
| Resultado verificado | Admins + convocados de los dos |
| Quedó sin verificar | Admins de los dos |
| Se aceptó solo por los 3 días | Admins de los dos |

La convocatoria y la votación siguen avisando como hoy, cada grupo por su lado.

## Pantallas

- **/desafios** (admins; los jugadores ven el historial): recibidos, enviados e
  historial. Botón "Desafiar a un grupo": se pega el código, se ve nombre y
  escudo del otro grupo para confirmar, y se completan fecha, hora y lugar.
- **/admin:** código de desafío con compartir y regenerar.
- **/partidos/[id]**, si es de desafío: un bloque con el otro grupo, el estado y
  las acciones que correspondan (suspender, proponer fecha, proponer resultado,
  aceptar, contraproponer, "no nos ponemos de acuerdo"), más el historial de
  propuestas.
- **/partidos:** etiquetas "Desafío", "Suspendido" y "Sin verificar".
- **/estadisticas:** historial contra cada grupo (G/E/P verificados) y cuántos
  sin verificar, ej: "4 jugados · 1 sin verificar".
- Indicador en el nav para los admins cuando hay algo que responder.

## Etapas

1. **Desafiar:** código de desafío, crear / aceptar / rechazar / cancelar,
   partidos vinculados, avisos.
2. **Suspender y reprogramar,** con la reconfirmación de convocados.
3. **Resultado:** propuestas, contrapropuestas, auto-aceptación,
   sin verificar, cron.
4. **Historial entre grupos** en estadísticas.

Cada etapa se prueba en el proyecto de test antes de correr la migración en
prod.

## Pendiente de definir

- Si un grupo puede apagar los desafíos ("no recibir desafíos" en /admin).
  Solo afecta al propio grupo, así que no tiene el problema de los días de
  auto-aceptación.
- Límite de desafíos pendientes de un grupo a otro, para que no se pueda
  spamear.
- Si un jugador que está en los dos grupos puede quedar convocado en los dos
  lados del mismo partido (hoy nada lo impide).

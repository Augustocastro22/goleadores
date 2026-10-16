export type Rol = "admin" | "jugador";
export type TipoVoto = "MVP" | "PEOR";

export interface Profile {
  id: string;
  nombre: string;
  apellido: string;
  apodo: string;
  foto_url: string | null;
  created_at: string;
}

export interface Grupo {
  id: string;
  nombre: string;
  codigo_invitacion: string;
  requiere_aprobacion: boolean;
  logo_url: string | null;
  created_by: string | null;
  created_at: string;
}

/** Un perfil visto como miembro de un grupo puntual, con su rol en ese grupo. */
export type Miembro = Profile & { rol: Rol };

export interface Partido {
  id: string;
  grupo_id: string;
  fecha: string;
  hora: string | null;
  lugar: string;
  rival: string;
  goles_rival: number;
  goles_otros: number;
  created_by: string | null;
  created_at: string;
  votacion_abierta_notificada: boolean;
  votacion_cerrada_notificada: boolean;
  jugado: boolean;
  /** Tiene alguna votación (si es false no se vota nada, sin importar con_mvp/con_peor). */
  con_votacion: boolean;
  con_mvp: boolean;
  con_peor: boolean;
  /** Hasta cuándo se vota: lo fija la base al cargar el resultado (ver 0029_votacion_24h.sql). */
  votacion_cierra_en: string | null;
  /** La cancha del grupo donde se juega (la asigna la base según `lugar`, ver 0026_canchas.sql). */
  cancha_id: string | null;
  /** Si es el partido de este grupo en un desafío contra otro grupo (ver 0022_desafios.sql). */
  desafio_id: string | null;
  /** Cuando juegan entre ellos, el nombre del primer equipo ese día (el segundo es `rival`, ver 0032_modo_juego.sql). */
  nombre_equipo: string | null;
}

export type Equipo = 1 | 2;

/** Si el convocado confirmó que juega (ver 0020_confirmacion.sql). */
export type Respuesta = "pendiente" | "juega" | "no_juega";

export interface PartidoJugador {
  id: string;
  partido_id: string;
  jugador_id: string;
  goles: number;
  equipo: Equipo;
  respuesta: Respuesta;
}

export interface Encuesta {
  id: string;
  grupo_id: string;
  pregunta: string;
  creado_por: string;
  cierra_en: string;
  created_at: string;
}

export interface EncuestaOpcion {
  id: string;
  encuesta_id: string;
  texto: string;
  orden: number;
}

export interface ResultadoEncuesta {
  opcion_id: string;
  votos: number;
}

export type DisponibilidadTipo = "puntual" | "rango" | "recurrente";

export interface Bloqueo {
  id: string;
  jugador_id: string;
  /** null = vale para todos los grupos del jugador. */
  grupo_id: string | null;
  tipo: DisponibilidadTipo;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  dia_semana: number | null;
  hora_desde: string | null;
  hora_hasta: string | null;
  nota: string | null;
  /** Fechas en las que no aplica (ej: un domingo liberado de "todos los domingos"). */
  excepciones: string[];
  created_at: string;
}

export interface Desempate {
  id: string;
  partido_id: string;
  tipo: TipoVoto;
  candidatos: string[];
  elegibles: string[];
  resuelto: boolean;
  ganador_id: string | null;
  created_at: string;
}

/** Lo que ve cualquier miembro de un desempate (get_desempates_partido, 0028_desempate_visible). */
export interface DesempatePartido {
  id: string;
  tipo: TipoVoto;
  candidatos: string[];
  candidatos_apodos: string[];
  resuelto: boolean;
  ganador_id: string | null;
  /** Soy de los que lo definen y todavía no voté. */
  puedo_definir: boolean;
}

export interface DesempateVoto {
  id: string;
  desempate_id: string;
  jugador_votado_id: string;
  jugador_que_vota_id: string;
  created_at: string;
}

export interface Voto {
  id: string;
  partido_id: string;
  jugador_votado_id: string;
  jugador_que_vota_id: string;
  tipo: TipoVoto;
  created_at: string;
}

export interface EstadoVotacion {
  total_participantes: number;
  votos_mvp: number;
  votos_peor: number;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface RankingRow {
  jugador_id: string;
  nombre: string;
  apellido: string;
  apodo: string;
  foto_url: string | null;
  goles?: number;
  votos?: number;
  veces_elegido?: number;
  partidos_jugados?: number;
  /** false si se fue del grupo (sigue en las tablas con lo que hizo). */
  sigue_en_grupo?: boolean;
}

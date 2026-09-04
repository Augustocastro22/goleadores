export type Rol = "admin" | "jugador";
export type TipoVoto = "MVP" | "PEOR";

export interface Profile {
  id: string;
  nombre: string;
  apellido: string;
  apodo: string;
  foto_url: string | null;
  rol: Rol;
  created_at: string;
}

export interface Partido {
  id: string;
  fecha: string;
  lugar: string;
  rival: string;
  goles_rival: number;
  goles_otros: number;
  created_by: string | null;
  created_at: string;
}

export type Equipo = 1 | 2;

export interface PartidoJugador {
  id: string;
  partido_id: string;
  jugador_id: string;
  goles: number;
  equipo: Equipo;
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

export interface RankingRow {
  jugador_id: string;
  nombre: string;
  apellido: string;
  apodo: string;
  foto_url: string | null;
  goles?: number;
  votos?: number;
}

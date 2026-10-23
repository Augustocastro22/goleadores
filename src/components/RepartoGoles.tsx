/** Cuántos de los goles del resultado ya se repartieron entre los jugadores de un equipo. */
export default function RepartoGoles({ repartidos, total }: { repartidos: number; total: number }) {
  const falta = total - repartidos;
  if (falta === 0) {
    return (
      <p className="mt-2 text-sm text-primary-400">
        ✓ Repartiste {total === 1 ? "el gol" : `los ${total} goles`}.
      </p>
    );
  }
  if (falta > 0) {
    return (
      <p className="mt-2 text-sm text-gold-400">
        Repartiste {repartidos} de {total} goles. {falta === 1 ? "Falta 1, que va" : `Faltan ${falta}, que van`} a Otros: si
        {falta === 1 ? " lo hizo" : " los hizo"} alguien de esta lista, cargá{falta === 1 ? "selo" : "selos"}.
      </p>
    );
  }
  return (
    <p className="mt-2 text-sm text-danger-400">
      Cargaste {repartidos} goles pero el resultado es {total}. Corregí el resultado o sacale{" "}
      {-falta === 1 ? "1 gol" : `${-falta} goles`} a alguien.
    </p>
  );
}

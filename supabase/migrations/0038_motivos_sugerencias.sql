-- El formulario de contacto también recibe sugerencias y reportes de fallas
-- (ver 0018_borrado_cuenta.sql, que solo aceptaba tres motivos). Los
-- mensajes que ya hay no cambian.

-- Se busca el check del motivo por lo que valida y no por su nombre.
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.mensajes_contacto'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%motivo%'
  loop
    execute format('alter table public.mensajes_contacto drop constraint %I', c);
  end loop;
end $$;

alter table public.mensajes_contacto
  add constraint mensajes_contacto_motivo_check
  check (motivo in ('idea', 'falla', 'borrar_cuenta', 'mis_datos', 'otro'));

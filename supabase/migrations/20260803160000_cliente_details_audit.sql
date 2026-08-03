alter table public."Clientes"
  add column if not exists cpf text,
  add column if not exists birth_date date,
  add column if not exists source text,
  add column if not exists notes text;

alter table public.negotiations
  alter column lead_id drop not null,
  add column if not exists cliente_id bigint references public."Clientes"(id) on delete cascade,
  add column if not exists course_interest text,
  add column if not exists consultant_id uuid references public.users(id) on delete set null;

alter table public.negotiations
  drop constraint if exists negotiations_owner_check;

alter table public.negotiations
  add constraint negotiations_owner_check check (
    num_nonnulls(lead_id, cliente_id) = 1
  );

create unique index if not exists negotiations_cliente_id_unique
  on public.negotiations(cliente_id)
  where cliente_id is not null;

alter table public.logs
  add column if not exists cliente_id bigint references public."Clientes"(id) on delete cascade;

alter table public.logs
  drop constraint if exists logs_owner_check;

alter table public.logs
  add constraint logs_owner_check check (
    num_nonnulls(lead_id, cliente_id) = 1
  );

create index if not exists logs_cliente_id_created_at_idx
  on public.logs(cliente_id, created_at desc)
  where cliente_id is not null;

create or replace function public.apply_tag_linked_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_stage text;
  previous_stage text;
begin
  select linked_stage
    into target_stage
    from public.tags
   where id = new.tag_id;

  if target_stage is not null then
    select estagio_lead
      into previous_stage
      from public."Clientes"
     where id = new.cliente_id;

    if previous_stage is distinct from target_stage then
      update public."Clientes"
         set estagio_lead = target_stage
       where id = new.cliente_id;

      insert into public.logs (cliente_id, action, field, old_value, new_value)
      values (
        new.cliente_id,
        'stage_changed',
        'estagio_lead',
        to_jsonb(previous_stage),
        to_jsonb(target_stage)
      );
    end if;
  end if;

  return new;
end;
$$;

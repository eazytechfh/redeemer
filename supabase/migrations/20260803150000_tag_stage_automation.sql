alter table public.tags
  add column if not exists linked_stage text;

alter table public.tags
  drop constraint if exists tags_linked_stage_check;

alter table public.tags
  add constraint tags_linked_stage_check check (
    linked_stage is null or linked_stage in (
      'agendado',
      'orcamento_enviado',
      'follow_up',
      'matricula_feita',
      'pagou',
      'contrato_assinado',
      'analise'
    )
  );

create unique index if not exists tags_linked_stage_unique
  on public.tags (linked_stage)
  where linked_stage is not null;

insert into public.tags (name, color, linked_stage)
values
  ('Agendado', '#4d9bbf', 'agendado'),
  ('Orçamento Enviado', '#e5683f', 'orcamento_enviado'),
  ('Follow-up', '#d94c78', 'follow_up'),
  ('Matrícula Feita', '#2ba675', 'matricula_feita'),
  ('Pagou', '#168f63', 'pagou'),
  ('Contrato Assinado', '#26795c', 'contrato_assinado'),
  ('Análise', '#6574cd', 'analise')
on conflict (name) do update set
  linked_stage = excluded.linked_stage;

create or replace function public.apply_tag_linked_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_stage text;
begin
  select linked_stage
    into target_stage
    from public.tags
   where id = new.tag_id;

  if target_stage is not null then
    update public."Clientes"
       set estagio_lead = target_stage
     where id = new.cliente_id;
  end if;

  return new;
end;
$$;

drop trigger if exists clientes_tags_apply_linked_stage on public.clientes_tags;
create trigger clientes_tags_apply_linked_stage
  after insert on public.clientes_tags
  for each row execute function public.apply_tag_linked_stage();

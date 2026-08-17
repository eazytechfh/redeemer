create extension if not exists pgcrypto;

create table if not exists public.clientes_tags (
  id uuid primary key default gen_random_uuid(),
  cliente_id bigint not null references public."Clientes"(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (cliente_id, tag_id)
);

alter table public.clientes_tags enable row level security;

drop policy if exists "authenticated read clientes tags" on public.clientes_tags;
create policy "authenticated read clientes tags"
  on public.clientes_tags for select to authenticated
  using (public.current_role() is not null);

insert into public.pipeline_stages (stable_key, name, color, position, is_final)
values
  ('novos_leads', 'Novos Leads', '#4273e8', 1, false),
  ('em_qualificacao', 'Em Qualificação', '#e0a12a', 2, false),
  ('transferido', 'Transferido para o Humano', '#8d51d8', 3, false),
  ('agendado', 'Agendado para a Reunião', '#4d9bbf', 4, false),
  ('orcamento_enviado', 'Orçamento Enviado', '#e5683f', 5, false),
  ('follow_up', 'Follow Up', '#d94c78', 6, false),
  ('matricula_feita', 'Matrícula Feita', '#2ba675', 7, true),
  ('pagou', 'Pagou', '#168f63', 8, true),
  ('contrato_assinado', 'Contrato Assinado', '#26795c', 9, true),
  ('analise', 'Análise', '#6574cd', 10, false)
on conflict (stable_key) do update set
  name = excluded.name,
  position = excluded.position;


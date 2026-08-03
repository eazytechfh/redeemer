create extension if not exists pgcrypto;
create type public.user_role as enum ('consultor','gestor','admin','admin_master');
create type public.user_status as enum ('ativo','inativo');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  name text not null, email text unique not null, phone text,
  role user_role not null default 'consultor',
  status user_status not null default 'ativo',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.courses (
  id uuid primary key default gen_random_uuid(), name text not null, type text not null,
  knowledge_area text, workload integer, monthly_fee numeric(12,2), total_value numeric(12,2),
  status text not null default 'ativo' check(status in ('ativo','inativo')),
  coordinator text, created_at timestamptz not null default now()
);
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(), stable_key text unique not null,
  name text not null, color text not null default '#64748b', position integer not null,
  is_final boolean not null default false, created_at timestamptz not null default now()
);
create table public.students_leads (
  id uuid primary key default gen_random_uuid(), name text not null, email text, phone text not null,
  cpf text, birth_date date, source text, course_id uuid references public.courses(id),
  consultant_id uuid references public.users(id), stage_id uuid references public.pipeline_stages(id),
  interest_score integer check(interest_score between 0 and 100), value numeric(12,2),
  notes text, ai_active boolean not null default true, inside_business_hours boolean,
  first_response_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  color text not null default '#64748b',
  linked_stage text check (linked_stage is null or linked_stage in ('agendado','orcamento_enviado','follow_up','matricula_feita','pagou','contrato_assinado','analise'))
);
create unique index tags_linked_stage_unique on public.tags(linked_stage) where linked_stage is not null;
create table public.lead_tags (lead_id uuid references public.students_leads(id) on delete cascade, tag_id uuid references public.tags(id) on delete cascade, primary key(lead_id,tag_id));
create table public.negotiations (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.students_leads(id) on delete cascade,
  amount numeric(12,2), status text not null default 'ativa', created_at timestamptz not null default now()
);
create table public.logs (
  id bigint generated always as identity primary key, lead_id uuid references public.students_leads(id) on delete cascade,
  user_id uuid references public.users(id), action text not null, field text, old_value jsonb, new_value jsonb,
  created_at timestamptz not null default now()
);
create table public.settings (key text primary key, value jsonb not null default '{}', updated_by uuid references public.users(id), updated_at timestamptz not null default now());

create or replace function public.current_app_user()
returns public.users language sql stable security definer set search_path=public
as $$ select * from public.users where auth_user_id=auth.uid() and status='ativo' limit 1 $$;
create or replace function public.current_role()
returns public.user_role language sql stable security definer set search_path=public
as $$ select role from public.current_app_user() $$;

alter table public.users enable row level security;
alter table public.courses enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.students_leads enable row level security;
alter table public.tags enable row level security;
alter table public.lead_tags enable row level security;
alter table public.negotiations enable row level security;
alter table public.logs enable row level security;
alter table public.settings enable row level security;

create policy "read own profile" on public.users for select to authenticated using(auth_user_id=auth.uid() or public.current_role() in ('gestor','admin','admin_master'));
create policy "staff read courses" on public.courses for select to authenticated using(public.current_role() in ('gestor','admin','admin_master'));
create policy "staff read stages" on public.pipeline_stages for select to authenticated using(public.current_role() is not null);
create policy "read leads by access" on public.students_leads for select to authenticated using(public.current_role() in ('gestor','admin','admin_master') or consultant_id=(select id from public.current_app_user()));
create policy "staff read tags" on public.tags for select to authenticated using(public.current_role() is not null);
create policy "staff read lead tags" on public.lead_tags for select to authenticated using(public.current_role() is not null);
create policy "read negotiations" on public.negotiations for select to authenticated using(public.current_role() is not null);
create policy "read logs" on public.logs for select to authenticated using(public.current_role() in ('gestor','admin','admin_master'));
create policy "master read settings" on public.settings for select to authenticated using(public.current_role()='admin_master');

insert into public.pipeline_stages(stable_key,name,color,position,is_final) values
('new','Novo Contato','#4273e8',1,false),('qualification','Em Qualificação','#e0a12a',2,false),
('negotiation','Em Negociação','#8d51d8',3,false),('follow_up','Follow-up','#e5683f',4,false),
('replied_follow_up','Respondeu Follow-up','#4d9bbf',5,false),('enrolled','Matriculado','#2ba675',6,true),
('not_enrolled','Não Matriculou','#87909d',7,true),('internal_reminder','Lembrete Interno','#6574cd',8,false),
('rescue','Resgate','#d94c78',9,false) on conflict do nothing;


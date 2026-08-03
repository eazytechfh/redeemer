# EazyLeads CRM

CRM educacional para gestão de candidatos, matrículas e equipe comercial.

## Início rápido com Vercel

1. Copie `.env.example` para `.env.local` e preencha as chaves.
2. Execute `npm install`.
3. Aplique `supabase/schema.sql` no SQL Editor do Supabase.
   Em bancos já existentes, aplique também, em ordem, os arquivos de `supabase/migrations/`.
4. Crie o primeiro usuário no Supabase Auth e depois insira seu perfil `admin_master` na tabela `users`.
5. Execute `npm run dev:vercel` para iniciar frontend e funções com `vercel dev`.

Aplicação e API usam o mesmo domínio. As funções ficam disponíveis em `/api`.

Configure no painel da Vercel:

- `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para o build do frontend;
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` e `UAZAPI_BASE_URL` para as funções.

`SUPABASE_SERVICE_ROLE_KEY` é importada exclusivamente por `api/_lib/core.ts`
e nunca entra no bundle do frontend.

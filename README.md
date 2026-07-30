# EduClick CRM

CRM educacional para gestão de candidatos, matrículas, cursos e equipe comercial.

## Início rápido

1. Copie `.env.example` para `.env.local` e preencha as chaves.
2. Execute `npm install`.
3. Aplique `supabase/schema.sql` no SQL Editor do Supabase.
   Em bancos já existentes, aplique também, em ordem, os arquivos de `supabase/migrations/`.
4. Crie o primeiro usuário no Supabase Auth e depois insira seu perfil `admin_master` na tabela `users`.
5. Execute `npm run dev`.

Frontend: http://localhost:5173 · API: http://localhost:3001

As chaves `SUPABASE_SERVICE_ROLE_KEY` são usadas exclusivamente pelo backend.

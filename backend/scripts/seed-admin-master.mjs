import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const environmentCandidates = [
  resolve(scriptDirectory, "../../.env.local"),
  resolve(scriptDirectory, "../.env.local"),
  resolve(scriptDirectory, "../../.env"),
  resolve(scriptDirectory, "../.env"),
];
const environmentPath = environmentCandidates.find(existsSync);

if (!environmentPath) {
  console.error(
    "ERRO: nenhum arquivo .env.local ou .env foi encontrado. Verifique se o arquivo existe na raiz do projeto ou na pasta backend.",
  );
  process.exit(1);
}

const dotenvResult = dotenv.config({ path: environmentPath });
if (dotenvResult.error) {
  console.error(`ERRO: não foi possível carregar ${environmentPath}.`);
  console.error(dotenvResult.error);
  process.exit(1);
}

const requiredVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

console.log(`Arquivo de ambiente carregado: ${environmentPath}`);
for (const variableName of requiredVariables) {
  const value = process.env[variableName];
  if (!value) {
    console.error(
      `ERRO: variável ${variableName} não encontrada. Verifique se o arquivo .env.local existe e está no caminho correto.`,
    );
    process.exit(1);
  }
  console.log(`${variableName}: ${value.slice(0, 10)}...`);
}

const { createClient } = await import("@supabase/supabase-js");

const ADMIN_EMAIL = "admin@eazyclick.com";
const ADMIN_PASSWORD = "EazyClick@2026";
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function findAuthUserByEmail(email) {
  const normalizedEmail = email.toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;

    const existingUser = data.users.find(
      (user) => user.email?.toLowerCase() === normalizedEmail,
    );
    if (existingUser) return existingUser;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

async function run() {
  console.log(`\nVerificando usuário existente: ${ADMIN_EMAIL}`);

  let existingAuthUser;
  try {
    existingAuthUser = await findAuthUserByEmail(ADMIN_EMAIL);
  } catch (error) {
    console.error("ERRO: não foi possível consultar os usuários do Supabase Auth.");
    console.error(error);
    process.exitCode = 1;
    return;
  }

  if (existingAuthUser) {
    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id, auth_user_id, email, role, status")
      .eq("auth_user_id", existingAuthUser.id)
      .maybeSingle();

    console.log("AVISO: já existe um usuário no Supabase Auth com esse e-mail.");
    console.log(`UUID existente: ${existingAuthUser.id}`);
    if (profileError) {
      console.error("Não foi possível verificar o perfil na tabela public.users:");
      console.error(profileError);
    } else if (existingProfile) {
      console.log(
        `Perfil existente em public.users: role=${existingProfile.role}, status=${existingProfile.status}`,
      );
    } else {
      console.log("AVISO: o usuário existente não possui perfil em public.users.");
    }
    console.log(
      'Para resetar a senha, use "Configurações > Gerenciar usuários > Resetar senha" ou supabaseAdmin.auth.admin.updateUserById(UUID, { password: "nova senha" }).',
    );
    console.log("Nenhum usuário duplicado foi criado.");
    return;
  }

  console.log("Criando usuário no Supabase Auth...");
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    console.error("ERRO COMPLETO DO SUPABASE AUTH:");
    console.error(authError);
    process.exitCode = 1;
    return;
  }

  const authUserId = authData.user.id;
  console.log(`Usuário criado no Auth. UUID: ${authUserId}`);

  // Protege contra um eventual trigger existente apenas no banco remoto.
  const { data: profileCreatedByTrigger, error: lookupError } =
    await supabaseAdmin
      .from("users")
      .select("id, auth_user_id, email, role, status")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

  if (lookupError) {
    console.error("ERRO ao verificar criação automática do perfil:");
    console.error(lookupError);
    await rollbackAuthUser(authUserId);
    process.exitCode = 1;
    return;
  }

  let applicationUser = profileCreatedByTrigger;
  if (profileCreatedByTrigger) {
    console.log(
      "Um trigger criou o perfil automaticamente; atualizando-o sem duplicar o registro...",
    );
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({
        name: "Admin Master",
        email: ADMIN_EMAIL,
        role: "admin_master",
        status: "ativo",
      })
      .eq("auth_user_id", authUserId)
      .select("id, auth_user_id, email, role, status")
      .single();
    if (error) {
      console.error("ERRO COMPLETO AO ATUALIZAR public.users:");
      console.error(error);
      await rollbackAuthUser(authUserId);
      process.exitCode = 1;
      return;
    }
    applicationUser = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("users")
      .insert({
        auth_user_id: authUserId,
        name: "Admin Master",
        email: ADMIN_EMAIL,
        phone: null,
        role: "admin_master",
        status: "ativo",
      })
      .select("id, auth_user_id, email, role, status")
      .single();
    if (error) {
      console.error("ERRO COMPLETO AO INSERIR EM public.users:");
      console.error(error);
      await rollbackAuthUser(authUserId);
      process.exitCode = 1;
      return;
    }
    applicationUser = data;
  }

  console.log("\nSEED CONCLUÍDO COM SUCESSO");
  console.log(`UUID do Auth: ${authUserId}`);
  console.log(
    `Registro confirmado em public.users: ${applicationUser.id} (${applicationUser.role}, ${applicationUser.status})`,
  );
  console.log(`E-mail: ${ADMIN_EMAIL}`);
  console.log(`Senha: ${ADMIN_PASSWORD}`);
}

async function rollbackAuthUser(authUserId) {
  console.log(`Executando rollback do usuário Auth ${authUserId}...`);
  const { error: rollbackError } =
    await supabaseAdmin.auth.admin.deleteUser(authUserId);
  if (rollbackError) {
    console.error("ERRO COMPLETO NO ROLLBACK DO SUPABASE AUTH:");
    console.error(rollbackError);
  } else {
    console.log("Rollback concluído: usuário removido do Supabase Auth.");
  }
}

await run();


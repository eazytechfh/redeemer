import { config } from "dotenv";
import { z } from "zod";

config({ path: ["../.env.local", ".env.local", ".env"] });

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  UAZAPI_BASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3001),
});

export const env = schema.parse(process.env);

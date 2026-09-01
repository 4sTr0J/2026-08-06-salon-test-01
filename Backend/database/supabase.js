import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const readEnv = (name) => {
    const value = process.env[name];
    return typeof value === "string" ? value.trim() : "";
};

const supabaseUrl = readEnv("SUPABASE_URL") || "https://placeholder.supabase.co";
const supabaseAnonKey = readEnv("SUPABASE_ANON_KEY") || "placeholder_key";
const supabaseServiceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

export const supabaseAdmin = supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    })
    : null;

export default supabase;

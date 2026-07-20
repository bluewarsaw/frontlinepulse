import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** CloudLinux/DirectAdmin czasem nie przekazuje env vars z panelu — czytamy .env z cwd. */
function loadDotEnv(): void {
  const path = join(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadDotEnv();

function normalizeDatabaseUrl(raw: string): string {
  return raw.replace(/[&?]channel_binding=[^&]*/gi, "").replace(/\?$/, "");
}

function connectionString(): string {
  return normalizeDatabaseUrl(
    process.env.DATABASE_URL ??
      "postgres://frontline:frontline@localhost:5433/frontline"
  );
}

function isNeon(url: string): boolean {
  return /neon\.tech/i.test(url);
}

type NeonSql = {
  query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
};

type PostgresSql = import("postgres").Sql;

let neonSql: NeonSql | null = null;
let postgresSql: PostgresSql | null = null;

async function getNeon(): Promise<NeonSql> {
  if (!neonSql) {
    const { neon } = await import("@neondatabase/serverless");
    neonSql = neon(connectionString()) as NeonSql;
  }
  return neonSql;
}

async function getPostgres(): Promise<PostgresSql> {
  if (!postgresSql) {
    const postgres = (await import("postgres")).default as (
      url: string,
      options?: import("postgres").Options<Record<string, never>>
    ) => PostgresSql;
    const url = connectionString();
    const needsSsl =
      process.env.PGSSL === "true" ||
      /neon\.tech|supabase\.co|sslmode=require/i.test(url);
    postgresSql = postgres(url, {
      ssl: needsSsl ? "require" : false,
      max: 5,
      connect_timeout: 15,
    });
  }
  return postgresSql;
}

/** SELECT / proste zapytania — na Neon używa HTTP (fetch), działa na hostingu współdzielonym. */
export async function query<T extends Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const url = connectionString();
  if (isNeon(url)) {
    const sql = await getNeon();
    return (await sql.query(text, params ?? [])) as T[];
  }
  const sql = await getPostgres();
  return (await sql.unsafe(text, (params ?? []) as never[])) as T[];
}

export type TxClient = {
  query<T extends Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number }>;
};

/** Transakcje dla ingestu (lokalnie na Macu). */
export async function withTransaction<T>(
  fn: (client: TxClient) => Promise<T>
): Promise<T> {
  const sql = await getPostgres();
  return (await sql.begin(async (tx) => {
    const client: TxClient = {
      async query(text, params = []) {
        const rows = (await tx.unsafe(
          text,
          params as never[]
        )) as Record<string, unknown>[];
        return { rows: rows as never[], rowCount: rows.length };
      },
    };
    return fn(client);
  })) as T;
}

export async function closeDb(): Promise<void> {
  if (postgresSql) {
    await postgresSql.end();
    postgresSql = null;
  }
  neonSql = null;
}

/** @deprecated używaj withTransaction */
export const pool = {
  connect: async () => {
    throw new Error("pool.connect() usunięte — użyj withTransaction()");
  },
  end: closeDb,
};

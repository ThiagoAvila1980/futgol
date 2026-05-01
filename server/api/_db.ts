import { neon as neonDriver } from '@neondatabase/serverless';
import { Pool } from 'pg';
import { createHash } from 'crypto';
import fs from 'node:fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '../db/schema';

let initialized = false;
const DATABASE_URL =
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === 'test'
    ? 'postgres://postgres:postgres@127.0.0.1:5432/vitest_db_placeholder'
    : '');
if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL must be set. Copy .env.example to .env and configure your PostgreSQL connection string.',
  );
}

function isLocal(url: string) {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === 'db';
  } catch {
    return false;
  }
}

const usePg = true; // Always use pg driver to avoid Neon serverless connection issues in standard environments
const pgPool = new Pool({ connectionString: DATABASE_URL });
const neonSql = null;

async function sql(text: string, params?: any[]) {
  if (usePg && pgPool) {
    const r = await pgPool.query(text, params);
    return r.rows;
  }
  if (neonSql) {
    return neonSql(text, params);
  }
  throw new Error('DATABASE_URL is not configured');
}

export const db = drizzle(pgPool, { schema });

async function seedTeamsAndPositions() {
  const teams = [
    'América-MG', 'Athletico-PR', 'Atlético-GO', 'Atlético-MG', 'Avaí', 'Bahia', 'Botafogo', 'Bragantino',
    'Ceará', 'Chapecoense', 'Corinthians', 'Coritiba', 'Criciúma', 'Cruzeiro', 'Cuiabá', 'Flamengo',
    'Fluminense', 'Fortaleza', 'Goiás', 'Grêmio', 'Internacional', 'Juventude', 'Náutico', 'Palmeiras',
    'Paraná', 'Paysandu', 'Ponte Preta', 'Santa Cruz', 'Santos', 'São Caetano', 'São Paulo', 'Sport',
    'Vasco da Gama', 'Vitória', 'Guarani', 'Portuguesa',
  ];
  for (const t of teams) {
    const teamId = createHash('md5').update(t).digest('hex');
    await sql(`INSERT INTO teams(id, name) VALUES($1, $2) ON CONFLICT DO NOTHING`, [teamId, t]);
  }
  const positions = [
    'Goleiro', 'Zagueiro', 'Meia', 'Atacante', 'Fixo', 'Ala Esquerda', 'Ala Direita', 'Pivô', 'Mesário', 'Juíz',
    'Técnico', 'Auxiliar', 'Organizador',
  ];
  for (const p of positions) {
    const posId = createHash('md5').update(p).digest('hex');
    await sql(`INSERT INTO position_functions(id, name) VALUES($1, $2) ON CONFLICT DO NOTHING`, [posId, p]);
  }
}

/** Hash e timestamp da primeira migração (igual a `drizzle-orm` / `readMigrationFiles`). */
function readFirstMigrationMeta(): { hash: string; folderMillis: number } {
  const migrationsFolder = path.join(process.cwd(), 'db', 'drizzle');
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const raw = fs.readFileSync(journalPath, 'utf8');
  const journal = JSON.parse(raw) as { entries: Array<{ tag: string; when: number }> };
  const first = journal.entries[0];
  if (!first) {
    throw new Error('db/drizzle/meta/_journal.json sem entradas');
  }
  const sqlPath = path.join(migrationsFolder, `${first.tag}.sql`);
  const query = fs.readFileSync(sqlPath, 'utf8');
  const hash = createHash('sha256').update(query).digest('hex');
  return { hash, folderMillis: first.when };
}

/**
 * Bases que já receberam o DDL legado (`CREATE IF NOT EXISTS`) têm tabelas como `achievements`,
 * mas `drizzle.__drizzle_migrations` vazia. O Drizzle então tenta `CREATE TABLE achievements` de novo
 * e falha com 42P07. Registramos a migração inicial como já aplicada quando detectamos essa situação.
 */
async function ensureDrizzleBaselineFromLegacyDb(): Promise<void> {
  try {
    await sql(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await sql(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);
  } catch {
    return;
  }

  const legacyTables = await sql(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'achievements'
    LIMIT 1
  `);
  if (!legacyTables.length) return;

  let meta: { hash: string; folderMillis: number };
  try {
    meta = readFirstMigrationMeta();
  } catch {
    return;
  }

  const already = await sql(`SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1 LIMIT 1`, [
    meta.hash,
  ]);
  if (already.length) return;

  await sql(`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`, [
    meta.hash,
    meta.folderMillis,
  ]);
}

async function runDrizzleMigrations() {
  const migrationsFolder = path.join(process.cwd(), 'db', 'drizzle');
  await migrate(db, { migrationsFolder });
}

/** DDL legado (CREATE IF NOT EXISTS) — usado só se a migração Drizzle falhar (bases antigas). */
export async function legacyEnsureSchema() {
  // Ensure extensions for UUID generation
  try {
    await sql(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  } catch (e) {
    console.warn('Could not ensure pgcrypto extension, gen_random_uuid might fail if not built-in:', e);
  }

  // 1. Players (Global Identity, formerly Users)
  await sql(`CREATE TABLE IF NOT EXISTS players(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE, -- Nullable for guests
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    birth_date TEXT,
    avatar TEXT,
    favorite_team TEXT,    
    role TEXT DEFAULT 'user',
    primary_group_id TEXT,
    usuario BOOLEAN DEFAULT FALSE,
    created_at TEXT
  );`);
  await sql(`ALTER TABLE players ADD COLUMN IF NOT EXISTS usuario BOOLEAN DEFAULT FALSE`);

  // 2. Groups
  // Changed to TEXT ID to support UUIDs
  await sql(`CREATE TABLE IF NOT EXISTS groups(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id TEXT NOT NULL,
    admins TEXT,
    name TEXT NOT NULL,
    sport TEXT,
    invite_code TEXT,
    created_at TEXT,
    members TEXT,
    pending_requests TEXT,
    payment_mode TEXT,
    fixed_amount REAL,
    monthly_fee REAL,
    city TEXT
  );`);
  await sql(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS logo TEXT`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_groups_admin_id ON groups(admin_id)`);

  // 2.5 Group Requests (New)
  await sql(`CREATE TABLE IF NOT EXISTS group_requests(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    message TEXT,
    status TEXT DEFAULT 'pending', -- pending, accepted, rejected
    created_at TEXT
  );`);
  await sql(`CREATE UNIQUE INDEX IF NOT EXISTS idx_group_requests_unique ON group_requests(group_id, player_id)`);
  await sql(`ALTER TABLE group_requests ALTER COLUMN id SET DEFAULT gen_random_uuid()`);

  // 3. Group Members
  // This is the Link Table + Contextual Stats
  await sql(`CREATE TABLE IF NOT EXISTS group_players(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    role TEXT,
    nickname TEXT,
    position TEXT,
    rating REAL DEFAULT 5.0,
    matches_played INTEGER DEFAULT 0,
    is_monthly_subscriber INTEGER DEFAULT 0,
    monthly_start_month TEXT,
    is_guest INTEGER DEFAULT 0,
    joined_at TEXT
  );`);
  await sql(`CREATE UNIQUE INDEX IF NOT EXISTS idx_group_players_unique_player ON group_players(group_id, player_id)`);
  await sql(`ALTER TABLE group_players ALTER COLUMN id SET DEFAULT gen_random_uuid()`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_group_players_player_id ON group_players(player_id)`);

  // 3.5 Venues (Locais esportivos do Dono de Campo)
  await sql(`CREATE TABLE IF NOT EXISTS venues(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    coordinates_lat REAL,
    coordinates_lng REAL,
    description TEXT,
    photos TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT
  );`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_venues_owner_id ON venues(owner_id)`);

  // 4. Fields
  await sql(`CREATE TABLE IF NOT EXISTS fields(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    owner_id TEXT REFERENCES players(id) ON DELETE CASCADE,
    venue_id TEXT REFERENCES venues(id) ON DELETE CASCADE,
    type TEXT,
    name TEXT NOT NULL,
    location TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    hourly_rate REAL,
    coordinates_lat REAL,
    coordinates_lng REAL,
    description TEXT,
    photos TEXT,
    city TEXT,
    is_active INTEGER DEFAULT 1
  );`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_fields_group_id ON fields(group_id)`);
  
  // 4. Fields migrations
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS group_id TEXT`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES players(id) ON DELETE CASCADE`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_fields_owner_id ON fields(owner_id)`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS venue_id TEXT REFERENCES venues(id) ON DELETE CASCADE`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_fields_venue_id ON fields(venue_id)`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS type TEXT`);
  
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS name TEXT`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS location TEXT`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS contact_name TEXT`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS contact_phone TEXT`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS hourly_rate REAL`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS coordinates_lat REAL`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS coordinates_lng REAL`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS description TEXT`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS photos TEXT`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS city TEXT`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1`);

  // 4.5 Field Slots (Availability)
  await sql(`CREATE TABLE IF NOT EXISTS field_slots(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    price REAL,
    is_booked INTEGER DEFAULT 0,
    booked_by_group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
    created_at TEXT
  );`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_field_slots_field_id ON field_slots(field_id)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_field_slots_start_time ON field_slots(start_time)`);

  // 5. Matches
  await sql(`CREATE TABLE IF NOT EXISTS matches(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    date TEXT,
    time TEXT,
    field_id TEXT REFERENCES fields(id) ON DELETE SET NULL,
    confirmed_player_ids TEXT, -- Now stores Player IDs (comma sep)
    paid_player_ids TEXT,     -- Now stores Player IDs (comma sep)
    team_a TEXT,
    team_b TEXT,
    score_a INTEGER,
    score_b INTEGER,
    finished INTEGER,
    mvp_id TEXT               -- Now stores Player ID
  );`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date)`);
  await sql(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS arrived_player_ids TEXT`);
  await sql(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS sub_matches TEXT`);
  await sql(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS mvp_votes TEXT`);
  await sql(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_canceled INTEGER DEFAULT 0`);
  await sql(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_points TEXT`);
  await sql(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS primeiro_jogo_status TEXT`);

  // 6. Transactions
  await sql(`CREATE TABLE IF NOT EXISTS transactions(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    description TEXT,
    amount REAL,
    type TEXT,
    date TEXT,
    category TEXT,
    related_match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
    related_player_id TEXT REFERENCES players(id) ON DELETE SET NULL
  );`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_transactions_group_id ON transactions(group_id)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`);
  await sql(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS related_player_id TEXT REFERENCES players(id) ON DELETE SET NULL`);
  await sql(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paid_player_ids TEXT`);

  // 7. Comments
  await sql(`CREATE TABLE IF NOT EXISTS comments(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
    parent_id TEXT,
    author_player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  ); `);
  await sql(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_player_id TEXT REFERENCES players(id) ON DELETE CASCADE`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_comments_group_match ON comments(group_id, match_id)`);

  // 8. Match Votes
  await sql(`CREATE TABLE IF NOT EXISTS match_votes(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
    voter_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    voted_for_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );`);
  await sql(`CREATE UNIQUE INDEX IF NOT EXISTS idx_match_votes_unique_voter ON match_votes(match_id, voter_id)`);

  // Global Lookups
  await sql(`CREATE TABLE IF NOT EXISTS teams(id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE); `);
  await sql(`CREATE TABLE IF NOT EXISTS position_functions(id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE); `);
  await seedTeamsAndPositions();

  // Push Subscriptions
  await sql(`CREATE TABLE IF NOT EXISTS push_subscriptions(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    created_at TEXT
  )`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_push_sub_player ON push_subscriptions(player_id)`);

  // Achievements / Gamification
  await sql(`CREATE TABLE IF NOT EXISTS achievements(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    badge TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    awarded_at TEXT NOT NULL
  )`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_achievements_player ON achievements(player_id)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_achievements_group ON achievements(group_id)`);

  // Field Reviews (Marketplace)
  await sql(`CREATE TABLE IF NOT EXISTS field_reviews(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TEXT NOT NULL
  )`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_field_reviews_field ON field_reviews(field_id)`);

  // Field Bookings (Marketplace)
  await sql(`CREATE TABLE IF NOT EXISTS field_bookings(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
    booked_by TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    total_price REAL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    created_at TEXT NOT NULL
  )`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_field_bookings_field ON field_bookings(field_id)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_field_bookings_date ON field_bookings(date)`);
}

export async function ensureSchema() {
  try {
    await sql(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  } catch (e) {
    console.warn('Could not ensure pgcrypto extension:', e);
  }
  try {
    await ensureDrizzleBaselineFromLegacyDb();
    await runDrizzleMigrations();
    await seedTeamsAndPositions();
  } catch (e) {
    console.warn('[db] Drizzle migrate failed, using legacy DDL:', e);
    await legacyEnsureSchema();
  }
}

export async function ready() {
  if (!initialized) {
    await ensureSchema();
    initialized = true;
  }
  return sql;
}

export default sql;

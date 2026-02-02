import { neon as neonDriver } from '@neondatabase/serverless';
import { Pool } from 'pg';
import { createHash } from 'crypto';

let initialized = false;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:19thi19@localhost:5432/db_futgol';

function isLocal(url: string) {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === 'db';
  } catch {
    return false;
  }
}

const usePg = isLocal(DATABASE_URL);
const pgPool = usePg ? new Pool({ connectionString: DATABASE_URL }) : null;
const neonSql = !usePg ? neonDriver(DATABASE_URL) : null;

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

export async function ensureSchema() {
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

  // 4. Fields
  await sql(`CREATE TABLE IF NOT EXISTS fields(
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    hourly_rate REAL,
    coordinates_lat REAL,
    coordinates_lng REAL
  );`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_fields_group_id ON fields(group_id)`);
  // 4. Fields migrations
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS group_id TEXT`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS name TEXT`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS location TEXT`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS contact_name TEXT`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS contact_phone TEXT`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS hourly_rate REAL`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS coordinates_lat REAL`);
  await sql(`ALTER TABLE fields ADD COLUMN IF NOT EXISTS coordinates_lng REAL`);

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
  const teams = [
    'América-MG', 'Athletico-PR', 'Atlético-GO', 'Atlético-MG', 'Avaí', 'Bahia', 'Botafogo', 'Bragantino',
    'Ceará', 'Chapecoense', 'Corinthians', 'Coritiba', 'Criciúma', 'Cruzeiro', 'Cuiabá', 'Flamengo',
    'Fluminense', 'Fortaleza', 'Goiás', 'Grêmio', 'Internacional', 'Juventude', 'Náutico', 'Palmeiras',
    'Paraná', 'Paysandu', 'Ponte Preta', 'Santa Cruz', 'Santos', 'São Caetano', 'São Paulo', 'Sport',
    'Vasco da Gama', 'Vitória', 'Guarani', 'Portuguesa'
  ];
  for (const t of teams) {
    const teamId = createHash('md5').update(t).digest('hex');
    await sql(`INSERT INTO teams(id, name) VALUES($1, $2) ON CONFLICT DO NOTHING`, [teamId, t]);
  }

  await sql(`CREATE TABLE IF NOT EXISTS position_functions(id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE); `);
  const positions = ['Goleiro', 'Zagueiro', 'Meia', 'Atacante', 'Fixo', 'Ala Esquerda', 'Ala Direita', 'Pivô', 'Mesário', 'Juíz', 'Técnico', 'Auxiliar', 'Organizador'];
  for (const p of positions) {
    const posId = createHash('md5').update(p).digest('hex');
    await sql(`INSERT INTO position_functions(id, name) VALUES($1, $2) ON CONFLICT DO NOTHING`, [posId, p]);
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

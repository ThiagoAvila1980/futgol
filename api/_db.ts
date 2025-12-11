import { neon as neonDriver } from '@neondatabase/serverless';
import { Pool } from 'pg';
import { createHash } from 'crypto';

let initialized = false;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:19thi19@localhost:5432/db_futgol';

function isLocal(url: string) {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
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
  await sql(`CREATE TABLE IF NOT EXISTS player_profiles(
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    nickname TEXT,
    birth_date TEXT,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    favorite_team TEXT,
    position TEXT,
    avatar TEXT,
    created_at TEXT
  );`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_player_profiles_email ON player_profiles(email)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_player_profiles_phone ON player_profiles(phone)`);
  await sql(`CREATE TABLE IF NOT EXISTS users(
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TEXT
  );`);
  await sql(`CREATE TABLE IF NOT EXISTS groups(
    id SERIAL PRIMARY KEY,
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

  await sql(`CREATE TABLE IF NOT EXISTS players(
    id SERIAL PRIMARY KEY,
    group_id TEXT NOT NULL,
    user_id TEXT,
    name TEXT NOT NULL,
    nickname TEXT,
    birth_date TEXT,
    email TEXT,
    phone TEXT,
    favorite_team TEXT,
    position TEXT,
    rating REAL,
    matches_played INTEGER,
    avatar TEXT,
    is_monthly_subscriber INTEGER,
    monthly_start_month TEXT,
    is_guest INTEGER
  );`);
  await sql(`ALTER TABLE players ADD COLUMN IF NOT EXISTS profile_id INTEGER`);
  await sql(`CREATE TABLE IF NOT EXISTS group_players(
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    role TEXT,
    joined_at TEXT
  );`);
  await sql(`CREATE UNIQUE INDEX IF NOT EXISTS idx_group_players_unique ON group_players(group_id, player_id)`);
  await sql(`CREATE INDEX IF NOT EXISTS idx_group_players_player ON group_players(player_id)`);

  await sql(`CREATE TABLE IF NOT EXISTS fields(
    id SERIAL PRIMARY KEY,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    hourly_rate REAL,
    coordinates_lat REAL,
    coordinates_lng REAL
  );`);

  await sql(`CREATE TABLE IF NOT EXISTS matches(
    id SERIAL PRIMARY KEY,
    group_id TEXT NOT NULL,
    date TEXT,
    time TEXT,
    field_id TEXT,
    confirmed_player_ids TEXT,
    paid_player_ids TEXT,
    team_a TEXT,
    team_b TEXT,
    score_a INTEGER,
    score_b INTEGER,
    finished INTEGER,
    mvp_id TEXT
  );`);

  await sql(`CREATE TABLE IF NOT EXISTS transactions(
    id SERIAL PRIMARY KEY,
    group_id TEXT NOT NULL,
    description TEXT,
    amount REAL,
    type TEXT,
    date TEXT,
    category TEXT,
    related_player_id TEXT,
    related_match_id TEXT
  );`);

  await sql(`CREATE TABLE IF NOT EXISTS comments(
    id SERIAL PRIMARY KEY,
    group_id TEXT NOT NULL,
    match_id TEXT NOT NULL,
    parent_id TEXT,
    author_player_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`);
  const adminEmail = 'thiago@teste.com';
  const adminPass = '123456';
  const hash = createHash('sha256').update(adminPass).digest('hex');
  const exists = await sql(`SELECT id FROM users WHERE email = $1`, [adminEmail]) as any[];
  if (!exists.length) {
    const name = 'Thiago Admin';
    const role = 'admin';
    const created = new Date().toISOString();
    await sql(`INSERT INTO users(email, password_hash, name, role, created_at) VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [adminEmail, hash, name, role, created]);
  }
}

export async function ready() {
  await ensureSchema();
  initialized = true;
  return sql;
}

export default sql;

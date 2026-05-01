/**
 * Preenche retroativamente `matches.primeiro_jogo_status` com o mapa
 * playerId -> V | E | D (primeiro sub-jogo em que o jogador entrou na sessão).
 *
 * Uso (a partir da pasta server/, com DATABASE_URL no .env da raiz do repo ou em server/.env):
 *   npm run backfill:primeiro-jogo-status
 *   npx tsx server/backfill_primeiro_jogo_status.ts --force
 *
 * --force  Recalcula também linhas que já têm JSON gravado (útil após correção de regras).
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../.env') });
config({ path: path.resolve(__dirname, '../.env') });

function safeJson<T>(raw: unknown, fallback: T): T {
  try {
    if (raw == null) return fallback;
    if (typeof raw === 'string') return (JSON.parse(raw) as T) ?? fallback;
    return (raw as T) ?? fallback;
  } catch {
    return fallback;
  }
}

async function main() {
  const [{ ready }, { computePrimeiroJogoPorJogador }] = await Promise.all([
    import('../api/_db'),
    import('../api/matches/primeiro-jogo'),
  ]);

  const force = process.argv.includes('--force');
  const sql = await ready();

  const filterMissing = `
    finished = 1
    AND (is_canceled IS NULL OR is_canceled = 0)
    AND (
      primeiro_jogo_status IS NULL
      OR TRIM(primeiro_jogo_status) = ''
      OR primeiro_jogo_status = '{}'
    )
  `;
  const filterAllFinished = `
    finished = 1
    AND (is_canceled IS NULL OR is_canceled = 0)
  `;

  const whereClause = force ? filterAllFinished : filterMissing;

  const rows = (await sql(
    `SELECT id, sub_matches, team_a, team_b, score_a, score_b
     FROM matches
     WHERE ${whereClause}
     ORDER BY date ASC NULLS LAST, COALESCE(time, '00:00') ASC`
  )) as any[];

  console.log(
    `[backfill primeiro_jogo_status] ${rows.length} partida(s) a processar${force ? ' (--force)' : ''}.`
  );

  let updated = 0;
  for (const row of rows) {
    const subMatches = safeJson<any[]>(row.sub_matches, []);
    const teamA = safeJson<any[]>(row.team_a, []);
    const teamB = safeJson<any[]>(row.team_b, []);
    const scoreA = Number(row.score_a ?? 0);
    const scoreB = Number(row.score_b ?? 0);

    const map = computePrimeiroJogoPorJogador({
      subMatches,
      teamA,
      teamB,
      scoreA,
      scoreB,
    });
    const json = JSON.stringify(map);

    await sql(`UPDATE matches SET primeiro_jogo_status = $1 WHERE id = $2`, [json, row.id]);
    updated += 1;
    if (json !== '{}') {
      console.log(`  ok ${row.id} -> ${Object.keys(map).length} jogador(es)`);
    } else {
      console.log(`  ok ${row.id} -> {} (sem times em sub-jogos / legado vazio)`);
    }
  }

  console.log(`[backfill primeiro_jogo_status] Concluído: ${updated} linha(s) atualizada(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

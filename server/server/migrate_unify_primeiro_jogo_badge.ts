/**
 * Remove a conquista antiga `first_match` e alinha textos de `primeiro_jogo`
 * (uma única conquista "Primeiro jogo" + pontos V/E/D no ranking).
 *
 * Uso: npm run migrate:unify-primeiro-jogo (na pasta server/)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../.env') });
config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const { ready } = await import('../api/_db');
  const sql = await ready();

  await sql(`DELETE FROM achievements WHERE badge = 'first_match'`);
  console.log('[migrate] Conquistas com badge first_match removidas da base.');

  await sql(
    `UPDATE achievements
     SET title = $1, description = $2
     WHERE badge = 'primeiro_jogo'`,
    [
      'Primeiro jogo',
      'Registrou o resultado do primeiro jogo em que entrou na sessão (V, E ou D). Os pontos (V=3, E=1, D=0) somam-se ao XP em todas as noites.',
    ]
  );
  console.log('[migrate] Títulos/descrições de primeiro_jogo atualizados.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

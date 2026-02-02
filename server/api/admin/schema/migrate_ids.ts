import { ready } from '../../_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  try {
    console.log('Starting Migration of IDs to TEXT...');

    // 1. Drop constraints that depend on ID type matching
    // Note: Constraint names are guessed or need to be found. 
    // Postgres auto-names them like <table>_<column>_fkey usually.

    const constraints = [
      'group_players_group_id_fkey',
      'fields_group_id_fkey',
      'matches_group_id_fkey',
      'matches_field_id_fkey',
      'transactions_group_id_fkey',
      'transactions_related_match_id_fkey',
      'comments_group_id_fkey',
      'comments_match_id_fkey'
    ];

    for (const c of constraints) {
      try {
        // We need to know the table... 
        // Actually it is safer to Alter the column logic which requires dropping constraints first.
      } catch (e) { }
    }

    // Brute force drop based on table context is easier if we know the table.

    // GROUPS ID -> TEXT
    await sql(`ALTER TABLE group_players DROP CONSTRAINT IF EXISTS group_players_group_id_fkey`);
    await sql(`ALTER TABLE fields DROP CONSTRAINT IF EXISTS fields_group_id_fkey`);
    await sql(`ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_group_id_fkey`);
    await sql(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_group_id_fkey`);
    await sql(`ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_group_id_fkey`);

    await sql(`ALTER TABLE groups ALTER COLUMN id TYPE TEXT`); // Will convert numbers to text string '1' etc.

    await sql(`ALTER TABLE group_players ALTER COLUMN group_id TYPE TEXT`);
    await sql(`ALTER TABLE fields ALTER COLUMN group_id TYPE TEXT`);
    await sql(`ALTER TABLE matches ALTER COLUMN group_id TYPE TEXT`);
    await sql(`ALTER TABLE transactions ALTER COLUMN group_id TYPE TEXT`);
    await sql(`ALTER TABLE comments ALTER COLUMN group_id TYPE TEXT`);

    // FIELDS ID -> TEXT
    await sql(`ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_field_id_fkey`);
    await sql(`ALTER TABLE fields ALTER COLUMN id TYPE TEXT`);
    await sql(`ALTER TABLE matches ALTER COLUMN field_id TYPE TEXT`);

    // MATCHES ID -> TEXT
    await sql(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_related_match_id_fkey`);
    await sql(`ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_match_id_fkey`);

    await sql(`ALTER TABLE matches ALTER COLUMN id TYPE TEXT`);
    await sql(`ALTER TABLE transactions ALTER COLUMN related_match_id TYPE TEXT`);
    await sql(`ALTER TABLE comments ALTER COLUMN match_id TYPE TEXT`);

    // TRANSACTIONS ID -> TEXT
    await sql(`ALTER TABLE transactions ALTER COLUMN id TYPE TEXT`);

    // COMMENTS ID -> TEXT
    await sql(`ALTER TABLE comments ALTER COLUMN id TYPE TEXT`);
    await sql(`ALTER TABLE comments ALTER COLUMN parent_id TYPE TEXT`);


    // Clean up invalid integer sequences if any? 
    // No, the sequence objects (SERIAL) remain but are detached. That's fine.

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, message: 'Migration executed. Constraints dropped, types changed to TEXT.' }));

  } catch (e: any) {
    console.error(e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message, stack: e.stack }));
  }
}

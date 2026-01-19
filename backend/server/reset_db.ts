import { ready } from '../api/_db';

async function reset() {
    console.log('Connecting...');
    const sql = await ready();

    console.log('Dropping all tables...');
    const tables = [
        'comments',
        'transactions',
        'matches',
        'fields',
        'group_players',
        'groups',
        'players',
        // Legacy tables to ensure cleanup
        'users',
        'player_profiles',
        // Lookups
        'teams',
        'position_functions'
    ];

    for (const t of tables) {
        try {
            await sql(`DROP TABLE IF EXISTS ${t} CASCADE`);
            console.log(`Dropped ${t}`);
        } catch (e) {
            console.log(`Error dropping ${t}:`, e);
        }
    }

    console.log('All tables dropped. The schema will be recreated cleanly on the next server start.');
}

reset().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

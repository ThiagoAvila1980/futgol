import { ensureSchema } from '../api/_db';
ensureSchema().then(() => console.log('Schema Updated')).catch(console.error);

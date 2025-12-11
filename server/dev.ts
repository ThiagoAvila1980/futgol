import express from 'express';
import health from '../api/health';
import authLogin from '../api/auth/login';
import authMe from '../api/auth/me';
import schemaAlign from '../api/admin/schema/align';
import schemaMigrateIds from '../api/admin/schema/migrate_ids';
import commentsIndex from '../api/comments';
import commentsId from '../api/comments/[id]';
import groupsIndex from '../api/groups';
import groupsId from '../api/groups/[id]';
import playersIndex from '../api/players';
import playersId from '../api/players/[id]';
import fieldsIndex from '../api/fields';
import fieldsId from '../api/fields/[id]';
import matchesIndex from '../api/matches';
import matchesId from '../api/matches/[id]';
import matchesReopen from '../api/matches/[id]/reopen';
import groupsMembers from '../api/groups/[id]/members';
import transactionsIndex from '../api/transactions';
import transactionsId from '../api/transactions/[id]';
import transactionsUpsertMatch from '../api/transactions/upsert_match';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', health);
app.post('/api/admin/schema/align', schemaAlign);
app.post('/api/admin/schema/migrate_ids', schemaMigrateIds);

app.post('/api/auth/login', authLogin);
app.post('/api/auth/login/', authLogin);
app.get('/api/auth/me', authMe);
app.get('/api/auth/me/', authMe);

app.get('/api/comments', commentsIndex);
app.put('/api/comments/:id', commentsId);
app.put('/api/comments/:id/', commentsId);
app.delete('/api/comments/:id', commentsId);
app.delete('/api/comments/:id/', commentsId);

app.get('/api/groups', groupsIndex);
app.put('/api/groups/:id', groupsId);
app.put('/api/groups/:id/', groupsId);
app.put('/api/groups', groupsId);
app.put('/api/groups/', groupsId);
app.put('/api/groups/:id/', groupsId);
app.get('/api/groups/:id/members', groupsMembers);
app.post('/api/groups/:id/members', groupsMembers);
app.post('/api/groups/:id/members/', groupsMembers);
app.put('/api/groups/:id/members', groupsMembers);
app.put('/api/groups/:id/members/', groupsMembers);
app.delete('/api/groups/:id/members/:playerId', groupsMembers);
app.delete('/api/groups/:id/members/:playerId/', groupsMembers);
app.delete('/api/groups/:id/members', groupsMembers);
app.delete('/api/groups/:id/members/', groupsMembers);
app.post('/api/groups/:id/members/batch', groupsMembers);
app.post('/api/groups/:id/members/batch/', groupsMembers);
app.put('/api/groups/:id/members/batch', groupsMembers);
app.put('/api/groups/:id/members/batch/', groupsMembers);

app.get('/api/players', playersIndex);
app.put('/api/players/:id', playersId);
app.put('/api/players/:id/', playersId);
app.put('/api/players', playersId);
app.put('/api/players/', playersId);

app.get('/api/fields', fieldsIndex);
app.put('/api/fields/:id', fieldsId);
app.put('/api/fields/:id/', fieldsId);
app.put('/api/fields', fieldsId);
app.put('/api/fields/', fieldsId);
app.delete('/api/fields/:id', fieldsId);
app.delete('/api/fields/:id/', fieldsId);

app.get('/api/matches', matchesIndex);
app.put('/api/matches/:id', matchesId);
app.put('/api/matches/:id/', matchesId);
app.put('/api/matches', matchesId);
app.put('/api/matches/', matchesId);
app.delete('/api/matches/:id', matchesId);
app.delete('/api/matches/:id/', matchesId);
app.post('/api/matches/:id/reopen', matchesReopen);
app.post('/api/matches/:id/reopen/', matchesReopen);

app.get('/api/transactions', transactionsIndex);
app.put('/api/transactions/:id', transactionsId);
app.put('/api/transactions/:id/', transactionsId);
app.delete('/api/transactions/:id', transactionsId);
app.delete('/api/transactions/:id/', transactionsId);
app.post('/api/transactions/upsert_match', transactionsUpsertMatch);
app.post('/api/transactions/upsert_match/', transactionsUpsertMatch);

app.listen(3001, '0.0.0.0');

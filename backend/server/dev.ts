import express from 'express';
import path from 'path';
import health from '../api/health';
import authLogin from '../api/auth/login';
import authMe from '../api/auth/me';
import authProfile from '../api/auth/profile';
import schemaAlign from '../api/admin/schema/align';
import schemaMigrateIds from '../api/admin/schema/migrate_ids';

import commentsIndex from '../api/comments';
import commentsId from '../api/comments/[id]';
import groupsIndex from '../api/groups';
import groupsByUser from '../api/groups/by_user';
import groupsId from '../api/groups/[id]';
import teamsIndex from '../api/teams';
import playersIndex from '../api/players';
import playersId from '../api/players/[id]';
import playersUpdateByUser from '../api/players/update_by_user';
import fieldsIndex from '../api/fields';
import fieldsId from '../api/fields/[id]';
import matchesIndex from '../api/matches';
import matchesId from '../api/matches/[id]';
import matchesReopen from '../api/matches/[id]/reopen';
import groupsMembers from '../api/groups/[id]/members';
import transactionsIndex from '../api/transactions';
import transactionsId from '../api/transactions/[id]';
import transactionsUpsertMatch from '../api/transactions/upsert_match';
import transactionsUpsertMonthly from '../api/transactions/upsert_monthly';
import groupsRequestJoin from '../api/groups/[id]/request_join';
import groupsPromoteMember from '../api/groups/[id]/promote_member';
import groupsDemoteMember from '../api/groups/[id]/demote_member';
import groupsCancelRequest from '../api/groups/[id]/cancel_request';
import groupsRejectRequest from '../api/groups/[id]/reject_request';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get('/api/health', health);
app.post('/api/admin/schema/align', schemaAlign);
app.post('/api/admin/schema/migrate_ids', schemaMigrateIds);
app.get('/api/admin/schema/migrate_ids', schemaMigrateIds);

app.post('/api/auth/login', authLogin);
app.post('/api/auth/login/', authLogin);

import authRegister from '../api/auth/register';
app.post('/api/auth/register', authRegister);
app.post('/api/auth/register/', authRegister);
app.get('/api/auth/me', authMe);
app.get('/api/auth/me/', authMe);
app.put('/api/auth/profile', authProfile);
app.put('/api/auth/profile/', authProfile);
app.put('/api/auth/profile', authProfile);
app.put('/api/auth/profile/', authProfile);

import accountsLookup from '../api/accounts/lookup_by_phone';
import accountsLookupId from '../api/accounts/lookup_by_id';
app.get('/api/accounts/lookup_by_phone', accountsLookup);
app.get('/api/accounts/lookup_by_phone/', accountsLookup);
app.get('/api/accounts/lookup_by_id', accountsLookupId);
app.get('/api/accounts/lookup_by_id/', accountsLookupId);

app.get('/api/comments', commentsIndex);
app.put('/api/comments/:id', commentsId);
app.put('/api/comments/:id/', commentsId);
app.delete('/api/comments/:id', commentsId);
app.delete('/api/comments/:id/', commentsId);

app.get('/api/groups', groupsIndex);
app.get('/api/groups/by_user', groupsByUser);
app.get('/api/groups/by_user/', groupsByUser);
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

import groupsRequests from '../api/groups/[id]/requests';

import groupsApproveRequest from '../api/groups/[id]/approve_request';

app.post('/api/groups/:id/request_join', groupsRequestJoin);
app.post('/api/groups/:id/request_join/', groupsRequestJoin);
app.get('/api/groups/:id/requests', groupsRequests);
app.get('/api/groups/:id/requests/', groupsRequests);
app.post('/api/groups/:id/approve_request', groupsApproveRequest);
app.post('/api/groups/:id/approve_request/', groupsApproveRequest);
app.post('/api/groups/:id/promote_member', groupsPromoteMember);
app.post('/api/groups/:id/promote_member/', groupsPromoteMember);
app.post('/api/groups/:id/demote_member', groupsDemoteMember);
app.post('/api/groups/:id/demote_member/', groupsDemoteMember);
app.post('/api/groups/:id/cancel_request', groupsCancelRequest);
app.post('/api/groups/:id/cancel_request/', groupsCancelRequest);
app.post('/api/groups/:id/reject_request', groupsRejectRequest);
app.post('/api/groups/:id/reject_request/', groupsRejectRequest);

app.get('/api/teams', teamsIndex);
app.get('/api/teams/', teamsIndex);

import positionsIndex from '../api/positions';
app.get('/api/positions', positionsIndex);
app.get('/api/positions/', positionsIndex);

app.get('/api/players', playersIndex);
app.put('/api/players/:id', playersId);
app.put('/api/players/:id/', playersId);
app.put('/api/players', playersId);
app.put('/api/players/', playersId);
app.post('/api/players/update_by_user', playersUpdateByUser);
app.post('/api/players/update_by_user/', playersUpdateByUser);

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
app.post('/api/transactions/upsert_monthly', transactionsUpsertMonthly);
app.post('/api/transactions/upsert_monthly/', transactionsUpsertMonthly);

const frontendDist = path.resolve(process.cwd(), '../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(frontendDist, 'index.html'));
});

import { ensureSchema } from '../api/_db';

ensureSchema().then(() => {
  app.listen(3001, '0.0.0.0', () => {
    console.log('Server running on http://0.0.0.0:3001');
  });
}).catch(err => {
  console.error('Failed to initialize DB:', err);
  process.exit(1);
});

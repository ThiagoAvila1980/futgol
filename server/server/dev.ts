import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { authMiddleware } from '../api/middleware/auth';
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
import matchesCancel from '../api/matches/[id]/cancel';
import matchesVote from '../api/matches/[id]/vote';
import matchesVotes from '../api/matches/[id]/votes';
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
import { ensureSchema } from '../api/_db';
import rankingPoints from '../api/ranking/points';

const app = express();

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.CLIENT_URL || 'https://futgol.app']
    : true,
  credentials: true,
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', apiLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Strip trailing slashes
app.use((req, res, next) => {
  if (req.path !== '/' && req.path.endsWith('/')) {
    req.url = req.url.replace(/\/+$/, '');
  }
  next();
});

// Global auth middleware
app.use('/api', authMiddleware as any);

app.get('/api/health', health);
app.post('/api/admin/schema/align', schemaAlign);
app.post('/api/admin/schema/migrate_ids', schemaMigrateIds);
app.get('/api/admin/schema/migrate_ids', schemaMigrateIds);

app.post('/api/auth/login', authLogin);

import authRegister from '../api/auth/register';
app.post('/api/auth/register', authRegister);
app.get('/api/auth/me', authMe);
app.put('/api/auth/profile', authProfile);

import accountsLookup from '../api/accounts/lookup_by_phone';
import accountsLookupId from '../api/accounts/lookup_by_id';
app.get('/api/accounts/lookup_by_phone', accountsLookup);
app.get('/api/accounts/lookup_by_id', accountsLookupId);

app.get('/api/comments', commentsIndex);
app.put('/api/comments/:id', commentsId);
app.delete('/api/comments/:id', commentsId);

app.get('/api/groups', groupsIndex);
app.get('/api/groups/by_user', groupsByUser);
app.put('/api/groups/:id', groupsId);
app.get('/api/groups/:id/members', groupsMembers);
app.post('/api/groups/:id/members', groupsMembers);
app.put('/api/groups/:id/members', groupsMembers);
app.delete('/api/groups/:id/members/:playerId', groupsMembers);
app.post('/api/groups/:id/members/batch', groupsMembers);
app.put('/api/groups/:id/members/batch', groupsMembers);

import groupsRequests from '../api/groups/[id]/requests';

import groupsApproveRequest from '../api/groups/[id]/approve_request';

app.post('/api/groups/:id/request_join', groupsRequestJoin);
app.post('/api/groups/:id/request_join/', groupsRequestJoin);
app.get('/api/groups/:id/requests', groupsRequests);
app.post('/api/groups/:id/approve_request', groupsApproveRequest);
app.post('/api/groups/:id/promote_member', groupsPromoteMember);
app.post('/api/groups/:id/demote_member', groupsDemoteMember);
app.post('/api/groups/:id/cancel_request', groupsCancelRequest);
app.post('/api/groups/:id/reject_request', groupsRejectRequest);

app.get('/api/teams', teamsIndex);

import positionsIndex from '../api/positions';
app.get('/api/positions', positionsIndex);

app.get('/api/players', playersIndex);
app.put('/api/players/:id', playersId);
app.post('/api/players/update_by_user', playersUpdateByUser);

app.get('/api/fields', fieldsIndex);
app.put('/api/fields/:id', fieldsId);
app.delete('/api/fields/:id', fieldsId);

app.get('/api/matches', matchesIndex);
app.put('/api/matches/:id', matchesId);
app.delete('/api/matches/:id', matchesId);
app.post('/api/matches/:id/reopen', matchesReopen);
app.post('/api/matches/:id/cancel', matchesCancel);
app.post('/api/matches/:id/vote', matchesVote);
app.get('/api/matches/:id/votes', matchesVotes);

// Ranking por Pontos (Presença/Gols/Assistências)
app.get('/api/ranking/points', rankingPoints);

app.get('/api/transactions', transactionsIndex);
app.put('/api/transactions/:id', transactionsId);
app.delete('/api/transactions/:id', transactionsId);
app.post('/api/transactions/upsert_match', transactionsUpsertMatch);
app.post('/api/transactions/upsert_monthly', transactionsUpsertMonthly);

import ownerFieldsIndex from '../api/owner/fields/index';
import ownerFieldsId from '../api/owner/fields/[id]';
import ownerFieldsSlots from '../api/owner/fields/[id]/slots';
import fieldsSearch from '../api/fields/search';

app.get('/api/owner/fields', ownerFieldsIndex);
app.post('/api/owner/fields', ownerFieldsIndex);
app.put('/api/owner/fields/:id', ownerFieldsId);
app.delete('/api/owner/fields/:id', ownerFieldsId);
app.get('/api/owner/fields/:id/slots', ownerFieldsSlots);
app.post('/api/owner/fields/:id/slots', ownerFieldsSlots);
app.delete('/api/owner/fields/:id/slots', ownerFieldsSlots);

import ownerVenuesIndex from '../api/owner/venues/index';
import ownerVenuesId from '../api/owner/venues/[id]';
app.get('/api/owner/venues', ownerVenuesIndex);
app.post('/api/owner/venues', ownerVenuesIndex);
app.put('/api/owner/venues/:id', ownerVenuesId);
app.delete('/api/owner/venues/:id', ownerVenuesId);

app.get('/api/fields/search', fieldsSearch);

// Push Notifications
import pushSubscribe from '../api/push/subscribe';
import pushSend from '../api/push/send';
app.post('/api/push/subscribe', pushSubscribe);
app.post('/api/push/send', pushSend);

// AI Team Balancing
import aiBalance from '../api/ai/balance';
app.post('/api/ai/balance', aiBalance);

// Gamification
import achievementsIndex from '../api/achievements/index';
import achievementsAward from '../api/achievements/award';
import leaderboard from '../api/achievements/leaderboard';
app.get('/api/achievements', achievementsIndex);
app.post('/api/achievements/award', achievementsAward);
app.get('/api/achievements/leaderboard', leaderboard);

// WhatsApp Integration
import whatsappShare from '../api/whatsapp/share';
import whatsappInvite from '../api/whatsapp/invite';
app.post('/api/whatsapp/share', whatsappShare);
app.get('/api/whatsapp/invite/:groupId', whatsappInvite);

// Field Marketplace
import marketplaceSearch from '../api/marketplace/search';
import marketplaceBook from '../api/marketplace/book';
import marketplaceReviews from '../api/marketplace/reviews';
import marketplaceAvailability from '../api/marketplace/availability';
app.get('/api/marketplace/search', marketplaceSearch);
app.get('/api/marketplace/availability', marketplaceAvailability);
app.post('/api/marketplace/book', marketplaceBook);
app.get('/api/marketplace/reviews/:fieldId', marketplaceReviews);
app.post('/api/marketplace/reviews/:fieldId', marketplaceReviews);

const frontendDist = path.resolve(process.cwd(), '../client/dist');
const indexHtml = path.join(frontendDist, 'index.html');
import fs from 'fs';
const hasFrontend = fs.existsSync(indexHtml);

if (hasFrontend) {
  app.use(express.static(frontendDist));
}

// Static uploads directory
const uploadsDir = path.resolve(process.cwd(), 'uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}
app.use('/uploads', express.static(uploadsDir));

// Uploads API
import uploadsIndex from '../api/uploads/index';
app.post('/api/uploads', uploadsIndex);

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  if (hasFrontend) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).send('Not Found (API Server)');
  }
});

// Run migrations on startup
ensureSchema().then(() => {
  const PORT = Number(process.env.PORT || 3001);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize DB:', err);
  process.exit(1);
});

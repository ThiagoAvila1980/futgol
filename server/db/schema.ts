/**
 * Schema Drizzle espelhando o modelo PostgreSQL do Futgol.
 * As migrações versionadas ficam em ./drizzle (geradas pelo drizzle-kit).
 */
import {
  pgTable,
  text,
  real,
  integer,
  boolean,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const players = pgTable('players', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  birthDate: text('birth_date'),
  avatar: text('avatar'),
  favoriteTeam: text('favorite_team'),
  role: text('role').default('user'),
  primaryGroupId: text('primary_group_id'),
  usuario: boolean('usuario').default(false),
  createdAt: text('created_at'),
});

export const groups = pgTable(
  'groups',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    adminId: text('admin_id').notNull(),
    admins: text('admins'),
    name: text('name').notNull(),
    sport: text('sport'),
    inviteCode: text('invite_code'),
    createdAt: text('created_at'),
    members: text('members'),
    pendingRequests: text('pending_requests'),
    paymentMode: text('payment_mode'),
    fixedAmount: real('fixed_amount'),
    monthlyFee: real('monthly_fee'),
    city: text('city'),
    logo: text('logo'),
  },
  (t) => [index('idx_groups_admin_id').on(t.adminId)],
);

export const groupRequests = pgTable(
  'group_requests',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    message: text('message'),
    status: text('status').default('pending'),
    createdAt: text('created_at'),
  },
  (t) => [uniqueIndex('idx_group_requests_unique').on(t.groupId, t.playerId)],
);

export const groupPlayers = pgTable(
  'group_players',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    role: text('role'),
    nickname: text('nickname'),
    position: text('position'),
    rating: real('rating').default(5.0),
    matchesPlayed: integer('matches_played').default(0),
    isMonthlySubscriber: integer('is_monthly_subscriber').default(0),
    monthlyStartMonth: text('monthly_start_month'),
    isGuest: integer('is_guest').default(0),
    joinedAt: text('joined_at'),
  },
  (t) => [
    uniqueIndex('idx_group_players_unique_player').on(t.groupId, t.playerId),
    index('idx_group_players_player_id').on(t.playerId),
  ],
);

export const venues = pgTable(
  'venues',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    ownerId: text('owner_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    address: text('address'),
    city: text('city'),
    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    coordinatesLat: real('coordinates_lat'),
    coordinatesLng: real('coordinates_lng'),
    description: text('description'),
    photos: text('photos'),
    isActive: integer('is_active').default(1),
    createdAt: text('created_at'),
  },
  (t) => [index('idx_venues_owner_id').on(t.ownerId)],
);

export const fields = pgTable(
  'fields',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    groupId: text('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').references(() => players.id, { onDelete: 'cascade' }),
    venueId: text('venue_id').references(() => venues.id, { onDelete: 'cascade' }),
    type: text('type'),
    name: text('name').notNull(),
    location: text('location'),
    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    hourlyRate: real('hourly_rate'),
    coordinatesLat: real('coordinates_lat'),
    coordinatesLng: real('coordinates_lng'),
    description: text('description'),
    photos: text('photos'),
    city: text('city'),
    isActive: integer('is_active').default(1),
  },
  (t) => [
    index('idx_fields_group_id').on(t.groupId),
    index('idx_fields_owner_id').on(t.ownerId),
    index('idx_fields_venue_id').on(t.venueId),
  ],
);

export const fieldSlots = pgTable(
  'field_slots',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    fieldId: text('field_id')
      .notNull()
      .references(() => fields.id, { onDelete: 'cascade' }),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    price: real('price'),
    isBooked: integer('is_booked').default(0),
    bookedByGroupId: text('booked_by_group_id').references(() => groups.id, { onDelete: 'set null' }),
    createdAt: text('created_at'),
  },
  (t) => [
    index('idx_field_slots_field_id').on(t.fieldId),
    index('idx_field_slots_start_time').on(t.startTime),
  ],
);

export const matches = pgTable(
  'matches',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    groupId: text('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    date: text('date'),
    time: text('time'),
    fieldId: text('field_id').references(() => fields.id, { onDelete: 'set null' }),
    confirmedPlayerIds: text('confirmed_player_ids'),
    paidPlayerIds: text('paid_player_ids'),
    teamA: text('team_a'),
    teamB: text('team_b'),
    scoreA: integer('score_a'),
    scoreB: integer('score_b'),
    finished: integer('finished'),
    mvpId: text('mvp_id'),
    arrivedPlayerIds: text('arrived_player_ids'),
    subMatches: text('sub_matches'),
    mvpVotes: text('mvp_votes'),
    isCanceled: integer('is_canceled').default(0),
    playerPoints: text('player_points'),
    /** playerId -> "V" | "E" | "D" no primeiro sub-jogo em que jogou na sessão */
    primeiroJogoStatus: text('primeiro_jogo_status'),
  },
  (t) => [index('idx_matches_date').on(t.date)],
);

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    groupId: text('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    description: text('description'),
    amount: real('amount'),
    type: text('type'),
    date: text('date'),
    category: text('category'),
    relatedMatchId: text('related_match_id').references(() => matches.id, { onDelete: 'cascade' }),
    relatedPlayerId: text('related_player_id').references(() => players.id, { onDelete: 'set null' }),
    paidPlayerIds: text('paid_player_ids'),
  },
  (t) => [
    index('idx_transactions_group_id').on(t.groupId),
    index('idx_transactions_date').on(t.date),
  ],
);

export const comments = pgTable(
  'comments',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    groupId: text('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    matchId: text('match_id').references(() => matches.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    authorPlayerId: text('author_player_id').references(() => players.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_comments_group_match').on(t.groupId, t.matchId)],
);

export const matchVotes = pgTable(
  'match_votes',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    matchId: text('match_id').references(() => matches.id, { onDelete: 'cascade' }),
    voterId: text('voter_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    votedForId: text('voted_for_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('idx_match_votes_unique_voter').on(t.matchId, t.voterId)],
);

export const teams = pgTable('teams', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull().unique(),
});

export const positionFunctions = pgTable('position_functions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull().unique(),
});

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    keysP256dh: text('keys_p256dh').notNull(),
    keysAuth: text('keys_auth').notNull(),
    createdAt: text('created_at'),
  },
  (t) => [index('idx_push_sub_player').on(t.playerId)],
);

export const achievements = pgTable(
  'achievements',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    groupId: text('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    badge: text('badge').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    awardedAt: text('awarded_at').notNull(),
  },
  (t) => [
    index('idx_achievements_player').on(t.playerId),
    index('idx_achievements_group').on(t.groupId),
  ],
);

export const fieldReviews = pgTable(
  'field_reviews',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    fieldId: text('field_id')
      .notNull()
      .references(() => fields.id, { onDelete: 'cascade' }),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_field_reviews_field').on(t.fieldId),
    check('field_reviews_rating_check', sql`rating >= 1 AND rating <= 5`),
  ],
);

export const fieldBookings = pgTable(
  'field_bookings',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    fieldId: text('field_id')
      .notNull()
      .references(() => fields.id, { onDelete: 'cascade' }),
    groupId: text('group_id').references(() => groups.id, { onDelete: 'set null' }),
    bookedBy: text('booked_by')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    totalPrice: real('total_price'),
    status: text('status').default('pending'),
    paymentMethod: text('payment_method'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_field_bookings_field').on(t.fieldId),
    index('idx_field_bookings_date').on(t.date),
  ],
);

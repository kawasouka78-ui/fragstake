import { sqliteTable, text, integer, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const players = sqliteTable('players', {
 id:text('id').primaryKey(), handle:text('handle').notNull().unique(), name:text('name').notNull(), bio:text('bio').notNull().default(''), color:text('color').notNull().default('orange'), balance:integer('balance').notNull().default(10000), createdAt:integer('created_at').notNull(), lastSeen:integer('last_seen').notNull()
},t=>[check('balance_nonnegative',sql`${t.balance} >= 0`)]);
export const matches=sqliteTable('matches',{
 id:text('id').primaryKey(), playerId:text('player_id').notNull().references(()=>players.id), mode:text('mode').notNull(), rate:integer('rate').notNull(), team:text('team').notNull(), status:text('status').notNull().default('active'), kills:integer('kills').notNull().default(0), deaths:integer('deaths').notNull().default(0), score:integer('score').notNull().default(0), enemyScore:integer('enemy_score').notNull().default(0), won:integer('won').notNull().default(0), delta:integer('delta').notNull().default(0), reason:text('reason').notNull().default(''), startedAt:integer('started_at').notNull(), finishedAt:integer('finished_at')
},t=>[index('idx_matches_player_time').on(t.playerId,t.startedAt),index('idx_matches_status_time').on(t.status,t.finishedAt),uniqueIndex('idx_one_active_match').on(t.playerId).where(sql`${t.status} = 'active'`)]);
export const transactions=sqliteTable('transactions',{
 id:text('id').primaryKey(), playerId:text('player_id').notNull().references(()=>players.id), kind:text('kind').notNull(), amount:integer('amount').notNull(), label:text('label').notNull(), matchId:text('match_id').references(()=>matches.id), createdAt:integer('created_at').notNull()
},t=>[index('idx_transactions_player_time').on(t.playerId,t.createdAt)]);
export const friendships=sqliteTable('friendships',{
 id:text('id').primaryKey(), senderId:text('sender_id').notNull().references(()=>players.id), receiverId:text('receiver_id').notNull().references(()=>players.id), status:text('status').notNull().default('pending'), createdAt:integer('created_at').notNull()
},t=>[index('idx_friends_sender').on(t.senderId,t.status),index('idx_friends_receiver').on(t.receiverId,t.status),check('no_self_friend',sql`${t.senderId} != ${t.receiverId}`)]);

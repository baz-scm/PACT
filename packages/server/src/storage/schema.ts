import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const planSeries = sqliteTable('plan_series', {
  id: text('id').primaryKey(),
  series_key: text('series_key').unique().notNull(),
  share_token: text('share_token').unique().notNull(),
  expires_at: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  delisted: integer('delisted', { mode: 'boolean' }).notNull().default(false),
  creator_token: text('creator_token').notNull(),
  approved: integer('approved', { mode: 'boolean' }).notNull().default(false),
  created_at: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const planVersions = sqliteTable('plan_versions', {
  id: text('id').primaryKey(),
  series_id: text('series_id')
    .notNull()
    .references(() => planSeries.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  content_hash: text('content_hash').notNull(),
  author_kind: text('author_kind', { enum: ['agent', 'human'] }).notNull(),
  source_tool: text('source_tool', { enum: ['claude-code', 'cursor'] }).notNull(),
  created_at: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  series_id: text('series_id')
    .notNull()
    .references(() => planSeries.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  ip_hash: text('ip_hash').notNull(),
  created_at: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

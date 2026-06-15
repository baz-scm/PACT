import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const planSeries = sqliteTable('plan_series', {
  id: text('id').primaryKey(),
  series_key: text('series_key').unique().notNull(),
  share_token: text('share_token').unique().notNull(),
  expires_at: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  status: text('status', { enum: ['pending', 'building_consensus', 'approved', 'implemented', 'delisted'] }).notNull().default('pending'),
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
  model_id: text('model_id'),
  input_tokens: integer('input_tokens'),
  output_tokens: integer('output_tokens'),
  created_at: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  series_id: text('series_id')
    .notNull()
    .references(() => planSeries.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  ip_hash: text('ip_hash').notNull(),
  anchor: text('anchor'),
  resolved: integer('resolved', { mode: 'boolean' }).notNull().default(false),
  created_at: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

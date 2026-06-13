import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { eq, and, lt } from 'drizzle-orm';
import { planSeries, planVersions, comments } from './schema';
import type { IStorage, CreatePlanParams, PlanResult, Comment } from './interface';

function uuid() {
  return crypto.randomUUID();
}

function token() {
  return crypto.randomBytes(16).toString('hex');
}

function sha256(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function expiresAt(ttl_hours = 24) {
  return new Date(Date.now() + ttl_hours * 3600 * 1000);
}

type SeriesRow = typeof planSeries.$inferSelect;
type VersionRow = typeof planVersions.$inferSelect;

function toResult(series: SeriesRow, version: VersionRow, deduped: boolean, isNewSeries = false): PlanResult {
  return { series, version, deduped, isNewSeries };
}

export class SqliteStorage implements IStorage {
  readonly client: DatabaseSync;
  private readonly db: ReturnType<typeof drizzle>;

  constructor(dbPath: string) {
    this.client = new DatabaseSync(dbPath);
    this.db = drizzle({ client: this.client });
    // __dirname resolves to src/storage/ (tsx) or dist/storage/ → ../../drizzle is correct either way
    migrate(this.db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  }

  createPlan(params: CreatePlanParams): PlanResult {
    const { series_key, content, author_kind, source_tool, ttl_hours } = params;
    const hash = sha256(content);
    const now = new Date();

    const existing = this.db
      .select()
      .from(planSeries)
      .where(and(eq(planSeries.series_key, series_key), eq(planSeries.delisted, false)))
      .get();

    if (existing) {
      const existingVersion = this.db
        .select()
        .from(planVersions)
        .where(eq(planVersions.series_id, existing.id))
        .get();

      if (existingVersion?.content_hash === hash) {
        return toResult(existing, existingVersion!, true);
      }

      // Free tier: overwrite the single version row
      const newVersionId = uuid();
      this.db
        .update(planVersions)
        .set({ id: newVersionId, content, content_hash: hash, author_kind, source_tool, created_at: now })
        .where(eq(planVersions.series_id, existing.id))
        .run();

      const updated = this.db
        .select()
        .from(planVersions)
        .where(eq(planVersions.id, newVersionId))
        .get()!;
      return toResult(existing, updated, false);
    }

    const seriesId = uuid();
    const versionId = uuid();

    this.db.insert(planSeries).values({
      id: seriesId,
      series_key,
      share_token: token(),
      expires_at: expiresAt(ttl_hours),
      creator_token: token(),
      created_at: now,
    }).run();

    this.db.insert(planVersions).values({
      id: versionId,
      series_id: seriesId,
      content,
      content_hash: hash,
      author_kind,
      source_tool,
      created_at: now,
    }).run();

    const series = this.db.select().from(planSeries).where(eq(planSeries.id, seriesId)).get()!;
    const version = this.db.select().from(planVersions).where(eq(planVersions.id, versionId)).get()!;
    return toResult(series, version, false, true);
  }

  getLatestBySeriesKey(series_key: string): PlanResult | null {
    const series = this.db
      .select()
      .from(planSeries)
      .where(and(eq(planSeries.series_key, series_key), eq(planSeries.delisted, false)))
      .get();
    if (!series) return null;
    return this._withVersion(series);
  }

  getLatestBySeriesId(series_id: string): PlanResult | null {
    const series = this.db
      .select()
      .from(planSeries)
      .where(and(eq(planSeries.id, series_id), eq(planSeries.delisted, false)))
      .get();
    if (!series) return null;
    return this._withVersion(series);
  }

  getByShareToken(share_token: string): PlanResult | null {
    const series = this.db
      .select()
      .from(planSeries)
      .where(and(eq(planSeries.share_token, share_token), eq(planSeries.delisted, false)))
      .get();
    if (!series) return null;
    return this._withVersion(series);
  }

  private _withVersion(series: SeriesRow): PlanResult | null {
    const version = this.db
      .select()
      .from(planVersions)
      .where(eq(planVersions.series_id, series.id))
      .get();
    if (!version) return null;
    return toResult(series, version, false);
  }

  savePlan(series_id: string, content: string, creator_token: string): PlanResult | null {
    const series = this.db
      .select()
      .from(planSeries)
      .where(
        and(
          eq(planSeries.id, series_id),
          eq(planSeries.creator_token, creator_token),
          eq(planSeries.delisted, false),
        ),
      )
      .get();
    if (!series) return null;

    const hash = sha256(content);
    const existing = this.db
      .select()
      .from(planVersions)
      .where(eq(planVersions.series_id, series_id))
      .get();

    if (existing?.content_hash === hash) {
      return toResult(series, existing!, true);
    }

    const newVersionId = uuid();
    this.db
      .update(planVersions)
      .set({ id: newVersionId, content, content_hash: hash, author_kind: 'human', created_at: new Date() })
      .where(eq(planVersions.series_id, series_id))
      .run();

    const updated = this.db
      .select()
      .from(planVersions)
      .where(eq(planVersions.id, newVersionId))
      .get()!;
    return toResult(series, updated, false);
  }

  approvePlan(series_id: string, creator_token: string): boolean {
    const result = this.db
      .update(planSeries)
      .set({ approved: true })
      .where(and(eq(planSeries.id, series_id), eq(planSeries.creator_token, creator_token)))
      .run();
    return (result.changes as number) > 0;
  }

  delistPlan(series_id: string, creator_token: string): boolean {
    const result = this.db
      .update(planSeries)
      .set({ delisted: true })
      .where(and(eq(planSeries.id, series_id), eq(planSeries.creator_token, creator_token)))
      .run();
    return (result.changes as number) > 0;
  }

  expirePlans(): number {
    const result = this.db
      .delete(planSeries)
      .where(lt(planSeries.expires_at, new Date()))
      .run();
    return result.changes as number;
  }

  addComment(series_id: string, body: string, ip_hash: string): Comment {
    const id = uuid();
    const now = new Date();
    this.db.insert(comments).values({ id, series_id, body, ip_hash, created_at: now }).run();
    return { id, series_id, body, ip_hash, created_at: now };
  }

  getComments(series_id: string): Comment[] {
    return this.db
      .select()
      .from(comments)
      .where(eq(comments.series_id, series_id))
      .orderBy(comments.created_at)
      .all();
  }

  /** Test helper — backdates expires_at via Drizzle (same connection). */
  _setExpiresAt(series_id: string, expires_at: Date): void {
    this.db.update(planSeries).set({ expires_at }).where(eq(planSeries.id, series_id)).run();
  }

  deleteComment(comment_id: string, series_id: string, creator_token: string): boolean {
    const series = this.db
      .select({ id: planSeries.id })
      .from(planSeries)
      .where(and(eq(planSeries.id, series_id), eq(planSeries.creator_token, creator_token)))
      .get();
    if (!series) return false;
    const result = this.db
      .delete(comments)
      .where(and(eq(comments.id, comment_id), eq(comments.series_id, series_id)))
      .run();
    return (result.changes as number) > 0;
  }
}

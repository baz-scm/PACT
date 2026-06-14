import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { eq, and, lt, desc } from 'drizzle-orm';
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

function expiresAt(ttl_hours = 0) {
  if (ttl_hours === 0) return new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000);
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

  listAll(): PlanResult[] {
    const rows = this.db
      .select()
      .from(planSeries)
      .where(eq(planSeries.delisted, false))
      .orderBy(desc(planSeries.created_at))
      .all();
    return rows.flatMap((series) => {
      const version = this.db
        .select()
        .from(planVersions)
        .where(eq(planVersions.series_id, series.id))
        .get();
      return version ? [toResult(series, version, false)] : [];
    });
  }

  createPlan(params: CreatePlanParams): PlanResult {
    const { series_key = uuid(), content, author_kind, source_tool, ttl_hours } = params;
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
    const where = creator_token
      ? and(eq(planSeries.id, series_id), eq(planSeries.creator_token, creator_token))
      : eq(planSeries.id, series_id);
    const result = this.db.update(planSeries).set({ approved: true, rejected: false }).where(where).run();
    return (result.changes as number) > 0;
  }

  rejectPlan(series_id: string, creator_token: string): boolean {
    const where = creator_token
      ? and(eq(planSeries.id, series_id), eq(planSeries.creator_token, creator_token))
      : eq(planSeries.id, series_id);
    const result = this.db.update(planSeries).set({ rejected: true, approved: false }).where(where).run();
    return (result.changes as number) > 0;
  }

  delistPlan(series_id: string, creator_token: string): boolean {
    const where = creator_token
      ? and(eq(planSeries.id, series_id), eq(planSeries.creator_token, creator_token))
      : eq(planSeries.id, series_id);
    const result = this.db.update(planSeries).set({ delisted: true }).where(where).run();
    return (result.changes as number) > 0;
  }

  expirePlans(): number {
    const result = this.db
      .delete(planSeries)
      .where(lt(planSeries.expires_at, new Date()))
      .run();
    return result.changes as number;
  }

  addComment(series_id: string, body: string, ip_hash: string, anchor?: string): Comment {
    const id = uuid();
    const commenter_token = token();
    const now = new Date();
    const anchorVal = anchor ?? null;
    this.db.insert(comments).values({ id, series_id, body, ip_hash, anchor: anchorVal, commenter_token, created_at: now }).run();
    return { id, series_id, body, ip_hash, anchor: anchorVal, commenter_token, resolved: false, created_at: now };
  }

  getComments(series_id: string): Comment[] {
    return this.db
      .select()
      .from(comments)
      .where(eq(comments.series_id, series_id))
      .orderBy(comments.created_at)
      .all()
      .map((c) => ({ ...c, anchor: c.anchor ?? null, commenter_token: null, resolved: c.resolved ?? false }));
  }

  updateComment(series_id: string, comment_id: string, body: string, tok: string): Comment | null {
    const comment = this.db
      .select()
      .from(comments)
      .where(and(eq(comments.id, comment_id), eq(comments.series_id, series_id)))
      .get();
    if (!comment) return null;

    const series = this.db.select({ creator_token: planSeries.creator_token }).from(planSeries).where(eq(planSeries.id, series_id)).get();
    const isCreator = series?.creator_token === tok;
    const isAuthor = comment.commenter_token === tok;
    if (!isCreator && !isAuthor) return null;

    this.db.update(comments).set({ body }).where(eq(comments.id, comment_id)).run();
    return { ...comment, body, anchor: comment.anchor ?? null, commenter_token: null, resolved: comment.resolved ?? false };
  }

  resolveComment(comment_id: string, series_id: string, creator_token: string): boolean {
    const series = this.db.select({ creator_token: planSeries.creator_token }).from(planSeries).where(eq(planSeries.id, series_id)).get();
    if (series?.creator_token !== creator_token) return false;
    const result = this.db.update(comments).set({ resolved: true }).where(and(eq(comments.id, comment_id), eq(comments.series_id, series_id))).run();
    return (result.changes as number) > 0;
  }

  /** Test helper — backdates expires_at via Drizzle (same connection). */
  _setExpiresAt(series_id: string, expires_at: Date): void {
    this.db.update(planSeries).set({ expires_at }).where(eq(planSeries.id, series_id)).run();
  }

  deleteComment(comment_id: string, series_id: string, tok: string): boolean {
    const comment = this.db
      .select({ commenter_token: comments.commenter_token })
      .from(comments)
      .where(and(eq(comments.id, comment_id), eq(comments.series_id, series_id)))
      .get();
    if (!comment) return false;

    const series = this.db.select({ creator_token: planSeries.creator_token }).from(planSeries).where(eq(planSeries.id, series_id)).get();
    const isCreator = series?.creator_token === tok;
    const isAuthor = comment.commenter_token === tok;
    if (!isCreator && !isAuthor) return false;

    const result = this.db
      .delete(comments)
      .where(and(eq(comments.id, comment_id), eq(comments.series_id, series_id)))
      .run();
    return (result.changes as number) > 0;
  }
}

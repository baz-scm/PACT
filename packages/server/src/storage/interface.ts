export type AuthorKind = 'agent' | 'human';
export type SourceTool = 'claude-code' | 'cursor';

export interface PlanSeries {
  id: string;
  series_key: string;
  share_token: string;
  expires_at: Date;
  delisted: boolean;
  creator_token: string;
  approved: boolean;
  created_at: Date;
}

export interface PlanVersion {
  id: string;
  series_id: string;
  content: string;
  content_hash: string;
  author_kind: AuthorKind;
  source_tool: SourceTool;
  created_at: Date;
}

export interface Comment {
  id: string;
  series_id: string;
  body: string;
  ip_hash: string;
  created_at: Date;
}

export interface CreatePlanParams {
  series_key: string;
  content: string;
  author_kind: AuthorKind;
  source_tool: SourceTool;
  ttl_hours?: number;
}

export interface PlanResult {
  series: PlanSeries;
  version: PlanVersion;
  /** True when an existing version was returned unchanged (content hash matched). */
  deduped: boolean;
  /** True only when a brand-new series was created (first push). */
  isNewSeries: boolean;
}

export interface IStorage {
  createPlan(params: CreatePlanParams): PlanResult;
  getLatestBySeriesKey(series_key: string): PlanResult | null;
  getLatestBySeriesId(series_id: string): PlanResult | null;
  getByShareToken(share_token: string): PlanResult | null;
  savePlan(series_id: string, content: string, creator_token: string): PlanResult | null;
  approvePlan(series_id: string, creator_token: string): boolean;
  delistPlan(series_id: string, creator_token: string): boolean;
  expirePlans(): number;
  addComment(series_id: string, body: string, ip_hash: string): Comment;
  getComments(series_id: string): Comment[];
  deleteComment(comment_id: string, series_id: string, creator_token: string): boolean;
}

export type AuthorKind = 'agent' | 'human';
export type SourceTool = 'claude-code' | 'cursor';
export type PlanStatus = 'pending' | 'building_consensus' | 'approved' | 'implemented' | 'delisted';

export interface PlanSeries {
  id: string;
  series_key: string;
  share_token: string;
  expires_at: Date;
  status: PlanStatus;
  created_at: Date;
}

export interface PlanVersion {
  id: string;
  series_id: string;
  content: string;
  content_hash: string;
  author_kind: AuthorKind;
  source_tool: SourceTool;
  model_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: Date;
}

export interface Comment {
  id: string;
  series_id: string;
  body: string;
  ip_hash: string;
  anchor: string | null;
  resolved: boolean;
  created_at: Date;
}

export interface CreatePlanParams {
  series_key?: string;
  content: string;
  author_kind: AuthorKind;
  source_tool: SourceTool;
  model_id?: string;
  input_tokens?: number;
  output_tokens?: number;
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
  listAll(): PlanResult[];
  createPlan(params: CreatePlanParams): PlanResult;
  getLatestBySeriesKey(series_key: string): PlanResult | null;
  getLatestBySeriesId(series_id: string): PlanResult | null;
  getByShareToken(share_token: string): PlanResult | null;
  savePlan(series_id: string, content: string): PlanResult | null;
  approvePlan(series_id: string): boolean;
  submitReview(series_id: string): boolean;
  implementPlan(series_id: string): boolean;
  delistPlan(series_id: string): boolean;
  expirePlans(): number;
  addComment(series_id: string, body: string, ip_hash: string, anchor?: string): Comment;
  getComments(series_id: string): Comment[];
  updateComment(series_id: string, comment_id: string, body: string): Comment | null;
  deleteComment(comment_id: string, series_id: string): boolean;
  resolveComment(comment_id: string, series_id: string): boolean;
}

export interface PlanResponse {
  series_id: string;
  version_id: string;
  content: string;
  author_kind: string;
  source_tool: string;
  model_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  expires_at: string;
  approved: boolean;
  rejected: boolean;
  implemented: boolean;
  share_token: string;
  created_at: string;
}

export interface Comment {
  id: string;
  series_id: string;
  body: string;
  ip_hash: string;
  anchor: string | null;
  resolved: boolean;
  created_at: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error((err as { error: string }).error ?? res.statusText), { status: res.status });
  }
  return res.json() as Promise<T>;
}

export const api = {
  listAll: () =>
    request<PlanResponse[]>('/api/plans'),

  getByShareToken: (share_token: string) =>
    request<PlanResponse>(`/api/plans/share/${share_token}`),

  getBySeriesId: (series_id: string) =>
    request<PlanResponse>(`/api/plans/${series_id}`),

  savePlan: (series_id: string, content: string) =>
    request<PlanResponse>(`/api/plans/${series_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }),

  approvePlan: (series_id: string) =>
    request<{ approved: boolean }>(`/api/plans/${series_id}/approve`, {
      method: 'POST',
    }),

  rejectPlan: (series_id: string) =>
    request<{ rejected: boolean }>(`/api/plans/${series_id}/reject`, {
      method: 'POST',
    }),

  implementPlan: (series_id: string) =>
    request<{ implemented: boolean }>(`/api/plans/${series_id}/implement`, {
      method: 'POST',
    }),

  delistPlan: (series_id: string) =>
    request<{ delisted: boolean }>(`/api/plans/${series_id}`, {
      method: 'DELETE',
    }),

  getComments: (series_id: string) =>
    request<Comment[]>(`/api/plans/${series_id}/comments`),

  addComment: (series_id: string, body: string, anchor?: string) =>
    request<Comment>(`/api/plans/${series_id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, anchor }),
    }),

  updateComment: (series_id: string, comment_id: string, body: string) =>
    request<Comment>(`/api/plans/${series_id}/comments/${comment_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }),

  resolveComment: (series_id: string, comment_id: string) =>
    request<{ resolved: boolean }>(`/api/plans/${series_id}/comments/${comment_id}/resolve`, {
      method: 'POST',
    }),

  deleteComment: (series_id: string, comment_id: string) =>
    request<{ deleted: boolean }>(`/api/plans/${series_id}/comments/${comment_id}`, {
      method: 'DELETE',
    }),
};

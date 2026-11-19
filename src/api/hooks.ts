import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { QueryClient, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, setContentVersion } from './client';
import type { AppConfig, CommentsResponse, FileDetail, FileSummary, NodeDetail, NodeFiles, Notice, TreeNode } from './types';

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep everything for a month so the app works offline; freshness is driven by content_version.
      gcTime: 30 * DAY,
      staleTime: Infinity,
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

export const keys = {
  config: ['config'] as const,
  tree: (root: number) => ['tree', root] as const,
  node: (id: number) => ['node', id] as const,
  files: (id: number) => ['files', id] as const,
  file: (id: number) => ['file', id] as const,
  latest: (root: number) => ['latest', root] as const,
  search: (q: string, root: number) => ['search', root, q] as const,
  notices: ['notices'] as const,
  comments: (id: number) => ['comments', id] as const,
};

/**
 * The sync loop: /config on launch, when the app returns to the foreground,
 * and every 5 minutes while open. A new content_version (any page/post saved
 * on the site) invalidates all content queries, so screens refetch.
 */
export function useConfig() {
  const qc = useQueryClient();
  const seen = useRef<number | null>(null);
  const query = useQuery({
    queryKey: keys.config,
    queryFn: () => api<AppConfig>('/config', { timeoutMs: 12000 }),
    staleTime: 0,
    refetchInterval: 5 * 60 * 1000,
  });

  const version = query.data?.content_version;
  useEffect(() => {
    if (!version) return;
    setContentVersion(version);
    if (seen.current !== null && seen.current !== version) {
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'config' });
    }
    seen.current = version;
  }, [version, qc]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') query.refetch();
    });
    return () => sub.remove();
  }, [query]);

  return query;
}

/** Reads config from cache without subscribing to refetches (for leaf components). */
export function useConfigValue(): AppConfig | undefined {
  return useQuery({ queryKey: keys.config, queryFn: () => api<AppConfig>('/config'), staleTime: Infinity }).data;
}

export const useTree = (root: number) =>
  useQuery({ queryKey: keys.tree(root), queryFn: () => api<TreeNode>('/tree', { params: { root } }), enabled: root > 0 });

export const useNode = (id: number) => useQuery({ queryKey: keys.node(id), queryFn: () => api<NodeDetail>(`/nodes/${id}`) });

export const useNodeFiles = (id: number, enabled = true) =>
  useQuery({ queryKey: keys.files(id), queryFn: () => api<NodeFiles>(`/nodes/${id}/files`, { timeoutMs: 30000 }), enabled });

export const useFile = (id: number) => useQuery({ queryKey: keys.file(id), queryFn: () => api<FileDetail>(`/files/${id}`) });

export const useLatest = (root: number, count: number) =>
  useQuery({ queryKey: keys.latest(root), queryFn: () => api<FileSummary[]>('/latest', { params: { root, count } }), enabled: root > 0 });

export const useSearch = (q: string, root: number) =>
  useQuery({
    queryKey: keys.search(q, root),
    queryFn: () => api<FileSummary[]>('/search', { params: { q, root } }),
    enabled: q.trim().length >= 2,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

export const useNotices = () =>
  useQuery({ queryKey: keys.notices, queryFn: () => api<Notice[]>('/notices'), staleTime: 60 * 1000 });

export const useComments = (id: number, enabled = true) =>
  useQuery({ queryKey: keys.comments(id), queryFn: () => api<CommentsResponse>(`/files/${id}/comments`), staleTime: 60 * 1000, enabled });

export function postComment(id: number, body: { author: string; email: string; content: string; parent?: number }) {
  return api<{ ok: boolean; status: 'approved' | 'hold'; comment: import('./types').Comment | null }>(`/files/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ ...body, website: '' }),
  });
}

export function sendReport(body: { file_id: number; page?: number; message: string; app_version: string }) {
  return api<{ ok: boolean }>('/reports', { method: 'POST', body: JSON.stringify({ ...body, website: '' }) });
}

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

let runtimeApiBaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787/api",
);

export type DbTable =
  | "comics"
  | "chapters"
  | "read_progress"
  | "plugins"
  | "changelog";

export interface DbRecord<T = Record<string, unknown>> {
  id: string;
  data: T;
  created_at: string;
  updated_at: string;
}

export interface MigrateLegacyResponse {
  performed: boolean;
  importedRows: number;
  legacyDbPath?: string;
}

export interface ChapterPage {
  index: number;
  fileName: string;
  url: string;
}

export interface ChapterPagesResponse {
  chapterId: string;
  comicId: string;
  comicName: string;
  chapterName: string;
  pageCount: number;
  pages: ChapterPage[];
}

export interface ComicData {
  name?: string;
  synopsis?: string;
  hasOffline?: boolean;
  [key: string]: unknown;
}

export interface ChapterData {
  comicId?: string;
  name?: string;
  number?: string;
  hasOffline?: number | boolean;
  [key: string]: unknown;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`REST request failed (${response.status}): ${text}`);
  }

  return JSON.parse(text) as T;
}

export async function apiHealthCheck(): Promise<string> {
  const payload = await requestJson<{ status: string }>(`${runtimeApiBaseUrl}/health`);
  return payload.status;
}

export async function dbUpsert<T extends Record<string, unknown>>(
  table: DbTable,
  data: T,
  id?: string,
): Promise<DbRecord<T>> {
  return requestJson<DbRecord<T>>(`${runtimeApiBaseUrl}/db/${table}`, {
    method: "POST",
    body: JSON.stringify({ id, data }),
  });
}

export async function dbFind<T extends Record<string, unknown>>(
  table: DbTable,
  jsonPath: string,
  value: unknown,
  limit?: number,
): Promise<Array<DbRecord<T>>> {
  return requestJson<Array<DbRecord<T>>>(`${runtimeApiBaseUrl}/db/${table}/find`, {
    method: "POST",
    body: JSON.stringify({ jsonPath, value, limit }),
  });
}

export async function dbList<T extends Record<string, unknown>>(
  table: DbTable,
  limit = 200,
  offset = 0,
): Promise<Array<DbRecord<T>>> {
  return requestJson<Array<DbRecord<T>>>(
    `${runtimeApiBaseUrl}/db/${table}?limit=${limit}&offset=${offset}`,
  );
}

export async function listComics(): Promise<Array<DbRecord<ComicData>>> {
  return dbList<ComicData>("comics", 500, 0);
}

export async function listChaptersByComicId(
  comicId: string,
): Promise<Array<DbRecord<ChapterData>>> {
  return dbFind<ChapterData>("chapters", "comicId", comicId, 2000);
}

export async function migrateLegacyDatabase(
  legacyDbPath?: string,
): Promise<MigrateLegacyResponse> {
  return requestJson<MigrateLegacyResponse>(`${runtimeApiBaseUrl}/admin/migrate-legacy`, {
    method: "POST",
    body: JSON.stringify({ legacyDbPath }),
  });
}

export async function getChapterPages(chapterId: string): Promise<ChapterPagesResponse> {
  return requestJson<ChapterPagesResponse>(`${runtimeApiBaseUrl}/chapters/${chapterId}/pages`);
}

export function getChapterPageUrl(chapterId: string, pageIndex: number): string {
  return `${runtimeApiBaseUrl}/chapters/${chapterId}/pages/${pageIndex}`;
}

export function setApiBaseUrl(value: string): void {
  runtimeApiBaseUrl = normalizeBaseUrl(value);
}

export function getApiBaseUrl(): string {
  return runtimeApiBaseUrl;
}

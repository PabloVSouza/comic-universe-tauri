import { useMutation, useQuery } from '@tanstack/react-query'
import {
  apiHealthCheck,
  dbFind,
  dbList,
  dbUpsert,
  getChapterPages,
  listChaptersByComicId,
  listComics,
  migrateLegacyDatabase,
  type ChapterData,
  type ComicData,
  type DbRecord,
  type DbTable,
  type MigrateLegacyResponse
} from './restClient'

type JsonRecord = Record<string, unknown>

export const restQueryKeys = {
  health: ['rest', 'health'] as const,
  dbList: (table: DbTable, limit: number, offset: number) =>
    ['rest', 'db', 'list', table, limit, offset] as const,
  dbFind: (table: DbTable, jsonPath: string, value: unknown, limit?: number) =>
    ['rest', 'db', 'find', table, jsonPath, value, limit] as const,
  comics: ['rest', 'comics', 'list'] as const,
  chaptersByComicId: (comicId: string) => ['rest', 'chapters', 'comic', comicId] as const,
  chapterPages: (chapterId: string) => ['rest', 'chapters', chapterId, 'pages'] as const
}

export function useApiHealthQuery() {
  return useQuery({
    queryKey: restQueryKeys.health,
    queryFn: apiHealthCheck,
    staleTime: 30_000
  })
}

export function useDbListQuery<T extends JsonRecord = JsonRecord>(
  table: DbTable,
  limit = 200,
  offset = 0
) {
  return useQuery<Array<DbRecord<T>>>({
    queryKey: restQueryKeys.dbList(table, limit, offset),
    queryFn: () => dbList<T>(table, limit, offset)
  })
}

export function useDbFindQuery<T extends JsonRecord = JsonRecord>(
  table: DbTable,
  jsonPath: string,
  value: unknown,
  limit?: number,
  enabled = true
) {
  return useQuery<Array<DbRecord<T>>>({
    queryKey: restQueryKeys.dbFind(table, jsonPath, value, limit),
    queryFn: () => dbFind<T>(table, jsonPath, value, limit),
    enabled
  })
}

export function useListComicsQuery() {
  return useQuery<Array<DbRecord<ComicData>>>({
    queryKey: restQueryKeys.comics,
    queryFn: listComics
  })
}

export function useListChaptersByComicIdQuery(comicId: string | null | undefined) {
  return useQuery<Array<DbRecord<ChapterData>>>({
    queryKey: restQueryKeys.chaptersByComicId(comicId ?? ''),
    queryFn: () => listChaptersByComicId(comicId as string),
    enabled: Boolean(comicId)
  })
}

export function useChapterPagesQuery(chapterId: string | null | undefined) {
  return useQuery({
    queryKey: restQueryKeys.chapterPages(chapterId ?? ''),
    queryFn: () => getChapterPages(chapterId as string),
    enabled: Boolean(chapterId)
  })
}

export function useDbUpsertMutation<T extends JsonRecord = JsonRecord>() {
  return useMutation({
    mutationFn: (params: { table: DbTable; data: T; id?: string }) =>
      dbUpsert<T>(params.table, params.data, params.id)
  })
}

export function useMigrateLegacyDatabaseMutation() {
  return useMutation<MigrateLegacyResponse, Error, { legacyDbPath?: string } | void>({
    mutationFn: (params) => migrateLegacyDatabase(params?.legacyDbPath)
  })
}


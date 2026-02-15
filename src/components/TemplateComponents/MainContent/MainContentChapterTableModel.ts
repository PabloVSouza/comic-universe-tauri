import type { ChapterData, DbRecord } from 'services'

export interface ChapterRowModel {
  id: string
  chapterNumber: string
  chapterName: string
  progress: number
  isRead: boolean
  numberSortValue: number | null
}

const extractComparableNumber = (raw: unknown): number | null => {
  if (typeof raw !== 'string') return null
  const normalized = raw.trim().replace(',', '.')
  if (!normalized) return null

  const direct = Number(normalized)
  if (Number.isFinite(direct)) return direct

  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

const getChapterNumber = (chapter: DbRecord<ChapterData>): string => {
  const number = chapter.data.number
  if (typeof number === 'string' && number.trim().length) return number.trim()
  return '-'
}

const getChapterName = (chapter: DbRecord<ChapterData>): string => {
  const name = chapter.data.name
  if (typeof name === 'string' && name.trim().length) return name.trim()
  return ''
}

export const mapChapterToRow = (
  chapter: DbRecord<ChapterData>,
  progressByChapterId?: Map<string, number>
): ChapterRowModel => {
  const progress = progressByChapterId?.get(chapter.id) ?? 0

  return {
    id: chapter.id,
    chapterNumber: getChapterNumber(chapter),
    chapterName: getChapterName(chapter),
    progress,
    isRead: progress >= 100,
    numberSortValue: extractComparableNumber(chapter.data.number)
  }
}

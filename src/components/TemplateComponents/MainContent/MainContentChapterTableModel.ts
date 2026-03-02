import type { ResolvedChapterRecord } from 'services'

export interface ChapterRowModel {
  id: string
  chapterNumber: string
  chapterName: string
  chapterLanguage: string
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

const getChapterNumber = (chapter: ResolvedChapterRecord): string => {
  const number = chapter.data.number
  if (typeof number === 'string' && number.trim().length) return number.trim()
  return '-'
}

const getChapterName = (chapter: ResolvedChapterRecord): string => {
  const name = chapter.data.name
  if (typeof name === 'string' && name.trim().length) return name.trim()
  return ''
}

const getChapterLanguage = (chapter: ResolvedChapterRecord): string => {
  const direct = chapter.data.language
  if (typeof direct === 'string' && direct.trim().length) return direct.trim().toUpperCase()

  const rawRecord =
    chapter.data.raw && typeof chapter.data.raw === 'object'
      ? (chapter.data.raw as Record<string, unknown>)
      : null
  const rawDirect =
    (typeof rawRecord?.language === 'string' && rawRecord.language.trim()) ||
    (typeof rawRecord?.lang === 'string' && rawRecord.lang.trim()) ||
    ''
  if (rawDirect) return rawDirect.toUpperCase()

  const fromArray = Array.isArray(chapter.data.languageCodes)
    ? chapter.data.languageCodes.find((entry) => typeof entry === 'string' && entry.trim().length)
    : null
  if (typeof fromArray === 'string') return fromArray.trim().toUpperCase()

  return ''
}

export const mapChapterToRow = (
  chapter: ResolvedChapterRecord,
  progressByChapterId?: Map<string, number>
): ChapterRowModel => {
  const variantChapterId =
    typeof chapter.data.variantChapterId === 'string' ? chapter.data.variantChapterId : ''
  const progress =
    progressByChapterId?.get(chapter.id) ??
    (variantChapterId ? progressByChapterId?.get(variantChapterId) : undefined) ??
    0

  return {
    id: chapter.id,
    chapterNumber: getChapterNumber(chapter),
    chapterName: getChapterName(chapter),
    chapterLanguage: getChapterLanguage(chapter),
    progress,
    isRead: progress >= 100,
    numberSortValue: extractComparableNumber(chapter.data.number)
  }
}

import type { DbRecord } from './restClient'

export interface WorkData {
  title?: string
  name?: string
  description?: string
  synopsis?: string
  cover?: string
  publisher?: string
  status?: string
  settings?: Record<string, unknown>
  [key: string]: unknown
}

export interface CanonicalChapterData {
  workId?: string
  number?: string
  name?: string
  [key: string]: unknown
}

export interface ChapterVariantData {
  workId?: string
  pluginId?: string
  pluginTag?: string
  pluginName?: string
  sourceId?: string
  sourceName?: string
  siteId?: string
  siteLink?: string
  number?: string
  name?: string
  pages?: unknown
  [key: string]: unknown
}

export interface ChapterMappingData {
  workId?: string
  canonicalChapterId?: string
  variantChapterId?: string
  strategy?: string
  confidence?: number
  [key: string]: unknown
}

export interface ResolvedChapterData {
  number?: string
  name?: string
  canonicalChapterId?: string
  variantChapterId?: string
  pages?: unknown
  [key: string]: unknown
}

export type ResolvedChapterRecord = DbRecord<ResolvedChapterData>

export interface ResolvedPage {
  index: number
  fileName: string
  url: string
}

export const chapterNumberSortValue = (raw: unknown): number | null => {
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

const normalizeChapterNumberToken = (raw: unknown): string => {
  if (typeof raw !== 'string') return ''
  const direct = chapterNumberSortValue(raw)
  if (direct !== null) return String(direct)
  return raw.trim().toLowerCase()
}

const normalizeLanguageCode = (raw: unknown): string => {
  if (typeof raw !== 'string') return ''
  return raw.trim().toLowerCase().replace(/_/g, '-')
}

const languagePreferenceScore = (language: string, preferred: string): number | null => {
  const normalizedLanguage = normalizeLanguageCode(language)
  const normalizedPreferred = normalizeLanguageCode(preferred)
  if (!normalizedLanguage || !normalizedPreferred) return null

  const languageBase = normalizedLanguage.split('-')[0]
  const preferredBase = normalizedPreferred.split('-')[0]

  if (normalizedLanguage === normalizedPreferred) return 0
  if (languageBase === normalizedPreferred) return 1
  if (normalizedLanguage === preferredBase) return 2
  if (languageBase === preferredBase) return 3
  return null
}

const variantLanguageCodes = (variant: DbRecord<ChapterVariantData>): string[] => {
  const rawRecord =
    variant.data.raw && typeof variant.data.raw === 'object'
      ? (variant.data.raw as Record<string, unknown>)
      : null
  const explicitRaw = rawRecord
    ? [rawRecord.language, rawRecord.lang].map((entry) => normalizeLanguageCode(entry)).filter(Boolean)
    : []
  if (explicitRaw.length > 0) {
    return Array.from(new Set(explicitRaw))
  }

  const explicitStored = [variant.data.language].map((entry) => normalizeLanguageCode(entry)).filter(Boolean)
  if (explicitStored.length > 0) {
    return Array.from(new Set(explicitStored))
  }

  const fromRawArray = rawRecord
    ? [
        ...(Array.isArray(rawRecord.languageCodes) ? rawRecord.languageCodes : []),
        ...(Array.isArray(rawRecord.languages) ? rawRecord.languages : [])
      ]
        .map((entry) => normalizeLanguageCode(entry))
        .filter(Boolean)
    : []
  if (fromRawArray.length > 0) {
    return Array.from(new Set(fromRawArray))
  }

  const fromArray = Array.isArray(variant.data.languageCodes)
    ? variant.data.languageCodes.map((entry) => normalizeLanguageCode(entry)).filter(Boolean)
    : []
  const single = normalizeLanguageCode(variant.data.language)
  return Array.from(new Set([...fromArray, single].filter(Boolean)))
}

const variantLanguageRank = (variant: DbRecord<ChapterVariantData>, preferredLanguageCodes: string[]): number => {
  if (preferredLanguageCodes.length === 0) return Number.MAX_SAFE_INTEGER

  const languages = variantLanguageCodes(variant)
  if (languages.length === 0) return Number.MAX_SAFE_INTEGER

  let best = Number.MAX_SAFE_INTEGER
  for (const language of languages) {
    preferredLanguageCodes.forEach((preferred, index) => {
      const score = languagePreferenceScore(language, preferred)
      if (score === null) return
      best = Math.min(best, index * 10 + score)
    })
  }

  return best
}

const selectPreferredVariant = (
  variants: Array<DbRecord<ChapterVariantData>>,
  preferredLanguageCodes: string[],
  strictLanguageFilter: boolean
): DbRecord<ChapterVariantData> | null => {
  if (variants.length === 0) return null

  const matchingVariants =
    strictLanguageFilter && preferredLanguageCodes.length > 0
      ? variants.filter((variant) => variantLanguageRank(variant, preferredLanguageCodes) !== Number.MAX_SAFE_INTEGER)
      : variants

  if (matchingVariants.length === 0) {
    return null
  }

  const sorted = [...matchingVariants].sort((left, right) => {
    if (preferredLanguageCodes.length > 0) {
      const leftRank = variantLanguageRank(left, preferredLanguageCodes)
      const rightRank = variantLanguageRank(right, preferredLanguageCodes)
      if (leftRank !== rightRank) return leftRank - rightRank
    }

    const leftHasPages = normalizeChapterPages(left.data.pages).length > 0 ? 1 : 0
    const rightHasPages = normalizeChapterPages(right.data.pages).length > 0 ? 1 : 0
    if (leftHasPages !== rightHasPages) return rightHasPages - leftHasPages

    return left.id.localeCompare(right.id)
  })

  return sorted[0] ?? null
}

const sortByChapterNumber = (a: { number?: unknown }, b: { number?: unknown }): number => {
  const av = chapterNumberSortValue(a.number)
  const bv = chapterNumberSortValue(b.number)
  if (av !== null && bv !== null && av !== bv) return av - bv
  if (av !== null && bv === null) return -1
  if (av === null && bv !== null) return 1
  const aNum = typeof a.number === 'string' ? a.number : ''
  const bNum = typeof b.number === 'string' ? b.number : ''
  return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' })
}

export const normalizeChapterPages = (raw: unknown): ResolvedPage[] => {
  if (!Array.isArray(raw)) return []

  return raw
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const url = entry.trim()
        if (!url) return null
        return {
          index,
          fileName: `page-${index + 1}`,
          url
        } satisfies ResolvedPage
      }

      if (!entry || typeof entry !== 'object') return null
      const record = entry as Record<string, unknown>
      const urlRaw =
        (typeof record.url === 'string' && record.url) ||
        (typeof record.src === 'string' && record.src) ||
        (typeof record.path === 'string' && record.path) ||
        ''
      const url = urlRaw.trim()
      if (!url) return null
      const fileNameRaw =
        (typeof record.fileName === 'string' && record.fileName) ||
        (typeof record.name === 'string' && record.name) ||
        `page-${index + 1}`
      return {
        index,
        fileName: fileNameRaw.trim() || `page-${index + 1}`,
        url
      } satisfies ResolvedPage
    })
    .filter((entry): entry is ResolvedPage => Boolean(entry))
}

export const resolveChapterVariants = (
  canonicalChapters: Array<DbRecord<CanonicalChapterData>>,
  chapterMappings: Array<DbRecord<ChapterMappingData>>,
  chapterVariants: Array<DbRecord<ChapterVariantData>>,
  preferredLanguageCodes: string[] = [],
  strictLanguageFilter = false
): ResolvedChapterRecord[] => {
  const variantById = new Map(chapterVariants.map((chapter) => [chapter.id, chapter]))

  const mappingsByCanonical = new Map<string, Array<DbRecord<ChapterMappingData>>>()
  for (const mapping of chapterMappings) {
    const canonicalId = typeof mapping.data.canonicalChapterId === 'string' ? mapping.data.canonicalChapterId : ''
    if (!canonicalId) continue
    const list = mappingsByCanonical.get(canonicalId) ?? []
    list.push(mapping)
    mappingsByCanonical.set(canonicalId, list)
  }

  const sortedCanonical = [...canonicalChapters].sort((a, b) =>
    sortByChapterNumber({ number: a.data.number }, { number: b.data.number })
  )
  const resolved: ResolvedChapterRecord[] = []
  const usedVariantIds = new Set<string>()

  for (const canonical of sortedCanonical) {
    const mappings = mappingsByCanonical.get(canonical.id) ?? []
    const canonicalRaw =
      canonical.data.raw && typeof canonical.data.raw === 'object'
        ? (canonical.data.raw as Record<string, unknown>)
        : null
    const isGeneratedPlaceholder = canonicalRaw?.generated === true
    const candidates = mappings
      .map((mapping) =>
        typeof mapping.data.variantChapterId === 'string' ? mapping.data.variantChapterId : ''
      )
      .filter((variantId) => variantId && !usedVariantIds.has(variantId))
      .map((variantId) => variantById.get(variantId))
      .filter((variant): variant is DbRecord<ChapterVariantData> => Boolean(variant))

    const selectedVariant = selectPreferredVariant(candidates, preferredLanguageCodes, strictLanguageFilter)

    if (selectedVariant) {
      usedVariantIds.add(selectedVariant.id)
      resolved.push({
        id: canonical.id,
        created_at: canonical.created_at,
        updated_at: canonical.updated_at,
        data: {
          ...selectedVariant.data,
          canonicalChapterId: canonical.id,
          variantChapterId: selectedVariant.id,
          number:
            (typeof canonical.data.number === 'string' && canonical.data.number) ||
            selectedVariant.data.number,
          name:
            (typeof canonical.data.name === 'string' && canonical.data.name) ||
            selectedVariant.data.name ||
            selectedVariant.data.number ||
            '-'
        }
      })
      continue
    }

    if (mappings.length === 0 && isGeneratedPlaceholder && chapterVariants.length > 0) {
      continue
    }

    if (strictLanguageFilter && preferredLanguageCodes.length > 0) {
      continue
    }

    resolved.push({
      id: canonical.id,
      created_at: canonical.created_at,
      updated_at: canonical.updated_at,
      data: {
        canonicalChapterId: canonical.id,
        number: canonical.data.number,
        name: canonical.data.name || canonical.data.number || '-',
        pages: [],
        isPlaceholder: true
      }
    })
  }

  const fallbackVariants = chapterVariants
    .filter((variant) => !usedVariantIds.has(variant.id))
    .filter((variant) =>
      strictLanguageFilter && preferredLanguageCodes.length > 0
        ? variantLanguageRank(variant, preferredLanguageCodes) !== Number.MAX_SAFE_INTEGER
        : true
    )
    .sort((a, b) => sortByChapterNumber({ number: a.data.number }, { number: b.data.number }))

  for (const variant of fallbackVariants) {
    resolved.push({
      id: variant.id,
      created_at: variant.created_at,
      updated_at: variant.updated_at,
      data: {
        ...variant.data,
        variantChapterId: variant.id,
        number: variant.data.number,
        name: variant.data.name || variant.data.number || '-'
      }
    })
  }

  if (resolved.length > 0) return resolved

  const byNumber = new Map<string, DbRecord<ChapterVariantData>>()
  for (const variant of chapterVariants) {
    if (
      strictLanguageFilter &&
      preferredLanguageCodes.length > 0 &&
      variantLanguageRank(variant, preferredLanguageCodes) === Number.MAX_SAFE_INTEGER
    ) {
      continue
    }
    const token =
      normalizeChapterNumberToken(variant.data.number) || normalizeChapterNumberToken(variant.data.name)
    if (!token || byNumber.has(token)) continue
    byNumber.set(token, variant)
  }

  return [...byNumber.values()]
    .sort((a, b) => sortByChapterNumber({ number: a.data.number }, { number: b.data.number }))
    .map((variant) => ({
      id: variant.id,
      created_at: variant.created_at,
      updated_at: variant.updated_at,
      data: {
        ...variant.data,
        variantChapterId: variant.id,
        number: variant.data.number,
        name: variant.data.name || variant.data.number || '-'
      }
    }))
}

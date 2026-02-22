import { dbUpsert } from 'services'
import type { ComicImportPayload, ComicImportResult } from './types'
import {
  buildStableId,
  normalizeChapterPages,
  normalizePluginTag,
  pickString,
  pickStringArray
} from './utils'

export const importComicFromDeepLink = async (
  payload: ComicImportPayload
): Promise<ComicImportResult> => {
  const comic = payload.comic
  const chapters = payload.chapters

  const sourceTag =
    normalizePluginTag(
      pickString(comic, ['sourceTag', 'repo', 'tag', 'pluginTag', 'source', 'provider'])
    ) || 'web-scrapper'
  const sourceName = pickString(comic, ['sourceName', 'repoName', 'providerName']) || sourceTag
  const comicSiteId = pickString(comic, ['siteId', 'id', 'externalId'])
  const comicName = pickString(comic, ['name', 'title']) || comicSiteId || 'Untitled'
  const comicSiteLink = pickString(comic, ['siteLink', 'url', 'link'])

  const languageCodes = Array.from(
    new Set(
      [
        ...pickStringArray(comic, ['languageCodes', 'languages']),
        pickString(comic, ['language', 'lang'])
      ].filter(Boolean)
    )
  )
  const normalizedLanguageCodes = languageCodes.length > 0 ? languageCodes : ['pt-BR']

  const contentTypeRaw = pickString(comic, ['contentType', 'type'])
  const contentType = /manga/i.test(contentTypeRaw) ? 'manga' : 'comic'

  const comicId = buildStableId('comic', sourceTag, comicSiteId || comicSiteLink || comicName)

  await dbUpsert(
    'comics',
    {
      ...comic,
      name: comicName,
      siteId: comicSiteId || null,
      siteLink: comicSiteLink || null,
      sourceTag,
      sourceName,
      pluginId: `plugin:${sourceTag}`,
      contentType,
      languageCodes: normalizedLanguageCodes,
      hasOffline: false,
      offline: 0
    },
    comicId
  )

  let chaptersImported = 0
  let chaptersSkipped = 0

  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index]
    const pages = normalizeChapterPages(
      chapter.pages ?? chapter.images ?? chapter.pictures ?? chapter.files
    )

    if (pages.length === 0) {
      chaptersSkipped += 1
      continue
    }

    const chapterSiteId = pickString(chapter, ['siteId', 'id', 'externalId'])
    const chapterNumber = pickString(chapter, ['number', 'chapterNumber'])
    const chapterName = pickString(chapter, ['name', 'title'])

    const chapterId = buildStableId(
      'chapter',
      sourceTag,
      comicSiteId || comicId,
      chapterSiteId || chapterNumber || chapterName || String(index + 1)
    )

    await dbUpsert(
      'chapters',
      {
        ...chapter,
        comicId,
        siteId: chapterSiteId || null,
        siteLink: pickString(chapter, ['siteLink', 'url', 'link']) || null,
        number: chapterNumber || String(index + 1),
        name: chapterName,
        pages,
        sourceTag,
        sourceName,
        languageCodes: Array.from(
          new Set(
            [
              ...pickStringArray(chapter, ['languageCodes', 'languages']),
              pickString(chapter, ['language', 'lang']),
              ...normalizedLanguageCodes
            ].filter(Boolean)
          )
        ),
        hasOffline: false,
        offline: 0
      },
      chapterId
    )

    chaptersImported += 1
  }

  return { comicId, comicName, chaptersImported, chaptersSkipped }
}

import { ComponentProps, FC, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BgBox } from 'components'
import { Button } from 'components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from 'components/ui/sheet'
import { dbDelete, dbFind, restQueryKeys, useDbListQuery, type WorkData } from 'services'
import { cn } from 'utils'
import { useTranslation } from 'react-i18next'
import { LeftListItem } from './LeftListItem'

interface LeftListProps extends ComponentProps<'div'> {
  selectedWorkId?: string | null
  onSelectWork?: (workId: string | null) => void
}

export const LeftList: FC<LeftListProps> = ({
  className,
  selectedWorkId,
  onSelectWork,
  ...props
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const worksQuery = useDbListQuery<WorkData>('works', 500, 0)
  const [removingWorkId, setRemovingWorkId] = useState<string | null>(null)
  const [confirmDeleteWorkId, setConfirmDeleteWorkId] = useState<string | null>(null)
  const hasInitializedSelectionRef = useRef(false)
  const visibleWorks = useMemo(() => worksQuery.data ?? [], [worksQuery.data])

  useEffect(() => {
    if (selectedWorkId) {
      hasInitializedSelectionRef.current = true
    }
  }, [selectedWorkId])

  useEffect(() => {
    if (hasInitializedSelectionRef.current) return

    if (!selectedWorkId && visibleWorks.length) {
      hasInitializedSelectionRef.current = true
      onSelectWork?.(visibleWorks[0].id)
    }
  }, [selectedWorkId, visibleWorks, onSelectWork])

  const removeWork = async (workId: string) => {
    if (removingWorkId) return

    const nextSelectedWorkId = visibleWorks.find((work) => work.id !== workId)?.id ?? null
    setRemovingWorkId(workId)
    try {
      const [comics, chaptersByWork, canonicalChapters, chapterVariants, chapterMappings, readProgress] =
        await Promise.all([
          dbFind<Record<string, unknown>>('comics', 'workId', workId, 5000),
          dbFind<Record<string, unknown>>('chapters', 'workId', workId, 5000),
          dbFind<Record<string, unknown>>('canonical_chapters', 'workId', workId, 5000),
          dbFind<Record<string, unknown>>('chapter_variants', 'workId', workId, 5000),
          dbFind<Record<string, unknown>>('chapter_mappings', 'workId', workId, 5000),
          dbFind<Record<string, unknown>>('read_progress', 'comicId', workId, 5000)
        ])

      const comicIds = comics.map((record) => record.id)
      const legacyReadProgressLists = await Promise.all(
        comicIds.map((comicId) => dbFind<Record<string, unknown>>('read_progress', 'comicId', comicId, 5000))
      )

      const chaptersByComicLists = await Promise.all(
        comicIds.map((comicId) => dbFind<Record<string, unknown>>('chapters', 'comicId', comicId, 5000))
      )

      const deleteTargets = new Map<string, { table: Parameters<typeof dbDelete>[0]; id: string }>()
      const addDeleteTarget = (table: Parameters<typeof dbDelete>[0], id: string) => {
        deleteTargets.set(`${table}::${id}`, { table, id })
      }

      chaptersByWork.forEach((record) => addDeleteTarget('chapters', record.id))
      chaptersByComicLists.flat().forEach((record) => addDeleteTarget('chapters', record.id))
      canonicalChapters.forEach((record) => addDeleteTarget('canonical_chapters', record.id))
      chapterVariants.forEach((record) => addDeleteTarget('chapter_variants', record.id))
      chapterMappings.forEach((record) => addDeleteTarget('chapter_mappings', record.id))
      comics.forEach((record) => addDeleteTarget('comics', record.id))
      readProgress.forEach((record) => addDeleteTarget('read_progress', record.id))
      legacyReadProgressLists.flat().forEach((record) => addDeleteTarget('read_progress', record.id))
      addDeleteTarget('works', workId)

      await Promise.all(
        [...deleteTargets.values()].map((target) => dbDelete(target.table, target.id))
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: restQueryKeys.dbList('works', 500, 0) }),
        queryClient.invalidateQueries({ queryKey: restQueryKeys.comics }),
        queryClient.invalidateQueries({ queryKey: ['rest', 'chapters'] }),
        queryClient.invalidateQueries({ queryKey: ['rest', 'db', 'find', 'canonical_chapters'] }),
        queryClient.invalidateQueries({ queryKey: ['rest', 'db', 'find', 'chapter_variants'] }),
        queryClient.invalidateQueries({ queryKey: ['rest', 'db', 'find', 'chapter_mappings'] }),
        queryClient.invalidateQueries({ queryKey: ['rest', 'db', 'find', 'read_progress'] })
      ])
      await worksQuery.refetch()

      if (selectedWorkId === workId) {
        hasInitializedSelectionRef.current = true
        onSelectWork?.(nextSelectedWorkId)
      }
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: restQueryKeys.dbList('works', 500, 0) })
      throw error
    } finally {
      setRemovingWorkId(null)
      setConfirmDeleteWorkId((current) => (current === workId ? null : current))
    }
  }

  const confirmDeleteWork = (worksQuery.data ?? []).find((work) => work.id === confirmDeleteWorkId) ?? null
  const confirmDeleteWorkName =
    (typeof confirmDeleteWork?.data.title === 'string' && confirmDeleteWork.data.title) ||
    (typeof confirmDeleteWork?.data.name === 'string' && confirmDeleteWork.data.name) ||
    confirmDeleteWorkId ||
    ''

  return (
    <BgBox className={cn('min-h-0 overflow-auto', className)} {...props}>
      <div className="divide-y divide-white/10">
        {visibleWorks.map((work) => {
          const workName =
            (typeof work.data.title === 'string' && work.data.title) ||
            (typeof work.data.name === 'string' && work.data.name) ||
            work.id
          const coverUrl = typeof work.data.cover === 'string' ? work.data.cover : undefined

          return (
            <LeftListItem
              key={work.id}
              title={workName}
              coverUrl={coverUrl}
              onClick={() => {
                hasInitializedSelectionRef.current = true
                onSelectWork?.(work.id)
              }}
              onRemove={() => setConfirmDeleteWorkId(work.id)}
              removing={removingWorkId === work.id}
              active={work.id === selectedWorkId}
            />
          )
        })}
        {!visibleWorks.length && (
          <div className="p-3 text-sm text-muted-foreground">{t('library.empty')}</div>
        )}
      </div>
      <Sheet
        open={Boolean(confirmDeleteWorkId)}
        onOpenChange={(open) => {
          if (!open && !removingWorkId) {
            setConfirmDeleteWorkId(null)
          }
        }}
      >
        <SheetContent side="bottom" showCloseButton={false} className="gap-0">
          <SheetHeader>
            <SheetTitle>{t('library.remove.confirmTitle')}</SheetTitle>
            <SheetDescription>
              {removingWorkId
                ? t('library.remove.removing')
                : t('library.remove.confirmDescription', { title: confirmDeleteWorkName })}
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDeleteWorkId(null)}
              disabled={Boolean(removingWorkId)}
            >
              {t('library.remove.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!confirmDeleteWorkId) return
                void removeWork(confirmDeleteWorkId)
              }}
              disabled={Boolean(removingWorkId)}
            >
              {removingWorkId ? t('library.remove.removing') : t('library.remove.confirmAction')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </BgBox>
  )
}

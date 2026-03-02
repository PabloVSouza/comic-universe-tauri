import { ComponentProps, FC, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BgBox } from 'components'
import { dbDelete, dbFind, restQueryKeys, useDbListQuery, type WorkData } from 'services'
import { cn } from 'utils'
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
  const queryClient = useQueryClient()
  const worksQuery = useDbListQuery<WorkData>('works', 500, 0)
  const [removingWorkId, setRemovingWorkId] = useState<string | null>(null)
  const [pendingDeleteWorkId, setPendingDeleteWorkId] = useState<string | null>(null)
  const hasInitializedSelectionRef = useRef(false)
  const pendingDeleteTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (selectedWorkId) {
      hasInitializedSelectionRef.current = true
    }
  }, [selectedWorkId])

  useEffect(() => {
    if (hasInitializedSelectionRef.current) return

    if (!selectedWorkId && worksQuery.data?.length) {
      hasInitializedSelectionRef.current = true
      onSelectWork?.(worksQuery.data[0].id)
    }
  }, [selectedWorkId, worksQuery.data, onSelectWork])

  useEffect(() => {
    return () => {
      if (pendingDeleteTimeoutRef.current !== null) {
        window.clearTimeout(pendingDeleteTimeoutRef.current)
      }
    }
  }, [])

  const removeWork = async (workId: string) => {
    if (removingWorkId) return

    const targetWork = (worksQuery.data ?? []).find((work) => work.id === workId)
    const targetName =
      (typeof targetWork?.data.title === 'string' && targetWork.data.title) ||
      (typeof targetWork?.data.name === 'string' && targetWork.data.name) ||
      workId

    if (pendingDeleteWorkId !== workId) {
      setPendingDeleteWorkId(workId)
      if (pendingDeleteTimeoutRef.current !== null) {
        window.clearTimeout(pendingDeleteTimeoutRef.current)
      }
      pendingDeleteTimeoutRef.current = window.setTimeout(() => {
        setPendingDeleteWorkId((current) => (current === workId ? null : current))
        pendingDeleteTimeoutRef.current = null
      }, 3000)
      toast.warning(`Tap remove again to delete "${targetName}"`, { duration: 2500 })
      return
    }

    setPendingDeleteWorkId(null)
    if (pendingDeleteTimeoutRef.current !== null) {
      window.clearTimeout(pendingDeleteTimeoutRef.current)
      pendingDeleteTimeoutRef.current = null
    }

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

      if (selectedWorkId === workId) {
        hasInitializedSelectionRef.current = true
        onSelectWork?.(null)
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: restQueryKeys.dbList('works', 500, 0) }),
        queryClient.invalidateQueries({ queryKey: restQueryKeys.comics }),
        queryClient.invalidateQueries({ queryKey: ['rest', 'chapters'] }),
        queryClient.invalidateQueries({ queryKey: ['rest', 'db', 'find', 'canonical_chapters'] }),
        queryClient.invalidateQueries({ queryKey: ['rest', 'db', 'find', 'chapter_variants'] }),
        queryClient.invalidateQueries({ queryKey: ['rest', 'db', 'find', 'chapter_mappings'] }),
        queryClient.invalidateQueries({ queryKey: ['rest', 'db', 'find', 'read_progress'] })
      ])
    } finally {
      setRemovingWorkId(null)
    }
  }

  return (
    <BgBox className={cn('min-h-0 overflow-auto', className)} {...props}>
      <div className="divide-y divide-white/10">
        {(worksQuery.data ?? []).map((work) => {
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
              onRemove={() => void removeWork(work.id)}
              removing={removingWorkId === work.id}
              confirmRemove={pendingDeleteWorkId === work.id}
              active={work.id === selectedWorkId}
            />
          )
        })}
        {!worksQuery.data?.length && (
          <div className="p-3 text-sm text-muted-foreground">No comics available.</div>
        )}
      </div>
    </BgBox>
  )
}

import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import { ArrowUpDown, BookOpenCheck, CheckSquare2, Square, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from 'components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'components/ui/table'
import { restQueryKeys, useMarkChaptersReadStateMutation } from 'services'
import type { ChapterData, DbRecord } from 'services'
import { cn } from 'utils'

interface MainContentChapterTableProps {
  comicId: string
  chapters: Array<DbRecord<ChapterData>>
}

interface ChapterRowModel {
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

const getProgress = (chapter: DbRecord<ChapterData>): number => {
  const raw = chapter.data.progress
  if (typeof raw === 'number') return Math.max(0, Math.min(100, Math.round(raw)))
  return 0
}

const isChapterRead = (chapter: DbRecord<ChapterData>): boolean => {
  if (typeof chapter.data.isRead === 'boolean') return chapter.data.isRead
  return getProgress(chapter) >= 100
}

export const MainContentChapterTable = ({ comicId, chapters }: MainContentChapterTableProps) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const markMutation = useMarkChaptersReadStateMutation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sorting, setSorting] = useState<SortingState>([{ id: 'chapterNumber', desc: false }])

  const rows = useMemo<ChapterRowModel[]>(
    () =>
      chapters.map((chapter) => ({
        id: chapter.id,
        chapterNumber: getChapterNumber(chapter),
        chapterName: getChapterName(chapter),
        progress: getProgress(chapter),
        isRead: isChapterRead(chapter),
        numberSortValue: extractComparableNumber(chapter.data.number)
      })),
    [chapters]
  )

  const selectedIdList = useMemo(() => Array.from(selectedIds), [selectedIds])

  const updateReadState = (chapterIds: string[], read: boolean) => {
    if (!chapterIds.length) return
    markMutation.mutate(
      { chapterIds, read },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: restQueryKeys.chaptersByComicId(comicId) })
          setSelectedIds((current) => {
            const next = new Set(current)
            chapterIds.forEach((id) => next.delete(id))
            return next
          })
        }
      }
    )
  }

  const columns = useMemo<ColumnDef<ChapterRowModel>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => {
          const allRows = table.getRowModel().rows
          const allIds = allRows.map((row) => row.original.id)
          const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

          return (
            <div className="flex items-center justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 hover:bg-accent/70"
                    onClick={() =>
                      setSelectedIds(
                        allSelected ? new Set() : new Set(allRows.map((row) => row.original.id))
                      )
                    }
                    aria-label={
                      allSelected
                        ? t('mainContent.chapterTable.actions.unselectAllChapters')
                        : t('mainContent.chapterTable.actions.selectAllChapters')
                    }
                  >
                    {allSelected ? (
                      <CheckSquare2 className="size-4" />
                    ) : (
                      <Square className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {allSelected
                    ? t('mainContent.chapterTable.actions.unselectAll')
                    : t('mainContent.chapterTable.actions.selectAll')}
                </TooltipContent>
              </Tooltip>
            </div>
          )
        },
        cell: ({ row }) => {
          const selected = selectedIds.has(row.original.id)
          return (
            <div className="flex items-center justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 hover:bg-accent/70"
                    onClick={() =>
                      setSelectedIds((current) => {
                        const next = new Set(current)
                        if (next.has(row.original.id)) next.delete(row.original.id)
                        else next.add(row.original.id)
                        return next
                      })
                    }
                    aria-label={
                      selected
                        ? t('mainContent.chapterTable.actions.unselectChapter')
                        : t('mainContent.chapterTable.actions.selectChapter')
                    }
                  >
                    {selected ? <CheckSquare2 className="size-4" /> : <Square className="size-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {selected
                    ? t('mainContent.chapterTable.actions.unselectChapter')
                    : t('mainContent.chapterTable.actions.selectChapter')}
                </TooltipContent>
              </Tooltip>
            </div>
          )
        },
        enableSorting: false,
        size: 44
      },
      {
        accessorKey: 'chapterNumber',
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs font-normal hover:bg-accent/70"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('mainContent.chapterTable.headers.chapter')}
            <ArrowUpDown className="ml-2 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => <div className="px-2">{row.original.chapterNumber}</div>,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.numberSortValue
          const b = rowB.original.numberSortValue
          if (a !== null && b !== null && a !== b) return a - b
          if (a !== null && b === null) return -1
          if (a === null && b !== null) return 1
          return rowA.original.chapterNumber.localeCompare(rowB.original.chapterNumber, undefined, {
            numeric: true,
            sensitivity: 'base'
          })
        },
        size: 96
      },
      {
        accessorKey: 'chapterName',
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs font-normal hover:bg-accent/70"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('mainContent.chapterTable.headers.name')}
            <ArrowUpDown className="ml-2 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => <div className="truncate px-2">{row.original.chapterName}</div>
      },
      {
        accessorKey: 'progress',
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs font-normal hover:bg-accent/70"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('mainContent.chapterTable.headers.progress')}
            <ArrowUpDown className="ml-2 size-3.5" />
          </Button>
        ),
        cell: ({ row }) => <div className="px-2 text-right">{row.original.progress}%</div>,
        size: 96
      },
      {
        id: 'read',
        header: () => (
          <div className="px-2 text-xs text-muted-foreground">
            {t('mainContent.chapterTable.headers.read')}
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 hover:bg-accent/70"
                  onClick={() => updateReadState([row.original.id], !row.original.isRead)}
                  aria-label={
                    row.original.isRead
                      ? t('mainContent.chapterTable.actions.markUnread')
                      : t('mainContent.chapterTable.actions.markRead')
                  }
                >
                  {row.original.isRead ? (
                    <Undo2 className="size-4" />
                  ) : (
                    <BookOpenCheck className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {row.original.isRead
                  ? t('mainContent.chapterTable.actions.markUnread')
                  : t('mainContent.chapterTable.actions.markRead')}
              </TooltipContent>
            </Tooltip>
          </div>
        ),
        enableSorting: false,
        size: 56
      }
    ],
    [selectedIds, t]
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  const hasSelection = selectedIds.size > 0

  return (
    <div className="min-h-0 overflow-auto">
      {hasSelection ? (
        <div className="animate-in fade-in-0 slide-in-from-top-1 mt-px mb-px flex items-center gap-2 bg-background/70 p-2 duration-200">
          <div className="text-xs text-muted-foreground">
            {t('mainContent.chapterTable.bulk.selectedCount', { count: selectedIds.size })}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={() => setSelectedIds(new Set())}
          >
            {t('mainContent.chapterTable.bulk.clear')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={() => updateReadState(selectedIdList, true)}
            disabled={markMutation.isPending}
          >
            {t('mainContent.chapterTable.bulk.markRead')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={() => updateReadState(selectedIdList, false)}
            disabled={markMutation.isPending}
          >
            {t('mainContent.chapterTable.bulk.markUnread')}
          </Button>
        </div>
      ) : null}

      <Table className="table-fixed">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="border-border/50 bg-muted/30 hover:bg-muted/30"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  className={cn('h-10 px-1', header.column.id === 'progress' ? 'text-right' : '')}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => {
              const isSelected = selectedIds.has(row.original.id)
              return (
                <TableRow
                  key={row.id}
                  data-state={isSelected ? 'selected' : undefined}
                  className="border-border/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="h-11 px-1">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-20 text-center text-muted-foreground"
              >
                {t('mainContent.chapterTable.empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

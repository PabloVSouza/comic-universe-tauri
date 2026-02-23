import { FC, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { Input } from 'components/ui/input'
import { Button } from 'components/ui/button'
import { LoadingOverlay } from 'components'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import { useDbListQuery, useListComicsQuery, restQueryKeys } from 'services'
import {
  addSearchResultToDatabase,
  listInstalledPlugins,
  loadSearchResultDetails,
  PluginSearchError,
  PluginRecordData,
  searchByPlugins,
  type SearchResultDetails,
  type SearchResultItem
} from './pluginApi'
import { SearchResultCard } from './SearchResultCard'

export type SearchContentWindowProps = Record<string, unknown>

export const SearchContentWindow: FC<SearchContentWindowProps> = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const pluginsQuery = useDbListQuery<PluginRecordData>('plugins', 500, 0)
  const comicsQuery = useListComicsQuery()

  const [query, setQuery] = useState('')
  const [selectedPluginIds, setSelectedPluginIds] = useState<string[]>([])
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchErrors, setSearchErrors] = useState<PluginSearchError[]>([])
  const [addingByResultId, setAddingByResultId] = useState<Record<string, boolean>>({})
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null)
  const [detailsByResultId, setDetailsByResultId] = useState<Record<string, SearchResultDetails>>({})
  const [loadingDetailsByResultId, setLoadingDetailsByResultId] = useState<Record<string, boolean>>({})
  const searchDebounceRef = useRef<number | null>(null)
  const listScrollContainerRef = useRef<HTMLDivElement | null>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const [visibleCount, setVisibleCount] = useState(20)

  const plugins = useMemo(
    () => listInstalledPlugins(pluginsQuery.data ?? []).filter((plugin) => plugin.enabled),
    [pluginsQuery.data]
  )

  const selectedPlugins = useMemo(() => {
    return plugins.filter((plugin) => selectedPluginIds.includes(plugin.id))
  }, [plugins, selectedPluginIds])
  const renderedResults = useMemo(() => results.slice(0, visibleCount), [results, visibleCount])

  useEffect(() => {
    if (plugins.length === 0) {
      setSelectedPluginIds([])
      return
    }
    setSelectedPluginIds((current) => {
      if (current.length > 0) {
        return current.filter((pluginId) => plugins.some((plugin) => plugin.id === pluginId))
      }
      return plugins.map((plugin) => plugin.id)
    })
  }, [plugins])

  useEffect(() => {
    setVisibleCount(20)
  }, [results])

  const existingComicSourceKeySet = useMemo(() => {
    const set = new Set<string>()
    for (const comic of comicsQuery.data ?? []) {
      const sourceTag =
        typeof comic.data.sourceTag === 'string' ? comic.data.sourceTag : typeof comic.data.tag === 'string' ? comic.data.tag : ''
      const siteId = typeof comic.data.siteId === 'string' ? comic.data.siteId : ''
      if (sourceTag && siteId) {
        set.add(`${sourceTag}:${siteId}`)
      }
    }
    return set
  }, [comicsQuery.data])

  const handleTogglePlugin = (pluginId: string) => {
    setSelectedPluginIds((current) =>
      current.includes(pluginId) ? current.filter((id) => id !== pluginId) : [...current, pluginId]
    )
  }

  const handleSearch = async (searchValue: string) => {
    if (!searchValue.trim()) {
      setResults([])
      setSearchErrors([])
      setExpandedResultId(null)
      setDetailsByResultId({})
      setLoadingDetailsByResultId({})
      return
    }

    if (selectedPlugins.length === 0) {
      setResults([])
      setSearchErrors([])
      return
    }
    setIsSearching(true)
    try {
      const { results: nextResults, errors } = await searchByPlugins(selectedPlugins, searchValue)
      setResults(nextResults)
      setSearchErrors(errors)
      setExpandedResultId(null)
      setDetailsByResultId({})
      setLoadingDetailsByResultId({})
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current)
    }

    searchDebounceRef.current = window.setTimeout(() => {
      void handleSearch(query)
    }, 600)

    return () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current)
      }
    }
  }, [query, selectedPlugins])

  useEffect(() => {
    const container = listScrollContainerRef.current
    const sentinel = loadMoreSentinelRef.current
    if (!container || !sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return
        setVisibleCount((current) => Math.min(current + 20, results.length))
      },
      { root: container, threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [results.length])

  const handleToggleResult = async (item: SearchResultItem) => {
    const isExpanded = expandedResultId === item.id
    if (isExpanded) {
      setExpandedResultId(null)
      return
    }

    setExpandedResultId(item.id)

    if (detailsByResultId[item.id] || loadingDetailsByResultId[item.id]) {
      return
    }

    setLoadingDetailsByResultId((current) => ({ ...current, [item.id]: true }))
    try {
      const details = await loadSearchResultDetails(item)
      setDetailsByResultId((current) => ({ ...current, [item.id]: details }))
    } finally {
      setLoadingDetailsByResultId((current) => ({ ...current, [item.id]: false }))
    }
  }

  const handleAddComic = async (item: SearchResultItem) => {
    setAddingByResultId((current) => ({ ...current, [item.id]: true }))
    try {
      await addSearchResultToDatabase(item, selectedPlugins)
      await queryClient.invalidateQueries({ queryKey: restQueryKeys.comics })
      await queryClient.invalidateQueries({ queryKey: ['rest', 'chapters'] })
    } finally {
      setAddingByResultId((current) => ({ ...current, [item.id]: false }))
    }
  }

  return (
    <div className="relative size-full overflow-hidden bg-transparent p-px">
      <LoadingOverlay isLoading={isSearching} message={t('searchContent.search.searching')} />
      <div className="absolute inset-x-0 top-0 z-20 grid gap-px bg-transparent px-6 pt-12">
        <div className="grid h-14 grid-cols-[minmax(0,1fr)_3rem] overflow-hidden bg-background/90 shadow-sm supports-backdrop-filter:backdrop-blur-sm">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchContent.search.placeholder')}
            className="h-full rounded-none border-0 bg-transparent pl-5 text-lg focus-visible:ring-0"
            autoFocus
          />
          <div className="flex items-center justify-center bg-background/80">
            <Search className="size-5 text-muted-foreground" />
          </div>
        </div>
        <div className="grid h-11 grid-cols-[auto_1fr] gap-px bg-transparent">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-full rounded-none bg-background/90 px-4 supports-backdrop-filter:backdrop-blur-sm"
              >
                {t('searchContent.plugins.title')} ({selectedPluginIds.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {plugins.map((plugin) => (
                <DropdownMenuCheckboxItem
                  key={plugin.id}
                  checked={selectedPluginIds.includes(plugin.id)}
                  onCheckedChange={() => handleTogglePlugin(plugin.id)}
                >
                  {plugin.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="bg-background/90 px-3 py-2 text-xs text-muted-foreground supports-backdrop-filter:backdrop-blur-sm">
            {t('searchContent.plugins.subtitle')}
          </div>
        </div>
      </div>

      <div ref={listScrollContainerRef} className="size-full overflow-y-auto bg-transparent pt-40 pb-4">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-px bg-transparent">
          {searchErrors.length > 0 && (
            <div className="bg-destructive/10 p-3 text-xs text-destructive">
              {searchErrors.map((error) => (
                <p key={`${error.pluginId}:${error.endpoint}`}>
                  {error.pluginName}: {error.message}
                </p>
              ))}
            </div>
          )}
          {renderedResults.map((item) => {
            const alreadyAdded = existingComicSourceKeySet.has(`${item.pluginTag}:${item.siteId}`)
            return (
              <SearchResultCard
                key={item.id}
                item={item}
                isExpanded={expandedResultId === item.id}
                onToggle={() => void handleToggleResult(item)}
                details={detailsByResultId[item.id]}
                isLoadingDetails={Boolean(loadingDetailsByResultId[item.id])}
                onAdd={(current) => void handleAddComic(current)}
                isAdding={Boolean(addingByResultId[item.id])}
                alreadyAdded={alreadyAdded}
                addLabel={t('searchContent.actions.add')}
                addingLabel={t('searchContent.actions.adding')}
                addedLabel={t('searchContent.actions.added')}
                chaptersLabel={t('searchContent.labels.chapters')}
              />
            )
          })}
          {!isSearching && results.length === 0 && (
            <div className="bg-background p-4 text-sm text-muted-foreground">{t('searchContent.empty')}</div>
          )}
          {results.length > renderedResults.length && (
            <div
              ref={loadMoreSentinelRef}
              className="bg-background p-3 text-center text-xs text-muted-foreground"
            >
              {t('searchContent.search.searching')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

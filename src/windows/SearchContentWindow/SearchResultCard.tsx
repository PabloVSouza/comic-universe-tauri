import { FC } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { logoIcon } from 'assets'
import { Badge } from 'components/ui/badge'
import { Button } from 'components/ui/button'
import { useTranslation } from 'react-i18next'
import { SearchResultDetails, SearchResultItem } from './pluginApi'

interface SearchResultCardProps {
  item: SearchResultItem
  isExpanded: boolean
  onToggle: () => void
  details?: SearchResultDetails
  isLoadingDetails: boolean
  onAdd: (item: SearchResultItem) => void
  isAdding: boolean
  addProgress?: number
  addProgressMessage?: string
  alreadyAdded: boolean
  addLabel: string
  addingLabel: string
  addedLabel: string
  chaptersLabel: string
}

export const SearchResultCard: FC<SearchResultCardProps> = ({
  item,
  isExpanded,
  onToggle,
  details,
  isLoadingDetails,
  onAdd,
  isAdding,
  addProgress,
  addProgressMessage,
  alreadyAdded,
  addLabel,
  addingLabel,
  addedLabel,
  chaptersLabel
}) => {
  const { t } = useTranslation()
  const cover = details?.cover || item.cover || logoIcon
  const description = details?.description || item.description || '-'
  const chapterCount = details?.chapterCount ?? item.chapterCount

  return (
    <article
      className={`relative flex flex-col-reverse overflow-hidden bg-background/90 transition-all duration-500 ease-in-out supports-backdrop-filter:backdrop-blur-sm sm:flex-row ${
        isExpanded
          ? 'min-h-[34rem] sm:h-96'
          : 'min-h-[23rem] cursor-pointer hover:bg-accent/35 sm:h-48'
      }`}
      onClick={!isExpanded ? onToggle : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col items-start justify-center px-4 py-3 text-left sm:items-center sm:text-center">
        <h3 className="w-full min-w-0 break-all text-xl leading-tight sm:truncate sm:text-2xl">
          {item.title}
        </h3>
        <p className="mt-1 w-full min-w-0 break-all text-xs text-muted-foreground sm:truncate">
          {item.sourceName || item.pluginName}
        </p>
        <div className="mt-2 flex w-full flex-wrap items-center gap-1 sm:justify-center">
          {item.languages.map((language) => (
            <Badge key={`${item.id}-${language}`} variant="outline" className="text-[10px]">
              {language}
            </Badge>
          ))}
          <Badge variant="outline" className="text-[10px]">
            {chaptersLabel}: {chapterCount ?? '-'}
          </Badge>
        </div>

        {isExpanded && (
          <>
            <div className="my-3 h-px w-full bg-border/60" />
            <div className="max-h-48 w-full min-w-0 overflow-auto sm:max-h-none">
              <p className="w-full min-w-0 whitespace-pre-wrap break-all text-sm text-foreground/85">
                {isLoadingDetails ? t('searchContent.search.loadingDetails') : description}
              </p>
            </div>
            <div className="mt-3 w-full sm:w-auto">
              <Button
                type="button"
                size="sm"
                disabled={alreadyAdded || isAdding || isLoadingDetails}
                onClick={() => onAdd(item)}
                className={`w-full sm:w-auto ${
                  alreadyAdded ? '' : 'bg-yellow-400 text-black hover:bg-yellow-500'
                }`}
              >
                {alreadyAdded
                  ? addedLabel
                  : isAdding
                  ? `${addingLabel} ${Math.max(0, Math.min(100, Math.round(addProgress ?? 0)))}%`
                  : addLabel}
              </Button>
              {isAdding ? (
                <div className="mt-2 w-full space-y-1 sm:max-w-48">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-yellow-400 transition-[width] duration-300"
                      style={{ width: `${Math.max(4, Math.min(100, Math.round(addProgress ?? 0)))}%` }}
                    />
                  </div>
                  <p className="min-w-0 whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                    {addProgressMessage || addingLabel}
                  </p>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      <img
        src={cover}
        alt={item.title}
        className="mx-auto mt-4 aspect-[10/16] h-56 w-auto shrink-0 rounded-sm object-cover sm:mx-0 sm:mt-0 sm:h-full"
        loading="lazy"
      />

      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-2 rounded-sm bg-background/70 p-1 hover:bg-background"
        aria-label={
          isExpanded ? t('searchContent.actions.collapseResult') : t('searchContent.actions.expandResult')
        }
      >
        {isExpanded ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
    </article>
  )
}

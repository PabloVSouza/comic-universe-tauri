import { FC } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { logoIcon } from 'assets'
import { Badge } from 'components/ui/badge'
import { Button } from 'components/ui/button'
import { SearchResultDetails, SearchResultItem } from './pluginApi'

interface SearchResultCardProps {
  item: SearchResultItem
  isExpanded: boolean
  onToggle: () => void
  details?: SearchResultDetails
  isLoadingDetails: boolean
  onAdd: (item: SearchResultItem) => void
  isAdding: boolean
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
  alreadyAdded,
  addLabel,
  addingLabel,
  addedLabel,
  chaptersLabel
}) => {
  const cover = details?.cover || item.cover || logoIcon
  const description = details?.description || item.description || '-'
  const chapterCount = details?.chapterCount ?? item.chapterCount

  return (
    <article
      className={`relative flex overflow-hidden bg-background/90 transition-all duration-500 ease-in-out supports-backdrop-filter:backdrop-blur-sm ${
        isExpanded ? 'h-96' : 'h-48 cursor-pointer hover:bg-accent/35'
      }`}
      onClick={!isExpanded ? onToggle : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-4 py-3 text-center">
        <h3 className="w-full truncate text-2xl">{item.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{item.sourceName || item.pluginName}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
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
            <p className="w-full overflow-auto text-sm text-foreground/85">
              {isLoadingDetails ? 'Carregando...' : description}
            </p>
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                disabled={alreadyAdded || isAdding || isLoadingDetails}
                onClick={() => onAdd(item)}
                className={alreadyAdded ? '' : 'bg-yellow-400 text-black hover:bg-yellow-500'}
              >
                {alreadyAdded ? addedLabel : isAdding ? addingLabel : addLabel}
              </Button>
            </div>
          </>
        )}
      </div>

      <img
        src={cover}
        alt={item.title}
        className="h-full w-auto shrink-0 object-cover aspect-[10/16]"
        loading="lazy"
      />

      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-2 rounded-sm bg-background/70 p-1 hover:bg-background"
        aria-label={isExpanded ? 'Collapse result' : 'Expand result'}
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

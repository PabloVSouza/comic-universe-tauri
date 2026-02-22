import { ComponentProps, FC, useEffect } from 'react'
import { BgBox } from 'components'
import { getComicCoverUrl, useListComicsQuery } from 'services'
import { cn } from 'utils'
import { LeftListItem } from './LeftListItem'

interface LeftListProps extends ComponentProps<'div'> {
  selectedComicId?: string | null
  onSelectComic?: (comicId: string) => void
}

export const LeftList: FC<LeftListProps> = ({
  className,
  selectedComicId,
  onSelectComic,
  ...props
}) => {
  const comicsQuery = useListComicsQuery()

  useEffect(() => {
    if (!selectedComicId && comicsQuery.data?.length) {
      onSelectComic?.(comicsQuery.data[0].id)
    }
  }, [selectedComicId, comicsQuery.data, onSelectComic])

  return (
    <BgBox className={cn('min-h-0 overflow-auto', className)} {...props}>
      <div className="divide-y divide-white/10">
        {(comicsQuery.data ?? []).map((comic) => {
          const comicName = (comic.data.name as string | undefined) || comic.id
          const coverUrl = getComicCoverUrl(comic.id)

          return (
            <LeftListItem
              key={comic.id}
              title={comicName}
              coverUrl={coverUrl}
              onClick={() => onSelectComic?.(comic.id)}
              active={comic.id === selectedComicId}
            />
          )
        })}
        {!comicsQuery.data?.length && (
          <div className="p-3 text-sm text-muted-foreground">No comics available.</div>
        )}
      </div>
    </BgBox>
  )
}

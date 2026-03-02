import { FC } from 'react'
import { Trash2 } from 'lucide-react'
import { logoIcon } from 'assets'
import { Avatar, AvatarFallback, AvatarImage } from 'components/ui/avatar'
import { Button } from 'components/ui/button'
import { cn } from 'utils'

interface LeftListItemProps {
  title: string
  coverUrl?: string
  progress?: string
  onClick?: () => void
  onRemove?: () => void
  removing?: boolean
  confirmRemove?: boolean
  active?: boolean
}

export const LeftListItem: FC<LeftListItemProps> = ({
  title,
  coverUrl,
  progress,
  onClick,
  onRemove,
  removing,
  confirmRemove,
  active
}) => {
  return (
    <div
      className={cn(
        'flex items-center gap-1 bg-background px-1',
        active ? 'bg-primary/35 ring-1 ring-primary/70 shadow-[0_0_18px_-8px_hsl(var(--primary))]' : ''
      )}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onClick}
        className={cn(
          'flex h-14 min-w-0 flex-1 items-center justify-start gap-3 rounded-none bg-transparent px-2 text-left text-sm hover:bg-accent/50',
          active ? 'text-foreground' : ''
        )}
      >
        <Avatar className="h-10 w-8 rounded-sm border border-white/10 bg-black/20">
          <AvatarImage src={coverUrl || logoIcon} alt={title} className="object-cover" />
          <AvatarFallback className="rounded-sm bg-black/35 text-[10px]">CU</AvatarFallback>
        </Avatar>
        <span className="truncate">{title}</span>
        {progress ? <span className="text-xs text-muted-foreground">{progress}</span> : null}
      </Button>
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={removing}
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          className={cn(
            'h-8 w-8 shrink-0 rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
            confirmRemove ? 'bg-destructive/10 text-destructive' : ''
          )}
          aria-label={`Remove ${title}`}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}

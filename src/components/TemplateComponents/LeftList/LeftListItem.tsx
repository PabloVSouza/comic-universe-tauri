import { FC } from 'react'
import { logoIcon } from 'assets'
import { Avatar, AvatarFallback, AvatarImage } from 'components/ui/avatar'
import { Button } from 'components/ui/button'
import { cn } from 'utils'

interface LeftListItemProps {
  title: string
  coverUrl?: string
  progress?: string
  onClick?: () => void
  active?: boolean
}

export const LeftListItem: FC<LeftListItemProps> = ({
  title,
  coverUrl,
  progress,
  onClick,
  active
}) => {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn(
        'flex h-14 w-full items-center justify-start gap-3 rounded-none bg-background px-2 text-left text-sm hover:bg-accent/50',
        active ? 'bg-primary/35 text-foreground ring-1 ring-primary/70 shadow-[0_0_18px_-8px_hsl(var(--primary))]' : ''
      )}
    >
      <Avatar className="h-10 w-8 rounded-sm border border-white/10 bg-black/20">
        <AvatarImage src={coverUrl || logoIcon} alt={title} className="object-cover" />
        <AvatarFallback className="rounded-sm bg-black/35 text-[10px]">CU</AvatarFallback>
      </Avatar>
      <span className="truncate">{title}</span>
      {progress ? <span className="text-xs text-muted-foreground">{progress}</span> : null}
    </Button>
  )
}

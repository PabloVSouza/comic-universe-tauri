import { FC } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from 'components/ui/avatar'

interface AppMenuHeaderProps {
  profileName: string
  profileEmail: string
  avatarFallback: string
}

export const AppMenuHeader: FC<AppMenuHeaderProps> = ({
  profileName,
  profileEmail,
  avatarFallback
}) => {
  return (
    <div className="relative h-[calc(4rem+var(--cu-safe-top,0px))] bg-background">
      <div className="absolute inset-x-0 bottom-0 flex h-16 items-center gap-3 px-3.5">
        <Avatar className="size-9 border border-border/50 bg-background">
          <AvatarImage src={undefined} alt={profileName} />
          <AvatarFallback className="bg-background text-xs font-semibold text-foreground">
            {avatarFallback}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <p className="truncate text-sm font-light leading-tight text-foreground">{profileName}</p>
          <p className="truncate text-xs font-light leading-tight text-foreground/65">{profileEmail}</p>
        </div>
      </div>
    </div>
  )
}

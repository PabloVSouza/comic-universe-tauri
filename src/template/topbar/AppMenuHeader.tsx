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
    <div className="flex h-16 items-center gap-3 border-b border-black/10 bg-white/35 px-3.5">
      <Avatar className="size-9 border border-black/10 bg-white/70">
        <AvatarImage src={undefined} alt={profileName} />
        <AvatarFallback className="bg-white/60 text-xs font-semibold text-foreground">
          {avatarFallback}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0">
        <p className="truncate text-sm font-light leading-tight text-foreground">{profileName}</p>
        <p className="truncate text-xs font-light leading-tight text-foreground/65">{profileEmail}</p>
      </div>
    </div>
  )
}

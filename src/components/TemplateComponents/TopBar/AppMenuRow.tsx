import { FC, ReactNode } from 'react'

interface AppMenuRowProps {
  icon: ReactNode
  label: string
  withBorder?: boolean
  onClick?: () => void
}

export const AppMenuRow: FC<AppMenuRowProps> = ({
  icon,
  label,
  withBorder = true,
  onClick
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex h-12 w-full items-center gap-3 bg-background px-3.5 text-left text-foreground/80 hover:bg-muted/60',
        withBorder ? 'border-b border-border/50' : ''
      ].join(' ')}
    >
      {icon}
      <span className="truncate whitespace-nowrap text-[15px] leading-none tracking-[-0.01em] font-light">
        {label}
      </span>
    </button>
  )
}

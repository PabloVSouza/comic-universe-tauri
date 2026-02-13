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
        'flex h-12 w-full items-center gap-3 px-3.5 text-left text-foreground/80 hover:bg-black/6',
        withBorder ? 'border-b border-black/10' : ''
      ].join(' ')}
    >
      {icon}
      <span className="truncate whitespace-nowrap text-[15px] leading-none tracking-[-0.01em] font-light">
        {label}
      </span>
    </button>
  )
}

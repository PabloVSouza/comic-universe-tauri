import { ComponentProps, FC, ReactNode } from 'react'
import { Button } from 'components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'

interface IconTooltipButtonProps
  extends Omit<ComponentProps<typeof Button>, 'size' | 'variant' | 'children'> {
  label: string
  icon: ReactNode
  iconClassName?: string
}

export const IconTooltipButton: FC<IconTooltipButtonProps> = ({
  label,
  icon,
  iconClassName = 'size-4',
  className = 'h-8 w-8 transition-colors hover:bg-accent/70',
  ...buttonProps
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className={className}
          aria-label={label}
          {...buttonProps}
        >
          <span className={`inline-flex items-center justify-center ${iconClassName}`}>{icon}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

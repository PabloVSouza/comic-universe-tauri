import { BgBox } from 'components'
import { ComponentProps, FC } from 'react'
import { cn } from 'utils'

interface LeftNavProps extends ComponentProps<'div'> {}

export const LeftNav: FC<LeftNavProps> = ({ className, ...props }) => {
  return (
    <BgBox
      className={cn('flex h-14 items-center justify-between px-3 sm:px-4', className)}
      {...props}
    >
      <p className="text-sm text-muted-foreground">Library</p>
    </BgBox>
  )
}

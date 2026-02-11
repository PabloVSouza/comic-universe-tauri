import { BgBox } from 'components'
import { ComponentProps, FC } from 'react'
import { cn } from 'utils'

export const LeftNav: FC<ComponentProps<'div'>> = ({ className, ...props }) => {
  return (
    <BgBox className={cn('flex h-14 items-center px-4', className)} {...props}>
      <p>LeftNav</p>
    </BgBox>
  )
}

import { FC, ComponentProps } from 'react'
import { BgBox } from 'components'
import { cn } from 'utils'

export const TopBar: FC<ComponentProps<'div'>> = ({ className, ...props }) => {
  return (
    <BgBox className={cn('flex h-14 items-center px-4', className)} {...props}>
      <p>TopBar</p>
    </BgBox>
  )
}

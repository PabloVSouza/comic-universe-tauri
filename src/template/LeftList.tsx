import { BgBox } from 'components'
import { ComponentProps, FC } from 'react'
import { cn } from 'utils'

export const LeftList: FC<ComponentProps<'div'>> = ({ className, ...props }) => {
  return (
    <BgBox className={cn('min-h-0 overflow-auto p-4', className)} {...props}>
      <p>LeftList</p>
    </BgBox>
  )
}

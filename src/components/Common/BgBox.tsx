import { ComponentProps, FC } from 'react'
import { cn } from 'utils'

type BgBoxProps = ComponentProps<'div'>

export const BgBox: FC<BgBoxProps> = ({ children, className, ...props }) => {
  return (
    <div {...props} className={cn('bg-background', className)}>
      {children}
    </div>
  )
}

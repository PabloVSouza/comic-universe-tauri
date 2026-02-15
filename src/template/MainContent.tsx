import { MainContent as MainContentView } from 'components'
import { ComponentProps, FC } from 'react'

interface MainContentProps extends ComponentProps<'div'> {
  selectedComicId?: string | null
}

export const MainContent: FC<MainContentProps> = ({
  className,
  selectedComicId,
  ...props
}) => {
  return (
    <MainContentView
      className={className}
      selectedComicId={selectedComicId}
      {...props}
    />
  )
}

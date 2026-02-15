import { FC } from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import { Home, Reader } from 'template'

const Router: FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/reader/:comicId/:chapterId" element={<Reader />} />
      <Route path="/reader/:comicId" element={<Reader />} />
      <Route path="/*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default Router

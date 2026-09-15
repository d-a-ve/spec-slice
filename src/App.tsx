import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ExtractorPage } from './features/extractor/ExtractorPage'
import { LandingPage } from './features/landing/LandingPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<ExtractorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

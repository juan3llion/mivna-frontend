import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './hooks/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { DiagramViewer } from './pages/DiagramViewer'
import { ReadmeViewer } from './pages/ReadmeViewer'
import './index.css'

function App() {
  return (
    <ErrorBoundary>
      {/* Animated Mesh Gradient Background */}
      <div className="mesh-gradient">
        <div className="gradient-blob blob-blue"></div>
        <div className="gradient-blob blob-green"></div>
        <div className="gradient-blob blob-purple"></div>
      </div>

      <Toaster position="top-right" />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/repository/:id"
              element={
                <ProtectedRoute>
                  <DiagramViewer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/repository/:id/readme"
              element={
                <ProtectedRoute>
                  <ReadmeViewer />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App

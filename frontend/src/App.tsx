import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { usePermissions } from './lib/usePermissions'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ECRPage from './pages/ECRPage'
import ECNPage from './pages/ECNPage'
import BOMPage from './pages/BOMPage'
import ApprovalsPage from './pages/ApprovalsPage'
import AuditPage from './pages/AuditPage'
import AIPage from './pages/AIPage'
import UsersPage from './pages/UsersPage'
import GovernancePage from './pages/GovernancePage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0c10' }}>
      <div className="spinner" style={{ width: 24, height: 24 }} />
    </div>
  )
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function RoleRoute({ children, allowed }: { children: React.ReactNode; allowed: string[] }) {
  const { user } = useAuth()
  const role = user?.role || 'viewer'
  if (role === 'admin' || allowed.includes(role)) return <>{children}</>
  return <Navigate to="/?access_denied=1" replace />
}

function ViewerBlockedRoute({ children }: { children: React.ReactNode }) {
  const { isViewer } = usePermissions()
  if (isViewer) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Access Restricted</div>
        <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>
          Your <strong style={{ color: 'var(--accent)' }}>Viewer</strong> role does not have access to this page.
          <br />Contact an admin to request a role upgrade.
        </div>
      </div>
    )
  }
  return <>{children}</>
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="ecr" element={<ECRPage />} />
        <Route path="ecn" element={<ECNPage />} />
        <Route path="bom" element={<BOMPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="ai" element={<AIPage />} />
        <Route path="audit" element={<ViewerBlockedRoute><AuditPage /></ViewerBlockedRoute>} />
        <Route path="users" element={<RoleRoute allowed={['admin', 'manager']}><UsersPage /></RoleRoute>} />
        <Route path="governance" element={<ViewerBlockedRoute><GovernancePage /></ViewerBlockedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

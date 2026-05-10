import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../lib/usePermissions'
import {
  LayoutDashboard, FileText, ClipboardList, Package, CheckSquare,
  Shield, Brain, Users, LogOut, Eye, ShieldCheck
} from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin, isManager, isViewer } = usePermissions()

  const initials =
    user?.full_name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'

  // Role badge color
  const roleBadgeColor: Record<string, string> = {
    admin: '#ef4444',
    manager: '#f59e0b',
    senior_engineer: '#0d6efd',
    engineer: '#00d4aa',
    approver: '#22c55e',
    viewer: '#8899b0',
  }

  const roleColor =
    roleBadgeColor[user?.role || 'viewer'] || '#8899b0'

  // Build nav dynamically based on role
  const navGroups = [
    {
      group: 'Overview',
      items: [
        {
          path: '/',
          label: 'Dashboard',
          icon: LayoutDashboard,
          show: true,
        },
      ],
    },
    {
      group: 'Change Management',
      items: [
        {
          path: '/ecr',
          label: 'ECR Management',
          icon: FileText,
          show: true,
        },
        {
          path: '/ecn',
          label: 'ECN Workflow',
          icon: ClipboardList,
          show: true,
        },
      ],
    },
    {
      group: 'Product Structure',
      items: [
        {
          path: '/bom',
          label: 'BOM Viewer',
          icon: Package,
          show: true,
        },
        {
          path: '/approvals',
          label: 'Approvals',
          icon: CheckSquare,
          show: true,
        },
      ],
    },
    {
      group: 'Intelligence',
      items: [
        {
          path: '/ai',
          label: 'AI Analysis',
          icon: Brain,
          show: true,
        },
      ],
    },
    {
      group: 'Compliance',
      items: [
        { path: '/audit', label: 'Audit Logs', icon: Shield, show: !isViewer },
        { path: '/governance', label: 'Governance', icon: ShieldCheck, show: !isViewer },
      ],
    },
    {
      group: 'Administration',
      items: [
        {
          path: '/users',
          label: 'Users',
          icon: Users,
          show: isAdmin || isManager,
        },
      ],
    },
  ]

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 240,
          minWidth: 240,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '20px 16px 12px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                background: 'var(--accent)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
                fontFamily: 'IBM Plex Mono',
                letterSpacing: 1,
              }}
            >
              ECM
            </div>

            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            >
              ECM System
            </span>
          </div>

          <div
            style={{
              fontSize: 9,
              color: 'var(--text-muted)',
              fontFamily: 'IBM Plex Mono',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              paddingLeft: 36,
            }}
          >
            v2.0 · Enterprise
          </div>
        </div>

        {/* Viewer read-only banner */}
        {isViewer && (
          <div
            style={{
              margin: '8px 8px 0',
              background: 'rgba(136,153,176,0.1)',
              border: '1px solid rgba(136,153,176,0.3)',
              borderRadius: 6,
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Eye
              size={11}
              style={{
                color: '#8899b0',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: '#8899b0',
              }}
            >
              Read-only access
            </span>
          </div>
        )}

        {/* Nav */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 8px',
          }}
        >
          {navGroups.map(group => {
            const visibleItems = group.items.filter(i => i.show)

            if (visibleItems.length === 0) return null

            return (
              <div
                key={group.group}
                style={{ marginBottom: 4 }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    padding: '8px 8px 4px',
                    fontFamily: 'IBM Plex Mono',
                  }}
                >
                  {group.group}
                </div>

                {visibleItems.map(item => {
                  const isActive =
                    item.path === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.path)

                  const Icon = item.icon

                  return (
                    <div
                      key={item.path}
                      className={`nav-item ${
                        isActive ? 'active' : ''
                      }`}
                      onClick={() => navigate(item.path)}
                    >
                      <Icon
                        size={16}
                        style={{
                          opacity: isActive ? 1 : 0.7,
                          flexShrink: 0,
                        }}
                      />

                      <span style={{ flex: 1 }}>
                        {item.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* User card */}
        <div
          style={{
            padding: '12px 8px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              borderRadius: 6,
              background: 'var(--bg-elevated)',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                background: roleColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {initials}
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.full_name}
              </div>

              <div
                style={{
                  fontSize: 9,
                  fontFamily: 'IBM Plex Mono',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: roleColor,
                  fontWeight: 600,
                }}
              >
                {user?.role?.replace('_', ' ')}
              </div>
            </div>

            <div
              onClick={logout}
              title="Sign out"
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <LogOut
                size={14}
                style={{
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Outlet />
      </div>
    </div>
  )
}
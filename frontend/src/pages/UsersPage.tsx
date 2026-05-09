import { useEffect, useState } from 'react'
import { usersApi } from '../lib/api'
import { formatDate } from '../lib/utils'
import { Users, Shield } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  admin: 'badge-red',
  manager: 'badge-amber',
  senior_engineer: 'badge-blue',
  engineer: 'badge-teal',
  approver: 'badge-green',
  viewer: 'badge-gray',
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    usersApi.list().then(r => setUsers(r.data)).catch(console.error).finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>User Management</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Role-Based Access Control</div>
        </div>
      </div>

      <div className="page-content">
        {/* Role Legend */}
        <div style={{ marginBottom: 16 }}>
          <div className="section-title">Role Hierarchy</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(ROLE_COLORS).map(([role, cls]) => (
              <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px' }}>
                <Shield size={12} style={{ color: 'var(--text-muted)' }} />
                <span className={`badge ${cls}`}>{role.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="section-title">System Users ({users.length})</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Username</th><th>Full Name</th><th>Email</th>
                <th>Role</th><th>Department</th><th>Status</th><th>Last Login</th><th>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
              ) : users.map(user => (
                <tr key={user.id}>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)' }}>{user.id}</td>
                  <td><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--accent)' }}>{user.username}</span></td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{user.full_name}</td>
                  <td style={{ fontSize: 11 }}>{user.email}</td>
                  <td><span className={`badge ${ROLE_COLORS[user.role] || 'badge-gray'}`}>{user.role.replace('_', ' ')}</span></td>
                  <td style={{ fontSize: 11 }}>{user.department || '—'}</td>
                  <td>
                    <span className={`badge ${user.is_active ? 'badge-green' : 'badge-red'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{formatDate(user.last_login)}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{formatDate(user.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

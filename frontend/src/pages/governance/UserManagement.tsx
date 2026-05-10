import { useEffect, useState } from 'react'
import { governanceApi } from '../../lib/api'
import { usePermissions } from '../../lib/usePermissions'
import { UserPlus, ToggleLeft, ToggleRight, Loader2, X } from 'lucide-react'
import { formatDate } from '../../lib/utils'

const ROLES = ['admin', 'manager', 'senior_engineer', 'approver', 'engineer', 'viewer']
const ROLE_COLORS: Record<string, string> = { admin: '#ef4444', manager: '#f59e0b', senior_engineer: '#0d6efd', engineer: '#00d4aa', approver: '#22c55e', viewer: '#8899b0' }
const DEPARTMENTS = ['Engineering', 'Quality', 'Procurement', 'Management', 'IT', 'Manufacturing', 'R&D']

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', full_name: '', password: 'changeme123', role: 'engineer', department: 'Engineering', phone: '' })
  const { isAdmin } = usePermissions()

  const load = () => { setLoading(true); governanceApi.listUsersGovernance().then(r => setUsers(r.data)).catch(console.error).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const createUser = async () => {
    setSaving(true)
    try { await governanceApi.createUser(form); setShowCreate(false); setForm({ username: '', email: '', full_name: '', password: 'changeme123', role: 'engineer', department: 'Engineering', phone: '' }); load() }
    catch (e: any) { alert(e.response?.data?.detail || 'Create failed') } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Manage user accounts, roles, and access permissions.</div>
        {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>{showCreate ? <X size={12} /> : <UserPlus size={12} />} {showCreate ? 'Cancel' : 'Create User'}</button>}
      </div>

      {showCreate && isAdmin && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Create New User</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
            <div><label className="form-label">Full Name *</label><input className="form-control" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><label className="form-label">Username *</label><input className="form-control" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></div>
            <div><label className="form-label">Email *</label><input className="form-control" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="form-label">Role</label><select className="form-control" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
            <div><label className="form-label">Department</label><select className="form-control" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label className="form-label">Password</label><input className="form-control" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
          </div>
          <button className="btn btn-primary" onClick={createUser} disabled={saving}>{saving ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} Create User</button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
              : users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: ROLE_COLORS[u.role] || '#8899b0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{u.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</div>
                      <div><div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{u.full_name}</div><div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{u.username}</div></div>
                    </div>
                  </td>
                  <td style={{ fontSize: 11 }}>{u.email}</td>
                  <td>
                    {isAdmin ? (
                      <select className="form-control" style={{ height: 26, fontSize: 11, padding: '0 6px', width: 130, color: ROLE_COLORS[u.role] || 'var(--text-primary)' }} value={u.role} onChange={e => governanceApi.changeUserRole(u.id, e.target.value).then(load)}>
                        {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                      </select>
                    ) : <span style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', fontWeight: 700, color: ROLE_COLORS[u.role] || 'var(--text-muted)' }}>{u.role.replace('_', ' ').toUpperCase()}</span>}
                  </td>
                  <td style={{ fontSize: 11 }}>{u.department || '—'}</td>
                  <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}>{formatDate(u.last_login)}</td>
                  <td>{isAdmin && <button className={`btn btn-sm ${u.is_active ? 'btn-ghost' : 'btn-success'}`} onClick={() => governanceApi.toggleUserActive(u.id).then(load)}>{u.is_active ? <ToggleRight size={12} style={{ color: 'var(--success)' }} /> : <ToggleLeft size={12} />}</button>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

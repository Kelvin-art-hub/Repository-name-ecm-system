import { useEffect, useState } from 'react'
import { governanceApi } from '../../lib/api'
import { formatDateTime } from '../../lib/utils'
import { Download } from 'lucide-react'

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'LOCK', 'UNLOCK', 'SUBMIT', 'GENERATE_ECN', 'ROLE_CHANGE', 'ACTIVATE', 'DEACTIVATE', 'LOGIN_FAILED', 'CREATE_USER']
const ENTITIES = ['ECR', 'ECN', 'BOMItem', 'Approval', 'User', 'GovernancePolicy', 'PolicyViolation']
const ACTION_COLORS: Record<string, string> = { CREATE: '#0d6efd', UPDATE: '#f59e0b', DELETE: '#ef4444', APPROVE: '#22c55e', REJECT: '#ef4444', LOGIN: '#00d4aa', LOGOUT: '#8899b0', LOCK: '#a855f7', UNLOCK: '#00d4aa', SUBMIT: '#0d6efd', GENERATE_ECN: '#00d4aa', ROLE_CHANGE: '#f59e0b', ACTIVATE: '#22c55e', DEACTIVATE: '#ef4444' }
const LIMIT = 50

export default function AuditTrail() {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ action: '', entity_type: '', username: '', date_from: '', date_to: '' })
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    const params: any = { skip: page * LIMIT, limit: LIMIT }
    if (filters.action) params.action = filters.action
    if (filters.entity_type) params.entity_type = filters.entity_type
    if (filters.username) params.username = filters.username
    if (filters.date_from) params.date_from = filters.date_from
    if (filters.date_to) params.date_to = filters.date_to
    governanceApi.auditTrail(params).then(r => { setLogs(r.data.logs); setTotal(r.data.total) }).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [page, filters])

  const exportCSV = () => {
    const headers = ['ID', 'Action', 'Entity', 'Entity ID', 'Username', 'Details', 'IP', 'Timestamp']
    const rows = logs.map(l => [l.id, l.action, l.entity_type, l.entity_id, l.username, `"${l.details}"`, l.ip_address, l.timestamp])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'audit_trail.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: 8, marginBottom: 14, alignItems: 'end' }}>
        <div><label className="form-label">Action</label><select className="form-control" style={{ height: 34 }} value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })}><option value="">All Actions</option>{ACTIONS.map(a => <option key={a}>{a}</option>)}</select></div>
        <div><label className="form-label">Entity Type</label><select className="form-control" style={{ height: 34 }} value={filters.entity_type} onChange={e => setFilters({ ...filters, entity_type: e.target.value })}><option value="">All Entities</option>{ENTITIES.map(e => <option key={e}>{e}</option>)}</select></div>
        <div><label className="form-label">Username</label><input className="form-control" style={{ height: 34 }} value={filters.username} onChange={e => setFilters({ ...filters, username: e.target.value })} placeholder="Filter by user..." /></div>
        <div><label className="form-label">From Date</label><input className="form-control" style={{ height: 34 }} type="datetime-local" value={filters.date_from} onChange={e => setFilters({ ...filters, date_from: e.target.value })} /></div>
        <div><label className="form-label">To Date</label><input className="form-control" style={{ height: 34 }} type="datetime-local" value={filters.date_to} onChange={e => setFilters({ ...filters, date_to: e.target.value })} /></div>
        <button className="btn btn-ghost btn-sm" onClick={exportCSV} style={{ height: 34 }}><Download size={12} /> CSV</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{total} total records · Page {page + 1} of {Math.ceil(total / LIMIT) || 1}</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Action</th><th>Entity</th><th>User</th><th>Details</th><th>IP</th><th>Timestamp</th><th>Diff</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
              : logs.map(log => (
                <>
                  <tr key={log.id} style={{ cursor: (log.old_values || log.new_values) ? 'pointer' : 'default' }} onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)' }}>{log.id}</td>
                    <td><span style={{ color: ACTION_COLORS[log.action] || 'var(--text-secondary)', fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 600 }}>{log.action}</span></td>
                    <td><span className="badge badge-gray">{log.entity_type}</span></td>
                    <td><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--accent)' }}>{log.username}</span></td>
                    <td style={{ fontSize: 11, maxWidth: 280 }}>{log.details}</td>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)' }}>{log.ip_address}</td>
                    <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(log.timestamp)}</td>
                    <td>{(log.old_values || log.new_values) && <span style={{ fontSize: 10, color: 'var(--accent)', cursor: 'pointer' }}>{expanded === log.id ? '▲' : '▼'} diff</span>}</td>
                  </tr>
                  {expanded === log.id && (log.old_values || log.new_values) && (
                    <tr key={`${log.id}-diff`}>
                      <td colSpan={8} style={{ background: 'var(--bg-elevated)', padding: '10px 14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {log.old_values && <div><div style={{ fontSize: 9, color: '#ef4444', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Before</div><pre style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(log.old_values, null, 2)}</pre></div>}
                          {log.new_values && <div><div style={{ fontSize: 9, color: '#22c55e', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>After</div><pre style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(log.new_values, null, 2)}</pre></div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
        <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>Page {page + 1} / {Math.ceil(total / LIMIT) || 1}</span>
        <button className="btn btn-ghost btn-sm" disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  )
}

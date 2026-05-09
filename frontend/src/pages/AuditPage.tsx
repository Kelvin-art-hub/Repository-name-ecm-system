import { useEffect, useState } from 'react'
import { auditApi } from '../lib/api'
import { formatDateTime, getActionColor } from '../lib/utils'
import { Search, BarChart2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [showStats, setShowStats] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filterAction) params.action = filterAction
      if (filterEntity) params.entity_type = filterEntity
      if (filterUser) params.username = filterUser
      const [logsRes, statsRes] = await Promise.all([auditApi.list(params), auditApi.stats()])
      setLogs(logsRes.data)
      setStats(statsRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filterAction, filterEntity])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load() }

  const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'LOCK', 'UNLOCK', 'SUBMIT', 'GENERATE_ECN']
  const ENTITIES = ['ECR', 'ECN', 'BOMItem', 'Approval', 'User']

  const actionChartData = stats ? Object.entries(stats.action_distribution || {}).map(([name, value]) => ({ name, value })) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Audit Logs</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Complete Activity Trail</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm ${showStats ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowStats(!showStats)}>
            <BarChart2 size={12} /> Analytics
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Stats */}
        {showStats && stats && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
              <div className="kpi-card blue">
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Total Logs</div>
                <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'IBM Plex Mono' }}>{stats.total_logs}</div>
              </div>
              {stats.top_users?.slice(0, 3).map(([user, count]: [string, number]) => (
                <div key={user} className="kpi-card teal">
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Top User</div>
                  <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'IBM Plex Mono' }}>{count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{user}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ height: 180 }}>
              <div className="section-title" style={{ marginBottom: 8 }}>Action Distribution</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={actionChartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {actionChartData.map((entry, i) => (
                      <rect key={i} fill={getActionColor(entry.name)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-control" style={{ paddingLeft: 30, width: 180 }} value={filterUser} onChange={e => setFilterUser(e.target.value)} placeholder="Filter by user..." />
            </div>
            <button type="submit" className="btn btn-ghost btn-sm"><Search size={12} /></button>
          </form>
          <select className="form-control" style={{ width: 140, height: 34 }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
            <option value="">All Actions</option>
            {ACTIONS.map(a => <option key={a}>{a}</option>)}
          </select>
          <select className="form-control" style={{ width: 130, height: 34 }} value={filterEntity} onChange={e => setFilterEntity(e.target.value)}>
            <option value="">All Entities</option>
            {ENTITIES.map(e => <option key={e}>{e}</option>)}
          </select>
        </div>

        {/* Logs Table */}
        <div className="section-title">Audit Trail ({logs.length} entries)</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Action</th><th>Entity</th><th>Entity ID</th>
                <th>User</th><th>Details</th><th>IP Address</th><th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No audit logs found</td></tr>
              ) : logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)' }}>{log.id}</td>
                  <td>
                    <span style={{ color: getActionColor(log.action), fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 600 }}>
                      {log.action}
                    </span>
                  </td>
                  <td><span className="badge badge-gray">{log.entity_type}</span></td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{log.entity_id || '—'}</td>
                  <td>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--accent)' }}>{log.username}</span>
                  </td>
                  <td style={{ fontSize: 11, maxWidth: 300 }}>{log.details}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)' }}>{log.ip_address}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(log.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { governanceApi } from '../../lib/api'
import { usePermissions } from '../../lib/usePermissions'
import { CheckCircle, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#0d6efd', '#00d4aa', '#a855f7']

export default function ComplianceReport() {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [violations, setViolations] = useState<any[]>([])
  const [resolving, setResolving] = useState<number | null>(null)
  const { isAdmin, isManager } = usePermissions()

  const load = () => {
    setLoading(true)
    Promise.all([governanceApi.complianceReport(days), governanceApi.listViolations({ resolution: 'pending', limit: 20 })])
      .then(([r, v]) => { setReport(r.data); setViolations(v.data) }).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [days])

  const resolveViolation = async (id: number, resolution: string) => {
    setResolving(id)
    try { await governanceApi.resolveViolation(id, { resolution, resolution_note: `Resolved as ${resolution}` }); load() }
    catch (e) { console.error(e) } finally { setResolving(null) }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 24, height: 24 }} /></div>
  if (!report) return null

  const { summary, ecr_by_type, violations_by_category, high_risk_ecrs } = report
  const typeData = Object.entries(ecr_by_type || {}).map(([name, value]) => ({ name, value }))
  const catData = Object.entries(violations_by_category || {}).map(([name, value]) => ({ name, value }))
  const scoreColor = summary.compliance_score >= 80 ? '#22c55e' : summary.compliance_score >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Report period:</span>
        {[7, 30, 90, 365].map(d => <button key={d} className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDays(d)}>{d === 365 ? '1 Year' : `${d} Days`}</button>)}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Generated: {new Date(report.generated_at).toLocaleString()}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <div className="kpi-card" style={{ borderTop: `2px solid ${scoreColor}` }}><div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Compliance Score</div><div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'IBM Plex Mono', color: scoreColor }}>{summary.compliance_score}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>/ 100</div></div>
        <div className="kpi-card blue"><div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Approval Rate</div><div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--accent)' }}>{summary.approval_rate_pct}%</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{summary.approved} / {summary.total_ecrs} ECRs</div></div>
        <div className="kpi-card teal"><div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>SLA Compliance</div><div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--teal)' }}>{summary.sla_compliance_pct}%</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Approvals on time</div></div>
        <div className="kpi-card red"><div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Open Violations</div><div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--danger)' }}>{summary.open_violations}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{summary.total_violations} total</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div><div className="section-title">ECRs by Change Type</div><div className="card" style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={typeData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}><XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} /><YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} /><Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} /><Bar dataKey="value" fill="var(--accent)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div><div className="section-title">Violations by Category</div><div className="card" style={{ height: 200 }}>{catData.length === 0 ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12 }}><CheckCircle size={14} style={{ marginRight: 6, color: 'var(--success)' }} />No violations</div> : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={catData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>{catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} /></PieChart></ResponsiveContainer>}</div></div>
      </div>

      {violations.length > 0 && (
        <div>
          <div className="section-title">Open Policy Violations — Requires Action</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Policy</th><th>Entity</th><th>Triggered By</th><th>Severity</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {violations.map((v: any) => (
                  <tr key={v.id}>
                    <td style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 500 }}>{v.policy_name}</td>
                    <td><span className="badge badge-gray">{v.entity_type}</span></td>
                    <td style={{ fontSize: 11 }}>{v.triggered_by}</td>
                    <td><span className={`badge ${v.policy_severity === 'error' ? 'badge-red' : 'badge-amber'}`}>{v.policy_severity}</span></td>
                    <td style={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}>{new Date(v.created_at).toLocaleDateString()}</td>
                    <td>{(isAdmin || isManager) && <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-success btn-sm" disabled={resolving === v.id} onClick={() => resolveViolation(v.id, 'resolved')}>{resolving === v.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />} Resolve</button>
                      <button className="btn btn-ghost btn-sm" disabled={resolving === v.id} onClick={() => resolveViolation(v.id, 'overridden')}>Override</button>
                    </div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { governanceApi } from '../../lib/api'
import { Clock, CheckCircle } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function GovDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    governanceApi.dashboard().then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 24, height: 24 }} /></div>
  if (!data) return null

  const { kpis, ecr_trend, approval_bottlenecks, recent_violations, overdue_approvals_detail, compliance_breakdown } = data
  const scoreColor = compliance_breakdown.score >= 80 ? '#22c55e' : compliance_breakdown.score >= 60 ? '#f59e0b' : '#ef4444'
  const scoreLabel = compliance_breakdown.status === 'good' ? 'COMPLIANT' : compliance_breakdown.status === 'warning' ? 'AT RISK' : 'NON-COMPLIANT'

  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: `linear-gradient(135deg, ${scoreColor}18, ${scoreColor}08)`, border: `1px solid ${scoreColor}40`, borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', border: `3px solid ${scoreColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'IBM Plex Mono', color: scoreColor }}>{compliance_breakdown.score}</div>
          <div style={{ fontSize: 8, color: scoreColor, fontFamily: 'IBM Plex Mono' }}>/100</div>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: scoreColor }}>{scoreLabel}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Governance Compliance Score — {compliance_breakdown.open_violations} open violations, {compliance_breakdown.overdue_approvals} overdue approvals</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          {[{ label: 'Open Violations', value: kpis.open_violations, color: '#ef4444' }, { label: 'Overdue Approvals', value: kpis.overdue_approvals, color: '#f59e0b' }, { label: 'Failed Logins 24h', value: kpis.failed_logins_24h, color: '#8899b0' }].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'IBM Plex Mono', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[{ label: 'Total ECRs', value: kpis.total_ecrs, color: 'blue' }, { label: 'Pending Approvals', value: kpis.pending_approvals, color: 'amber' }, { label: 'High Risk ECRs', value: kpis.high_risk_ecrs, color: 'red' }, { label: 'Avg Approval Time', value: `${kpis.avg_approval_hours}h`, color: 'teal' }].map(k => (
          <div key={k.label} className={`kpi-card ${k.color}`}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'IBM Plex Mono', lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <div className="section-title">ECR Activity — Last 7 Days</div>
          <div className="card" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ecr_trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs><linearGradient id="ecrGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0d6efd" stopOpacity={0.3} /><stop offset="95%" stopColor="#0d6efd" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} />
                <Area type="monotone" dataKey="count" stroke="#0d6efd" fill="url(#ecrGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <div className="section-title">Approval Bottlenecks</div>
          <div className="card" style={{ height: 180 }}>
            {approval_bottlenecks.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12 }}><CheckCircle size={14} style={{ marginRight: 6, color: 'var(--success)' }} />No bottlenecks</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={approval_bottlenecks} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={120} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} />
                  <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div className="section-title">Recent Policy Violations</div>
          <div className="card" style={{ padding: 0 }}>
            {recent_violations.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}><CheckCircle size={14} style={{ marginRight: 6, color: 'var(--success)' }} />No violations</div>
            ) : recent_violations.map((v: any) => (
              <div key={v.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: v.severity === 'error' ? '#ef4444' : '#f59e0b' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{v.policy_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{v.entity_type} · {v.triggered_by}</div>
                </div>
                <span className={`badge ${v.resolution === 'pending' ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: 9 }}>{v.resolution}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="section-title">Overdue Approvals</div>
          <div className="card" style={{ padding: 0 }}>
            {overdue_approvals_detail.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}><CheckCircle size={14} style={{ marginRight: 6, color: 'var(--success)' }} />All on time</div>
            ) : overdue_approvals_detail.map((a: any) => (
              <div key={a.approval_id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{a.ecr_number}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.stage} · {a.approver}</div>
                </div>
                <span style={{ fontSize: 11, color: '#ef4444', fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>+{a.hours_overdue}h</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

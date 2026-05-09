import { useEffect, useState } from 'react'
import { dashboardApi } from '../lib/api'
import { formatDate, timeAgo, getPriorityBadge, getStatusBadge, getRiskColor, getRiskLabel, getActionColor } from '../lib/utils'
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle, Package, Users, FileText, Brain } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#0d6efd', '#f59e0b', '#22c55e', '#ef4444', '#00d4aa', '#a855f7']

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null)
  const [aiData, setAiData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [s, a] = await Promise.all([dashboardApi.getStats(), dashboardApi.getAIAnalysis()])
      setStats(s.data)
      setAiData(a.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const kpis = stats?.kpis || {}
  const statusData = Object.entries(stats?.ecr_by_status || {}).map(([name, value]) => ({ name, value }))
  const priorityData = Object.entries(stats?.ecr_by_priority || {}).map(([name, value]) => ({ name, value }))
  const typeData = Object.entries(stats?.ecr_by_type || {}).map(([name, value]) => ({ name, value }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar */}
      <div className="topbar">
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Dashboard</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main content */}
        <div className="page-content" style={{ flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div style={{ marginBottom: 20 }}>
                <div className="section-title">System KPIs</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <KPICard label="Open ECRs" value={kpis.open_ecrs ?? '—'} sub="Active requests" color="blue" icon={<FileText size={32} />} />
                  <KPICard label="Pending Approvals" value={kpis.pending_approvals ?? '—'} sub="Awaiting review" color="amber" icon={<CheckCircle size={32} />} />
                  <KPICard label="Active BOM Items" value={kpis.active_bom_items ?? '—'} sub="In product structure" color="teal" icon={<Package size={32} />} />
                  <KPICard label="AI Risk Alerts" value={kpis.ai_risk_alerts ?? '—'} sub="Risk score ≥ 7.0" color="red" icon={<AlertTriangle size={32} />} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                {/* ECR Status Chart */}
                <div>
                  <div className="section-title">ECR Status Distribution</div>
                  <div className="card" style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                          {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ECR by Type */}
                <div>
                  <div className="section-title">Change Type Distribution</div>
                  <div className="card" style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={typeData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                        <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} />
                        <Bar dataKey="value" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Latest ECRs */}
              <div style={{ marginBottom: 14 }}>
                <div className="section-title">Latest Engineering Change Requests</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ECR #</th><th>Title</th><th>Priority</th><th>Status</th><th>Risk Score</th><th>Requested By</th><th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats?.latest_ecrs || []).map((ecr: any) => (
                        <tr key={ecr.id}>
                          <td><span style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{ecr.ecr_number}</span></td>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 200 }}>{ecr.title}</td>
                          <td><span className={`badge ${getPriorityBadge(ecr.priority)}`}>{ecr.priority}</span></td>
                          <td><span className={`badge ${getStatusBadge(ecr.status)}`}>{ecr.status}</span></td>
                          <td>
                            <span style={{ color: getRiskColor(ecr.ai_risk_score), fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 600 }}>
                              {ecr.ai_risk_score.toFixed(1)}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>/ 10</span>
                          </td>
                          <td>{ecr.requested_by}</td>
                          <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{formatDate(ecr.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <div className="section-title">Recent Activity</div>
                <div className="card" style={{ padding: '8px 0' }}>
                  {(stats?.recent_logs || []).map((log: any) => (
                    <div key={log.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 14px', borderBottom: '1px solid var(--border)',
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: getActionColor(log.action),
                      }} />
                      <span style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: getActionColor(log.action), width: 80, flexShrink: 0 }}>
                        {log.action}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{log.details}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', flexShrink: 0 }}>
                        {log.username}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', flexShrink: 0 }}>
                        {timeAgo(log.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* AI Panel */}
        <div style={{
          width: 300, minWidth: 300,
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="ai-dot" />
            <span style={{ fontSize: 12, fontWeight: 500 }}>AI Impact Analysis</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {aiData && (
              <>
                {/* Risk Overview */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 10 }}>
                    Risk Overview
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    {[
                      { label: 'Low', value: aiData.risk_distribution?.low, color: '#22c55e' },
                      { label: 'Medium', value: aiData.risk_distribution?.medium, color: '#f59e0b' },
                      { label: 'High', value: aiData.risk_distribution?.high, color: '#ef4444' },
                    ].map(r => (
                      <div key={r.label} style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 6, padding: '8px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: r.color }}>{r.value}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{r.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Avg risk score: <span style={{ color: getRiskColor(aiData.avg_risk_score), fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>{aiData.avg_risk_score}</span>
                  </div>
                </div>

                {/* Top Risks */}
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 10 }}>
                    Top Risk Items
                  </div>
                  {(aiData.top_risks || []).map((r: any) => (
                    <div key={r.ecr_number} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)' }}>{r.ecr_number}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: getRiskColor(r.risk_score) }}>{r.risk_score}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-primary)', marginBottom: 4 }}>{r.title}</div>
                      <div style={{ height: 4, background: 'var(--bg-card)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${r.risk_score * 10}%`, background: getRiskColor(r.risk_score), borderRadius: 2, transition: 'width 0.8s' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Insights */}
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 10 }}>
                    AI Insights
                  </div>
                  {(aiData.insights || []).map((insight: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', marginTop: 5, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{insight}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, sub, color, icon }: any) {
  return (
    <div className={`kpi-card ${color}`}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'IBM Plex Mono', lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</div>
      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.07 }}>{icon}</div>
    </div>
  )
}

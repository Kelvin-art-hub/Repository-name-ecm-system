import { useEffect, useState } from 'react'
import { aiApi, dashboardApi } from '../lib/api'
import { getRiskColor, getRiskLabel, getRiskBadge } from '../lib/utils'
import { Brain, Sparkles, AlertTriangle, CheckCircle, TrendingUp, Loader2 } from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'

export default function AIPage() {
  const [analysis, setAnalysis] = useState<any>(null)
  const [insights, setInsights] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [qtyForm, setQtyForm] = useState({ part_number: '', old_quantity: 1, new_quantity: 2 })
  const [qtyResult, setQtyResult] = useState<any>(null)
  const [qtyLoading, setQtyLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [aRes, iRes] = await Promise.all([dashboardApi.getAIAnalysis(), aiApi.insights()])
      setAnalysis(aRes.data)
      setInsights(iRes.data.insights || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const analyzeQty = async () => {
    setQtyLoading(true)
    try {
      const res = await aiApi.quantityImpact(qtyForm)
      setQtyResult(res.data)
    } catch (e) { console.error(e) }
    finally { setQtyLoading(false) }
  }

  const radarData = analysis ? [
    { subject: 'Design Risk', A: analysis.risk_distribution?.high * 20 || 0 },
    { subject: 'Material Risk', A: analysis.avg_risk_score * 10 || 0 },
    { subject: 'Process Risk', A: 45 },
    { subject: 'Supply Chain', A: 60 },
    { subject: 'Compliance', A: 30 },
    { subject: 'Schedule', A: 55 },
  ] : []

  const riskBarData = analysis ? [
    { name: 'Low Risk', value: analysis.risk_distribution?.low || 0, color: '#22c55e' },
    { name: 'Medium Risk', value: analysis.risk_distribution?.medium || 0, color: '#f59e0b' },
    { name: 'High Risk', value: analysis.risk_distribution?.high || 0, color: '#ef4444' },
  ] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="ai-dot" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>AI Analysis Engine</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Risk Scoring · BOM Validation · Impact Analysis</div>
          </div>
        </div>
      </div>

      <div className="page-content">
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div className="spinner" style={{ width: 24, height: 24 }} />
          </div>
        ) : (
          <>
            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              <div className="kpi-card blue">
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Avg Risk Score</div>
                <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: getRiskColor(analysis?.avg_risk_score || 0) }}>{analysis?.avg_risk_score || '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>System average</div>
              </div>
              <div className="kpi-card red">
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>High Risk ECRs</div>
                <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: 'var(--danger)' }}>{analysis?.high_risk_count || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Score ≥ 7.0</div>
              </div>
              <div className="kpi-card amber">
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Medium Risk</div>
                <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: 'var(--warn)' }}>{analysis?.risk_distribution?.medium || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Score 4.0–6.9</div>
              </div>
              <div className="kpi-card green">
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Low Risk</div>
                <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: 'var(--success)' }}>{analysis?.risk_distribution?.low || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Score &lt; 4.0</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {/* Risk Distribution Chart */}
              <div>
                <div className="section-title">Risk Distribution</div>
                <div className="card" style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={riskBarData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {riskBarData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Risk Radar */}
              <div>
                <div className="section-title">Risk Profile Radar</div>
                <div className="card" style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                      <Radar name="Risk" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {/* Top Risk Items */}
              <div>
                <div className="section-title">Top Risk ECRs</div>
                <div className="card" style={{ padding: 0 }}>
                  {(analysis?.top_risks || []).map((r: any) => (
                    <div key={r.ecr_number} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--accent)', fontSize: 11 }}>{r.ecr_number}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: getRiskColor(r.risk_score) }}>{r.risk_score}</span>
                          <span className={`badge ${getRiskBadge(r.risk_score)}`}>{getRiskLabel(r.risk_score)}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 6 }}>{r.title}</div>
                      <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, marginBottom: 6 }}>
                        <div style={{ height: '100%', width: `${r.risk_score * 10}%`, background: getRiskColor(r.risk_score), borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.recommendation?.slice(0, 120)}...</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insights + Quantity Impact */}
              <div>
                <div className="section-title">AI Insights</div>
                <div className="card" style={{ marginBottom: 14 }}>
                  {insights.map((insight, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-glow)', border: '1px solid rgba(13,110,253,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Brain size={10} style={{ color: 'var(--accent)' }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{insight}</span>
                    </div>
                  ))}
                </div>

                <div className="section-title">Quantity Change Impact Analyzer</div>
                <div className="card">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div>
                      <label className="form-label">Part Number</label>
                      <input className="form-control" value={qtyForm.part_number} onChange={e => setQtyForm({ ...qtyForm, part_number: e.target.value })} placeholder="e.g. BRG-001" />
                    </div>
                    <div>
                      <label className="form-label">Old Qty</label>
                      <input className="form-control" type="number" value={qtyForm.old_quantity} onChange={e => setQtyForm({ ...qtyForm, old_quantity: parseFloat(e.target.value) })} />
                    </div>
                    <div>
                      <label className="form-label">New Qty</label>
                      <input className="form-control" type="number" value={qtyForm.new_quantity} onChange={e => setQtyForm({ ...qtyForm, new_quantity: parseFloat(e.target.value) })} />
                    </div>
                  </div>
                  <button className="btn btn-ai btn-sm" onClick={analyzeQty} disabled={qtyLoading} style={{ width: '100%' }}>
                    {qtyLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    Analyze Impact
                  </button>
                  {qtyResult && (
                    <div style={{ marginTop: 12, background: 'var(--bg-elevated)', borderRadius: 6, padding: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {[
                          { label: 'Change %', value: `${qtyResult.change_percentage > 0 ? '+' : ''}${qtyResult.change_percentage}%` },
                          { label: 'Cost Impact', value: `$${qtyResult.cost_impact?.toFixed(2)}` },
                          { label: 'Risk Level', value: qtyResult.risk_level },
                          { label: 'Supply Chain', value: qtyResult.supply_chain_impact },
                        ].map(f => (
                          <div key={f.label}>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5 }}>{f.label}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>{f.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{qtyResult.recommendation}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

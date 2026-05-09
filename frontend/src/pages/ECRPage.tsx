import { useEffect, useState } from 'react'
import { ecrApi, aiApi } from '../lib/api'
import { formatDate, getPriorityBadge, getStatusBadge, getRiskColor, getRiskBadge } from '../lib/utils'
import { Plus, X, Sparkles, Loader2, ChevronDown, ChevronUp, Search, Filter } from 'lucide-react'
import { usePermissions } from '../lib/usePermissions'

const CHANGE_TYPES = ['Design', 'Material', 'Process', 'Software', 'Documentation']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const STATUSES = ['Open', 'In Review', 'Pending Approval', 'Approved', 'Rejected', 'Closed', 'On Hold']

export default function ECRPage() {
  const [ecrs, setEcrs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [selectedECR, setSelectedECR] = useState<any>(null)
  const { canCreateECR, canDeleteECR, canSubmitECR, isReadOnly } = usePermissions()

  const [form, setForm] = useState({
    title: '', product_name: '', part_number: '',
    change_type: 'Design', priority: 'High',
    description: '', justification: '', requested_by: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filterStatus) params.status = filterStatus
      if (filterPriority) params.priority = filterPriority
      if (search) params.search = search
      const res = await ecrApi.list(params)
      setEcrs(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filterStatus, filterPriority])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load() }

  const runAI = async () => {
    if (!form.title || !form.change_type) return
    setAiLoading(true)
    try {
      const res = await aiApi.analyzeECR({
        title: form.title, product_name: form.product_name,
        part_number: form.part_number, change_type: form.change_type,
        priority: form.priority, description: form.description,
      })
      setAiResult(res.data)
    } catch (e) { console.error(e) }
    finally { setAiLoading(false) }
  }

  const submitECR = async () => {
    if (!form.title || !form.part_number) return
    setSubmitting(true)
    try {
      await ecrApi.create(form)
      setShowForm(false)
      setForm({ title: '', product_name: '', part_number: '', change_type: 'Design', priority: 'High', description: '', justification: '', requested_by: '' })
      setAiResult(null)
      load()
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to create ECR')
    } finally { setSubmitting(false) }
  }

  const submitForApproval = async (id: number) => {
    try {
      await ecrApi.submit(id)
      load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Failed to submit') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>ECR Management</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Engineering Change Requests</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {canCreateECR && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? <X size={12} /> : <Plus size={12} />}
              {showForm ? 'Cancel' : 'New ECR'}
            </button>
          )}
          {isReadOnly && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              👁 Read-only access
            </span>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* Create Form */}
        {showForm && (
          <div style={{ marginBottom: 20 }}>
            <div className="section-title">Create New ECR</div>
            <div className="card">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">ECR Title *</label>
                    <input className="form-control" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Brief description of the change" />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Product Name</label>
                    <input className="form-control" value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} placeholder="e.g. Industrial Motor X200" />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Part Number *</label>
                    <input className="form-control" value={form.part_number} onChange={e => setForm({ ...form, part_number: e.target.value })} placeholder="e.g. MH-4421" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <div>
                      <label className="form-label">Change Type</label>
                      <select className="form-control" value={form.change_type} onChange={e => setForm({ ...form, change_type: e.target.value })}>
                        {CHANGE_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Priority</label>
                      <select className="form-control" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                        {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Requested By</label>
                    <input className="form-control" value={form.requested_by} onChange={e => setForm({ ...form, requested_by: e.target.value })} placeholder="Engineer name" />
                  </div>
                </div>
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Change Description *</label>
                    <textarea className="form-control" style={{ height: 100 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Detailed description of the proposed change..." />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Justification</label>
                    <textarea className="form-control" style={{ height: 60 }} value={form.justification} onChange={e => setForm({ ...form, justification: e.target.value })} placeholder="Business or technical justification..." />
                  </div>

                  {/* AI Result */}
                  {aiResult && (
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 9, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 2, color: 'var(--teal)', marginBottom: 8 }}>⚡ AI Analysis Result</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>RISK SCORE</span>
                        <span style={{ fontSize: 22, fontWeight: 600, fontFamily: 'IBM Plex Mono', color: getRiskColor(aiResult.risk_score) }}>{aiResult.risk_score}</span>
                        <span className={`badge ${getRiskBadge(aiResult.risk_score)}`}>{aiResult.risk_category}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-card)', borderRadius: 2, marginBottom: 8 }}>
                        <div style={{ height: '100%', width: `${aiResult.risk_score * 10}%`, background: getRiskColor(aiResult.risk_score), borderRadius: 2, transition: 'width 0.8s' }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>{aiResult.recommendation}</div>
                      {aiResult.affected_parts?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {aiResult.affected_parts.map((p: string) => (
                            <span key={p} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontFamily: 'IBM Plex Mono', color: 'var(--text-secondary)' }}>{p}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ai" onClick={runAI} disabled={aiLoading}>
                      {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      AI Assist
                    </button>
                    <button className="btn btn-primary" onClick={submitECR} disabled={submitting} style={{ flex: 1 }}>
                      {submitting ? <Loader2 size={12} className="animate-spin" /> : null}
                      Submit for Review
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flex: 1 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
              <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-control" style={{ paddingLeft: 30 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ECRs..." />
            </div>
            <button type="submit" className="btn btn-ghost btn-sm"><Search size={12} /></button>
          </form>
          <select className="form-control" style={{ width: 140, height: 34 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="form-control" style={{ width: 130, height: 34 }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>

        {/* ECR Table */}
        <div className="section-title">All Engineering Change Requests ({ecrs.length})</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ECR #</th><th>Title</th><th>Product</th><th>Part #</th>
                <th>Type</th><th>Priority</th><th>Status</th><th>Risk</th>
                <th>Requested By</th><th>Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
              ) : ecrs.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No ECRs found</td></tr>
              ) : ecrs.map(ecr => (
                <tr key={ecr.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedECR(selectedECR?.id === ecr.id ? null : ecr)}>
                  <td><span style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{ecr.ecr_number}</span></td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 180 }}>{ecr.title}</td>
                  <td style={{ fontSize: 11 }}>{ecr.product_name || '—'}</td>
                  <td><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{ecr.part_number}</span></td>
                  <td><span className="badge badge-gray">{ecr.change_type}</span></td>
                  <td><span className={`badge ${getPriorityBadge(ecr.priority)}`}>{ecr.priority}</span></td>
                  <td><span className={`badge ${getStatusBadge(ecr.status)}`}>{ecr.status}</span></td>
                  <td>
                    <span style={{ color: getRiskColor(ecr.ai_risk_score), fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 600 }}>
                      {ecr.ai_risk_score?.toFixed(1)}
                    </span>
                  </td>
                  <td style={{ fontSize: 11 }}>{ecr.requested_by}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{formatDate(ecr.created_at)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {canSubmitECR && ecr.status === 'Open' && (
                      <button className="btn btn-primary btn-sm" onClick={() => submitForApproval(ecr.id)}>Submit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ECR Detail Panel */}
        {selectedECR && <ECRDetail ecr={selectedECR} onClose={() => setSelectedECR(null)} />}
      </div>
    </div>
  )
}

function ECRDetail({ ecr, onClose }: { ecr: any; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null)
  useEffect(() => {
    ecrApi.get(ecr.id).then(r => setDetail(r.data)).catch(console.error)
  }, [ecr.id])

  return (
    <div style={{ marginTop: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--accent)', fontSize: 12 }}>{ecr.ecr_number}</span>
          <span style={{ marginLeft: 10, fontWeight: 500 }}>{ecr.title}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={12} /></button>
      </div>
      {detail ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Description</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{detail.description || '—'}</div>
            {detail.ai_recommendation && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>AI Recommendation</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--bg-card)', borderRadius: 6, padding: 10 }}>{detail.ai_recommendation}</div>
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Approval Workflow</div>
            {(detail.approvals || []).map((a: any, i: number) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600, fontFamily: 'IBM Plex Mono',
                  background: a.status === 'Approved' ? 'var(--success)' : a.status === 'Rejected' ? 'var(--danger)' : 'var(--bg-card)',
                  border: `2px solid ${a.status === 'Approved' ? 'var(--success)' : a.status === 'Rejected' ? 'var(--danger)' : 'var(--border)'}`,
                  color: a.status === 'Pending' ? 'var(--text-muted)' : '#fff',
                }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>{a.stage}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.approver}</div>
                </div>
                <span className={`badge ${a.status === 'Approved' ? 'badge-green' : a.status === 'Rejected' ? 'badge-red' : 'badge-amber'}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : <div className="spinner" />}
    </div>
  )
}

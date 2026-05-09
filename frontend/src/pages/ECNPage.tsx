import { useEffect, useState } from 'react'
import { ecnApi, ecrApi } from '../lib/api'
import { formatDate, getStatusBadge } from '../lib/utils'
import { Plus, X, Zap, Loader2 } from 'lucide-react'

export default function ECNPage() {
  const [ecns, setEcns] = useState<any[]>([])
  const [approvedECRs, setApprovedECRs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState<number | null>(null)
  const [form, setForm] = useState({ ecr_id: '', title: '', description: '', change_summary: '', implementation_notes: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [ecnRes, ecrRes] = await Promise.all([
        ecnApi.list(),
        ecrApi.list({ status: 'Approved' }),
      ])
      setEcns(ecnRes.data)
      setApprovedECRs(ecrRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const submitECN = async () => {
    if (!form.ecr_id || !form.title) return
    setSubmitting(true)
    try {
      await ecnApi.create({ ...form, ecr_id: parseInt(form.ecr_id) })
      setShowForm(false)
      setForm({ ecr_id: '', title: '', description: '', change_summary: '', implementation_notes: '' })
      load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Failed to create ECN') }
    finally { setSubmitting(false) }
  }

  const generateFromECR = async (ecrId: number) => {
    setGenerating(ecrId)
    try {
      await ecnApi.generateFromECR(ecrId)
      load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Failed to generate ECN') }
    finally { setGenerating(null) }
  }

  const updateStatus = async (id: number, status: string) => {
    try {
      await ecnApi.update(id, { status })
      load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Failed to update') }
  }

  const STAGES = ['Engineering Review', 'Manager Approval', 'Released', 'Obsolete']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>ECN Workflow</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Engineering Change Notices</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X size={12} /> : <Plus size={12} />}
            {showForm ? 'Cancel' : 'New ECN'}
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Create Form */}
        {showForm && (
          <div style={{ marginBottom: 20 }}>
            <div className="section-title">Create New ECN</div>
            <div className="card">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Source ECR *</label>
                    <select className="form-control" value={form.ecr_id} onChange={e => setForm({ ...form, ecr_id: e.target.value })}>
                      <option value="">Select approved ECR...</option>
                      {approvedECRs.map(ecr => (
                        <option key={ecr.id} value={ecr.id}>{ecr.ecr_number} — {ecr.title}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">ECN Title *</label>
                    <input className="form-control" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="ECN title" />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Description</label>
                    <textarea className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="ECN description..." />
                  </div>
                </div>
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Change Summary</label>
                    <textarea className="form-control" value={form.change_summary} onChange={e => setForm({ ...form, change_summary: e.target.value })} placeholder="Summary of changes..." />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Implementation Notes</label>
                    <textarea className="form-control" value={form.implementation_notes} onChange={e => setForm({ ...form, implementation_notes: e.target.value })} placeholder="Implementation instructions..." />
                  </div>
                  <button className="btn btn-primary" onClick={submitECN} disabled={submitting} style={{ width: '100%' }}>
                    {submitting ? <Loader2 size={12} className="animate-spin" /> : null}
                    Create ECN
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Auto-generate from approved ECRs */}
        {approvedECRs.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="section-title">Auto-Generate ECN from Approved ECRs</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {approvedECRs.map(ecr => (
                <div key={ecr.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--accent)', fontSize: 11 }}>{ecr.ecr_number}</span>
                    <span className="badge badge-green">Approved</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 8 }}>{ecr.title}</div>
                  <button
                    className="btn btn-ai btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => generateFromECR(ecr.id)}
                    disabled={generating === ecr.id}
                  >
                    {generating === ecr.id ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                    Generate ECN
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ECN Table */}
        <div className="section-title">All Engineering Change Notices ({ecns.length})</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ECN #</th><th>Title</th><th>Source ECR</th><th>Status</th>
                <th>Release Stage</th><th>Revision</th><th>Approved By</th>
                <th>Release Date</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
              ) : ecns.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No ECNs found</td></tr>
              ) : ecns.map(ecn => (
                <tr key={ecn.id}>
                  <td><span style={{ color: 'var(--teal)', fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{ecn.ecn_number}</span></td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 200 }}>{ecn.title}</td>
                  <td><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--accent)' }}>ECR #{ecn.ecr_id}</span></td>
                  <td><span className={`badge ${getStatusBadge(ecn.status)}`}>{ecn.status}</span></td>
                  <td style={{ fontSize: 11 }}>{ecn.release_stage}</td>
                  <td><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>Rev {ecn.revision_level}</span></td>
                  <td style={{ fontSize: 11 }}>{ecn.approved_by || '—'}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{formatDate(ecn.release_date)}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{formatDate(ecn.created_at)}</td>
                  <td>
                    {ecn.status !== 'Released' && ecn.status !== 'Obsolete' && (
                      <select
                        className="form-control"
                        style={{ height: 26, fontSize: 11, padding: '0 6px', width: 130 }}
                        value={ecn.status}
                        onChange={e => updateStatus(ecn.id, e.target.value)}
                      >
                        {STAGES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    )}
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

import { useEffect, useState } from 'react'
import { approvalApi } from '../lib/api'
import { formatDate, getPriorityBadge, getStatusBadge, getRiskColor } from '../lib/utils'
import { CheckCircle, XCircle, Loader2, Filter } from 'lucide-react'
import { usePermissions } from '../lib/usePermissions'

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('Pending')
  const [actionModal, setActionModal] = useState<{ approval: any; action: 'approve' | 'reject' } | null>(null)
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { canApprove } = usePermissions()

  const load = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filterStatus) params.status = filterStatus
      const res = await approvalApi.list(params)
      setApprovals(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filterStatus])

  const processAction = async () => {
    if (!actionModal) return
    setSubmitting(true)
    try {
      await approvalApi.action(actionModal.approval.id, actionModal.action, comments)
      setActionModal(null)
      setComments('')
      load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Action failed') }
    finally { setSubmitting(false) }
  }

  const pendingCount = approvals.filter(a => a.status === 'Pending').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Approval Workflow</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Multi-stage ECR Approvals</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {pendingCount > 0 && (
            <span style={{ background: 'var(--warn)', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontFamily: 'IBM Plex Mono' }}>
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['', 'Pending', 'Approved', 'Rejected'].map(s => (
            <button
              key={s}
              className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilterStatus(s)}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {/* Approvals Table */}
        <div className="section-title">Approval Queue ({approvals.length})</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ECR #</th><th>Title</th><th>Priority</th><th>Risk</th>
                <th>Stage</th><th>Approver</th><th>Status</th>
                <th>Comments</th><th>Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
              ) : approvals.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No approvals found</td></tr>
              ) : approvals.map(a => (
                <tr key={a.id}>
                  <td><span style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{a.ecr_number}</span></td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 180 }}>{a.ecr_title}</td>
                  <td><span className={`badge ${getPriorityBadge(a.priority)}`}>{a.priority}</span></td>
                  <td>
                    <span style={{ color: getRiskColor(a.ai_risk_score), fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 600 }}>
                      {a.ai_risk_score?.toFixed(1)}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>{a.stage}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Step {a.stage_order}</div>
                  </td>
                  <td style={{ fontSize: 11 }}>{a.approver}</td>
                  <td><span className={`badge ${getStatusBadge(a.status)}`}>{a.status}</span></td>
                  <td style={{ fontSize: 11, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.comments || '—'}
                  </td>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{formatDate(a.approved_at || a.created_at)}</td>
                  <td>
                    {canApprove && a.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-success btn-sm" onClick={() => setActionModal({ approval: a, action: 'approve' })}>
                          <CheckCircle size={11} /> Approve
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setActionModal({ approval: a, action: 'reject' })}>
                          <XCircle size={11} /> Reject
                        </button>
                      </div>
                    )}
                    {!canApprove && a.status === 'Pending' && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>No permission</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {actionModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 24, width: 440,
          }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
              {actionModal.action === 'approve' ? '✅ Approve' : '❌ Reject'} Approval
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {actionModal.approval.ecr_number} — {actionModal.approval.ecr_title}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Stage</label>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
                {actionModal.approval.stage}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Comments {actionModal.action === 'reject' ? '*' : '(optional)'}</label>
              <textarea
                className="form-control"
                value={comments}
                onChange={e => setComments(e.target.value)}
                placeholder={actionModal.action === 'approve' ? 'Add approval comments...' : 'Reason for rejection...'}
                style={{ height: 80 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setActionModal(null); setComments('') }}>Cancel</button>
              <button
                className={`btn ${actionModal.action === 'approve' ? 'btn-success' : 'btn-danger'}`}
                onClick={processAction}
                disabled={submitting || (actionModal.action === 'reject' && !comments)}
              >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : null}
                {actionModal.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

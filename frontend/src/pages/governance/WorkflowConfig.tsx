import { useEffect, useState } from 'react'
import { governanceApi } from '../../lib/api'
import { Plus, X, Loader2, Edit2 } from 'lucide-react'
import { usePermissions } from '../../lib/usePermissions'

const CHANGE_TYPES = ['*', 'Design', 'Material', 'Process', 'Software', 'Documentation', 'Emergency']
const PRIORITIES = ['*', 'Low', 'Medium', 'High', 'Critical']
const ROLES = ['engineer', 'senior_engineer', 'approver', 'manager', 'admin']
const EMPTY_FORM = { name: '', description: '', change_type: '*', priority: '*', is_emergency: false, stages: [{ name: '', order: 1, required_role: 'manager', sla_hours: 24 }] }

export default function WorkflowConfig() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const { isAdmin, isManager } = usePermissions()

  const load = () => { setLoading(true); governanceApi.listTemplates().then(r => setTemplates(r.data)).catch(console.error).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const openEdit = (t: any) => { setEditing(t); setForm({ name: t.name, description: t.description || '', change_type: t.change_type, priority: t.priority, is_emergency: t.is_emergency, stages: t.stages || [{ name: '', order: 1, required_role: 'manager', sla_hours: 24 }] }); setShowForm(true) }
  const updateStage = (i: number, field: string, value: any) => setForm(f => { const stages = [...f.stages]; stages[i] = { ...stages[i], [field]: value }; return { ...f, stages } })

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...form, stages: form.stages.map((s, i) => ({ ...s, order: i + 1 })) }
      if (editing) { await governanceApi.updateTemplate(editing.id, payload) } else { await governanceApi.createTemplate(payload) }
      setShowForm(false); setEditing(null); setForm(EMPTY_FORM); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Save failed') } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Configure multi-stage approval workflows per change type and priority.</div>
        {(isAdmin || isManager) && <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(!showForm) }}>{showForm ? <X size={12} /> : <Plus size={12} />} {showForm ? 'Cancel' : 'New Template'}</button>}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{editing ? `Edit: ${editing.name}` : 'New Workflow Template'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div><label className="form-label">Template Name *</label><input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="form-label">Description</label><input className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><label className="form-label">Change Type</label><select className="form-control" value={form.change_type} onChange={e => setForm({ ...form, change_type: e.target.value })}>{CHANGE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label className="form-label">Priority</label><select className="form-control" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Approval Stages</label>
              <button className="btn btn-ghost btn-sm" onClick={() => setForm(f => ({ ...f, stages: [...f.stages, { name: '', order: f.stages.length + 1, required_role: 'manager', sla_hours: 24 }] }))}><Plus size={11} /> Add Stage</button>
            </div>
            {form.stages.map((stage, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr 100px 30px', gap: 8, alignItems: 'center', marginBottom: 8, background: 'var(--bg-elevated)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)', textAlign: 'center' }}>{i + 1}</div>
                <input className="form-control" style={{ height: 30, fontSize: 12 }} value={stage.name} onChange={e => updateStage(i, 'name', e.target.value)} placeholder="Stage name" />
                <select className="form-control" style={{ height: 30, fontSize: 12 }} value={stage.required_role} onChange={e => updateStage(i, 'required_role', e.target.value)}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input className="form-control" style={{ height: 30, fontSize: 12 }} type="number" value={stage.sla_hours} onChange={e => updateStage(i, 'sla_hours', parseInt(e.target.value))} /><span style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>hrs</span></div>
                {form.stages.length > 1 && <button className="btn btn-danger btn-sm" style={{ height: 28, padding: '0 6px' }} onClick={() => setForm(f => ({ ...f, stages: f.stages.filter((_, idx) => idx !== i) }))}><X size={10} /></button>}
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving} style={{ width: '100%' }}>{saving ? <Loader2 size={12} className="animate-spin" /> : null}{editing ? 'Update' : 'Create'} Template</button>
        </div>
      )}

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {templates.map(t => (
            <div key={t.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.description}</div></div>
                {(isAdmin || isManager) && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}><Edit2 size={11} /></button>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <span className="badge badge-blue">{t.change_type === '*' ? 'All Types' : t.change_type}</span>
                <span className="badge badge-amber">{t.priority === '*' ? 'All Priorities' : t.priority}</span>
                {t.is_emergency && <span className="badge badge-red">Emergency</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
                {(t.stages || []).map((s: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 9, fontFamily: 'IBM Plex Mono', color: 'var(--accent)', marginBottom: 2 }}>STEP {s.order}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.required_role}</div>
                      <div style={{ fontSize: 9, color: 'var(--teal)' }}>{s.sla_hours}h SLA</div>
                    </div>
                    {i < t.stages.length - 1 && <div style={{ width: 16, height: 1, background: 'var(--border)', flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

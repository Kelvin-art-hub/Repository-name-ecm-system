import { useEffect, useState } from 'react'
import { governanceApi } from '../../lib/api'
import { Plus, X, Edit2, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import { usePermissions } from '../../lib/usePermissions'

const CATEGORIES = ['approval', 'bom', 'compliance', 'security', 'process']
const SEVERITIES = ['info', 'warning', 'error', 'critical']
const ENTITIES = ['ecr', 'bom', 'ecn']
const RULE_TYPES = ['require_approval', 'block_submission', 'require_field', 'notify', 'fast_track']
const SEV_COLORS: Record<string, string> = { info: 'badge-blue', warning: 'badge-amber', error: 'badge-red', critical: 'badge-red' }
const CAT_COLORS: Record<string, string> = { approval: 'badge-blue', bom: 'badge-teal', compliance: 'badge-amber', security: 'badge-red', process: 'badge-gray' }
const EMPTY = { name: '', description: '', category: 'compliance', trigger_entity: 'ecr', trigger_condition: 'on_submit', rule_type: 'require_approval', severity: 'warning', is_active: true, rule_config: '{"field":"priority","operator":"eq","value":"Critical"}', action_config: '{"required_role":"manager","message":"Requires manager approval."}' }

export default function PolicyManager() {
  const [policies, setPolicies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [filterCat, setFilterCat] = useState('')
  const [form, setForm] = useState(EMPTY)
  const { isAdmin, isManager } = usePermissions()

  const load = () => { setLoading(true); governanceApi.listPolicies(filterCat ? { category: filterCat } : {}).then(r => setPolicies(r.data)).catch(console.error).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [filterCat])

  const openEdit = (p: any) => { setEditing(p); setForm({ ...p, rule_config: JSON.stringify(p.rule_config || {}, null, 2), action_config: JSON.stringify(p.action_config || {}, null, 2) }); setShowForm(true) }

  const save = async () => {
    setSaving(true)
    try {
      let rc = {}, ac = {}
      try { rc = JSON.parse(form.rule_config) } catch { rc = {} }
      try { ac = JSON.parse(form.action_config) } catch { ac = {} }
      const payload = { ...form, rule_config: rc, action_config: ac }
      if (editing) { await governanceApi.updatePolicy(editing.id, payload) } else { await governanceApi.createPolicy(payload) }
      setShowForm(false); setEditing(null); setForm(EMPTY); load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Save failed') } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm ${filterCat === '' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterCat('')}>All</button>
          {CATEGORIES.map(c => <button key={c} className={`btn btn-sm ${filterCat === c ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterCat(c)}>{c.charAt(0).toUpperCase() + c.slice(1)}</button>)}
        </div>
        {(isAdmin || isManager) && <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(!showForm) }}>{showForm ? <X size={12} /> : <Plus size={12} />} {showForm ? 'Cancel' : 'New Policy'}</button>}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{editing ? `Edit: ${editing.name}` : 'Create New Policy'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ marginBottom: 10 }}><label className="form-label">Policy Name *</label><input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div style={{ marginBottom: 10 }}><label className="form-label">Description</label><input className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div><label className="form-label">Category</label><select className="form-control" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><label className="form-label">Severity</label><select className="form-control" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>{SEVERITIES.map(s => <option key={s}>{s}</option>)}</select></div>
              </div>
              <div><label className="form-label">Rule Type</label><select className="form-control" value={form.rule_type} onChange={e => setForm({ ...form, rule_type: e.target.value })}>{RULE_TYPES.map(r => <option key={r}>{r}</option>)}</select></div>
            </div>
            <div>
              <div style={{ marginBottom: 10 }}><label className="form-label">Rule Config (JSON)</label><textarea className="form-control" style={{ height: 100, fontFamily: 'IBM Plex Mono', fontSize: 11 }} value={form.rule_config} onChange={e => setForm({ ...form, rule_config: e.target.value })} /></div>
              <div style={{ marginBottom: 12 }}><label className="form-label">Action Config (JSON)</label><textarea className="form-control" style={{ height: 80, fontFamily: 'IBM Plex Mono', fontSize: 11 }} value={form.action_config} onChange={e => setForm({ ...form, action_config: e.target.value })} /></div>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{ width: '100%' }}>{saving ? <Loader2 size={12} className="animate-spin" /> : null}{editing ? 'Update' : 'Create'} Policy</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Policy Name</th><th>Category</th><th>Entity</th><th>Rule Type</th><th>Severity</th><th>System</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></td></tr>
              : policies.map(p => (
                <tr key={p.id}>
                  <td><div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 12 }}>{p.name}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{(p.description || '').slice(0, 60)}</div></td>
                  <td><span className={`badge ${CAT_COLORS[p.category] || 'badge-gray'}`}>{p.category}</span></td>
                  <td><span className="badge badge-gray">{p.trigger_entity}</span></td>
                  <td style={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}>{p.rule_type}</td>
                  <td><span className={`badge ${SEV_COLORS[p.severity] || 'badge-gray'}`}>{p.severity}</span></td>
                  <td>{p.is_system && <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'IBM Plex Mono' }}>SYSTEM</span>}</td>
                  <td><span className={`badge ${p.is_active ? 'badge-green' : 'badge-gray'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>{(isAdmin || isManager) && <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}><Edit2 size={11} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => governanceApi.updatePolicy(p.id, { is_active: !p.is_active }).then(load)}>{p.is_active ? <ToggleRight size={11} style={{ color: 'var(--success)' }} /> : <ToggleLeft size={11} />}</button>
                    {!p.is_system && isAdmin && <button className="btn btn-danger btn-sm" onClick={() => { if (confirm('Delete?')) governanceApi.deletePolicy(p.id).then(load) }}><Trash2 size={11} /></button>}
                  </div>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

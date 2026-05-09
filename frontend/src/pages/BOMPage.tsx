import { useEffect, useState } from 'react'
import { bomApi } from '../lib/api'
import { getStatusBadge } from '../lib/utils'
import { ChevronRight, ChevronDown, Lock, Unlock, Plus, X, CheckCircle, AlertTriangle, Loader2, GitCompare } from 'lucide-react'

function BOMTreeNode({ item, depth = 0, onSelect, selectedId }: any) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = item.children && item.children.length > 0

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
          paddingLeft: 8 + depth * 20,
          background: selectedId === item.id ? 'var(--accent-glow)' : 'transparent',
          border: selectedId === item.id ? '1px solid rgba(13,110,253,0.2)' : '1px solid transparent',
        }}
        onClick={() => onSelect(item)}
        onMouseEnter={e => { if (selectedId !== item.id) e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={e => { if (selectedId !== item.id) e.currentTarget.style.background = 'transparent' }}
      >
        <div
          style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
        >
          {hasChildren ? (expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />) : null}
        </div>
        <span style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: 11, flexShrink: 0 }}>{item.part_number}</span>
        <span style={{ color: 'var(--text-primary)', fontSize: 12, flex: 1 }}>{item.part_name}</span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>Rev {item.revision}</span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--teal)', flexShrink: 0 }}>×{item.quantity}</span>
        {item.is_locked && <Lock size={10} style={{ color: 'var(--warn)', flexShrink: 0 }} />}
        <span className={`badge ${getStatusBadge(item.status)}`} style={{ fontSize: 9 }}>{item.status}</span>
      </div>
      {expanded && hasChildren && (
        <div style={{ borderLeft: '1px solid var(--border)', marginLeft: 8 + depth * 20 + 7 }}>
          {item.children.map((child: any) => (
            <BOMTreeNode key={child.id} item={child} depth={depth + 1} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function BOMPage() {
  const [bomTree, setBomTree] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [validation, setValidation] = useState<any>(null)
  const [validating, setValidating] = useState(false)
  const [locking, setLocking] = useState(false)
  const [versions, setVersions] = useState<any[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ part_number: '', part_name: '', revision: 'A', quantity: 1, unit: 'EA', material: '', product_family: '', status: 'Active' })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await bomApi.getTree()
      setBomTree(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSelect = async (item: any) => {
    setSelected(item)
    setValidation(null)
    try {
      const vRes = await bomApi.getVersions(item.id)
      setVersions(vRes.data)
    } catch { setVersions([]) }
  }

  const validateBOM = async () => {
    if (!selected) return
    setValidating(true)
    try {
      const res = await bomApi.validate(selected.id)
      setValidation(res.data)
    } catch (e) { console.error(e) }
    finally { setValidating(false) }
  }

  const lockBOM = async () => {
    if (!selected) return
    setLocking(true)
    try {
      if (selected.is_locked) {
        await bomApi.unlock(selected.id)
      } else {
        await bomApi.lock(selected.id, { user: 'current_user' })
      }
      load()
      setSelected({ ...selected, is_locked: !selected.is_locked })
    } catch (e: any) { alert(e.response?.data?.detail || 'Lock operation failed') }
    finally { setLocking(false) }
  }

  const addBOMItem = async () => {
    if (!addForm.part_number || !addForm.part_name) return
    setSubmitting(true)
    try {
      await bomApi.create({ ...addForm, parent_id: selected?.id || null })
      setShowAddForm(false)
      setAddForm({ part_number: '', part_name: '', revision: 'A', quantity: 1, unit: 'EA', material: '', product_family: '', status: 'Active' })
      load()
    } catch (e: any) { alert(e.response?.data?.detail || 'Failed to add BOM item') }
    finally { setSubmitting(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="topbar">
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>BOM Viewer</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Bill of Materials — Version Controlled</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? <X size={12} /> : <Plus size={12} />}
            {showAddForm ? 'Cancel' : 'Add Item'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* BOM Tree */}
        <div style={{ width: 420, minWidth: 420, borderRight: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5 }}>
            Product Structure
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8, fontFamily: 'IBM Plex Mono' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
            ) : bomTree.map(root => (
              <BOMTreeNode key={root.id} item={root} onSelect={handleSelect} selectedId={selected?.id} />
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="page-content" style={{ flex: 1 }}>
          {/* Add Form */}
          {showAddForm && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-title">Add BOM Item {selected ? `(Child of ${selected.part_number})` : '(Root Item)'}</div>
              <div className="card">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="form-label">Part Number *</label>
                    <input className="form-control" value={addForm.part_number} onChange={e => setAddForm({ ...addForm, part_number: e.target.value })} placeholder="e.g. BRG-003" />
                  </div>
                  <div>
                    <label className="form-label">Part Name *</label>
                    <input className="form-control" value={addForm.part_name} onChange={e => setAddForm({ ...addForm, part_name: e.target.value })} placeholder="e.g. Rear Bearing" />
                  </div>
                  <div>
                    <label className="form-label">Revision</label>
                    <input className="form-control" value={addForm.revision} onChange={e => setAddForm({ ...addForm, revision: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Quantity</label>
                    <input className="form-control" type="number" value={addForm.quantity} onChange={e => setAddForm({ ...addForm, quantity: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="form-label">Unit</label>
                    <select className="form-control" value={addForm.unit} onChange={e => setAddForm({ ...addForm, unit: e.target.value })}>
                      {['EA', 'KG', 'M', 'L', 'SET', 'LOT'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Material</label>
                    <input className="form-control" value={addForm.material} onChange={e => setAddForm({ ...addForm, material: e.target.value })} placeholder="e.g. Steel" />
                  </div>
                  <div>
                    <label className="form-label">Product Family</label>
                    <input className="form-control" value={addForm.product_family} onChange={e => setAddForm({ ...addForm, product_family: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <select className="form-control" value={addForm.status} onChange={e => setAddForm({ ...addForm, status: e.target.value })}>
                      {['Active', 'Prototype', 'Obsolete', 'Pending'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={addBOMItem} disabled={submitting} style={{ width: '100%' }}>
                      {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      Add Item
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selected ? (
            <>
              {/* Item Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--accent)', fontSize: 13 }}>{selected.part_number}</span>
                  <span style={{ marginLeft: 10, fontSize: 15, fontWeight: 500 }}>{selected.part_name}</span>
                  <span style={{ marginLeft: 8 }} className={`badge ${getStatusBadge(selected.status)}`}>{selected.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={validateBOM} disabled={validating}>
                    {validating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                    AI Validate
                  </button>
                  <button className={`btn btn-sm ${selected.is_locked ? 'btn-danger' : 'btn-ghost'}`} onClick={lockBOM} disabled={locking}>
                    {locking ? <Loader2 size={12} className="animate-spin" /> : selected.is_locked ? <Unlock size={12} /> : <Lock size={12} />}
                    {selected.is_locked ? 'Unlock' : 'Lock'}
                  </button>
                </div>
              </div>

              {/* Lock Status */}
              {selected.is_locked && (
                <div style={{ background: 'var(--warn-dim)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '8px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Lock size={12} style={{ color: 'var(--warn)' }} />
                  <span style={{ fontSize: 12, color: 'var(--warn)' }}>BOM item is locked by <strong>{selected.locked_by}</strong> — concurrent editing prevented</span>
                </div>
              )}

              {/* Item Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Revision', value: selected.revision },
                  { label: 'Quantity', value: `${selected.quantity} ${selected.unit}` },
                  { label: 'Material', value: selected.material || '—' },
                  { label: 'Product Family', value: selected.product_family || '—' },
                  { label: 'Version', value: `v${selected.version}` },
                  { label: 'Unit Cost', value: selected.unit_cost ? `$${selected.unit_cost.toFixed(2)}` : '—' },
                  { label: 'Lead Time', value: selected.lead_time_days ? `${selected.lead_time_days} days` : '—' },
                  { label: 'Manufacturer', value: selected.manufacturer || '—' },
                ].map(f => (
                  <div key={f.label} style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>{f.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono' }}>{f.value}</div>
                  </div>
                ))}
              </div>

              {/* AI Validation Result */}
              {validation && (
                <div style={{ marginBottom: 14 }}>
                  <div className="section-title">AI Validation Result</div>
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      {validation.is_valid
                        ? <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                        : <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />}
                      <span style={{ fontWeight: 500 }}>{validation.is_valid ? 'BOM is valid' : 'Validation issues found'}</span>
                      <span style={{ marginLeft: 'auto', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>
                        Score: <span style={{ color: validation.validation_score >= 80 ? 'var(--success)' : 'var(--warn)' }}>{validation.validation_score}/100</span>
                      </span>
                    </div>
                    {validation.issues?.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: 'var(--danger)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Issues</div>
                        {validation.issues.map((issue: string, i: number) => (
                          <div key={i} style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 4 }}>• {issue}</div>
                        ))}
                      </div>
                    )}
                    {validation.warnings?.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: 'var(--warn)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Warnings</div>
                        {validation.warnings.map((w: string, i: number) => (
                          <div key={i} style={{ fontSize: 11, color: 'var(--warn)', marginBottom: 4 }}>• {w}</div>
                        ))}
                      </div>
                    )}
                    {validation.missing_component_suggestions?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--teal)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Suggested Missing Components</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {validation.missing_component_suggestions.map((s: string) => (
                            <span key={s} style={{ background: 'var(--teal-dim)', border: '1px solid rgba(0,212,170,0.3)', color: 'var(--teal)', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Version History */}
              {versions.length > 0 && (
                <div>
                  <div className="section-title">Version History</div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Version</th><th>Revision</th><th>Changed By</th><th>Summary</th><th>Date</th></tr>
                      </thead>
                      <tbody>
                        {versions.map(v => (
                          <tr key={v.id}>
                            <td><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>v{v.version_number}</span></td>
                            <td><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>Rev {v.revision}</span></td>
                            <td style={{ fontSize: 11 }}>{v.changed_by}</td>
                            <td style={{ fontSize: 11 }}>{v.change_summary}</td>
                            <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{new Date(v.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📦</div>
              <div style={{ fontSize: 13 }}>Select a BOM item to view details</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Click any item in the product structure tree</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../lib/api'
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle } from 'lucide-react'

const ROLES = [
  { value: 'engineer', label: 'Engineer', desc: 'Create & edit ECRs and BOMs' },
  { value: 'senior_engineer', label: 'Senior Engineer', desc: 'Engineer + extended visibility' },
  { value: 'approver', label: 'Approver', desc: 'Approve or reject ECRs only' },
  { value: 'viewer', label: 'Viewer', desc: 'Read-only access to all modules' },
]

const DEPARTMENTS = ['Engineering', 'Quality', 'Procurement', 'Management', 'IT', 'Manufacturing', 'R&D']

export default function RegisterPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const [form, setForm] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    confirm_password: '',
    role: 'engineer',
    department: 'Engineering',
    phone: '',
  })

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const validateStep1 = () => {
    if (!form.full_name.trim()) return 'Full name is required'
    if (!form.username.trim()) return 'Username is required'
    if (form.username.length < 3) return 'Username must be at least 3 characters'
    if (!form.email.includes('@')) return 'Valid email is required'
    return ''
  }

  const validateStep2 = () => {
    if (form.password.length < 6) return 'Password must be at least 6 characters'
    if (form.password !== form.confirm_password) return 'Passwords do not match'
    return ''
  }

  const handleNext = () => {
    const err = validateStep1()
    if (err) { setError(err); return }
    setError('')
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validateStep2()
    if (err) { setError(err); return }
    setLoading(true)
    setError('')
    try {
      await authApi.register({
        username: form.username,
        email: form.email,
        full_name: form.full_name,
        password: form.password,
        role: form.role,
        department: form.department,
        phone: form.phone,
      })
      setSuccess(true)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Registration failed. Try a different username or email.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-base)',
      }}>
        <div style={{
          width: 400, background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 40, textAlign: 'center',
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', background: 'var(--success-dim)',
            border: '2px solid var(--success)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <CheckCircle size={28} style={{ color: 'var(--success)' }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Account Created!</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
            Your account <strong style={{ color: 'var(--accent)' }}>{form.username}</strong> has been registered
            as <strong>{form.role.replace('_', ' ')}</strong>.
            <br /><br />
            <span style={{ color: 'var(--warn)', fontSize: 12 }}>
              Note: An admin may need to activate your account before you can log in.
            </span>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', height: 40, fontSize: 14 }}
            onClick={() => navigate('/login')}
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 20% 50%, rgba(13,110,253,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(0,212,170,0.06) 0%, transparent 40%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
        backgroundSize: '40px 40px', opacity: 0.3,
      }} />

      <div style={{
        width: 460, background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 32, position: 'relative', zIndex: 1,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, background: 'var(--accent)', borderRadius: 10,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'IBM Plex Mono', marginBottom: 10,
          }}>ECM</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Create Account</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>
            ECM System — New User Registration
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
          {[1, 2].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 11,
                fontWeight: 600, fontFamily: 'IBM Plex Mono', flexShrink: 0,
                background: step >= s ? 'var(--accent)' : 'var(--bg-elevated)',
                border: `2px solid ${step >= s ? 'var(--accent)' : 'var(--border)'}`,
                color: step >= s ? '#fff' : 'var(--text-muted)',
              }}>{s}</div>
              <div style={{ fontSize: 11, color: step >= s ? 'var(--text-primary)' : 'var(--text-muted)', marginLeft: 6, flex: 1 }}>
                {s === 1 ? 'Profile Info' : 'Security & Role'}
              </div>
              {i === 0 && <div style={{ width: 20, height: 1, background: 'var(--border)', flexShrink: 0 }} />}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--danger)', borderRadius: 6, padding: '8px 12px',
            fontSize: 12, marginBottom: 14,
          }}>{error}</div>
        )}

        <form onSubmit={step === 1 ? (e) => { e.preventDefault(); handleNext() } : handleSubmit}>
          {step === 1 && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Full Name *</label>
                <input className="form-control" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. John Doe" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label className="form-label">Username *</label>
                  <input className="form-control" value={form.username} onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g, '.'))} placeholder="e.g. john.doe" required />
                </div>
                <div>
                  <label className="form-label">Email *</label>
                  <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@company.com" required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <div>
                  <label className="form-label">Department</label>
                  <select className="form-control" value={form.department} onChange={e => set('department', e.target.value)}>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 555 0100" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', height: 40, fontSize: 14 }}>
                Next — Security & Role →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              {/* Role selection */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Select Your Role *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {ROLES.map(r => (
                    <div
                      key={r.value}
                      onClick={() => set('role', r.value)}
                      style={{
                        padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${form.role === r.value ? 'var(--accent)' : 'var(--border)'}`,
                        background: form.role === r.value ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 500, color: form.role === r.value ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {r.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{r.desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                  * Admin role requires direct assignment by a system administrator
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-control"
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="Min 6 characters"
                    style={{ paddingRight: 40 }}
                    required
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center',
                  }}>
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {/* Password strength */}
                {form.password && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 2 }}>
                      <div style={{
                        height: '100%', borderRadius: 2, transition: 'width 0.3s',
                        width: form.password.length >= 10 ? '100%' : form.password.length >= 6 ? '60%' : '30%',
                        background: form.password.length >= 10 ? 'var(--success)' : form.password.length >= 6 ? 'var(--warn)' : 'var(--danger)',
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                      Strength: {form.password.length >= 10 ? 'Strong' : form.password.length >= 6 ? 'Medium' : 'Weak'}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="form-label">Confirm Password *</label>
                <input
                  className="form-control"
                  type="password"
                  value={form.confirm_password}
                  onChange={e => set('confirm_password', e.target.value)}
                  placeholder="Repeat your password"
                  required
                />
                {form.confirm_password && form.password !== form.confirm_password && (
                  <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 4 }}>Passwords do not match</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setStep(1); setError('') }} style={{ height: 40 }}>
                  <ArrowLeft size={14} /> Back
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, height: 40, fontSize: 14 }} disabled={loading}>
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : 'Create Account'}
                </button>
              </div>
            </>
          )}
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign in</Link>
        </div>
      </div>
    </div>
  )
}

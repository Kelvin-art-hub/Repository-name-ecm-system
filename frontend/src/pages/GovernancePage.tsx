import { useState } from 'react'
import { usePermissions } from '../lib/usePermissions'
import GovDashboard from './governance/GovDashboard'
import PolicyManager from './governance/PolicyManager'
import WorkflowConfig from './governance/WorkflowConfig'
import UserManagement from './governance/UserManagement'
import AuditTrail from './governance/AuditTrail'
import ComplianceReport from './governance/ComplianceReport'
import { ShieldCheck, BookOpen, GitBranch, Users, Activity, BarChart2 } from 'lucide-react'

const TABS = [
  { id: 'dashboard',  label: 'Overview',          icon: ShieldCheck, minRole: 0 },
  { id: 'policies',   label: 'Policy Engine',      icon: BookOpen,    minRole: 1 },
  { id: 'workflows',  label: 'Approval Workflows', icon: GitBranch,   minRole: 1 },
  { id: 'users',      label: 'User Management',    icon: Users,       minRole: 3 },
  { id: 'audit',      label: 'Audit Trail',        icon: Activity,    minRole: 1 },
  { id: 'compliance', label: 'Compliance Report',  icon: BarChart2,   minRole: 3 },
]

const ROLE_LEVEL: Record<string, number> = { viewer: 0, engineer: 1, senior_engineer: 2, approver: 2, manager: 3, admin: 4 }

export default function GovernancePage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const { role } = usePermissions()
  const userLevel = ROLE_LEVEL[role] ?? 0
  const visibleTabs = TABS.filter(t => userLevel >= t.minRole)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Governance System</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Policy · Compliance · Audit · RBAC · Workflow</div>
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ background: 'var(--accent-glow)', border: '1px solid rgba(13,110,253,0.3)', borderRadius: 20, padding: '3px 10px', fontSize: 10, color: 'var(--accent)', fontFamily: 'IBM Plex Mono', letterSpacing: 1 }}>
            GOVERNANCE MODULE v2.0
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', padding: '0 20px', flexShrink: 0, overflowX: 'auto' }}>
        {visibleTabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: 'IBM Plex Sans', fontSize: 12, fontWeight: isActive ? 500 : 400, color: isActive ? 'var(--accent)' : 'var(--text-secondary)', borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              <Icon size={14} />{tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'dashboard'  && <GovDashboard />}
        {activeTab === 'policies'   && <PolicyManager />}
        {activeTab === 'workflows'  && <WorkflowConfig />}
        {activeTab === 'users'      && <UserManagement />}
        {activeTab === 'audit'      && <AuditTrail />}
        {activeTab === 'compliance' && <ComplianceReport />}
      </div>
    </div>
  )
}

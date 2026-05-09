import { useAuth } from '../contexts/AuthContext'

/**
 * Role permission matrix for the ECM system.
 *
 * Role hierarchy (highest → lowest):
 *   admin > manager > senior_engineer > approver > engineer > viewer
 */
export function usePermissions() {
  const { user } = useAuth()
  const role = user?.role || 'viewer'

  const is = (r: string) => role === r
  const isAdmin       = is('admin')
  const isManager     = is('manager') || isAdmin
  const isSrEngineer  = is('senior_engineer') || isManager
  const isApprover    = is('approver') || isManager
  const isEngineer    = is('engineer') || isSrEngineer
  const isViewer      = role === 'viewer'

  return {
    role,
    // What each role can do
    canCreateECR:     isEngineer,           // engineer, sr_engineer, manager, admin
    canEditECR:       isEngineer,
    canDeleteECR:     isManager,            // manager, admin only
    canSubmitECR:     isEngineer,
    canApprove:       isApprover,           // approver, manager, admin
    canManageUsers:   isManager,            // manager, admin only
    canLockBOM:       isEngineer,
    canCreateECN:     isEngineer,
    canViewAudit:     !isViewer || isAdmin, // everyone except pure viewer
    canViewAI:        true,                 // everyone can view AI analysis
    isReadOnly:       isViewer,
    isAdmin,
    isManager,
    isApprover,
    isEngineer,
    isViewer,
  }
}

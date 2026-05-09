import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return '—'
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  } catch {
    return '—'
  }
}

export function getPriorityBadge(priority: string): string {
  const map: Record<string, string> = {
    Critical: 'badge-red',
    High: 'badge-amber',
    Medium: 'badge-blue',
    Low: 'badge-gray',
  }
  return map[priority] || 'badge-gray'
}

export function getStatusBadge(status: string): string {
  const map: Record<string, string> = {
    Open: 'badge-blue',
    'In Review': 'badge-teal',
    'Pending Approval': 'badge-amber',
    Approved: 'badge-green',
    Rejected: 'badge-red',
    Closed: 'badge-gray',
    'On Hold': 'badge-amber',
    Draft: 'badge-gray',
    Released: 'badge-green',
    Obsolete: 'badge-red',
    Active: 'badge-green',
    Prototype: 'badge-teal',
    Pending: 'badge-amber',
    Skipped: 'badge-gray',
  }
  return map[status] || 'badge-gray'
}

export function getRiskColor(score: number): string {
  if (score >= 7) return '#ef4444'
  if (score >= 4) return '#f59e0b'
  return '#22c55e'
}

export function getRiskLabel(score: number): string {
  if (score >= 7) return 'High'
  if (score >= 4) return 'Medium'
  return 'Low'
}

export function getRiskBadge(score: number): string {
  if (score >= 7) return 'badge-red'
  if (score >= 4) return 'badge-amber'
  return 'badge-green'
}

export function getActionColor(action: string): string {
  const map: Record<string, string> = {
    CREATE: '#0d6efd',
    UPDATE: '#f59e0b',
    APPROVE: '#22c55e',
    REJECT: '#ef4444',
    LOGIN: '#00d4aa',
    LOGOUT: '#8899b0',
    DELETE: '#ef4444',
    LOCK: '#a855f7',
    UNLOCK: '#00d4aa',
    SUBMIT: '#0d6efd',
    GENERATE_ECN: '#00d4aa',
  }
  return map[action] || '#8899b0'
}

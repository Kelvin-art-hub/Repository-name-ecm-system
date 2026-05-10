import axios from 'axios'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL
  || (import.meta as any).env?.VITE_API_URL
  || 'https://repository-name-ecm-system-production.up.railway.app'

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ecm_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ecm_token')
      localStorage.removeItem('ecm_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/api/auth/login', { username, password }),
  register: (data: object) => api.post('/api/auth/register', data),
  me: () => api.get('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
  changePassword: (data: object) => api.post('/api/auth/change-password', data),
}

// Dashboard
export const dashboardApi = {
  getStats: () => api.get('/api/dashboard/stats'),
  getAIAnalysis: () => api.get('/api/dashboard/ai-analysis'),
}

// ECR
export const ecrApi = {
  list: (params?: object) => api.get('/api/ecrs', { params }),
  get: (id: number) => api.get(`/api/ecrs/${id}`),
  create: (data: object) => api.post('/api/ecrs', data),
  update: (id: number, data: object) => api.put(`/api/ecrs/${id}`, data),
  delete: (id: number) => api.delete(`/api/ecrs/${id}`),
  submit: (id: number) => api.post(`/api/ecrs/${id}/submit`),
}

// ECN
export const ecnApi = {
  list: (params?: object) => api.get('/api/ecns', { params }),
  get: (id: number) => api.get(`/api/ecns/${id}`),
  create: (data: object) => api.post('/api/ecns', data),
  update: (id: number, data: object) => api.put(`/api/ecns/${id}`, data),
  generateFromECR: (ecrId: number) => api.post(`/api/ecns/generate-from-ecr/${ecrId}`),
}

// BOM
export const bomApi = {
  getTree: () => api.get('/api/bom'),
  getFlat: (params?: object) => api.get('/api/bom/flat', { params }),
  get: (id: number) => api.get(`/api/bom/${id}`),
  create: (data: object) => api.post('/api/bom', data),
  update: (id: number, data: object) => api.put(`/api/bom/${id}`, data),
  delete: (id: number) => api.delete(`/api/bom/${id}`),
  lock: (id: number, data: object) => api.post(`/api/bom/${id}/lock`, data),
  unlock: (id: number) => api.post(`/api/bom/${id}/unlock`),
  getVersions: (id: number) => api.get(`/api/bom/${id}/versions`),
  compare: (id: number, versionA: number, versionB: number) =>
    api.get(`/api/bom/${id}/compare`, { params: { version_a: versionA, version_b: versionB } }),
  validate: (id: number) => api.get(`/api/bom/${id}/validate`),
}

// Approvals
export const approvalApi = {
  list: (params?: object) => api.get('/api/approvals', { params }),
  get: (id: number) => api.get(`/api/approvals/${id}`),
  action: (id: number, action: string, comments: string) =>
    api.post(`/api/approvals/${id}/action`, { action, comments }),
  assign: (id: number, username: string) =>
    api.put(`/api/approvals/${id}/assign`, null, { params: { approver_username: username } }),
}

// Audit
export const auditApi = {
  list: (params?: object) => api.get('/api/audit-logs', { params }),
  stats: () => api.get('/api/audit-logs/stats'),
}

// Users
export const usersApi = {
  list: () => api.get('/api/users'),
  get: (id: number) => api.get(`/api/users/${id}`),
  update: (id: number, data: object) => api.put(`/api/users/${id}`, data),
}

// AI
export const aiApi = {
  analyzeECR: (data: object) => api.post('/api/ai/analyze-ecr', data),
  validateBOM: (id: number) => api.get(`/api/ai/validate-bom/${id}`),
  quantityImpact: (data: object) => api.post('/api/ai/quantity-impact', data),
  insights: () => api.get('/api/ai/insights'),
}

// Governance
export const governanceApi = {
  dashboard: () => api.get('/api/governance/dashboard'),
  listPolicies: (params?: object) => api.get('/api/governance/policies', { params }),
  createPolicy: (data: object) => api.post('/api/governance/policies', data),
  updatePolicy: (id: number, data: object) => api.put(`/api/governance/policies/${id}`, data),
  deletePolicy: (id: number) => api.delete(`/api/governance/policies/${id}`),
  validatePolicies: (entity_type: string, entity_data: object) => api.post('/api/governance/policies/validate', { entity_type, entity_data }),
  listViolations: (params?: object) => api.get('/api/governance/violations', { params }),
  resolveViolation: (id: number, data: object) => api.post(`/api/governance/violations/${id}/resolve`, data),
  listTemplates: () => api.get('/api/governance/workflow-templates'),
  createTemplate: (data: object) => api.post('/api/governance/workflow-templates', data),
  updateTemplate: (id: number, data: object) => api.put(`/api/governance/workflow-templates/${id}`, data),
  complianceReport: (days?: number) => api.get('/api/governance/compliance-report', { params: { days } }),
  listUsersGovernance: () => api.get('/api/governance/users'),
  changeUserRole: (id: number, role: string) => api.put(`/api/governance/users/${id}/role`, null, { params: { new_role: role } }),
  toggleUserActive: (id: number) => api.put(`/api/governance/users/${id}/toggle-active`),
  createUser: (data: object) => api.post('/api/governance/users/create', data),
  auditTrail: (params?: object) => api.get('/api/governance/audit-trail', { params }),
}

import { authHeaders } from './auth'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function req(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Error ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Dashboard
  dashboard: (fxRate = 17.5) => req(`/dashboard?fx_rate=${fxRate}`),

  // Banks
  banks: {
    list: () => req('/banks'),
    create: (d: any) => req('/banks', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: string, d: any) => req(`/banks/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    delete: (id: string) => req(`/banks/${id}`, { method: 'DELETE' }),
  },

  // Receivables
  receivables: {
    list: (status?: string) => req(`/receivables${status ? `?status=${status}` : ''}`),
    create: (d: any) => req('/receivables', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: string, d: any) => req(`/receivables/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    delete: (id: string) => req(`/receivables/${id}`, { method: 'DELETE' }),
  },

  // Payables
  payables: {
    list: (status?: string, priority?: string) => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (priority) params.set('priority', priority)
      return req(`/payables${params.toString() ? '?' + params : ''}`)
    },
    create: (d: any) => req('/payables', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: string, d: any) => req(`/payables/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    delete: (id: string) => req(`/payables/${id}`, { method: 'DELETE' }),
  },

  // Debt
  debt: {
    list: () => req('/debt'),
    create: (d: any) => req('/debt', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: string, d: any) => req(`/debt/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    delete: (id: string) => req(`/debt/${id}`, { method: 'DELETE' }),
  },

  // Others
  others: {
    list: (direction?: string, category?: string) => {
      const params = new URLSearchParams()
      if (direction) params.set('direction', direction)
      if (category) params.set('category', category)
      return req(`/others${params.toString() ? '?' + params : ''}`)
    },
    create: (d: any) => req('/others', { method: 'POST', body: JSON.stringify(d) }),
    update: (id: string, d: any) => req(`/others/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    delete: (id: string) => req(`/others/${id}`, { method: 'DELETE' }),
  },
}

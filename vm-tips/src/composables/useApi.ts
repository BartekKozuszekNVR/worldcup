export interface ApiError extends Error {
  statusCode?: number
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

export async function apiFetch<T>(url: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options
  const fetchOptions: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    credentials: 'include',
  }
  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body)
  }
  const response = await fetch(url, fetchOptions)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }))
    const err: ApiError = new Error(errorData.message || 'Request failed')
    err.statusCode = response.status
    throw err
  }
  return response.json() as Promise<T>
}

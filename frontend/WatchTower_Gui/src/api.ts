export interface Account {
  id: string
  name: string
  slug: string
  api_key: string | null
  created_at: string
  updated_at: string
}

export type MonitorType = 'HTTP' | 'TCP' | 'DNS' | 'ICMP'

export interface Monitor {
  id: string
  account_id: string
  name: string
  type: MonitorType
  target: string
  port: number | null
  http_method: string | null
  expected_status_code: number | null
  headers: Record<string, unknown> | null
  body: string | null
  dns_query_type: string | null
  dns_expected_result: string | null
  interval_seconds: number
  timeout_seconds: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MonitorCheck {
  id: number
  monitor_id: string
  is_up: boolean
  status_code: number | null
  response_time_ms: number | null
  error_message: string | null
  created_at: string
}

export interface Incident {
  id: string
  monitor_id: string
  started_at: string
  resolved_at: string | null
  cause: string
  is_resolved: boolean
}

export interface AppConfig {
  key: string
  value: unknown
  updated_at: string
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, options)

  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(res.status, text || `Request failed (${res.status})`)
  }

  if (res.status === 204) return undefined as T

  const type = res.headers.get('content-type') || ''
  const body = type.includes('application/json') ? await res.json() : null
  return (body ?? undefined) as T
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m ${seconds % 60}s`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}
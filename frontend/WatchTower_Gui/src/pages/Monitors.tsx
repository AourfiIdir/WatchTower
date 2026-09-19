import { type FormEvent, useEffect, useState } from 'react'
import {
  apiFetch,
  type Account,
  type Monitor,
  type MonitorType,
} from '../api'
import './Monitors.css'
import '../shared.css'

interface FormStatus {
  type: 'success' | 'error'
  message: string
}

function Monitors() {
  const [monitors, setMonitors] = useState<Monitor[] | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Monitor | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formStatus, setFormStatus] = useState<FormStatus | null>(null)

  const [accId, setAccId] = useState('')
  const [name, setName] = useState('')
  const [mType, setMType] = useState<MonitorType>('HTTP')
  const [target, setTarget] = useState('')
  const [port, setPort] = useState('')
  const [httpMethod, setHttpMethod] = useState('GET')
  const [expectedStatus, setExpectedStatus] = useState('200')
  const [intervalSec, setIntervalSec] = useState('')
  const [timeoutSec, setTimeoutSec] = useState('')

  async function loadMonitors() {
    const data = await apiFetch<Monitor[]>('/monitors')
    setMonitors(data)
  }

  useEffect(() => {
    const controller = new AbortController()

    fetch('/monitors', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load monitors (${res.status})`)
        return res.json()
      })
      .then((data: Monitor[]) => setMonitors(data))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load monitors')
      })

    fetch('/accounts', { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<Account[]>) : []))
      .then(setAccounts)
      .catch(() => setAccounts([]))

    return () => controller.abort()
  }, [])

  function resetForm() {
    setName('')
    setMType('HTTP')
    setTarget('')
    setPort('')
    setHttpMethod('GET')
    setExpectedStatus('200')
    setIntervalSec('')
    setTimeoutSec('')
    setFormStatus(null)
  }

  function openEdit(monitor: Monitor) {
    setName(monitor.name)
    setMType(monitor.type)
    setTarget(monitor.target)
    setPort(monitor.port !== null ? String(monitor.port) : '')
    setHttpMethod(monitor.http_method ?? 'GET')
    setExpectedStatus(
      monitor.expected_status_code !== null
        ? String(monitor.expected_status_code)
        : '200',
    )
    setIntervalSec(String(monitor.interval_seconds))
    setTimeoutSec(String(monitor.timeout_seconds))
    setAccId(monitor.account_id)
    setEditing(monitor)
    setFormStatus(null)
    setFormOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormStatus(null)

    const payload: Record<string, unknown> = {
      account_id: accId,
      name,
      type: mType,
      target,
      interval_seconds: Number(intervalSec) || 60,
      timeout_seconds: Number(timeoutSec) || 10,
    }

    if (mType === 'HTTP') {
      payload.http_method = httpMethod
      payload.expected_status_code = Number(expectedStatus)
    }

    if (mType === 'TCP' || mType === 'DNS') {
      if (port) payload.port = Number(port)
    }

    try {
      const label = editing
        ? `Monitor "${name}" updated`
        : `Monitor "${name}" created`
      const path = editing ? `/monitors/${editing.id}` : '/monitors/insert_monitor'
      const method = editing ? 'PUT' : 'POST'

      await apiFetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setFormStatus({ type: 'success', message: label })
      resetForm()
      setFormOpen(false)
      await loadMonitors()
    } catch (err) {
      setFormStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Request failed',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(monitor: Monitor) {
    try {
      await apiFetch(`/monitors/${monitor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !monitor.is_active }),
      })
      await loadMonitors()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to update monitor')
    }
  }

  async function handleDelete(monitor: Monitor) {
    if (!window.confirm(`Delete monitor "${monitor.name}"? This is permanent.`)) return
    try {
      await apiFetch(`/monitors/${monitor.id}`, { method: 'DELETE' })
      await loadMonitors()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete monitor')
    }
  }

  function accountName(id: string): string {
    return accounts.find((a) => a.id === id)?.name ?? id.slice(0, 8)
  }

  return (
    <div className="monitors-page">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Monitors</h1>
            <p className="page-description">
              Manage and configure your uptime monitors.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setFormOpen(!formOpen)}>
            {formOpen ? 'Cancel' : '+ New monitor'}
          </button>
        </div>
      </div>

      <div className="page-content">
        {error && (
          <div className="monitors-error">
            <span>{error}</span>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {formOpen && (
          <form className="monitor-form" onSubmit={handleSubmit}>
            <h3 className="monitor-form-title">
              {editing ? `Edit monitor: ${editing.name}` : 'Create monitor'}
            </h3>

            <div className="form-grid">
              <label className="form-field form-field-full">
                <span className="form-label">Name</span>
                <input
                  type="text"
                  required
                  maxLength={255}
                  placeholder="e.g. My API"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label className="form-field">
                <span className="form-label">Account</span>
                <select
                  required
                  value={accId}
                  onChange={(e) => setAccId(e.target.value)}
                >
                  <option value="" disabled>
                    Select account…
                  </option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span className="form-label">Type</span>
                <select
                  value={mType}
                  onChange={(e) => setMType(e.target.value as MonitorType)}
                >
                  <option value="HTTP">HTTP</option>
                  <option value="TCP">TCP</option>
                  <option value="DNS">DNS</option>
                  <option value="ICMP">ICMP</option>
                </select>
              </label>

              <label className="form-field form-field-full">
                <span className="form-label">Target</span>
                <input
                  type="text"
                  required
                  maxLength={2048}
                  placeholder={
                    mType === 'HTTP'
                      ? 'https://example.com'
                      : mType === 'TCP'
                        ? 'host / IP address'
                        : mType === 'DNS'
                          ? 'domain name'
                          : 'host / IP address'
                  }
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </label>

              {(mType === 'TCP' || mType === 'DNS') && (
                <label className="form-field">
                  <span className="form-label">Port</span>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    placeholder={mType === 'DNS' ? '53' : 'e.g. 5432'}
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </label>
              )}

              {mType === 'HTTP' && (
                <>
                  <label className="form-field">
                    <span className="form-label">Method</span>
                    <select
                      value={httpMethod}
                      onChange={(e) => setHttpMethod(e.target.value)}
                    >
                      {['GET', 'POST', 'PUT', 'DELETE', 'HEAD'].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    <span className="form-label">Expected status</span>
                    <input
                      type="number"
                      min={100}
                      max={599}
                      value={expectedStatus}
                      onChange={(e) => setExpectedStatus(e.target.value)}
                    />
                  </label>
                </>
              )}

              <label className="form-field">
                <span className="form-label">Interval (s)</span>
                <input
                  type="number"
                  min={5}
                  placeholder="default 60"
                  value={intervalSec}
                  onChange={(e) => setIntervalSec(e.target.value)}
                />
              </label>

              <label className="form-field">
                <span className="form-label">Timeout (s)</span>
                <input
                  type="number"
                  min={1}
                  placeholder="default 10"
                  value={timeoutSec}
                  onChange={(e) => setTimeoutSec(e.target.value)}
                />
              </label>
            </div>

            {formStatus && (
              <div className={`form-status ${formStatus.type}`} role="alert">
                {formStatus.message}
              </div>
            )}

            <div className="monitor-form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setFormOpen(false)
                  setEditing(null)
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
              >
                {submitting
                  ? 'Saving…'
                  : editing
                    ? 'Save changes'
                    : 'Create monitor'}
              </button>
            </div>
          </form>
        )}

        {!error && monitors === null && (
          <div className="monitors-loading">
            <div className="spinner" />
            <span>Loading monitors…</span>
          </div>
        )}

        {!error && monitors !== null && monitors.length === 0 && (
          <div className="monitors-empty">
            <div className="placeholder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <h2 className="placeholder-title">No monitors yet</h2>
            <p className="placeholder-text">
              Create your first HTTP, TCP, DNS, or ICMP monitor to start tracking services.
            </p>
          </div>
        )}

        {!error && monitors !== null && monitors.length > 0 && (
          <div className="monitor-grid">
            {monitors.map((monitor) => (
              <div
                key={monitor.id}
                className={`monitor-card type-${monitor.type.toLowerCase()}`}
              >
                <div className="monitor-card-top">
                  <span className={`monitor-type type-${monitor.type.toLowerCase()}`}>
                    {monitor.type}
                  </span>
                  <span
                    className={`monitor-status ${monitor.is_active ? 'active' : 'paused'}`}
                  >
                    <span className={`status-dot ${monitor.is_active ? 'up' : 'down'}`} />
                    {monitor.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>

                <h3 className="monitor-name">{monitor.name}</h3>

                <div className="monitor-target" title={monitor.target}>
                  {monitor.target}
                  {monitor.port ? `:${monitor.port}` : ''}
                </div>

                <div className="monitor-account">{accountName(monitor.account_id)}</div>

                <div className="monitor-meta">
                  <div className="meta-item">
                    <span className="meta-label">Interval</span>
                    <span className="meta-value">{monitor.interval_seconds}s</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Timeout</span>
                    <span className="meta-value">{monitor.timeout_seconds}s</span>
                  </div>
                  {monitor.http_method && (
                    <div className="meta-item">
                      <span className="meta-label">Method</span>
                      <span className="meta-value">{monitor.http_method}</span>
                    </div>
                  )}
                  {monitor.expected_status_code !== null && (
                    <div className="meta-item">
                      <span className="meta-label">Expected</span>
                      <span className="meta-value">{monitor.expected_status_code}</span>
                    </div>
                  )}
                </div>

                <div className="monitor-card-actions">
                  <button
                    className={`toggle ${monitor.is_active ? 'on' : ''}`}
                    onClick={() => toggleActive(monitor)}
                    title={monitor.is_active ? 'Pause monitoring' : 'Resume monitoring'}
                  >
                    {monitor.is_active ? 'Pause' : 'Resume'}
                  </button>
                  <button onClick={() => openEdit(monitor)}>Edit</button>
                  <button className="delete" onClick={() => handleDelete(monitor)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Monitors
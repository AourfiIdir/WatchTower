import { type FormEvent, useEffect, useState } from 'react'
import {
  apiFetch,
  formatDate,
  type Incident,
  type Monitor,
} from '../api'
import './Incidents.css'
import '../shared.css'

interface FormStatus {
  type: 'success' | 'error'
  message: string
}

function Duration({ incident }: { incident: Incident }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (incident.is_resolved) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [incident.is_resolved])

  const start = new Date(incident.started_at).getTime()
  const end = incident.resolved_at ? new Date(incident.resolved_at).getTime() : now
  const seconds = Math.max(0, Math.floor((end - start) / 1000))

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const padded = (n: number) => String(n).padStart(2, '0')

  return (
    <span className={incident.is_resolved ? 'mono' : 'mono live-duration'}>
      {h > 0 ? `${h}:` : ''}
      {padded(m)}:{padded(s)}
    </span>
  )
}

function Incidents() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null)
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [monitorId, setMonitorId] = useState('')
  const [cause, setCause] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formStatus, setFormStatus] = useState<FormStatus | null>(null)

  async function load() {
    const data = await apiFetch<Incident[]>('/incidents')
    setIncidents(data)
  }

  useEffect(() => {
    const controller = new AbortController()

    fetch('/incidents', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load incidents (${res.status})`)
        return res.json()
      })
      .then((data: Incident[]) => setIncidents(data))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load incidents')
      })

    fetch('/monitors', { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<Monitor[]>) : []))
      .then(setMonitors)
      .catch(() => setMonitors([]))

    return () => controller.abort()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormStatus(null)

    try {
      await apiFetch('/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitor_id: monitorId, cause }),
      })

      setFormStatus({ type: 'success', message: 'Incident recorded' })
      setMonitorId('')
      setCause('')
      setFormOpen(false)
      await load()
    } catch (err) {
      setFormStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create incident',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResolve(incident: Incident) {
    try {
      await apiFetch(`/incidents/${incident.id}/resolve`, { method: 'PUT' })
      await load()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to resolve incident')
    }
  }

  async function handleDelete(incident: Incident) {
    if (!window.confirm('Delete this incident record?')) return
    try {
      await apiFetch(`/incidents/${incident.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete incident')
    }
  }

  function monitorName(id: string): string {
    return monitors.find((m) => m.id === id)?.name ?? id.slice(0, 8)
  }

  const activeCount = incidents?.filter((i) => !i.is_resolved).length ?? 0

  return (
    <div className="incidents-page">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Incidents</h1>
            <p className="page-description">
              Track and resolve service incidents.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setFormOpen(!formOpen)}>
            {formOpen ? 'Cancel' : '+ Record incident'}
          </button>
        </div>
      </div>

      <div className="page-content">
        {error && (
          <div className="incidents-error">
            <span>{error}</span>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {formOpen && (
          <form className="incident-form" onSubmit={handleCreate}>
            <h3 className="incident-form-title">Record incident</h3>

            <div className="form-grid">
              <label className="form-field">
                <span className="form-label">Monitor</span>
                <select
                  required
                  value={monitorId}
                  onChange={(e) => setMonitorId(e.target.value)}
                >
                  <option value="" disabled>
                    Select monitor…
                  </option>
                  {monitors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.target})
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span className="form-label">Cause</span>
                <input
                  type="text"
                  required
                  maxLength={500}
                  placeholder="e.g. connection timeout"
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                />
              </label>
            </div>

            {formStatus && (
              <div className={`form-status ${formStatus.type}`} role="alert">
                {formStatus.message}
              </div>
            )}

            <div className="incident-form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Recording…' : 'Record incident'}
              </button>
            </div>
          </form>
        )}

        {!error && incidents === null && (
          <div className="incidents-loading">
            <div className="spinner" />
            <span>Loading incidents…</span>
          </div>
        )}

        {!error && incidents !== null && (
          <div className="content-card">
            <div className="content-card-header">
              <span className="content-card-title">Incident history</span>
              <span className="content-card-badge badge-live">
                {activeCount} active
              </span>
            </div>

            <div className="content-card-body no-pad">
              {incidents.length === 0 ? (
                <div className="empty-note">
                  No incidents recorded. The monitoring engine will create these
                  automatically when a check fails.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Monitor</th>
                      <th>Started</th>
                      <th>Resolved</th>
                      <th>Duration</th>
                      <th>Cause</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((incident) => (
                      <tr key={incident.id}>
                        <td>
                          <span
                            className={`badge ${incident.is_resolved ? 'badge-resolved' : 'badge-open'}`}
                          >
                            {incident.is_resolved ? 'Resolved' : 'Open'}
                          </span>
                        </td>
                        <td className="url">{monitorName(incident.monitor_id)}</td>
                        <td className="mono">{formatDate(incident.started_at)}</td>
                        <td className="mono">
                          {incident.resolved_at ? formatDate(incident.resolved_at) : '—'}
                        </td>
                        <td>
                          <Duration incident={incident} />
                        </td>
                        <td>{incident.cause}</td>
                        <td>
                          <div className="table-actions">
                            {!incident.is_resolved && (
                              <button onClick={() => handleResolve(incident)}>
                                Resolve
                              </button>
                            )}
                            <button
                              className="danger"
                              onClick={() => handleDelete(incident)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Incidents
import { useEffect, useState } from 'react'
import { apiFetch, formatDate, type Monitor, type MonitorCheck } from '../api'
import './Checks.css'
import '../shared.css'

function Checks() {
  const [checks, setChecks] = useState<MonitorCheck[] | null>(null)
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  async function load(path?: string) {
    const actual = path ?? (filter ? `/checks/monitor/${filter}` : '/checks')
    const data = await apiFetch<MonitorCheck[]>(actual)
    setChecks(data)
  }

  async function handleFilterChange(value: string) {
    setFilter(value)
    try {
      await load(value ? `/checks/monitor/${value}` : '/checks')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load checks')
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    fetch('/checks', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load checks (${res.status})`)
        return res.json()
      })
      .then((data: MonitorCheck[]) => setChecks(data))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load checks')
      })

    fetch('/monitors', { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<Monitor[]>) : []))
      .then(setMonitors)
      .catch(() => setMonitors([]))

    return () => controller.abort()
  }, [])

  async function handleDelete(check: MonitorCheck) {
    if (!window.confirm('Delete this check record?')) return
    try {
      await apiFetch(`/checks/${check.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete check')
    }
  }

  function monitorName(id: string): string {
    return monitors.find((m) => m.id === id)?.name ?? id.slice(0, 8)
  }

  const upCount = checks?.filter((c) => c.is_up).length ?? 0

  return (
    <div className="checks-page">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Checks</h1>
            <p className="page-description">
              Raw probe results produced by the monitoring engine.
            </p>
          </div>
          {checks !== null && checks.length > 0 && (
            <label className="checks-filter">
              <span className="form-label">Filter by monitor</span>
              <select
                value={filter}
                onChange={(e) => handleFilterChange(e.target.value)}
              >
                <option value="">All monitors</option>
                {monitors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="page-content">
        {error && (
          <div className="checks-error">
            <span>{error}</span>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {!error && monitors.length > 0 && (
          <div className="checks-summary">
            {upCount} of {checks?.length ?? 0} checks up
          </div>
        )}

        {!error && checks === null && (
          <div className="checks-loading">
            <div className="spinner" />
            <span>Loading checks…</span>
          </div>
        )}

        {!error && checks !== null && (
          <div className="content-card">
            <div className="content-card-header">
              <span className="content-card-title">
                {filter ? 'Check history — filtered' : 'Check history'}
              </span>
              <span className="content-card-badge badge-live">latest 200</span>
            </div>

            <div className="content-card-body no-pad">
              {checks.length === 0 ? (
                <div className="empty-note">
                  No checks yet. The monitoring engine writes a row here on every probe.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Monitor</th>
                      <th>Code</th>
                      <th>Latency</th>
                      <th>Time</th>
                      <th>Message</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.map((check) => (
                      <tr key={check.id}>
                        <td>
                          <span className={`badge ${check.is_up ? 'badge-up' : 'badge-down'}`}>
                            {check.is_up ? 'UP' : 'DOWN'}
                          </span>
                        </td>
                        <td className="url">{monitorName(check.monitor_id)}</td>
                        <td className="mono">
                          {check.status_code !== null ? check.status_code : '—'}
                        </td>
                        <td className="mono">
                          {check.response_time_ms !== null
                            ? `${check.response_time_ms} ms`
                            : '—'}
                        </td>
                        <td className="mono">{formatDate(check.created_at)}</td>
                        <td className="check-message" title={check.error_message ?? ''}>
                          {check.error_message ?? ''}
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="danger"
                              onClick={() => handleDelete(check)}
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

export default Checks
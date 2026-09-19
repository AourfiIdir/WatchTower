import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate, type Incident, type Monitor, type MonitorCheck } from '../api'
import './Welcome.css'
import '../shared.css'

interface LiveData {
  monitors: Monitor[]
  checks: MonitorCheck[]
  incidents: Incident[]
}

function Welcome() {
  const [data, setData] = useState<LiveData | null>(null)
  const [dayAgo] = useState(() => Date.now() - 24 * 60 * 60 * 1000)

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      fetch('/monitors', { signal: controller.signal }).then((r) =>
        r.ok ? (r.json() as Promise<Monitor[]>) : [],
      ),
      fetch('/checks', { signal: controller.signal }).then((r) =>
        r.ok ? (r.json() as Promise<MonitorCheck[]>) : [],
      ),
      fetch('/incidents', { signal: controller.signal }).then((r) =>
        r.ok ? (r.json() as Promise<Incident[]>) : [],
      ),
    ])
      .then(([monitors, checks, incidents]) => setData({ monitors, checks, incidents }))
      .catch(() => setData({ monitors: [], checks: [], incidents: [] }))

    return () => controller.abort()
  }, [])

  const totalMonitors = data?.monitors.length ?? 0
  const activeMonitors = data?.monitors.filter((m) => m.is_active).length ?? 0

  const checks = data?.checks ?? []
  const upChecks = checks.filter((c) => c.is_up).length
  const uptime = checks.length > 0 ? Math.round((upChecks / checks.length) * 100) : null

  const openIncidents = data?.incidents.filter((i) => !i.is_resolved).length ?? 0

  const checksToday = checks.filter((c) => new Date(c.created_at).getTime() >= dayAgo).length

  const monitorName = (id: string) =>
    data?.monitors.find((m) => m.id === id)?.name ?? id.slice(0, 8)

  const recent = checks.slice(0, 8)

  return (
    <div className="welcome-page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">Welcome back. Here's your monitoring overview.</p>
      </div>

      <div className="page-content">
        <section className="hero-section">
          <div className="hero-greeting">Welcome to WatchTower</div>
          <h2 className="hero-name">Idir Aourfi</h2>
          <p className="hero-tagline">
            Your self-hosted uptime monitoring platform. Track services, detect incidents,
            and stay informed with real-time status checks.
          </p>
          <div className="hero-social">
            <a
              href="https://github.com/AourfiIdir"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/aourfi-idir-1670022b8/"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn
            </a>
          </div>
        </section>

        <div className="stats-grid">
          <div className="stat-card accent">
            <div className="stat-header">
              <span className="stat-label">Total Monitors</span>
              <div className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
            </div>
            <div className="stat-value">{totalMonitors}</div>
            <div className="stat-change">
              {totalMonitors > 0
                ? `${activeMonitors} active monitor${activeMonitors === 1 ? '' : 's'}`
                : 'No monitors configured yet'}
            </div>
          </div>

          <div className="stat-card success">
            <div className="stat-header">
              <span className="stat-label">Uptime</span>
              <div className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
            </div>
            <div className="stat-value">
              {uptime === null ? '--' : `${uptime}%`}
            </div>
            <div className="stat-change">
              {checks.length > 0
                ? `${upChecks} of ${checks.length} checks up`
                : 'Awaiting first check'}
            </div>
          </div>

          <div className="stat-card danger">
            <div className="stat-header">
              <span className="stat-label">Open Incidents</span>
              <div className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            </div>
            <div className="stat-value">{openIncidents}</div>
            <div className="stat-change">
              {openIncidents > 0
                ? 'Incidents requiring attention'
                : 'No active incidents'}
            </div>
          </div>

          <div className="stat-card info">
            <div className="stat-header">
              <span className="stat-label">Checks Today</span>
              <div className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
            </div>
            <div className="stat-value">{checksToday}</div>
            <div className="stat-change">Last 24 hours</div>
          </div>
        </div>

        <div className="content-grid">
          <div className="content-card">
            <div className="content-card-header">
              <span className="content-card-title">Recent Activity</span>
              <span className="content-card-badge badge-live">Live</span>
            </div>
            <div className="content-card-body">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Monitor</th>
                    <th>Latency</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                        No activity yet. The engine will log checks here.
                      </td>
                    </tr>
                  ) : (
                    recent.map((check) => (
                      <tr key={check.id}>
                        <td>
                          <span className={`badge ${check.is_up ? 'badge-up' : 'badge-down'}`}>
                            {check.is_up ? 'UP' : 'DOWN'}
                          </span>
                        </td>
                        <td className="activity-name">{monitorName(check.monitor_id)}</td>
                        <td>
                          {check.response_time_ms !== null
                            ? `${check.response_time_ms} ms`
                            : '—'}
                        </td>
                        <td className="activity-time">{formatDate(check.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="content-card">
            <div className="content-card-header">
              <span className="content-card-title">Quick Actions</span>
            </div>
            <div className="content-card-body">
              <div className="quick-links">
                <Link to="/monitors" className="quick-link">
                  <span>
                    <svg style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 8 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create a new monitor
                  </span>
                  <span className="quick-link-arrow">→</span>
                </Link>
                <Link to="/monitors" className="quick-link">
                  <span>
                    <svg style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 8 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    View all monitors
                  </span>
                  <span className="quick-link-arrow">→</span>
                </Link>
                <Link to="/checks" className="quick-link">
                  <span>
                    <svg style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 8 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Browse checks
                  </span>
                  <span className="quick-link-arrow">→</span>
                </Link>
                <Link to="/incidents" className="quick-link">
                  <span>
                    <svg style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 8 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Check incidents
                  </span>
                  <span className="quick-link-arrow">→</span>
                </Link>
                <Link to="/settings" className="quick-link">
                  <span>
                    <svg style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 8 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                    Configure settings
                  </span>
                  <span className="quick-link-arrow">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Welcome
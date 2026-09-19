import { type FormEvent, useEffect, useState } from 'react'
import { apiFetch, type Account, type AppConfig } from '../api'
import './Settings.css'
import '../shared.css'

interface FormStatus {
  type: 'success' | 'error'
  message: string
}

function Settings() {
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [configs, setConfigs] = useState<AppConfig[] | null>(null)

  // ── Account form ──
  const [accName, setAccName] = useState('')
  const [accSlug, setAccSlug] = useState('')
  const [editingAcc, setEditingAcc] = useState<Account | null>(null)
  const [accSubmitting, setAccSubmitting] = useState(false)
  const [accStatus, setAccStatus] = useState<FormStatus | null>(null)
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({})

  // ── Config form ──
  const [cfgKey, setCfgKey] = useState('')
  const [cfgValue, setCfgValue] = useState('')
  const [cfgSubmitting, setCfgSubmitting] = useState(false)
  const [cfgStatus, setCfgStatus] = useState<FormStatus | null>(null)

  async function loadAccounts() {
    setAccounts(await apiFetch<Account[]>('/accounts'))
  }

  async function loadConfigs() {
    setConfigs(await apiFetch<AppConfig[]>('/config'))
  }

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      fetch('/accounts', { signal: controller.signal }).then((r) =>
        r.ok ? (r.json() as Promise<Account[]>) : null,
      ),
      fetch('/config', { signal: controller.signal }).then((r) =>
        r.ok ? (r.json() as Promise<AppConfig[]>) : null,
      ),
    ])
      .then(([accs, cfgs]) => {
        setAccounts(accs)
        setConfigs(cfgs)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [])

  // ── Account handlers ──
  async function handleAccountSubmit(e: FormEvent) {
    e.preventDefault()
    setAccSubmitting(true)
    setAccStatus(null)

    try {
      if (editingAcc) {
        await apiFetch(`/accounts/${editingAcc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: accName, slug: accSlug.trim() || undefined }),
        })
        setAccStatus({ type: 'success', message: 'Workspace updated' })
      } else {
        await apiFetch('/accounts/insert_account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: accName, slug: accSlug.trim() || undefined }),
        })
        setAccStatus({
          type: 'success',
          message: `Workspace "${accName}" created`,
        })
      }

      setEditingAcc(null)
      setAccName('')
      setAccSlug('')
      await loadAccounts()
    } catch (err) {
      setAccStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Request failed',
      })
    } finally {
      setAccSubmitting(false)
    }
  }

  function startEditAccount(account: Account) {
    setEditingAcc(account)
    setAccName(account.name)
    setAccSlug(account.slug)
    setAccStatus(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEditAccount() {
    setEditingAcc(null)
    setAccName('')
    setAccSlug('')
    setAccStatus(null)
  }

  async function regenerateKey(account: Account) {
    if (
      !window.confirm(
        `Regenerate API key for "${account.name}"? The old key will stop working immediately.`,
      )
    )
      return
    try {
      await apiFetch(`/accounts/${account.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate_new_api_key: true }),
      })
      await loadAccounts()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to regenerate key')
    }
  }

  async function deleteAccount(account: Account) {
    if (
      !window.confirm(
        `Delete workspace "${account.name}"? Its monitors will also be deleted.`,
      )
    )
      return
    try {
      await apiFetch(`/accounts/${account.id}`, { method: 'DELETE' })
      await loadAccounts()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete account')
    }
  }

  async function copyApiKey(account: Account) {
    if (!account.api_key) return
    try {
      await navigator.clipboard.writeText(account.api_key)
    } catch {
      window.prompt('Copy API key:', account.api_key)
    }
  }

  function maskKey(key: string): string {
    if (key.length <= 12) return '••••••••'
    return `${key.slice(0, 10)}••••••••${key.slice(-4)}`
  }

  // ── Config handlers ──
  async function handleConfigSubmit(e: FormEvent) {
    e.preventDefault()
    setCfgSubmitting(true)
    setCfgStatus(null)

    let value: unknown
    try {
      value = JSON.parse(cfgValue)
    } catch {
      setCfgStatus({ type: 'error', message: 'Value must be valid JSON' })
      setCfgSubmitting(false)
      return
    }

    try {
      await apiFetch('/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: cfgKey, value }),
      })
      setCfgStatus({ type: 'success', message: `Setting "${cfgKey}" saved` })
      setCfgKey('')
      setCfgValue('')
      await loadConfigs()
    } catch (err) {
      setCfgStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Request failed',
      })
    } finally {
      setCfgSubmitting(false)
    }
  }

  function startEditConfig(config: AppConfig) {
    setCfgKey(config.key)
    setCfgValue(JSON.stringify(config.value, null, 2))
    setCfgStatus(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteConfig(config: AppConfig) {
    if (!window.confirm(`Delete setting "${config.key}"?`)) return
    try {
      await apiFetch(`/config/${encodeURIComponent(config.key)}`, { method: 'DELETE' })
      await loadConfigs()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete setting')
    }
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage workspaces and configuration.</p>
      </div>

      <div className="page-content settings-stack">
        {/* ── Workspaces ── */}
        <div className="settings-grid">
          <div className="content-card">
            <div className="content-card-header">
              <span className="content-card-title">Workspaces</span>
              {accounts !== null && (
                <span className="content-card-badge badge-live">
                  {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
                </span>
              )}
            </div>

            <div className="content-card-body no-pad">
              {accounts === null ? (
                <div className="settings-loading">Loading workspaces…</div>
              ) : accounts.length === 0 ? (
                <div className="settings-empty">
                  No workspaces yet. Create your first one.
                </div>
              ) : (
                <table className="accounts-table settings-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>API key</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id}>
                        <td>
                          <div className="account-name">{account.name}</div>
                          <div className="account-slug">{account.slug}</div>
                        </td>
                        <td>
                          <div className="api-key-cell">
                            <span className="mono">
                              {account.api_key
                                ? revealedKeys[account.id]
                                  ? account.api_key
                                  : maskKey(account.api_key)
                                : '—'}
                            </span>
                            {account.api_key && (
                              <div className="api-key-actions">
                                <button
                                  onClick={() =>
                                    setRevealedKeys((prev) => ({
                                      ...prev,
                                      [account.id]: !prev[account.id],
                                    }))
                                  }
                                >
                                  {revealedKeys[account.id] ? 'Hide' : 'Show'}
                                </button>
                                <button onClick={() => copyApiKey(account)}>Copy</button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="account-date">
                          {new Date(account.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="table-actions">
                            <button onClick={() => startEditAccount(account)}>
                              Edit
                            </button>
                            <button onClick={() => regenerateKey(account)}>
                              Rotate key
                            </button>
                            <button
                              className="danger"
                              onClick={() => deleteAccount(account)}
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

          <div className="content-card">
            <div className="content-card-header">
              <span className="content-card-title">
                {editingAcc ? 'Edit workspace' : 'Create workspace'}
              </span>
            </div>

            <div className="content-card-body">
              <p className="settings-hint">
                Accounts group and share monitors. Give yours a name — the slug is
                optional and auto-created from the name if left empty.
              </p>

              <form className="account-form" onSubmit={handleAccountSubmit}>
                <label className="form-field">
                  <span className="form-label">Name</span>
                  <input
                    type="text"
                    required
                    maxLength={255}
                    placeholder="e.g. Production"
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                  />
                </label>

                <label className="form-field">
                  <span className="form-label">Slug (optional)</span>
                  <input
                    type="text"
                    maxLength={255}
                    placeholder="e.g. production"
                    value={accSlug}
                    onChange={(e) => setAccSlug(e.target.value)}
                  />
                </label>

                {accStatus && (
                  <div className={`form-status ${accStatus.type}`} role="alert">
                    {accStatus.message}
                  </div>
                )}

                <div className="account-form-actions">
                  {editingAcc && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={cancelEditAccount}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={accSubmitting}
                  >
                    {accSubmitting
                      ? 'Saving…'
                      : editingAcc
                        ? 'Save changes'
                        : 'Create workspace'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* ── App configuration ── */}
        <div className="content-card config-card">
          <div className="content-card-header">
            <span className="content-card-title">Application configuration</span>
            {configs !== null && (
              <span className="content-card-badge badge-live">
                {configs.length} keys
              </span>
            )}
          </div>

          <div className="content-card-body">
            <p className="settings-hint">
              Global key/value settings stored in the <code>app_config</code> table.
              Values are JSON — the monitoring engine and API read these at runtime.
            </p>

            {configs === null ? (
              <div className="settings-loading">Loading configuration…</div>
            ) : configs.length === 0 ? (
              <div className="settings-empty">
                No configuration keys yet.
              </div>
            ) : (
              <table className="data-table config-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((config) => (
                    <tr key={config.key}>
                      <td className="account-slug">{config.key}</td>
                      <td className="config-value mono">
                        {JSON.stringify(config.value)}
                      </td>
                      <td className="account-date mono">
                        {new Date(config.updated_at).toLocaleString()}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button onClick={() => startEditConfig(config)}>Edit</button>
                          <button
                            className="danger"
                            onClick={() => deleteConfig(config)}
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

            <form className="account-form config-form" onSubmit={handleConfigSubmit}>
              <div className="config-form-grid">
                <label className="form-field">
                  <span className="form-label">Key</span>
                  <input
                    type="text"
                    required
                    maxLength={255}
                    placeholder="e.g. smtp_host"
                    value={cfgKey}
                    onChange={(e) => setCfgKey(e.target.value)}
                  />
                </label>

                <label className="form-field form-field-full">
                  <span className="form-label">Value (JSON)</span>
                  <textarea
                    required
                    placeholder='e.g. "smtp.gmail.com" or {"host":"...","port":25}'
                    value={cfgValue}
                    onChange={(e) => setCfgValue(e.target.value)}
                  />
                </label>
              </div>

              {cfgStatus && (
                <div className={`form-status ${cfgStatus.type}`} role="alert">
                  {cfgStatus.message}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={cfgSubmitting}
              >
                {cfgSubmitting ? 'Saving…' : 'Save setting'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
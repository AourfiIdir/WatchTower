-- seed.sql
-- =============================================================================
-- WatchTour Seed Data
-- =============================================================================

-- 1. ACCOUNTS
INSERT INTO accounts (id, name, slug, api_key)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Main Workspace',
    'main-workspace',
    'wt_live_9f83a7c6e1204b89a0eebc999c0b4ef8'
)
ON CONFLICT (id) DO NOTHING;

-- 2. MONITORS
INSERT INTO monitors (
    id, account_id, name, type, target, port, http_method, 
    expected_status_code, interval_seconds, timeout_seconds, is_active
)
VALUES 
    (
        'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'Google Healthcheck',
        'HTTP',
        'https://google.com',
        NULL,
        'GET',
        200,
        60,
        10,
        TRUE
    ),
    (
        'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'Local Postgres Database',
        'TCP',
        '127.0.0.1',
        5432,
        NULL,
        NULL,
        30,
        5,
        TRUE
    ),
    (
        'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'Broken Service Test',
        'HTTP',
        'https://httpbin.org/status/500',
        NULL,
        'GET',
        200,
        60,
        5,
        TRUE
    )
ON CONFLICT (id) DO NOTHING;

-- 3. MONITOR_CHECKS
INSERT INTO monitor_checks (monitor_id, is_up, status_code, response_time_ms, error_message, created_at)
VALUES 
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', TRUE, 200, 42, NULL, NOW() - INTERVAL '2 minutes'),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', TRUE, 200, 38, NULL, NOW() - INTERVAL '1 minute'),
    ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', TRUE, NULL, 5, NULL, NOW() - INTERVAL '30 seconds'),
    ('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', FALSE, 500, 310, 'HTTP Status 500 Internal Server Error', NOW() - INTERVAL '1 minute');

-- 4. INCIDENTS
INSERT INTO incidents (monitor_id, started_at, cause, is_resolved)
VALUES (
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    NOW() - INTERVAL '1 minute',
    'Expected HTTP 200, received HTTP 500',
    FALSE
)
ON CONFLICT (id) DO NOTHING;

-- 5. APP_CONFIG
INSERT INTO app_config (key, value)
VALUES 
    ('data_retention_days', '30'::jsonb),
    ('slack_webhook_url', '"https://hooks.slack.com/services/XXX/YYY/ZZZ"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- =============================================================================
-- WatchTower Protocol Detail Tables Migration
--
-- Adds one detail table per monitor protocol. Each row is the measured detail
-- of exactly one monitor_checks row (1:1), so every table carries a
-- monitor_check_id FK with ON DELETE CASCADE.
-- =============================================================================

-- 1. DNS RECORD TYPE ENUM
-- -----------------------------------------------------------------------------
-- Lowercase to match the monitor_type enum created in 0001_init.sql (an
-- unquoted identifier, so it needs no quoting in queries).
-- Created through a DO block because Postgres has no CREATE TYPE IF NOT EXISTS.
DO $$
BEGIN
    CREATE TYPE dns_record_type AS ENUM (
        'A',
        'AAA',
        'CNAME',
        'MX',
        'TXT'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- 2. DNS_CHECKS TABLE
-- Answer-level detail for monitors.type = 'DNS'
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dns_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_check_id BIGINT NOT NULL REFERENCES monitor_checks(id) ON DELETE CASCADE,

    -- Question that was asked
    record_type dns_record_type NOT NULL,
    rcode INT,                                -- DNS response code (0 = NOERROR)

    -- Records returned by the resolver, e.g. {"104.21.14.88", "172.67.132.116"}
    resolved_records TEXT[] NOT NULL DEFAULT '{}',
    matched_expected BOOLEAN NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dns_checks_monitor_check
    ON dns_checks (monitor_check_id);

-- 3. TCP_CHECKS TABLE
-- Connection detail for monitors.type = 'TCP'
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tcp_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_check_id BIGINT NOT NULL REFERENCES monitor_checks(id) ON DELETE CASCADE,

    port INT NOT NULL,
    -- Every address the target resolved to; the one dialled is index 0.
    ip_addresses TEXT[] NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tcp_checks_monitor_check
    ON tcp_checks (monitor_check_id);

-- 4. HTTP_CHECKS TABLE
-- Request, TLS and content detail for monitors.type = 'HTTP'
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS http_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_check_id BIGINT NOT NULL REFERENCES monitor_checks(id) ON DELETE CASCADE,

    -- Response
    status_code INT,
    response_size_bytes BIGINT,
    keyword_found BOOLEAN,                    -- monitors.body keyword search

    -- Phase timings (ms)
    dns_lookup_ms INT,
    tcp_connect_ms INT,
    tls_handshake_ms INT,

    -- TLS certificate
    cert_expiry_days INT,
    cert_issuer VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_http_checks_monitor_check
    ON http_checks (monitor_check_id);

-- 5. MONITORS.DNS_QUERY_TYPE -> dns_record_type
-- -----------------------------------------------------------------------------
-- Drops the free-form VARCHAR in favour of the enum so the question asked by a
-- DNS monitor and the type recorded on a dns_checks row cannot drift apart.
--
-- The guard runs first so a row holding an unsupported value fails with the
-- offending values listed, instead of Postgres' generic cast error. It can be
-- deleted once production data is known to be clean.
DO $$
DECLARE
    unsupported TEXT[];
BEGIN
    SELECT array_agg(DISTINCT dns_query_type)
    INTO unsupported
    FROM monitors
    WHERE dns_query_type IS NOT NULL
      AND dns_query_type::TEXT NOT IN ('A', 'AAA', 'CNAME', 'MX', 'TXT');

    IF unsupported IS NOT NULL THEN
        RAISE EXCEPTION
            'monitors.dns_query_type holds values outside dns_record_type: %',
            unsupported;
    END IF;
END
$$;

-- The varchar default has to go before the type change: Postgres refuses to
-- coerce a varchar default into an enum automatically.
ALTER TABLE monitors
    ALTER COLUMN dns_query_type DROP DEFAULT;

ALTER TABLE monitors
    ALTER COLUMN dns_query_type TYPE dns_record_type
    USING dns_query_type::dns_record_type;

ALTER TABLE monitors
    ALTER COLUMN dns_query_type SET DEFAULT 'A'::dns_record_type;
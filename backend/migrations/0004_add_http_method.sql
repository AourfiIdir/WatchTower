-- =============================================================================
-- WatchTour: turn monitors.http_method from VARCHAR into a real enum
-- =============================================================================

CREATE TYPE http_method AS ENUM ('GET', 'POST', 'PUT', 'DELETE', 'HEAD');

-- The varchar default has to go before the type change: PostgreSQL refuses to
-- coerce a varchar default into an enum automatically.
ALTER TABLE monitors ALTER COLUMN http_method DROP DEFAULT;

ALTER TABLE monitors
    ALTER COLUMN http_method TYPE http_method
    USING http_method::http_method;

ALTER TABLE monitors ALTER COLUMN http_method SET DEFAULT 'GET'::http_method;

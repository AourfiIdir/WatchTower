use serde::{Deserialize, Serialize};

use crate::models::HttpMethod;

/// Outcome of a single check attempt against one monitor.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PingResponse {
    pub is_up: bool,
    pub status_code: Option<i32>,
    pub response_time_ms: Option<i32>,
    pub error_message: Option<String>,
}

impl PingResponse {
    pub fn up(status_code: Option<i32>, response_time_ms: i32) -> Self {
        Self {
            is_up: true,
            status_code,
            response_time_ms: Some(response_time_ms),
            error_message: None,
        }
    }

    pub fn down(
        status_code: Option<i32>,
        response_time_ms: Option<i32>,
        error_message: impl Into<String>,
    ) -> Self {
        Self {
            is_up: false,
            status_code,
            response_time_ms,
            error_message: Some(error_message.into()),
        }
    }
}

impl From<HttpMethod> for reqwest::Method {
    fn from(value: HttpMethod) -> Self {
        match value {
            HttpMethod::Get => Self::GET,
            HttpMethod::Post => Self::POST,
            HttpMethod::Put => Self::PUT,
            HttpMethod::Delete => Self::DELETE,
            HttpMethod::Head => Self::HEAD,
        }
    }
}

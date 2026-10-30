use std::time::{Duration, Instant};

use hickory_resolver::{proto::rr::RecordType, TokioResolver};
use reqwest::Client;
use serde_json::Value;
use tokio::net::TcpStream;

use super::engine_models::*;
use crate::models::{DnsRecordType, Monitor};

pub async fn execute_http_req(client: &Client, monitor: &Monitor) -> PingResponse {
    let method = match monitor.http_method {
        Some(method) => reqwest::Method::from(method),
        None => reqwest::Method::GET,
    };

    let mut request = client
        .request(method, monitor.target.clone())
        .timeout(timeout_of(monitor));

    if let Some(headers) = monitor.headers.as_ref().and_then(Value::as_object) {
        for (name, value) in headers {
            request = request.header(name.as_str(), header_value(value));
        }
    }
    if let Some(body) = monitor.body.clone() {
        request = request.body(body);
    }

    let started = Instant::now();
    match request.send().await {
        Ok(response) => {
            let elapsed = elapsed_ms(started);
            let status = response.status().as_u16() as i32;
            let expected = monitor.expected_status_code.unwrap_or(200);
            if status == expected {
                PingResponse::up(Some(status), elapsed)
            } else {
                PingResponse::down(
                    Some(status),
                    Some(elapsed),
                    format!("expected HTTP {expected}, got {status}"),
                )
            }
        }
        Err(err) => PingResponse::down(
            None,
            Some(elapsed_ms(started)),
            format!("request to {} failed: {err}", monitor.target),
        ),
    }
}

pub async fn execute_tcp_req(monitor: &Monitor) -> PingResponse {
    let Some(port) = monitor.port else {
        return PingResponse::down(None, None, "TCP monitor has no port configured");
    };
    let port = match u16::try_from(port) {
        Ok(port) => port,
        Err(_) => return PingResponse::down(None, None, format!("invalid port: {port}")),
    };

    let started = Instant::now();
    match tokio::time::timeout(
        timeout_of(monitor),
        TcpStream::connect((monitor.target.as_str(), port)),
    )
    .await
    {
        Ok(Ok(_stream)) => PingResponse::up(None, elapsed_ms(started)),
        Ok(Err(err)) => PingResponse::down(
            None,
            Some(elapsed_ms(started)),
            format!("connection to {}:{port} failed: {err}", monitor.target),
        ),
        Err(_) => PingResponse::down(
            None,
            Some(elapsed_ms(started)),
            format!(
                "connection to {}:{port} timed out after {}s",
                monitor.target, monitor.timeout_seconds
            ),
        ),
    }
}

pub async fn execute_dns_req(resolver: &TokioResolver, monitor: &Monitor) -> PingResponse {
    let record_type = record_type_of(monitor);
    let started = Instant::now();

    let lookup = match tokio::time::timeout(
        timeout_of(monitor),
        resolver.lookup(monitor.target.as_str(), record_type),
    )
    .await
    {
        Ok(Ok(lookup)) => lookup,
        Ok(Err(err)) => {
            return PingResponse::down(
                None,
                Some(elapsed_ms(started)),
                format!("{} {record_type} lookup failed: {err}", monitor.target),
            )
        }
        Err(_) => {
            return PingResponse::down(
                None,
                Some(elapsed_ms(started)),
                format!(
                    "{} {record_type} lookup timed out after {}s",
                    monitor.target, monitor.timeout_seconds
                ),
            )
        }
    };

    let answers: Vec<String> = lookup
        .answers()
        .iter()
        .map(|record| record.data.to_string())
        .collect();
    let elapsed = elapsed_ms(started);

    let Some(expected) = monitor.dns_expected_result.as_deref() else {
        return if answers.is_empty() {
            PingResponse::down(
                None,
                Some(elapsed),
                format!("{} {record_type} lookup returned no records", monitor.target),
            )
        } else {
            PingResponse::up(None, elapsed)
        };
    };

    if answers.iter().any(|answer| answer.eq_ignore_ascii_case(expected)) {
        PingResponse::up(None, elapsed)
    } else {
        PingResponse::down(
            None,
            Some(elapsed),
            format!("expected {expected}, got [{}]", answers.join(", ")),
        )
    }
}

pub async fn execute_icmp_req(monitor: &Monitor) -> PingResponse {
    PingResponse::down(
        None,
        None,
        format!("ICMP monitors are not supported yet ({})", monitor.name),
    )
}

fn record_type_of(monitor: &Monitor) -> RecordType {
    match monitor.dns_query_type.as_ref() {
        Some(DnsRecordType::A) => RecordType::A,
        Some(DnsRecordType::Aaaa) => RecordType::AAAA,
        Some(DnsRecordType::Cname) => RecordType::CNAME,
        Some(DnsRecordType::Mx) => RecordType::MX,
        Some(DnsRecordType::Txt) => RecordType::TXT,
        None => RecordType::A,
    }
}

fn timeout_of(monitor: &Monitor) -> Duration {
    Duration::from_secs(monitor.timeout_seconds.max(1) as u64)
}

fn elapsed_ms(started: Instant) -> i32 {
    started.elapsed().as_millis().min(i32::MAX as u128) as i32
}

fn header_value(value: &Value) -> String {
    match value {
        Value::String(value) => value.clone(),
        other => other.to_string(),
    }
}

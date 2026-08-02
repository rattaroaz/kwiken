//! Integer-cent helpers. SQLite stores money as numeric cents; the IPC/API
//! continues to use f64 dollars for frontend compatibility.
//!
//! Columns retain REAL affinity from the original schema, so values may come
//! back as Integer or Real depending on how they were written.

use rusqlite::types::ValueRef;
use rusqlite::{Error as SqlError, Result as SqlResult, Row};

/// Convert a dollar amount to integer cents (via `round`).
pub fn dollars_to_cents(dollars: f64) -> i64 {
    (dollars * 100.0).round() as i64
}

/// Convert integer cents to a dollar amount for API responses.
pub fn cents_to_dollars(cents: i64) -> f64 {
    cents as f64 / 100.0
}

fn value_ref_to_cents(value: ValueRef<'_>) -> SqlResult<i64> {
    match value {
        ValueRef::Integer(i) => Ok(i),
        ValueRef::Real(f) => Ok(f.round() as i64),
        ValueRef::Text(bytes) => {
            let s = std::str::from_utf8(bytes).map_err(|e| {
                SqlError::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
            })?;
            let f: f64 = s.parse().map_err(|e| {
                SqlError::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
            })?;
            Ok(f.round() as i64)
        }
        ValueRef::Null => Err(SqlError::InvalidColumnType(
            0,
            "money".into(),
            rusqlite::types::Type::Null,
        )),
        ValueRef::Blob(_) => Err(SqlError::InvalidColumnType(
            0,
            "money".into(),
            rusqlite::types::Type::Blob,
        )),
    }
}

/// Read a money column as integer cents (accepts Integer or Real storage).
pub fn row_cents(row: &Row<'_>, idx: usize) -> SqlResult<i64> {
    value_ref_to_cents(row.get_ref(idx)?)
}

/// Read an optional money column as integer cents.
pub fn row_cents_opt(row: &Row<'_>, idx: usize) -> SqlResult<Option<i64>> {
    match row.get_ref(idx)? {
        ValueRef::Null => Ok(None),
        other => Ok(Some(value_ref_to_cents(other)?)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_common_amounts() {
        for d in [-12.34, 0.0, 0.01, 0.1, 1.0, 99.99, 100.0] {
            assert!((cents_to_dollars(dollars_to_cents(d)) - d).abs() < 1e-9);
        }
    }

    #[test]
    fn rounds_half_away_from_zero_style_via_round() {
        assert_eq!(dollars_to_cents(0.005), 1);
        assert_eq!(dollars_to_cents(-0.005), -1);
    }
}

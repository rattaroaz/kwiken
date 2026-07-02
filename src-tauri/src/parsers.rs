use crate::models::ImportRow;
use chrono::NaiveDate;

pub fn parse_import_date(raw: &str) -> String {
    if let Ok(d) = NaiveDate::parse_from_str(raw, "%Y-%m-%d") {
        return d.format("%Y-%m-%d").to_string();
    }
    if let Ok(d) = NaiveDate::parse_from_str(raw, "%m/%d/%Y") {
        return d.format("%Y-%m-%d").to_string();
    }
    if raw.len() >= 8 {
        if let Ok(d) = NaiveDate::parse_from_str(&raw[..8], "%Y%m%d") {
            return d.format("%Y-%m-%d").to_string();
        }
    }
    raw.to_string()
}

pub fn parse_csv_content(content: &str) -> Vec<ImportRow> {
    let mut rows = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        return rows;
    }
    let start = if lines[0].to_lowercase().contains("date") {
        1
    } else {
        0
    };
    for line in &lines[start..] {
        if line.trim().is_empty() {
            continue;
        }
        let fields: Vec<&str> = line.split(',').map(|s| s.trim().trim_matches('"')).collect();
        if fields.len() < 2 {
            continue;
        }
        let date = parse_import_date(fields[0]);
        let amount: f64 = fields[1].parse().unwrap_or(0.0);
        let payee = fields.get(2).map(|s| s.to_string());
        let memo = fields.get(3).map(|s| s.to_string());
        let category = fields.get(4).map(|s| s.to_string());
        rows.push(ImportRow {
            date,
            amount,
            payee,
            memo,
            category,
            is_duplicate: false,
        });
    }
    rows
}

pub fn parse_qif_content(content: &str) -> Vec<ImportRow> {
    let mut rows = Vec::new();
    let mut date = String::new();
    let mut amount = 0.0f64;
    let mut payee: Option<String> = None;
    let mut memo: Option<String> = None;
    for line in content.lines() {
        if line.is_empty() {
            continue;
        }
        let (code, rest) = line.split_at(1.min(line.len()));
        let value = rest.trim();
        match code {
            "D" => date = parse_import_date(value),
            "T" => amount = value.replace(',', "").parse().unwrap_or(0.0),
            "P" => payee = Some(value.to_string()),
            "M" => memo = Some(value.to_string()),
            "^" => {
                if !date.is_empty() {
                    rows.push(ImportRow {
                        date: date.clone(),
                        amount,
                        payee: payee.clone(),
                        memo: memo.clone(),
                        category: None,
                        is_duplicate: false,
                    });
                }
                date.clear();
                amount = 0.0;
                payee = None;
                memo = None;
            }
            _ => {}
        }
    }
    rows
}

pub fn parse_ofx_content(content: &str) -> Vec<ImportRow> {
    let mut rows = Vec::new();
    let upper = content.to_uppercase();
    let parts: Vec<&str> = upper.split("<STMTTRN>").collect();
    for part in parts.iter().skip(1) {
        let date = extract_ofx_tag(part, "DTPOSTED")
            .map(|d| parse_import_date(&d))
            .unwrap_or_default();
        let amount = extract_ofx_tag(part, "TRNAMT")
            .and_then(|v| v.parse().ok())
            .unwrap_or(0.0);
        let payee = extract_ofx_tag(part, "NAME");
        let memo = extract_ofx_tag(part, "MEMO");
        if !date.is_empty() {
            rows.push(ImportRow {
                date,
                amount,
                payee,
                memo,
                category: None,
                is_duplicate: false,
            });
        }
    }
    rows
}

fn extract_ofx_tag(block: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let start = block.find(&open)? + open.len();
    let rest = &block[start..];
    let end = rest.find('<').unwrap_or(rest.len());
    let value = rest[..end].trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_csv_skips_header_and_parses_rows() {
        let csv = "date,amount,payee,memo\n2024-01-15,-25.50,Store,snacks";
        let rows = parse_csv_content(csv);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].date, "2024-01-15");
        assert!((rows[0].amount + 25.5).abs() < 0.01);
        assert_eq!(rows[0].payee.as_deref(), Some("Store"));
    }

    #[test]
    fn parse_qif_transaction_block() {
        let qif = "D01/15/2024\nT-42.00\nPGrocery\n^";
        let rows = parse_qif_content(qif);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].date, "2024-01-15");
        assert!((rows[0].amount + 42.0).abs() < 0.01);
        assert_eq!(rows[0].payee.as_deref(), Some("Grocery"));
    }

    #[test]
    fn parse_ofx_stmttrn() {
        let ofx = "<STMTTRN><DTPOSTED>20240120<TRNAMT>-10.00<NAME>Cafe</STMTTRN>";
        let rows = parse_ofx_content(ofx);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].date, "2024-01-20");
        assert!((rows[0].amount + 10.0).abs() < 0.01);
    }

    #[test]
    fn parse_import_date_formats() {
        assert_eq!(parse_import_date("2024-03-01"), "2024-03-01");
        assert_eq!(parse_import_date("03/01/2024"), "2024-03-01");
        assert_eq!(parse_import_date("20240301"), "2024-03-01");
    }

    #[test]
    fn parse_csv_empty_content() {
        assert!(parse_csv_content("").is_empty());
    }

    #[test]
    fn parse_qif_incomplete_block_ignored() {
        assert!(parse_qif_content("D01/15/2024\nT-10.00").is_empty());
    }

    #[test]
    fn parse_ofx_no_transactions() {
        assert!(parse_ofx_content("<OFX>").is_empty());
    }
}

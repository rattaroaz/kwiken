// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod commands;
mod crypto;
mod db;
mod logging;
mod models;
mod money;
mod parsers;
mod state;

use db::{has_master_password_hash, mark_clean_shutdown, open_connection};
use state::AppState;
use tauri::{Manager, RunEvent};

fn init_logging() {
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).try_init();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            init_logging();
            logging::init_rust_file_logging(&app.handle());
            log::info!("Kwiken v{} starting", env!("CARGO_PKG_VERSION"));
            let conn = open_connection(&app.handle())?;
            let start_locked = has_master_password_hash(&conn).unwrap_or(false);
            log::info!(
                "Database connection opened (start_locked={start_locked})"
            );
            app.manage(AppState::new(conn, start_locked, app.handle().clone()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::init_app,
            commands::mark_clean_shutdown_cmd,
            commands::list_accounts,
            commands::get_account,
            commands::create_account,
            commands::update_account,
            commands::delete_account,
            commands::archive_account,
            commands::list_categories,
            commands::create_category,
            commands::update_category,
            commands::delete_category,
            commands::list_payees,
            commands::search_payees,
            commands::create_payee,
            commands::update_payee,
            commands::delete_payee,
            commands::list_transactions,
            commands::count_transactions,
            commands::get_account_register,
            commands::get_transaction,
            commands::create_transaction,
            commands::update_transaction,
            commands::delete_transaction,
            commands::bulk_delete_transactions,
            commands::duplicate_transaction,
            commands::set_transaction_cleared,
            commands::create_transfer,
            commands::update_transfer_amount,
            commands::get_reconciliation_status,
            commands::finish_reconciliation,
            commands::list_budgets,
            commands::create_budget,
            commands::update_budget,
            commands::delete_budget,
            commands::list_recurring,
            commands::create_recurring,
            commands::update_recurring,
            commands::delete_recurring,
            commands::enter_due_recurring,
            commands::get_setting,
            commands::set_setting,
            commands::get_all_settings,
            commands::add_attachment,
            commands::list_attachments,
            commands::delete_attachment,
            commands::list_tags,
            commands::create_tag,
            commands::delete_tag,
            commands::list_auto_rules,
            commands::create_auto_rule,
            commands::delete_auto_rule,
            commands::apply_auto_rules_to_transactions,
            commands::list_saved_filters,
            commands::create_saved_filter,
            commands::delete_saved_filter,
            commands::list_templates,
            commands::create_template,
            commands::delete_template,
            commands::list_holdings,
            commands::upsert_holding,
            commands::delete_holding,
            commands::get_loan_details,
            commands::set_loan_details,
            commands::calculate_loan_payment,
            commands::list_exchange_rates,
            commands::set_exchange_rate,
            commands::get_dashboard_summary,
            commands::get_spending_by_category,
            commands::get_income_vs_expense,
            commands::get_cash_flow,
            commands::get_balance_history,
            commands::get_net_worth_history,
            commands::get_tax_summary,
            commands::export_transactions_csv,
            commands::export_accounts_csv,
            commands::export_categories_csv,
            commands::preview_csv_import,
            commands::commit_csv_import,
            commands::preview_qif_import,
            commands::commit_qif_import,
            commands::preview_ofx_import,
            commands::commit_ofx_import,
            commands::backup_database,
            commands::restore_database,
            commands::security::set_master_password,
            commands::security::has_master_password,
            commands::security::lock_app,
            commands::security::unlock_app,
            commands::security::is_app_locked,
            commands::security::is_database_encrypted,
            commands::security::enable_database_encryption,
            commands::security::get_security_status,
            commands::get_logs_directory,
            commands::append_frontend_log,
            commands::read_frontend_log_tail,
            commands::get_diagnostic_snapshot,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(state) = app.try_state::<AppState>() {
                    if let Ok(conn) = state.db_unlocked_access() {
                        if let Err(e) = mark_clean_shutdown(&conn) {
                            log::warn!("Could not mark clean shutdown on exit: {e}");
                        } else {
                            log::info!("Marked clean shutdown");
                        }
                    }
                }
            }
        });
}

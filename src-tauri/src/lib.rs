// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod commands;
mod db;
mod models;
mod state;

use db::open_connection;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let conn = open_connection(&app.handle())?;
            app.manage(AppState::new(conn));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::init_app,
            commands::get_schema_version,
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
            commands::set_master_password,
            commands::verify_master_password,
            commands::has_master_password,
            commands::lock_app,
            commands::unlock_app,
            commands::is_app_locked,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

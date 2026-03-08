use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

use crate::{
    common::telegram_api::bot_api::TelegramBotApi,
    errors::PentaractResult,
    repositories::{files::FilesRepository, storages::StoragesRepository},
    services::storage_workers_scheduler::StorageWorkersScheduler,
};

/// Sweeps the database periodically to remove stalled uploads that never finished.
pub async fn start_background_cleanup_worker(db: PgPool, telegram_baseurl: String, rate_limit: u8) {
    let mut interval = tokio::time::interval(Duration::from_secs(3600)); // Every hour

    loop {
        interval.tick().await;
        tracing::info!("[Cleanup Worker] Running orphaned file sweep...");

        if let Err(e) = sweep_orphaned_files(&db, &telegram_baseurl, rate_limit).await {
            tracing::error!("[Cleanup Worker] Sweep failed: {e}");
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct OrphanedFile {
    id: Uuid,
    storage_id: Uuid,
}

async fn sweep_orphaned_files(
    db: &PgPool,
    telegram_baseurl: &str,
    rate_limit: u8,
) -> PentaractResult<()> {
    let files_repo = FilesRepository::new(db);
    let storages_repo = StoragesRepository::new(db);

    // Find all files that are NOT uploaded AND older than 24 hours
    let records: Vec<OrphanedFile> = sqlx::query_as(
        "SELECT id, storage_id FROM files WHERE is_uploaded = false AND created_at < NOW() - INTERVAL '24 hours'"
    )
    .fetch_all(db)
    .await
    .map_err(|e| {
        tracing::error!("{e}");
        crate::errors::PentaractError::Unknown
    })?;

    if records.is_empty() {
        return Ok(());
    }

    tracing::info!(
        "[Cleanup Worker] Found {} orphaned files to delete",
        records.len()
    );

    for record in records {
        // 1. Get the chunks for this orphaned file
        let chunks = match files_repo.list_chunks_of_file(record.id).await {
            Ok(c) => c,
            Err(_) => continue,
        };

        let storage = match storages_repo.get_by_id(record.storage_id).await {
            Ok(s) => s,
            Err(_) => continue,
        };

        // 2. Delete each chunk from Telegram to free up space
        for chunk in chunks {
            // Delete message from telegram
            // Ignore errors here so we still try to delete the DB record
            let scheduler = StorageWorkersScheduler::new(db, rate_limit);
            let _ = TelegramBotApi::new(telegram_baseurl, scheduler)
                .delete_document(storage.chat_id, &chunk.telegram_file_id)
                .await;
        }

        // 3. Delete the file from the database (cascade will also delete the chunks from file_chunks)
        let _ = files_repo.delete_with_folders(record.id).await;

        tracing::info!(
            "[Cleanup Worker] Successfully cleaned up file {}",
            record.id
        );
    }

    Ok(())
}

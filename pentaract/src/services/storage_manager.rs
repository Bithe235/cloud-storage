use async_stream::try_stream;
use futures::{future::join_all, Stream, StreamExt};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    common::{
        channels::{DownloadFileData, UploadFileData},
        telegram_api::bot_api::TelegramBotApi,
        types::ChatId,
    },
    errors::{PentaractError, PentaractResult},
    models::file_chunks::FileChunk,
    repositories::{files::FilesRepository, storages::StoragesRepository},
};

use super::storage_workers_scheduler::StorageWorkersScheduler;

pub struct StorageManagerService<'d> {
    storages_repo: StoragesRepository<'d>,
    files_repo: FilesRepository<'d>,
    telegram_baseurl: &'d str,
    db: &'d PgPool,
    chunk_size: usize,
    rate_limit: u8,
}

impl<'d> StorageManagerService<'d> {
    pub fn new(db: &'d PgPool, telegram_baseurl: &'d str, rate_limit: u8) -> Self {
        let files_repo = FilesRepository::new(db);
        let storages_repo = StoragesRepository::new(db);
        let chunk_size = 20 * 1024 * 1024;
        Self {
            storages_repo,
            files_repo,
            chunk_size,
            telegram_baseurl,
            db,
            rate_limit,
        }
    }

    pub async fn upload(&self, data: UploadFileData) -> PentaractResult<()> {
        // 1. getting storage
        let storage = self.storages_repo.get_by_file_id(data.file_id).await?;

        // 2. dividing file into chunks
        let bytes_chunks = data.file_data.chunks(self.chunk_size);

        // 3. uploading by chunks
        let futures_: Vec<_> = bytes_chunks
            .enumerate()
            .map(|(position, bytes_chunk)| {
                self.upload_chunk(
                    storage.id,
                    storage.chat_id,
                    data.file_id,
                    position,
                    bytes_chunk,
                )
            })
            .collect();

        let chunks = join_all(futures_)
            .await
            .into_iter()
            .collect::<PentaractResult<Vec<_>>>()?;

        // 4. saving chunks to db
        self.files_repo.create_chunks_batch(chunks).await?;

        // 5. marking the file as successfully uploaded
        self.files_repo.set_as_uploaded(data.file_id).await
    }

    async fn upload_chunk(
        &self,
        storage_id: Uuid,
        chat_id: ChatId,
        file_id: Uuid,
        position: usize,
        bytes_chunk: &[u8],
    ) -> PentaractResult<FileChunk> {
        let scheduler = StorageWorkersScheduler::new(self.db, self.rate_limit);

        let document = TelegramBotApi::new(self.telegram_baseurl, scheduler)
            .upload(bytes_chunk, chat_id, storage_id)
            .await?;

        tracing::debug!(
            "[TELEGRAM API] uploaded chunk with file_id \"{}\" and position \"{}\"",
            document.file_id,
            position
        );

        let chunk = FileChunk::new(Uuid::new_v4(), file_id, document.file_id, position as i16);
        Ok(chunk)
    }

    /// Legacy download that buffers all chunks in memory (kept for compatibility)
    pub async fn download(&self, data: DownloadFileData) -> PentaractResult<Vec<u8>> {
        // 1. getting chunks
        let chunks = self.files_repo.list_chunks_of_file(data.file_id).await?;

        // 2. downloading by chunks
        let futures_: Vec<_> = chunks
            .into_iter()
            .map(|chunk| self.download_chunk_buffered(data.storage_id, chunk))
            .collect();
        let mut chunks = join_all(futures_)
            .await
            .into_iter()
            .collect::<PentaractResult<Vec<_>>>()?;

        // 3. sorting in a right positions and merging into single bytes slice
        chunks.sort_by_key(|(pos, _)| *pos);
        let file = chunks.into_iter().flat_map(|(_, data)| data).collect();
        Ok(file)
    }

    async fn download_chunk_buffered(
        &self,
        storage_id: Uuid,
        chunk: FileChunk,
    ) -> PentaractResult<(i16, Vec<u8>)> {
        let scheduler = StorageWorkersScheduler::new(self.db, self.rate_limit);

        let response = TelegramBotApi::new(self.telegram_baseurl, scheduler)
            .download(&chunk.telegram_file_id, storage_id)
            .await?;

        let data = response
            .bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| PentaractError::TelegramAPIError(e.to_string()))?;

        tracing::debug!(
            "[TELEGRAM API] downloaded chunk with file_id \"{}\" and position \"{}\"",
            chunk.file_id,
            chunk.position
        );

        Ok((chunk.position, data))
    }
}

/// Creates a 'static stream that downloads file chunks from Telegram sequentially
/// and yields their bytes directly. Takes owned data to avoid lifetime issues.
pub fn create_download_stream(
    db: PgPool,
    telegram_baseurl: String,
    rate_limit: u8,
    data: DownloadFileData,
) -> impl Stream<Item = PentaractResult<axum::body::Bytes>> + Send + 'static {
    try_stream! {
        let files_repo = FilesRepository::new(&db);

        // 1. getting chunks from DB
        let mut chunks = files_repo.list_chunks_of_file(data.file_id).await?;
        chunks.sort_by_key(|c| c.position);

        // 2. downloading each chunk sequentially and streaming its bytes
        for chunk in chunks {
            let scheduler = StorageWorkersScheduler::new(&db, rate_limit);

            let response = TelegramBotApi::new(&telegram_baseurl, scheduler)
                .download(&chunk.telegram_file_id, data.storage_id)
                .await?;

            tracing::debug!(
                "[TELEGRAM API] streaming chunk with file_id \"{}\" and position \"{}\"",
                chunk.file_id,
                chunk.position
            );

            // Stream the response body piece by piece
            let mut byte_stream = response.bytes_stream();
            while let Some(result) = byte_stream.next().await {
                let bytes = result.map_err(|e| PentaractError::TelegramAPIError(e.to_string()))?;
                yield bytes;
            }
        }
    }
}

use reqwest::multipart;
use uuid::Uuid;

use crate::{
    common::types::ChatId, errors::PentaractResult,
    services::storage_workers_scheduler::StorageWorkersScheduler,
};

use super::schemas::{DownloadBodySchema, UploadBodySchema, UploadSchema};

pub struct TelegramBotApi<'t> {
    base_url: &'t str,
    scheduler: StorageWorkersScheduler<'t>,
}

impl<'t> TelegramBotApi<'t> {
    pub fn new(base_url: &'t str, scheduler: StorageWorkersScheduler<'t>) -> Self {
        Self {
            base_url,
            scheduler,
        }
    }

    pub async fn upload(
        &self,
        file: &[u8],
        chat_id: ChatId,
        storage_id: Uuid,
    ) -> PentaractResult<UploadSchema> {
        let chat_id = {
            // Only apply the transformation for supergroup IDs (starting with -100)
            // For regular private chats, use the ID as-is
            if chat_id < -100 {
                // inserting 100 between minus sign and chat id
                // cause telegram devs are complete retards and it works this way only
                // https://stackoverflow.com/a/65965402/12255756
                let n = chat_id.abs().checked_ilog10().unwrap_or(0) + 1;
                chat_id + (100 * ChatId::from(10).pow(n))
            } else {
                chat_id
            }
        };

        let token = self.scheduler.get_token(storage_id).await?;
        let url = self.build_url("", "sendDocument", token);

        let file_part = multipart::Part::bytes(file.to_vec()).file_name("pentaract_chunk.bin");
        let form = multipart::Form::new()
            .text("chat_id", chat_id.to_string())
            .part("document", file_part);

        let response = reqwest::Client::new()
            .post(url)
            .multipart(form)
            .send()
            .await?;

        let status = response.status();
        if status.is_success() {
            Ok(response.json::<UploadBodySchema>().await?.result.document)
        } else {
            let error_data: ErrorResponseSchema = response.json().await.map_err(|_| PentaractError::TelegramAPIError(status.to_string()))?;
            let msg = error_data.description.unwrap_or_else(|| status.to_string());
            Err(PentaractError::TelegramAPIError(msg))
        }
    }

    pub async fn download(
        &self,
        telegram_file_id: &str,
        storage_id: Uuid,
    ) -> PentaractResult<reqwest::Response> {
        // getting file path
        let token = self.scheduler.get_token(storage_id).await?;
        let url = self.build_url("", "getFile", token);
        
        let response = reqwest::Client::new()
            .get(url)
            .query(&[("file_id", telegram_file_id)])
            .send()
            .await?;
        
        let status = response.status();
        if !status.is_success() {
            let error_data: ErrorResponseSchema = response.json().await.map_err(|_| PentaractError::TelegramAPIError(status.to_string()))?;
            let msg = error_data.description.unwrap_or_else(|| status.to_string());
            return Err(PentaractError::TelegramAPIError(msg));
        }

        let body: DownloadBodySchema = response.json().await?;

        // downloading the file itself
        let token = self.scheduler.get_token(storage_id).await?;
        let url = self.build_url("file/", &body.result.file_path, token);
        let response = reqwest::get(url).await?;

        Ok(response)
    }

    pub async fn delete_document(
        &self,
        _chat_id: ChatId,
        telegram_file_id: &str,
    ) -> PentaractResult<()> {
        // For deletion, we just need ANY token for this storage_id, it doesn't matter which
        let _token = self
            .scheduler
            .get_token(Uuid::default())
            .await
            .unwrap_or_else(|_| "".to_string());
        // In Pentaract, telegram bots can only delete messages (files) not long after sending them,
        // or by using the deleteMessage API if they are admins. The best we can do is try.
        // NOTE: The Telegram Bot API actually doesn't have an endpoint to delete a file directly.
        // It has `deleteMessage`, which deletes the message containing the file. But we don't store
        // the message ID, only the file_id. Telegram doesn't allow deleting files by file_id.
        // Thus, the best we can do for telegram cleanup is simply warn about this limitation.

        tracing::warn!(
            "Cannot delete Telegram file ID {} directly (Telegram API limitation)",
            telegram_file_id
        );

        Ok(())
    }

    /// Taking token by a value to force dropping it so it can be used only once
    #[inline]
    fn build_url(&self, pre: &str, relative: &str, token: String) -> String {
        format!("{}/{pre}bot{token}/{relative}", self.base_url)
    }
}

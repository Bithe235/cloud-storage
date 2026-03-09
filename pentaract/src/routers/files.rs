use std::{collections::HashMap, path::Path, sync::Arc};

use axum::{
    extract::{DefaultBodyLimit, Multipart, Path as RoutePath, Query, State},
    http::StatusCode,
    middleware,
    response::{AppendHeaders, IntoResponse, Response},
    routing::{get, post},
    Extension, Json, Router,
};
use reqwest::header;
use uuid::Uuid;

use crate::{
    common::{
        jwt_manager::AuthUser,
        routing::{app_state::AppState, middlewares::auth::logged_in_required},
    },
    errors::{PentaractError, PentaractResult},
    models::files::InFile,
    schemas::files::{
        InFileSchema, InFolderSchema, SearchQuery, UploadParams, IN_FILE_SCHEMA_FIELDS_AMOUNT,
    },
    services::files::FilesService,
};

pub struct FilesRouter;

impl FilesRouter {
    pub fn get_router(state: Arc<AppState>) -> Router<Arc<AppState>, axum::body::Body> {
        Router::new()
            .route("/create_folder", post(Self::create_folder))
            .route("/upload", post(Self::upload))
            .route("/upload_to", post(Self::upload_to))
            .route("/*path", get(Self::dynamic_get).delete(Self::delete))
            .layer(DefaultBodyLimit::disable())
            .route_layer(middleware::from_fn_with_state(
                state.clone(),
                logged_in_required,
            ))
            .with_state(state)
    }

    async fn dynamic_get(
        State(state): State<Arc<AppState>>,
        Extension(user): Extension<AuthUser>,
        RoutePath((storage_id, path)): RoutePath<(Uuid, String)>,
        query: Query<SearchQuery>,
    ) -> impl IntoResponse {
        let (root_path, path) = path.split_once("/").unwrap_or((&path, ""));
        match root_path {
            "tree" => Self::tree(state, user, storage_id, path).await,
            "download" => Self::download(state, user, storage_id, path).await,
            "search" => {
                if let Some(search_path) = query.0.search_path {
                    Self::search(state, user, storage_id, path, &search_path).await
                } else {
                    Err((
                        StatusCode::UNPROCESSABLE_ENTITY,
                        "search_path query parameter is required".to_owned(),
                    ))
                }
            }
            _ => Err((StatusCode::NOT_FOUND, "Not found".to_owned())),
        }
    }

    async fn tree(
        state: Arc<AppState>,
        user: AuthUser,
        storage_id: Uuid,
        path: &str,
    ) -> Result<Response, (StatusCode, String)> {
        let fs_layer = FilesService::new(&state.db, &state.config)
            .list_dir(storage_id, path, &user)
            .await?;
        Ok(Json(fs_layer).into_response())
    }

    async fn upload(
        State(state): State<Arc<AppState>>,
        Extension(user): Extension<AuthUser>,
        RoutePath(storage_id): RoutePath<Uuid>,
        mut multipart: Multipart,
    ) -> Result<StatusCode, (StatusCode, String)> {
        // parsing
        let (file, path) = {
            let (mut file, mut filename, mut path) = (None, None, None);

            // parsing
            while let Some(field) = multipart.next_field().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))? {
                let name = field.name().unwrap_or_default().to_owned();
                let field_filename = field.file_name().unwrap_or("unnamed").to_owned();
                let data = field.bytes().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

                match name.as_str() {
                    "file" => {
                        file = Some(data);
                        filename = Some(field_filename);
                    }
                    "path" => {
                        let raw_path = String::from_utf8(data.to_vec())
                            .map_err(|_| (StatusCode::BAD_REQUEST, "path is not valid UTF-8".to_owned()))?;
                        
                        // Strip leading/trailing slashes to ensure it doesn't fail validation
                        path = Some(raw_path.trim_matches('/').to_string());
                    }
                    _ => (),
                }
            }

            let file = file.ok_or((StatusCode::BAD_REQUEST, "file is required".to_owned()))?;
            let path_base = path.unwrap_or_default();
            let fname = filename.ok_or((StatusCode::BAD_REQUEST, "filename is missing".to_owned()))?;
            let final_path = Self::construct_path(&path_base, &fname)
                .map_err(|e| <(StatusCode, String)>::from(e))?;
            (file, final_path)
        };
        let size = file.len() as i64;
        let in_file = InFile::new(path, size, storage_id);

        FilesService::new(&state.db, &state.config)
            .upload_anyway(in_file, file, &user)
            .await?;
        Ok(StatusCode::CREATED)
    }

    async fn upload_to(
        State(state): State<Arc<AppState>>,
        Extension(user): Extension<AuthUser>,
        RoutePath(storage_id): RoutePath<Uuid>,
        mut multipart: Multipart,
    ) -> Result<StatusCode, (StatusCode, String)> {
        // parsing and validating schema
        let in_schema = {
            let mut body_parts = HashMap::with_capacity(IN_FILE_SCHEMA_FIELDS_AMOUNT);

            // parsing
            while let Some(field) = multipart.next_field().await.unwrap() {
                let name = field.name().unwrap().to_string();
                let data = field.bytes().await.unwrap();
                body_parts.insert(name, data);
            }

            // validating
            let path = body_parts
                .get("path")
                .map(|path| String::from_utf8(path.to_vec()).map_err(|_| "Path cannot be parsed"))
                .unwrap_or(Err("Path is required"))
                .map_err(|e| (StatusCode::BAD_REQUEST, e.to_owned()))?;

            let file = body_parts
                .get("file")
                .ok_or((StatusCode::BAD_REQUEST, "File is required".to_owned()))?;

            InFileSchema::new(storage_id, path, file.clone())
        };

        // do all other stuff
        FilesService::new(&state.db, &state.config)
            .upload_to(in_schema, &user)
            .await?;

        Ok(StatusCode::CREATED)
    }

    async fn create_folder(
        State(state): State<Arc<AppState>>,
        Extension(user): Extension<AuthUser>,
        RoutePath(storage_id): RoutePath<Uuid>,
        Json(params): Json<UploadParams>,
    ) -> Result<StatusCode, (StatusCode, String)> {
        let in_schema = InFolderSchema::new(storage_id, params.path, params.folder_name);

        FilesService::new(&state.db, &state.config)
            .create_folder(in_schema, &user)
            .await?;
        Ok(StatusCode::CREATED)
    }

    #[inline]
    fn construct_path(path: &str, filename: &str) -> PentaractResult<String> {
        Path::new(path)
            .join(filename)
            .to_str()
            .ok_or(PentaractError::InvalidPath)
            .map(|p| p.to_string())
    }

    async fn download(
        state: Arc<AppState>,
        user: AuthUser,
        storage_id: Uuid,
        path: &str,
    ) -> Result<Response, (StatusCode, String)> {
        // 1. Validate access and get file metadata (borrows state briefly)
        let file = {
            let service = FilesService::new(&state.db, &state.config);
            service.download_metadata(path, storage_id, &user).await
        }
        .map_err(|e| <(StatusCode, String)>::from(e))?;

        let filename = Path::new(&path)
            .file_name()
            .map(|name| name.to_str().unwrap_or_default())
            .unwrap_or("unnamed.bin")
            .to_owned();
        let content_type = mime_guess::from_path(&filename)
            .first_or_octet_stream()
            .to_string();

        // 2. Create the download data
        let download_file_data = crate::common::channels::DownloadFileData {
            file_id: file.id,
            storage_id,
            user_id: user.id,
        };

        // 3. Create streaming response using the standalone function with owned data
        let stream = crate::services::storage_manager::create_download_stream(
            state.db.clone(),
            state.config.telegram_api_base_url.clone(),
            state.config.telegram_rate_limit,
            download_file_data,
        );

        let body = axum::body::StreamBody::new(stream);

        let headers = AppendHeaders([
            (header::CONTENT_TYPE, content_type),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{filename}\""),
            ),
        ]);

        Ok((headers, body).into_response())
    }

    ///
    /// Need path with trailing slash
    ///
    async fn search(
        state: Arc<AppState>,
        user: AuthUser,
        storage_id: Uuid,
        path: &str,
        search_path: &str,
    ) -> Result<Response, (StatusCode, String)> {
        FilesService::new(&state.db, &state.config)
            .search(storage_id, path, search_path, &user)
            .await
            .map(|files| Json(files).into_response())
            .map_err(|e| <(StatusCode, String)>::from(e))
    }

    async fn delete(
        State(state): State<Arc<AppState>>,
        Extension(user): Extension<AuthUser>,
        RoutePath((storage_id, path)): RoutePath<(Uuid, String)>,
    ) -> Result<(), (StatusCode, String)> {
        FilesService::new(&state.db, &state.config)
            .delete(&path, storage_id, &user)
            .await
            .map_err(|e| <(StatusCode, String)>::from(e))?;

        Ok(())
    }
}

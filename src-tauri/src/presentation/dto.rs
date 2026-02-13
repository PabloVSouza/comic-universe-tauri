use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

#[derive(Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApiEndpointPayload {
    pub host: String,
    pub port: u16,
    pub base_url: String,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpsertBody {
    pub id: Option<String>,
    pub data: Value,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FindBody {
    pub json_path: String,
    pub value: Value,
    pub limit: Option<u32>,
}

#[derive(Deserialize)]
pub struct ListQuery {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Serialize, ToSchema)]
pub struct HealthResponse {
    pub status: String,
}

#[derive(Serialize, ToSchema)]
pub struct DeleteResponse {
    pub deleted: bool,
}

#[derive(Serialize, ToSchema)]
pub struct ErrorResponse {
    pub message: String,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ChapterPage {
    pub index: usize,
    pub file_name: String,
    pub url: String,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ChapterPagesResponse {
    pub chapter_id: String,
    pub comic_id: String,
    pub comic_name: String,
    pub chapter_name: String,
    pub page_count: usize,
    pub pages: Vec<ChapterPage>,
}

#[derive(Deserialize, Default, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MigrateLegacyBody {
    pub legacy_db_path: Option<String>,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MigrateLegacyResponse {
    pub performed: bool,
    pub imported_rows: usize,
    pub legacy_db_path: Option<String>,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarkChaptersBody {
    pub chapter_ids: Vec<String>,
    pub read: bool,
}

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarkChaptersResponse {
    pub updated: usize,
    pub skipped: usize,
}

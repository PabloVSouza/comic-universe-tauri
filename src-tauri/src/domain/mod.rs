use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{error::Error, fmt};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, Clone, ToSchema)]
pub struct DbRecord {
    pub id: String,
    pub data: Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LegacyImportReport {
    pub legacy_db_path: String,
    pub imported_rows: usize,
}

#[derive(Debug, Clone, Copy)]
pub enum Table {
    Comics,
    Chapters,
    ReadProgress,
    Plugins,
    Changelog,
}

impl Table {
    pub fn parse(input: &str) -> Result<Self, AppError> {
        match input {
            "comics" => Ok(Self::Comics),
            "chapters" => Ok(Self::Chapters),
            "read_progress" => Ok(Self::ReadProgress),
            "plugins" => Ok(Self::Plugins),
            "changelog" => Ok(Self::Changelog),
            _ => Err(AppError::InvalidTable(input.to_string())),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Comics => "comics",
            Self::Chapters => "chapters",
            Self::ReadProgress => "read_progress",
            Self::Plugins => "plugins",
            Self::Changelog => "changelog",
        }
    }
}

#[derive(Debug, Clone)]
pub enum AppError {
    InvalidTable(String),
    Validation(String),
    Infrastructure(String),
}

impl AppError {
    pub fn infrastructure(message: impl Into<String>) -> Self {
        Self::Infrastructure(message.into())
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidTable(table) => write!(f, "Unsupported table: {table}"),
            Self::Validation(message) => f.write_str(message),
            Self::Infrastructure(message) => f.write_str(message),
        }
    }
}

impl Error for AppError {}

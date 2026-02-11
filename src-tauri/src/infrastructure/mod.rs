mod migrations;

use std::{fs, path::Path, path::PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use sea_query::{Alias, Expr, ExprTrait, Order, Query, SqliteQueryBuilder, Value as SeaValue};
use sea_query_rusqlite::RusqliteBinder;
use serde_json::Value;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    application::{DocumentStore, LegacyImporter},
    domain::{AppError, DbRecord, LegacyImportReport, Table},
};
use migrations::{import_legacy_database, MigrationRunner, SqliteMigrationRunner};

const TIMESTAMP_SQL: &str = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

pub struct SqliteDocumentStore {
    db_path: PathBuf,
}

impl SqliteDocumentStore {
    pub fn initialize(base_dir: &Path) -> Result<Self, AppError> {
        Self::initialize_with_runner(base_dir, Arc::new(SqliteMigrationRunner::new()))
    }

    pub fn initialize_with_runner(
        base_dir: &Path,
        migration_runner: Arc<dyn MigrationRunner>,
    ) -> Result<Self, AppError> {
        fs::create_dir_all(base_dir).map_err(|e| AppError::infrastructure(e.to_string()))?;
        let db_path = base_dir.join("comic_universe.db");
        let conn = open_connection(&db_path)?;
        migration_runner.run(&conn)?;
        Ok(Self { db_path })
    }
}

impl DocumentStore for SqliteDocumentStore {
    fn upsert(&self, table: Table, id: Option<String>, data: Value) -> Result<DbRecord, AppError> {
        if !data.is_object() {
            return Err(AppError::Validation(
                "Expected data to be a JSON object".to_string(),
            ));
        }

        let conn = open_connection(&self.db_path)?;
        let id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let table_name = table.as_str();
        let sql = format!(
            "
            INSERT INTO {table_name} (id, data)
            VALUES (?1, json(?2))
            ON CONFLICT(id) DO UPDATE SET
              data = json(?2),
              updated_at = ({timestamp});
        ",
            timestamp = TIMESTAMP_SQL
        );

        let payload =
            serde_json::to_string(&data).map_err(|e| AppError::infrastructure(e.to_string()))?;
        conn.execute(&sql, params![id, payload])
            .map_err(|e| AppError::infrastructure(e.to_string()))?;

        self.get(table, &id)?.ok_or_else(|| {
            AppError::Infrastructure("Failed to fetch record after upsert".to_string())
        })
    }

    fn get(&self, table: Table, id: &str) -> Result<Option<DbRecord>, AppError> {
        let conn = open_connection(&self.db_path)?;
        let mut query = Query::select();
        query
            .columns([
                Alias::new("id"),
                Alias::new("data"),
                Alias::new("created_at"),
                Alias::new("updated_at"),
            ])
            .from(Alias::new(table.as_str()))
            .and_where(Expr::col(Alias::new("id")).eq(id.to_string()))
            .limit(1);

        let (sql, values) = query.build_rusqlite(SqliteQueryBuilder);
        let params = values.as_params();

        conn.query_row(&sql, params.as_slice(), row_to_record)
            .optional()
            .map_err(|e| AppError::infrastructure(e.to_string()))
    }

    fn list(
        &self,
        table: Table,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<DbRecord>, AppError> {
        let conn = open_connection(&self.db_path)?;
        let limit = u64::from(limit.unwrap_or(100));
        let offset = u64::from(offset.unwrap_or(0));
        let mut query = Query::select();
        query
            .columns([
                Alias::new("id"),
                Alias::new("data"),
                Alias::new("created_at"),
                Alias::new("updated_at"),
            ])
            .from(Alias::new(table.as_str()))
            .order_by(Alias::new("updated_at"), Order::Desc)
            .limit(limit)
            .offset(offset);

        let (sql, values) = query.build_rusqlite(SqliteQueryBuilder);
        let params = values.as_params();
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| AppError::infrastructure(e.to_string()))?;
        let rows = stmt
            .query_map(params.as_slice(), row_to_record)
            .map_err(|e| AppError::infrastructure(e.to_string()))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::infrastructure(e.to_string()))?);
        }
        Ok(result)
    }

    fn find_by_json_field(
        &self,
        table: Table,
        json_path: &str,
        value: Value,
        limit: Option<u32>,
    ) -> Result<Vec<DbRecord>, AppError> {
        let conn = open_connection(&self.db_path)?;
        let limit = u64::from(limit.unwrap_or(100));
        let path = if json_path.starts_with("$.") {
            json_path.to_string()
        } else {
            format!("$.{json_path}")
        };
        let value_sql =
            serde_json::to_string(&value).map_err(|e| AppError::infrastructure(e.to_string()))?;

        let mut query = Query::select();
        query
            .columns([
                Alias::new("id"),
                Alias::new("data"),
                Alias::new("created_at"),
                Alias::new("updated_at"),
            ])
            .from(Alias::new(table.as_str()))
            .and_where(Expr::cust_with_values(
                "json_extract(data, ?) = json_extract(json(?), '$')",
                vec![
                    SeaValue::String(Some(path)),
                    SeaValue::String(Some(value_sql)),
                ],
            ))
            .order_by(Alias::new("updated_at"), Order::Desc)
            .limit(limit);

        let (sql, values) = query.build_rusqlite(SqliteQueryBuilder);
        let params = values.as_params();
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| AppError::infrastructure(e.to_string()))?;
        let rows = stmt
            .query_map(params.as_slice(), row_to_record)
            .map_err(|e| AppError::infrastructure(e.to_string()))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| AppError::infrastructure(e.to_string()))?);
        }
        Ok(result)
    }

    fn delete(&self, table: Table, id: &str) -> Result<bool, AppError> {
        let conn = open_connection(&self.db_path)?;
        let mut query = Query::delete();
        query
            .from_table(Alias::new(table.as_str()))
            .and_where(Expr::col(Alias::new("id")).eq(id.to_string()));

        let (sql, values) = query.build_rusqlite(SqliteQueryBuilder);
        let params = values.as_params();
        let affected = conn
            .execute(&sql, params.as_slice())
            .map_err(|e| AppError::infrastructure(e.to_string()))?;
        Ok(affected > 0)
    }
}

impl LegacyImporter for SqliteDocumentStore {
    fn import_legacy(
        &self,
        legacy_db_path: Option<String>,
    ) -> Result<Option<LegacyImportReport>, AppError> {
        let conn = open_connection(&self.db_path)?;
        let path = legacy_db_path.map(PathBuf::from);
        import_legacy_database(&conn, path)
    }
}

fn open_connection(path: &Path) -> Result<Connection, AppError> {
    let conn = Connection::open(path).map_err(|e| AppError::infrastructure(e.to_string()))?;
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 5000;
    ",
    )
    .map_err(|e| AppError::infrastructure(e.to_string()))?;
    Ok(conn)
}

fn row_to_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<DbRecord> {
    let payload: String = row.get(1)?;
    let data = serde_json::from_str(&payload).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(
            payload.len(),
            rusqlite::types::Type::Text,
            Box::new(e),
        )
    })?;
    Ok(DbRecord {
        id: row.get(0)?,
        data,
        created_at: row.get(2)?,
        updated_at: row.get(3)?,
    })
}

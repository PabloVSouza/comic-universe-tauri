use std::{collections::HashSet, path::PathBuf};

use rusqlite::{params, Connection};

use crate::domain::{AppError, LegacyImportReport};

pub trait MigrationRunner: Send + Sync {
    fn run(&self, conn: &Connection) -> Result<(), AppError>;
}

struct Migration {
    version: i64,
    name: &'static str,
    sql: &'static str,
}

pub struct SqliteMigrationRunner {
    migrations: Vec<Migration>,
}

impl SqliteMigrationRunner {
    pub fn new() -> Self {
        Self {
            migrations: vec![
                Migration {
                    version: 1,
                    name: "baseline_json_schema",
                    sql: BASELINE_SCHEMA_SQL,
                },
                Migration {
                    version: 3,
                    name: "drop_users_table",
                    sql: DROP_USERS_TABLE_SQL,
                },
                Migration {
                    version: 4,
                    name: "remove_user_id_from_json_documents",
                    sql: REMOVE_USER_ID_FROM_JSON_DOCUMENTS_SQL,
                },
                Migration {
                    version: 5,
                    name: "add_app_state_table",
                    sql: ADD_APP_STATE_TABLE_SQL,
                },
                Migration {
                    version: 6,
                    name: "dedupe_read_progress_by_chapter_and_add_unique_index",
                    sql: DEDUPE_READ_PROGRESS_AND_ADD_UNIQUE_CHAPTER_INDEX_SQL,
                },
                Migration {
                    version: 7,
                    name: "add_relational_columns_and_indexes",
                    sql: ADD_RELATIONAL_COLUMNS_AND_INDEXES_SQL,
                },
            ],
        }
    }
}

impl Default for SqliteMigrationRunner {
    fn default() -> Self {
        Self::new()
    }
}

impl MigrationRunner for SqliteMigrationRunner {
    fn run(&self, conn: &Connection) -> Result<(), AppError> {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version INTEGER PRIMARY KEY NOT NULL,
              name TEXT NOT NULL,
              applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
            );
        ",
        )
        .map_err(|error| AppError::infrastructure(error.to_string()))?;

        let mut stmt = conn
            .prepare("SELECT version FROM schema_migrations;")
            .map_err(|error| AppError::infrastructure(error.to_string()))?;
        let rows = stmt
            .query_map([], |row| row.get::<_, i64>(0))
            .map_err(|error| AppError::infrastructure(error.to_string()))?;

        let mut applied_versions = HashSet::new();
        for row in rows {
            applied_versions
                .insert(row.map_err(|error| AppError::infrastructure(error.to_string()))?);
        }

        for migration in &self.migrations {
            if applied_versions.contains(&migration.version) {
                continue;
            }

            conn.execute_batch(migration.sql)
                .map_err(|error| AppError::infrastructure(error.to_string()))?;
            conn.execute(
                "INSERT INTO schema_migrations (version, name) VALUES (?1, ?2);",
                params![migration.version, migration.name],
            )
            .map_err(|error| AppError::infrastructure(error.to_string()))?;
        }

        if !applied_versions.contains(&2) && import_legacy_database(conn, None)?.is_some() {
            insert_migration_record(conn, 2, "legacy_database_import")?;
        }

        Ok(())
    }
}

pub fn import_legacy_database(
    conn: &Connection,
    path_override: Option<PathBuf>,
) -> Result<Option<LegacyImportReport>, AppError> {
    let legacy_path = match path_override.or_else(resolve_legacy_db_path) {
        Some(path) => path,
        None => return Ok(None),
    };

    conn.execute(
        "ATTACH DATABASE ?1 AS legacy_db;",
        params![legacy_path.to_string_lossy().to_string()],
    )
    .map_err(|error| AppError::infrastructure(error.to_string()))?;

    let import_result = (|| -> Result<usize, AppError> {
        let mut imported = 0usize;

        if legacy_table_exists(conn, "Comic")? {
            imported += conn
                .execute(
                    r#"
                    INSERT OR IGNORE INTO comics (id, data)
                    SELECT
                      CAST(id AS TEXT),
                      json_object(
                        'siteId', siteId,
                        'name', name,
                        'cover', cover,
                        'repo', repo,
                        'author', author,
                        'artist', artist,
                        'publisher', publisher,
                        'status', status,
                        'genres', genres,
                        'siteLink', siteLink,
                        'year', year,
                        'synopsis', synopsis,
                        'type', type,
                        'settings', CASE WHEN json_valid(settings) THEN json(settings) ELSE json('{}') END
                      )
                    FROM legacy_db."Comic";
                    "#,
                    [],
                )
                .map_err(|error| AppError::infrastructure(error.to_string()))?;
        }

        if legacy_table_exists(conn, "Chapter")? {
            imported += conn
                .execute(
                    r#"
                    INSERT OR IGNORE INTO chapters (id, data)
                    SELECT
                      CAST(id AS TEXT),
                      json_object(
                        'comicId', comicId,
                        'siteId', siteId,
                        'siteLink', siteLink,
                        'releaseId', releaseId,
                        'repo', repo,
                        'name', name,
                        'number', number,
                        'date', date,
                        'offline', offline,
                        'language', language
                      )
                    FROM legacy_db."Chapter";
                    "#,
                    [],
                )
                .map_err(|error| AppError::infrastructure(error.to_string()))?;
        }

        if legacy_table_exists(conn, "ReadProgress")? {
            imported += conn
                .execute(
                    r#"
                    INSERT OR IGNORE INTO read_progress (id, data, created_at, updated_at)
                    SELECT
                      CAST(id AS TEXT),
                      json_object(
                        'chapterId', chapterId,
                        'comicId', comicId,
                        'totalPages', totalPages,
                        'page', page
                      ),
                      COALESCE(updatedAt, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                      COALESCE(updatedAt, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
                    FROM legacy_db."ReadProgress";
                    "#,
                    [],
                )
                .map_err(|error| AppError::infrastructure(error.to_string()))?;
        }

        if legacy_table_exists(conn, "Plugin")? {
            imported += conn
                .execute(
                    r#"
                    INSERT OR IGNORE INTO plugins (id, data)
                    SELECT
                      CAST(id AS TEXT),
                      json_object(
                        'enabled', enabled,
                        'name', name,
                        'url', url,
                        'logo', logo,
                        'tag', tag,
                        'description', description
                      )
                    FROM legacy_db."Plugin";
                    "#,
                    [],
                )
                .map_err(|error| AppError::infrastructure(error.to_string()))?;
        }

        if legacy_table_exists(conn, "Changelog")? {
            imported += conn
                .execute(
                    r#"
                    INSERT OR IGNORE INTO changelog (id, data, created_at, updated_at)
                    SELECT
                      CAST(id AS TEXT),
                      json_object(
                        'entityType', entityType,
                        'entityId', entityId,
                        'action', action,
                        'data', CASE
                          WHEN data IS NULL THEN NULL
                          WHEN json_valid(data) THEN json(data)
                          ELSE data
                        END,
                        'synced', synced
                      ),
                      COALESCE(createdAt, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                      COALESCE(createdAt, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
                    FROM legacy_db."Changelog";
                    "#,
                    [],
                )
                .map_err(|error| AppError::infrastructure(error.to_string()))?;
        }

        Ok(imported)
    })();

    let _ = conn.execute("DETACH DATABASE legacy_db;", []);
    let imported = import_result?;

    let report = LegacyImportReport {
        legacy_db_path: legacy_path.display().to_string(),
        imported_rows: imported,
    };

    if report.imported_rows > 0 {
        println!(
            "Imported {} legacy rows from {}",
            report.imported_rows, report.legacy_db_path
        );
    }

    Ok(Some(report))
}

fn legacy_table_exists(conn: &Connection, table_name: &str) -> Result<bool, AppError> {
    let mut stmt = conn
        .prepare(
            "SELECT 1 FROM legacy_db.sqlite_master WHERE type = 'table' AND name = ?1 LIMIT 1;",
        )
        .map_err(|error| AppError::infrastructure(error.to_string()))?;
    let mut rows = stmt
        .query(params![table_name])
        .map_err(|error| AppError::infrastructure(error.to_string()))?;
    rows.next()
        .map(|row| row.is_some())
        .map_err(|error| AppError::infrastructure(error.to_string()))
}

fn insert_migration_record(conn: &Connection, version: i64, name: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO schema_migrations (version, name) VALUES (?1, ?2);",
        params![version, name],
    )
    .map_err(|error| AppError::infrastructure(error.to_string()))?;
    Ok(())
}

fn resolve_legacy_db_path() -> Option<PathBuf> {
    if let Ok(path) = std::env::var("LEGACY_DB_PATH") {
        let path = PathBuf::from(path);
        if path.exists() {
            return Some(path);
        }
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let sibling = manifest_dir
        .parent()?
        .parent()?
        .join("comic-universe")
        .join("dev-data")
        .join("database")
        .join("database.db");
    if sibling.exists() {
        return Some(sibling);
    }

    None
}

const BASELINE_SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS comics (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS read_progress (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_read_progress_chapter_id_unique
ON read_progress (json_extract(data, '$.chapterId'))
WHERE json_type(data, '$.chapterId') = 'text';

CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS changelog (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_comics_site_id ON comics (json_extract(data, '$.siteId'));
CREATE INDEX IF NOT EXISTS idx_chapters_comic_id ON chapters (json_extract(data, '$.comicId'));
CREATE INDEX IF NOT EXISTS idx_changelog_synced ON changelog (json_extract(data, '$.synced'));
"#;

const DROP_USERS_TABLE_SQL: &str = r#"
DROP INDEX IF EXISTS idx_comics_user_site;
DROP INDEX IF EXISTS idx_read_progress_user_id;
DROP INDEX IF EXISTS idx_plugins_user_id;
DROP TABLE IF EXISTS users;
CREATE INDEX IF NOT EXISTS idx_comics_site_id ON comics (json_extract(data, '$.siteId'));
"#;

const REMOVE_USER_ID_FROM_JSON_DOCUMENTS_SQL: &str = r#"
UPDATE comics
SET data = json_remove(data, '$.userId')
WHERE json_type(data, '$.userId') IS NOT NULL;

UPDATE chapters
SET data = json_remove(data, '$.userId')
WHERE json_type(data, '$.userId') IS NOT NULL;

UPDATE read_progress
SET data = json_remove(data, '$.userId')
WHERE json_type(data, '$.userId') IS NOT NULL;

UPDATE plugins
SET data = json_remove(data, '$.userId')
WHERE json_type(data, '$.userId') IS NOT NULL;

UPDATE changelog
SET data = json_remove(json_remove(data, '$.userId'), '$.data.userId')
WHERE json_type(data, '$.userId') IS NOT NULL OR json_type(data, '$.data.userId') IS NOT NULL;
"#;

const ADD_APP_STATE_TABLE_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
"#;

const DEDUPE_READ_PROGRESS_AND_ADD_UNIQUE_CHAPTER_INDEX_SQL: &str = r#"
DELETE FROM read_progress
WHERE json_type(data, '$.chapterId') = 'text'
  AND id NOT IN (
    SELECT id
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY json_extract(data, '$.chapterId')
          ORDER BY updated_at DESC, created_at DESC, id DESC
        ) AS rn
      FROM read_progress
      WHERE json_type(data, '$.chapterId') = 'text'
    )
    WHERE rn = 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_read_progress_chapter_id_unique
ON read_progress (json_extract(data, '$.chapterId'))
WHERE json_type(data, '$.chapterId') = 'text';
"#;

const ADD_RELATIONAL_COLUMNS_AND_INDEXES_SQL: &str = r#"
ALTER TABLE chapters ADD COLUMN comic_id TEXT;
ALTER TABLE read_progress ADD COLUMN chapter_id TEXT;
ALTER TABLE read_progress ADD COLUMN comic_id TEXT;

UPDATE chapters
SET comic_id = json_extract(data, '$.comicId')
WHERE comic_id IS NULL;

UPDATE read_progress
SET
  chapter_id = json_extract(data, '$.chapterId'),
  comic_id = json_extract(data, '$.comicId')
WHERE chapter_id IS NULL OR comic_id IS NULL;

DROP INDEX IF EXISTS idx_chapters_comic_id;
CREATE INDEX IF NOT EXISTS idx_chapters_comic_id ON chapters (comic_id);
CREATE INDEX IF NOT EXISTS idx_read_progress_comic_id ON read_progress (comic_id);
DROP INDEX IF EXISTS idx_read_progress_chapter_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_read_progress_chapter_id_unique ON read_progress (chapter_id);

CREATE TRIGGER IF NOT EXISTS trg_chapters_sync_relational_after_insert
AFTER INSERT ON chapters
FOR EACH ROW
BEGIN
  UPDATE chapters
  SET comic_id = json_extract(NEW.data, '$.comicId')
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_chapters_sync_relational_after_update
AFTER UPDATE OF data ON chapters
FOR EACH ROW
BEGIN
  UPDATE chapters
  SET comic_id = json_extract(NEW.data, '$.comicId')
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_read_progress_sync_relational_after_insert
AFTER INSERT ON read_progress
FOR EACH ROW
BEGIN
  UPDATE read_progress
  SET
    chapter_id = json_extract(NEW.data, '$.chapterId'),
    comic_id = json_extract(NEW.data, '$.comicId')
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_read_progress_sync_relational_after_update
AFTER UPDATE OF data ON read_progress
FOR EACH ROW
BEGIN
  UPDATE read_progress
  SET
    chapter_id = json_extract(NEW.data, '$.chapterId'),
    comic_id = json_extract(NEW.data, '$.comicId')
  WHERE id = NEW.id;
END;
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn imports_legacy_comic_data_into_json_table() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("cu-legacy-migration-{suffix}"));
        fs::create_dir_all(&root).expect("create temp root");

        let legacy_path = root.join("legacy.db");
        let new_path = root.join("new.db");

        let legacy = Connection::open(&legacy_path).expect("open legacy");
        legacy
            .execute_batch(
                r#"
                CREATE TABLE "Comic" (
                  "id" TEXT PRIMARY KEY NOT NULL,
                  "userId" TEXT NOT NULL,
                  "siteId" INTEGER NOT NULL,
                  "name" TEXT NOT NULL,
                  "cover" TEXT,
                  "repo" TEXT,
                  "author" TEXT,
                  "artist" TEXT,
                  "publisher" TEXT,
                  "status" TEXT,
                  "genres" TEXT,
                  "siteLink" TEXT,
                  "year" INTEGER,
                  "synopsis" TEXT,
                  "type" TEXT,
                  "settings" TEXT
                );
                INSERT INTO "Comic" ("id", "userId", "siteId", "name", "settings")
                VALUES ('legacy-comic-1', 'legacy-user-1', 101, 'Legacy Comic', '{"lang":"en"}');
                "#,
            )
            .expect("seed legacy comic");

        std::env::set_var("LEGACY_DB_PATH", legacy_path.to_string_lossy().to_string());

        let conn = Connection::open(&new_path).expect("open new");
        SqliteMigrationRunner::new()
            .run(&conn)
            .expect("run migrations");

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM comics WHERE id = 'legacy-comic-1' AND json_extract(data, '$.name') = 'Legacy Comic';",
                [],
                |row| row.get(0),
            )
            .expect("count imported comics");
        assert_eq!(count, 1);

        std::env::remove_var("LEGACY_DB_PATH");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn removes_user_id_from_existing_json_documents() {
        let conn = Connection::open_in_memory().expect("open memory db");

        conn.execute_batch(BASELINE_SCHEMA_SQL).expect("create baseline schema");
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version INTEGER PRIMARY KEY NOT NULL,
              name TEXT NOT NULL,
              applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
            );
            INSERT INTO schema_migrations (version, name) VALUES (1, 'baseline_json_schema');
            INSERT INTO schema_migrations (version, name) VALUES (2, 'legacy_database_import');
            INSERT INTO schema_migrations (version, name) VALUES (3, 'drop_users_table');
            "#,
        )
        .expect("seed migration history");

        conn.execute(
            r#"INSERT INTO comics (id, data) VALUES ('comic-1', json('{"name":"A","userId":"u-1"}'))"#,
            [],
        )
        .expect("insert comic");
        conn.execute(
            r#"INSERT INTO read_progress (id, data) VALUES ('rp-1', json('{"chapterId":"c-1","userId":"u-1"}'))"#,
            [],
        )
        .expect("insert read progress");
        conn.execute(
            r#"INSERT INTO plugins (id, data) VALUES ('plugin-1', json('{"name":"p","userId":"u-1"}'))"#,
            [],
        )
        .expect("insert plugin");
        conn.execute(
            r#"INSERT INTO changelog (id, data) VALUES ('chg-1', json('{"entityType":"comic","userId":"u-1","data":{"x":1,"userId":"u-1"}}'))"#,
            [],
        )
        .expect("insert changelog");

        SqliteMigrationRunner::new()
            .run(&conn)
            .expect("run migrations");

        let comic_has_user_id: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM comics WHERE json_type(data, '$.userId') IS NOT NULL;",
                [],
                |row| row.get(0),
            )
            .expect("query comics");
        assert_eq!(comic_has_user_id, 0);

        let read_progress_has_user_id: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM read_progress WHERE json_type(data, '$.userId') IS NOT NULL;",
                [],
                |row| row.get(0),
            )
            .expect("query read_progress");
        assert_eq!(read_progress_has_user_id, 0);

        let plugins_has_user_id: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM plugins WHERE json_type(data, '$.userId') IS NOT NULL;",
                [],
                |row| row.get(0),
            )
            .expect("query plugins");
        assert_eq!(plugins_has_user_id, 0);

        let changelog_has_user_id: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM changelog WHERE json_type(data, '$.userId') IS NOT NULL OR json_type(data, '$.data.userId') IS NOT NULL;",
                [],
                |row| row.get(0),
            )
            .expect("query changelog");
        assert_eq!(changelog_has_user_id, 0);
    }
}

use rusqlite::{Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

// ── Data structures ──────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClipItem {
    pub id: i64,
    pub content: String,
    pub content_type: String,
    pub created_at: String,
    pub pinned: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewClip {
    pub content: String,
}

// ── App state (SQLite connection lives here) ─────────────────

pub struct AppState {
    pub db: Mutex<Connection>,
}

// ── Database setup ────────────────────────────────────────────

fn init_db(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS clips (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            content      TEXT    NOT NULL,
            content_type TEXT    NOT NULL DEFAULT 'text',
            created_at   TEXT    NOT NULL,
            pinned       INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_clips_created
            ON clips(created_at DESC);",
    )?;
    Ok(())
}

// ── Content type detection ────────────────────────────────────

fn detect_type(content: &str) -> &'static str {
    let trimmed = content.trim();

    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return "url";
    }

    let hex = trimmed.trim_start_matches('#');
    if (hex.len() == 3 || hex.len() == 6) && hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return "color";
    }

    if (trimmed.starts_with('{') && trimmed.ends_with('}'))
        || (trimmed.starts_with('[') && trimmed.ends_with(']'))
    {
        if serde_json::from_str::<serde_json::Value>(trimmed).is_ok() {
            return "json";
        }
    }
    if trimmed.contains("fn ")
        || trimmed.contains("let ")
        || trimmed.contains("const ")
        || trimmed.contains("def ")
        || trimmed.contains("function ")
        || trimmed.contains("import ")
        || trimmed.contains("export ")
    {
        return "code";
    }
    if trimmed.contains('@') && trimmed.contains('.') && !trimmed.contains(' ') {
        return "email";
    }

    "text"
}

// ── Tauri commands ────────────────────────────────────────────

#[tauri::command]
fn save_clip(content: String, state: State<AppState>) -> Result<ClipItem, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let content_type = detect_type(&content).to_string();
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // avoid saving duplicate of last entry
    let last: Option<String> = db
        .query_row(
            "SELECT content FROM clips ORDER BY id DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .ok();

    if last.as_deref() == Some(&content) {
        return Err("duplicate".to_string());
    }

    db.execute(
        "INSERT INTO clips (content, content_type, created_at, pinned)
         VALUES (?1, ?2, ?3, 0)",
        rusqlite::params![content, content_type, now],
    )
    .map_err(|e| e.to_string())?;

    let id = db.last_insert_rowid();

    Ok(ClipItem {
        id,
        content,
        content_type,
        created_at: now,
        pinned: false,
    })
}

#[tauri::command]
fn get_clips(search: Option<String>, state: State<AppState>) -> Result<Vec<ClipItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let query = match &search {
        Some(s) if !s.is_empty() => format!(
            "SELECT id, content, content_type, created_at, pinned
             FROM clips
             WHERE content LIKE '%{}%'
             ORDER BY pinned DESC, id DESC
             LIMIT 200",
            s.replace('\'', "''")
        ),
        _ => "SELECT id, content, content_type, created_at, pinned
              FROM clips
              ORDER BY pinned DESC, id DESC
              LIMIT 200"
            .to_string(),
    };

    let mut stmt = db.prepare(&query).map_err(|e| e.to_string())?;

    let clips = stmt
        .query_map([], |row| {
            Ok(ClipItem {
                id: row.get(0)?,
                content: row.get(1)?,
                content_type: row.get(2)?,
                created_at: row.get(3)?,
                pinned: row.get::<_, i32>(4)? == 1,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(clips)
}

#[tauri::command]
fn delete_clip(id: i64, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM clips WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn toggle_pin(id: i64, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE clips SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END
         WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn clear_all(state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM clips WHERE pinned = 0", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_clipboard_now() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.get_text().map_err(|e| e.to_string())
}

// ── App entry point ───────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // get platform data dir for persistent DB
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("clipvault");

    std::fs::create_dir_all(&data_dir).ok();
    let db_path = data_dir.join("clips.db");

    let conn = Connection::open(&db_path).expect("failed to open database");
    init_db(&conn).expect("failed to init database");

    tauri::Builder::default()
        .manage(AppState {
            db: Mutex::new(conn),
        })
        .invoke_handler(tauri::generate_handler![
            save_clip,
            get_clips,
            delete_clip,
            toggle_pin,
            clear_all,
            get_clipboard_now,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

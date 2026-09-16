//! Persistence commands for [`AppState`].
//!
//! The state lives in one JSON document under the app data directory. Two
//! properties matter and are both covered by tests:
//!
//! * **Atomic writes.** A crash mid-write must never leave a truncated file, so
//!   every save goes to a temporary sibling and is then renamed over the target.
//! * **Recoverable reads.** A missing or unparsable file is not an error the
//!   user should have to think about: the caller gets `None` (and therefore
//!   defaults) and the unreadable file is preserved as `.bak` for inspection.

use crate::state::{AppState, SCHEMA_VERSION};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const STATE_FILE: &str = "state.json";

/// Resolves the state file path, creating the app data directory if needed.
fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法定位应用数据目录：{error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("无法创建应用数据目录：{error}"))?;
    Ok(dir.join(STATE_FILE))
}

/// Moves an unreadable state file aside so the next save starts from a clean
/// slate without destroying whatever the user had.
fn quarantine(path: &Path) {
    let backup = path.with_extension("json.bak");
    // A previous backup is stale by definition; replacing it keeps exactly one
    // copy of the last broken file around.
    let _ = fs::remove_file(&backup);
    let _ = fs::rename(path, backup);
}

/// Reads and parses `path`, setting a corrupt file aside instead of failing.
///
/// Split out from the command so the two behaviours the module doc claims —
/// quarantine on bad content, hard error on bad access — are testable without an
/// `AppHandle`, which cannot be constructed outside a running app.
fn read_or_quarantine(path: &Path) -> Result<Option<AppState>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(error) => {
            // Unreadable for reasons other than content (permissions, locks).
            // Do not quarantine: the file may be fine once the lock clears.
            return Err(format!("读取设置文件失败：{error}"));
        }
    };

    match serde_json::from_str::<AppState>(&raw) {
        Ok(state) => Ok(Some(migrate(state))),
        Err(_) => {
            quarantine(path);
            Ok(None)
        }
    }
}

/// Reads the stored state, or `None` when there is nothing usable to read.
#[tauri::command]
pub fn load_state(app: AppHandle) -> Result<Option<AppState>, String> {
    read_or_quarantine(&state_path(&app)?)
}

/// Brings an older document up to the current schema.
///
/// Version 1 is the first release, so there is nothing to migrate yet; the hook
/// exists so later changes have an obvious place to live and a test to extend.
fn migrate(state: AppState) -> AppState {
    if state.schema_version == SCHEMA_VERSION {
        return state;
    }
    AppState {
        schema_version: SCHEMA_VERSION,
        ..state
    }
}

/// Writes `payload` to `path` atomically: temp file first, then rename over it.
///
/// Split out from the command for the same reason as [`read_or_quarantine`].
fn write_atomic(path: &Path, payload: &[u8]) -> Result<(), String> {
    let temp = path.with_extension("json.tmp");

    {
        let mut file =
            fs::File::create(&temp).map_err(|error| format!("创建临时文件失败：{error}"))?;
        file.write_all(payload)
            .map_err(|error| format!("写入临时文件失败：{error}"))?;
        // Flush to disk before the rename so a power loss cannot surface an
        // empty file under the real name.
        file.sync_all()
            .map_err(|error| format!("同步临时文件失败：{error}"))?;
    }

    fs::rename(&temp, path).map_err(|error| format!("替换设置文件失败：{error}"))?;
    Ok(())
}

/// Writes the state atomically: temp file first, then rename over the target.
#[tauri::command]
pub fn save_state(app: AppHandle, state: AppState) -> Result<(), String> {
    let path = state_path(&app)?;
    let payload =
        serde_json::to_vec_pretty(&state).map_err(|error| format!("序列化设置失败：{error}"))?;

    write_atomic(&path, &payload)
}

/// Absolute path of the state file. The data screen shows it so the user can
/// back the file up by hand.
#[tauri::command]
pub fn state_file_path(app: AppHandle) -> Result<String, String> {
    Ok(state_path(&app)?.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;

    fn round_trip(state: &AppState) -> AppState {
        let raw = serde_json::to_vec_pretty(state).unwrap();
        serde_json::from_slice::<AppState>(&raw).unwrap()
    }

    #[test]
    fn default_state_matches_the_declared_schema_version() {
        assert_eq!(AppState::default().schema_version, SCHEMA_VERSION);
    }

    #[test]
    fn state_survives_a_serialize_parse_cycle() {
        let mut state = AppState::default();
        state.identity.name = "逗比寒MillerRHan".to_string();
        state.box_state.excluded = vec!["维什戴尔".to_string()];
        state.common.enabled_rogue_ids = vec![5, 6, 7];
        state.history.push(crate::state::HistoryEntry {
            at: 1_700_000_000_000,
            generator_id: "xianshu-6".to_string(),
            action_id: "bp8".to_string(),
            identity: "博士".to_string(),
            seed: 4_294_967_295,
            fields: [("opening_team_name".to_string(), "堡垒战术分队".to_string())]
                .into_iter()
                .collect(),
        });

        let restored = round_trip(&state);
        assert_eq!(restored.identity.name, state.identity.name);
        assert_eq!(restored.box_state.excluded, state.box_state.excluded);
        // A full u32 seed must survive JSON, i.e. it must not be stored as a float.
        assert_eq!(restored.history[0].seed, 4_294_967_295);
    }

    #[test]
    fn appearance_defaults_to_the_rhodes_scheme() {
        let state = AppState::default();
        assert_eq!(state.appearance.color_scheme, "rhodes");
        assert_eq!(state.appearance.reduce_motion, "system");
        assert_eq!(state.appearance.splash_image, "");
        assert_eq!(state.appearance.locale, "zh-CN");
    }

    #[test]
    fn a_document_written_before_splash_image_still_loads() {
        // The upgrade path, and the reason `splash_image` carries
        // `#[serde(default)]`: every file written by the previous release has no
        // `splashImage` key. Without the attribute this parse fails, and a failed
        // parse is not an error the caller sees — `read_or_quarantine` treats it as a
        // corrupt file, moves it to `.bak` and answers "no state". The user's box, ID
        // and history would vanish on the first launch after upgrading.
        //
        // The same file also predates `locale`, which is why that field defaults to a
        // real locale rather than to `String::new()`: an empty locale would render the
        // whole catalogue as raw keys.
        let raw = r#"{
            "schemaVersion": 1,
            "identity": { "name": "博士" },
            "appearance": { "colorScheme": "p5", "reduceMotion": "never" },
            "box": { "excluded": ["维什戴尔"] },
            "common": { "enabledRogueIds": [5], "isJobTeamOnly": true, "isSupportUnitEnabled": true },
            "generators": { "current": "laochan", "currentByFamily": {}, "options": {} },
            "history": []
        }"#;

        let state: AppState = serde_json::from_str(raw).expect("an older document must still parse");

        assert_eq!(state.identity.name, "博士");
        assert_eq!(state.appearance.color_scheme, "p5");
        assert_eq!(state.appearance.reduce_motion, "never");
        assert_eq!(state.appearance.splash_image, "");
        assert_eq!(state.appearance.locale, "zh-CN");
        assert_eq!(state.box_state.excluded, ["维什戴尔"]);
    }

    #[test]
    fn a_document_from_the_future_is_not_quietly_accepted() {
        // `#[serde(default)]` on one field must not have turned into a blanket
        // `#[serde(default)]` on the struct: a document missing a *required* section
        // still has to fail, or a half-written file would load as a half-empty app.
        assert!(serde_json::from_str::<AppState>(r#"{"schemaVersion":1,"appearance":{}}"#).is_err());
    }

    #[test]
    fn migration_stamps_the_current_version() {
        let stale = AppState {
            schema_version: 0,
            ..AppState::default()
        };
        assert_eq!(migrate(stale).schema_version, SCHEMA_VERSION);
    }

    #[test]
    fn wire_names_are_the_ones_the_frontend_reads() {
        // Paired with `src/lib/api/types.test.ts`, which pins the same shape from
        // the TypeScript side. Neither language can see the other's field names,
        // so a rename on one side alone fails only as a silently ignored setting.
        let value: serde_json::Value =
            serde_json::from_str(&serde_json::to_string(&AppState::default()).unwrap()).unwrap();

        let mut keys: Vec<&str> = value.as_object().unwrap().keys().map(String::as_str).collect();
        keys.sort_unstable();
        assert_eq!(
            keys,
            [
                "appearance",
                "box",
                "common",
                "generators",
                "history",
                "identity",
                "schemaVersion"
            ]
        );

        let mut common: Vec<&str> = value["common"]
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        common.sort_unstable();
        assert_eq!(
            common,
            ["enabledRogueIds", "isJobTeamOnly", "isSupportUnitEnabled"]
        );

        let mut appearance: Vec<&str> = value["appearance"]
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        appearance.sort_unstable();
        assert_eq!(appearance, ["colorScheme", "locale", "reduceMotion", "splashImage"]);

        // Named `box_state` in Rust because `box` is a keyword there.
        assert!(value["box"].get("excluded").is_some());
    }

    #[test]
    fn unparsable_payload_is_detected() {
        // The command treats a parse failure as "no state", so the important
        // contract here is that garbage really does fail to parse rather than
        // silently producing a half-built document.
        assert!(serde_json::from_str::<AppState>("{ not json").is_err());
        assert!(serde_json::from_str::<AppState>(r#"{"schema_version":1}"#).is_err());
    }

    /// A private directory per test, removed first so reruns are independent.
    fn scratch_dir(tag: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("kaiju-commands-test-{}-{tag}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_missing_file_reads_as_no_state() {
        let path = scratch_dir("missing").join(STATE_FILE);
        assert!(read_or_quarantine(&path).unwrap().is_none());
    }

    #[test]
    fn an_atomic_write_round_trips_and_leaves_no_temp_file() {
        let path = scratch_dir("round-trip").join(STATE_FILE);

        let mut state = AppState::default();
        state.identity.name = "逗比寒MillerRHan".to_string();
        state.box_state.excluded = vec!["维什戴尔".to_string()];

        write_atomic(&path, &serde_json::to_vec_pretty(&state).unwrap()).unwrap();

        // The rename must have consumed the temporary sibling, otherwise the next
        // save would be writing over a file that is already gone.
        assert!(!path.with_extension("json.tmp").exists());

        let restored = read_or_quarantine(&path).unwrap().unwrap();
        assert_eq!(restored.identity.name, state.identity.name);
        assert_eq!(restored.box_state.excluded, state.box_state.excluded);
    }

    #[test]
    fn a_corrupt_file_is_quarantined_rather_than_reported() {
        let path = scratch_dir("corrupt").join(STATE_FILE);
        fs::write(&path, "{ this is not json").unwrap();

        assert!(read_or_quarantine(&path).unwrap().is_none());

        // Preserved for inspection, and gone from the live path so the next save
        // starts from a clean slate.
        assert_eq!(
            fs::read_to_string(path.with_extension("json.bak")).unwrap(),
            "{ this is not json"
        );
        assert!(!path.exists());
    }

    #[test]
    fn quarantine_keeps_only_the_latest_broken_file() {
        let path = scratch_dir("quarantine-twice").join(STATE_FILE);

        fs::write(&path, "first").unwrap();
        assert!(read_or_quarantine(&path).unwrap().is_none());
        fs::write(&path, "second").unwrap();
        assert!(read_or_quarantine(&path).unwrap().is_none());

        // Exactly one backup survives, or a repeatedly failing launch would pile
        // up copies of the same broken document.
        assert_eq!(
            fs::read_to_string(path.with_extension("json.bak")).unwrap(),
            "second"
        );
    }

    #[test]
    fn an_unreadable_path_is_an_error_and_is_not_quarantined() {
        // The distinction the module doc draws: bad *content* is the user's file
        // and is set aside; bad *access* may be transient (a lock or permissions)
        // and must not be, or the data would be lost to a passing condition.
        let path = scratch_dir("unreadable").join(STATE_FILE);
        fs::create_dir_all(&path).unwrap();

        assert!(read_or_quarantine(&path).is_err());
        assert!(path.is_dir());
    }
}

//! The persisted application state.
//!
//! This mirrors `src/lib/api/types.ts` on the frontend one-for-one, including
//! the camelCase wire names — the frontend writes `schemaVersion`, `colorScheme`
//! and friends, so every struct below opts into `rename_all = "camelCase"`.
//!
//! The Rust side owns exactly one responsibility — storing and returning this
//! document — and deliberately knows nothing about generator rules or the
//! operator dictionary. All of that lives in TypeScript so the ported algorithm
//! stays verifiable against the original web implementation.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Bumped whenever the shape below changes in a way older files cannot satisfy.
pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityState {
    /// The player name. It is the only source of the generation seed's name part.
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceState {
    /// One of `rhodes` / `endfield` / `p5` / `p3r`.
    pub color_scheme: String,
    /// `always` / `never` / `system`.
    pub reduce_motion: String,
    /// The splash background as a data URL, or `""` for none.
    ///
    /// `#[serde(default)]` here is load-bearing rather than tidiness. Every document
    /// written before this field existed has no such key, and serde would otherwise
    /// fail the parse — and a failed parse is not an error the caller sees, it is a
    /// quarantine. The user's box, ID and history would silently reset on the first
    /// launch after the upgrade. The empty string means "no image", which is also the
    /// default, so the fallback and a real answer agree.
    #[serde(default)]
    pub splash_image: String,
    /// The interface language: `zh-CN` or `en`.
    ///
    /// Same reasoning as `splash_image` above — a document written before this field
    /// existed must still load, or the user's data is quarantined — but the default is
    /// named rather than left empty, because `""` is not a locale and would render the
    /// catalogue as raw keys.
    #[serde(default = "default_locale")]
    pub locale: String,
}

/// The source language, and what a fresh install starts in.
fn default_locale() -> String {
    "zh-CN".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoxState {
    /// Six-star operators that are **not** in the user's box.
    ///
    /// Storing the exclusions rather than the inclusions means an operator added
    /// to the dictionary later is in the box by default, so nobody has to revisit
    /// the box screen after a game update.
    pub excluded: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommonOptions {
    pub enabled_rogue_ids: Vec<u32>,
    pub is_job_team_only: bool,
    pub is_support_unit_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratorState {
    /// Currently selected generator, e.g. `opening` or `xianshu-8`.
    pub current: String,
    /// Which edition of a multi-edition family is selected, keyed by family id.
    pub current_by_family: BTreeMap<String, String>,
    /// Per-generator option values, keyed by generator id.
    pub options: BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    /// Unix milliseconds.
    pub at: i64,
    pub generator_id: String,
    pub action_id: String,
    pub identity: String,
    /// The deterministic seed. A full `u32` must survive the JSON round trip, so
    /// this is a `u64` rather than anything floating point.
    pub seed: u64,
    /// Structured result fields; never rendered markup.
    pub fields: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub schema_version: u32,
    pub identity: IdentityState,
    pub appearance: AppearanceState,
    /// `box` is a Rust keyword, so the field is named differently here while the
    /// wire name stays `box` for the frontend.
    #[serde(rename = "box")]
    pub box_state: BoxState,
    pub common: CommonOptions,
    pub generators: GeneratorState,
    pub history: Vec<HistoryEntry>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            identity: IdentityState {
                name: String::new(),
            },
            appearance: AppearanceState {
                color_scheme: "rhodes".to_string(),
                reduce_motion: "system".to_string(),
                splash_image: String::new(),
                locale: default_locale(),
            },
            box_state: BoxState {
                excluded: Vec::new(),
            },
            common: CommonOptions {
                // Rogues 4..7 start checked, mirroring the original tool's
                // defaults; the two oldest ones start unchecked.
                enabled_rogue_ids: vec![4, 5, 6, 7],
                is_job_team_only: false,
                is_support_unit_enabled: false,
            },
            generators: GeneratorState {
                current: "opening".to_string(),
                current_by_family: BTreeMap::new(),
                options: BTreeMap::new(),
            },
            history: Vec::new(),
        }
    }
}

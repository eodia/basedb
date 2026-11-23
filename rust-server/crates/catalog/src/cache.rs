//! The catalog's versioned caches and validators (`catalog/cache.ts`).
//!
//! Every entry carries the two counters it was built from; a read with other counters is a
//! miss. 30 s at most, 64 entries per cache, least recently used evicted first.

use basedb_base::db::Exec;
use basedb_base::error::AppError;
use basedb_base::rbac::ActorGrants;
use basedb_base::tx::RequestContext;
use indexmap::IndexMap;
use sha2::{Digest, Sha256};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::Instant;

pub const SNAPSHOT_TTL_MS: u128 = 30_000;
pub const DOCUMENT_CACHE_ENTRIES: usize = 64;
pub const DOCUMENT_MAX_BYTES: usize = 2 * 1024 * 1024;
/// Part of every validator: a new version of the server is a new document.
pub const APPLICATION_VERSION: &str = basedb_base::migrate::APPLICATION_VERSION;

/// The two counters a projection is a function of.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CatalogVersions {
    pub catalog: String,
    pub authz: i64,
}

/// `readVersions`: `None` for an unknown tenant.
pub async fn read_versions<E: Exec + Sync>(exec: &E, tenant_ref: &str) -> Result<Option<CatalogVersions>, AppError> {
    let row = exec
        .first(
            "SELECT t.authz_version,
                    coalesce(
                      md5(string_agg(b.id::text || ':' || b.catalog_version::text || ':'
                                     || b.project_id::text, ',' ORDER BY b.id)),
                      'aucune-base'
                    ) || ':' || coalesce(
                      (SELECT md5(string_agg(p.id::text || ':' || p.updated_at::text, ',' ORDER BY p.id))
                         FROM _basedb.project p
                        WHERE p.tenant_id = t.id AND p.deleted_at IS NULL),
                      'aucun-projet'
                    ) AS catalog
               FROM _basedb.tenant t
               LEFT JOIN _basedb.base b
                      ON b.tenant_id = t.id AND b.is_live AND b.deleted_at IS NULL
              WHERE t.ref = $1
              GROUP BY t.id, t.authz_version",
            &[&tenant_ref],
        )
        .await?;
    Ok(row.map(|r| CatalogVersions { authz: r.get(0), catalog: r.get(1) }))
}

struct Entry<T> {
    value: T,
    versions: CatalogVersions,
    stored_at: Instant,
}

/// `VersionedCache`.
pub struct VersionedCache<T> {
    capacity: usize,
    entries: Mutex<IndexMap<String, Entry<T>>>,
}

impl<T: Clone> VersionedCache<T> {
    pub fn new(capacity: usize) -> Self {
        VersionedCache { capacity, entries: Mutex::new(IndexMap::new()) }
    }

    pub fn get(&self, key: &str, versions: &CatalogVersions) -> Option<T> {
        self.get_at(key, versions, Instant::now())
    }

    fn get_at(&self, key: &str, versions: &CatalogVersions, now: Instant) -> Option<T> {
        let mut entries = self.entries.lock().unwrap();
        let entry = entries.shift_remove(key)?;
        if &entry.versions != versions || now.saturating_duration_since(entry.stored_at).as_millis() > SNAPSHOT_TTL_MS {
            return None;
        }
        let value = entry.value.clone();
        entries.insert(key.to_string(), entry);
        Some(value)
    }

    pub fn set(&self, key: &str, versions: &CatalogVersions, value: T) {
        self.set_at(key, versions, Instant::now(), value)
    }

    fn set_at(&self, key: &str, versions: &CatalogVersions, now: Instant, value: T) {
        let mut entries = self.entries.lock().unwrap();
        entries.shift_remove(key);
        entries.insert(key.to_string(), Entry { value, versions: versions.clone(), stored_at: now });
        while entries.len() > self.capacity {
            entries.shift_remove_index(0);
        }
    }

    pub fn clear(&self) {
        self.entries.lock().unwrap().clear();
    }

    pub fn len(&self) -> usize {
        self.entries.lock().unwrap().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

pub static CATALOG_CACHE: LazyLock<VersionedCache<Arc<crate::projection::RawCatalog>>> =
    LazyLock::new(|| VersionedCache::new(DOCUMENT_CACHE_ENTRIES));
pub static GRANTS_CACHE: LazyLock<VersionedCache<Arc<ActorGrants>>> = LazyLock::new(|| VersionedCache::new(DOCUMENT_CACHE_ENTRIES));
pub static DOCUMENT_CACHE: LazyLock<VersionedCache<Arc<String>>> = LazyLock::new(|| VersionedCache::new(DOCUMENT_CACHE_ENTRIES));

/// `clearCaches`.
pub fn clear_caches() {
    CATALOG_CACHE.clear();
    GRANTS_CACHE.clear();
    DOCUMENT_CACHE.clear();
}

fn sha256_hex(text: &str) -> String {
    Sha256::digest(text.as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

/// `permissionsFingerprint`: what an actor may see, in sixteen hexadecimal digits.
pub fn permissions_fingerprint(grants: &ActorGrants) -> String {
    // Node groups the roles by `p.role_id` of a LEFT JOIN: every role without a permission
    // row becomes one `null` entry (rendered `''` by `join`, sorted as the string "null"),
    // and keeps its own id only if it carries a field restriction.
    let mut roles: Vec<&str> = Vec::new();
    let mut null_role = false;
    for r in &grants.roles {
        if r.permissions.is_empty() {
            null_role = true;
            if r.field_restrictions.is_empty() {
                continue;
            }
        }
        roles.push(r.id.as_str());
    }
    let mut roles: Vec<(&str, &str)> = roles.into_iter().map(|id| (id, id)).collect();
    if null_role {
        roles.push(("null", ""));
    }
    roles.sort_unstable_by(|a, b| a.0.cmp(b.0));
    let roles: Vec<&str> = roles.into_iter().map(|(_, shown)| shown).collect();
    let token = if grants.token_role.is_none() && grants.token_base_id.is_none() {
        String::new()
    } else {
        let mut ids: Vec<&str> = grants.token_base_ids.iter().flatten().map(String::as_str).collect();
        ids.sort_unstable();
        let mut surfaces: Vec<&str> = grants.token_allowed_surfaces.iter().flatten().map(|s| s.as_str()).collect();
        surfaces.sort_unstable();
        [
            grants.token_role.as_ref().map(|r| r.id.as_str()).unwrap_or(""),
            grants.token_base_id.as_ref().and_then(|b| b.as_deref()).unwrap_or(""),
            &ids.join(","),
            &surfaces.join(","),
        ]
        .join("/")
    };
    let admin = if grants.is_instance_admin { "admin" } else { "user" };
    sha256_hex(&format!("{admin}|{}|{token}", roles.join(",")))[..16].to_string()
}

/// `etagFor`: a strong validator from the counters alone, never from the bytes.
pub fn etag_for(ctx: &RequestContext, versions: &CatalogVersions, grants: &ActorGrants, kind: &str, reference: &str) -> String {
    let digest = sha256_hex(
        &[
            ctx.tenant_id.as_str(),
            reference,
            kind,
            &versions.catalog,
            &versions.authz.to_string(),
            &permissions_fingerprint(grants),
            APPLICATION_VERSION,
        ]
        .join("|"),
    );
    format!("\"{}\"", &digest[..32])
}

#[cfg(test)]
mod tests {
    use super::*;
    use basedb_base::rbac::decide::Role;
    use std::time::Duration;

    fn v(catalog: &str, authz: i64) -> CatalogVersions {
        CatalogVersions { catalog: catalog.into(), authz }
    }

    #[test]
    fn a_change_of_counter_is_a_miss() {
        let cache = VersionedCache::new(64);
        let t0 = Instant::now();
        cache.set_at("t", &v("a", 1), t0, 1);
        assert_eq!(cache.get_at("t", &v("a", 1), t0), Some(1));
        assert_eq!(cache.get_at("t", &v("b", 1), t0), None);
        cache.set_at("t", &v("a", 1), t0, 1);
        assert_eq!(cache.get_at("t", &v("a", 2), t0), None);
    }

    #[test]
    fn expires_after_the_ttl() {
        let cache = VersionedCache::new(64);
        let t0 = Instant::now();
        cache.set_at("t", &v("a", 1), t0, 1);
        assert_eq!(cache.get_at("t", &v("a", 1), t0 + Duration::from_millis(30_000)), Some(1));
        assert_eq!(cache.get_at("t", &v("a", 1), t0 + Duration::from_millis(30_001)), None);
    }

    #[test]
    fn evicts_the_least_recently_used() {
        let cache = VersionedCache::new(2);
        let t0 = Instant::now();
        cache.set_at("a", &v("x", 1), t0, 1);
        cache.set_at("b", &v("x", 1), t0, 2);
        assert_eq!(cache.get_at("a", &v("x", 1), t0), Some(1));
        cache.set_at("c", &v("x", 1), t0, 3);
        assert_eq!(cache.len(), 2);
        assert_eq!(cache.get_at("b", &v("x", 1), t0), None);
        assert_eq!(cache.get_at("a", &v("x", 1), t0), Some(1));
    }

    #[test]
    fn fingerprints_ignore_role_order() {
        let role = |id: &str| Role { id: id.into(), ..Default::default() };
        let a = ActorGrants { roles: vec![role("r1"), role("r2")], ..Default::default() };
        let b = ActorGrants { roles: vec![role("r2"), role("r1")], ..Default::default() };
        assert_eq!(permissions_fingerprint(&a), permissions_fingerprint(&b));
        assert_eq!(permissions_fingerprint(&a).len(), 16);
        let admin = ActorGrants { is_instance_admin: true, ..a.clone() };
        assert_ne!(permissions_fingerprint(&a), permissions_fingerprint(&admin));
        let token = ActorGrants { token_base_id: Some(None), ..a.clone() };
        assert_ne!(permissions_fingerprint(&a), permissions_fingerprint(&token));
    }
}

//! `catalog/members.ts`: the people a `user` field names (`GET /meta/users`).

use axum::extract::{Path, State};
use axum::http::{HeaderMap, Uri};
use axum::Extension;
use basedb_base::auth::data_context;
use basedb_base::db::{Exec, PoolName};
use basedb_base::error::{json_ok, ApiResult};
use basedb_base::layers::RequestId;
use basedb_base::rbac::loader::load_grants;
use basedb_base::rbac::require::administers;
use basedb_base::tx::{with_transaction, TxOptions};
use basedb_base::Shared;
use serde_json::{json, Value};

pub async fn list(State(st): State<Shared>, Extension(rid): Extension<RequestId>, headers: HeaderMap, uri: Uri, Path(tenant): Path<String>) -> ApiResult {
    let ctx = data_context(&st, &headers, &uri, &rid, Some(&tenant)).await?;
    let c = &ctx;
    let members = with_transaction(&st.pools, PoolName::Catalog, c, TxOptions::read_only(), |tx| async move {
        let everyone = administers(c, &load_grants(&tx, c).await?);
        let rows = tx
            .rows(
                "WITH reach AS (
                   SELECT m.user_id,
                          coalesce(p.scope_project_id, b.project_id, tb.project_id, ab.project_id)
                            AS project_id
                     FROM _basedb.permission p
                     JOIN _basedb.role_member m      ON m.role_id = p.role_id
                     LEFT JOIN _basedb.base b        ON b.id = p.scope_base_id
                     LEFT JOIN _basedb.table_def td  ON td.id = p.scope_table_id
                     LEFT JOIN _basedb.base tb       ON tb.id = td.base_id
                     LEFT JOIN _basedb.application a ON a.id = p.scope_application_id
                     LEFT JOIN _basedb.base ab       ON ab.id = a.base_id
                    WHERE p.scope_kind <> 'tenant'
                 )
                 SELECT u.id::text, u.display_name, u.email, u.disabled_at IS NOT NULL AS disabled
                   FROM _basedb.app_user u
                   JOIN _basedb.tenant t ON t.id = u.tenant_id
                  WHERE t.ref = $1 AND u.deleted_at IS NULL
                    AND (NOT u.is_system OR u.is_instance_admin)
                    AND ($3::boolean OR u.id = $2::text::uuid OR EXISTS (
                          SELECT 1 FROM reach theirs JOIN reach mine ON mine.project_id = theirs.project_id
                           WHERE theirs.user_id = u.id AND mine.user_id = $2::text::uuid))
                  ORDER BY u.display_name, u.email",
                &[&c.tenant_id, &c.actor.id, &everyone],
            )
            .await?;
        Ok(rows
            .iter()
            .map(|r| json!({ "id": r.get::<_, String>(0), "display_name": r.get::<_, String>(1), "email": r.get::<_, String>(2), "disabled": r.get::<_, bool>(3) }))
            .collect::<Vec<Value>>())
    })
    .await?;
    Ok(json_ok(json!({ "data": members })))
}

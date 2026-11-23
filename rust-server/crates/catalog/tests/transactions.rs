//! A transaction abandoned mid-way (request future dropped, client gone) must not hand its
//! connection back to the pool still open: the next catalog snapshot — `BEGIN ISOLATION
//! LEVEL REPEATABLE READ` — would fail with « SET TRANSACTION ISOLATION LEVEL must be called
//! before any query », and `GET /meta/projects` with it.

use axum::http::StatusCode;
use basedb_base::db::{Exec, PoolName};
use basedb_base::testing::test_app;
use basedb_base::tx::{with_transaction, Actor, RequestContext, Surface, TxOptions};
use std::time::Duration;

const TENANT: &str = "t4z56fq";

#[tokio::test]
async fn an_abandoned_transaction_does_not_poison_the_next_snapshot() {
    let Some(app) = test_app(basedb_catalog::router).await else { return };
    // One connection: whatever the abandoned transaction leaves behind, the next request gets.
    app.st.pools.catalog.resize(1);
    let admin = app.login("admin@basedb.local", "developpement-basedb").await;
    let path = format!("/api/v1/{TENANT}/meta/projects");
    assert_eq!(app.get(&path, &admin).await.0, StatusCode::OK);

    for _ in 0..3 {
        let ctx = RequestContext::new("abandoned", Actor::system(), TENANT, Surface::System);
        let abandoned = tokio::time::timeout(
            Duration::from_millis(200),
            with_transaction(&app.st.pools, PoolName::Catalog, &ctx, TxOptions::default(), |tx| async move {
                tx.rows("SELECT 1", &[]).await?;
                std::future::pending::<()>().await;
                Ok(())
            }),
        )
        .await;
        assert!(abandoned.is_err(), "the work never ends: the timeout drops it");

        let (status, body) = app.get(&path, &admin).await;
        assert_eq!(status, StatusCode::OK, "{body}");
    }
}

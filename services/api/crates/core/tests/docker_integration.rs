use redis::AsyncCommands;
use sea_orm::{ConnectionTrait, Database, Statement};
use std::time::Duration;

fn db_url() -> String {
    std::env::var("TEST_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .unwrap_or_else(|_| "postgres://postgres:postgres@127.0.0.1:15432/maxxpixels_ott".to_string())
}

fn redis_url() -> String {
    std::env::var("TEST_REDIS_URL")
        .or_else(|_| std::env::var("REDIS_URL"))
        .unwrap_or_else(|_| "redis://127.0.0.1:16379/0".to_string())
}

#[tokio::test]
async fn postgres_select_one() {
    let url = db_url();
    let db = tokio::time::timeout(Duration::from_secs(10), Database::connect(&url))
        .await
        .expect("db connect timeout")
        .expect("failed to connect to postgres");

    let res = db
        .query_one(Statement::from_string(
            sea_orm::DatabaseBackend::Postgres,
            "SELECT 1 as one".to_owned(),
        ))
        .await
        .expect("select 1 query failed");

    assert!(res.is_some(), "expected row from SELECT 1");
    db.close().await.expect("close db");
}

#[tokio::test]
async fn redis_ping_set_get_del() {
    let url = redis_url();
    let client = redis::Client::open(url).expect("invalid redis url");
    let mut conn = tokio::time::timeout(Duration::from_secs(10), client.get_multiplexed_async_connection())
        .await
        .expect("redis connect timeout")
        .expect("failed to connect to redis");

    let pong: String = redis::cmd("PING").query_async(&mut conn).await.expect("PING failed");
    assert_eq!(pong, "PONG");

    let key = "it:docker:smoke";
    let _: () = conn.set_ex(key, "ok", 30).await.expect("SETEX failed");
    let val: Option<String> = conn.get(key).await.expect("GET failed");
    assert_eq!(val.as_deref(), Some("ok"));
    let _: () = conn.del(key).await.expect("DEL failed");
    let gone: Option<String> = conn.get(key).await.expect("GET after DEL failed");
    assert!(gone.is_none());
}

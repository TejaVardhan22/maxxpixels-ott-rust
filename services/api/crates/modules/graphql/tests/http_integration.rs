use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use maxx_module_graphql::graphql_routes;
use serde_json::Value;
use tower::ServiceExt;

async fn body_json(body: Body) -> Value {
    let bytes = body.collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap()
}

#[tokio::test]
async fn graphql_get_graphiql_returns_html() {
    let app = graphql_routes();
    for path in ["/graphql", "/api/graphql", "/api/v1/graphql"] {
        let resp = app
            .clone()
            .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK, "GET {path}");
        let ct = resp.headers().get("content-type").and_then(|v| v.to_str().ok()).unwrap_or("");
        assert!(ct.contains("text/html"), "GET {path} content-type: {ct}");
    }
}

#[tokio::test]
async fn graphql_post_health_query() {
    let app = graphql_routes();
    let payload = serde_json::json!({"query": "{ health }"});
    for path in ["/graphql", "/api/graphql", "/api/v1/graphql"] {
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(path)
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK, "POST {path}");
        let json = body_json(resp.into_body()).await;
        assert_eq!(json["data"]["health"], "ok", "POST {path}: {json}");
    }
}

#[tokio::test]
async fn graphql_post_languages_and_status_queries() {
    let app = graphql_routes();
    for (query, check) in [
        ("{ languages { id name code nativeName } }", "languages"),
        ("{ graphqlStatus }", "graphqlStatus"),
    ] {
        let payload = serde_json::json!({"query": query});
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/graphql")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let json = body_json(resp.into_body()).await;
        assert!(json.get("data").and_then(|d| d.get(check)).is_some(), "missing {check}: {json}");
        if check == "languages" {
            assert_eq!(json["data"]["languages"].as_array().map(|a| a.len()), Some(6));
        }
    }
}


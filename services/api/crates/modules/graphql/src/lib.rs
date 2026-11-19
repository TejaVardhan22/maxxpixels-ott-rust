use async_graphql::{http::GraphiQLSource, EmptyMutation, EmptySubscription, Object, Schema, SimpleObject, ID};
use async_graphql::Request as GqlRequest;
use axum::{extract::Extension, response::{Html, IntoResponse}, routing::get, Json, Router};
use serde::Deserialize;

#[derive(SimpleObject, Clone)]
struct LanguageItem {
    id: ID,
    name: String,
    code: String,
    native_name: Option<String>,
}

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    async fn health(&self) -> &str { "ok" }

    /// Placeholder parity endpoint; returns static languages (NestJS parity target list).
    async fn languages(&self) -> Vec<LanguageItem> {
        vec![
            LanguageItem { id: ID("1".into()), name: "Kannada".into(), code: "kn".into(), native_name: Some("ಕನ್ನಡ".into()) },
            LanguageItem { id: ID("2".into()), name: "Telugu".into(), code: "te".into(), native_name: Some("తెలుగు".into()) },
            LanguageItem { id: ID("3".into()), name: "Tamil".into(), code: "ta".into(), native_name: Some("தமிழ்".into()) },
            LanguageItem { id: ID("4".into()), name: "Malayalam".into(), code: "ml".into(), native_name: Some("മലയാളം".into()) },
            LanguageItem { id: ID("5".into()), name: "Hindi".into(), code: "hi".into(), native_name: Some("हिन्दी".into()) },
            LanguageItem { id: ID("6".into()), name: "English".into(), code: "en".into(), native_name: Some("English".into()) },
        ]
    }

    /// Scaffold: GraphQL module mounted for NestJS parity; extend with catalog/user/playback/subscription resolvers.
    async fn graphql_status(&self) -> &str { "scaffold: extend resolvers for full NestJS parity" }
}

pub type AppSchema = Schema<QueryRoot, EmptyMutation, EmptySubscription>;

pub fn build_schema() -> AppSchema {
    Schema::build(QueryRoot, EmptyMutation, EmptySubscription)
        .limit_depth(10)
        .limit_complexity(2000)
        .finish()
}

#[derive(Deserialize)]
struct GqlPayload {
    query: String,
    #[serde(default)]
    variables: Option<serde_json::Value>,
    #[serde(rename = "operationName")]
    #[serde(default)]
    operation_name: Option<String>,
}

async fn graphql_handler(Extension(schema): Extension<AppSchema>, Json(payload): Json<GqlPayload>) -> impl IntoResponse {
    let mut req = GqlRequest::new(payload.query);
    if let Some(vars) = payload.variables {
        req = req.variables(async_graphql::Variables::from_json(vars));
    }
    if let Some(op) = payload.operation_name { req = req.operation_name(op); }
    let resp = schema.execute(req).await;
    Json(serde_json::to_value(resp).unwrap_or_else(|_| serde_json::json!({"errors":[{"message":"serialization error"}]})))
}

async fn graphiql() -> impl IntoResponse {
    Html(GraphiQLSource::build().endpoint("/graphql").finish())
}

pub fn graphql_routes() -> Router {
    let schema = build_schema();
    Router::new()
        .route("/graphql", get(graphiql).post(graphql_handler))
        .route("/api/graphql", get(graphiql).post(graphql_handler))
        .route("/api/v1/graphql", get(graphiql).post(graphql_handler))
        .layer(Extension(schema))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn schema_health_query_returns_ok() {
        let schema = build_schema();
        let resp = schema.execute("{ health }").await;
        assert!(resp.errors.is_empty(), "errors: {:?}", resp.errors);
        let data = resp.data.into_json().unwrap();
        assert_eq!(data["health"], "ok");
    }

    #[tokio::test]
    async fn schema_languages_query_returns_list() {
        let schema = build_schema();
        let resp = schema.execute("{ languages { id name code nativeName } }").await;
        assert!(resp.errors.is_empty(), "errors: {:?}", resp.errors);
        let data = resp.data.into_json().unwrap();
        let langs = data["languages"].as_array().expect("languages array");
        assert_eq!(langs.len(), 6);
        assert_eq!(langs[0]["code"], "kn");
        assert_eq!(langs[5]["code"], "en");
    }

    #[tokio::test]
    async fn schema_status_query_returns_scaffold_message() {
        let schema = build_schema();
        let resp = schema.execute("{ graphqlStatus }").await;
        assert!(resp.errors.is_empty(), "errors: {:?}", resp.errors);
        let data = resp.data.into_json().unwrap();
        assert!(data["graphqlStatus"].as_str().unwrap_or("").contains("scaffold"));
    }
}

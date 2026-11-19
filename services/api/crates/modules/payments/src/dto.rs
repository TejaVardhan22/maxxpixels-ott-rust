use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminPaymentListQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub status: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminTvodListQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub search: Option<String>,
}


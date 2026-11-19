use maxx_common::error::AppError;
use maxx_common::{normalize_aadhaar, normalize_pan, validate_aadhaar, validate_email_format, validate_pan};
use maxx_core::entities::{marketing_agent, marketing_agent_member, user};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder, Set,
};
use uuid::Uuid;

use crate::dto::{
    CreateMarketingAgentRequest, MarketingAgentResponse, MarketingMemberResponse,
};

fn clean_optional(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn normalize_mobile(raw: &str) -> String {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() >= 10 {
        format!("+91{}", &digits[digits.len() - 10..])
    } else {
        raw.trim().to_string()
    }
}

fn generate_agent_code() -> String {
    let raw = Uuid::new_v4().simple().to_string();
    let suffix: String = raw.chars().take(8).collect();
    format!("MKT-{}", suffix.to_uppercase())
}

fn format_time(value: chrono::DateTime<chrono::FixedOffset>) -> String {
    value.to_rfc3339()
}

async fn member_count(db: &DatabaseConnection, agent_id: i64) -> i64 {
    marketing_agent_member::Entity::find()
        .filter(marketing_agent_member::Column::AgentId.eq(agent_id))
        .count(db)
        .await
        .unwrap_or(0) as i64
}

fn to_response(model: marketing_agent::Model, count: i64) -> MarketingAgentResponse {
    MarketingAgentResponse {
        id: model.id,
        agent_code: model.agent_code,
        full_name: model.full_name,
        mobile_number: model.mobile_number,
        email: model.email,
        aadhaar_number: model.aadhaar_number,
        pan_number: model.pan_number,
        aadhaar_doc_url: model.aadhaar_doc_url,
        pan_doc_url: model.pan_doc_url,
        status: model.status,
        member_count: count,
        created_at: format_time(model.created_at),
        updated_at: format_time(model.updated_at),
    }
}

#[derive(Clone)]
pub struct MarketingService {
    db: DatabaseConnection,
}

impl MarketingService {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn create_agent(
        &self,
        req: CreateMarketingAgentRequest,
    ) -> Result<MarketingAgentResponse, AppError> {
        let full_name = clean_optional(req.full_name)
            .ok_or_else(|| AppError::BadRequest("Marketing agent name is required".to_string()))?;
        let mobile_number = clean_optional(req.mobile_number)
            .ok_or_else(|| AppError::BadRequest("Marketing agent mobile number is required".to_string()))?;
        let email = clean_optional(req.email)
            .ok_or_else(|| AppError::BadRequest("Marketing agent email is required".to_string()))?
            .to_lowercase();
        validate_email_format(&email)?;

        let aadhaar_number = match clean_optional(req.aadhaar_number) {
            Some(value) => {
                validate_aadhaar(&value)?;
                Some(normalize_aadhaar(&value))
            }
            None => None,
        };
        let pan_number = match clean_optional(req.pan_number) {
            Some(value) => {
                validate_pan(&value)?;
                Some(normalize_pan(&value))
            }
            None => None,
        };
        let aadhaar_doc_url = clean_optional(req.aadhaar_doc_url)
            .ok_or_else(|| AppError::BadRequest("Aadhaar document upload is required".to_string()))?;
        let pan_doc_url = clean_optional(req.pan_doc_url)
            .ok_or_else(|| AppError::BadRequest("PAN card document upload is required".to_string()))?;
        let mobile_number = normalize_mobile(&mobile_number);
        let status = req
            .status
            .map(|s| s.trim().to_uppercase())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "ACTIVE".to_string());

        let db = &self.db;
        let mut inserted = None;
        for _ in 0..12 {
            let candidate = generate_agent_code();
            let exists = marketing_agent::Entity::find()
                .filter(marketing_agent::Column::AgentCode.eq(candidate.clone()))
                .one(db)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;
            if exists.is_some() {
                continue;
            }

            let now = chrono::Utc::now().into();
            let model = marketing_agent::ActiveModel {
                agent_code: Set(candidate),
                full_name: Set(full_name),
                mobile_number: Set(mobile_number),
                email: Set(email),
                aadhaar_number: Set(aadhaar_number),
                pan_number: Set(pan_number),
                aadhaar_doc_url: Set(Some(aadhaar_doc_url)),
                pan_doc_url: Set(Some(pan_doc_url)),
                status: Set(status),
                created_at: Set(now),
                updated_at: Set(now),
                ..Default::default()
            };
            inserted = Some(
                model
                    .insert(db)
                    .await
                    .map_err(|e| AppError::Internal(e.to_string()))?,
            );
            break;
        }

        let model = inserted.ok_or_else(|| {
            AppError::Internal("Unable to generate a unique marketing agent code".to_string())
        })?;
        Ok(to_response(model, 0))
    }

    pub async fn list_agents(&self) -> Result<Vec<MarketingAgentResponse>, AppError> {
        let db = &self.db;
        let agents = marketing_agent::Entity::find()
            .order_by_desc(marketing_agent::Column::Id)
            .all(db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let mut out = Vec::with_capacity(agents.len());
        for agent in agents {
            let count = member_count(db, agent.id).await;
            out.push(to_response(agent, count));
        }
        Ok(out)
    }

    pub async fn get_agent(&self, id: i64) -> Result<MarketingAgentResponse, AppError> {
        let db = &self.db;
        let agent = marketing_agent::Entity::find_by_id(id)
            .one(db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::NotFound("Marketing agent not found".to_string()))?;
        let count = member_count(db, id).await;
        Ok(to_response(agent, count))
    }

    pub async fn toggle_status(&self, id: i64) -> Result<MarketingAgentResponse, AppError> {
        let db = &self.db;
        let agent = marketing_agent::Entity::find_by_id(id)
            .one(db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::NotFound("Marketing agent not found".to_string()))?;
        let next = if agent.status.eq_ignore_ascii_case("ACTIVE") {
            "INACTIVE"
        } else {
            "ACTIVE"
        };
        let mut model: marketing_agent::ActiveModel = agent.into();
        model.status = Set(next.to_string());
        model.updated_at = Set(chrono::Utc::now().into());
        let saved = model
            .update(db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let count = member_count(db, id).await;
        Ok(to_response(saved, count))
    }

    pub async fn list_members(&self, agent_id: i64) -> Result<Vec<MarketingMemberResponse>, AppError> {
        let db = &self.db;
        let agent_code = marketing_agent::Entity::find_by_id(agent_id)
            .one(db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
            .map(|a| a.agent_code);
        let members = marketing_agent_member::Entity::find()
            .filter(marketing_agent_member::Column::AgentId.eq(agent_id))
            .order_by_desc(marketing_agent_member::Column::CreatedAt)
            .all(db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut out = Vec::with_capacity(members.len());
        for member in members {
            let u = user::Entity::find_by_id(member.user_id)
                .one(db)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;
            out.push(MarketingMemberResponse {
                id: member.id,
                agent_id: member.agent_id,
                agent_code: agent_code.clone(),
                user_id: member.user_id,
                phone_number: member.phone_number.or_else(|| {
                    u.as_ref().and_then(|m| m.phone_number.clone().or_else(|| m.phone.clone()))
                }),
                full_name: u.as_ref().and_then(|m| m.full_name.clone()),
                email: u.as_ref().and_then(|m| m.email.clone()),
                joined_at: format_time(member.created_at),
            });
        }
        Ok(out)
    }
}

pub async fn validate_agent_code(
    db: &DatabaseConnection,
    code: &str,
) -> Result<MarketingAgentResponse, AppError> {
    let normalized = code.trim().to_uppercase();
    if normalized.is_empty() {
        return Err(AppError::BadRequest("Marketing agent code is required".to_string()));
    }
    let agent = marketing_agent::Entity::find()
        .filter(marketing_agent::Column::AgentCode.eq(normalized))
        .filter(marketing_agent::Column::Status.eq("ACTIVE"))
        .one(db)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or_else(|| AppError::BadRequest("Invalid marketing agent code".to_string()))?;
    let count = member_count(db, agent.id).await;
    Ok(to_response(agent, count))
}

/// Links a newly registered user to the marketing agent whose code they entered.
/// The code is optional; invalid codes fail registration so bad attribution is not silent.
pub async fn link_registration_agent(
    db: &DatabaseConnection,
    code: Option<&str>,
    user_id: i64,
    phone: Option<&str>,
) -> Result<Option<String>, AppError> {
    let Some(code) = code.map(str::trim).filter(|c| !c.is_empty()) else {
        return Ok(None);
    };
    let code = code.to_uppercase();
    let agent = marketing_agent::Entity::find()
        .filter(marketing_agent::Column::AgentCode.eq(code.clone()))
        .filter(marketing_agent::Column::Status.eq("ACTIVE"))
        .one(db)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or_else(|| AppError::BadRequest("Invalid marketing agent code".to_string()))?;

    let existing = marketing_agent_member::Entity::find()
        .filter(marketing_agent_member::Column::UserId.eq(user_id))
        .one(db)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if existing.is_some() {
        return Ok(Some(agent.agent_code));
    }

    let now = chrono::Utc::now().into();
    let member = marketing_agent_member::ActiveModel {
        agent_id: Set(agent.id),
        user_id: Set(user_id),
        phone_number: Set(phone.map(|p| p.trim().to_string()).filter(|p| !p.is_empty())),
        created_at: Set(now),
        ..Default::default()
    };
    member
        .insert(db)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(Some(agent.agent_code))
}

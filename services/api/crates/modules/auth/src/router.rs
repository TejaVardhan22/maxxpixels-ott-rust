use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::{
    handlers::{
        activate_tv_code_handler, change_password_handler, device_token_handler,
        generate_tv_code_handler, get_profile_handler, login_handler, logout_handler,
        poll_tv_code_handler, refresh_handler, register_handler, send_otp_handler,
        verify_otp_handler,
    },
    service::AuthService,
};

pub fn auth_routes(auth_service: Arc<AuthService>) -> Router {
    Router::new()
        .route("/login", post(login_handler))
        .route("/register", post(register_handler))
        .route("/signup", post(register_handler))
        .route("/refresh", post(refresh_handler))
        .route("/refresh-token", post(refresh_handler))
        .route("/logout", post(logout_handler))
        .route("/me", get(get_profile_handler))
        .route("/profile", get(get_profile_handler))
        .route("/change-password", post(change_password_handler))
        .route("/password", post(change_password_handler))
        .route("/send-otp", post(send_otp_handler))
        .route("/resend-otp", post(send_otp_handler))
        .route("/otp/send", post(send_otp_handler))
        .route("/verify-otp", post(verify_otp_handler))
        .route("/otp/verify", post(verify_otp_handler))
        .route("/firebase-verify", post(verify_otp_handler))
        .route("/device-token", post(device_token_handler))
        .route("/fcm-token", post(device_token_handler))
        .route("/tv/code", post(generate_tv_code_handler))
        .route("/tv/poll/:code", get(poll_tv_code_handler))
        .route("/tv/activate", post(activate_tv_code_handler))
        .route("/tv-login", post(activate_tv_code_handler))
        .with_state(auth_service)
}


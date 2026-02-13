package com.myblog.android.feature.auth.model

data class LoginRequest(
    val email: String,
    val password: String,
)

data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
)

data class UserSession(
    val userId: String,
    val email: String,
    val displayName: String,
)

sealed interface AuthState {
    data object LoggedOut : AuthState
    data object Restoring : AuthState
    data class LoggedIn(val session: UserSession) : AuthState
    data class Expired(val reason: String) : AuthState
}

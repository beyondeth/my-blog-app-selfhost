package com.myblog.android.feature.auth.model

sealed interface AuthEvent {
    data object StartRestore : AuthEvent
    data class LoginSucceeded(val session: UserSession) : AuthEvent
    data class RestoreSucceeded(val session: UserSession) : AuthEvent
    data class SessionExpired(val reason: String) : AuthEvent
    data object LogoutSucceeded : AuthEvent
}

object AuthStateMachine {
    fun reduce(event: AuthEvent): AuthState {
        return when (event) {
            AuthEvent.StartRestore -> AuthState.Restoring
            is AuthEvent.LoginSucceeded -> AuthState.LoggedIn(event.session)
            is AuthEvent.RestoreSucceeded -> AuthState.LoggedIn(event.session)
            is AuthEvent.SessionExpired -> AuthState.Expired(event.reason)
            AuthEvent.LogoutSucceeded -> AuthState.LoggedOut
        }
    }
}

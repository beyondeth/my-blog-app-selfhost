package com.myblog.android.feature.auth

import com.myblog.android.core.auth.TokenStore
import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.auth.model.AuthEvent
import com.myblog.android.feature.auth.model.AuthState
import com.myblog.android.feature.auth.model.AuthStateMachine
import com.myblog.android.feature.auth.model.LoginRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AuthSessionManager(
    private val authRepository: AuthRepository,
    private val tokenStore: TokenStore,
) {
    private val mutableState = MutableStateFlow<AuthState>(AuthState.LoggedOut)
    val state: StateFlow<AuthState> = mutableState.asStateFlow()

    suspend fun startRestore() {
        mutableState.value = AuthStateMachine.reduce(AuthEvent.StartRestore)

        val sessionResult = authRepository.me()
        mutableState.value = when (sessionResult) {
            is ApiResult.Success -> AuthStateMachine.reduce(AuthEvent.RestoreSucceeded(sessionResult.data))
            is ApiResult.Failure -> AuthStateMachine.reduce(AuthEvent.SessionExpired(sessionResult.message))
        }
    }

    suspend fun login(request: LoginRequest) {
        val loginResult = authRepository.login(request)
        if (loginResult is ApiResult.Failure) {
            mutableState.value = AuthStateMachine.reduce(AuthEvent.SessionExpired(loginResult.message))
            return
        }

        val tokens = (loginResult as ApiResult.Success).data
        tokenStore.save(tokens.accessToken, tokens.refreshToken)

        val sessionResult = authRepository.me()
        mutableState.value = when (sessionResult) {
            is ApiResult.Success -> AuthStateMachine.reduce(AuthEvent.LoginSucceeded(sessionResult.data))
            is ApiResult.Failure -> AuthStateMachine.reduce(AuthEvent.SessionExpired(sessionResult.message))
        }
    }

    suspend fun logout() {
        authRepository.logout()
        tokenStore.clear()
        mutableState.value = AuthStateMachine.reduce(AuthEvent.LogoutSucceeded)
    }
}

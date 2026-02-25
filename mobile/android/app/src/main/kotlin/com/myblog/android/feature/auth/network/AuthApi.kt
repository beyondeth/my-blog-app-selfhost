package com.myblog.android.feature.auth.network

import com.myblog.android.core.network.ApiResult

interface AuthApi {
    suspend fun login(request: LoginRequestDto): ApiResult<LoginResponseDto>
    suspend fun refresh(request: RefreshRequestDto): ApiResult<RefreshResponseDto>
    suspend fun oauthExchange(request: OAuthExchangeRequestDto): ApiResult<LoginResponseDto>
    suspend fun me(): ApiResult<MeResponseDto>
    suspend fun logout(): ApiResult<Unit>
}

data class LoginRequestDto(
    val email: String,
    val password: String,
)

data class RefreshRequestDto(
    val refreshToken: String,
)

data class OAuthExchangeRequestDto(
    val code: String,
    val redirectUri: String,
    val provider: String? = null,
)

data class LoginResponseDto(
    val accessToken: String,
    val refreshToken: String,
    val user: AuthUserDto,
)

data class RefreshResponseDto(
    val accessToken: String,
    val refreshToken: String,
)

data class MeResponseDto(
    val id: String,
    val username: String,
    val email: String,
    val profileImage: String?,
)

data class AuthUserDto(
    val id: String,
    val username: String,
    val email: String,
    val profileImage: String?,
)

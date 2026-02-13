package com.myblog.android.feature.auth.network

import com.myblog.android.core.network.ApiResult

interface AuthApi {
    suspend fun login(request: LoginRequestDto): ApiResult<LoginResponseDto>
    suspend fun refresh(request: RefreshRequestDto): ApiResult<RefreshResponseDto>
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
)

data class AuthUserDto(
    val id: String,
    val username: String,
    val email: String,
)

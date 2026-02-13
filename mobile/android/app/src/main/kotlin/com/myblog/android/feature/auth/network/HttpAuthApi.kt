package com.myblog.android.feature.auth.network

import com.myblog.android.core.network.ApiResult
import com.myblog.android.core.network.HttpRequest
import com.myblog.android.core.network.HttpResponse
import com.myblog.android.core.network.HttpTransport

class HttpAuthApi(
    private val transport: HttpTransport,
    baseUrl: String,
    private val accessTokenProvider: suspend () -> String? = { null },
) : AuthApi {
    private val normalizedBaseUrl = baseUrl
        .trimEnd('/')
        .let { candidate -> if (candidate.endsWith("/api/v1")) candidate else "$candidate/api/v1" }

    override suspend fun login(request: LoginRequestDto): ApiResult<LoginResponseDto> {
        val body = """{"email":"${escapeJson(request.email)}","password":"${escapeJson(request.password)}"}"""
        val httpRequest = HttpRequest(
            method = "POST",
            url = endpoint("/mobile/auth/login"),
            headers = jsonHeaders(),
            body = body,
        )

        return decodeResponse(transport.execute(httpRequest)) { responseBody ->
            val accessToken = requireJsonString(responseBody, "accessToken")
            val refreshToken = requireJsonString(responseBody, "refreshToken")
            val userObject = requireJsonObject(responseBody, "user")
            LoginResponseDto(
                accessToken = accessToken,
                refreshToken = refreshToken,
                user = AuthUserDto(
                    id = requireJsonString(userObject, "id"),
                    username = requireJsonString(userObject, "username"),
                    email = requireJsonString(userObject, "email"),
                ),
            )
        }
    }

    override suspend fun refresh(request: RefreshRequestDto): ApiResult<RefreshResponseDto> {
        val body = """{"refreshToken":"${escapeJson(request.refreshToken)}"}"""
        val httpRequest = HttpRequest(
            method = "POST",
            url = endpoint("/mobile/auth/refresh"),
            headers = jsonHeaders(),
            body = body,
        )

        return decodeResponse(transport.execute(httpRequest)) { responseBody ->
            RefreshResponseDto(
                accessToken = requireJsonString(responseBody, "accessToken"),
                refreshToken = requireJsonString(responseBody, "refreshToken"),
            )
        }
    }

    override suspend fun me(): ApiResult<MeResponseDto> {
        val httpRequest = HttpRequest(
            method = "GET",
            url = endpoint("/mobile/auth/me"),
            headers = authHeaders(),
        )

        return decodeResponse(transport.execute(httpRequest)) { responseBody ->
            MeResponseDto(
                id = requireJsonString(responseBody, "id"),
                username = requireJsonString(responseBody, "username"),
                email = requireJsonString(responseBody, "email"),
            )
        }
    }

    override suspend fun logout(): ApiResult<Unit> {
        val httpRequest = HttpRequest(
            method = "POST",
            url = endpoint("/mobile/auth/logout"),
            headers = authHeaders(),
        )

        return when (val response = transport.execute(httpRequest)) {
            is ApiResult.Success -> {
                if (response.data.statusCode in 200..299) {
                    ApiResult.Success(Unit)
                } else {
                    ApiResult.Failure(
                        code = response.data.statusCode,
                        message = extractFailureMessage(response.data),
                    )
                }
            }

            is ApiResult.Failure -> response
        }
    }

    private fun endpoint(path: String): String = normalizedBaseUrl + path

    private fun jsonHeaders(): Map<String, String> {
        return mapOf(
            "Content-Type" to "application/json",
            "Accept" to "application/json",
        )
    }

    private suspend fun authHeaders(): Map<String, String> {
        val token = accessTokenProvider()
        return if (token.isNullOrBlank()) {
            jsonHeaders()
        } else {
            jsonHeaders() + ("Authorization" to "Bearer $token")
        }
    }

    private fun <T> decodeResponse(
        result: ApiResult<HttpResponse>,
        decode: (String) -> T,
    ): ApiResult<T> {
        return when (result) {
            is ApiResult.Failure -> result
            is ApiResult.Success -> {
                val response = result.data
                if (response.statusCode !in 200..299) {
                    ApiResult.Failure(
                        code = response.statusCode,
                        message = extractFailureMessage(response),
                    )
                } else {
                    runCatching { decode(response.body) }
                        .fold(
                            onSuccess = { payload -> ApiResult.Success(payload) },
                            onFailure = { throwable ->
                                ApiResult.Failure(
                                    code = response.statusCode,
                                    message = throwable.message ?: "response decoding failed",
                                )
                            },
                        )
                }
            }
        }
    }

    private fun extractFailureMessage(response: HttpResponse): String {
        val fallback = if (response.body.isBlank()) "request failed" else response.body
        val body = response.body.takeIf { it.isNotBlank() } ?: return fallback
        return jsonString(body, "message")
            ?: jsonString(body, "error")
            ?: fallback
    }

    private fun requireJsonString(body: String, key: String): String {
        return jsonString(body, key)
            ?: throw IllegalStateException("missing '$key' in response body")
    }

    private fun requireJsonObject(body: String, key: String): String {
        return jsonObject(body, key)
            ?: throw IllegalStateException("missing '$key' object in response body")
    }

    private fun jsonString(body: String, key: String): String? {
        val pattern = Regex("\"$key\"\\s*:\\s*\"([^\"]*)\"")
        return pattern.find(body)?.groupValues?.get(1)
    }

    private fun jsonObject(body: String, key: String): String? {
        val startMatch = Regex("\"$key\"\\s*:\\s*\\{").find(body) ?: return null
        var index = startMatch.range.last + 1
        var depth = 1
        while (index < body.length && depth > 0) {
            val current = body[index]
            if (current == '{') depth += 1
            if (current == '}') depth -= 1
            index += 1
        }
        if (depth != 0) return null
        return body.substring(startMatch.range.last + 1, index)
    }

    private fun escapeJson(value: String): String {
        return value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
    }
}

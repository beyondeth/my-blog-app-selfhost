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
    private val backendRoot = normalizedBaseUrl.removeSuffix("/api/v1")
    private val cdnRoot = "https://cdn.codebase.blog"

    override suspend fun login(request: LoginRequestDto): ApiResult<LoginResponseDto> {
        val body = """{"email":"${escapeJson(request.email)}","password":"${escapeJson(request.password)}"}"""
        val httpRequest = HttpRequest(
            method = "POST",
            url = endpoint("/mobile/auth/login"),
            headers = jsonHeaders(),
            body = body,
        )

        return decodeResponse(transport.execute(httpRequest)) { response ->
            val responseBody = response.body
            val accessToken = findJsonValue(responseBody, "accessToken", "access_token")
                ?: extractTokenFromSetCookie(response.headers, "access_token")
            val refreshToken = findJsonValue(responseBody, "refreshToken", "refresh_token")
                ?: extractTokenFromSetCookie(response.headers, "refresh_token")

            if (accessToken.isNullOrBlank() || refreshToken.isNullOrBlank()) {
                val extractedHeaders = response.headers.keys.joinToString(", ")
                throw IllegalStateException(
                    "login failed: missing accessToken or refreshToken in response body/headers (keys in body: accessToken/access_token, refreshToken/refresh_token; response headers=${extractedHeaders.ifBlank { "none" }})",
                )
            }
            val userObject = requireUserObject(responseBody)
            LoginResponseDto(
                accessToken = accessToken,
                refreshToken = refreshToken,
                user = AuthUserDto(
                    id = requireJsonString(userObject, "id"),
                    username = requireJsonString(userObject, "username"),
                    email = requireJsonString(userObject, "email"),
                    profileImage = resolveMediaUrl(
                        firstJsonString(
                            userObject,
                            "profileImage",
                            "profileImageUrl",
                            "avatarUrl",
                        ),
                    ),
                ),
            )
        }
    }

    override suspend fun refresh(request: RefreshRequestDto): ApiResult<RefreshResponseDto> {
        val body = """{"refreshToken":"${escapeJson(request.refreshToken)}"}"""
        val refreshToken = request.refreshToken
        val httpRequest = HttpRequest(
            method = "POST",
            url = endpoint("/mobile/auth/refresh"),
            headers = if (refreshToken.isNotBlank()) {
                jsonHeaders() + mapOf("Cookie" to "refresh_token=${escapeJson(refreshToken)}")
            } else {
                jsonHeaders()
            },
            body = body,
        )

        return decodeResponse(transport.execute(httpRequest)) { response ->
            val responseBody = response.body
            val accessToken = findJsonValue(responseBody, "accessToken", "access_token")
                ?: extractTokenFromSetCookie(response.headers, "access_token")
            val refreshTokenValue = findJsonValue(responseBody, "refreshToken", "refresh_token")
                ?: extractTokenFromSetCookie(response.headers, "refresh_token")
                ?: refreshToken

            if (accessToken.isNullOrBlank() || refreshTokenValue.isNullOrBlank()) {
                throw IllegalStateException("refresh response is missing token data")
            }

            RefreshResponseDto(
                accessToken = accessToken,
                refreshToken = refreshTokenValue,
            )
        }
    }

    override suspend fun me(): ApiResult<MeResponseDto> {
        val httpRequest = HttpRequest(
            method = "GET",
            url = endpoint("/mobile/auth/me"),
            headers = authHeaders(),
        )

        return decodeResponse(transport.execute(httpRequest)) { response ->
            val responseBody = response.body
            MeResponseDto(
                id = requireJsonString(responseBody, "id"),
                username = requireJsonString(responseBody, "username"),
                email = requireJsonString(responseBody, "email"),
                profileImage = resolveMediaUrl(
                    firstJsonString(
                        responseBody,
                        "profileImage",
                        "profileImageUrl",
                        "avatarUrl",
                    ),
                ),
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
        decode: (HttpResponse) -> T,
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
                    runCatching { decode(response) }
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

    private fun extractTokenFromSetCookie(
        headers: Map<String, List<String>>,
        tokenName: String,
    ): String? {
        val cookieHeader = headers
            .filterKeys { key -> key.equals("set-cookie", ignoreCase = true) }
            .values
            .flatten()

        cookieHeader.forEach { header ->
            val marker = "$tokenName="
            val markerStart = header.indexOf(marker)
            if (markerStart >= 0) {
                val tokenStart = markerStart + marker.length
                val tokenEnd = header.indexOf(";", startIndex = tokenStart).let { index ->
                    if (index >= 0) index else header.length
                }
                return header.substring(tokenStart, tokenEnd)
                    .trim()
                    .trim('"')
            }
        }
        return null
    }

    private fun findJsonValue(
        body: String,
        vararg keys: String,
        depth: Int = 0,
    ): String? {
        for (key in keys) {
            jsonString(body, key)?.let { value ->
                if (value.isNotBlank()) return value
            }
        }

        if (depth >= 5) return null

        val nestedWrappers = listOf(
            "data",
            "result",
            "payload",
            "response",
            "auth",
            "session",
            "tokens",
            "token",
        )
        for (wrapper in nestedWrappers) {
            val nestedBody = jsonObject(body, wrapper) ?: continue
            val nested = findJsonValue(nestedBody, *keys, depth = depth + 1)
            if (nested != null) return nested
        }

        return null
    }

    private fun requireJsonString(body: String, key: String): String {
        return jsonString(body, key)
            ?: throw IllegalStateException("missing '$key' in response body")
    }

    private fun firstJsonString(body: String, vararg keys: String): String? {
        return findJsonValue(body, *keys)
    }

    private fun requireUserObject(body: String): String {
        val userObject = findJsonObject(body, "user") ?: findJsonObject(body, "profile")
        if (userObject != null) {
            return userObject
        }
        throw IllegalStateException("missing 'user' object in response body")
    }

    private fun findJsonObject(body: String, key: String, depth: Int = 0): String? {
        if (depth >= 6) return null
        jsonObject(body, key)?.let { return it }

        val nestedWrappers = listOf(
            "data",
            "result",
            "payload",
            "response",
            "auth",
            "session",
            "user",
            "profile",
        )
        for (wrapper in nestedWrappers) {
            val nestedBody = jsonObject(body, wrapper) ?: continue
            findJsonObject(nestedBody, key, depth + 1)?.let { return it }
        }
        return null
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

    private fun resolveMediaUrl(raw: String?): String? {
        val value = raw?.trim().orEmpty()
        if (value.isBlank()) return null
        if (value.startsWith("http://") || value.startsWith("https://")) return value

        val path = value.removePrefix("/")
        return when {
            path.startsWith("uploads/") -> "$cdnRoot/$path"
            path.startsWith("character/") -> "$cdnRoot/$path"
            path.startsWith("v2/") -> "$cdnRoot/$path"
            value.startsWith("/api/v1/") -> "$backendRoot$value"
            value.startsWith("/files/") -> "$backendRoot$value"
            else -> "$cdnRoot/$path"
        }
    }
}

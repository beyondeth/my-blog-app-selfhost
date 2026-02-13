package com.myblog.android.feature.settings.network

import com.myblog.android.core.network.ApiResult
import com.myblog.android.core.network.AuthenticatedRequestExecutor
import com.myblog.android.core.network.HttpRequest
import com.myblog.android.core.network.HttpResponse
import com.myblog.android.core.network.HttpTransport
import com.myblog.android.feature.settings.SettingsRepository
import com.myblog.android.feature.settings.model.AppThemePreference
import com.myblog.android.feature.settings.model.NotificationPreferences
import com.myblog.android.feature.settings.model.PrivacyPreferences
import com.myblog.android.feature.settings.model.SettingsSnapshot

class HttpSettingsRepository(
    private val transport: HttpTransport,
    private val requestExecutor: AuthenticatedRequestExecutor,
    baseUrl: String,
) : SettingsRepository {
    private val normalizedBaseUrl = baseUrl
        .trimEnd('/')
        .let { candidate -> if (candidate.endsWith("/api/v1")) candidate else "$candidate/api/v1" }

    override suspend fun getSettings(): ApiResult<SettingsSnapshot> {
        return requestExecutor.execute { accessToken ->
            decodeSettingsResponse(
                transport.execute(
                    HttpRequest(
                        method = "GET",
                        url = endpoint("/mobile/settings"),
                        headers = authHeaders(accessToken),
                    ),
                ),
            )
        }
    }

    override suspend fun updateThemePreference(themePreference: AppThemePreference): ApiResult<SettingsSnapshot> {
        val body = """{"themePreference":"${themePreference.name}"}"""
        return executePatch(path = "/mobile/settings/theme", body = body)
    }

    override suspend fun updateNotificationPreferences(preferences: NotificationPreferences): ApiResult<SettingsSnapshot> {
        val body = """
            {
              "pushEnabled": ${preferences.pushEnabled},
              "marketingEnabled": ${preferences.marketingEnabled},
              "communityReplyEnabled": ${preferences.communityReplyEnabled}
            }
        """.trimIndent()
        return executePatch(path = "/mobile/settings/notifications", body = body)
    }

    override suspend fun updatePrivacyPreferences(preferences: PrivacyPreferences): ApiResult<SettingsSnapshot> {
        val body = """
            {
              "profileVisible": ${preferences.profileVisible},
              "activityVisible": ${preferences.activityVisible}
            }
        """.trimIndent()
        return executePatch(path = "/mobile/settings/privacy", body = body)
    }

    private suspend fun executePatch(path: String, body: String): ApiResult<SettingsSnapshot> {
        return requestExecutor.execute { accessToken ->
            decodeSettingsResponse(
                transport.execute(
                    HttpRequest(
                        method = "PATCH",
                        url = endpoint(path),
                        headers = authHeaders(accessToken) + ("Content-Type" to "application/json"),
                        body = body,
                    ),
                ),
            )
        }
    }

    private fun endpoint(path: String): String = normalizedBaseUrl + path

    private fun authHeaders(accessToken: String?): Map<String, String> {
        val base = mapOf("Accept" to "application/json")
        return if (accessToken.isNullOrBlank()) {
            base
        } else {
            base + ("Authorization" to "Bearer $accessToken")
        }
    }

    private fun decodeSettingsResponse(response: ApiResult<HttpResponse>): ApiResult<SettingsSnapshot> {
        return when (response) {
            is ApiResult.Failure -> response
            is ApiResult.Success -> {
                if (response.data.statusCode !in 200..299) {
                    ApiResult.Failure(
                        code = response.data.statusCode,
                        message = extractFailureMessage(response.data),
                    )
                } else {
                    runCatching { parseSnapshot(response.data.body) }
                        .fold(
                            onSuccess = { ApiResult.Success(it) },
                            onFailure = { throwable ->
                                ApiResult.Failure(
                                    code = response.data.statusCode,
                                    message = throwable.message ?: "settings response decoding failed",
                                )
                            },
                        )
                }
            }
        }
    }

    private fun parseSnapshot(body: String): SettingsSnapshot {
        val notificationsObject = requireJsonObject(body, "notifications")
        val privacyObject = requireJsonObject(body, "privacy")
        return SettingsSnapshot(
            themePreference = parseThemePreference(requireJsonString(body, "themePreference")),
            notifications = NotificationPreferences(
                pushEnabled = requireJsonBoolean(notificationsObject, "pushEnabled"),
                marketingEnabled = requireJsonBoolean(notificationsObject, "marketingEnabled"),
                communityReplyEnabled = requireJsonBoolean(notificationsObject, "communityReplyEnabled"),
            ),
            privacy = PrivacyPreferences(
                profileVisible = requireJsonBoolean(privacyObject, "profileVisible"),
                activityVisible = requireJsonBoolean(privacyObject, "activityVisible"),
            ),
        )
    }

    private fun parseThemePreference(value: String): AppThemePreference {
        return runCatching { AppThemePreference.valueOf(value.uppercase()) }
            .getOrElse { throw IllegalStateException("invalid theme preference: $value") }
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

    private fun requireJsonBoolean(body: String, key: String): Boolean {
        return jsonBoolean(body, key)
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

    private fun jsonBoolean(body: String, key: String): Boolean? {
        val pattern = Regex("\"$key\"\\s*:\\s*(true|false)")
        return pattern.find(body)?.groupValues?.get(1)?.toBoolean()
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
}

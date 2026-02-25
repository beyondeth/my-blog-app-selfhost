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
                        url = endpoint("/users/profile"),
                        headers = authHeaders(accessToken),
                    ),
                ),
            )
        }
    }

    override suspend fun updateThemePreference(themePreference: AppThemePreference): ApiResult<SettingsSnapshot> {
        return when (val current = getSettings()) {
            is ApiResult.Success -> ApiResult.Success(current.data.copy(themePreference = themePreference))
            is ApiResult.Failure -> current
        }
    }

    override suspend fun updateNotificationPreferences(preferences: NotificationPreferences): ApiResult<SettingsSnapshot> {
        val body = """
            {
              "marketingOptIn": ${preferences.marketingEnabled},
              "newsletterOptIn": ${preferences.pushEnabled}
            }
        """.trimIndent()
        return executePatch(path = "/users/marketing-preferences", body = body)
    }

    override suspend fun updatePrivacyPreferences(preferences: PrivacyPreferences): ApiResult<SettingsSnapshot> {
        return when (val current = getSettings()) {
            is ApiResult.Success -> ApiResult.Success(current.data.copy(privacy = preferences))
            is ApiResult.Failure -> current
        }
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
        val marketingOptIn = jsonBoolean(body, "marketingOptIn") ?: false
        val newsletterOptIn = jsonBoolean(body, "newsletterOptIn") ?: false
        return SettingsSnapshot(
            themePreference = parseThemePreference(jsonString(body, "themePreference") ?: "DARK"),
            notifications = NotificationPreferences(
                pushEnabled = newsletterOptIn,
                marketingEnabled = marketingOptIn,
                communityReplyEnabled = marketingOptIn,
            ),
            privacy = PrivacyPreferences(
                profileVisible = true,
                activityVisible = true,
            ),
        )
    }

    private fun parseThemePreference(value: String?): AppThemePreference {
        if (value == null) {
            return AppThemePreference.DARK
        }
        return runCatching { AppThemePreference.valueOf(value.uppercase()) }
            .getOrElse { AppThemePreference.DARK }
    }

    private fun extractFailureMessage(response: HttpResponse): String {
        val fallback = if (response.body.isBlank()) "request failed" else response.body
        val body = response.body.takeIf { it.isNotBlank() } ?: return fallback
        return jsonString(body, "message")
            ?: jsonString(body, "error")
            ?: fallback
    }

    private fun jsonString(body: String, key: String): String? {
        val pattern = Regex("\"$key\"\\s*:\\s*\"([^\"]*)\"")
        return pattern.find(body)?.groupValues?.get(1)
    }

    private fun jsonBoolean(body: String, key: String): Boolean? {
        val pattern = Regex("\"$key\"\\s*:\\s*(true|false)")
        return pattern.find(body)?.groupValues?.get(1)?.toBoolean()
    }
}

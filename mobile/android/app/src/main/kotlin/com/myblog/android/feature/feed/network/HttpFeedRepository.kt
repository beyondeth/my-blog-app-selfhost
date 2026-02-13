package com.myblog.android.feature.feed.network

import com.myblog.android.core.network.ApiResult
import com.myblog.android.core.network.AuthenticatedRequestExecutor
import com.myblog.android.core.network.HttpRequest
import com.myblog.android.core.network.HttpResponse
import com.myblog.android.core.network.HttpTransport
import com.myblog.android.feature.feed.FeedRepository
import com.myblog.android.feature.feed.model.FeedItem
import com.myblog.android.feature.feed.model.FeedPage
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

class HttpFeedRepository(
    private val transport: HttpTransport,
    private val requestExecutor: AuthenticatedRequestExecutor,
    baseUrl: String,
) : FeedRepository {
    private val normalizedBaseUrl = baseUrl
        .trimEnd('/')
        .let { candidate -> if (candidate.endsWith("/api/v1")) candidate else "$candidate/api/v1" }

    override suspend fun getFeed(cursor: String?): ApiResult<FeedPage> {
        return requestExecutor.execute { accessToken ->
            val response = transport.execute(
                HttpRequest(
                    method = "GET",
                    url = feedEndpoint(cursor),
                    headers = feedHeaders(accessToken),
                ),
            )
            decodeFeedResponse(response)
        }
    }

    override suspend fun refreshFeed(): ApiResult<FeedPage> = getFeed(cursor = null)

    private fun feedEndpoint(cursor: String?): String {
        val base = "$normalizedBaseUrl/mobile/feed"
        val value = cursor?.takeIf { it.isNotBlank() } ?: return base
        val encoded = URLEncoder.encode(value, StandardCharsets.UTF_8)
        return "$base?cursor=$encoded"
    }

    private fun feedHeaders(accessToken: String?): Map<String, String> {
        val base = mapOf("Accept" to "application/json")
        return if (accessToken.isNullOrBlank()) base else base + ("Authorization" to "Bearer $accessToken")
    }

    private fun decodeFeedResponse(response: ApiResult<HttpResponse>): ApiResult<FeedPage> {
        return when (response) {
            is ApiResult.Failure -> response
            is ApiResult.Success -> {
                if (response.data.statusCode !in 200..299) {
                    ApiResult.Failure(
                        code = response.data.statusCode,
                        message = extractFailureMessage(response.data),
                    )
                } else {
                    runCatching { parseFeedPage(response.data.body) }
                        .fold(
                            onSuccess = { ApiResult.Success(it) },
                            onFailure = { throwable ->
                                ApiResult.Failure(
                                    code = response.data.statusCode,
                                    message = throwable.message ?: "feed response decoding failed",
                                )
                            },
                        )
                }
            }
        }
    }

    private fun parseFeedPage(body: String): FeedPage {
        val itemsArray = requireJsonArray(body, "items")
        val items = splitObjects(itemsArray).map { itemBody ->
            val authorObject = requireJsonObject(itemBody, "author")
            FeedItem(
                postId = requireJsonString(itemBody, "id"),
                title = requireJsonString(itemBody, "title"),
                excerpt = jsonString(itemBody, "excerpt").orEmpty(),
                authorName = requireJsonString(authorObject, "username"),
                liked = jsonBoolean(itemBody, "liked") ?: false,
                likeCount = jsonInt(itemBody, "likeCount") ?: 0,
            )
        }

        return FeedPage(
            items = items,
            nextCursor = jsonNullableString(body, "nextCursor"),
            hasMore = jsonBoolean(body, "hasMore") ?: false,
        )
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

    private fun requireJsonArray(body: String, key: String): String {
        return jsonArray(body, key)
            ?: throw IllegalStateException("missing '$key' array in response body")
    }

    private fun jsonString(body: String, key: String): String? {
        val pattern = Regex("\"$key\"\\s*:\\s*\"([^\"]*)\"")
        return pattern.find(body)?.groupValues?.get(1)
    }

    private fun jsonNullableString(body: String, key: String): String? {
        val nullPattern = Regex("\"$key\"\\s*:\\s*null")
        if (nullPattern.containsMatchIn(body)) {
            return null
        }
        return jsonString(body, key)
    }

    private fun jsonBoolean(body: String, key: String): Boolean? {
        val pattern = Regex("\"$key\"\\s*:\\s*(true|false)")
        return pattern.find(body)?.groupValues?.get(1)?.toBoolean()
    }

    private fun jsonInt(body: String, key: String): Int? {
        val pattern = Regex("\"$key\"\\s*:\\s*(-?\\d+)")
        return pattern.find(body)?.groupValues?.get(1)?.toIntOrNull()
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

    private fun jsonArray(body: String, key: String): String? {
        val startMatch = Regex("\"$key\"\\s*:\\s*\\[").find(body) ?: return null
        var index = startMatch.range.last + 1
        var depth = 1
        while (index < body.length && depth > 0) {
            val current = body[index]
            if (current == '[') depth += 1
            if (current == ']') depth -= 1
            index += 1
        }
        if (depth != 0) return null
        return body.substring(startMatch.range.last + 1, index - 1)
    }

    private fun splitObjects(arrayBody: String): List<String> {
        val objects = mutableListOf<String>()
        var objectStart = -1
        var depth = 0
        arrayBody.forEachIndexed { index, ch ->
            if (ch == '{') {
                if (depth == 0) {
                    objectStart = index
                }
                depth += 1
            } else if (ch == '}') {
                depth -= 1
                if (depth == 0 && objectStart >= 0) {
                    objects += arrayBody.substring(objectStart, index + 1)
                    objectStart = -1
                }
            }
        }
        return objects
    }
}

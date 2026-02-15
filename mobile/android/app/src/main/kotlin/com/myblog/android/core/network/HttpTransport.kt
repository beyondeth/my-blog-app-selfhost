package com.myblog.android.core.network

data class HttpRequest(
    val method: String,
    val url: String,
    val headers: Map<String, String> = emptyMap(),
    val body: String? = null,
    val bodyBytes: ByteArray? = null,
)

data class HttpResponse(
    val statusCode: Int,
    val body: String,
    val headers: Map<String, List<String>> = emptyMap(),
)

interface HttpTransport {
    suspend fun execute(request: HttpRequest): ApiResult<HttpResponse>
}

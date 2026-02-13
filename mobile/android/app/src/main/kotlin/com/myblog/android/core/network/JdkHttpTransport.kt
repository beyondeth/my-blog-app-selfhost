package com.myblog.android.core.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URI

class JdkHttpTransport(
    private val connectTimeoutMillis: Int = 15_000,
    private val readTimeoutMillis: Int = 15_000,
) : HttpTransport {
    override suspend fun execute(request: HttpRequest): ApiResult<HttpResponse> {
        return withContext(Dispatchers.IO) {
            runCatching {
                val connection = (URI(request.url).toURL().openConnection() as HttpURLConnection).apply {
                    requestMethod = request.method
                    connectTimeout = connectTimeoutMillis
                    readTimeout = readTimeoutMillis
                    request.headers.forEach { (name, value) ->
                        setRequestProperty(name, value)
                    }
                }

                request.body?.let { body ->
                    connection.doOutput = true
                    connection.outputStream.bufferedWriter(Charsets.UTF_8).use { writer ->
                        writer.write(body)
                    }
                }

                val statusCode = connection.responseCode
                val responseStream = if (statusCode >= 400) connection.errorStream else connection.inputStream
                val responseBody = responseStream
                    ?.bufferedReader(Charsets.UTF_8)
                    ?.use { reader -> reader.readText() }
                    .orEmpty()

                connection.disconnect()
                HttpResponse(statusCode = statusCode, body = responseBody)
            }.fold(
                onSuccess = { ApiResult.Success(it) },
                onFailure = { throwable ->
                    ApiResult.Failure(code = null, message = throwable.message ?: "network request failed")
                },
            )
        }
    }
}

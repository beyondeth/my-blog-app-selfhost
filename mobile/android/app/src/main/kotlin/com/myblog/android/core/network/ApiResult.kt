package com.myblog.android.core.network

sealed interface ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>
    data class Failure(val code: Int?, val message: String) : ApiResult<Nothing>
}

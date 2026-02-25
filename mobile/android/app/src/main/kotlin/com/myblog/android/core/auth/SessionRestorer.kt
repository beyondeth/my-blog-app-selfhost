package com.myblog.android.core.auth

import com.myblog.android.core.network.ApiResult
import com.myblog.android.feature.auth.model.UserSession

interface SessionRestorer {
    suspend fun restoreSession(): ApiResult<UserSession>
}

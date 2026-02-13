package com.myblog.android.feature.feed.time

import com.myblog.android.core.time.ClockProvider

class RelativeTimeFormatter(
    private val clockProvider: ClockProvider,
) {
    fun formatFromEpochSeconds(publishedAtEpochSeconds: Long): String {
        val now = clockProvider.nowEpochSeconds()
        val elapsed = (now - publishedAtEpochSeconds).coerceAtLeast(0L)

        return when {
            elapsed < 60L -> "just now"
            elapsed < 3600L -> "${elapsed / 60L}m ago"
            elapsed < 86400L -> "${elapsed / 3600L}h ago"
            elapsed < 604800L -> "${elapsed / 86400L}d ago"
            else -> "${elapsed / 604800L}w ago"
        }
    }
}

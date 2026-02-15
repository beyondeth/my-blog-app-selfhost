package com.myblog.android.feature.feed.time

import com.myblog.android.core.time.ClockProvider
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

class RelativeTimeFormatter(
    private val clockProvider: ClockProvider,
) {
    fun formatFromEpochSeconds(publishedAtEpochSeconds: Long): String {
        val now = clockProvider.nowEpochSeconds()
        val elapsed = now - publishedAtEpochSeconds

        if (elapsed < 0L) {
            return formatAbsoluteDate(publishedAtEpochSeconds)
        }

        return when {
            elapsed < 60L -> "방금 전"
            elapsed < 3600L -> "${elapsed / 60L}분 전"
            elapsed < 86400L -> "${elapsed / 3600L}시간 전"
            elapsed < 172800L -> "하루 전"
            elapsed < 259200L -> "이틀 전"
            elapsed < 604800L -> "${elapsed / 86400L}일 전"
            elapsed < 2_592_000L -> "${elapsed / 604800L}주 전"
            elapsed < 31_536_000L -> "${elapsed / 2_592_000L}개월 전"
            else -> "${elapsed / 31_536_000L}년 전"
        }
    }

    private fun formatAbsoluteDate(epochSeconds: Long): String {
        return runCatching {
            val localDate = Instant.ofEpochSecond(epochSeconds)
                .atZone(ZoneId.systemDefault())
                .toLocalDate()
            absoluteDateFormatter.format(localDate)
        }.getOrElse { "방금 전" }
    }

    companion object {
        private val absoluteDateFormatter: DateTimeFormatter =
            DateTimeFormatter.ofPattern("yyyy. M. d.", Locale.KOREAN)
    }
}

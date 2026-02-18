package com.myblog.android.feature.feed.time

import com.myblog.android.core.time.ClockProvider
import kotlin.test.Test
import kotlin.test.assertEquals

class RelativeTimeFormatterTest {
    @Test
    fun returnsJustNowAt59Seconds() {
        val formatter = RelativeTimeFormatter(FixedClockProvider(nowEpochSeconds = 1_000L))

        val result = formatter.formatFromEpochSeconds(publishedAtEpochSeconds = 941L)

        assertEquals("방금 전", result)
    }

    @Test
    fun returnsOneMinuteAt60Seconds() {
        val formatter = RelativeTimeFormatter(FixedClockProvider(nowEpochSeconds = 1_000L))

        val result = formatter.formatFromEpochSeconds(publishedAtEpochSeconds = 940L)

        assertEquals("1분 전", result)
    }

    @Test
    fun returnsOneMinuteAt61Seconds() {
        val formatter = RelativeTimeFormatter(FixedClockProvider(nowEpochSeconds = 1_000L))

        val result = formatter.formatFromEpochSeconds(publishedAtEpochSeconds = 939L)

        assertEquals("1분 전", result)
    }

    @Test
    fun clampsFutureTimestampToJustNow() {
        val formatter = RelativeTimeFormatter(FixedClockProvider(nowEpochSeconds = 1_000L))

        val result = formatter.formatFromEpochSeconds(publishedAtEpochSeconds = 1_120L)

        assertEquals("1970. 1. 1.", result)
    }
}

private class FixedClockProvider(
    private val nowEpochSeconds: Long,
) : ClockProvider {
    override fun nowEpochSeconds(): Long = nowEpochSeconds
}

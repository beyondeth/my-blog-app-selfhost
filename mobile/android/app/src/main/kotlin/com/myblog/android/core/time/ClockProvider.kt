package com.myblog.android.core.time

interface ClockProvider {
    fun nowEpochSeconds(): Long
}

object SystemClockProvider : ClockProvider {
    override fun nowEpochSeconds(): Long = System.currentTimeMillis() / 1000L
}

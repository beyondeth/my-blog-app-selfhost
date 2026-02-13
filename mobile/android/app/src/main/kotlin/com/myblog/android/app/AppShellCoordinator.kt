package com.myblog.android.app

import com.myblog.android.app.model.AppShellEvent
import com.myblog.android.app.model.AppShellState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AppShellCoordinator(
    initialState: AppShellState = AppShellState.Booting,
) {
    private val mutableState = MutableStateFlow(initialState)
    val state: StateFlow<AppShellState> = mutableState.asStateFlow()

    fun dispatch(event: AppShellEvent) {
        val current = mutableState.value
        mutableState.value = AppShellReducer.reduce(current, event)
    }
}

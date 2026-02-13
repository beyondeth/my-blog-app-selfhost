package com.myblog.android.core.navigation

sealed interface AppDestination {
    data object Auth : AppDestination
    data object Feed : AppDestination
    data object Community : AppDestination
    data object Profile : AppDestination
    data object Compose : AppDestination
}

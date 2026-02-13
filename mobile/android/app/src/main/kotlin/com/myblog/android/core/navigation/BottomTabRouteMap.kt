package com.myblog.android.core.navigation

data class BottomTabRoute(
    val key: String,
    val destination: AppDestination,
    val iconName: String,
    val title: String,
)

object BottomTabRouteMap {
    val tabs: List<BottomTabRoute> = listOf(
        BottomTabRoute(
            key = "feed",
            destination = AppDestination.Feed,
            iconName = "house",
            title = "Feed",
        ),
        BottomTabRoute(
            key = "community",
            destination = AppDestination.Community,
            iconName = "person.3",
            title = "Community",
        ),
        BottomTabRoute(
            key = "compose",
            destination = AppDestination.Compose,
            iconName = "plus.circle",
            title = "Write",
        ),
        BottomTabRoute(
            key = "profile",
            destination = AppDestination.Profile,
            iconName = "person.crop.circle",
            title = "Profile",
        ),
    )

    fun contains(destination: AppDestination): Boolean {
        return tabs.any { it.destination == destination }
    }
}

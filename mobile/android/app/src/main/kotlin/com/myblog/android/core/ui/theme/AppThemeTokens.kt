package com.myblog.android.core.ui.theme

data class AppColorPalette(
    val backgroundArgb: Long,
    val groupedBackgroundArgb: Long,
    val surfaceArgb: Long,
    val surfaceVariantArgb: Long,
    val outlineArgb: Long,
    val textPrimaryArgb: Long,
    val textBodyArgb: Long,
    val textSecondaryArgb: Long,
    val selectionFillArgb: Long,
    val selectionTextArgb: Long,
    val tabBarBackgroundArgb: Long,
    val disabledFillArgb: Long,
)

data class AppShapeTokens(
    val smallCornerDp: Int,
    val mediumCornerDp: Int,
    val largeCornerDp: Int,
    val tabShellCornerDp: Int,
    val avatarCornerDp: Int,
)

data class AppSpacingTokens(
    val xsDp: Int,
    val smDp: Int,
    val mdDp: Int,
    val lgDp: Int,
    val xlDp: Int,
    val xxlDp: Int,
)

enum class ThemeMode {
    LIGHT,
    DARK,
}

object AppThemeTokens {
    val lightColors = AppColorPalette(
        backgroundArgb = 0xFFF7F8FA,
        groupedBackgroundArgb = 0xFFEEF1F5,
        surfaceArgb = 0xFFFFFFFF,
        surfaceVariantArgb = 0xFFF4F6FA,
        outlineArgb = 0x1A0F172A,
        textPrimaryArgb = 0xFF111827,
        textBodyArgb = 0xFF1F2937,
        textSecondaryArgb = 0xFF64748B,
        selectionFillArgb = 0xFF111827,
        selectionTextArgb = 0xFFFFFFFF,
        tabBarBackgroundArgb = 0xFFFFFFFF,
        disabledFillArgb = 0xFFCBD5E1,
    )

    val darkColors = AppColorPalette(
        backgroundArgb = 0xFF0B0E14,
        groupedBackgroundArgb = 0xFF101521,
        surfaceArgb = 0xFF141A27,
        surfaceVariantArgb = 0xFF1A2233,
        outlineArgb = 0x26FFFFFF,
        textPrimaryArgb = 0xFFF8FAFF,
        textBodyArgb = 0xFFE5EAF5,
        textSecondaryArgb = 0xFF9AA6BC,
        selectionFillArgb = 0xFFF8FAFF,
        selectionTextArgb = 0xFF141A27,
        tabBarBackgroundArgb = 0xFF0F1626,
        disabledFillArgb = 0xFF475569,
    )

    val shapes = AppShapeTokens(
        smallCornerDp = 12,
        mediumCornerDp = 16,
        largeCornerDp = 20,
        tabShellCornerDp = 24,
        avatarCornerDp = 12,
    )

    val spacing = AppSpacingTokens(
        xsDp = 4,
        smDp = 8,
        mdDp = 12,
        lgDp = 16,
        xlDp = 20,
        xxlDp = 24,
    )

    fun colors(mode: ThemeMode): AppColorPalette {
        return when (mode) {
            ThemeMode.LIGHT -> lightColors
            ThemeMode.DARK -> darkColors
        }
    }
}

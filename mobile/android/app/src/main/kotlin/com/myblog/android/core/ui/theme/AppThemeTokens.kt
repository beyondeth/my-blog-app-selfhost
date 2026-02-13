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
        backgroundArgb = 0xFFFFFFFF,
        groupedBackgroundArgb = 0xFFF2F2F7,
        surfaceArgb = 0xFFFFFFFF,
        surfaceVariantArgb = 0x0D000000,
        outlineArgb = 0x24000000,
        textPrimaryArgb = 0xF5000000,
        textBodyArgb = 0xE6000000,
        textSecondaryArgb = 0x9E000000,
        selectionFillArgb = 0xFF000000,
        selectionTextArgb = 0xFFFFFFFF,
        tabBarBackgroundArgb = 0xFFFFFFFF,
        disabledFillArgb = 0x593C3C43,
    )

    val darkColors = AppColorPalette(
        backgroundArgb = 0xFF000000,
        groupedBackgroundArgb = 0xFF000000,
        surfaceArgb = 0x14FFFFFF,
        surfaceVariantArgb = 0x14FFFFFF,
        outlineArgb = 0x1AFFFFFF,
        textPrimaryArgb = 0xFFFFFFFF,
        textBodyArgb = 0xE6FFFFFF,
        textSecondaryArgb = 0xF2BDBDBD,
        selectionFillArgb = 0xFFFFFFFF,
        selectionTextArgb = 0xFF000000,
        tabBarBackgroundArgb = 0xFF121722,
        disabledFillArgb = 0x59EBEBF5,
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

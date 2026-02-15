package com.myblog.android

import android.os.Bundle
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.RadioGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import com.google.android.material.switchmaterial.SwitchMaterial
import com.myblog.android.feature.auth.AuthSessionManager
import com.myblog.android.feature.auth.model.AuthState
import com.myblog.android.core.ui.theme.AppThemePreferenceStore
import com.myblog.android.feature.settings.SettingsCoordinator
import com.myblog.android.feature.settings.model.AppThemePreference
import com.myblog.android.feature.settings.model.NotificationPreferences
import com.myblog.android.feature.settings.model.PrivacyPreferences
import com.myblog.android.feature.settings.model.SettingsState
import kotlinx.coroutines.launch

class SettingsActivity : AppCompatActivity() {
    private val authSessionManager: AuthSessionManager by lazy {
        AuthSessionManager(
            authRepository = AppRuntime.di.authRepository(),
            tokenStore = AppRuntime.di.tokenStore(),
        )
    }

    private val settingsCoordinator: SettingsCoordinator by lazy {
        SettingsCoordinator(settingsRepository = AppRuntime.di.settingsRepository())
    }

    private lateinit var openLoginButton: Button
    private lateinit var logoutButton: Button
    private lateinit var loadSettingsButton: Button
    private lateinit var settingsStatusText: TextView
    private lateinit var settingsProgress: ProgressBar
    private lateinit var pushEnabledSwitch: SwitchMaterial
    private lateinit var marketingEnabledSwitch: SwitchMaterial
    private lateinit var communityReplyEnabledSwitch: SwitchMaterial
    private lateinit var profileVisibleSwitch: SwitchMaterial
    private lateinit var activityVisibleSwitch: SwitchMaterial
    private lateinit var themeRadioGroup: RadioGroup
    private lateinit var themeSystemRadioButton: android.widget.RadioButton
    private lateinit var themeLightRadioButton: android.widget.RadioButton
    private lateinit var themeDarkRadioButton: android.widget.RadioButton

    private var isRestoringFromState = false

    private val loginLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            lifecycleScope.launch {
                showLoading(true)
                authSessionManager.startRestore()
                syncAuthState(authSessionManager.state.value)
                loadAndRenderSettings()
                showLoading(false)
            }
        }
    }

    private fun showLoading(isLoading: Boolean) {
        settingsProgress.isVisible = isLoading
        val editable = !isLoading
        openLoginButton.isEnabled = editable
        loadSettingsButton.isEnabled = editable
        logoutButton.isEnabled = editable
        pushEnabledSwitch.isEnabled = editable
        marketingEnabledSwitch.isEnabled = editable
        communityReplyEnabledSwitch.isEnabled = editable
        profileVisibleSwitch.isEnabled = editable
        activityVisibleSwitch.isEnabled = editable
        themeSystemRadioButton.isEnabled = editable
        themeLightRadioButton.isEnabled = editable
        themeDarkRadioButton.isEnabled = editable
    }

    private fun applyAuthLockedUI() {
        pushEnabledSwitch.isChecked = false
        marketingEnabledSwitch.isChecked = false
        communityReplyEnabledSwitch.isChecked = false
        profileVisibleSwitch.isChecked = false
        activityVisibleSwitch.isChecked = false

        pushEnabledSwitch.isEnabled = false
        marketingEnabledSwitch.isEnabled = false
        communityReplyEnabledSwitch.isEnabled = false
        profileVisibleSwitch.isEnabled = false
        activityVisibleSwitch.isEnabled = false
        logoutButton.isEnabled = false
        openLoginButton.isEnabled = true
        settingsStatusText.text = getString(R.string.settings_not_logged_in)
    }

    private fun applyAuthUnlockedUI() {
        pushEnabledSwitch.isEnabled = true
        marketingEnabledSwitch.isEnabled = true
        communityReplyEnabledSwitch.isEnabled = true
        profileVisibleSwitch.isEnabled = true
        activityVisibleSwitch.isEnabled = true
        logoutButton.isEnabled = true
        openLoginButton.isEnabled = false
    }

    private fun syncAuthState(state: AuthState) {
        when (state) {
            AuthState.LoggedOut,
            AuthState.Restoring,
            is AuthState.Expired -> applyAuthLockedUI()
            is AuthState.LoggedIn -> applyAuthUnlockedUI()
        }
    }

    private suspend fun syncNotificationPreferences(pushEnabled: Boolean, marketingEnabled: Boolean, communityReplyEnabled: Boolean) {
        showLoading(true)
        settingsCoordinator.updateNotifications(
            NotificationPreferences(
                pushEnabled = pushEnabled,
                marketingEnabled = marketingEnabled,
                communityReplyEnabled = communityReplyEnabled,
            ),
        )
        loadAndRenderSettings()
        showLoading(false)
        Toast.makeText(this, "Notification settings synced", Toast.LENGTH_SHORT).show()
    }

    private suspend fun syncPrivacyPreferences(profileVisible: Boolean, activityVisible: Boolean) {
        showLoading(true)
        settingsCoordinator.updatePrivacy(
            PrivacyPreferences(
                profileVisible = profileVisible,
                activityVisible = activityVisible,
            ),
        )
        loadAndRenderSettings()
        showLoading(false)
        Toast.makeText(this, "Privacy settings synced", Toast.LENGTH_SHORT).show()
    }

    private suspend fun syncThemePreference(themePreference: AppThemePreference) {
        showLoading(true)
        AppThemePreferenceStore.save(this, themePreference)
        AppThemePreferenceStore.apply(themePreference)
        syncThemePanel(themePreference)
        settingsCoordinator.updateTheme(themePreference)
        showLoading(false)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        openLoginButton = findViewById(R.id.openLoginButton)
        logoutButton = findViewById(R.id.logoutButton)
        loadSettingsButton = findViewById(R.id.loadSettingsButton)
        settingsStatusText = findViewById(R.id.settingsStatusText)
        settingsProgress = findViewById(R.id.settingsProgress)
        pushEnabledSwitch = findViewById(R.id.pushEnabledSwitch)
        marketingEnabledSwitch = findViewById(R.id.marketingEnabledSwitch)
        communityReplyEnabledSwitch = findViewById(R.id.communityReplyEnabledSwitch)
        profileVisibleSwitch = findViewById(R.id.profileVisibleSwitch)
        activityVisibleSwitch = findViewById(R.id.activityVisibleSwitch)
        themeRadioGroup = findViewById(R.id.themePreferenceRadioGroup)
        themeSystemRadioButton = findViewById(R.id.themeSystemRadioButton)
        themeLightRadioButton = findViewById(R.id.themeLightRadioButton)
        themeDarkRadioButton = findViewById(R.id.themeDarkRadioButton)
        syncThemePanel(AppThemePreferenceStore.read(this))

        themeRadioGroup.setOnCheckedChangeListener { _, checkedId ->
            if (isRestoringFromState) return@setOnCheckedChangeListener
            val selectedTheme = when (checkedId) {
                R.id.themeSystemRadioButton -> AppThemePreference.SYSTEM
                R.id.themeLightRadioButton -> AppThemePreference.LIGHT
                R.id.themeDarkRadioButton -> AppThemePreference.DARK
                else -> AppThemePreference.SYSTEM
            }
            lifecycleScope.launch {
                syncThemePreference(selectedTheme)
            }
        }

        openLoginButton.setOnClickListener {
            loginLauncher.launch(LoginActivity.intent(this))
        }

        logoutButton.setOnClickListener {
            lifecycleScope.launch {
                showLoading(true)
                authSessionManager.logout()
                showLoading(false)
                syncAuthState(AuthState.LoggedOut)
                settingsStatusText.text = getString(R.string.settings_not_logged_in)
                setResult(RESULT_OK)
                Toast.makeText(this@SettingsActivity, getString(R.string.logout_button), Toast.LENGTH_SHORT).show()
            }
        }

        loadSettingsButton.setOnClickListener {
            lifecycleScope.launch {
                loadAndRenderSettings()
            }
        }

        pushEnabledSwitch.setOnCheckedChangeListener { _, checked ->
            if (isRestoringFromState || pushEnabledSwitch.isEnabled.not()) return@setOnCheckedChangeListener
            lifecycleScope.launch {
                syncNotificationPreferences(
                    pushEnabled = checked,
                    marketingEnabled = marketingEnabledSwitch.isChecked,
                    communityReplyEnabled = communityReplyEnabledSwitch.isChecked,
                )
            }
        }

        marketingEnabledSwitch.setOnCheckedChangeListener { _, checked ->
            if (isRestoringFromState || marketingEnabledSwitch.isEnabled.not()) return@setOnCheckedChangeListener
            lifecycleScope.launch {
                syncNotificationPreferences(
                    pushEnabled = pushEnabledSwitch.isChecked,
                    marketingEnabled = checked,
                    communityReplyEnabled = communityReplyEnabledSwitch.isChecked,
                )
            }
        }

        communityReplyEnabledSwitch.setOnCheckedChangeListener { _, checked ->
            if (isRestoringFromState || communityReplyEnabledSwitch.isEnabled.not()) return@setOnCheckedChangeListener
            lifecycleScope.launch {
                syncNotificationPreferences(
                    pushEnabled = pushEnabledSwitch.isChecked,
                    marketingEnabled = marketingEnabledSwitch.isChecked,
                    communityReplyEnabled = checked,
                )
            }
        }

        profileVisibleSwitch.setOnCheckedChangeListener { _, checked ->
            if (isRestoringFromState || profileVisibleSwitch.isEnabled.not()) return@setOnCheckedChangeListener
            lifecycleScope.launch {
                syncPrivacyPreferences(checked, activityVisibleSwitch.isChecked)
            }
        }

        activityVisibleSwitch.setOnCheckedChangeListener { _, checked ->
            if (isRestoringFromState || activityVisibleSwitch.isEnabled.not()) return@setOnCheckedChangeListener
            lifecycleScope.launch {
                syncPrivacyPreferences(profileVisibleSwitch.isChecked, checked)
            }
        }

        lifecycleScope.launch {
            showLoading(true)
            authSessionManager.startRestore()
            syncAuthState(authSessionManager.state.value)
            loadAndRenderSettings()
            showLoading(false)
        }
    }

    private suspend fun loadAndRenderSettings() {
        showLoading(true)
        loadSettingsButton.isEnabled = false
        settingsStatusText.text = getString(R.string.settings_loading_in_progress, AppRuntime.BASE_URL)

        settingsCoordinator.load()

        when (val state = settingsCoordinator.state.value) {
            SettingsState.Loading -> {
                settingsStatusText.text = getString(R.string.settings_loading_in_progress, AppRuntime.BASE_URL)
            }

            is SettingsState.Error -> {
                settingsStatusText.text = getString(R.string.settings_loading_error, state.message)
            }

            is SettingsState.Ready -> {
                val snapshot = state.snapshot
                isRestoringFromState = true
                pushEnabledSwitch.isChecked = snapshot.notifications.pushEnabled
                marketingEnabledSwitch.isChecked = snapshot.notifications.marketingEnabled
                communityReplyEnabledSwitch.isChecked = snapshot.notifications.communityReplyEnabled
                profileVisibleSwitch.isChecked = snapshot.privacy.profileVisible
                activityVisibleSwitch.isChecked = snapshot.privacy.activityVisible
                syncThemePanel(snapshot.themePreference)
                isRestoringFromState = false

                settingsStatusText.text = buildString {
                    appendLine("Loaded from: ${AppRuntime.BASE_URL}/api/v1/users/profile")
                    appendLine("themePreference: ${snapshot.themePreference}")
                    appendLine("notifications.pushEnabled: ${snapshot.notifications.pushEnabled}")
                    appendLine("notifications.marketingEnabled: ${snapshot.notifications.marketingEnabled}")
                    append("privacy.activityVisible: ${snapshot.privacy.activityVisible}")
                }
            }
        }

        loadSettingsButton.isEnabled = true
        showLoading(false)
    }

    private fun syncThemePanel(themePreference: AppThemePreference) {
        isRestoringFromState = true
        AppThemePreferenceStore.apply(themePreference)
        when (themePreference) {
            AppThemePreference.SYSTEM -> themeSystemRadioButton.isChecked = true
            AppThemePreference.LIGHT -> themeLightRadioButton.isChecked = true
            AppThemePreference.DARK -> themeDarkRadioButton.isChecked = true
        }
        isRestoringFromState = false
    }
}

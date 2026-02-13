package com.myblog.android

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.myblog.android.feature.settings.SettingsCoordinator
import com.myblog.android.feature.settings.model.SettingsState
import kotlinx.coroutines.launch

class SettingsActivity : AppCompatActivity() {
    private val settingsCoordinator: SettingsCoordinator by lazy {
        SettingsCoordinator(settingsRepository = AppRuntime.di.settingsRepository())
    }

    private lateinit var openLoginButton: Button
    private lateinit var loadSettingsButton: Button
    private lateinit var settingsStatusText: TextView

    private val loginLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK) {
            val displayName = result.data
                ?.getStringExtra(LoginActivity.EXTRA_LOGIN_DISPLAY_NAME)
                .orEmpty()
            settingsStatusText.text = getString(R.string.settings_login_success, displayName)
            lifecycleScope.launch {
                loadAndRenderSettings()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        openLoginButton = findViewById(R.id.openLoginButton)
        loadSettingsButton = findViewById(R.id.loadSettingsButton)
        settingsStatusText = findViewById(R.id.settingsStatusText)
        settingsStatusText.text = getString(R.string.settings_loading_idle)

        openLoginButton.setOnClickListener {
            loginLauncher.launch(LoginActivity.intent(this))
        }

        loadSettingsButton.setOnClickListener {
            lifecycleScope.launch {
                loadAndRenderSettings()
            }
        }
    }

    private suspend fun loadAndRenderSettings() {
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
                settingsStatusText.text = buildString {
                    appendLine("Loaded from: ${AppRuntime.BASE_URL}/api/v1/mobile/settings")
                    appendLine("themePreference: ${snapshot.themePreference}")
                    appendLine("notifications.pushEnabled: ${snapshot.notifications.pushEnabled}")
                    appendLine("notifications.marketingEnabled: ${snapshot.notifications.marketingEnabled}")
                    appendLine("notifications.communityReplyEnabled: ${snapshot.notifications.communityReplyEnabled}")
                    appendLine("privacy.profileVisible: ${snapshot.privacy.profileVisible}")
                    append("privacy.activityVisible: ${snapshot.privacy.activityVisible}")
                }
            }
        }

        loadSettingsButton.isEnabled = true
    }
}

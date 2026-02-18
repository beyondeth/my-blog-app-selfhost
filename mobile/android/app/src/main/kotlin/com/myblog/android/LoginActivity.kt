package com.myblog.android

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Patterns
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.widget.doOnTextChanged
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.textfield.TextInputEditText
import com.myblog.android.feature.auth.AuthSessionManager
import com.myblog.android.feature.auth.model.AuthState
import com.myblog.android.feature.auth.model.AuthState.Expired
import com.myblog.android.feature.auth.model.AuthState.LoggedIn
import com.myblog.android.feature.auth.model.AuthState.LoggedOut
import com.myblog.android.feature.auth.model.AuthState.Restoring
import com.myblog.android.feature.auth.model.LoginRequest
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {
    private val authSessionManager: AuthSessionManager by lazy {
        AuthSessionManager(
            authRepository = AppRuntime.di.authRepository(),
            tokenStore = AppRuntime.di.tokenStore(),
        )
    }

    private lateinit var emailInput: TextInputEditText
    private lateinit var passwordInput: TextInputEditText
    private lateinit var loginButton: Button
    private lateinit var loginStatusText: TextView
    private lateinit var loginProgress: ProgressBar
    private lateinit var googleLoginButton: Button
    private lateinit var githubLoginButton: Button
    private var isAuthenticating: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        emailInput = findViewById(R.id.emailInput)
        passwordInput = findViewById(R.id.passwordInput)
        loginButton = findViewById(R.id.loginButton)
        loginStatusText = findViewById(R.id.loginStatusText)
        loginProgress = findViewById(R.id.loginProgress)
        googleLoginButton = findViewById(R.id.googleLoginButton)
        githubLoginButton = findViewById(R.id.githubLoginButton)
        renderStatus(null)
        setUiLoadingState(enabled = true, inProgress = false)
        updateCtaState()

        emailInput.doOnTextChanged { _, _, _, _ -> updateCtaState() }
        passwordInput.doOnTextChanged { _, _, _, _ -> updateCtaState() }

        loginButton.setOnClickListener {
            lifecycleScope.launch {
                login()
            }
        }

        googleLoginButton.setOnClickListener {
            startSocialLogin(PROVIDER_GOOGLE)
        }

        githubLoginButton.setOnClickListener {
            startSocialLogin(PROVIDER_GITHUB)
        }

        consumeSocialCallbackIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        consumeSocialCallbackIntent(intent)
    }

    private suspend fun login() {
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString()

        if (!isValidEmail(email) || password.isBlank()) {
            renderStatus(getString(R.string.login_status_missing_fields))
            return
        }

        setUiLoadingState(enabled = false, inProgress = true)
        renderStatus(getString(R.string.login_status_loading))

        authSessionManager.login(LoginRequest(email = email, password = password))
        handleAuthStateAfterLogin()
    }

    private suspend fun handleSocialOAuthCallback(uri: Uri) {
        val errorCode = uri.getQueryParameter("error")
        if (!errorCode.isNullOrBlank()) {
            val message = uri.getQueryParameter("message")
                ?: getString(R.string.login_social_failed)
            renderStatus(getString(
                R.string.login_status_failed,
                "$errorCode: $message",
            ))
            setUiLoadingState(enabled = true, inProgress = false)
            return
        }

        val code = uri.getQueryParameter("code")
        if (code.isNullOrBlank()) {
            renderStatus(getString(
                R.string.login_status_failed,
                getString(R.string.login_social_code_missing),
            ))
            setUiLoadingState(enabled = true, inProgress = false)
            return
        }

        val provider = uri.getQueryParameter("provider")
        setUiLoadingState(enabled = false, inProgress = true)
        renderStatus(getString(R.string.login_social_exchanging))

        authSessionManager.loginWithOAuthCode(
            code = code,
            redirectUri = AppRuntime.OAUTH_CALLBACK_URL,
            provider = provider,
        )
        handleAuthStateAfterLogin()
    }

    private fun consumeSocialCallbackIntent(intent: Intent?) {
        val callbackRaw =
            intent?.getStringExtra(EXTRA_SOCIAL_CALLBACK_URI)
                ?: intent?.data?.toString()
                ?: return
        val callbackUri = runCatching { Uri.parse(callbackRaw) }.getOrNull() ?: return
        if (!isExpectedCallback(callbackUri)) {
            return
        }

        lifecycleScope.launch {
            handleSocialOAuthCallback(callbackUri)
        }
    }

    private suspend fun handleAuthStateAfterLogin() {
        when (val state = authSessionManager.state.value) {
            is LoggedIn -> {
                renderStatus(getString(R.string.login_status_success, state.session.displayName))
                setResult(
                    RESULT_OK,
                    Intent().putExtra(EXTRA_LOGIN_DISPLAY_NAME, state.session.displayName),
                )
                finish()
            }

            is Expired -> {
                renderStatus(getString(R.string.login_status_failed, state.reason))
                setUiLoadingState(enabled = true, inProgress = false)
            }

            is LoggedOut,
            is Restoring -> {
                renderStatus(getString(R.string.login_status_failed, "Unknown auth state"))
                setUiLoadingState(enabled = true, inProgress = false)
            }
        }
    }

    private fun isValidEmail(value: String): Boolean {
        return value.isNotBlank() && Patterns.EMAIL_ADDRESS.matcher(value).matches()
    }

    private fun updateCtaState() {
        val isReady = isValidEmail(emailInput.text.toString()) && passwordInput.text.toString().isNotBlank()
        loginButton.isEnabled = isReady && !isAuthenticating
    }

    private fun setUiLoadingState(enabled: Boolean, inProgress: Boolean) {
        isAuthenticating = inProgress
        emailInput.isEnabled = enabled
        passwordInput.isEnabled = enabled
        googleLoginButton.isEnabled = enabled
        githubLoginButton.isEnabled = enabled
        loginProgress.visibility = if (inProgress) View.VISIBLE else View.GONE
        if (inProgress) {
            loginButton.text = getString(R.string.login_status_loading)
            loginButton.isEnabled = false
        } else {
            loginButton.text = getString(R.string.login_action)
            updateCtaState()
        }
    }

    private fun startSocialLogin(provider: String) {
        val authUri = buildSocialLoginUri(provider)
        if (authUri == null) {
            Toast.makeText(this, getString(R.string.login_social_invalid_url), Toast.LENGTH_SHORT).show()
            return
        }

        try {
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(false)
                .build()
            renderStatus(getString(R.string.login_social_opening))
            customTabsIntent.launchUrl(this, authUri)
        } catch (error: Exception) {
            renderStatus(getString(
                R.string.login_status_failed,
                getString(R.string.web_browser_missing),
            ))
        }
    }

    private fun renderStatus(message: String?) {
        val normalized = message?.trim().orEmpty()
        if (normalized.isEmpty()) {
            loginStatusText.text = ""
            loginStatusText.visibility = View.GONE
            return
        }
        loginStatusText.visibility = View.VISIBLE
        loginStatusText.text = normalized
    }

    private fun buildSocialLoginUri(provider: String): Uri? {
        val backendRoot = AppRuntime.BASE_URL
            .removeSuffix("/")
            .removeSuffix("/api/v1")
        val endpoint = "$backendRoot/api/v1/auth/$provider"
        return runCatching {
            Uri.parse(endpoint)
                .buildUpon()
                .appendQueryParameter("redirect_uri", AppRuntime.OAUTH_CALLBACK_URL)
                .build()
        }.getOrNull()
    }

    private fun isExpectedCallback(uri: Uri): Boolean {
        val matchesScheme = uri.scheme.equals(AppRuntime.OAUTH_CALLBACK_SCHEME, ignoreCase = true)
        val matchesHost = uri.host.equals(AppRuntime.OAUTH_CALLBACK_HOST, ignoreCase = true)
        val matchesPath = uri.path == AppRuntime.OAUTH_CALLBACK_PATH
        return matchesScheme && matchesHost && matchesPath
    }

    companion object {
        const val EXTRA_LOGIN_DISPLAY_NAME: String = "login_display_name"
        const val EXTRA_SOCIAL_CALLBACK_URI: String = "social_callback_uri"
        private const val PROVIDER_GOOGLE: String = "google"
        private const val PROVIDER_GITHUB: String = "github"

        fun intent(context: Context): Intent = Intent(context, LoginActivity::class.java)
    }
}

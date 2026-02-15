package com.myblog.android

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.myblog.android.feature.auth.AuthSessionManager
import com.myblog.android.feature.auth.model.AuthState
import com.myblog.android.feature.auth.model.LoginRequest
import com.myblog.android.feature.auth.model.AuthState.Expired
import com.myblog.android.feature.auth.model.AuthState.LoggedIn
import com.myblog.android.feature.auth.model.AuthState.LoggedOut
import com.myblog.android.feature.auth.model.AuthState.Restoring
import kotlinx.coroutines.launch
import com.google.android.material.textfield.TextInputEditText
import androidx.core.widget.doOnTextChanged
import android.widget.Toast
import android.view.View
import android.util.Patterns

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
        loginStatusText.text = getString(R.string.login_status_idle)
        setUiLoadingState(enabled = true)
        updateCtaState()

        emailInput.doOnTextChanged { _, _, _, _ -> updateCtaState() }
        passwordInput.doOnTextChanged { _, _, _, _ -> updateCtaState() }

        loginButton.setOnClickListener {
            lifecycleScope.launch {
                login()
            }
        }

        googleLoginButton.setOnClickListener {
            Toast.makeText(this, "Google login is planned for next release.", Toast.LENGTH_SHORT).show()
        }

        githubLoginButton.setOnClickListener {
            Toast.makeText(this, "GitHub login is planned for next release.", Toast.LENGTH_SHORT).show()
        }
    }

    private suspend fun login() {
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString()

        if (!isValidEmail(email) || password.isBlank()) {
            loginStatusText.text = getString(R.string.login_status_missing_fields)
            return
        }

        setUiLoadingState(enabled = false)
        loginStatusText.text = getString(R.string.login_status_loading)

        authSessionManager.login(LoginRequest(email = email, password = password))

        when (val state = authSessionManager.state.value) {
            is LoggedIn -> {
                loginStatusText.text = getString(R.string.login_status_success, state.session.displayName)
                setResult(
                    RESULT_OK,
                    Intent().putExtra(EXTRA_LOGIN_DISPLAY_NAME, state.session.displayName),
                )
                finish()
            }

            is Expired -> {
                loginStatusText.text = getString(R.string.login_status_failed, state.reason)
                setUiLoadingState(enabled = true)
            }

            is LoggedOut,
            is Restoring -> {
                loginStatusText.text = getString(R.string.login_status_failed, "Unknown auth state")
                setUiLoadingState(enabled = true)
            }
        }
    }

    private fun isValidEmail(value: String): Boolean {
        return value.isNotBlank() && Patterns.EMAIL_ADDRESS.matcher(value).matches()
    }

    private fun updateCtaState() {
        val isReady = isValidEmail(emailInput.text.toString()) && passwordInput.text.toString().isNotBlank()
        loginButton.isEnabled = isReady
    }

    private fun setUiLoadingState(enabled: Boolean) {
        loginButton.isEnabled = enabled
        emailInput.isEnabled = enabled
        passwordInput.isEnabled = enabled
        googleLoginButton.isEnabled = enabled
        githubLoginButton.isEnabled = enabled
        loginProgress.visibility = if (enabled) View.GONE else View.VISIBLE
        if (enabled.not()) {
            loginButton.text = getString(R.string.login_status_loading)
        } else {
            loginButton.text = getString(R.string.login_action)
        }
    }

    companion object {
        const val EXTRA_LOGIN_DISPLAY_NAME: String = "login_display_name"

        fun intent(context: Context): Intent = Intent(context, LoginActivity::class.java)
    }
}

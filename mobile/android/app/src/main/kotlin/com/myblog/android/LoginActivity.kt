package com.myblog.android

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.myblog.android.feature.auth.AuthSessionManager
import com.myblog.android.feature.auth.model.AuthState
import com.myblog.android.feature.auth.model.LoginRequest
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {
    private val authSessionManager: AuthSessionManager by lazy {
        AuthSessionManager(
            authRepository = AppRuntime.di.authRepository(),
            tokenStore = AppRuntime.di.tokenStore(),
        )
    }

    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var loginButton: Button
    private lateinit var loginStatusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        emailInput = findViewById(R.id.emailInput)
        passwordInput = findViewById(R.id.passwordInput)
        loginButton = findViewById(R.id.loginButton)
        loginStatusText = findViewById(R.id.loginStatusText)
        loginStatusText.text = getString(R.string.login_status_idle)

        loginButton.setOnClickListener {
            lifecycleScope.launch {
                login()
            }
        }
    }

    private suspend fun login() {
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString()

        if (email.isBlank() || password.isBlank()) {
            loginStatusText.text = getString(R.string.login_status_missing_fields)
            return
        }

        loginButton.isEnabled = false
        loginStatusText.text = getString(R.string.login_status_loading)

        authSessionManager.login(LoginRequest(email = email, password = password))

        when (val state = authSessionManager.state.value) {
            is AuthState.LoggedIn -> {
                loginStatusText.text = getString(R.string.login_status_success, state.session.displayName)
                setResult(
                    RESULT_OK,
                    Intent().putExtra(EXTRA_LOGIN_DISPLAY_NAME, state.session.displayName),
                )
                finish()
            }

            is AuthState.Expired -> {
                loginStatusText.text = getString(R.string.login_status_failed, state.reason)
                loginButton.isEnabled = true
            }

            AuthState.LoggedOut,
            AuthState.Restoring -> {
                loginStatusText.text = getString(R.string.login_status_failed, "Unknown auth state")
                loginButton.isEnabled = true
            }
        }
    }

    companion object {
        const val EXTRA_LOGIN_DISPLAY_NAME: String = "login_display_name"

        fun intent(context: Context): Intent = Intent(context, LoginActivity::class.java)
    }
}

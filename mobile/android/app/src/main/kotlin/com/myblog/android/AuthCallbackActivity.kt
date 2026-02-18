package com.myblog.android

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class AuthCallbackActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val callbackUri = intent?.data?.toString()
        val loginIntent = LoginActivity.intent(this).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            if (!callbackUri.isNullOrBlank()) {
                putExtra(LoginActivity.EXTRA_SOCIAL_CALLBACK_URI, callbackUri)
            }
        }
        startActivity(loginIntent)
        finish()
    }
}


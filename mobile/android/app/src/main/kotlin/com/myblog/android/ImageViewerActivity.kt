package com.myblog.android

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.viewpager2.widget.ViewPager2
import com.myblog.android.core.ui.theme.AppThemePreferenceStore
import com.myblog.android.feature.feed.ui.PostImagePagerAdapter

class ImageViewerActivity : AppCompatActivity() {
    private lateinit var root: View
    private lateinit var statusBarSpacer: View
    private lateinit var closeButton: TextView
    private lateinit var indexText: TextView
    private lateinit var pager: ViewPager2

    private lateinit var pagerAdapter: PostImagePagerAdapter
    private var images: List<String> = emptyList()
    private var startIndex: Int = 0

    private val pageChangeCallback = object : ViewPager2.OnPageChangeCallback() {
        override fun onPageSelected(position: Int) {
            super.onPageSelected(position)
            updateIndex(position)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        AppThemePreferenceStore.apply(AppThemePreferenceStore.read(this))
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_image_viewer)

        images = intent.getStringArrayListExtra(EXTRA_IMAGES).orEmpty().filter { it.isNotBlank() }
        if (images.isEmpty()) {
            finish()
            return
        }
        startIndex = intent.getIntExtra(EXTRA_START_INDEX, 0).coerceIn(0, images.lastIndex)

        bindViews()
        setupInsets()
        setupPager()
        closeButton.setOnClickListener { finish() }
    }

    override fun onDestroy() {
        if (::pager.isInitialized) {
            pager.unregisterOnPageChangeCallback(pageChangeCallback)
        }
        super.onDestroy()
    }

    private fun bindViews() {
        root = findViewById(R.id.imageViewerRoot)
        statusBarSpacer = findViewById(R.id.imageViewerStatusBarSpacer)
        closeButton = findViewById(R.id.imageViewerCloseButton)
        indexText = findViewById(R.id.imageViewerIndexText)
        pager = findViewById(R.id.imageViewerPager)
    }

    private fun setupInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val statusInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars())
            statusBarSpacer.layoutParams = statusBarSpacer.layoutParams.apply {
                height = statusInsets.top
            }
            insets
        }
    }

    private fun setupPager() {
        pagerAdapter = PostImagePagerAdapter(
            itemLayoutResId = R.layout.item_fullscreen_image_page,
        )
        pager.adapter = pagerAdapter
        pager.registerOnPageChangeCallback(pageChangeCallback)
        pagerAdapter.submitImages(images)
        pager.setCurrentItem(startIndex, false)
        updateIndex(startIndex)
    }

    private fun updateIndex(position: Int) {
        indexText.isVisible = images.size > 1
        if (images.isNotEmpty()) {
            indexText.text = getString(R.string.detail_image_index, position + 1, images.size)
        }
    }

    companion object {
        private const val EXTRA_IMAGES = "images"
        private const val EXTRA_START_INDEX = "start_index"

        fun intent(context: Context, images: ArrayList<String>, startIndex: Int): Intent {
            return Intent(context, ImageViewerActivity::class.java)
                .putStringArrayListExtra(EXTRA_IMAGES, images)
                .putExtra(EXTRA_START_INDEX, startIndex)
        }
    }
}

package com.myblog.android

import android.content.Context
import android.content.Intent
import android.widget.Button
import android.widget.EditText
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.core.widget.doOnTextChanged
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.myblog.android.core.network.ApiResult
import com.myblog.android.core.time.SystemClockProvider
import com.myblog.android.core.ui.theme.AppThemePreferenceStore
import com.myblog.android.feature.feed.FeedRepository
import com.myblog.android.feature.feed.model.FeedItem
import com.myblog.android.feature.feed.time.RelativeTimeFormatter
import com.myblog.android.feature.feed.ui.FeedAdapter
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class CommunityDetailActivity : AppCompatActivity() {
    private val feedRepository: FeedRepository by lazy { AppRuntime.di.feedRepository() }
    private val formatter = RelativeTimeFormatter(SystemClockProvider)

    private lateinit var root: View
    private lateinit var statusBarSpacer: View
    private lateinit var backButton: ImageView
    private lateinit var titleText: TextView
    private lateinit var stateText: TextView
    private lateinit var sortNewestButton: Button
    private lateinit var sortHotButton: Button
    private lateinit var sortTopButton: Button
    private lateinit var searchInput: EditText
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var recycler: RecyclerView

    private lateinit var adapter: FeedAdapter
    private var communitySlug: String = ""
    private var communityName: String = ""
    private var items: List<FeedItem> = emptyList()
    private var nextCursor: String? = null
    private var nextCursorId: String? = null
    private var hasMore: Boolean = false
    private var isLoadingMore = false
    private var selectedSort: String = "newest"
    private var searchQuery: String = ""
    private var firstPaintStartedAtMs: Long? = null
    private var searchDebounceJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        AppThemePreferenceStore.apply(AppThemePreferenceStore.read(this))
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_community_detail)

        communitySlug = intent.getStringExtra(EXTRA_COMMUNITY_SLUG).orEmpty()
        communityName = intent.getStringExtra(EXTRA_COMMUNITY_NAME).orEmpty().ifBlank { communitySlug }
        if (communitySlug.isBlank()) {
            finish()
            return
        }

        bindViews()
        setupInsets()
        setupRecycler()
        setupInteractions()
        refresh(reset = true)
    }

    override fun onDestroy() {
        searchDebounceJob?.cancel()
        super.onDestroy()
    }

    private fun bindViews() {
        root = findViewById(R.id.communityDetailRoot)
        statusBarSpacer = findViewById(R.id.communityDetailStatusBarSpacer)
        backButton = findViewById(R.id.communityDetailBackButton)
        titleText = findViewById(R.id.communityDetailTitleText)
        stateText = findViewById(R.id.communityDetailStateText)
        sortNewestButton = findViewById(R.id.communitySortNewestButton)
        sortHotButton = findViewById(R.id.communitySortHotButton)
        sortTopButton = findViewById(R.id.communitySortTopButton)
        searchInput = findViewById(R.id.communityDetailSearchInput)
        swipeRefresh = findViewById(R.id.communityDetailSwipeRefresh)
        recycler = findViewById(R.id.communityDetailRecycler)
        titleText.text = communityName
        syncSortButtons()
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

    private fun setupRecycler() {
        adapter = FeedAdapter(
            onItemClick = { item -> openDetail(item) },
            onLikeClick = { item -> toggleLike(item) },
            onCommentClick = { item -> openDetail(item) },
        ).also { feedAdapter ->
            feedAdapter.onShareClick = { item -> share(item) }
        }

        recycler.layoutManager = LinearLayoutManager(this)
        recycler.itemAnimator = null
        recycler.adapter = adapter
        recycler.addOnScrollListener(
            object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    super.onScrolled(recyclerView, dx, dy)
                    if (dy <= 0 || isLoadingMore || !hasMore) return
                    val manager = recyclerView.layoutManager as? LinearLayoutManager ?: return
                    val last = manager.findLastVisibleItemPosition()
                    if (last >= manager.itemCount - 5) {
                        refresh(reset = false)
                    }
                }
            },
        )
    }

    private fun setupInteractions() {
        backButton.setOnClickListener { finish() }
        swipeRefresh.setOnRefreshListener { refresh(reset = true) }
        sortNewestButton.setOnClickListener {
            if (selectedSort != "newest") {
                selectedSort = "newest"
                syncSortButtons()
                refresh(reset = true)
            }
        }
        sortHotButton.setOnClickListener {
            if (selectedSort != "hot") {
                selectedSort = "hot"
                syncSortButtons()
                refresh(reset = true)
            }
        }
        sortTopButton.setOnClickListener {
            if (selectedSort != "top") {
                selectedSort = "top"
                syncSortButtons()
                refresh(reset = true)
            }
        }
        searchInput.doOnTextChanged { text, _, _, _ ->
            val normalized = text?.toString().orEmpty().trim()
            if (searchQuery != normalized) {
                searchQuery = normalized
                searchDebounceJob?.cancel()
                searchDebounceJob = lifecycleScope.launch {
                    delay(260)
                    refresh(reset = true)
                }
            }
        }
    }

    private fun syncSortButtons() {
        updateSortButton(sortNewestButton, selectedSort == "newest")
        updateSortButton(sortHotButton, selectedSort == "hot")
        updateSortButton(sortTopButton, selectedSort == "top")
    }

    private fun updateSortButton(button: Button, selected: Boolean) {
        button.isEnabled = !selected
        button.setTextColor(
            if (selected) {
                getColor(R.color.myblog_surface)
            } else {
                getColor(R.color.myblog_text_secondary)
            },
        )
        button.setBackgroundResource(
            if (selected) R.drawable.bg_filter_chip_selected else R.drawable.bg_filter_chip_unselected,
        )
    }

    private fun refresh(reset: Boolean) {
        lifecycleScope.launch {
            if (isLoadingMore) return@launch
            if (!reset && (!hasMore || nextCursor.isNullOrBlank())) return@launch
            isLoadingMore = true
            if (reset) {
                firstPaintStartedAtMs = SystemClock.elapsedRealtime()
                swipeRefresh.isRefreshing = true
                stateText.isVisible = false
            }

            when (
                val result = feedRepository.fetchCommunityPosts(
                    communitySlug = communitySlug,
                    cursor = if (reset) null else nextCursor,
                    cursorId = if (reset) null else nextCursorId,
                    limit = 20,
                    sortBy = selectedSort,
                    search = searchQuery.takeIf { it.isNotBlank() },
                )
            ) {
                is ApiResult.Failure -> {
                    stateText.isVisible = true
                    stateText.text = result.message
                    Toast.makeText(this@CommunityDetailActivity, result.message, Toast.LENGTH_SHORT).show()
                }

                is ApiResult.Success -> {
                    items = if (reset) {
                        result.data.items
                    } else {
                        (items + result.data.items).distinctBy { it.postId }
                    }
                    nextCursor = result.data.nextCursor
                    hasMore = result.data.hasMore && !result.data.nextCursor.isNullOrBlank()
                    nextCursorId = result.data.nextCursorId
                    adapter.submitFeedItems(items, formatter)
                    stateText.isVisible = items.isEmpty()
                    stateText.text = if (items.isEmpty()) getString(R.string.feed_state_empty) else ""
                    if (reset && items.isNotEmpty()) {
                        firstPaintStartedAtMs?.let { startedAt ->
                            val elapsed = SystemClock.elapsedRealtime() - startedAt
                            Log.i(
                                "UXTrace",
                                "communityDetail.firstPaintMs=$elapsed slug=$communitySlug sort=$selectedSort items=${items.size}",
                            )
                            firstPaintStartedAtMs = null
                        }
                    }
                }
            }

            swipeRefresh.isRefreshing = false
            isLoadingMore = false
        }
    }

    private fun openDetail(item: FeedItem) {
        startActivity(
            PostDetailActivity.intent(
                context = this,
                postId = item.postId,
                postSlug = item.slug.ifBlank { null },
                sourceType = item.sourceType,
                communitySlug = item.communitySlug ?: communitySlug,
            ),
        )
    }

    private fun toggleLike(item: FeedItem) {
        val previous = items.firstOrNull { it.postId == item.postId } ?: return
        val optimisticLiked = !previous.liked
        val optimisticCount = if (optimisticLiked) previous.likeCount + 1 else (previous.likeCount - 1).coerceAtLeast(0)
        items = items.map { current ->
            if (current.postId == item.postId) current.copy(liked = optimisticLiked, likeCount = optimisticCount) else current
        }
        adapter.submitFeedItems(items, formatter)

        lifecycleScope.launch {
            when (
                val result = feedRepository.togglePostLike(
                    postId = item.postId,
                    sourceType = item.sourceType,
                    communitySlug = item.communitySlug ?: communitySlug,
                )
            ) {
                is ApiResult.Failure -> {
                    items = items.map { current -> if (current.postId == item.postId) previous else current }
                    adapter.submitFeedItems(items, formatter)
                    Toast.makeText(this@CommunityDetailActivity, result.message, Toast.LENGTH_SHORT).show()
                }

                is ApiResult.Success -> {
                    val resolved = result.data.likeCount ?: optimisticCount
                    items = items.map { current ->
                        if (current.postId == item.postId) {
                            current.copy(liked = result.data.liked, likeCount = resolved)
                        } else {
                            current
                        }
                    }
                    adapter.submitFeedItems(items, formatter)
                }
            }
        }
    }

    private fun share(item: FeedItem) {
        val webBaseUrl = AppRuntime.BASE_URL.substringBefore("/api/v1")
        val slugOrId = item.slug.ifBlank { item.postId }
        val shareUrl = "$webBaseUrl/c/$communitySlug/comments/$slugOrId"
        startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, shareUrl)
                },
                getString(R.string.feed_share_chooser),
            ),
        )
    }

    companion object {
        private const val EXTRA_COMMUNITY_SLUG = "community_slug"
        private const val EXTRA_COMMUNITY_NAME = "community_name"

        fun intent(
            context: Context,
            communitySlug: String,
            communityName: String,
        ): Intent {
            return Intent(context, CommunityDetailActivity::class.java)
                .putExtra(EXTRA_COMMUNITY_SLUG, communitySlug)
                .putExtra(EXTRA_COMMUNITY_NAME, communityName)
        }
    }
}

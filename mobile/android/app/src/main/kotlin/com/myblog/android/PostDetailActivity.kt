package com.myblog.android

import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.core.widget.doOnTextChanged
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.viewpager2.widget.ViewPager2
import coil.load
import coil.request.CachePolicy
import com.google.android.material.button.MaterialButton
import com.myblog.android.core.network.ApiResult
import com.myblog.android.core.time.SystemClockProvider
import com.myblog.android.core.ui.theme.AppThemePreferenceStore
import com.myblog.android.feature.feed.FeedRepository
import com.myblog.android.feature.feed.model.CommentPage
import com.myblog.android.feature.feed.model.CommentSort
import com.myblog.android.feature.feed.model.PostComment
import com.myblog.android.feature.feed.model.PostDetail
import com.myblog.android.feature.feed.time.RelativeTimeFormatter
import com.myblog.android.feature.feed.ui.CommentAdapter
import com.myblog.android.feature.feed.ui.CommentRowItem
import com.myblog.android.feature.feed.ui.PostImagePagerAdapter
import kotlinx.coroutines.launch

class PostDetailActivity : AppCompatActivity() {
    private val feedRepository: FeedRepository by lazy { AppRuntime.di.feedRepository() }
    private val timeFormatter = RelativeTimeFormatter(SystemClockProvider)

    private lateinit var detailRoot: View
    private lateinit var statusBarSpacer: View
    private lateinit var detailBackButton: TextView
    private lateinit var authorAvatar: ImageView
    private lateinit var authorMetaText: TextView
    private lateinit var bodyText: TextView
    private lateinit var imagePagerContainer: View
    private lateinit var imagePager: ViewPager2
    private lateinit var imagePagerIndicator: TextView
    private lateinit var likeAction: LinearLayout
    private lateinit var likeIcon: ImageView
    private lateinit var likeCountText: TextView
    private lateinit var commentAction: LinearLayout
    private lateinit var commentCountText: TextView
    private lateinit var viewCountText: TextView
    private lateinit var shareAction: LinearLayout
    private lateinit var sortPopularButton: MaterialButton
    private lateinit var sortRecentButton: MaterialButton
    private lateinit var commentStateText: TextView
    private lateinit var commentsRecycler: RecyclerView
    private lateinit var composerAvatar: ImageView
    private lateinit var composerInput: EditText
    private lateinit var composerSendButton: TextView
    private lateinit var bottomNav: View

    private lateinit var commentAdapter: CommentAdapter
    private lateinit var imagePagerAdapter: PostImagePagerAdapter

    private var postId: String = ""
    private var postSlug: String? = null
    private var sourceType: String = "blog"
    private var communitySlug: String? = null

    private var currentPostDetail: PostDetail? = null
    private var selectedSort: CommentSort = CommentSort.POPULAR
    private var commentPage: CommentPage? = null
    private var parentComments: List<PostComment> = emptyList()
    private val repliesByParent: MutableMap<String, List<PostComment>> = mutableMapOf()
    private val loadedReplyParents: MutableSet<String> = mutableSetOf()
    private var replyingParentCommentId: String? = null
    private var isLoadingMoreComments: Boolean = false
    private var currentImageUrls: List<String> = emptyList()
    private var detailLoadStartedAtMs: Long? = null
    private var commentLoadStartedAtMs: Long? = null
    private val imagePageCallback = object : ViewPager2.OnPageChangeCallback() {
        override fun onPageSelected(position: Int) {
            super.onPageSelected(position)
            updateImageIndicator(position, currentImageUrls.size)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        AppThemePreferenceStore.apply(AppThemePreferenceStore.read(this))
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_post_detail)

        postId = intent.getStringExtra(EXTRA_POST_ID).orEmpty()
        sourceType = intent.getStringExtra(EXTRA_SOURCE_TYPE).orEmpty().ifBlank { "blog" }
        communitySlug = intent.getStringExtra(EXTRA_COMMUNITY_SLUG)
        postSlug = intent.getStringExtra(EXTRA_POST_SLUG)

        if (postId.isBlank()) {
            finish()
            return
        }

        bindViews()
        setupInsets()
        setupImagePager()
        setupRecycler()
        setupInteractions()
        syncSortButtons()
        loadAll()
    }

    override fun onDestroy() {
        if (::imagePager.isInitialized) {
            imagePager.unregisterOnPageChangeCallback(imagePageCallback)
        }
        super.onDestroy()
    }

    private fun bindViews() {
        detailRoot = findViewById(R.id.detailRoot)
        statusBarSpacer = findViewById(R.id.detailStatusBarSpacer)
        detailBackButton = findViewById(R.id.detailBackButton)
        authorAvatar = findViewById(R.id.detailAuthorAvatar)
        authorMetaText = findViewById(R.id.detailAuthorMetaText)
        bodyText = findViewById(R.id.detailBodyText)
        imagePagerContainer = findViewById(R.id.detailImagePagerContainer)
        imagePager = findViewById(R.id.detailImagePager)
        imagePagerIndicator = findViewById(R.id.detailImagePagerIndicator)
        likeAction = findViewById(R.id.detailLikeAction)
        likeIcon = findViewById(R.id.detailLikeIcon)
        likeCountText = findViewById(R.id.detailLikeCount)
        commentAction = findViewById(R.id.detailCommentAction)
        commentCountText = findViewById(R.id.detailCommentCount)
        viewCountText = findViewById(R.id.detailViewCount)
        shareAction = findViewById(R.id.detailShareAction)
        sortPopularButton = findViewById(R.id.detailSortPopularButton)
        sortRecentButton = findViewById(R.id.detailSortRecentButton)
        commentStateText = findViewById(R.id.detailCommentStateText)
        commentsRecycler = findViewById(R.id.detailCommentsRecycler)
        composerAvatar = findViewById(R.id.detailComposerAvatar)
        composerInput = findViewById(R.id.detailComposerInput)
        composerSendButton = findViewById(R.id.detailComposerSendButton)
        bottomNav = findViewById(R.id.detailBottomNav)
    }

    private fun setupImagePager() {
        imagePagerAdapter = PostImagePagerAdapter(
            itemLayoutResId = R.layout.item_post_image_page,
            onImageClick = { index ->
                if (currentImageUrls.isNotEmpty()) {
                    startActivity(
                        ImageViewerActivity.intent(
                            context = this,
                            images = ArrayList(currentImageUrls),
                            startIndex = index,
                        ),
                    )
                }
            },
        )
        imagePager.adapter = imagePagerAdapter
        imagePager.offscreenPageLimit = 1
        imagePager.registerOnPageChangeCallback(imagePageCallback)
    }

    private fun setupInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(detailRoot) { _, insets ->
            val statusInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars())
            val navInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            statusBarSpacer.layoutParams = statusBarSpacer.layoutParams.apply {
                height = statusInsets.top
            }
            bottomNav.setPadding(
                bottomNav.paddingLeft,
                bottomNav.paddingTop,
                bottomNav.paddingRight,
                navInsets.bottom,
            )
            insets
        }
    }

    private fun setupRecycler() {
        commentAdapter = CommentAdapter(
            formatter = timeFormatter,
            onLikeClick = { row -> toggleCommentLike(row.comment) },
            onReplyClick = { row -> openReplyComposer(row) },
            onLoadRepliesClick = { row -> loadReplies(row.comment.commentId) },
        )
        commentsRecycler.layoutManager = LinearLayoutManager(this)
        commentsRecycler.itemAnimator = null
        commentsRecycler.adapter = commentAdapter
        commentsRecycler.addOnScrollListener(
            object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    super.onScrolled(recyclerView, dx, dy)
                    if (dy <= 0 || isLoadingMoreComments) return
                    val manager = recyclerView.layoutManager as? LinearLayoutManager ?: return
                    val total = manager.itemCount
                    val last = manager.findLastVisibleItemPosition()
                    val hasMore = commentPage?.hasMore == true && !commentPage?.nextCursor.isNullOrBlank()
                    if (hasMore && last >= total - 4) {
                        loadComments(reset = false)
                    }
                }
            },
        )
    }

    private fun setupInteractions() {
        detailBackButton.setOnClickListener { finish() }
        findViewById<View>(R.id.detailTabHome).setOnClickListener { finish() }
        findViewById<View>(R.id.detailTabCommunity).setOnClickListener { finish() }
        findViewById<View>(R.id.detailTabCompose).setOnClickListener { finish() }
        findViewById<View>(R.id.detailTabProfile).setOnClickListener { finish() }

        sortPopularButton.setOnClickListener {
            if (selectedSort != CommentSort.POPULAR) {
                selectedSort = CommentSort.POPULAR
                syncSortButtons()
                loadComments(reset = true)
            }
        }
        sortRecentButton.setOnClickListener {
            if (selectedSort != CommentSort.RECENT) {
                selectedSort = CommentSort.RECENT
                syncSortButtons()
                loadComments(reset = true)
            }
        }
        commentAction.setOnClickListener {
            composerInput.requestFocus()
        }
        shareAction.setOnClickListener {
            val shareUrl = resolvePostUrl()
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, shareUrl)
            }
            startActivity(Intent.createChooser(intent, getString(R.string.feed_share_chooser)))
        }
        composerSendButton.setOnClickListener {
            submitComment()
        }
        composerInput.doOnTextChanged { text, _, _, _ ->
            composerSendButton.alpha = if (text.isNullOrBlank()) 0.4f else 1f
        }
        likeAction.setOnClickListener {
            togglePostLike()
        }
    }

    private fun loadAll() {
        lifecycleScope.launch {
            loadPostDetail()
            loadComments(reset = true)
        }
    }

    private suspend fun loadPostDetail() {
        detailLoadStartedAtMs = SystemClock.elapsedRealtime()
        when (val result = feedRepository.fetchPostDetail(postId, sourceType, communitySlug, postSlug)) {
            is ApiResult.Failure -> {
                Toast.makeText(
                    this@PostDetailActivity,
                    "상세를 불러오지 못했습니다: ${result.message}",
                    Toast.LENGTH_SHORT,
                ).show()
            }

            is ApiResult.Success -> {
                currentPostDetail = result.data
                renderPost(result.data)
                detailLoadStartedAtMs?.let { startedAt ->
                    val elapsed = SystemClock.elapsedRealtime() - startedAt
                    Log.i("UXTrace", "detail.firstPaintMs=$elapsed postId=$postId")
                    detailLoadStartedAtMs = null
                }
                feedRepository.recordPostView(
                    postId = postId,
                    sourceType = sourceType,
                    communitySlug = communitySlug,
                )
            }
        }
    }

    private fun renderPost(detail: PostDetail) {
        val elapsed = timeFormatter.formatFromEpochSeconds(detail.createdAtEpochSeconds)
        authorMetaText.text = "${detail.authorName} · $elapsed"
        val normalizedBody = detail.contentText
            .ifBlank { detail.title }
            .replace(Regex("!\\[[^\\]]*\\]\\([^\\)]+\\)"), "")
            .replace(Regex("https?://\\S+"), "")
            .trim()
        val body = normalizedBody.ifBlank { detail.title.ifBlank { "(내용 없음)" } }
        bodyText.text = body

        val authorAvatarSource: Any = detail.authorProfileImage
            ?.takeIf { it.isNotBlank() }
            ?: R.drawable.myblog_avatar_placeholder
        authorAvatar.load(authorAvatarSource) {
            placeholder(R.drawable.myblog_avatar_placeholder)
            error(R.drawable.myblog_avatar_placeholder)
            fallback(R.drawable.myblog_avatar_placeholder)
            crossfade(true)
            memoryCachePolicy(CachePolicy.ENABLED)
            diskCachePolicy(CachePolicy.ENABLED)
        }

        currentImageUrls = detail.images.filter { it.isNotBlank() }.distinct()
        imagePagerContainer.isVisible = currentImageUrls.isNotEmpty()
        if (currentImageUrls.isNotEmpty()) {
            imagePagerAdapter.submitImages(currentImageUrls)
            imagePager.setCurrentItem(0, false)
            updateImageIndicator(position = 0, total = currentImageUrls.size)
        } else {
            imagePagerIndicator.isVisible = false
        }
        renderPostCounts(detail)

        composerAvatar.load(authorAvatarSource) {
            placeholder(R.drawable.myblog_avatar_placeholder)
            error(R.drawable.myblog_avatar_placeholder)
            fallback(R.drawable.myblog_avatar_placeholder)
            crossfade(true)
            memoryCachePolicy(CachePolicy.ENABLED)
            diskCachePolicy(CachePolicy.ENABLED)
        }
    }

    private fun updateImageIndicator(position: Int, total: Int) {
        imagePagerIndicator.isVisible = total > 1
        if (total > 0) {
            imagePagerIndicator.text = getString(R.string.detail_image_index, position + 1, total)
        }
    }

    private fun renderPostCounts(detail: PostDetail) {
        likeCountText.text = detail.likeCount.coerceAtLeast(0).toString()
        commentCountText.text = detail.commentCount.coerceAtLeast(0).toString()
        viewCountText.text = detail.viewCount.coerceAtLeast(0).toString()
        if (detail.liked) {
            likeIcon.setImageResource(R.drawable.ic_myblog_like_filled)
            likeIcon.imageTintList = ColorStateList.valueOf(getColor(R.color.myblog_error))
            likeCountText.setTextColor(ContextCompat.getColor(this, R.color.myblog_error))
        } else {
            likeIcon.setImageResource(R.drawable.ic_myblog_like_outline)
            likeIcon.imageTintList = ColorStateList.valueOf(getColor(R.color.myblog_icon_muted))
            likeCountText.setTextColor(ContextCompat.getColor(this, R.color.myblog_text_secondary))
        }
    }

    private fun syncSortButtons() {
        val selectedText = if (selectedSort == CommentSort.POPULAR) {
            getColor(R.color.myblog_surface)
        } else {
            getColor(R.color.myblog_text_secondary)
        }
        val unselectedText = if (selectedSort == CommentSort.RECENT) {
            getColor(R.color.myblog_surface)
        } else {
            getColor(R.color.myblog_text_secondary)
        }
        sortPopularButton.setTextColor(selectedText)
        sortRecentButton.setTextColor(unselectedText)
        sortPopularButton.setBackgroundResource(
            if (selectedSort == CommentSort.POPULAR) {
                R.drawable.bg_filter_chip_selected
            } else {
                R.drawable.bg_filter_chip_unselected
            },
        )
        sortRecentButton.setBackgroundResource(
            if (selectedSort == CommentSort.RECENT) {
                R.drawable.bg_filter_chip_selected
            } else {
                R.drawable.bg_filter_chip_unselected
            },
        )
    }

    private fun loadComments(reset: Boolean) {
        lifecycleScope.launch {
            if (isLoadingMoreComments) return@launch
            val nextCursor = if (reset) null else commentPage?.nextCursor
            if (!reset && (nextCursor.isNullOrBlank() || commentPage?.hasMore != true)) {
                return@launch
            }
            isLoadingMoreComments = true
            if (reset) {
                commentLoadStartedAtMs = SystemClock.elapsedRealtime()
                commentStateText.isVisible = true
                commentStateText.text = getString(R.string.feed_state_loading)
                parentComments = emptyList()
                repliesByParent.clear()
                loadedReplyParents.clear()
                commentAdapter.submitList(emptyList())
                commentPage = null
            }
            val snapshot = if (selectedSort == CommentSort.POPULAR) commentPage?.snapshotTimestamp else null
            when (val result = feedRepository.fetchComments(
                postId = postId,
                sourceType = sourceType,
                communitySlug = communitySlug,
                sort = selectedSort,
                cursor = nextCursor,
                snapshotTimestamp = snapshot,
            )) {
                is ApiResult.Failure -> {
                    if (reset) {
                        commentStateText.isVisible = true
                        commentStateText.text = "댓글을 불러오지 못했습니다: ${result.message}"
                    } else {
                        Toast.makeText(this@PostDetailActivity, result.message, Toast.LENGTH_SHORT).show()
                    }
                }

                is ApiResult.Success -> {
                    val snapshotTimestamp = if (selectedSort == CommentSort.POPULAR) {
                        commentPage?.snapshotTimestamp ?: result.data.snapshotTimestamp
                    } else {
                        null
                    }
                    commentPage = result.data.copy(snapshotTimestamp = snapshotTimestamp)
                    parentComments = if (reset) {
                        result.data.comments
                    } else {
                        (parentComments + result.data.comments).distinctBy { it.commentId }
                    }
                    commentStateText.isVisible = parentComments.isEmpty()
                    commentStateText.text = if (parentComments.isEmpty()) {
                        getString(R.string.feed_state_empty)
                    } else {
                        ""
                    }
                    syncCommentRows()
                    if (reset && parentComments.isNotEmpty()) {
                        commentLoadStartedAtMs?.let { startedAt ->
                            val elapsed = SystemClock.elapsedRealtime() - startedAt
                            Log.i("UXTrace", "detail.commentsFirstPaintMs=$elapsed count=${parentComments.size} sort=${selectedSort.name.lowercase()}")
                            commentLoadStartedAtMs = null
                        }
                    }
                }
            }
            isLoadingMoreComments = false
        }
    }

    private fun loadReplies(parentCommentId: String) {
        if (loadedReplyParents.contains(parentCommentId)) return
        lifecycleScope.launch {
            when (val result = feedRepository.fetchReplies(
                postId = postId,
                sourceType = sourceType,
                communitySlug = communitySlug,
                parentCommentId = parentCommentId,
                cursor = null,
            )) {
                is ApiResult.Failure -> {
                    Toast.makeText(this@PostDetailActivity, result.message, Toast.LENGTH_SHORT).show()
                }

                is ApiResult.Success -> {
                    repliesByParent[parentCommentId] = result.data.comments
                    loadedReplyParents += parentCommentId
                    syncCommentRows()
                }
            }
        }
    }

    private fun syncCommentRows() {
        val rows = mutableListOf<CommentRowItem>()
        parentComments.forEach { parent ->
            rows += CommentRowItem(
                comment = parent,
                depth = 0,
                repliesLoaded = loadedReplyParents.contains(parent.commentId),
            )
            val replies = repliesByParent[parent.commentId].orEmpty()
            replies.forEach { reply ->
                rows += CommentRowItem(
                    comment = reply,
                    depth = 1,
                    repliesLoaded = true,
                )
            }
        }
        commentAdapter.submitList(rows)
    }

    private fun openReplyComposer(row: CommentRowItem) {
        replyingParentCommentId = if (row.depth == 0) {
            row.comment.commentId
        } else {
            row.comment.parentCommentId ?: row.comment.commentId
        }
        composerInput.hint = "@${row.comment.authorName}에게 답글..."
        composerInput.requestFocus()
    }

    private fun submitComment() {
        val content = composerInput.text?.toString().orEmpty().trim()
        if (content.isBlank()) return

        val parentId = replyingParentCommentId
        composerSendButton.isEnabled = false
        lifecycleScope.launch {
            when (val result = feedRepository.createComment(
                postId = postId,
                sourceType = sourceType,
                communitySlug = communitySlug,
                content = content,
                parentCommentId = parentId,
            )) {
                is ApiResult.Failure -> {
                    Toast.makeText(this@PostDetailActivity, result.message, Toast.LENGTH_SHORT).show()
                }

                is ApiResult.Success -> {
                    val created = result.data
                    if (parentId.isNullOrBlank()) {
                        parentComments = listOf(created) + parentComments
                    } else {
                        val currentReplies = repliesByParent[parentId].orEmpty()
                        repliesByParent[parentId] = currentReplies + created.copy(parentCommentId = parentId)
                        loadedReplyParents += parentId
                        parentComments = parentComments.map { comment ->
                            if (comment.commentId == parentId) {
                                comment.copy(replyCount = comment.replyCount + 1)
                            } else {
                                comment
                            }
                        }
                    }
                    val current = currentPostDetail
                    if (current != null) {
                        currentPostDetail = current.copy(commentCount = current.commentCount + 1)
                        renderPostCounts(currentPostDetail ?: current)
                    }
                    composerInput.setText("")
                    replyingParentCommentId = null
                    composerInput.hint = getString(R.string.detail_comment_hint)
                    syncCommentRows()
                }
            }
            composerSendButton.isEnabled = true
        }
    }

    private fun togglePostLike() {
        val current = currentPostDetail ?: return
        val optimisticLiked = !current.liked
        val optimisticCount = if (optimisticLiked) current.likeCount + 1 else (current.likeCount - 1).coerceAtLeast(0)
        val previous = current
        currentPostDetail = current.copy(liked = optimisticLiked, likeCount = optimisticCount)
        renderPostCounts(currentPostDetail ?: current)

        lifecycleScope.launch {
            when (val result = feedRepository.togglePostLike(
                postId = postId,
                sourceType = sourceType,
                communitySlug = communitySlug,
            )) {
                is ApiResult.Failure -> {
                    currentPostDetail = previous
                    renderPostCounts(previous)
                    Toast.makeText(this@PostDetailActivity, result.message, Toast.LENGTH_SHORT).show()
                }

                is ApiResult.Success -> {
                    val resolvedCount = result.data.likeCount ?: optimisticCount
                    currentPostDetail = previous.copy(
                        liked = result.data.liked,
                        likeCount = resolvedCount,
                    )
                    renderPostCounts(currentPostDetail ?: previous)
                }
            }
        }
    }

    private fun toggleCommentLike(comment: PostComment) {
        val parentId = comment.parentCommentId
        val optimisticLiked = !comment.liked
        val optimisticCount = if (optimisticLiked) comment.likeCount + 1 else (comment.likeCount - 1).coerceAtLeast(0)
        updateComment(comment.commentId) { it.copy(liked = optimisticLiked, likeCount = optimisticCount) }

        lifecycleScope.launch {
            when (val result = feedRepository.toggleCommentLike(
                postId = postId,
                sourceType = sourceType,
                communitySlug = communitySlug,
                commentId = comment.commentId,
            )) {
                is ApiResult.Failure -> {
                    updateComment(comment.commentId) { comment }
                    Toast.makeText(this@PostDetailActivity, result.message, Toast.LENGTH_SHORT).show()
                }

                is ApiResult.Success -> {
                    val updated = result.data
                    updateComment(comment.commentId) {
                        it.copy(
                            liked = updated.liked,
                            likeCount = if (updated.likeCount >= 0) updated.likeCount else optimisticCount,
                            parentCommentId = it.parentCommentId ?: parentId,
                        )
                    }
                }
            }
        }
    }

    private fun updateComment(commentId: String, transform: (PostComment) -> PostComment) {
        parentComments = parentComments.map { comment ->
            if (comment.commentId == commentId) transform(comment) else comment
        }
        repliesByParent.keys.toList().forEach { parentId ->
            repliesByParent[parentId] = repliesByParent[parentId].orEmpty().map { reply ->
                if (reply.commentId == commentId) transform(reply) else reply
            }
        }
        syncCommentRows()
    }

    private fun resolvePostUrl(): String {
        val webBaseUrl = AppRuntime.BASE_URL.substringBefore("/api/v1")
        val slugOrId = postSlug?.ifBlank { postId } ?: postId
        return when (sourceType.lowercase()) {
            "community" -> {
                val slug = communitySlug?.trim().orEmpty()
                if (slug.isNotBlank()) "$webBaseUrl/c/$slug/comments/$slugOrId" else "$webBaseUrl/p/$slugOrId"
            }

            else -> "$webBaseUrl/p/$slugOrId"
        }
    }

    companion object {
        private const val EXTRA_POST_ID = "post_id"
        private const val EXTRA_POST_SLUG = "post_slug"
        private const val EXTRA_SOURCE_TYPE = "source_type"
        private const val EXTRA_COMMUNITY_SLUG = "community_slug"

        fun intent(
            context: Context,
            postId: String,
            postSlug: String?,
            sourceType: String,
            communitySlug: String?,
        ): Intent {
            return Intent(context, PostDetailActivity::class.java)
                .putExtra(EXTRA_POST_ID, postId)
                .putExtra(EXTRA_POST_SLUG, postSlug)
                .putExtra(EXTRA_SOURCE_TYPE, sourceType)
                .putExtra(EXTRA_COMMUNITY_SLUG, communitySlug)
        }
    }
}

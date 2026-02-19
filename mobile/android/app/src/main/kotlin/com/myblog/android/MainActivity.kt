package com.myblog.android

import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.core.widget.doOnTextChanged
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import coil.decode.SvgDecoder
import coil.load
import coil.request.CachePolicy
import com.google.android.material.button.MaterialButton
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.switchmaterial.SwitchMaterial
import com.myblog.android.app.AppEntry
import com.myblog.android.app.model.AppShellState
import com.myblog.android.core.navigation.AppDestination
import com.myblog.android.core.network.ApiResult
import com.myblog.android.core.time.SystemClockProvider
import com.myblog.android.core.ui.theme.AppThemePreferenceStore
import com.myblog.android.feature.auth.AuthSessionManager
import com.myblog.android.feature.feed.FeedRepository
import com.myblog.android.feature.feed.FeedTimelineCoordinator
import com.myblog.android.feature.feed.model.CommunityItem
import com.myblog.android.feature.feed.model.ComposeImageUpload
import com.myblog.android.feature.feed.model.ComposeRequest
import com.myblog.android.feature.feed.model.FeedItem
import com.myblog.android.feature.feed.model.FeedSort
import com.myblog.android.feature.feed.model.FeedState
import com.myblog.android.feature.feed.model.UploadedComposeImage
import com.myblog.android.feature.feed.time.RelativeTimeFormatter
import com.myblog.android.feature.feed.ui.FeedAdapter
import com.myblog.android.feature.community.ui.CommunityAdapter
import java.io.ByteArrayOutputStream
import android.provider.OpenableColumns
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private val bootstrapCoordinator by lazy { AppEntry.bootstrapCoordinator(AppRuntime.di) }
    private val feedRepository: FeedRepository by lazy { AppRuntime.di.feedRepository() }
    private val authSessionManager: AuthSessionManager by lazy {
        AuthSessionManager(
            authRepository = AppRuntime.di.authRepository(),
            tokenStore = AppRuntime.di.tokenStore(),
        )
    }
    private val feedCoordinator by lazy { FeedTimelineCoordinator(feedRepository = feedRepository) }
    private val timeFormatter = RelativeTimeFormatter(SystemClockProvider)

    private lateinit var mainRoot: View
    private lateinit var statusBarSpacer: View
    private lateinit var bottomNavHost: View
    private lateinit var bottomNav: View
    private lateinit var headerLogoImage: ImageView
    private lateinit var quickComposeAvatar: ImageView
    private lateinit var quickComposeCard: View
    private lateinit var topSettingsButton: Button
    private lateinit var authStatusText: TextView
    private lateinit var feedStateText: TextView
    private lateinit var feedSwipeRefresh: SwipeRefreshLayout
    private lateinit var feedRecycler: RecyclerView
    private lateinit var feedSearchInput: EditText
    private lateinit var sortRecentButton: Button
    private lateinit var sortHotButton: Button
    private lateinit var sortTopButton: Button
    private lateinit var feedPanel: View
    private lateinit var communityPanel: View
    private lateinit var composePanel: View
    private lateinit var profilePanel: View
    private lateinit var profileSummaryText: TextView
    private lateinit var openComposeButton: View
    private lateinit var openSettingsFromProfileButton: View
    private lateinit var openCommunityListButton: View
    private lateinit var composeSubmitButton: MaterialButton
    private lateinit var composeBodyInput: EditText
    private lateinit var composeCategoryInput: EditText
    private lateinit var composePublishSwitch: SwitchMaterial
    private lateinit var composeImageButton: TextView
    private lateinit var composeImageCountText: TextView
    private lateinit var composeStatusText: TextView
    private lateinit var profileAvatarImage: ImageView
    private lateinit var profileDisplayNameText: TextView
    private lateinit var profileEmailText: TextView
    private lateinit var profileLogoutButton: TextView
    private lateinit var communityRecycler: RecyclerView
    private lateinit var communityStateText: TextView
    private lateinit var communitySearchInput: EditText

    private lateinit var tabFeedButton: MaterialButton
    private lateinit var tabCommunityButton: MaterialButton
    private lateinit var tabProfileButton: MaterialButton
    private lateinit var composeFab: View
    private lateinit var feedAdapter: FeedAdapter
    private lateinit var communityAdapter: CommunityAdapter

    private var selectedTab: AppDestination = AppDestination.Feed
    private var currentFeedItems: List<FeedItem> = emptyList()
    private var filteredFeedItems: List<FeedItem> = emptyList()
    private var hasMoreFeedItems: Boolean = false
    private var nextFeedCursor: String? = null
    private var isLoadingNextPage = false
    private var selectedFeedSort: FeedSort = FeedSort.RECENT
    private var feedQuery: String = ""

    private var currentCommunities: List<CommunityItem> = emptyList()
    private var filteredCommunities: List<CommunityItem> = emptyList()
    private var communityNextCursor: String? = null
    private var communityNextCursorId: String? = null
    private var hasMoreCommunities: Boolean = false
    private var isCommunityLoading = false
    private var communityQuery: String = ""
    private val selectedComposeImageUris: MutableList<Uri> = mutableListOf()
    private var feedLoadStartedAtMs: Long? = null
    private var communityLoadStartedAtMs: Long? = null
    private var profileLastSyncedAtMs: Long = 0L
    private var loginFlowInProgress = false
    private var isBottomNavVisible = true

    private val loginLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        loginFlowInProgress = false
        if (result.resultCode == RESULT_OK) {
            lifecycleScope.launch {
                bootstrapCoordinator.bootstrap()
                onShellStateChanged(bootstrapCoordinator.shellState())
                refreshFeed(isExplicit = true)
                loadCommunities(reset = true)
            }
        } else {
            finish()
        }
    }

    private val openSettingsLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { _ ->
        lifecycleScope.launch {
            bootstrapCoordinator.bootstrap()
            onShellStateChanged(bootstrapCoordinator.shellState())
            refreshFeed(isExplicit = true)
            loadCommunities(reset = true)
        }
    }

    private val composeImagePickerLauncher =
        registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
            if (uris.isNullOrEmpty()) return@registerForActivityResult
            val beforeCount = selectedComposeImageUris.size
            val merged = (selectedComposeImageUris + uris)
                .distinctBy { it.toString() }
                .take(10)
            selectedComposeImageUris.clear()
            selectedComposeImageUris.addAll(merged)
            if (beforeCount + uris.size > 10) {
                Toast.makeText(this, "이미지는 최대 10장까지 가능합니다.", Toast.LENGTH_SHORT).show()
            }
            syncComposeImageCount()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        AppThemePreferenceStore.apply(AppThemePreferenceStore.read(this))
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        bindViews()
        setupInsets()
        setupHeader()
        setupFeedRecycler()
        setupCommunityRecycler()
        setupInteractions()
        switchTab(AppDestination.Feed)
        syncFeedSortButtons()
        setupShellObservers()
        lifecycleScope.launch {
            ensureAuthenticatedEntry()
        }
    }

    override fun onResume() {
        super.onResume()
        AppThemePreferenceStore.apply(AppThemePreferenceStore.read(this))
        lifecycleScope.launch {
            ensureAuthenticatedEntry()
            bootstrapCoordinator.bootstrap()
            onShellStateChanged(bootstrapCoordinator.shellState())
            if (currentFeedItems.isEmpty()) {
                refreshFeed(isExplicit = true)
            }
            if (currentCommunities.isEmpty()) {
                loadCommunities(reset = true)
            }
        }
    }

    private fun bindViews() {
        mainRoot = findViewById(R.id.mainRoot)
        statusBarSpacer = findViewById(R.id.statusBarSpacer)
        bottomNavHost = findViewById(R.id.bottomNavHost)
        bottomNav = findViewById(R.id.bottomNav)
        headerLogoImage = findViewById(R.id.headerLogoImage)
        quickComposeAvatar = findViewById(R.id.quickComposeAvatar)
        quickComposeCard = findViewById(R.id.quickComposeCard)
        topSettingsButton = findViewById(R.id.openSettingsButton)
        authStatusText = findViewById(R.id.authStatusText)
        feedStateText = findViewById(R.id.feedStateText)
        feedSwipeRefresh = findViewById(R.id.feedSwipeRefresh)
        feedRecycler = findViewById(R.id.feedRecycler)
        feedSearchInput = findViewById(R.id.feedSearchInput)
        sortRecentButton = findViewById(R.id.feedSortRecentButton)
        sortHotButton = findViewById(R.id.feedSortHotButton)
        sortTopButton = findViewById(R.id.feedSortTopButton)
        feedPanel = findViewById(R.id.feedPanel)
        communityPanel = findViewById(R.id.communityPanel)
        composePanel = findViewById(R.id.composePanel)
        profilePanel = findViewById(R.id.profilePanel)
        profileSummaryText = findViewById(R.id.profileSummaryText)
        openComposeButton = findViewById(R.id.openComposePlaceholderButton)
        openSettingsFromProfileButton = findViewById(R.id.openSettingsFromProfileButton)
        openCommunityListButton = findViewById(R.id.openCommunityListButton)
        composeSubmitButton = findViewById(R.id.composeSubmitButton)
        composeBodyInput = findViewById(R.id.composeBodyInput)
        composeCategoryInput = findViewById(R.id.composeCategoryInput)
        composePublishSwitch = findViewById(R.id.composePublishSwitch)
        composeImageButton = findViewById(R.id.composeImageButton)
        composeImageCountText = findViewById(R.id.composeImageCountText)
        composeStatusText = findViewById(R.id.composeStatusText)
        profileAvatarImage = findViewById(R.id.profileAvatarImage)
        profileDisplayNameText = findViewById(R.id.profileDisplayNameText)
        profileEmailText = findViewById(R.id.profileEmailText)
        profileLogoutButton = findViewById(R.id.profileLogoutButton)
        communityRecycler = findViewById(R.id.communityRecycler)
        communityStateText = findViewById(R.id.communityStateText)
        communitySearchInput = findViewById(R.id.communitySearchInput)

        tabFeedButton = findViewById(R.id.tabFeedButton)
        tabCommunityButton = findViewById(R.id.tabCommunityButton)
        tabProfileButton = findViewById(R.id.tabProfileButton)
        composeFab = findViewById(R.id.composeFab)
        syncComposeImageCount()
    }

    private fun setupInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(mainRoot) { _, insets ->
            val statusInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars())
            val navInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            statusBarSpacer.layoutParams = statusBarSpacer.layoutParams.apply {
                height = statusInsets.top
            }
            bottomNavHost.setPadding(
                bottomNavHost.paddingLeft,
                bottomNavHost.paddingTop,
                bottomNavHost.paddingRight,
                navInsets.bottom,
            )
            insets
        }
    }

    private fun setupHeader() {
        headerLogoImage.load("file:///android_asset/logo.svg") {
            decoderFactory(SvgDecoder.Factory())
            crossfade(true)
            memoryCachePolicy(CachePolicy.ENABLED)
            diskCachePolicy(CachePolicy.ENABLED)
        }
    }

    private fun setupFeedRecycler() {
        feedAdapter = FeedAdapter(
            onItemClick = { item -> openFeedDetail(item) },
            onLikeClick = { item -> toggleLike(item) },
            onCommentClick = { item -> openComments(item) },
        )
        feedAdapter.onShareClick = { item -> shareFeedItem(item) }

        feedRecycler.layoutManager = LinearLayoutManager(this).also {
            it.orientation = RecyclerView.VERTICAL
            feedRecycler.setHasFixedSize(true)
        }
        feedRecycler.setItemViewCacheSize(24)
        feedRecycler.itemAnimator = null
        feedRecycler.adapter = feedAdapter
        feedRecycler.addOnScrollListener(
            object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    super.onScrolled(recyclerView, dx, dy)
                    if (dy > 4) {
                        setBottomNavVisible(false)
                    } else if (dy < -4) {
                        setBottomNavVisible(true)
                    }
                    if (dy <= 0 || isLoadingNextPage || !hasMoreFeedItems) return
                    val manager = recyclerView.layoutManager as? LinearLayoutManager ?: return
                    val lastVisiblePosition = manager.findLastVisibleItemPosition()
                    val totalItems = manager.itemCount
                    if (lastVisiblePosition >= totalItems - 5) {
                        loadNextFeedPage()
                    }
                }
            },
        )
    }

    private fun setupCommunityRecycler() {
        communityAdapter = CommunityAdapter(
            onItemClick = { community ->
                startActivity(
                    CommunityDetailActivity.intent(
                        context = this,
                        communitySlug = community.slug,
                        communityName = community.name,
                    ),
                )
            },
            onJoinToggleClick = { community ->
                toggleCommunityMembership(community)
            },
        )
        communityRecycler.layoutManager = LinearLayoutManager(this)
        communityRecycler.itemAnimator = null
        communityRecycler.adapter = communityAdapter
        communityRecycler.addOnScrollListener(
            object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    super.onScrolled(recyclerView, dx, dy)
                    if (dy > 4) {
                        setBottomNavVisible(false)
                    } else if (dy < -4) {
                        setBottomNavVisible(true)
                    }
                    if (dy <= 0 || !hasMoreCommunities || isCommunityLoading) return
                    val manager = recyclerView.layoutManager as? LinearLayoutManager ?: return
                    val lastVisible = manager.findLastVisibleItemPosition()
                    if (lastVisible >= manager.itemCount - 4) {
                        loadCommunities(reset = false)
                    }
                }
            },
        )
    }

    private fun setupInteractions() {
        tabFeedButton.setOnClickListener { switchTab(AppDestination.Feed) }
        tabCommunityButton.setOnClickListener { switchTab(AppDestination.Community) }
        tabProfileButton.setOnClickListener { switchTab(AppDestination.Profile) }
        composeFab.setOnClickListener {
            openQuickComposeSheet()
        }

        topSettingsButton.setOnClickListener {
            openSettingsLauncher.launch(Intent(this, SettingsActivity::class.java))
        }
        quickComposeCard.setOnClickListener {
            openQuickComposeSheet()
        }
        openComposeButton.setOnClickListener {
            openQuickComposeSheet()
        }
        openCommunityListButton.setOnClickListener {
            switchTab(AppDestination.Community)
        }
        openSettingsFromProfileButton.setOnClickListener {
            openSettingsLauncher.launch(Intent(this, SettingsActivity::class.java))
        }
        profileLogoutButton.setOnClickListener {
            lifecycleScope.launch {
                authSessionManager.logout()
                bootstrapCoordinator.bootstrap()
                onShellStateChanged(bootstrapCoordinator.shellState())
                Toast.makeText(this@MainActivity, getString(R.string.logout_button), Toast.LENGTH_SHORT).show()
                launchLogin()
            }
        }

        sortRecentButton.setOnClickListener { selectFeedSort(FeedSort.RECENT) }
        sortHotButton.setOnClickListener { selectFeedSort(FeedSort.HOT) }
        sortTopButton.setOnClickListener { selectFeedSort(FeedSort.TOP) }
        feedSwipeRefresh.setOnRefreshListener { refreshFeed(isExplicit = true) }

        feedSearchInput.doOnTextChanged { text, _, _, _ ->
            feedQuery = text?.toString().orEmpty().trim()
            applyFeedFilter()
        }
        communitySearchInput.doOnTextChanged { text, _, _, _ ->
            communityQuery = text?.toString().orEmpty().trim()
            applyCommunityFilter()
        }

        composeSubmitButton.setOnClickListener {
            submitCompose()
        }
        composeImageButton.setOnClickListener {
            composeImagePickerLauncher.launch("image/*")
        }
        composeImageCountText.setOnClickListener {
            if (selectedComposeImageUris.isNotEmpty()) {
                selectedComposeImageUris.clear()
                syncComposeImageCount()
                Toast.makeText(this, "선택한 이미지를 초기화했습니다.", Toast.LENGTH_SHORT).show()
            }
        }
        composeBodyInput.doOnTextChanged { text, _, _, _ ->
            val ready = !text.isNullOrBlank()
            composeSubmitButton.isEnabled = ready
            composeSubmitButton.setTextColor(
                if (ready) getColor(R.color.myblog_text_primary) else getColor(R.color.myblog_text_secondary),
            )
        }
    }

    private fun setupShellObservers() {
        lifecycleScope.launch {
            feedCoordinator.state.collect { state ->
                when (state) {
                    FeedState.Loading -> {
                        if (!isLoadingNextPage && !feedSwipeRefresh.isRefreshing) {
                            feedSwipeRefresh.isRefreshing = true
                        }
                        feedStateText.isVisible = false
                    }

                    FeedState.Empty -> {
                        feedSwipeRefresh.isRefreshing = false
                        isLoadingNextPage = false
                        hasMoreFeedItems = false
                        nextFeedCursor = null
                        currentFeedItems = emptyList()
                        applyFeedFilter()
                        feedStateText.isVisible = true
                        feedStateText.text = getString(R.string.feed_state_empty)
                        feedStateText.setTextColor(getColor(R.color.myblog_text_secondary))
                    }

                is FeedState.Ready -> {
                    isLoadingNextPage = false
                    feedSwipeRefresh.isRefreshing = false
                    val page = state.page
                    currentFeedItems = page.items
                        nextFeedCursor = page.nextCursor
                        hasMoreFeedItems = page.hasMore && !page.nextCursor.isNullOrBlank()
                        applyFeedFilter()
                        feedStateText.isVisible = page.items.isEmpty()
                        feedStateText.setTextColor(getColor(R.color.myblog_text_secondary))
                    if (page.items.isEmpty()) {
                        feedStateText.text = getString(R.string.feed_state_empty)
                    } else {
                        feedLoadStartedAtMs?.let { startedAt ->
                            val elapsed = SystemClock.elapsedRealtime() - startedAt
                            Log.i("UXTrace", "feed.firstPaintMs=$elapsed items=${page.items.size} sort=${selectedFeedSort.name.lowercase()}")
                            feedLoadStartedAtMs = null
                        }
                    }
                }

                    is FeedState.Error -> {
                        isLoadingNextPage = false
                        feedSwipeRefresh.isRefreshing = false
                        feedStateText.isVisible = true
                        feedStateText.text = getString(R.string.feed_state_error)
                        feedStateText.setTextColor(getColor(R.color.myblog_error))
                        Toast.makeText(this@MainActivity, state.message, Toast.LENGTH_SHORT).show()
                    }

                    is FeedState.Offline -> {
                        isLoadingNextPage = false
                        feedSwipeRefresh.isRefreshing = false
                        feedStateText.isVisible = true
                        feedStateText.text = state.message
                    }
                }
            }
        }
    }

    private fun onShellStateChanged(shellState: AppShellState) {
        val session = (shellState as? AppShellState.Main)?.authState?.session
        when (shellState) {
            AppShellState.Booting -> {
                authStatusText.text = getString(R.string.feed_state_loading)
                profileSummaryText.text = getString(R.string.profile_unknown_user)
                profileDisplayNameText.text = getString(R.string.profile_unknown_user)
                profileEmailText.text = "-"
            }

            is AppShellState.LoginRequired -> {
                authStatusText.text = getString(R.string.feed_auth_needed)
                profileSummaryText.text = getString(R.string.profile_unknown_user)
                profileDisplayNameText.text = getString(R.string.profile_unknown_user)
                profileEmailText.text = "-"
                launchLogin()
            }

            is AppShellState.Main -> {
                val displayName = session?.displayName
                    ?.takeIf { it.isNotBlank() }
                    ?: session?.username?.takeIf { it.isNotBlank() }
                    ?: session?.email?.substringBefore("@")?.takeIf { it.isNotBlank() }
                    ?: getString(R.string.profile_unknown_user)
                authStatusText.text = getString(R.string.feed_auth_needed)
                profileSummaryText.text = displayName
                profileDisplayNameText.text = displayName
                val email = session?.email.orEmpty().ifBlank { "-" }
                val usernameLine = session?.username
                    ?.takeIf { it.isNotBlank() }
                    ?.let { "@$it" }
                    .orEmpty()
                profileEmailText.text = if (usernameLine.isBlank()) {
                    email
                } else {
                    "$email\n$usernameLine"
                }
            }
        }
        val avatarSource: Any = session?.profileImageUrl ?: R.drawable.myblog_avatar_placeholder
        quickComposeAvatar.load(avatarSource) {
            placeholder(R.drawable.myblog_avatar_placeholder)
            error(R.drawable.myblog_avatar_placeholder)
            crossfade(true)
            memoryCachePolicy(CachePolicy.ENABLED)
            diskCachePolicy(CachePolicy.ENABLED)
        }
        profileAvatarImage.load(avatarSource) {
            placeholder(R.drawable.myblog_avatar_placeholder)
            error(R.drawable.myblog_avatar_placeholder)
            crossfade(true)
            memoryCachePolicy(CachePolicy.ENABLED)
            diskCachePolicy(CachePolicy.ENABLED)
        }
    }

    private fun refreshFeed(isExplicit: Boolean) {
        lifecycleScope.launch {
            if (!isExplicit && currentFeedItems.isNotEmpty()) return@launch
            feedLoadStartedAtMs = SystemClock.elapsedRealtime()
            if (!isExplicit) {
                isLoadingNextPage = true
            } else {
                feedSwipeRefresh.isRefreshing = true
            }
            feedCoordinator.refresh()
        }
    }

    private suspend fun ensureAuthenticatedEntry() {
        if (hasAccessToken()) return
        launchLogin()
    }

    private suspend fun hasAccessToken(): Boolean {
        return AppRuntime.di.tokenStore().readAccessToken()?.isNotBlank() == true
    }

    private fun launchLogin() {
        if (loginFlowInProgress) return
        loginFlowInProgress = true
        loginLauncher.launch(LoginActivity.intent(this))
    }

    private fun loadNextFeedPage() {
        if (!hasMoreFeedItems || isLoadingNextPage || nextFeedCursor.isNullOrBlank()) return
        isLoadingNextPage = true
        lifecycleScope.launch {
            feedCoordinator.loadNextPage()
        }
    }

    private fun switchTab(destination: AppDestination) {
        selectedTab = destination
        feedPanel.isVisible = destination == AppDestination.Feed
        communityPanel.isVisible = destination == AppDestination.Community
        composePanel.isVisible = destination == AppDestination.Compose
        profilePanel.isVisible = destination == AppDestination.Profile
        findViewById<View>(R.id.feedHeaderContainer).isVisible = destination == AppDestination.Feed
        updateTabButtonState(tabFeedButton, destination == AppDestination.Feed)
        updateTabButtonState(tabCommunityButton, destination == AppDestination.Community)
        updateTabButtonState(tabProfileButton, destination == AppDestination.Profile)
        syncFeedSortButtons()
        setBottomNavVisible(true)

        if (destination == AppDestination.Community && currentCommunities.isEmpty()) {
            loadCommunities(reset = true)
        }
        if (destination == AppDestination.Profile) {
            refreshProfileSnapshot()
        }
    }

    private fun refreshProfileSnapshot() {
        val now = SystemClock.elapsedRealtime()
        if (now - profileLastSyncedAtMs < 15_000L) return
        profileLastSyncedAtMs = now
        lifecycleScope.launch {
            bootstrapCoordinator.bootstrap()
            onShellStateChanged(bootstrapCoordinator.shellState())
        }
    }

    private fun updateTabButtonState(button: MaterialButton, selected: Boolean) {
        button.iconTint = ColorStateList.valueOf(
            if (selected) {
                getColor(R.color.myblog_text_primary)
            } else {
                getColor(R.color.myblog_text_secondary)
            },
        )
        button.setBackgroundResource(
            if (selected) {
                R.drawable.bg_tab_item_selected
            } else {
                android.R.color.transparent
            },
        )
    }

    private fun setBottomNavVisible(visible: Boolean) {
        if (isBottomNavVisible == visible) return
        isBottomNavVisible = visible
        val hiddenTranslation = bottomNav.height.toFloat() + dpToPx(12f)
        bottomNav.animate().cancel()
        bottomNav.animate()
            .translationY(if (visible) 0f else hiddenTranslation)
            .setDuration(if (visible) 170L else 90L)
            .start()
        composeFab.animate().cancel()
        composeFab.animate()
            .translationY(if (visible) 0f else -dpToPx(2f))
            .setDuration(if (visible) 190L else 120L)
            .start()
    }

    private fun dpToPx(dp: Float): Float = dp * resources.displayMetrics.density

    private fun openFeedDetail(item: FeedItem) {
        startActivity(
            PostDetailActivity.intent(
                context = this,
                postId = item.postId,
                postSlug = item.slug.ifBlank { null },
                sourceType = item.sourceType,
                communitySlug = item.communitySlug,
            ),
        )
    }

    private fun openComments(item: FeedItem) {
        openFeedDetail(item)
    }

    private fun shareFeedItem(item: FeedItem) {
        val webBaseUrl = AppRuntime.BASE_URL.substringBefore("/api/v1")
        val postId = item.slug.ifBlank { item.postId }
        val shareUri = when (item.sourceType.lowercase()) {
            "community" -> {
                val slug = item.communitySlug?.trim().orEmpty()
                if (slug.isNotBlank()) "$webBaseUrl/c/$slug/comments/$postId" else "$webBaseUrl/p/$postId"
            }

            else -> "$webBaseUrl/p/$postId"
        }
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, shareUri)
        }
        startActivity(Intent.createChooser(shareIntent, getString(R.string.feed_share_chooser)))
    }

    private fun selectFeedSort(sort: FeedSort) {
        if (selectedFeedSort == sort) return
        selectedFeedSort = sort
        feedCoordinator.setSort(sort)
        syncFeedSortButtons()
        if (selectedTab == AppDestination.Feed) {
            refreshFeed(isExplicit = true)
        }
    }

    private fun syncFeedSortButtons() {
        updateSortButtonState(sortRecentButton, selectedFeedSort == FeedSort.RECENT)
        updateSortButtonState(sortHotButton, selectedFeedSort == FeedSort.HOT)
        updateSortButtonState(sortTopButton, selectedFeedSort == FeedSort.TOP)
    }

    private fun updateSortButtonState(button: Button, selected: Boolean) {
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

    private fun applyFeedFilter() {
        filteredFeedItems = if (feedQuery.isBlank()) {
            currentFeedItems
        } else {
            val query = feedQuery.lowercase()
            currentFeedItems.filter { item ->
                item.title.lowercase().contains(query) ||
                    item.excerpt.lowercase().contains(query) ||
                    item.authorName.lowercase().contains(query)
            }
        }
        feedAdapter.submitFeedItems(filteredFeedItems, timeFormatter)
        feedStateText.isVisible = filteredFeedItems.isEmpty() && currentFeedItems.isNotEmpty()
        if (feedStateText.isVisible) {
            feedStateText.text = getString(R.string.feed_state_empty)
        }
    }

    private fun updateFeedItem(postId: String, transform: (FeedItem) -> FeedItem) {
        currentFeedItems = currentFeedItems.map { item ->
            if (item.postId == postId) transform(item) else item
        }
        applyFeedFilter()
    }

    private fun toggleLike(item: FeedItem) {
        val previous = currentFeedItems.firstOrNull { it.postId == item.postId } ?: return
        val optimisticLiked = !previous.liked
        val optimisticCount = if (optimisticLiked) previous.likeCount + 1 else (previous.likeCount - 1).coerceAtLeast(0)
        updateFeedItem(item.postId) { it.copy(liked = optimisticLiked, likeCount = optimisticCount) }

        lifecycleScope.launch {
            when (val result = feedRepository.togglePostLike(
                postId = item.postId,
                sourceType = item.sourceType,
                communitySlug = item.communitySlug,
            )) {
                is ApiResult.Success -> {
                    val resolvedCount = result.data.likeCount ?: optimisticCount
                    updateFeedItem(item.postId) {
                        it.copy(
                            liked = result.data.liked,
                            likeCount = resolvedCount,
                        )
                    }
                }

                is ApiResult.Failure -> {
                    updateFeedItem(item.postId) { previous }
                    Toast.makeText(this@MainActivity, getString(R.string.feed_like_failed, result.message), Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun loadCommunities(reset: Boolean) {
        lifecycleScope.launch {
            if (isCommunityLoading) return@launch
            isCommunityLoading = true
            if (reset) {
                communityLoadStartedAtMs = SystemClock.elapsedRealtime()
                currentCommunities = emptyList()
                filteredCommunities = emptyList()
                communityNextCursor = null
                communityNextCursorId = null
                hasMoreCommunities = false
                communityAdapter.submitList(emptyList())
                communityStateText.isVisible = true
                communityStateText.text = getString(R.string.feed_state_loading)
            }
            when (val result = feedRepository.fetchCommunities(
                cursor = if (reset) null else communityNextCursor,
                cursorId = if (reset) null else communityNextCursorId,
                limit = 20,
            )) {
                is ApiResult.Failure -> {
                    communityStateText.isVisible = true
                    communityStateText.text = result.message
                }

                is ApiResult.Success -> {
                    currentCommunities = if (reset) {
                        result.data.items
                    } else {
                        currentCommunities + result.data.items
                    }
                    hasMoreCommunities = result.data.hasMore
                    communityNextCursor = result.data.nextCursor
                    communityNextCursorId = result.data.nextCursorId
                    applyCommunityFilter()
                    if (reset && result.data.items.isNotEmpty()) {
                        communityLoadStartedAtMs?.let { startedAt ->
                            val elapsed = SystemClock.elapsedRealtime() - startedAt
                            Log.i("UXTrace", "community.firstPaintMs=$elapsed items=${result.data.items.size}")
                            communityLoadStartedAtMs = null
                        }
                    }
                }
            }
            isCommunityLoading = false
        }
    }

    private fun applyCommunityFilter() {
        filteredCommunities = if (communityQuery.isBlank()) {
            currentCommunities
        } else {
            val query = communityQuery.lowercase()
            currentCommunities.filter { item ->
                item.name.lowercase().contains(query) || item.slug.lowercase().contains(query)
            }
        }
        communityAdapter.submitList(filteredCommunities)
        communityStateText.isVisible = filteredCommunities.isEmpty()
        if (filteredCommunities.isEmpty()) {
            communityStateText.text = getString(R.string.feed_state_empty)
        }
    }

    private fun toggleCommunityMembership(item: CommunityItem) {
        val previous = currentCommunities
        currentCommunities = currentCommunities.map { community ->
            if (community.communityId == item.communityId) {
                community.copy(joined = !community.joined)
            } else {
                community
            }
        }
        applyCommunityFilter()

        lifecycleScope.launch {
            when (val result = feedRepository.toggleCommunityMembership(item.slug, item.joined)) {
                is ApiResult.Success -> {
                    currentCommunities = currentCommunities.map { community ->
                        if (community.communityId == item.communityId) {
                            community.copy(joined = result.data)
                        } else {
                            community
                        }
                    }
                    applyCommunityFilter()
                }

                is ApiResult.Failure -> {
                    currentCommunities = previous
                    applyCommunityFilter()
                    Toast.makeText(this@MainActivity, result.message, Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun submitCompose() {
        val content = composeBodyInput.text?.toString().orEmpty().trim()
        val category = composeCategoryInput.text?.toString().orEmpty().trim().ifBlank { "general" }
        if (content.isBlank()) {
            composeStatusText.text = getString(R.string.login_status_missing_fields)
            return
        }

        composeSubmitButton.isEnabled = false
        composeStatusText.text = getString(R.string.feed_state_loading)
        lifecycleScope.launch {
            val imageUploads = buildComposeImageUploads()
            if (selectedComposeImageUris.isNotEmpty() && imageUploads.isEmpty()) {
                composeStatusText.text = "선택한 이미지를 처리하지 못했습니다."
                composeSubmitButton.isEnabled = true
                return@launch
            }
            val (uploadedImages, failedUploads) = when {
                imageUploads.isEmpty() -> Pair(emptyList(), 0)
                else -> uploadComposeImagesWithRetry(imageUploads)
            }
            if (imageUploads.isNotEmpty() && uploadedImages.isEmpty()) {
                composeStatusText.text = getString(R.string.compose_upload_failed)
                composeSubmitButton.isEnabled = true
                return@launch
            }
            if (failedUploads > 0) {
                Toast.makeText(
                    this@MainActivity,
                    getString(R.string.compose_upload_partial_success, failedUploads),
                    Toast.LENGTH_LONG,
                ).show()
            }

            when (val result = feedRepository.createPost(
                ComposeRequest(
                    content = content,
                    category = category,
                    publishNow = composePublishSwitch.isChecked,
                    attachedFileIds = uploadedImages.mapNotNull { it.fileId },
                    imageUrls = uploadedImages.map { it.url }.distinct(),
                ),
            )) {
                is ApiResult.Failure -> {
                    composeStatusText.text = result.message
                    composeSubmitButton.isEnabled = true
                }

                is ApiResult.Success -> {
                    composeStatusText.text = if (failedUploads > 0) {
                        getString(R.string.compose_upload_partial_success, failedUploads)
                    } else {
                        "게시 완료"
                    }
                    composeBodyInput.setText("")
                    selectedComposeImageUris.clear()
                    syncComposeImageCount()
                    val detail = result.data
                    val newItem = FeedItem(
                        postId = detail.postId,
                        slug = detail.slug,
                        title = detail.title.ifBlank { detail.contentText.take(60) },
                        excerpt = detail.contentText,
                        authorName = detail.authorName,
                        authorProfileImage = detail.authorProfileImage,
                        sourceType = detail.sourceType,
                        blogSlug = null,
                        blogAlias = null,
                        communitySlug = detail.communitySlug,
                        likeCount = detail.likeCount,
                        commentCount = detail.commentCount,
                        viewCount = detail.viewCount,
                        upvoteCount = detail.likeCount,
                        downvoteCount = 0,
                        score = detail.likeCount,
                        liked = detail.liked,
                        userVote = if (detail.liked) "upvote" else null,
                        thumbnail = detail.images.firstOrNull(),
                        images = detail.images,
                        createdAtEpochSeconds = detail.createdAtEpochSeconds,
                    )
                    currentFeedItems = listOf(newItem) + currentFeedItems
                    applyFeedFilter()
                    switchTab(AppDestination.Feed)
                    composeSubmitButton.isEnabled = true
                }
            }
        }
    }

    private fun openQuickComposeSheet() {
        lifecycleScope.launch {
            if (!hasAccessToken()) {
                launchLogin()
                return@launch
            }
            val sheet = BottomSheetDialog(this@MainActivity).apply {
                setContentView(R.layout.bottom_sheet_quick_compose)
                setCanceledOnTouchOutside(true)
            }
            val avatarView = sheet.findViewById<ImageView>(R.id.sheetComposeAvatar)
            val nameView = sheet.findViewById<TextView>(R.id.sheetComposeName)
            val inputView = sheet.findViewById<EditText>(R.id.sheetComposeInput)
            val cancelView = sheet.findViewById<TextView>(R.id.sheetComposeCancel)
            val submitView = sheet.findViewById<MaterialButton>(R.id.sheetComposeSubmit)
            val statusView = sheet.findViewById<TextView>(R.id.sheetComposeStatus)

            val session = (bootstrapCoordinator.shellState() as? AppShellState.Main)?.authState?.session
            val displayName = session?.displayName
                ?.takeIf { it.isNotBlank() }
                ?: session?.username?.takeIf { it.isNotBlank() }
                ?: session?.email?.substringBefore("@")?.takeIf { it.isNotBlank() }
                ?: getString(R.string.profile_unknown_user)
            val avatarSource: Any = session?.profileImageUrl ?: R.drawable.myblog_avatar_placeholder
            avatarView?.load(avatarSource) {
                placeholder(R.drawable.myblog_avatar_placeholder)
                error(R.drawable.myblog_avatar_placeholder)
                crossfade(true)
                memoryCachePolicy(CachePolicy.ENABLED)
                diskCachePolicy(CachePolicy.ENABLED)
            }
            nameView?.text = displayName
            submitView?.isEnabled = false
            inputView?.doOnTextChanged { text, _, _, _ ->
                submitView?.isEnabled = !text.isNullOrBlank()
            }
            cancelView?.setOnClickListener { sheet.dismiss() }
            submitView?.setOnClickListener {
                val content = inputView?.text?.toString().orEmpty().trim()
                if (content.isBlank()) return@setOnClickListener
                submitView.isEnabled = false
                statusView?.isVisible = true
                statusView?.text = getString(R.string.feed_state_loading)
                lifecycleScope.launch {
                    when (val result = feedRepository.createPost(
                        ComposeRequest(
                            content = content,
                            category = "general",
                            publishNow = true,
                            attachedFileIds = emptyList(),
                            imageUrls = emptyList(),
                        ),
                    )) {
                        is ApiResult.Failure -> {
                            statusView?.text = result.message
                            submitView.isEnabled = true
                        }

                        is ApiResult.Success -> {
                            val detail = result.data
                            val newItem = FeedItem(
                                postId = detail.postId,
                                slug = detail.slug,
                                title = detail.title.ifBlank { detail.contentText.take(60) },
                                excerpt = detail.contentText,
                                authorName = detail.authorName,
                                authorProfileImage = detail.authorProfileImage,
                                sourceType = detail.sourceType,
                                blogSlug = null,
                                blogAlias = null,
                                communitySlug = detail.communitySlug,
                                likeCount = detail.likeCount,
                                commentCount = detail.commentCount,
                                viewCount = detail.viewCount,
                                upvoteCount = detail.likeCount,
                                downvoteCount = 0,
                                score = detail.likeCount,
                                liked = detail.liked,
                                userVote = if (detail.liked) "upvote" else null,
                                thumbnail = detail.images.firstOrNull(),
                                images = detail.images,
                                createdAtEpochSeconds = detail.createdAtEpochSeconds,
                            )
                            currentFeedItems = listOf(newItem) + currentFeedItems
                            applyFeedFilter()
                            switchTab(AppDestination.Feed)
                            sheet.dismiss()
                        }
                    }
                }
            }
            sheet.show()
        }
    }

    private suspend fun uploadComposeImagesWithRetry(
        imageUploads: List<ComposeImageUpload>,
        maxAttempts: Int = 2,
    ): Pair<List<UploadedComposeImage>, Int> {
        val uploaded = mutableListOf<UploadedComposeImage>()
        var failedCount = 0

        imageUploads.forEachIndexed { index, image ->
            var success: UploadedComposeImage? = null
            for (attempt in 1..maxAttempts) {
                composeStatusText.text = "이미지 업로드 중... (${index + 1}/${imageUploads.size})"
                when (val uploadResult = feedRepository.uploadComposeImage(image)) {
                    is ApiResult.Success -> {
                        success = uploadResult.data
                        break
                    }

                    is ApiResult.Failure -> {
                        if (attempt == maxAttempts) {
                            failedCount += 1
                        }
                    }
                }
            }
            if (success != null) {
                uploaded += success!!
            }
        }
        return uploaded to failedCount
    }

    private fun syncComposeImageCount() {
        composeImageCountText.text = "${selectedComposeImageUris.size}/10"
    }

    private fun buildComposeImageUploads(): List<ComposeImageUpload> {
        return selectedComposeImageUris.mapNotNull { uri ->
            val bytes = toWebpBytes(uri) ?: return@mapNotNull null
            val fileName = resolveDisplayName(uri).ifBlank {
                "compose_${System.currentTimeMillis()}.webp"
            }.substringBeforeLast(".") + ".webp"
            ComposeImageUpload(
                fileName = fileName,
                mimeType = "image/webp",
                bytes = bytes,
            )
        }
    }

    private fun resolveDisplayName(uri: Uri): String {
        val projection = arrayOf(OpenableColumns.DISPLAY_NAME)
        return runCatching {
            contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0 && cursor.moveToFirst()) {
                    cursor.getString(index).orEmpty()
                } else {
                    ""
                }
            }.orEmpty()
        }.getOrDefault("")
    }

    private fun toWebpBytes(uri: Uri): ByteArray? {
        val original = runCatching {
            contentResolver.openInputStream(uri)?.use { input ->
                input.readBytes()
            }
        }.getOrNull() ?: return null

        val mimeType = contentResolver.getType(uri).orEmpty()
        if (mimeType == "image/webp") {
            return original
        }

        val bitmap = BitmapFactory.decodeByteArray(original, 0, original.size) ?: return null
        val output = ByteArrayOutputStream()
        val compressed = bitmap.compress(Bitmap.CompressFormat.WEBP, 88, output)
        if (!compressed) {
            return null
        }
        return output.toByteArray()
    }
}

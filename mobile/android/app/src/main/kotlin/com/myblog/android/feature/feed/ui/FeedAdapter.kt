package com.myblog.android.feature.feed.ui

import android.content.res.ColorStateList
import android.graphics.drawable.ColorDrawable
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.request.CachePolicy
import com.myblog.android.R
import com.myblog.android.feature.feed.model.FeedItem
import com.myblog.android.feature.feed.time.RelativeTimeFormatter
import com.myblog.android.core.time.SystemClockProvider

class FeedAdapter(
    private val onItemClick: (FeedItem) -> Unit,
    private val onLikeClick: (FeedItem) -> Unit,
    private val onCommentClick: (FeedItem) -> Unit,
) : ListAdapter<FeedAdapter.FeedUiItem, FeedAdapter.FeedViewHolder>(FeedDiffCallback()) {
    var onShareClick: ((FeedItem) -> Unit)? = null

    private val fallbackFormatter = RelativeTimeFormatter(SystemClockProvider)
    private val fallbackPrimary = "(내용 없음)"

    private var formatter: RelativeTimeFormatter = fallbackFormatter
    private val markdownLinkPattern = Regex("\\[[^\\]]+\\]\\([^\\)]+\\)")
    private val markdownImagePattern = Regex("!\\[[^\\]]*\\]\\([^\\)]+\\)")
    private val bareUrlPattern = Regex("https?://\\S+")

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): FeedViewHolder {
        val itemView = LayoutInflater.from(parent.context).inflate(R.layout.item_feed_card, parent, false)
        return FeedViewHolder(itemView)
    }

    override fun onBindViewHolder(holder: FeedViewHolder, position: Int) {
        val item = getItem(position)
        holder.bind(item)
    }

    fun submitFeedItems(
        items: List<FeedItem>,
        formatter: RelativeTimeFormatter,
    ) {
        this.formatter = formatter
        submitList(items.map(::FeedUiItem))
    }

    inner class FeedViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val authorAvatar: ImageView = view.findViewById(R.id.feedAuthorAvatar)
        private val authorText: TextView = view.findViewById(R.id.feedAuthorText)
        private val metaText: TextView = view.findViewById(R.id.feedMetaText)
        private val overflowAction: ImageView = view.findViewById(R.id.feedOverflowAction)
        private val titleText: TextView = view.findViewById(R.id.feedTitleText)
        private val excerptText: TextView = view.findViewById(R.id.feedExcerptText)
        private val thumbnailImage: ImageView = view.findViewById(R.id.feedThumbnailImage)
        private val likeAction: LinearLayout = view.findViewById(R.id.feedLikeAction)
        private val commentAction: LinearLayout = view.findViewById(R.id.feedCommentAction)
        private val repostAction: LinearLayout = view.findViewById(R.id.feedRepostAction)
        private val shareAction: LinearLayout = view.findViewById(R.id.feedShareAction)
        private val likeIconImage: ImageView = view.findViewById(R.id.feedLikeIconImage)
        private val likeCountText: TextView = view.findViewById(R.id.feedLikeCountText)
        private val commentCountText: TextView = view.findViewById(R.id.feedCommentCountText)
        private val repostCountText: TextView = view.findViewById(R.id.feedRepostCountText)

        fun bind(uiItem: FeedUiItem) {
            val item = uiItem.item
            val canonicalTitle = sanitizeExcerpt(item.title)
            val canonicalExcerpt = sanitizeExcerpt(item.excerpt)
            val primaryText = canonicalTitle.ifBlank {
                canonicalExcerpt.ifBlank { fallbackPrimary }
            }
            val secondaryText = canonicalExcerpt.takeIf {
                it.isNotBlank() && !it.equals(primaryText, ignoreCase = false)
            }

            authorText.text = item.authorName.ifBlank { "Unknown" }
            titleText.text = primaryText
            excerptText.isVisible = !secondaryText.isNullOrBlank()
            excerptText.text = secondaryText.orEmpty()

            val relativeTime = formatter.formatFromEpochSeconds(item.createdAtEpochSeconds)
            metaText.text = relativeTime
            overflowAction.contentDescription = "$primaryText 더보기"

            val likeCount = uiItem.likeCount.coerceAtLeast(0)
            likeCountText.text = likeCount.toString()
            commentCountText.text = uiItem.commentCount.toString()
            repostCountText.text = "0"
            likeAction.contentDescription = "좋아요 ${likeCount}개"
            commentAction.contentDescription = "댓글 ${uiItem.commentCount}개"
            shareAction.contentDescription = "게시물 공유"

            if (uiItem.liked) {
                likeIconImage.setImageResource(R.drawable.ic_myblog_like_filled)
                likeIconImage.imageTintList = ColorStateList.valueOf(
                    ContextCompat.getColor(itemView.context, R.color.myblog_error),
                )
                likeCountText.setTextColor(ContextCompat.getColor(itemView.context, R.color.myblog_error))
            } else {
                likeIconImage.setImageResource(R.drawable.ic_myblog_like_outline)
                likeIconImage.imageTintList = ColorStateList.valueOf(
                    ContextCompat.getColor(itemView.context, R.color.myblog_icon_muted),
                )
                likeCountText.setTextColor(ContextCompat.getColor(itemView.context, R.color.myblog_text_secondary))
            }

            authorAvatar.load(item.authorProfileImage) {
                placeholder(R.drawable.myblog_avatar_placeholder)
                error(R.drawable.myblog_avatar_placeholder)
                crossfade(true)
                crossfade(180)
                memoryCachePolicy(CachePolicy.ENABLED)
                diskCachePolicy(CachePolicy.ENABLED)
            }

            likeAction.isEnabled = uiItem.likeCount >= 0
            commentAction.isEnabled = true
            repostAction.isEnabled = true

            val images = if (item.images.isEmpty()) {
                listOfNotNull(item.thumbnail)
            } else {
                item.images
            }
            val imageUrl = images.firstOrNull()
            thumbnailImage.isVisible = !imageUrl.isNullOrBlank()
            if (!imageUrl.isNullOrBlank()) {
                val targetHeightDp = if (images.size > 1) 210 else 280
                val imagePlaceholder = ColorDrawable(
                    ContextCompat.getColor(itemView.context, R.color.myblog_surface_variant),
                )
                thumbnailImage.layoutParams = thumbnailImage.layoutParams.apply {
                    height = dpToPx(targetHeightDp)
                }
                thumbnailImage.load(imageUrl) {
                    placeholder(imagePlaceholder)
                    error(R.drawable.myblog_avatar_placeholder)
                    crossfade(true)
                    crossfade(180)
                    memoryCachePolicy(CachePolicy.ENABLED)
                    diskCachePolicy(CachePolicy.ENABLED)
                }
            } else {
                thumbnailImage.setImageDrawable(null)
            }

            itemView.setOnClickListener { onItemClick(item) }
            titleText.setOnClickListener { onItemClick(item) }
            excerptText.setOnClickListener { onItemClick(item) }
            thumbnailImage.setOnClickListener { onItemClick(item) }
            likeAction.setOnClickListener { onLikeClick(item) }
            commentAction.setOnClickListener { onCommentClick(item) }
            repostAction.setOnClickListener { onItemClick(item) }
            overflowAction.setOnClickListener { onShareClick?.invoke(item) }
            shareAction.setOnClickListener { onShareClick?.invoke(item) }
        }

        private fun dpToPx(dp: Int): Int {
            val density = itemView.resources.displayMetrics.density
            return (dp * density).toInt()
        }

        private fun sanitizeExcerpt(raw: String): String {
            var sanitized = markdownImagePattern.replace(raw) { "" }
            sanitized = markdownLinkPattern.replace(sanitized) { match ->
                val token = match.value
                val openParen = token.indexOf('(')
                val closeParen = token.lastIndexOf(')')
                if (openParen > 1 && closeParen > openParen) {
                    val inside = token.substring(1, openParen - 1)
                    inside
                } else {
                    ""
                }
            }
            sanitized = bareUrlPattern.replace(sanitized, "")
            sanitized = sanitized.replace(Regex("\\s{2,}"), " ").trim()
            return sanitized
        }
    }

    data class FeedUiItem(
        val item: FeedItem,
        val likeCount: Int = item.likeCount,
        val commentCount: Int = item.commentCount,
        val viewCount: Int = item.viewCount,
        val liked: Boolean = item.liked,
    )

    private class FeedDiffCallback : DiffUtil.ItemCallback<FeedUiItem>() {
        override fun areItemsTheSame(oldItem: FeedUiItem, newItem: FeedUiItem): Boolean {
            return oldItem.item.postId == newItem.item.postId
        }

        override fun areContentsTheSame(oldItem: FeedUiItem, newItem: FeedUiItem): Boolean {
            return oldItem == newItem
        }
    }
}

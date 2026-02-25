package com.myblog.android.feature.feed.ui

import android.content.res.ColorStateList
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
import com.myblog.android.feature.feed.model.PostComment
import com.myblog.android.feature.feed.time.RelativeTimeFormatter

class CommentAdapter(
    private val formatter: RelativeTimeFormatter,
    private val onLikeClick: (CommentRowItem) -> Unit,
    private val onReplyClick: (CommentRowItem) -> Unit,
    private val onLoadRepliesClick: (CommentRowItem) -> Unit,
) : ListAdapter<CommentRowItem, CommentAdapter.CommentViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CommentViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_comment_row, parent, false)
        return CommentViewHolder(view)
    }

    override fun onBindViewHolder(holder: CommentViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class CommentViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val root: LinearLayout = view.findViewById(R.id.commentRowRoot)
        private val avatar: ImageView = view.findViewById(R.id.commentAuthorAvatar)
        private val metaText: TextView = view.findViewById(R.id.commentMetaText)
        private val bodyText: TextView = view.findViewById(R.id.commentBodyText)
        private val likeAction: LinearLayout = view.findViewById(R.id.commentLikeAction)
        private val likeIcon: ImageView = view.findViewById(R.id.commentLikeIcon)
        private val likeCountText: TextView = view.findViewById(R.id.commentLikeCountText)
        private val replyAction: LinearLayout = view.findViewById(R.id.commentReplyAction)
        private val replyCountText: TextView = view.findViewById(R.id.commentReplyCountText)
        private val replyLabel: TextView = view.findViewById(R.id.commentReplyLabel)
        private val loadRepliesText: TextView = view.findViewById(R.id.commentLoadRepliesText)

        fun bind(item: CommentRowItem) {
            val comment = item.comment
            val elapsed = formatter.formatFromEpochSeconds(comment.createdAtEpochSeconds)
            metaText.text = "${comment.authorName} · $elapsed"
            bodyText.text = comment.content
            likeCountText.text = comment.likeCount.coerceAtLeast(0).toString()
            replyCountText.text = comment.replyCount.coerceAtLeast(0).toString()

            val leftPadding = if (item.depth == 0) 0 else 28
            root.setPadding(leftPadding, root.paddingTop, root.paddingRight, root.paddingBottom)

            if (comment.liked) {
                likeIcon.setImageResource(R.drawable.ic_myblog_like_filled)
                likeIcon.imageTintList = ColorStateList.valueOf(
                    ContextCompat.getColor(root.context, R.color.myblog_error),
                )
                likeCountText.setTextColor(ContextCompat.getColor(root.context, R.color.myblog_error))
            } else {
                likeIcon.setImageResource(R.drawable.ic_myblog_like_outline)
                likeIcon.imageTintList = ColorStateList.valueOf(
                    ContextCompat.getColor(root.context, R.color.myblog_icon_muted),
                )
                likeCountText.setTextColor(ContextCompat.getColor(root.context, R.color.myblog_text_secondary))
            }

            val canLoadReplies = item.depth == 0 && comment.replyCount > 0 && !item.repliesLoaded
            loadRepliesText.isVisible = canLoadReplies
            loadRepliesText.text = "답글 보기 (${comment.replyCount})"

            avatar.load(comment.authorProfileImage) {
                placeholder(R.drawable.myblog_avatar_placeholder)
                error(R.drawable.myblog_avatar_placeholder)
                crossfade(true)
                memoryCachePolicy(CachePolicy.ENABLED)
                diskCachePolicy(CachePolicy.ENABLED)
            }

            likeAction.setOnClickListener { onLikeClick(item) }
            replyAction.setOnClickListener { onReplyClick(item) }
            replyLabel.setOnClickListener { onReplyClick(item) }
            loadRepliesText.setOnClickListener { onLoadRepliesClick(item) }
        }
    }

    private class DiffCallback : DiffUtil.ItemCallback<CommentRowItem>() {
        override fun areItemsTheSame(oldItem: CommentRowItem, newItem: CommentRowItem): Boolean {
            return oldItem.comment.commentId == newItem.comment.commentId && oldItem.depth == newItem.depth
        }

        override fun areContentsTheSame(oldItem: CommentRowItem, newItem: CommentRowItem): Boolean {
            return oldItem == newItem
        }
    }
}

data class CommentRowItem(
    val comment: PostComment,
    val depth: Int,
    val repliesLoaded: Boolean,
)

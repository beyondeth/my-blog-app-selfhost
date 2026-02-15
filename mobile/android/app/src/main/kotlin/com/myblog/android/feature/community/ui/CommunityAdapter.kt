package com.myblog.android.feature.community.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.request.CachePolicy
import com.myblog.android.R
import com.myblog.android.feature.feed.model.CommunityItem

class CommunityAdapter(
    private val onItemClick: (CommunityItem) -> Unit,
    private val onJoinToggleClick: (CommunityItem) -> Unit,
) : ListAdapter<CommunityItem, CommunityAdapter.CommunityViewHolder>(DiffCallback()) {
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CommunityViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_community_card, parent, false)
        return CommunityViewHolder(view)
    }

    override fun onBindViewHolder(holder: CommunityViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class CommunityViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val iconImage: ImageView = view.findViewById(R.id.communityIconImage)
        private val nameText: TextView = view.findViewById(R.id.communityNameText)
        private val slugText: TextView = view.findViewById(R.id.communitySlugText)
        private val memberCountText: TextView = view.findViewById(R.id.communityMemberCountText)
        private val joinButton: TextView = view.findViewById(R.id.communityJoinButton)

        fun bind(item: CommunityItem) {
            nameText.text = item.name
            slugText.text = "/${item.slug}"
            memberCountText.text = "멤버 ${item.memberCount}"
            joinButton.text = if (item.joined) "참여중" else "참여"
            joinButton.setBackgroundResource(
                if (item.joined) R.drawable.bg_filter_chip_selected else R.drawable.bg_filter_chip_unselected,
            )
            joinButton.setTextColor(
                ContextCompat.getColor(
                    joinButton.context,
                    if (item.joined) R.color.myblog_surface else R.color.myblog_text_primary,
                ),
            )

            iconImage.load(item.iconUrl) {
                placeholder(R.drawable.myblog_avatar_placeholder)
                error(R.drawable.myblog_avatar_placeholder)
                crossfade(true)
                memoryCachePolicy(CachePolicy.ENABLED)
                diskCachePolicy(CachePolicy.ENABLED)
            }

            itemView.setOnClickListener { onItemClick(item) }
            joinButton.setOnClickListener { onJoinToggleClick(item) }
        }
    }

    private class DiffCallback : DiffUtil.ItemCallback<CommunityItem>() {
        override fun areItemsTheSame(oldItem: CommunityItem, newItem: CommunityItem): Boolean {
            return oldItem.communityId == newItem.communityId
        }

        override fun areContentsTheSame(oldItem: CommunityItem, newItem: CommunityItem): Boolean {
            return oldItem == newItem
        }
    }
}

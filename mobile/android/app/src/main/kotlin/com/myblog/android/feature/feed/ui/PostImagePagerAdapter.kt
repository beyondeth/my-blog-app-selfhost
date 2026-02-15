package com.myblog.android.feature.feed.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import androidx.annotation.LayoutRes
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.request.CachePolicy
import com.myblog.android.R

class PostImagePagerAdapter(
    @LayoutRes private val itemLayoutResId: Int = R.layout.item_post_image_page,
    private val onImageClick: (Int) -> Unit = {},
) : RecyclerView.Adapter<PostImagePagerAdapter.PostImageViewHolder>() {
    private var images: List<String> = emptyList()

    fun submitImages(newImages: List<String>) {
        images = newImages
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PostImageViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(itemLayoutResId, parent, false)
        return PostImageViewHolder(view)
    }

    override fun onBindViewHolder(holder: PostImageViewHolder, position: Int) {
        val imageUrl = images[position]
        holder.imageView.load(imageUrl) {
            crossfade(true)
            memoryCachePolicy(CachePolicy.ENABLED)
            diskCachePolicy(CachePolicy.ENABLED)
        }
        holder.itemView.setOnClickListener {
            onImageClick(position)
        }
    }

    override fun getItemCount(): Int = images.size

    class PostImageViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val imageView: ImageView = itemView.findViewById(R.id.postImagePageImage)
    }
}

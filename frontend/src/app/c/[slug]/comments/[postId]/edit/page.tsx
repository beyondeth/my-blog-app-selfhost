"use client";

import { useEffect, useState } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useCommunityPost } from '@/hooks/community/useCommunityPosts';
import { useUpdateCommunityPost } from '@/hooks/community/useCommunityPosts';
import CommunityPostEditForm from '@/components/community/posts/CommunityPostEditForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { toast } from 'sonner';

export default function CommunityPostEditPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  
  // Extract params
  const communitySlug = typeof params.slug === 'string' ? params.slug : '';
  const postId = typeof params.postId === 'string' ? params.postId : '';

  const { 
    data: post, 
    isLoading: isPostLoading, 
    error: postError 
  } = useCommunityPost(communitySlug, postId);

  const updatePostMutation = useUpdateCommunityPost(communitySlug);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  useEffect(() => {
    if (!isPostLoading && post && user) {
      // Check ownership
      if (post.author?.id !== user.id) {
        setIsUnauthorized(true);
        toast.error('You do not have permission to edit this post.');
        router.push(`/c/${communitySlug}/comments/${post.slug}`);
      }
    }
  }, [isPostLoading, post, user, communitySlug, router]);

  const handleSubmit = async (data: any) => {
    try {
        await updatePostMutation.mutateAsync({
            postSlug: post!.slug, // post is guaranteed to exist here
            data: data
        });
        toast.success('Post updated successfully.');
        router.push(`/c/${communitySlug}/comments/${post!.slug}`);
    } catch (error) {
        console.error("Failed to update post:", error);
        // Error handling is usually done in mutation's onError or here
        // toast.error is handled by mutation globally or can be extended here
    }
  };

  const handleCancel = () => {
    if (post?.slug) {
        router.push(`/c/${communitySlug}/comments/${post.slug}`);
    } else {
        router.back();
    }
  };

  if (isPostLoading) return <LoadingSpinner message="Loading post..." />;
  
  if (postError || !post) {
      if (postError?.message.includes('404')) return notFound();
      return <ErrorMessage message="Unable to load this post." />;
  }

  if (isUnauthorized) return <ErrorMessage message="You do not have permission to edit this post." />;

  return (
    <div className="max-w-5xl mx-auto px-3 pt-20 pb-6 lg:py-6">
      <CommunityPostEditForm
        communitySlug={communitySlug}
        initialData={post}
        isLoading={updatePostMutation.isPending}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}

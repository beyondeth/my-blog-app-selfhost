"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/button';
import useFollowInfo from '@/hooks/useFollowInfo';

interface FollowInfo {
  followersCount: number;
  followingCount: number;
  isFollowedByUser: boolean;
}

interface FollowButtonProps {
  userId: string;
  initialState: FollowInfo;
}

export default function FollowButton({
  userId,
  initialState,
}: FollowButtonProps) {
  const queryClient = useQueryClient();
  const { data } = useFollowInfo(userId, initialState);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const endpoint = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${userId}/follow`;
      
      const response = await fetch(endpoint, {
        method: data.isFollowedByUser ? 'DELETE' : 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to update follow status');
      }
    },
    onMutate: async () => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['follow-info', userId] });
      
      const previousState = queryClient.getQueryData<FollowInfo>(['follow-info', userId]);
      
      queryClient.setQueryData<FollowInfo>(['follow-info', userId], (old) => ({
        followersCount: (old?.followersCount || data.followersCount) + (data.isFollowedByUser ? -1 : 1),
        followingCount: old?.followingCount || data.followingCount,
        isFollowedByUser: !data.isFollowedByUser,
      }));

      return { previousState };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['follow-info', userId], context?.previousState);
      
      console.error('Failed to update follow status:', error);
      // You can replace this with a proper toast notification later
      alert('팔로우 상태 변경에 실패했습니다. 다시 시도해주세요.');
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['follow-info', userId] });
    },
  });

  return (
    <Button
      size="sm"
      variant={data.isFollowedByUser ? "outline" : "default"}
      onClick={() => mutate()}
      disabled={isPending}
      className="text-xs"
    >
      {isPending ? "처리중..." : data.isFollowedByUser ? "팔로우 취소" : "팔로우"}
    </Button>
  );
}
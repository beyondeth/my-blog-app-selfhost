'use client';

import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Heart, MessageCircle, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
  notification: any;
  onClose?: () => void;
}

export default function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const queryClient = useQueryClient();

  // 알림 읽음 처리
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (notification.read) return;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/notifications/${notification.id}/read`,
        {
          method: 'PUT',
          credentials: 'include',
        }
      );
      if (!response.ok) throw new Error('Failed to mark as read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });

  const getNotificationContent = () => {
    const issuerName = notification.issuer?.displayName || notification.issuer?.username || '사용자';
    
    switch (notification.type) {
      case 'FOLLOW':
        return {
          icon: <UserPlus className="h-4 w-4 text-blue-500" />,
          message: `${issuerName}님이 회원님을 팔로우했습니다`,
          link: notification.issuer?.blog?.slug 
            ? `/blog/${notification.issuer.blog.slug}` 
            : '#',
        };
      case 'POST_LIKE':
        return {
          icon: <Heart className="h-4 w-4 text-red-500" />,
          message: `${issuerName}님이 회원님의 포스트를 좋아합니다`,
          link: `/blog/${notification.post?.blogSlug}/posts/${notification.post?.slug}`,
        };
      case 'COMMENT':
        return {
          icon: <MessageCircle className="h-4 w-4 text-green-500" />,
          message: `${issuerName}님이 회원님의 포스트에 댓글을 남겼습니다`,
          link: `/blog/${notification.post?.blogSlug}/posts/${notification.post?.slug}`,
        };
      default:
        return {
          icon: null,
          message: notification.message || '새로운 알림',
          link: '#',
        };
    }
  };

  const { icon, message, link } = getNotificationContent();

  const handleClick = () => {
    markAsReadMutation.mutate();
    if (onClose) onClose();
  };

  return (
    <Link
      href={link}
      onClick={handleClick}
      className={cn(
        "flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors",
        !notification.read && "bg-blue-50/50 dark:bg-blue-950/20"
      )}
    >
      <div className="mt-1">{icon}</div>
      <div className="flex-1 space-y-1">
        <p className="text-sm">{message}</p>
        <p className="text-xs text-muted-foreground">
          {(() => {
            const date = new Date(notification.createdAt);
            // UTC 시간을 로컬 시간으로 변환
            const localDate = new Date(date.getTime());
            return formatDistanceToNow(localDate, { 
              addSuffix: true,
              locale: ko 
            });
          })()}
        </p>
      </div>
      {!notification.read && (
        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
      )}
    </Link>
  );
}
import Link from 'next/link';
import UserLinkWithTooltip from '@/components/UserLinkWithTooltip';
import { Avatar } from '@/components/ui/avatar';
import MemberRoleBadge from '@/components/community/MemberRoleBadge';
import type { Post } from '@/types';
import type { FeedCommunityContext } from '@/utils/feed/unifiedFeedAdapter';
import { FiTag } from 'react-icons/fi';
import { formatRelativeTime } from '@/utils/timeFormat';

type PostSourceMetaVariant = 'default' | 'home';

interface PostSourceMetaProps {
  post: Post;
  communityContext?: FeedCommunityContext & { shouldBlurMedia?: boolean };
  infoClassName?: string;
  categoryClassName?: string;
  displayCategory?: string;
  priority?: boolean;
  variant?: PostSourceMetaVariant;
  showAuthorPrefix?: boolean;
  timestamp?: string | Date;
  relativeTime?: string;
}

export default function PostSourceMeta(props: PostSourceMetaProps) {
  const {
    post,
    communityContext,
    infoClassName = 'mb-3',
    categoryClassName = 'mb-2',
    displayCategory,
    priority,
    variant = 'default',
    showAuthorPrefix = true,
    timestamp,
    relativeTime,
  } = props;
  const communitySlugLink = communityContext?.slug ? `/c/${communityContext.slug}` : null;
  const isCommunity = Boolean(communityContext);
  const shouldShowCommunity = isCommunity;
  const timestampValue = timestamp ?? post.publishedAt ?? post.createdAt;
  const timestampIso =
    typeof timestampValue === 'string'
      ? timestampValue
      : timestampValue?.toISOString();
  const relativeTimeValue = timestampValue
    ? relativeTime ?? formatRelativeTime(timestampValue)
    : null;
  const shouldShowHeaderTime =
    variant === 'home' && Boolean(timestampIso && relativeTimeValue);
  const blogAuthorLabel = post.author?.username
    ? showAuthorPrefix
      ? `b/${post.author.username}`
      : post.author.username
    : '';
  const isHomeVariant = variant === 'home';
  const metaLinkClass = isHomeVariant
    ? 'text-[#1B2430] dark:text-[#E6EDF3] hover:text-[#264653] dark:hover:text-[#6CC3B2] transition-colors'
    : 'text-gray-800 dark:text-gray-200 hover:text-primary transition-colors';
  const metaTextClass = isHomeVariant
    ? 'text-[#425466] dark:text-[#C7D2E0]'
    : 'text-gray-700 dark:text-gray-200';
  const metaMutedClass = isHomeVariant
    ? 'text-[#7B8794] dark:text-[#A9B4C2]'
    : 'text-gray-500 dark:text-gray-400';
  const metaPrimaryClass = isHomeVariant
    ? 'text-[#1B2430] dark:text-[#E6EDF3]'
    : 'text-gray-900 dark:text-gray-100';
  const metaCategoryClass = isHomeVariant
    ? 'text-[#425466] dark:text-[#C7D2E0]'
    : 'text-gray-800 dark:text-gray-100';

  const renderCommunityMeta = () => {
    if (!communityContext) return null;

    const communityLabel = communityContext.name
      ? `c/${communityContext.name}`
      : `c/${communityContext.slug}`;

    if (variant === 'home') {
      return (
        <div className="flex items-start gap-3">
          <Link href={communitySlugLink ?? '#'} className="flex-shrink-0">
            <Avatar
              src={communityContext.iconUrl}
              alt={communityContext.name || communityContext.slug}
              fallback={communityContext.name || communityContext.slug}
              size="sm"
              priority={priority}
              imageFit={communityContext.iconImageFit ?? 'cover'}
            />
          </Link>
          <div className="flex flex-col leading-tight">
            <Link
              href={communitySlugLink ?? '#'}
              className={`text-[15px] font-semibold ${metaLinkClass}`}
            >
              {communityLabel}
            </Link>
            {(post.author || shouldShowHeaderTime) && (
              <div className={`flex flex-wrap items-center gap-1 text-[13px] ${metaTextClass}`}>
                {post.author && (
                  <UserLinkWithTooltip
                    userId={post.author.id}
                    username={post.author.username}
                    blogSlug={post.blog?.slug}
                  >
                    <span className={`${metaPrimaryClass} transition-colors`}>
                      {post.author.username ?? ''}
                    </span>
                  </UserLinkWithTooltip>
                )}
                {post.author && shouldShowHeaderTime && (
                  <span className={metaMutedClass} aria-hidden="true">
                    ·
                  </span>
                )}
                {shouldShowHeaderTime && timestampIso && relativeTimeValue && (
                  <time className={`text-[13px] ${metaTextClass}`} dateTime={timestampIso}>
                    {relativeTimeValue}
                  </time>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <>
        <Link
          href={communitySlugLink ?? '#'}
          className={`flex items-center gap-2 ${metaLinkClass}`}
        >
          <Avatar
            src={communityContext.iconUrl}
            alt={communityContext.name || communityContext.slug}
            fallback={communityContext.name || communityContext.slug}
            size="sm"
            priority={priority}
            imageFit={communityContext.iconImageFit ?? 'cover'}
          />
          <span className="text-[15px] font-semibold">
            {communityLabel}
          </span>
        </Link>
        {post.author && (
          <>
            <span className={metaMutedClass}>·</span>
            <UserLinkWithTooltip
              userId={post.author.id}
              username={post.author.username}
              blogSlug={post.blog?.slug}
            >
              <div className="flex items-center gap-2">
                <Avatar
                  src={post.author.profileImage}
                  alt={post.author.username}
                  fallback={post.author.username}
                  size="sm"
                  priority={priority}
                />
                <span className={`text-[13px] ${metaPrimaryClass}`}>
                  {post.author.username}
                </span>
                {communityContext.authorRole && (
                  <MemberRoleBadge role={communityContext.authorRole} size="sm" className="ml-1" />
                )}
                {timestampIso && relativeTimeValue && (
                  <>
                    <span className={metaMutedClass} aria-hidden="true">
                      ·
                    </span>
                    <time className={`text-[13px] ${metaTextClass}`} dateTime={timestampIso}>
                      {relativeTimeValue}
                    </time>
                  </>
                )}
              </div>
            </UserLinkWithTooltip>
          </>
        )}
      </>
    );
  };

  return (
    <div>
      <div className={`flex items-center gap-2 flex-wrap ${infoClassName}`}>
        {shouldShowCommunity && communityContext ? (
          renderCommunityMeta()
        ) : (
          post.author && (
            <>
              <UserLinkWithTooltip
                userId={post.author.id}
                username={post.author.username}
                blogSlug={post.blog?.slug}
              >
                <div className="flex items-center gap-2">
                  <Avatar
                    src={post.author.profileImage}
                    alt={post.author.username}
                    fallback={post.author.username}
                    size="sm"
                    priority={priority}
                  />
                  <span className={`text-[15px] ${metaPrimaryClass} font-medium`}>
                    {blogAuthorLabel}
                  </span>
                </div>
              </UserLinkWithTooltip>
              {timestampIso && relativeTimeValue && (
                <>
                  <span className={metaMutedClass} aria-hidden="true">
                    ·
                  </span>
                  <time className={`text-[13px] ${metaTextClass}`} dateTime={timestampIso}>
                    {relativeTimeValue}
                  </time>
                </>
              )}
            </>
          )
        )}
      </div>
      {!shouldShowCommunity && displayCategory && (
        <div className={categoryClassName}>
          <span className={`text-[13px] ${metaCategoryClass} inline-flex items-center gap-1`}>
            <FiTag className="w-4 h-4" />
            <span>{displayCategory}</span>
          </span>
        </div>
      )}
    </div>
  );
}

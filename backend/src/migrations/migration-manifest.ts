import type { MigrationInterface } from "typeorm";

export interface MigrationManifestEntry {
  readonly fileName: string;
  readonly className: string;
}

export type MigrationConstructor = new () => MigrationInterface & {
  name?: string;
};

/**
 * Runtime migration discovery must be deterministic across filesystems.
 * Keep this list ordered by timestamp and append new migrations explicitly.
 */
export const MIGRATION_MANIFEST = [
  {
    fileName: "1757000000000-InitialSchema",
    className: "InitialSchema1757000000000",
  },
  {
    fileName: "1757000000001-AddUserConsentFields",
    className: "AddUserConsentFields1757000000001",
  },
  {
    fileName: "1757147537858-AddTagSystem",
    className: "AddTagSystem1757147537858",
  },
  {
    fileName: "1757608824493-AddPopularPostsIndexes",
    className: "AddPopularPostsIndexes1757608824493",
  },
  {
    fileName: "1757649879203-CreateSuspiciousRequestsTable",
    className: "CreateSuspiciousRequestsTable1757649879203",
  },
  {
    fileName: "1757697492766-CreateMcpUserLogsTable",
    className: "CreateMcpUserLogsTable1757697492766",
  },
  {
    fileName: "1758038066249-ConvertTagsToJsonb",
    className: "ConvertTagsToJsonb1758038066249",
  },
  {
    fileName: "1758040089931-AddQualityScoreToPost",
    className: "AddQualityScoreToPost1758040089931",
  },
  {
    fileName: "1758108745064-AddChatEntities",
    className: "AddChatEntities1758108745064",
  },
  {
    fileName: "1758117705918-AddChatIndexes",
    className: "AddChatIndexes1758117705918",
  },
  {
    fileName: "1758373402333-AddChatPerformanceIndexes",
    className: "AddChatPerformanceIndexes1758373402333",
  },
  {
    fileName: "1758378537468-OptimizePostsTableIndexes",
    className: "OptimizePostsTableIndexes1758378537468",
  },
  {
    fileName: "1758381433222-OptimizeInClauseQueries",
    className: "OptimizeInClauseQueries1758381433222",
  },
  {
    fileName: "1758384083910-DatabaseOptimization",
    className: "DatabaseOptimization1758384083910",
  },
  {
    fileName: "1758386143779-AddUuidInClauseIndexes",
    className: "AddUuidInClauseIndexes1758386143779",
  },
  {
    fileName: "1758549600000-RefactorReadStatusToLastReadTimestamp",
    className: "RefactorReadStatusToLastReadTimestamp1758549600000",
  },
  {
    fileName: "1759004449762-RemoveApiKeys",
    className: "RemoveApiKeys1759004449762",
  },
  {
    fileName: "1759005459352-RemoveMcpUserLogs",
    className: "RemoveMcpUserLogs1759005459352",
  },
  {
    fileName: "1759079431987-CreateSubscriptionSystem",
    className: "CreateSubscriptionSystem1759079431987",
  },
  {
    fileName: "1759087856008-AddPaymentHistoryFields",
    className: "AddPaymentHistoryFields1759087856008",
  },
  {
    fileName: "1759090000000-AddNameAndStripeCustomerId",
    className: "AddNameAndStripeCustomerId1759090000000",
  },
  {
    fileName: "1759091000000-AddUserSubscriptionFields",
    className: "AddUserSubscriptionFields1759091000000",
  },
  {
    fileName: "1759200000000-OptimizeCacheWarmingQueries",
    className: "OptimizeCacheWarmingQueries1759200000000",
  },
  {
    fileName: "1759335278892-AddExcerptToPost",
    className: "AddExcerptToPost1759335278892",
  },
  {
    fileName: "1759346700756-AddMcpPostToResourceTypeEnum",
    className: "AddMcpPostToResourceTypeEnum1759346700756",
  },
  {
    fileName: "1759346736462-AddMcpPostEnum",
    className: "AddMcpPostEnum1759346736462",
  },
  {
    fileName: "1759400000000-AddFullTextSearch",
    className: "AddFullTextSearch1759400000000",
  },
  {
    fileName: "1759400100000-CreateBookmarksTable",
    className: "CreateBookmarksTable1759400100000",
  },
  {
    fileName: "1759401000000-RemoveSearchTrigger",
    className: "RemoveSearchTrigger1759401000000",
  },
  {
    fileName: "1759500870345-AddSoftDeleteAndRetentionFields",
    className: "AddSoftDeleteAndRetentionFields1759500870345",
  },
  {
    fileName: "1759501229811-UpdateCascadeForRetention",
    className: "UpdateCascadeForRetention1759501229811",
  },
  {
    fileName: "1759505600055-AddEmailApprovalFields",
    className: "AddEmailApprovalFields1759505600055",
  },
  {
    fileName: "1759521094444-AddPerformanceIndexes",
    className: "AddPerformanceIndexes1759521094444",
  },
  {
    fileName: "1759599999999-AddEditorPickToPost",
    className: "AddEditorPickToPost1759599999999",
  },
  {
    fileName: "1760000000000-MajorRefactoringPhase1-2-3",
    className: "MajorRefactoringPhase1231760000000000",
  },
  {
    fileName: "1760100000000-AddMissingSubscriptionColumns",
    className: "AddMissingSubscriptionColumns1760100000000",
  },
  {
    fileName: "1760200000000-AddMissingAccountSettingsColumns",
    className: "AddMissingAccountSettingsColumns1760200000000",
  },
  {
    fileName: "1760443427308-AddPostStatusFields",
    className: "AddPostStatusFields1760443427308",
  },
  {
    fileName: "1760697657000-CreateMcpApiKeyTable",
    className: "CreateMcpApiKeyTable1760697657000",
  },
  {
    fileName: "1760703551831-FixPublishedAtTimezone",
    className: "FixPublishedAtTimezone1760703551831",
  },
  {
    fileName: "1760800000000-AddCommentPaginationIndexes",
    className: "AddCommentPaginationIndexes1760800000000",
  },
  {
    fileName: "1760900000000-AddRepliesCountToComments",
    className: "AddRepliesCountToComments1760900000000",
  },
  {
    fileName: "1761000000000-RecalculateRepliesCount",
    className: "RecalculateRepliesCount1761000000000",
  },
  {
    fileName: "1761000000000-RenameTagListToTagsColumn",
    className: "RenameTagListToTagsColumn1761000000000",
  },
  {
    fileName: "1761100000000-AddRedirectToOldAliases",
    className: "AddRedirectToOldAliases1761100000000",
  },
  {
    fileName: "1761100000000-AddTermsAcceptanceFields",
    className: "AddTermsAcceptanceFields1761100000000",
  },
  {
    fileName: "1761200000000-AddDeletedAtToPosts",
    className: "AddDeletedAtToPosts1761200000000",
  },
  {
    fileName: "1761200000000-MakeCategoryRequired",
    className: "MakeCategoryRequired1761200000000",
  },
  {
    fileName: "1761201000000-AddMissingPostMetadataColumns",
    className: "AddMissingPostMetadataColumns1761201000000",
  },
  {
    fileName: "1761202000000-AddVersionDefaultToPosts",
    className: "AddVersionDefaultToPosts1761202000000",
  },
  {
    fileName: "1761203000000-FixExistingPostSlugs",
    className: "FixExistingPostSlugs1761203000000",
  },
  {
    fileName: "1761464987476-RemoveDuplicateCategoryIndex",
    className: "RemoveDuplicateCategoryIndex1761464987476",
  },
  {
    fileName: "1761465000000-AddIsDeletedToPosts",
    className: "AddIsDeletedToPosts1761465000000",
  },
  {
    fileName: "1761465096433-RecreateCategoryCompositeIndex",
    className: "RecreateCategoryCompositeIndex1761465096433",
  },
  {
    fileName: "1761466000000-UpdateAuditLogsPerformedByIdNullable",
    className: "UpdateAuditLogsPerformedByIdNullable1761466000000",
  },
  {
    fileName: "1761500000000-RecreateSearchIndexes",
    className: "RecreateSearchIndexes1761500000000",
  },
  {
    fileName: "1761600000000-AddCoveringIndexes",
    className: "AddCoveringIndexes1761600000000",
  },
  {
    fileName: "1761700000000-RenameTagListToTagsInPostMetadata",
    className: "RenameTagListToTagsInPostMetadata1761700000000",
  },
  {
    fileName: "1763050000000-AddPostPerformanceIndexes",
    className: "AddPostPerformanceIndexes1763050000000",
  },
  {
    fileName: "1763100000000-FixMalformedPostSlugs",
    className: "FixMalformedPostSlugs1763100000000",
  },
  {
    fileName: "1763200000001-AddHighPerformanceIndexesForPostgres18-Dev",
    className: "AddHighPerformanceIndexesForPostgres18Dev1763200000001",
  },
  {
    fileName: "1763311379212-RemoveThumbnailColumnFromPosts",
    className: "RemoveThumbnailColumnFromPosts1763311379212",
  },
  {
    fileName: "1763312000000-RecreatePopularPostsWithThumbnailFix",
    className: "RecreatePopularPostsWithThumbnailFix1763312000000",
  },
  {
    fileName: "1763800000000-FixDeletedUserBlogSlugs",
    className: "FixDeletedUserBlogSlugs1763800000000",
  },
  {
    fileName: "1764000000000-RemoveThumbnailColumn",
    className: "RemoveThumbnailColumn1764000000000",
  },
  {
    fileName: "1764221012636-CreateMusicsTable",
    className: "CreateMusicsTable1764221012636",
  },
  {
    fileName: "1767798480428-AddDeletedAtToComment",
    className: "AddDeletedAtToComment1767798480428",
  },
  {
    fileName: "1767962489968-UpdateModerationEnum",
    className: "UpdateModerationEnum1767962489968",
  },
  {
    fileName: "1767963059573-UpdateAuditActionEnum",
    className: "UpdateAuditActionEnum1767963059573",
  },
  {
    fileName: "1770000000000-OptimizeDeletedPostsIndex",
    className: "OptimizeDeletedPostsIndex1770000000000",
  },
  {
    fileName: "1771000000000-FixUserDeletionLogsDeletedAt",
    className: "FixUserDeletionLogsDeletedAt1771000000000",
  },
  {
    fileName: "1772000000000-AddCriticalPerformanceIndexes",
    className: "AddCriticalPerformanceIndexes1772000000000",
  },
  {
    fileName: "1772100000000-AddPerformanceOptimizationIndexes",
    className: "AddPerformanceOptimizationIndexes1772100000000",
  },
  {
    fileName: "1772200000000-AddAdvancedSearchIndexes",
    className: "AddAdvancedSearchIndexes1772200000000",
  },
  {
    fileName: "1775000000000-RemoveViewCountFromPosts",
    className: "RemoveViewCountFromPosts1775000000000",
  },
  {
    fileName: "1776000000000-FixPostStatsIndexes",
    className: "FixPostStatsIndexes1776000000000",
  },
  {
    fileName: "1777000000000-AddLikesConstraints",
    className: "AddLikesConstraints1777000000000",
  },
  {
    fileName: "1777100000000-AddMissingColumnsToPostLikes",
    className: "AddMissingColumnsToPostLikes1777100000000",
  },
  {
    fileName: "1778000000000-AddHomepagePerformanceIndexes",
    className: "AddHomepagePerformanceIndexes1778000000000",
  },
  {
    fileName: "1778000000000-RemoveRecursiveSearchTrigger",
    className: "RemoveRecursiveSearchTrigger1778000000000",
  },
  {
    fileName: "1778200000000-EnhancePopularPostsMV",
    className: "EnhancePopularPostsMV1778200000000",
  },
  {
    fileName: "1779000000000-AddLyricsToMusic",
    className: "AddLyricsToMusic1779000000000",
  },
  {
    fileName: "1780000000000-AddDisplayGenreToMusic",
    className: "AddDisplayGenreToMusic1780000000000",
  },
  {
    fileName: "1781000000000-CreateCommunityTables",
    className: "CreateCommunityTables1781000000000",
  },
  {
    fileName: "1781000000001-AddCommunityFileContextEnums",
    className: "AddCommunityFileContextEnums1781000000001",
  },
  {
    fileName: "1782000000000-AddAdminRoleToCommunity",
    className: "AddAdminRoleToCommunity1782000000000",
  },
  {
    fileName: "1782000000000-AddCommunityCommentDislike",
    className: "AddCommunityCommentDislike1782000000000",
  },
  {
    fileName: "1782000000000-AddCommunitySidebarWidgets",
    className: "AddCommunitySidebarWidgets1782000000000",
  },
  {
    fileName: "1782000000000-AddReportAndRemovalReasonTables",
    className: "AddReportAndRemovalReasonTables1782000000000",
  },
  {
    fileName: "1782000000001-AddAdultVerificationFields",
    className: "AddAdultVerificationFields1782000000001",
  },
  {
    fileName: "1782000000001-AddRuleFlairWidgetTypes",
    className: "AddRuleFlairWidgetTypes1782000000001",
  },
  {
    fileName: "1782000000002-AddBlogBrandingFields",
    className: "AddBlogBrandingFields1782000000002",
  },
  {
    fileName: "1783000000000-ConvertLikeToUpvoteDownvote",
    className: "ConvertLikeToUpvoteDownvote1783000000000",
  },
  {
    fileName: "1784000000000-AddCommunityInviteSystem",
    className: "AddCommunityInviteSystem1784000000000",
  },
  {
    fileName: "1784000000000-AddModeratorPermissionsSystem",
    className: "AddModeratorPermissionsSystem1784000000000",
  },
  {
    fileName: "1785000000000-AddFeedSortingIndexes",
    className: "AddFeedSortingIndexes1785000000000",
  },
  {
    fileName: "1785000000000-CreateVideosTable",
    className: "CreateVideosTable1785000000000",
  },
  {
    fileName: "1786000000000-AddCommunityJoinPolicyIndex",
    className: "AddCommunityJoinPolicyIndex1786000000000",
  },
  {
    fileName: "1786000000000-AddVideoThumbnail",
    className: "AddVideoThumbnail1786000000000",
  },
  {
    fileName: "1787000000000-AddVideoExpirationField",
    className: "AddVideoExpirationField1787000000000",
  },
  {
    fileName: "1789000000000-AddCommunityLockColumns",
    className: "AddCommunityLockColumns1789000000000",
  },
  {
    fileName: "1790000000000-ExtendReportsWithActions",
    className: "ExtendReportsWithActions1790000000000",
  },
  {
    fileName: "1790100000000-AddUserSuspensionColumns",
    className: "AddUserSuspensionColumns1790100000000",
  },
  {
    fileName: "1790200000000-AddUserRestoreAction",
    className: "AddUserRestoreAction1790200000000",
  },
  {
    fileName: "1790300000000-AddBlogImageFitPreferences",
    className: "AddBlogImageFitPreferences1790300000000",
  },
  {
    fileName: "1790400000001-AddCommunityImageFitPreferences",
    className: "AddCommunityImageFitPreferences1790400000001",
  },
  {
    fileName: "1790500000000-CreateCommunityRecoverySnapshots",
    className: "CreateCommunityRecoverySnapshots1790500000000",
  },
  {
    fileName: "1790600000000-AddJobTitleToProfiles",
    className: "AddJobTitleToProfiles1790600000000",
  },
  {
    fileName: "1790700000000-AddBlogIconTextFields",
    className: "AddBlogIconTextFields1790700000000",
  },
  {
    fileName: "1790702000000-RemoveIconTitleCustomization",
    className: "RemoveIconTitleCustomization1790702000000",
  },
  {
    fileName: "1791100000000-UpdateProfileAndUsernameLengths",
    className: "UpdateProfileAndUsernameLengths1791100000000",
  },
  {
    fileName: "1791200000000-RemoveIconPlaceholderToggle",
    className: "RemoveIconPlaceholderToggle1791200000000",
  },
  {
    fileName: "1792000000000-AddPostStatsColumns",
    className: "AddPostStatsColumns1792000000000",
  },
  {
    fileName: "1793000000000-CreateReputationTables",
    className: "CreateReputationTables1793000000000",
  },
  {
    fileName: "1793200000000-AddCommunityMemberModeratorIndex",
    className: "AddCommunityMemberModeratorIndex1793200000000",
  },
  {
    fileName: "1794000000000-AddIpTrackingToPostsAndComments",
    className: "AddIpTrackingToPostsAndComments1794000000000",
  },
  {
    fileName: "1794100000000-ExtendIpAddressColumnSize",
    className: "ExtendIpAddressColumnSize1794100000000",
  },
  {
    fileName: "1794200000000-ExtendIpBlockListColumnSize",
    className: "ExtendIpBlockListColumnSize1794200000000",
  },
  {
    fileName: "1794300000000-AddCommunityDiscoverability",
    className: "AddCommunityDiscoverability1794300000000",
  },
  {
    fileName: "1795000000000-AddCommunityPostHotScore",
    className: "AddCommunityPostHotScore1795000000000",
  },
  {
    fileName: "1796000000000-AddProfileSocialLinks",
    className: "AddProfileSocialLinks1796000000000",
  },
  {
    fileName: "1797000000000-OptimizeCommentSchema",
    className: "OptimizeCommentSchema1797000000000",
  },
  {
    fileName: "1798000000000-CreateStatsTables",
    className: "CreateStatsTables1798000000000",
  },
  {
    fileName: "1799000000000-AddFollowCountsToUsers",
    className: "AddFollowCountsToUsers1799000000000",
  },
  {
    fileName: "1800000000000-AddHomeFeedPerformanceIndexes",
    className: "AddHomeFeedPerformanceIndexes1800000000000",
  },
  {
    fileName: "1801000000000-RemoveDuplicateWidgets",
    className: "RemoveDuplicateWidgets1801000000000",
  },
  {
    fileName: "1802000000000-MigrateFlairListToUnified",
    className: "MigrateFlairListToUnified1802000000000",
  },
  {
    fileName: "1803000000000-CreateCommunityBookmarksTable",
    className: "CreateCommunityBookmarksTable1803000000000",
  },
  {
    fileName: "1804000000000-AddMobileSettingsColumnsToAccountSettings",
    className: "AddMobileSettingsColumnsToAccountSettings1804000000000",
  },
  {
    fileName: "1804100000000-AddUnifiedFeedRecentIndexes",
    className: "AddUnifiedFeedRecentIndexes1804100000000",
  },
  {
    fileName: "1804200000000-HashEmailVerificationCodes",
    className: "HashEmailVerificationCodes1804200000000",
  },
  {
    fileName: "1804201000000-AddEncryptedApiKeyToMcpApiKeys",
    className: "AddEncryptedApiKeyToMcpApiKeys1804201000000",
  },
  {
    fileName: "1804300000000-CreateOrganizationsAndTenantLinks",
    className: "CreateOrganizationsAndTenantLinks1804300000000",
  },
  {
    fileName: "1804400000000-CreateOutboxEvents",
    className: "CreateOutboxEvents1804400000000",
  },
  {
    fileName: "1804500000000-AddOutboxProcessingLease",
    className: "AddOutboxProcessingLease1804500000000",
  },
  {
    fileName: "1804600000000-EnsurePersonalOrganizationUniqueness",
    className: "EnsurePersonalOrganizationUniqueness1804600000000",
  },
  {
    fileName: "1804700000000-AddOrganizationScopeToFilesAndVideos",
    className: "AddOrganizationScopeToFilesAndVideos1804700000000",
  },
  {
    fileName: "1804800000000-CreateRefreshSessions",
    className: "CreateRefreshSessions1804800000000",
  },
  {
    fileName: "1804900000000-AddAuditRequestContext",
    className: "AddAuditRequestContext1804900000000",
  },
  {
    fileName: "1805000000000-AddOutboxReliabilityAndIdempotency",
    className: "AddOutboxReliabilityAndIdempotency1805000000000",
  },
  {
    fileName: "1805000000000-CreatePopularPostSnapshots",
    className: "CreatePopularPostSnapshots1805000000000",
  },
  {
    fileName: "1805100000000-AddOutboxRequestContext",
    className: "AddOutboxRequestContext1805100000000",
  },
  {
    fileName: "1805100000000-AddPopularBatchIndexes",
    className: "AddPopularBatchIndexes1805100000000",
  },
  {
    fileName: "1805200000000-AddPostFileImageOrder",
    className: "AddPostFileImageOrder1805200000000",
  },
  {
    fileName: "1805200000000-AddPostVisibility",
    className: "AddPostVisibility1805200000000",
  },
  {
    fileName: "1805300000000-CreateFeedbackTickets",
    className: "CreateFeedbackTickets1805300000000",
  },
  {
    fileName: "1805401000000-BackfillPostMetadataShadowFields",
    className: "BackfillPostMetadataShadowFields1805401000000",
  },
  {
    fileName: "1805500000000-AddGithubResourceFieldsToPostMetadata",
    className: "AddGithubResourceFieldsToPostMetadata1805500000000",
  },
  {
    fileName: "1805600000000-ConsolidateSubscriptionTables",
    className: "ConsolidateSubscriptionTables1805600000000",
  },
  {
    fileName: "1805700000000-AddTossBillingKeyEntity",
    className: "AddTossBillingKeyEntity1805700000000",
  },
  {
    fileName: "1806000000000-AddMarketplaceSupport",
    className: "AddMarketplaceSupport1806000000000",
  },
  {
    fileName: "1806100000000-AddRefundRequests",
    className: "AddRefundRequests1806100000000",
  },
  {
    fileName: "1807000000000-AddDeliveryItems",
    className: "AddDeliveryItems1807000000000",
  },
  {
    fileName: "1807100000000-AddFileDeliverySafety",
    className: "AddFileDeliverySafety1807100000000",
  },
  {
    fileName: "1807200000000-AddTransactionChat",
    className: "AddTransactionChat1807200000000",
  },
  {
    fileName: "1807300000000-AddProductReviewsAndSellerProfiles",
    className: "AddProductReviewsAndSellerProfiles1807300000000",
  },
  {
    fileName: "1807400000000-UpdateMinimumPrice",
    className: "UpdateMinimumPrice1807400000000",
  },
  {
    fileName: "1808001000000-CreateKnowledgeGraphTables",
    className: "CreateKnowledgeGraphTables1808001000000",
  },
  {
    fileName: "1808101000000-AddKnowledgeCandidateArtifacts",
    className: "AddKnowledgeCandidateArtifacts1808101000000",
  },
  {
    fileName: "1808200000000-AddCookieConsentAuditAction",
    className: "AddCookieConsentAuditAction1808200000000",
  },
] as const satisfies readonly MigrationManifestEntry[];

/** Existing timestamp ties are frozen for private deployment compatibility. */
export const MIGRATION_TIMESTAMP_TIE_ALLOWLIST: Readonly<
  Record<string, readonly string[]>
> = {
  "1761000000000": [
    "RecalculateRepliesCount1761000000000",
    "RenameTagListToTagsColumn1761000000000",
  ],
  "1761100000000": [
    "AddRedirectToOldAliases1761100000000",
    "AddTermsAcceptanceFields1761100000000",
  ],
  "1761200000000": [
    "AddDeletedAtToPosts1761200000000",
    "MakeCategoryRequired1761200000000",
  ],
  "1778000000000": [
    "AddHomepagePerformanceIndexes1778000000000",
    "RemoveRecursiveSearchTrigger1778000000000",
  ],
  "1782000000000": [
    "AddAdminRoleToCommunity1782000000000",
    "AddCommunityCommentDislike1782000000000",
    "AddCommunitySidebarWidgets1782000000000",
    "AddReportAndRemovalReasonTables1782000000000",
  ],
  "1782000000001": [
    "AddAdultVerificationFields1782000000001",
    "AddRuleFlairWidgetTypes1782000000001",
  ],
  "1784000000000": [
    "AddCommunityInviteSystem1784000000000",
    "AddModeratorPermissionsSystem1784000000000",
  ],
  "1785000000000": [
    "AddFeedSortingIndexes1785000000000",
    "CreateVideosTable1785000000000",
  ],
  "1786000000000": [
    "AddCommunityJoinPolicyIndex1786000000000",
    "AddVideoThumbnail1786000000000",
  ],
  "1805000000000": [
    "AddOutboxReliabilityAndIdempotency1805000000000",
    "CreatePopularPostSnapshots1805000000000",
  ],
  "1805100000000": [
    "AddOutboxRequestContext1805100000000",
    "AddPopularBatchIndexes1805100000000",
  ],
  "1805200000000": [
    "AddPostFileImageOrder1805200000000",
    "AddPostVisibility1805200000000",
  ],
};

function loadMigration(entry: MigrationManifestEntry): MigrationConstructor {
  // This is an exact manifest path, not filesystem discovery.
  // The manifest is a validated static allow-list; dynamic loading preserves
  // TypeORM's migration discovery behavior without importing 136 modules eagerly.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const migrationModule = require(`./${entry.fileName}`) as Record<
    string,
    unknown
  >;
  const migration = migrationModule[entry.className];

  if (typeof migration !== "function") {
    throw new Error(
      `Migration manifest entry ${entry.fileName} does not export ${entry.className}`,
    );
  }

  return migration as MigrationConstructor;
}

export const ORDERED_MIGRATIONS: MigrationConstructor[] =
  MIGRATION_MANIFEST.map(loadMigration);

import Foundation

struct FeedResponse: Decodable {
    let items: [FeedPost]
    let nextCursor: String?
    let hasMore: Bool
    let count: Int?

    enum CodingKeys: String, CodingKey {
        case items
        case nextCursor
        case hasMore
        case count
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        items = (try? container.decode([FeedPost].self, forKey: .items)) ?? []
        nextCursor = try? container.decodeIfPresent(String.self, forKey: .nextCursor)
        count = try? container.decodeIfPresent(Int.self, forKey: .count)
        hasMore = try container.decodeIfPresent(Bool.self, forKey: .hasMore) ?? false
    }

    var cursor: String? {
        nextCursor
    }
}

struct FeedCommunity: Decodable, Hashable {
    let id: String
    let slug: String?
    let name: String?
    let iconUrl: String?
}

struct FeedBlogMini: Decodable, Hashable {
    let id: String?
    let slug: String?
    let name: String?
    let alias: String?
}

struct FeedPost: Identifiable, Decodable, Hashable {
    let id: String
    let title: String
    let slug: String?
    let excerpt: String?
    let sourceType: String?
    let community: FeedCommunity?
    let blog: FeedBlogMini?
    let thumbnail: String?
    let images: [String]?
    let author: FeedAuthor?
    let likeCount: Int?
    let commentCount: Int?
    let viewCount: Int?
    let createdAt: String?
    let updatedAt: String?
    let isNsfw: Bool?
    let isPinned: Bool?
    let isSpoiler: Bool?
    let userVote: MobileVoteType?
    let liked: Bool?

    var headline: String {
        switch sourceType {
        case "community":
            return "\(author?.username ?? "익명") · \(community?.name ?? "커뮤니티")"
        default:
            return author?.username ?? "Unknown"
        }
    }

    var isCommunitySource: Bool {
        if sourceType?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "community" {
            return true
        }
        if let slug = community?.slug?.trimmingCharacters(in: .whitespacesAndNewlines) {
            return !slug.isEmpty
        }
        return false
    }
}

struct FeedAuthor: Decodable, Hashable {
    let id: String?
    let username: String
    let profileImage: String?
    let avatarUrl: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case username
        case profileImage
        case avatarUrl
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let idString = try? container.decode(String.self, forKey: .id) {
            id = idString
        } else if let idInt = try? container.decode(Int.self, forKey: .id) {
            id = String(idInt)
        } else {
            id = nil
        }
        username = (try? container.decode(String.self, forKey: .username)) ?? "Unknown"
        avatarUrl = try? container.decodeIfPresent(String.self, forKey: .avatarUrl)
        let decodedProfileImage = try? container.decodeIfPresent(String.self, forKey: .profileImage)
        profileImage = decodedProfileImage ?? avatarUrl
    }
}

enum PostDetailTarget: Hashable {
    case blog(postId: String)
    case community(communitySlug: String, postId: String, postSlug: String?)
    case unsupported(reason: String, postId: String?)
}

struct CommunityPostPayload: Decodable {
    let id: String
    let title: String
    let slug: String?
    let content: String?
    let contentMarkdown: String?
    let contentType: String?
    let status: String?
    let thumbnailImageUrl: String?
    let thumbnail: String?
    let isPublished: Bool?
    let likeCount: Int?
    let commentCount: Int?
    let viewCount: Int?
    let upvoteCount: Int?
    let downvoteCount: Int?
    let score: Int?
    let createdAt: String?
    let updatedAt: String?
    let userVote: String?
    let liked: Bool?

    private enum CodingKeys: String, CodingKey {
        case id
        case title
        case slug
        case content
        case contentMarkdown = "content_markdown"
        case contentType = "content_type"
        case status
        case thumbnailImageUrl
        case thumbnail
        case isPublished
        case likeCount = "likeCount"
        case commentCount
        case viewCount
        case upvoteCount
        case downvoteCount
        case score
        case createdAt
        case updatedAt
        case userVote
        case liked
    }

    func toMobilePost() -> MobilePost {
        let resolvedThumbnail = thumbnailImageUrl ?? thumbnail
        let resolvedUserVote = userVote.flatMap(MobileVoteType.init)
        let resolvedPublished = status == nil ? isPublished : (status == "published" ? true : isPublished)

        return MobilePost(
            id: id,
            title: title,
            slug: slug,
            excerpt: nil,
            content: content,
            contentMarkdown: contentMarkdown,
            contentType: contentType,
            sourceType: "community",
            thumbnail: resolvedThumbnail,
            images: nil,
            isPublished: resolvedPublished,
            author: nil,
            blog: nil,
            likeCount: likeCount,
            commentCount: commentCount,
            viewCount: viewCount,
            upvoteCount: upvoteCount,
            downvoteCount: downvoteCount,
            score: score,
            createdAt: createdAt,
            updatedAt: updatedAt,
            userVote: resolvedUserVote,
            liked: liked,
            message: nil
        )
    }
}

struct CommunityPostEnvelope: Decodable {
    let success: Bool?
    let data: CommunityPostPayload?
}

struct CommunityCommentEnvelope: Decodable {
    let success: Bool?
    let message: String?
    let data: PostComment?
}

struct CommunityCommentsResponse: Decodable {
    let comments: [PostComment]?
    let nextCursor: String?
    let hasNextPage: Bool?
    let snapshotTimestamp: String?

    var allComments: [PostComment] {
        comments ?? []
    }
}

struct LegacyPostCommentsResponse: Decodable {
    let comments: [PostComment]?
    let nextCursor: String?
    let hasNextPage: Bool?
    let totalCount: Int?
    let snapshotTimestamp: String?

    var allComments: [PostComment] {
        comments ?? []
    }
}

struct CommunityCommentsEnvelope: Decodable {
    let success: Bool?
    let data: CommunityCommentsResponse?
}

enum CommentSort: String, CaseIterable, Identifiable {
    case popular
    case recent

    var id: String { rawValue }

    var title: String {
        switch self {
        case .popular:
            return "인기"
        case .recent:
            return "최근"
        }
    }
}

struct PostAuthor: Decodable, Hashable {
    let id: String?
    let username: String?
    let profileImage: String?
}

struct MobilePostBlog: Decodable, Hashable {
    let id: String
    let slug: String
    let name: String
    let alias: String?
}

enum MobileVoteType: String, Codable {
    case upvote
    case downvote
}

enum MobileVoteAction: String, Codable {
    case added
    case removed
    case changed
}

struct MobilePostVoteResponse: Decodable {
    let action: MobileVoteAction
    let userVote: MobileVoteType?
    let upvoteCount: Int?
    let downvoteCount: Int?
    let score: Int?
    let liked: Bool?
    let likeCount: Int?
}

struct MobilePost: Decodable, Hashable {
    let id: String
    let title: String
    let slug: String?
    let excerpt: String?
    let content: String?
    let contentMarkdown: String?
    let contentType: String?
    let sourceType: String?
    let thumbnail: String?
    let images: [String]?
    let isPublished: Bool?
    let author: PostAuthor?
    let blog: MobilePostBlog?
    let likeCount: Int?
    let commentCount: Int?
    let viewCount: Int?
    let upvoteCount: Int?
    let downvoteCount: Int?
    let score: Int?
    let createdAt: String?
    let updatedAt: String?
    let userVote: MobileVoteType?
    let liked: Bool?
    let message: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case title
        case slug
        case excerpt
        case content
        case contentMarkdown = "content_markdown"
        case contentType = "content_type"
        case sourceType
        case thumbnail
        case images
        case isPublished
        case author
        case blog
        case likeCount
        case commentCount
        case viewCount
        case upvoteCount
        case downvoteCount
        case score
        case createdAt
        case updatedAt
        case userVote
        case liked
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? container.decode(String.self, forKey: .id)) ?? UUID().uuidString
        title = (try? container.decode(String.self, forKey: .title)) ?? "제목 없음"
        slug = try? container.decodeIfPresent(String.self, forKey: .slug)
        excerpt = try? container.decodeIfPresent(String.self, forKey: .excerpt)
        content = try? container.decodeIfPresent(String.self, forKey: .content)
        contentMarkdown = try? container.decodeIfPresent(String.self, forKey: .contentMarkdown)
        contentType = try? container.decodeIfPresent(String.self, forKey: .contentType)
        sourceType = try? container.decodeIfPresent(String.self, forKey: .sourceType)
        thumbnail = try? container.decodeIfPresent(String.self, forKey: .thumbnail)
        images = try? container.decodeIfPresent([String].self, forKey: .images)
        isPublished = try? container.decodeIfPresent(Bool.self, forKey: .isPublished)
        author = try? container.decodeIfPresent(PostAuthor.self, forKey: .author)
        blog = try? container.decodeIfPresent(MobilePostBlog.self, forKey: .blog)
        likeCount = try? container.decodeIfPresent(Int.self, forKey: .likeCount)
        commentCount = try? container.decodeIfPresent(Int.self, forKey: .commentCount)
        viewCount = try? container.decodeIfPresent(Int.self, forKey: .viewCount)
        upvoteCount = try? container.decodeIfPresent(Int.self, forKey: .upvoteCount)
        downvoteCount = try? container.decodeIfPresent(Int.self, forKey: .downvoteCount)
        score = try? container.decodeIfPresent(Int.self, forKey: .score)
        createdAt = try? container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try? container.decodeIfPresent(String.self, forKey: .updatedAt)
        userVote = try? container.decodeIfPresent(MobileVoteType.self, forKey: .userVote)
        liked = try? container.decodeIfPresent(Bool.self, forKey: .liked)
        message = try? container.decodeIfPresent(String.self, forKey: .message)
    }

    init(
        id: String,
        title: String,
        slug: String?,
        excerpt: String?,
        content: String?,
        contentMarkdown: String?,
        contentType: String?,
        sourceType: String?,
        thumbnail: String?,
        images: [String]?,
        isPublished: Bool?,
        author: PostAuthor?,
        blog: MobilePostBlog?,
        likeCount: Int?,
        commentCount: Int?,
        viewCount: Int?,
        upvoteCount: Int?,
        downvoteCount: Int?,
        score: Int?,
        createdAt: String?,
        updatedAt: String?,
        userVote: MobileVoteType?,
        liked: Bool?,
        message: String? = nil,
    ) {
        self.id = id
        self.title = title
        self.slug = slug
        self.excerpt = excerpt
        self.content = content
        self.contentMarkdown = contentMarkdown
        self.contentType = contentType
        self.sourceType = sourceType
        self.thumbnail = thumbnail
        self.images = images
        self.isPublished = isPublished
        self.author = author
        self.blog = blog
        self.likeCount = likeCount
        self.commentCount = commentCount
        self.viewCount = viewCount
        self.upvoteCount = upvoteCount
        self.downvoteCount = downvoteCount
        self.score = score
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.userVote = userVote
        self.liked = liked
        self.message = message
    }
}

extension MobilePost {
    func withVoted(_ type: MobileVoteType?) -> MobilePost {
        let nextVote: MobileVoteType?
        if userVote == type {
            nextVote = nil
        } else {
            nextVote = type
        }

        let nextLikeCount: Int?
        let nextUpvote = upvoteCount ?? 0
        let nextDownvote = downvoteCount ?? 0
        let nextScore = (nextUpvote - nextDownvote)

        return MobilePost(
            id: id,
            title: title,
            slug: slug,
            excerpt: excerpt,
            content: content,
            contentMarkdown: contentMarkdown,
            contentType: contentType,
            sourceType: sourceType,
            thumbnail: thumbnail,
            images: images,
            isPublished: isPublished,
            author: author,
            blog: blog,
            likeCount: likeCount,
            commentCount: commentCount,
            viewCount: viewCount,
            upvoteCount: nextUpvote,
            downvoteCount: nextDownvote,
            score: nextScore,
            createdAt: createdAt,
            updatedAt: updatedAt,
            userVote: nextVote,
            liked: nextVote == .upvote ? true : (nextVote == .downvote ? false : liked),
            message: message
        )
    }

    func withCommentCount(_ nextCount: Int?) -> MobilePost {
        MobilePost(
            id: id,
            title: title,
            slug: slug,
            excerpt: excerpt,
            content: content,
            contentMarkdown: contentMarkdown,
            contentType: contentType,
            sourceType: sourceType,
            thumbnail: thumbnail,
            images: images,
            isPublished: isPublished,
            author: author,
            blog: blog,
            likeCount: likeCount,
            commentCount: nextCount,
            viewCount: viewCount,
            upvoteCount: upvoteCount,
            downvoteCount: downvoteCount,
            score: score,
            createdAt: createdAt,
            updatedAt: updatedAt,
            userVote: userVote,
            liked: liked,
            message: message
        )
    }
}

struct PostCommentAuthor: Decodable, Hashable {
    let id: String?
    let username: String?
    let profileImage: String?
}

struct PostComment: Decodable, Hashable, Identifiable {
    let id: String
    let content: String
    let postId: String?
    let authorId: String?
    let parentCommentId: String?
    let likesCount: Int?
    let dislikesCount: Int?
    let repliesCount: Int?
    let createdAt: String?
    let author: PostCommentAuthor?
    let replies: [PostComment]?
    let userLiked: Bool?
    let userDisliked: Bool?
}

extension PostComment {
    func withReplies(_ nextReplies: [PostComment]?) -> PostComment {
        PostComment(
            id: id,
            content: content,
            postId: postId,
            authorId: authorId,
            parentCommentId: parentCommentId,
            likesCount: likesCount,
            dislikesCount: dislikesCount,
            repliesCount: repliesCount,
            createdAt: createdAt,
            author: author,
            replies: nextReplies,
            userLiked: userLiked,
            userDisliked: userDisliked
        )
    }

    func withReaction(liked: Bool?, likesCount: Int?, dislikesCount: Int?) -> PostComment {
        PostComment(
            id: id,
            content: content,
            postId: postId,
            authorId: authorId,
            parentCommentId: parentCommentId,
            likesCount: likesCount ?? self.likesCount,
            dislikesCount: dislikesCount ?? self.dislikesCount,
            repliesCount: repliesCount,
            createdAt: createdAt,
            author: author,
            replies: replies,
            userLiked: liked ?? userLiked,
            userDisliked: liked == nil ? userDisliked : (liked == true ? false : userDisliked)
        )
    }
}

extension MobilePost {
    func withViewCountIncremented() -> MobilePost {
        let nextViewCount = (viewCount ?? 0) + 1
        return MobilePost(
            id: id,
            title: title,
            slug: slug,
            excerpt: excerpt,
            content: content,
            contentMarkdown: contentMarkdown,
            contentType: contentType,
            sourceType: sourceType,
            thumbnail: thumbnail,
            images: images,
            isPublished: isPublished,
            author: author,
            blog: blog,
            likeCount: likeCount,
            commentCount: commentCount,
            viewCount: nextViewCount,
            upvoteCount: upvoteCount,
            downvoteCount: downvoteCount,
            score: score,
            createdAt: createdAt,
            updatedAt: updatedAt,
            userVote: userVote,
            liked: liked,
            message: message
        )
    }
}

struct CommentReactionResult: Decodable {
    let liked: Bool?
    let likesCount: Int?
    let dislikesCount: Int?
}

struct CommunityCommentReactionEnvelope: Decodable {
    let success: Bool?
    let data: CommentReactionResult?
}

struct MobilePostCreatePayload: Encodable {
    let title: String
    let content: String
    let content_markdown: String?
    let category: String
    let isPublished: Bool
    let attachedFileIds: [String]?
    let thumbnailImageId: String?
}

struct MobileCreateUploadUrlPayload: Encodable {
    let fileName: String
    let mimeType: String
    let fileSize: Int
    let fileType: String
}

struct MobileCreateUploadUrlResponse: Decodable {
    let uploadUrl: String
    let fileKey: String?
    let s3Key: String?
}

struct MobileUploadCompletePayload: Encodable {
    let fileKey: String
    let fileUrl: String
    let fileName: String
    let mimeType: String
    let fileSize: Int
    let fileType: String
}

struct MobileUploadedFile: Decodable {
    let id: String
    let fileKey: String?
    let fileUrl: String?
    let accessUrl: String?
}

struct MobilePostCommentCreatePayload: Encodable {
    let content: String
    let parentCommentId: String?
}

struct Community: Decodable, Hashable, Identifiable {
    let id: String
    let slug: String
    let name: String
    let description: String?
    let iconUrl: String?
    let bannerUrl: String?
    let memberCount: Int?
    let postCount: Int?
    let isNsfw: Bool?
    let userMembership: CommunityMembership?
    let isPublic: Bool?
    let joinPolicy: String?
}

struct CommunityMembership: Decodable, Hashable {
    let isMember: Bool
    let role: String?
    let status: String?
}

struct CommunityListResponse: Decodable {
    let success: Bool
    let data: CommunityListData

    init(from decoder: Decoder) throws {
        let wrapper = try? CommunityListResponseWrapper(from: decoder)
        if let wrapper {
            success = wrapper.success
            data = wrapper.data
            return
        }

        data = (try? CommunityListData(from: decoder)) ?? CommunityListData(
            items: [],
            nextCursor: nil,
            nextCursorId: nil,
            hasNext: false,
            hasMore: false
        )
        success = true
    }

    var hasMore: Bool {
        data.hasNext ?? data.hasMore ?? false
    }

    var cursor: String? {
        data.nextCursor
    }
}

private struct CommunityListResponseWrapper: Decodable {
    let success: Bool
    let data: CommunityListData
}

struct CommunityListData: Decodable {
    let items: [Community]
    let nextCursor: String?
    let nextCursorId: String?
    let hasNext: Bool?
    let hasMore: Bool?
}

struct UserProfileUpdatePayload: Decodable, Encodable {
    let username: String?
    let email: String?
    let bio: String?
    let jobTitle: String?
    let profileImage: String?
}

struct FileUploadResponse: Decodable {
    let fileId: String?
    let contextId: String?
    let s3Key: String?
    let url: String?
    let version: Int?
}

struct MarketingPreferencesPayload: Encodable {
    let marketingOptIn: Bool?
    let newsletterOptIn: Bool?
}

struct MobileBlog: Decodable, Hashable, Identifiable {
    let id: String
    let slug: String
    let name: String
    let description: String?
    let alias: String?
    let thumbnailUrl: String?
    let isPublic: Bool?
    let allowComments: Bool?
    let logoUrl: String?
    let iconUrl: String?
    let coverImageUrl: String?
    let brandColor: String?
}

struct AliasCheckResponse: Decodable {
    let available: Bool
}

struct BlogAliasPayload: Encodable {
    let alias: String
}

struct CommunityActionResponse: Decodable {
    let success: Bool?
    let message: String?
    let data: CommunityActionPayload?
}

struct CommunityActionPayload: Decodable {
    let status: String?
    let role: String?
}

struct MobileBlogUpdatePayload: Encodable {
    let name: String?
    let description: String?
    let allowComments: Bool?
    let isPublic: Bool?
    let logoUrl: String?
    let iconUrl: String?
    let coverImageUrl: String?
    let brandColor: String?
}

struct VoidResponse: Decodable {}

extension FeedPost {
    func withVote(response: MobilePostVoteResponse, requestedVote: MobileVoteType) -> FeedPost {
        let nextVote: MobileVoteType? = {
            if let serverVote = response.userVote {
                return serverVote
            }
            return userVote == requestedVote ? nil : requestedVote
        }()

        let nextLikeCount = response.likeCount ?? likeCount
        let nextLiked = response.liked ?? {
            switch nextVote {
            case .upvote:
                return true
            case .downvote:
                return false
            case nil:
                return liked
            }
        }()

        return FeedPost(
            id: id,
            title: title,
            slug: slug,
            excerpt: excerpt,
            sourceType: sourceType,
            community: community,
            blog: blog,
            thumbnail: thumbnail,
            images: images,
            author: author,
            likeCount: nextLikeCount,
            commentCount: commentCount,
            viewCount: viewCount,
            createdAt: createdAt,
            updatedAt: updatedAt,
            isNsfw: isNsfw,
            isPinned: isPinned,
            isSpoiler: isSpoiler,
            userVote: nextVote,
            liked: nextLiked
        )
    }

    func withIncrementedViewCount() -> FeedPost {
        let nextViewCount = max(0, (viewCount ?? 0) + 1)
        return FeedPost(
            id: id,
            title: title,
            slug: slug,
            excerpt: excerpt,
            sourceType: sourceType,
            community: community,
            blog: blog,
            thumbnail: thumbnail,
            images: images,
            author: author,
            likeCount: likeCount,
            commentCount: commentCount,
            viewCount: nextViewCount,
            createdAt: createdAt,
            updatedAt: updatedAt,
            isNsfw: isNsfw,
            isPinned: isPinned,
            isSpoiler: isSpoiler,
            userVote: userVote,
            liked: liked
        )
    }
}

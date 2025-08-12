# Multi-User Blog System Design

## System Architecture

### Core Principles
1. **One Blog Per User**: Each user can create exactly ONE blog
2. **Blog-Scoped Posts**: Posts belong to specific blogs, not global
3. **Owner-Only Writing**: Users can only write posts in their own blog
4. **User-Defined URLs**: Blog owners choose their blog slug during creation

### URL Structure
```
/                                  # Home - Shows posts from all blogs
/blog/new                         # Create new blog (if user doesn't have one)
/blog/[blogSlug]                  # Specific blog homepage
/blog/[blogSlug]/posts/new        # Write new post in specific blog
/blog/[blogSlug]/posts/[postSlug] # View specific post
/blog/[blogSlug]/settings         # Blog settings (owner only)
/dashboard                        # User dashboard
/posts                           # Global posts view (all blogs)
```

### Data Model
```typescript
User (1) ←→ (1) Blog
  - One user can have exactly one blog
  - Blog.userId is unique

Blog (1) ←→ (N) Posts
  - Posts belong to specific blogs
  - Post.blogId references Blog.id

Blog Fields:
  - id: UUID
  - slug: string (unique, user-defined)
  - name: string
  - description: string
  - userId: UUID (unique - ensures 1:1 relationship)
  - owner: User relation
```

### Permission Matrix
| Action | Who Can Do It |
|--------|--------------|
| Create Blog | Logged-in users without a blog |
| Write Post | Blog owner only |
| Edit Post | Post author only |
| Delete Post | Post author or admin |
| View Blog | Anyone (public) |
| Edit Blog Settings | Blog owner only |

### User Flows

#### 1. Write Button Click (Home/Header)
```mermaid
graph TD
    A[User clicks Write] --> B{Logged in?}
    B -->|No| C[Redirect to /login]
    B -->|Yes| D[Check user's blog]
    D --> E{Has blog?}
    E -->|No| F[Redirect to /blog/new]
    E -->|Yes| G[Redirect to /blog/{userBlogSlug}/posts/new]
```

#### 2. Blog Creation Flow
```mermaid
graph TD
    A[User visits /blog/new] --> B{Already has blog?}
    B -->|Yes| C[Redirect to /blog/{userBlogSlug}]
    B -->|No| D[Show blog creation form]
    D --> E[User enters slug, name, description]
    E --> F[Validate slug availability]
    F --> G{Available?}
    G -->|No| H[Show error, suggest alternatives]
    G -->|Yes| I[Create blog]
    I --> J[Redirect to /blog/{newBlogSlug}]
```

#### 3. Post Creation Flow
```mermaid
graph TD
    A[User visits /blog/{slug}/posts/new] --> B{Is blog owner?}
    B -->|No| C[Show 403 Forbidden]
    B -->|Yes| D[Show post editor]
    D --> E[User writes post]
    E --> F[Submit with blogId]
    F --> G[Create post in blog]
    G --> H[Redirect to /blog/{slug}/posts/{postSlug}]
```

### API Endpoints

#### Blog Management
- `GET /api/v1/blogs/my-blogs` - Get current user's blog
- `POST /api/v1/blogs` - Create new blog
- `GET /api/v1/blogs/slug/:slug` - Get blog by slug
- `GET /api/v1/blogs/check-slug/:slug` - Check slug availability
- `PATCH /api/v1/blogs/:id` - Update blog settings (owner only)

#### Post Management
- `GET /api/v1/posts?blogSlug=:slug` - Get posts for specific blog
- `POST /api/v1/posts` - Create post (auto-assigns to user's blog)
- `PATCH /api/v1/posts/:id` - Update post (author only)
- `DELETE /api/v1/posts/:id` - Delete post (author only)

### Security Considerations
1. **Blog Ownership**: Validate user owns blog before allowing writes
2. **Post Authorization**: Check post author before edit/delete
3. **Slug Validation**: Ensure slugs are URL-safe and unique
4. **Rate Limiting**: Limit blog creation to prevent abuse

### Implementation Phases

#### Phase 1: Core Blog System ✅
- Blog entity with 1:1 user relationship
- Blog creation with user-defined slugs
- Basic blog pages

#### Phase 2: Write Flow Fix (Current)
- Fix header write button logic
- Implement blog check before writing
- Create blog-scoped post editor

#### Phase 3: Authorization
- Backend validation for blog ownership
- Frontend permission checks
- Proper error handling

#### Phase 4: Enhanced Features
- Blog settings page
- Blog customization (themes, etc.)
- Blog analytics
- Multi-author support (future)
# Intelligent MCP Extension for Semantic Code Search & Retrieval

## Executive Summary

This design document outlines an intelligent MCP extension that enables semantic search across codebase.blog content, allowing Claude Code CLI/Desktop to retrieve relevant blog posts and code snippets when users ask programming questions.

## 1. Current State Analysis

### Existing Infrastructure
- **Backend**: NestJS with PostgreSQL, TypeORM
- **MCP Server**: FastMCP-based Python server with API key authentication
- **Content Storage**: Blog posts stored as HTML in PostgreSQL
- **Authentication**: 2-stage auth (user credentials + API key)
- **API Structure**: RESTful endpoints under `/api/v1/mcp`

### Current Capabilities
- Create, read, update, delete blog posts via MCP
- Markdown to HTML conversion
- API key-based authentication
- Rate limiting and logging

## 2. Technical Architecture Design

### 2.1 Core Components

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code CLI/Desktop               │
└────────────┬────────────────────────────────────────────┘
             │ MCP Protocol
┌────────────▼────────────────────────────────────────────┐
│              Enhanced MCP Blog Server (Python)           │
│  ┌──────────────────┐    ┌─────────────────────────┐   │
│  │  Search Handler  │───▶│  Semantic Search Engine │   │
│  └──────────────────┘    └──────────┬───────────────┘   │
└──────────────────────────────────────┼──────────────────┘
                                       │ HTTP/REST
┌──────────────────────────────────────▼──────────────────┐
│                 NestJS Backend (Enhanced)                │
│  ┌───────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ Search Module │  │ Vector Store│  │ Embeddings   │  │
│  │    Service    │  │   (pgvector)│  │   Service    │  │
│  └───────────────┘  └─────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

#### Vector Database & Search
- **pgvector**: PostgreSQL extension for vector similarity search
  - Native integration with existing PostgreSQL
  - No additional infrastructure needed
  - Supports cosine similarity, L2 distance, inner product
  - Cost-effective for MVP

#### Embeddings Generation
- **OpenAI text-embedding-3-small**: 
  - Dimensions: 1536
  - Cost: $0.02 per 1M tokens
  - High quality for technical content
  - Alternative: Cohere embed-english-v3.0 (free tier available)

#### Semantic Search Pipeline
1. **Indexing Phase** (Background Job):
   ```typescript
   // NestJS Service
   async indexPost(post: Post) {
     // Extract searchable content
     const searchableText = this.extractSearchableContent(post);
     
     // Generate embeddings
     const embedding = await this.embeddingService.generate(searchableText);
     
     // Store in pgvector
     await this.vectorStore.upsert({
       postId: post.id,
       embedding: embedding,
       metadata: {
         title: post.title,
         tags: post.tags,
         category: post.category,
         snippet: this.generateSnippet(post.content)
       }
     });
   }
   ```

2. **Search Phase** (Real-time):
   ```python
   # MCP Server Enhancement
   @mcp.tool()
   async def search_code(query: str, limit: int = 5) -> List[Dict]:
       """Search for relevant code examples and blog posts"""
       
       # Call backend search API
       response = await client.post(
           f"{API_URL}/mcp/search",
           json={"query": query, "limit": limit},
           headers={"x-api-key": API_KEY}
       )
       
       # Format results for LLM consumption
       return format_search_results(response.json())
   ```

### 2.3 Database Schema Enhancement

```sql
-- Add vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
CREATE TABLE post_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  chunk_text TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for fast similarity search
CREATE INDEX post_embeddings_embedding_idx ON post_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for post_id lookups
CREATE INDEX idx_post_embeddings_post_id ON post_embeddings(post_id);
```

## 3. Implementation Approach

### Phase 1: MVP (2-3 weeks)
1. **Backend Enhancement**:
   - Install pgvector extension
   - Create embeddings service with OpenAI integration
   - Implement search endpoint with basic ranking
   - Add background job for indexing new/updated posts

2. **MCP Server Enhancement**:
   - Add `search_code` tool
   - Implement result formatting for LLM
   - Add caching layer for frequent queries

3. **Initial Content Processing**:
   - Backfill embeddings for existing posts
   - Implement chunking for long posts (>2000 tokens)

### Phase 2: Optimization (2-3 weeks)
1. **Search Quality**:
   - Implement hybrid search (semantic + keyword)
   - Add re-ranking with cross-encoder
   - Tune similarity thresholds

2. **Performance**:
   - Implement Redis caching for embeddings
   - Add query result caching
   - Optimize vector index parameters

3. **Features**:
   - Code block extraction and separate indexing
   - Language-specific search filters
   - Related content suggestions

### Phase 3: Advanced Features (3-4 weeks)
1. **Intelligence**:
   - Fine-tune embeddings on technical content
   - Implement query expansion
   - Add semantic deduplication

2. **Analytics**:
   - Track search queries and click-through
   - Implement feedback loop for improvement
   - A/B testing for ranking algorithms

## 4. Performance Considerations

### Latency Targets
- **Embedding Generation**: < 500ms per post
- **Search Query**: < 200ms for top-5 results
- **End-to-end MCP Request**: < 1 second

### Optimization Strategies
1. **Caching**:
   - Cache embeddings for 24 hours
   - Cache search results for 1 hour
   - Use Redis for hot data

2. **Batch Processing**:
   - Process new posts in batches
   - Update embeddings asynchronously

3. **Index Optimization**:
   - Use IVFFlat index for vectors > 10,000
   - Tune `lists` parameter based on dataset size
   - Consider HNSW for better recall

## 5. Cost Analysis

### Infrastructure Costs (Monthly)

#### MVP Phase
- **pgvector**: $0 (uses existing PostgreSQL)
- **OpenAI Embeddings**: 
  - Initial indexing (1000 posts × 1000 tokens): $0.02
  - Monthly updates (100 posts): $0.002
  - Search queries (1000/month): $0.01
  - **Total**: ~$0.05/month

- **Redis Cache** (optional): $0 (use existing cache-manager)
- **Additional Storage**: ~100MB for vectors = $0.01

**MVP Total: < $1/month**

#### Scale Phase (10,000 posts, 10,000 queries/month)
- **Embeddings**: ~$0.50/month
- **Storage**: ~1GB = $0.10/month
- **Redis** (if needed): ~$20/month (managed service)

**Scale Total: ~$25/month**

### Development Costs
- **MVP**: 80-120 hours
- **Optimization**: 80-120 hours
- **Advanced**: 120-160 hours

## 6. Implementation Complexity Assessment

### Complexity Breakdown

#### Low Complexity
- pgvector installation and setup
- Basic embedding generation
- Simple similarity search
- MCP tool addition

#### Medium Complexity
- Chunking strategy for long posts
- Hybrid search implementation
- Caching layer
- Result ranking and formatting

#### High Complexity
- Query understanding and expansion
- Fine-tuning embeddings
- Real-time index updates
- A/B testing infrastructure

### Risk Mitigation
1. **Technical Risks**:
   - Use proven libraries (pgvector, OpenAI SDK)
   - Implement comprehensive error handling
   - Add circuit breakers for external APIs

2. **Performance Risks**:
   - Start with small index, scale gradually
   - Monitor query latencies
   - Implement graceful degradation

3. **Cost Risks**:
   - Set spending limits on OpenAI
   - Implement rate limiting
   - Cache aggressively

## 7. Implementation Roadmap

### Week 1-2: Foundation
- [ ] Install pgvector, create schema
- [ ] Implement embedding service
- [ ] Create search endpoint
- [ ] Add MCP search tool

### Week 3-4: MVP Completion
- [ ] Implement chunking strategy
- [ ] Add result formatting
- [ ] Deploy and test with real data
- [ ] Performance baseline

### Week 5-6: Optimization
- [ ] Add caching layers
- [ ] Implement hybrid search
- [ ] Tune similarity thresholds
- [ ] Load testing

### Week 7-8: Polish
- [ ] Add monitoring and analytics
- [ ] Implement feedback collection
- [ ] Documentation
- [ ] Production deployment

## 8. Example Usage

### User Query via Claude Code
```
User: "find code for implementing JWT authentication with refresh tokens using blog MCP"
```

### MCP Server Response
```python
{
  "results": [
    {
      "title": "Implementing Secure JWT Authentication with Refresh Tokens in NestJS",
      "url": "https://codebase.blog/posts/jwt-refresh-tokens-nestjs",
      "relevance_score": 0.92,
      "snippet": "Here's a complete implementation of JWT authentication with refresh tokens...",
      "code_blocks": [
        {
          "language": "typescript",
          "content": "// auth.service.ts\n@Injectable()\nexport class AuthService {..."
        }
      ],
      "tags": ["nestjs", "jwt", "authentication", "security"]
    },
    // ... more results
  ]
}
```

### LLM Integration
Claude would then reference these results to provide a comprehensive answer with real code examples from the blog.

## 9. Success Metrics

### Technical Metrics
- **Search Latency**: P95 < 300ms
- **Relevance Score**: Average > 0.7
- **Cache Hit Rate**: > 60%
- **Index Coverage**: > 95% of posts

### Business Metrics
- **Usage Growth**: 20% month-over-month
- **User Satisfaction**: > 4/5 rating
- **Content Reuse**: 30% of searches lead to code adoption

## 10. Conclusion

This semantic search extension transforms codebase.blog into an intelligent knowledge base that seamlessly integrates with Claude Code. The MVP can be delivered in 2-3 weeks with minimal infrastructure costs (<$1/month), scaling gracefully as usage grows.

The key advantages:
- **Cost-effective**: Leverages existing PostgreSQL infrastructure
- **Scalable**: pgvector handles millions of vectors efficiently
- **Maintainable**: Simple architecture with clear separation of concerns
- **Extensible**: Easy to add advanced features incrementally

The implementation provides immediate value while laying groundwork for future enhancements like multi-modal search, code generation, and personalized recommendations.
/**
 * Mock Factory for File System Tests
 * Provides consistent mock data generation for testing
 */

import { File } from '../../entities/file.entity';
import { FileContext, FileContextType, FilePurpose } from '../../entities/file-context.entity';
import { User } from '../../../users/entities/user.entity';
import { Post } from '../../../posts/entities/post.entity';

export class MockFactory {
  private static idCounter = 1;

  /**
   * Create a mock File entity
   */
  static createMockFile(overrides?: Partial<File>): File {
    const file = new File();
    file.id = `file-${this.idCounter++}`;
    file.originalName = 'test-image.jpg';
    file.fileName = `${file.id}-test-image.jpg`;
    file.fileKey = `uploads/images/2024/01/${file.fileName}`;
    file.fileUrl = `https://test-bucket.s3.amazonaws.com/${file.fileKey}`;
    file.fileSize = 1024 * 100; // 100KB
    file.mimeType = 'image/jpeg';
    file.fileType = 'image';
    file.userId = 'user-123';
    file.contextId = null;
    file.s3Bucket = 'test-bucket';
    file.s3Region = 'us-east-1';
    file.checksum = 'abc123def456';
    file.isOptimized = false;
    file.metadata = {
      width: 1920,
      height: 1080,
      format: 'jpeg',
    };
    file.expiresAt = null;
    file.createdAt = new Date();
    file.updatedAt = new Date();

    return Object.assign(file, overrides);
  }

  /**
   * Create a mock FileContext entity
   */
  static createMockFileContext(overrides?: Partial<FileContext>): FileContext {
    const context = new FileContext();
    context.id = `context-${this.idCounter++}`;
    context.contextType = FileContextType.POST;
    context.contextId = `post-${this.idCounter}`;
    context.purpose = FilePurpose.CONTENT;
    context.ownerId = 'user-123';
    context.fileCount = 0;
    context.totalSize = 0;
    context.version = 1;
    context.isActive = true;
    context.createdAt = new Date();
    context.updatedAt = new Date();
    context.files = [];
    
    // Add custom properties for testing
    (context as any).maxFiles = 10;
    (context as any).maxFileSize = 1024 * 1024 * 5; // 5MB
    (context as any).allowedTypes = ['image/jpeg', 'image/png'];
    (context as any).metadata = {};

    return Object.assign(context, overrides);
  }

  /**
   * Create a mock User entity
   */
  static createMockUser(overrides?: Partial<User>): User {
    const user = new User();
    user.id = `user-${this.idCounter++}`;
    user.email = 'test@example.com';
    user.username = 'testuser';
    user.password = 'hashedpassword';
    user.isEmailVerified = true;
    user.isActive = true;
    user.createdAt = new Date();
    user.updatedAt = new Date();

    return Object.assign(user, overrides);
  }

  /**
   * Create a mock Post entity
   */
  static createMockPost(overrides?: Partial<Post>): Post {
    const post = new Post();
    post.id = `post-${this.idCounter++}`;
    post.title = 'Test Post';
    post.slug = 'test-post';
    post.content = '<p>Test content</p>';
    post.publishedAt = new Date();
    post.authorId = 'user-123';
    post.blogId = 'blog-123';
    post.createdAt = new Date();
    post.updatedAt = new Date();

    return Object.assign(post, overrides);
  }

  /**
   * Create mock S3 response
   */
  static createMockS3Response(operation: string) {
    switch (operation) {
      case 'upload':
        return {
          ETag: '"abc123"',
          Location: 'https://test-bucket.s3.amazonaws.com/test-file.jpg',
          Key: 'test-file.jpg',
          Bucket: 'test-bucket',
        };
      case 'copy':
        return {
          CopyObjectResult: {
            ETag: '"abc123"',
            LastModified: new Date(),
          },
        };
      case 'delete':
        return {
          DeleteMarker: false,
          VersionId: 'v123',
        };
      case 'list':
        return {
          Contents: [
            {
              Key: 'file1.jpg',
              Size: 1024,
              LastModified: new Date(),
            },
            {
              Key: 'file2.jpg',
              Size: 2048,
              LastModified: new Date(),
            },
          ],
        };
      default:
        return {};
    }
  }

  /**
   * Create batch of mock files for testing migrations
   */
  static createMockFileBatch(count: number, v1Structure = true): File[] {
    const files: File[] = [];
    for (let i = 0; i < count; i++) {
      const file = this.createMockFile({
        fileKey: v1Structure
          ? `uploads/images/2024/01/file-${i}.jpg`
          : `v2/users/user-123/post/content/file-${i}.jpg`,
      });
      files.push(file);
    }
    return files;
  }

  /**
   * Reset ID counter for test isolation
   */
  static resetIdCounter() {
    this.idCounter = 1;
  }
}
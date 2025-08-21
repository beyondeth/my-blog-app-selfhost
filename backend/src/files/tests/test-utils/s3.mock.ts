/**
 * S3 Service Mock Utilities
 * Provides mock implementations for AWS S3 operations
 */

export class MockS3Service {
  private files: Map<string, any> = new Map();

  uploadFile = jest.fn().mockImplementation((file: Express.Multer.File, key: string) => {
    this.files.set(key, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date(),
    });

    return Promise.resolve({
      fileKey: key,
      fileUrl: `https://test-bucket.s3.amazonaws.com/${key}`,
      bucket: 'test-bucket',
      etag: '"abc123"',
    });
  });

  deleteFile = jest.fn().mockImplementation((key: string) => {
    const exists = this.files.has(key);
    if (!exists) {
      return Promise.reject(new Error('File not found'));
    }
    
    this.files.delete(key);
    return Promise.resolve({
      success: true,
      key,
    });
  });

  copyFile = jest.fn().mockImplementation((sourceKey: string, destKey: string) => {
    const file = this.files.get(sourceKey);
    if (!file) {
      return Promise.reject(new Error('Source file not found'));
    }

    this.files.set(destKey, { ...file, copiedAt: new Date() });
    return Promise.resolve({
      success: true,
      sourceKey,
      destKey,
    });
  });

  moveFile = jest.fn().mockImplementation((sourceKey: string, destKey: string) => {
    const file = this.files.get(sourceKey);
    if (!file) {
      return Promise.reject(new Error('Source file not found'));
    }

    this.files.set(destKey, { ...file, movedAt: new Date() });
    this.files.delete(sourceKey);
    
    return Promise.resolve({
      success: true,
      sourceKey,
      destKey,
    });
  });

  getSignedUrl = jest.fn().mockImplementation((key: string, expires = 3600) => {
    if (!this.files.has(key)) {
      return Promise.reject(new Error('File not found'));
    }

    return Promise.resolve(
      `https://test-bucket.s3.amazonaws.com/${key}?X-Amz-Expires=${expires}&X-Amz-Signature=mock`
    );
  });

  listFiles = jest.fn().mockImplementation((prefix: string) => {
    const results: string[] = [];
    
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        results.push(key);
      }
    }

    return Promise.resolve(results);
  });

  transitionToArchive = jest.fn().mockImplementation((key: string) => {
    const file = this.files.get(key);
    if (!file) {
      return Promise.reject(new Error('File not found'));
    }

    file.storageClass = 'GLACIER';
    file.archivedAt = new Date();
    
    return Promise.resolve({
      success: true,
      key,
      storageClass: 'GLACIER',
    });
  });

  generatePresignedPost = jest.fn().mockImplementation((key: string, metadata?: any) => {
    return Promise.resolve({
      url: 'https://test-bucket.s3.amazonaws.com',
      fields: {
        key,
        'Content-Type': metadata?.contentType || 'application/octet-stream',
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': 'mock-credential',
        'X-Amz-Date': new Date().toISOString(),
        'X-Amz-Signature': 'mock-signature',
        Policy: 'mock-policy',
      },
    });
  });

  headObject = jest.fn().mockImplementation((key: string) => {
    const file = this.files.get(key);
    if (!file) {
      return Promise.reject(new Error('File not found'));
    }

    return Promise.resolve({
      ContentLength: file.size,
      ContentType: file.mimetype,
      LastModified: file.uploadedAt,
      ETag: '"abc123"',
      StorageClass: file.storageClass || 'STANDARD',
    });
  });

  // Test utilities
  hasFile(key: string): boolean {
    return this.files.has(key);
  }

  getFile(key: string): any {
    return this.files.get(key);
  }

  getAllFiles(): Map<string, any> {
    return new Map(this.files);
  }

  clear() {
    this.files.clear();
    this.uploadFile.mockClear();
    this.deleteFile.mockClear();
    this.copyFile.mockClear();
    this.moveFile.mockClear();
    this.getSignedUrl.mockClear();
    this.listFiles.mockClear();
    this.transitionToArchive.mockClear();
    this.generatePresignedPost.mockClear();
    this.headObject.mockClear();
  }

  // Simulate S3 errors
  simulateError(operation: string, error: Error) {
    switch (operation) {
      case 'upload':
        this.uploadFile.mockRejectedValueOnce(error);
        break;
      case 'delete':
        this.deleteFile.mockRejectedValueOnce(error);
        break;
      case 'copy':
        this.copyFile.mockRejectedValueOnce(error);
        break;
      case 'move':
        this.moveFile.mockRejectedValueOnce(error);
        break;
      default:
        break;
    }
  }

  // Simulate network delays
  simulateDelay(ms: number) {
    const delay = () => new Promise(resolve => setTimeout(resolve, ms));
    
    const originalUpload = this.uploadFile;
    this.uploadFile = jest.fn().mockImplementation(async (...args) => {
      await delay();
      return originalUpload(...args);
    });
  }
}

/**
 * Create a mock S3 client for AWS SDK
 */
export function createMockS3Client() {
  return {
    send: jest.fn().mockImplementation((command: any) => {
      const commandName = command.constructor.name;
      
      switch (commandName) {
        case 'PutObjectCommand':
          return Promise.resolve({
            ETag: '"abc123"',
            VersionId: 'v1',
          });
        
        case 'DeleteObjectCommand':
          return Promise.resolve({
            DeleteMarker: false,
            VersionId: 'v1',
          });
        
        case 'CopyObjectCommand':
          return Promise.resolve({
            CopyObjectResult: {
              ETag: '"abc123"',
              LastModified: new Date(),
            },
          });
        
        case 'HeadObjectCommand':
          return Promise.resolve({
            ContentLength: 1024,
            ContentType: 'image/jpeg',
            LastModified: new Date(),
            ETag: '"abc123"',
          });
        
        case 'ListObjectsV2Command':
          return Promise.resolve({
            Contents: [
              { Key: 'file1.jpg', Size: 1024 },
              { Key: 'file2.jpg', Size: 2048 },
            ],
            IsTruncated: false,
          });
        
        default:
          return Promise.resolve({});
      }
    }),
  };
}
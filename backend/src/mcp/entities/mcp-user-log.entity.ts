import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ApiKey } from '../../api-keys/entities/api-key.entity';

@Entity('mcp_user_logs')
@Index('IDX_mcp_logs_user_time', ['userId', 'timestamp'])
@Index('IDX_mcp_logs_client', ['clientType', 'timestamp'])
@Index('IDX_mcp_logs_action', ['actionType', 'timestamp'])
@Index('IDX_mcp_logs_resource', ['resourceType', 'resourceSlug'])
@Index('IDX_mcp_logs_api_key', ['apiKeyId', 'timestamp'])
export class McpUserLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string;

  @Column({ name: 'api_key_id', type: 'uuid', nullable: true })
  apiKeyId: string;

  @Column({
    name: 'action_type',
    type: 'varchar',
    length: 50,
    enum: ['read', 'write', 'search'],
  })
  actionType: 'read' | 'write' | 'search';

  @Column({ name: 'action_category', type: 'varchar', length: 50, nullable: true })
  actionCategory: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 50, nullable: true })
  resourceType: string;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId: string;

  @Column({ name: 'resource_slug', type: 'varchar', length: 255, nullable: true })
  resourceSlug: string;

  @Column({ name: 'client_type', type: 'varchar', length: 50, nullable: true })
  clientType: string; // claude, chatgpt, gemini, qwen, unknown

  @Column({ name: 'client_name', type: 'varchar', length: 100, nullable: true })
  clientName: string;

  @Column({ name: 'client_version', type: 'varchar', length: 50, nullable: true })
  clientVersion: string;

  @Column({ name: 'request_endpoint', type: 'varchar', length: 255, nullable: true })
  requestEndpoint: string;

  @Column({ name: 'request_method', type: 'varchar', length: 10, nullable: true })
  requestMethod: string;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus: number;

  @Column({ name: 'response_time_ms', type: 'int', nullable: true })
  responseTimeMs: number;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => ApiKey, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'api_key_id' })
  apiKey: ApiKey;
}
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('suspicious_requests')
@Index(['requestType', 'createdAt'])
@Index(['ipAddress', 'createdAt'])
export class SuspiciousRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  requestType: string; // 'EXCESSIVE_LIMIT', 'RATE_LIMIT', 'AUTH_FAILURE', etc.

  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ type: 'varchar', length: 255 })
  endpoint: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userEmail: string | null;

  @Column({ type: 'jsonb' })
  requestDetails: {
    method: string;
    query?: Record<string, any>;
    headers?: Record<string, string>;
    body?: any;
    attemptedLimit?: number;
    actualLimit?: number;
  };

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @Column({ type: 'varchar', length: 20, default: 'WARNING' })
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'WARNING';

  @Column({ type: 'boolean', default: false })
  isResolved: boolean;

  @Column({ type: 'text', nullable: true })
  resolvedNote: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date;
}
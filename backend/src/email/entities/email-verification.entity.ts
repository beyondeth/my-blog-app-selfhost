import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity('email_verifications')
@Index(['email', 'code'])
@Index(['expiresAt'])
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  email: string;

  @Column({ length: 6 })
  code: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: 0 })
  attemptCount: number;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  verifiedAt: Date;

  @Column({ nullable: true, length: 255 })
  sessionToken: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
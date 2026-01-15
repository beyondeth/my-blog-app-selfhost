import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * IP 컬럼 크기 확장 (45 -> 150)
 * 
 * 암호화된 IP 저장을 위해 컬럼 크기 확장
 * 형식: IV:AuthTag:EncryptedData (약 100자)
 */
export class ExtendIpAddressColumnSize1794100000000 implements MigrationInterface {
    name = 'ExtendIpAddressColumnSize1794100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Posts 테이블 ip_address 컬럼 크기 확장
        await queryRunner.query(`
            ALTER TABLE "posts" 
            ALTER COLUMN "ip_address" TYPE VARCHAR(150)
        `);

        // Comments 테이블 ip_address 컬럼 크기 확장
        await queryRunner.query(`
            ALTER TABLE "comments" 
            ALTER COLUMN "ip_address" TYPE VARCHAR(150)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 롤백: 원래 크기로 복원 (데이터 손실 가능성 있음)
        await queryRunner.query(`
            ALTER TABLE "posts" 
            ALTER COLUMN "ip_address" TYPE VARCHAR(45)
        `);

        await queryRunner.query(`
            ALTER TABLE "comments" 
            ALTER COLUMN "ip_address" TYPE VARCHAR(45)
        `);
    }
}

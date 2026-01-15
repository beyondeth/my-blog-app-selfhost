import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * IP 차단 목록 컬럼 크기 확장 (45 -> 150)
 * 
 * 암호화된 IP 저장을 위해 ip_block_list 테이블의 컬럼 크기도 확장해야 함.
 * 이전 마이그레이션에서 누락된 부분을 보완.
 */
export class ExtendIpBlockListColumnSize1794200000000 implements MigrationInterface {
    name = 'ExtendIpBlockListColumnSize1794200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ip_block_list 테이블 ip_address 컬럼 크기 확장
        await queryRunner.query(`
            ALTER TABLE "ip_block_list" 
            ALTER COLUMN "ip_address" TYPE VARCHAR(150)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 롤백: 원래 크기로 복원 (데이터 손실 가능성 있음)
        await queryRunner.query(`
            ALTER TABLE "ip_block_list" 
            ALTER COLUMN "ip_address" TYPE VARCHAR(45)
        `);
    }
}

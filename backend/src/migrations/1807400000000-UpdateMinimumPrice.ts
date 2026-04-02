import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 최소 상품 가격 100원 → 1,000원으로 변경
 * product_details 테이블의 CHECK 제약조건 업데이트
 */
export class UpdateMinimumPrice1807400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 기존 CHECK 제약조건 삭제 후 새로 생성
    // TypeORM @Check 데코레이터가 생성하는 제약조건명 패턴: CHK_{hash}
    // 직접 조회하여 삭제
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        SELECT con.conname INTO constraint_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'product_details'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%price%100%';

        IF constraint_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE product_details DROP CONSTRAINT ' || quote_ident(constraint_name);
        END IF;
      END $$;
    `);

    // 새 CHECK 제약조건 추가 (최소 1,000원)
    await queryRunner.query(`
      ALTER TABLE product_details
      ADD CONSTRAINT "CHK_product_details_min_price"
      CHECK ("price" >= 1000)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE product_details
      DROP CONSTRAINT IF EXISTS "CHK_product_details_min_price"
    `);

    await queryRunner.query(`
      ALTER TABLE product_details
      ADD CONSTRAINT "CHK_product_details_min_price_legacy"
      CHECK ("price" >= 100)
    `);
  }
}

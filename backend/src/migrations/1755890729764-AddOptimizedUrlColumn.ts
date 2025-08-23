import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOptimizedUrlColumn1755890729764 implements MigrationInterface {
    name = 'AddOptimizedUrlColumn1755890729764'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('files', new TableColumn({
            name: 'optimized_url',
            type: 'varchar',
            isNullable: true,
            comment: 'WebP 변환된 이미지의 S3 키'
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('files', 'optimized_url');
    }
}

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFileStatusColumn1755611000000 implements MigrationInterface {
    name = 'AddFileStatusColumn1755611000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('files', new TableColumn({
            name: 'file_status',
            type: 'varchar',
            default: "'temp'",
            comment: '파일 상태: temp(임시), processing(처리중), published(게시됨)'
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('files', 'file_status');
    }
}
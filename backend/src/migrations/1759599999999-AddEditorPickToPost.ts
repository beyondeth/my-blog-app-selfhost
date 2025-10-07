import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

/**
 * Editor's Pick 기능 추가
 * - isEditorPick: 관리자가 선정한 추천 포스트 여부
 * - editorPickedAt: Editor's Pick으로 선정된 시간 (정렬용)
 * - 복합 인덱스: (isEditorPick, editorPickedAt) 추가
 */
export class AddEditorPickToPost1759599999999 implements MigrationInterface {
    name = 'AddEditorPickToPost1759599999999'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // isEditorPick 컬럼 추가 (boolean, default: false)
        await queryRunner.addColumn('posts', new TableColumn({
            name: 'isEditorPick',
            type: 'boolean',
            default: false,
            isNullable: false,
        }));

        // editorPickedAt 컬럼 추가 (timestamp, nullable)
        await queryRunner.addColumn('posts', new TableColumn({
            name: 'editorPickedAt',
            type: 'timestamp',
            isNullable: true,
        }));

        // 복합 인덱스 추가: (isEditorPick, editorPickedAt DESC)
        // Editor's Pick 조회 시 성능 최적화
        await queryRunner.createIndex('posts', new TableIndex({
            name: 'IDX_POSTS_EDITOR_PICK',
            columnNames: ['isEditorPick', 'editorPickedAt'],
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 인덱스 삭제
        await queryRunner.dropIndex('posts', 'IDX_POSTS_EDITOR_PICK');

        // 컬럼 삭제
        await queryRunner.dropColumn('posts', 'editorPickedAt');
        await queryRunner.dropColumn('posts', 'isEditorPick');
    }
}

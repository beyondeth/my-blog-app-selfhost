import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Resource Indicators (RFC 8707) 지원을 위한 필드 추가
 *
 * Authorization Code에 resource 파라미터를 저장하여
 * Access Token의 audience (aud) claim에 포함시킴
 *
 * 이를 통해 토큰이 특정 Resource Server(MCP 서버)에만
 * 사용되도록 바인딩할 수 있습니다.
 */
export class AddResourceIndicatorField1737100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // oauth_codes 테이블에 resource 컬럼 추가
    await queryRunner.addColumn(
      'oauth_codes',
      new TableColumn({
        name: 'resource',
        type: 'varchar',
        length: '500',
        isNullable: true,
        comment: 'Resource Indicator (RFC 8707) - MCP 서버 URI, Access Token의 audience claim으로 사용',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // resource 컬럼 제거
    await queryRunner.dropColumn('oauth_codes', 'resource');
  }
}

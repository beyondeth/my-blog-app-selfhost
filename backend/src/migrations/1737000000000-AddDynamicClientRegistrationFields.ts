import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Dynamic Client Registration 지원을 위한 필드 추가
 * RFC 7591 (Dynamic Client Registration) 표준 준수
 *
 * 추가 필드:
 * - isDynamic: 동적 등록 여부
 * - isPublic: Public Client 여부 (PKCE 사용)
 * - tokenEndpointAuthMethod: Token Endpoint 인증 방법
 * - issuedAt: 클라이언트 등록 시간 (Unix timestamp)
 */
export class AddDynamicClientRegistrationFields1737000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. isDynamic 컬럼 추가
    await queryRunner.addColumn(
      'oauth_clients',
      new TableColumn({
        name: 'isDynamic',
        type: 'boolean',
        default: false,
        comment: '동적 등록 여부 (RFC 7591)',
      }),
    );

    // 2. isPublic 컬럼 추가
    await queryRunner.addColumn(
      'oauth_clients',
      new TableColumn({
        name: 'isPublic',
        type: 'boolean',
        default: false,
        comment: 'Public Client 여부 (PKCE 필수, client_secret 불필요)',
      }),
    );

    // 3. tokenEndpointAuthMethod 컬럼 추가
    await queryRunner.addColumn(
      'oauth_clients',
      new TableColumn({
        name: 'tokenEndpointAuthMethod',
        type: 'varchar',
        length: '50',
        default: "'client_secret_post'",
        comment: 'Token Endpoint 인증 방법 (none, client_secret_post, client_secret_basic)',
      }),
    );

    // 4. issuedAt 컬럼 추가
    await queryRunner.addColumn(
      'oauth_clients',
      new TableColumn({
        name: 'issuedAt',
        type: 'bigint',
        isNullable: true,
        comment: '클라이언트 등록 시간 (Unix timestamp, RFC 7591 client_id_issued_at)',
      }),
    );

    // 5. 기존 클라이언트들에 대해 issuedAt 설정 (createdAt 기반)
    await queryRunner.query(`
      UPDATE oauth_clients
      SET "issuedAt" = EXTRACT(EPOCH FROM "createdAt")::bigint
      WHERE "issuedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 역순으로 컬럼 제거
    await queryRunner.dropColumn('oauth_clients', 'issuedAt');
    await queryRunner.dropColumn('oauth_clients', 'tokenEndpointAuthMethod');
    await queryRunner.dropColumn('oauth_clients', 'isPublic');
    await queryRunner.dropColumn('oauth_clients', 'isDynamic');
  }
}

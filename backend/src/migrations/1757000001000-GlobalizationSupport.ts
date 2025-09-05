import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class GlobalizationSupport1757000001000 implements MigrationInterface {
  name = 'GlobalizationSupport1757000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🌍 Starting Globalization Support Migration...');

    // ====================================
    // 1. 다국어 지원 테이블 생성
    // ====================================
    console.log('Creating content translations table...');
    
    await queryRunner.createTable(
      new Table({
        name: 'content_translations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'entity_type',
            type: 'varchar',
            length: '50',
            comment: 'post, blog, comment, etc.',
          },
          {
            name: 'entity_id',
            type: 'uuid',
          },
          {
            name: 'language_code',
            type: 'varchar',
            length: '10',
            comment: 'en, ko, ja, zh, es, fr, de, etc.',
          },
          {
            name: 'field_name',
            type: 'varchar',
            length: '50',
            comment: 'title, content, description, etc.',
          },
          {
            name: 'translated_value',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_auto_translated',
            type: 'boolean',
            default: false,
          },
          {
            name: 'translator_id',
            type: 'uuid',
            isNullable: true,
            comment: 'User who translated or reviewed',
          },
          {
            name: 'translation_quality',
            type: 'int',
            isNullable: true,
            comment: 'Quality score 0-100',
          },
          {
            name: 'reviewed_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // 번역 테이블 인덱스
    await queryRunner.createIndex(
      'content_translations',
      new TableIndex({
        name: 'idx_content_translations_unique',
        columnNames: ['entity_type', 'entity_id', 'language_code', 'field_name'],
        isUnique: true,
      })
    );

    await queryRunner.createIndex(
      'content_translations',
      new TableIndex({
        name: 'idx_content_translations_lookup',
        columnNames: ['entity_type', 'entity_id', 'language_code'],
      })
    );

    // ====================================
    // 2. 지원 언어 테이블 생성
    // ====================================
    console.log('Creating supported languages table...');
    
    await queryRunner.createTable(
      new Table({
        name: 'supported_languages',
        columns: [
          {
            name: 'code',
            type: 'varchar',
            length: '10',
            isPrimary: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'native_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'is_rtl',
            type: 'boolean',
            default: false,
            comment: 'Right-to-left languages',
          },
          {
            name: 'fallback_language',
            type: 'varchar',
            length: '10',
            default: "'en'",
          },
          {
            name: 'display_order',
            type: 'int',
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // 기본 언어 데이터 삽입
    await queryRunner.query(`
      INSERT INTO supported_languages (code, name, native_name, display_order) VALUES
      ('en', 'English', 'English', 1),
      ('ko', 'Korean', '한국어', 2),
      ('ja', 'Japanese', '日本語', 3),
      ('zh', 'Chinese (Simplified)', '简体中文', 4),
      ('zh-TW', 'Chinese (Traditional)', '繁體中文', 5),
      ('es', 'Spanish', 'Español', 6),
      ('fr', 'French', 'Français', 7),
      ('de', 'German', 'Deutsch', 8),
      ('pt', 'Portuguese', 'Português', 9),
      ('ru', 'Russian', 'Русский', 10),
      ('ar', 'Arabic', 'العربية', 11),
      ('hi', 'Hindi', 'हिन्दी', 12)
      ON CONFLICT DO NOTHING
    `);

    // RTL 언어 설정
    await queryRunner.query(`
      UPDATE supported_languages SET is_rtl = true WHERE code IN ('ar', 'he', 'fa', 'ur')
    `);

    // ====================================
    // 3. 사용자 테이블에 글로벌 컬럼 추가
    // ====================================
    console.log('Adding globalization columns to users table...');
    
    // 선호 언어
    await queryRunner.addColumn('users', new TableColumn({
      name: 'preferred_language',
      type: 'varchar',
      length: '10',
      default: "'en'",
      isNullable: true,
    }));

    // 시간대
    await queryRunner.addColumn('users', new TableColumn({
      name: 'timezone',
      type: 'varchar',
      length: '50',
      default: "'UTC'",
      isNullable: true,
    }));

    // 국가 코드
    await queryRunner.addColumn('users', new TableColumn({
      name: 'country_code',
      type: 'varchar',
      length: '2',
      isNullable: true,
      comment: 'ISO 3166-1 alpha-2',
    }));

    // 지역
    await queryRunner.addColumn('users', new TableColumn({
      name: 'region',
      type: 'varchar',
      length: '50',
      isNullable: true,
    }));

    // 통화
    await queryRunner.addColumn('users', new TableColumn({
      name: 'currency_code',
      type: 'varchar',
      length: '3',
      default: "'USD'",
      isNullable: true,
      comment: 'ISO 4217',
    }));

    // 날짜 형식 선호
    await queryRunner.addColumn('users', new TableColumn({
      name: 'date_format',
      type: 'varchar',
      length: '20',
      default: "'YYYY-MM-DD'",
      isNullable: true,
    }));

    // 사용자 지역 정보 인덱스
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'idx_users_region',
        columnNames: ['country_code', 'region'],
      })
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'idx_users_language',
        columnNames: ['preferred_language'],
      })
    );

    // ====================================
    // 4. 포스트 테이블에 글로벌 컬럼 추가
    // ====================================
    console.log('Adding globalization columns to posts table...');
    
    // 원본 언어
    await queryRunner.addColumn('posts', new TableColumn({
      name: 'original_language',
      type: 'varchar',
      length: '10',
      default: "'en'",
      isNullable: true,
    }));

    // 사용 가능한 번역
    await queryRunner.addColumn('posts', new TableColumn({
      name: 'available_translations',
      type: 'jsonb',
      isNullable: true,
      comment: '["ko", "ja", "zh"]',
    }));

    // 지역별 조회수
    await queryRunner.addColumn('posts', new TableColumn({
      name: 'regional_stats',
      type: 'jsonb',
      isNullable: true,
      comment: '{"US": 100, "KR": 50, "JP": 30}',
    }));

    // ====================================
    // 5. 파일 테이블에 CDN 지역 정보 추가
    // ====================================
    console.log('Adding CDN region columns to files table...');
    
    // CDN 지역
    await queryRunner.addColumn('files', new TableColumn({
      name: 'cdn_region',
      type: 'varchar',
      length: '20',
      isNullable: true,
      comment: 'us-east-1, eu-west-1, ap-northeast-2',
    }));

    // 지역별 CDN URL
    await queryRunner.addColumn('files', new TableColumn({
      name: 'cdn_urls',
      type: 'jsonb',
      isNullable: true,
      comment: '{"us": "url", "eu": "url", "asia": "url"}',
    }));

    // ====================================
    // 6. 지역별 캐시 테이블 생성
    // ====================================
    console.log('Creating regional cache table...');
    
    await queryRunner.createTable(
      new Table({
        name: 'regional_cache',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'cache_key',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'region',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'cache_value',
            type: 'jsonb',
          },
          {
            name: 'ttl',
            type: 'int',
            comment: 'Time to live in seconds',
          },
          {
            name: 'expires_at',
            type: 'timestamptz',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'accessed_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'regional_cache',
      new TableIndex({
        name: 'idx_regional_cache_lookup',
        columnNames: ['cache_key', 'region'],
        isUnique: true,
      })
    );

    await queryRunner.createIndex(
      'regional_cache',
      new TableIndex({
        name: 'idx_regional_cache_expiry',
        columnNames: ['expires_at'],
      })
    );

    // ====================================
    // 7. 시간대 변환 함수 생성
    // ====================================
    console.log('Creating timezone conversion functions...');
    
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION convert_to_user_timezone(
        timestamp_utc TIMESTAMPTZ,
        user_timezone VARCHAR(50)
      )
      RETURNS TIMESTAMPTZ AS $$
      BEGIN
        RETURN timestamp_utc AT TIME ZONE user_timezone;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);

    // ====================================
    // 8. 번역 품질 점수 계산 함수
    // ====================================
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION calculate_translation_quality(
        source_text TEXT,
        translated_text TEXT,
        is_auto BOOLEAN
      )
      RETURNS INT AS $$
      DECLARE
        quality_score INT;
      BEGIN
        IF is_auto THEN
          quality_score := 60; -- 자동 번역 기본 점수
        ELSE
          quality_score := 90; -- 수동 번역 기본 점수
        END IF;
        
        -- 길이 비율 체크 (원본 대비 번역 길이)
        IF LENGTH(translated_text) > LENGTH(source_text) * 3 OR
           LENGTH(translated_text) < LENGTH(source_text) * 0.3 THEN
          quality_score := quality_score - 20;
        END IF;
        
        RETURN GREATEST(0, LEAST(100, quality_score));
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('✅ Globalization Support Migration completed successfully!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Rolling back Globalization Support...');

    // Drop functions
    await queryRunner.query('DROP FUNCTION IF EXISTS calculate_translation_quality');
    await queryRunner.query('DROP FUNCTION IF EXISTS convert_to_user_timezone');

    // Drop tables
    await queryRunner.dropTable('regional_cache');
    await queryRunner.dropTable('content_translations');
    await queryRunner.dropTable('supported_languages');

    // Drop columns from files table
    await queryRunner.dropColumn('files', 'cdn_urls');
    await queryRunner.dropColumn('files', 'cdn_region');

    // Drop columns from posts table
    await queryRunner.dropColumn('posts', 'regional_stats');
    await queryRunner.dropColumn('posts', 'available_translations');
    await queryRunner.dropColumn('posts', 'original_language');

    // Drop indexes from users table
    await queryRunner.dropIndex('users', 'idx_users_language');
    await queryRunner.dropIndex('users', 'idx_users_region');

    // Drop columns from users table
    await queryRunner.dropColumn('users', 'date_format');
    await queryRunner.dropColumn('users', 'currency_code');
    await queryRunner.dropColumn('users', 'region');
    await queryRunner.dropColumn('users', 'country_code');
    await queryRunner.dropColumn('users', 'timezone');
    await queryRunner.dropColumn('users', 'preferred_language');

    console.log('✅ Rollback completed');
  }
}
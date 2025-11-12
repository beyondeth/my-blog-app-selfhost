import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { EmailVerification } from './entities/email-verification.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailVerification, User]),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        // 이메일 설정 유효성 검증
        const host = configService.get('SMTP_HOST') || configService.get('EMAIL_HOST');
        const port = parseInt(configService.get('SMTP_PORT') || configService.get('EMAIL_PORT') || '587');
        const user = configService.get('SMTP_USER') || configService.get('EMAIL_USER');
        const pass = configService.get('SMTP_PASS') || configService.get('EMAIL_PASS');
        const from = configService.get('SMTP_FROM') || configService.get('EMAIL_FROM');

        // 개발 환경에서 디버그 로그
        if (process.env.NODE_ENV === 'development') {
          console.log('Email Module Configuration:', {
            host,
            port,
            user: user ? `${user.substring(0, 3)}***` : 'undefined',
            userFull: user,
            userLength: user ? user.length : 0,
            pass: pass ? `${pass.substring(0, 2)}***` : 'undefined',
            passLength: pass ? pass.length : 0,
            from,
            env: process.env.NODE_ENV,
          });

          // 환경 변수 직접 확인
          console.log('Direct environment check:', {
            SMTP_HOST: process.env.SMTP_HOST,
            SMTP_USER: process.env.SMTP_USER,
            SMTP_USER_LENGTH: process.env.SMTP_USER ? process.env.SMTP_USER.length : 0,
            SMTP_PASS: process.env.SMTP_PASS ? `${process.env.SMTP_PASS.substring(0, 2)}***` : 'undefined',
            SMTP_PASS_LENGTH: process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0,
          });
        }

        // 필수 환경 변수 검증
        if (!host || !user || !pass) {
          console.error('Missing required email configuration:', {
            host: !!host,
            user: !!user,
            pass: !!pass,
          });
          throw new Error('이메일 설정이 완료되지 않았습니다. .env.local 파일을 확인해주세요.');
        }

        return {
          transport: {
            host,
            port,
            secure: port === 465, // SSL 사용 여부
            auth: {
              user,
              pass,
            },
            // TLS 설정 추가
            tls: {
              rejectUnauthorized: false, // 개발 환경에서만
            },
            // 디버그 옵션 비활성화
            debug: false,
            logger: false,
            // 연결 타임아웃 설정
            connectionTimeout: 10000,
            greetingTimeout: 5000,
            socketTimeout: 10000,
          },
          defaults: {
            from: from || '"codebase.blog" <info@codebase.blog>',
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
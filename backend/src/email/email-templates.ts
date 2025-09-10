/**
 * AWS 스타일 이메일 템플릿 (인라인 스타일 버전)
 * 이메일 클라이언트 호환성을 위해 모든 스타일을 인라인으로 적용
 */

export const getAWSStyleEmailTemplate = (code: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Amazon Ember', Roboto, Arial, sans-serif; background-color: #ffffff; color: #232f3e;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #232f3e; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
          <div style="color: #ff9900; font-size: 24px; font-weight: 700; margin: 0;">codebase.blog</div>
        </div>
        <div style="background: #ffffff; border: 1px solid #d5d9d9; border-top: none; border-radius: 0 0 8px 8px; padding: 40px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #232f3e; margin: 0 0 8px;">codebase.blog 이메일 인증 코드</h1>
          <p style="font-size: 14px; color: #687078; margin: 0 0 32px;">안녕하세요,</p>
          <p style="font-size: 14px; color: #232f3e; line-height: 1.8; margin: 0 0 24px;">
            codebase.blog 사이트에 오신 것을 환영합니다! codebase.blog ID는 블로그를 이용할 때 필요한 계정입니다.
          </p>
          <p style="font-size: 14px; color: #232f3e; line-height: 1.8; margin: 0 0 24px;">
            본인 확인이 필요합니다. 다음 확인 코드를 입력하십시오. codebase.blog ID를 생성할 때 이 코드가 필요합니다.
          </p>
          <p style="font-size: 14px; color: #687078; margin: 0 0 12px;">확인 코드</p>
          <div style="text-align: center; margin: 32px 0;">
            <div style="display: inline-block; font-size: 48px; font-weight: 700; color: #232f3e; letter-spacing: 12px; font-family: 'Courier New', monospace; padding: 20px 40px; border: 2px solid #d5d9d9; border-radius: 8px; background: #f7f8f8;">
              ${code}
            </div>
            <p style="font-size: 12px; color: #687078; margin: 8px 0 0; text-align: center;">이 코드는 5분이 경과하면 만료됩니다.</p>
          </div>
          <p style="font-size: 12px; color: #687078; line-height: 1.6; margin: 32px 0 0;">
            codebase.blog는 귀하에게 이메일을 발송하여 암호, 신용 카드 또는 은행 계좌 번호를 요청하지 않습니다. 이러한 정보를 요청하는 이메일을 받으시면 응답하지 마십시오.
          </p>
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="font-size: 12px; color: #687078; margin: 0; line-height: 1.6;">
              © 2025 codebase.blog. All rights reserved.<br>
              이 메시지는 codebase.blog에서 전송되었습니다.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getAWSStylePasswordResetTemplate = (username: string, resetUrl: string): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Amazon Ember', Roboto, Arial, sans-serif; background-color: #ffffff; color: #232f3e;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #232f3e; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
          <div style="color: #ff9900; font-size: 24px; font-weight: 700; margin: 0;">codebase.blog</div>
        </div>
        <div style="background: #ffffff; border: 1px solid #d5d9d9; border-top: none; border-radius: 0 0 8px 8px; padding: 40px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #232f3e; margin: 0 0 8px;">비밀번호 재설정</h1>
          <p style="font-size: 14px; color: #687078; margin: 0 0 32px;">안녕하세요, ${username || '사용자'}님</p>
          <p style="font-size: 14px; color: #232f3e; line-height: 1.8; margin: 0 0 24px;">
            귀하의 codebase.blog 계정에 대한 비밀번호 재설정 요청을 받았습니다.
          </p>
          <p style="font-size: 14px; color: #232f3e; line-height: 1.8; margin: 0 0 24px;">
            아래 버튼을 클릭하여 새로운 비밀번호를 설정하십시오. 이 링크는 15분간 유효합니다.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: #ff9900; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 700; font-size: 14px;">
              비밀번호 재설정
            </a>
          </div>
          <p style="font-size: 12px; color: #687078; word-break: break-all; margin: 16px 0;">
            버튼이 작동하지 않는 경우, 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br>
            ${resetUrl}
          </p>
          <p style="font-size: 12px; color: #687078; line-height: 1.6; margin: 32px 0 0;">
            본인이 이 요청을 하지 않은 경우, 이 이메일을 무시하십시오. 귀하의 비밀번호는 변경되지 않습니다.
          </p>
          <p style="font-size: 12px; color: #687078; line-height: 1.6; margin: 16px 0 0;">
            codebase.blog는 귀하에게 이메일을 발송하여 암호, 신용 카드 또는 은행 계좌 번호를 요청하지 않습니다.
          </p>
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="font-size: 12px; color: #687078; margin: 0; line-height: 1.6;">
              © 2025 codebase.blog. All rights reserved.<br>
              이 메시지는 codebase.blog에서 전송되었습니다.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};
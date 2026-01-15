'use client';

// 동적 렌더링 강제 - prerendering 시 useContext 오류 방지
export const dynamic = 'force-dynamic';

/**
 * 글로벌 에러 바운더리
 * 루트 레이아웃에서 발생하는 에러를 처리
 * 자체 <html>, <body> 태그를 포함해야 함 (루트 레이아웃 외부에서 동작)
 *
 * 주의: 이 컴포넌트는 외부 컨텍스트나 프로바이더에 의존하면 안 됨
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{
        margin: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        backgroundColor: '#f9fafb',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          maxWidth: '400px',
          padding: '24px',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '16px'
          }}>
            오류가 발생했습니다
          </h1>
          <p style={{
            color: '#6b7280',
            marginBottom: '24px'
          }}>
            예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}

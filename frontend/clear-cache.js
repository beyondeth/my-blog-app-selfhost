// 프론트엔드 캐시 클리어 스크립트
// 브라우저 개발자 콘솔에서 실행하세요

console.log('🧹 블로그 공유 문제 해결 - 프론트엔드 캐시 클리어');
console.log('=' .repeat(50));

// 1. TanStack Query (React Query) 캐시 모두 제거
if (window.queryClient) {
  window.queryClient.clear();
  console.log('✅ TanStack Query 캐시 클리어 완료');
}

// 2. localStorage 모든 데이터 제거
const localStorageKeys = Object.keys(localStorage);
let blogRelatedKeys = 0;
localStorageKeys.forEach(key => {
  if (key.includes('blog') ||
      key.includes('query') ||
      key.includes('auth') ||
      key.includes('user')) {
    localStorage.removeItem(key);
    blogRelatedKeys++;
  }
});
console.log(`✅ localStorage에서 ${blogRelatedKeys}개 관련 키 제거 완료`);

// 3. sessionStorage 모든 데이터 제거
const sessionStorageKeys = Object.keys(sessionStorage);
let sessionBlogKeys = 0;
sessionStorageKeys.forEach(key => {
  if (key.includes('blog') ||
      key.includes('query') ||
      key.includes('auth') ||
      key.includes('user')) {
    sessionStorage.removeItem(key);
    sessionBlogKeys++;
  }
});
console.log(`✅ sessionStorage에서 ${sessionBlogKeys}개 관련 키 제거 완료`);

// 4. 강제 리프레시 (서버 상태와 동기화)
console.log('\n🔄 3초 후 페이지를 자동으로 새로고침합니다...');
console.log('   새로고침 후에는 정상적으로 자신의 블로그만 보여야 합니다.');

setTimeout(() => {
  window.location.reload();
}, 3000);

// 5. 현재 로그인된 사용자 정보 확인 (디버깅용)
console.log('\n📋 디버그 정보:');
console.log('현재 URL:', window.location.href);
console.log('쿠키:', document.cookie);

// 6. 브라우저 하드 리프레시 안내
console.log('\n💡 만약 자동 새로고침 후에도 문제가 persist하면:');
console.log('   - Chrome: Cmd+Shift+R (Mac) 또는 Ctrl+Shift+R (Windows)');
console.log('   - Firefox: Cmd+Shift+R (Mac) 또는 Ctrl+F5 (Windows)');
console.log('   - 개발자 도구 Network 탭에서 "Disable cache" 체크 후 새로고침');
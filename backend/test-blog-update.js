#!/usr/bin/env node

const API_URL = 'http://localhost:3000/api/v1';

async function testBlogUpdate() {
  console.log('🔐 1. 로그인 시도...');
  
  // 새 사용자 생성
  const timestamp = Date.now().toString().slice(-6);
  const registerData = {
    email: `test_${timestamp}@example.com`,
    password: 'TestPassword123',
    username: `test_${timestamp}`
  };
  
  try {
    const registerRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerData)
    });
    
    if (!registerRes.ok) {
      const error = await registerRes.text();
      console.log('❌ 회원가입 실패:', error);
      return;
    }
    
    const cookies = registerRes.headers.get('set-cookie');
    const user = await registerRes.json();
    console.log('✅ 회원가입 성공:', user.email);
    
    // 블로그 생성
    console.log('\n📝 2. 블로그 생성...');
    const blogData = {
      name: 'Test Blog',
      slug: `test-blog-${timestamp}`,
      description: 'Test blog for update API'
    };
    
    const createBlogRes = await fetch(`${API_URL}/blogs`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify(blogData)
    });
    
    if (!createBlogRes.ok) {
      const error = await createBlogRes.text();
      console.log('❌ 블로그 생성 실패:', error);
      return;
    }
    
    const blog = await createBlogRes.json();
    console.log('✅ 블로그 생성 성공:', blog);
    
    // 블로그 업데이트 테스트
    console.log('\n🔄 3. 블로그 설정 업데이트...');
    const updateData = {
      isPublic: false,
      allowComments: false,
      description: 'Updated description'
    };
    
    const updateRes = await fetch(`${API_URL}/blogs/${blog.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify(updateData)
    });
    
    if (!updateRes.ok) {
      const error = await updateRes.text();
      console.log('❌ 블로그 업데이트 실패:', error);
      return;
    }
    
    const updatedBlog = await updateRes.json();
    console.log('✅ 블로그 업데이트 성공:', {
      id: updatedBlog.id,
      isPublic: updatedBlog.isPublic,
      allowComments: updatedBlog.allowComments,
      description: updatedBlog.description
    });
    
    // 검증
    console.log('\n✔️ 4. 업데이트 검증...');
    if (updatedBlog.isPublic === false && updatedBlog.allowComments === false) {
      console.log('🎉 테스트 성공! 블로그 공개 설정이 정상적으로 작동합니다.');
    } else {
      console.log('⚠️ 테스트 실패: 설정이 제대로 업데이트되지 않았습니다.');
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  }
}

testBlogUpdate();
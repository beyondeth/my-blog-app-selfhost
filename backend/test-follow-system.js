#!/usr/bin/env node

/**
 * Follow System Test Script
 * 
 * Usage:
 * 1. Start backend server: pnpm start:dev
 * 2. Run this script: node test-follow-system.js
 * 
 * This script tests:
 * - Follow/unfollow operations
 * - Follow info retrieval with and without authentication
 * - State consistency
 */

const fetch = require('node-fetch');
const fs = require('fs').promises;

const API_URL = 'http://localhost:3000/api/v1';

// Test users (you need to create these or use existing ones)
const TEST_USER_1 = {
  email: 'test1@example.com',
  password: 'Test123!@#',
  username: 'testuser1'
};

const TEST_USER_2 = {
  email: 'test2@example.com', 
  password: 'Test123!@#',
  username: 'testuser2'
};

let accessToken1 = null;
let accessToken2 = null;
let userId1 = null;
let userId2 = null;

async function login(email, password) {
  console.log(`\n🔐 Logging in as ${email}...`);
  
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Login failed: ${error}`);
  }

  // Extract cookie from response
  const cookies = response.headers.raw()['set-cookie'];
  let token = null;
  
  if (cookies) {
    cookies.forEach(cookie => {
      if (cookie.includes('access_token=')) {
        token = cookie.split('access_token=')[1].split(';')[0];
      }
    });
  }

  const data = await response.json();
  console.log(`✅ Logged in successfully. User ID: ${data.user.id}`);
  
  return {
    token,
    userId: data.user.id,
    user: data.user
  };
}

async function getFollowInfo(targetUserId, authToken = null) {
  console.log(`\n📊 Getting follow info for user ${targetUserId}...`);
  
  const headers = {};
  if (authToken) {
    headers['Cookie'] = `access_token=${authToken}`;
    console.log('   With authentication');
  } else {
    console.log('   Without authentication');
  }

  const response = await fetch(`${API_URL}/users/${targetUserId}/follow-info`, {
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get follow info: ${error}`);
  }

  const data = await response.json();
  console.log('   Follow info:', data);
  return data;
}

async function followUser(targetUserId, authToken) {
  console.log(`\n➕ Following user ${targetUserId}...`);
  
  const response = await fetch(`${API_URL}/users/${targetUserId}/follow`, {
    method: 'POST',
    headers: {
      'Cookie': `access_token=${authToken}`
    },
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to follow user: ${error}`);
  }

  console.log('✅ Successfully followed user');
}

async function unfollowUser(targetUserId, authToken) {
  console.log(`\n➖ Unfollowing user ${targetUserId}...`);
  
  const response = await fetch(`${API_URL}/users/${targetUserId}/follow`, {
    method: 'DELETE',
    headers: {
      'Cookie': `access_token=${authToken}`
    },
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to unfollow user: ${error}`);
  }

  console.log('✅ Successfully unfollowed user');
}

async function runTests() {
  console.log('🚀 Starting Follow System Tests\n');
  console.log('================================');

  try {
    // Step 1: Login as both users
    console.log('\n📌 Step 1: Login as test users');
    const result1 = await login(TEST_USER_1.email, TEST_USER_1.password);
    accessToken1 = result1.token;
    userId1 = result1.userId;

    const result2 = await login(TEST_USER_2.email, TEST_USER_2.password);
    accessToken2 = result2.token;
    userId2 = result2.userId;

    // Step 2: Check initial follow status
    console.log('\n📌 Step 2: Check initial follow status');
    let info = await getFollowInfo(userId2, accessToken1);
    console.log(`   User1 following User2? ${info.isFollowedByUser}`);

    // Step 3: User1 follows User2
    console.log('\n📌 Step 3: User1 follows User2');
    await followUser(userId2, accessToken1);

    // Step 4: Verify follow status after following
    console.log('\n📌 Step 4: Verify follow status after following');
    info = await getFollowInfo(userId2, accessToken1);
    console.log(`   User1 following User2? ${info.isFollowedByUser} (should be true)`);
    
    if (!info.isFollowedByUser) {
      console.error('❌ ERROR: Follow status not updated correctly!');
    }

    // Step 5: Check follow info without authentication
    console.log('\n📌 Step 5: Check follow info without authentication');
    info = await getFollowInfo(userId2);
    console.log(`   isFollowedByUser should be false: ${info.isFollowedByUser}`);

    // Step 6: User1 unfollows User2
    console.log('\n📌 Step 6: User1 unfollows User2');
    await unfollowUser(userId2, accessToken1);

    // Step 7: Verify follow status after unfollowing
    console.log('\n📌 Step 7: Verify follow status after unfollowing');
    info = await getFollowInfo(userId2, accessToken1);
    console.log(`   User1 following User2? ${info.isFollowedByUser} (should be false)`);
    
    if (info.isFollowedByUser) {
      console.error('❌ ERROR: Unfollow operation failed!');
    }

    console.log('\n================================');
    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);
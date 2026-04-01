#!/usr/bin/env npx tsx
/**
 * Test script for OpenCode Go API endpoint
 * Run with: npx tsx scripts/test-opencode.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') });

const OPENCODE_GO_API_KEY = process.env.OPENCODE_GO_API_KEY;

console.log('\n====== OpenCode Go API Test ======\n');

// Check environment variables
console.log('Environment check:');
console.log(`  OPENCODE_GO_API_KEY: ${OPENCODE_GO_API_KEY ? '✓ Set (' + OPENCODE_GO_API_KEY.substring(0, 10) + '...)' : '✗ NOT SET'}`);
console.log('');

if (!OPENCODE_GO_API_KEY) {
  console.error('❌ OPENCODE_GO_API_KEY is not set!');
  console.log('\nAdd to .env.local:');
  console.log('  OPENCODE_GO_API_KEY=your_api_key_here');
  process.exit(1);
}

async function testOpenCodeGoAPI() {
  console.log('Test 1: OpenCode Go API (Anthropic-compatible endpoint)');
  console.log(`  Endpoint: https://opencode.ai/zen/go/v1/messages`);
  console.log(`  Model: minimax-m2.5`);
  
  try {
    const response = await fetch('https://opencode.ai/zen/go/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': OPENCODE_GO_API_KEY as string,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'minimax-m2.5',
        messages: [
          { role: 'user', content: 'Say "Hello!" in one word.' }
        ],
        max_tokens: 50,
      }),
    });

    console.log(`  Status: ${response.status} ${response.statusText}`);
    
    const data = await response.text();
    console.log(`  Response: ${data.substring(0, 500)}${data.length > 500 ? '...' : ''}`);
    
    if (response.ok) {
      console.log('  ✓ Test passed!\n');
      return true;
    } else {
      console.log('  ✗ Test failed\n');
      return false;
    }
  } catch (error) {
    const err = error as Error;
    console.log(`  ✗ Error: ${err.message}`);
    console.log(`  Stack: ${err.stack?.split('\n').slice(0, 3).join('\n  ')}\n`);
    return false;
  }
}

async function testAISDKIntegration() {
  console.log('Test 2: AI SDK Integration');
  console.log('  Testing: @ai-sdk/anthropic with OpenCode Go\n');
  
  try {
    // Dynamic imports
    const anthropicModule = await import('@ai-sdk/anthropic');
    const aiModule = await import('ai');
    
    const createAnthropic = anthropicModule.createAnthropic;
    const streamText = aiModule.streamText;
    
    const anthropic = createAnthropic({
      apiKey: OPENCODE_GO_API_KEY,
      baseURL: 'https://opencode.ai/zen/go/v1',
    });
    
    const model = anthropic('minimax-m2.5');
    
    console.log('  Creating stream...');
    const result = await streamText({
      model,
      prompt: 'Say "Hello from AI SDK!" in exactly those words.',
    });
    
    console.log('  Streaming response:');
    process.stdout.write('    ');
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
    }
    console.log('\n  ✓ AI SDK test passed!\n');
    return true;
    
  } catch (error) {
    const err = error as Error;
    console.log(`  ✗ Error: ${err.message}`);
    console.log(`  Stack: ${err.stack?.split('\n').slice(0, 5).join('\n  ')}\n`);
    return false;
  }
}

// Run all tests
(async () => {
  const test1 = await testOpenCodeGoAPI();
  const test2 = await testAISDKIntegration();
  
  console.log('====== Results ======');
  console.log(`  Test 1 (Direct API): ${test1 ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`  Test 2 (AI SDK): ${test2 ? '✓ PASSED' : '✗ FAILED'}`);
  console.log('');
  
  if (!test1 || !test2) {
    process.exit(1);
  }
})();
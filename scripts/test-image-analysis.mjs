/**
 * Test script for image analysis using OpenRouter
 * Run: node scripts/test-image-analysis.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('Error: OPENROUTER_API_KEY environment variable not set');
  console.log('Set it with: export OPENROUTER_API_KEY=your-key');
  process.exit(1);
}

// Read and convert image to base64
const imagePath = path.join(__dirname, '../public/logo.png');
const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');
const mimeType = 'image/png';
const dataUrl = `data:${mimeType};base64,${base64Image}`;

console.log('Image loaded:', imagePath);
console.log('Image size:', (imageBuffer.length / 1024).toFixed(2), 'KB');
console.log('---');

async function testImageAnalysis() {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://cyberia.so',
      'X-Title': 'Cyberia'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image in detail. What do you see?' },
            { type: 'image', source: { type: 'url', url: dataUrl } }
          ]
        }
      ],
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API Error:', response.status, errorText);
    return;
  }

  const data = await response.json();
  console.log('Response:');
  console.log(data.choices?.[0]?.message?.content || 'No response');
  console.log('---');
  console.log('Usage:', data.usage);
}

async function testWithUrl() {
  // Test with a public URL instead
  const testUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/640px-Camponotus_flavomarginatus_ant.jpg';
  
  console.log('Testing with public URL...');
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://cyberia.so',
      'X-Title': 'Cyberia'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image. What animal is in it?' },
            { type: 'image', source: { type: 'url', url: testUrl } }
          ]
        }
      ],
      max_tokens: 300
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API Error:', response.status, errorText);
    return;
  }

  const data = await response.json();
  console.log('Response from URL test:');
  console.log(data.choices?.[0]?.message?.content || 'No response');
  console.log('---');
  console.log('Usage:', data.usage);
}

// Run tests
console.log('=== Test 1: Base64 image ===');
await testImageAnalysis();

console.log('\n=== Test 2: Public URL ===');
await testWithUrl();

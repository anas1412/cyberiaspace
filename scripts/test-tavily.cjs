const path = require('path');
const fs = require('fs');

// Basic .env parser
function loadEnv() {
  const envFiles = ['.env', '.env.local'];
  
  envFiles.forEach(file => {
    const envPath = path.join(__dirname, '..', file);
    if (fs.existsSync(envPath)) {
      console.log('Loading environment from: ' + file);
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = (match[2] || '').trim();
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          process.env[key] = value;
        }
      });
    }
  });
}

loadEnv();

async function testTavily() {
  const apiKey = process.env.TAVILY_API_KEY;
  const query = '48 laws of power goodreads';

  console.log('--- Tavily API Test ---');
  console.log('Query:', query);
  
  if (!apiKey) {
    console.error('ERROR: TAVILY_API_KEY is not set in environment variables, .env, or .env.local.');
    process.exit(1);
  }

  console.log('Using API Key: ' + apiKey.substring(0, 5) + '...');

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'advanced',
        max_results: 3,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API Error:', JSON.stringify(data, null, 2));
      return;
    }

    console.log('\nSuccess! Found ' + (data.results ? data.results.length : 0) + ' results.');
    if (data.results) {
      data.results.forEach((res, i) => {
        console.log('\n[' + (i + 1) + '] ' + res.title);
        console.log('    URL: ' + res.url);
      });
    }

  } catch (error) {
    console.error('Fetch Error: ' + error.message);
  }
}

testTavily();

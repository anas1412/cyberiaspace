const fs = require('fs');
const path = process.argv[2];
let content = '';
process.stdin.on('data', chunk => { content += chunk; });
process.stdin.on('end', () => {
  fs.writeFileSync(path, content, 'utf8');
});

const fs = require('fs');
const file = 'src/store/slices/dataSlice.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'const { spaces } = get();',
  'const { spaces } = get();\n      const wasLocalDbEmpty = spaces.length === 0;'
);

code = code.replace(
  `      if (authState.status === 'authenticated' && !localStorage.getItem('cyberia-last-sync')) {`,
  `      if (authState.status === 'authenticated' && (!localStorage.getItem('cyberia-last-sync') || wasLocalDbEmpty)) {`
);

fs.writeFileSync(file, code);

const fs = require('fs');
const path = require('path');

const version = process.env.CI_COMMIT_SHA || Date.now().toString();
const outDir = path.join(__dirname, '..', 'public');
const outPath = path.join(outDir, 'version.json');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      version,
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

console.log(`version.json written: ${version}`);

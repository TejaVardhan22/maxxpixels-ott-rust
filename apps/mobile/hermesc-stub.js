const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Arguments passed by Gradle:
// -w -emit-binary -max-diagnostic-width=80 -out <bytecodeFile> <bundleFile> [-O] [-output-source-map]
const args = process.argv.slice(2);
console.log('[Hermes Compiler] Invoked with args:', args.join(' '));

const hermescPath = path.resolve(__dirname, 'node_modules/hermes-compiler/hermesc/win64-bin/hermesc.exe');

if (!fs.existsSync(hermescPath)) {
  console.error(`[Hermes Compiler] ERROR: hermesc.exe not found at: ${hermescPath}`);
  process.exit(1);
}

const outIdx = args.indexOf('-out');
let bytecodeFile = null;
if (outIdx !== -1 && outIdx + 1 < args.length) {
  bytecodeFile = path.resolve(args[outIdx + 1]);
  const parentDir = path.dirname(bytecodeFile);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
}

// Execute real Hermes compiler
const result = spawnSync(hermescPath, args, {
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) {
  console.error('[Hermes Compiler] Failed to execute hermesc.exe:', result.error);
  process.exit(1);
}

// Ensure source map stub exists if requested by Gradle and not generated
if (args.includes('-output-source-map') && bytecodeFile) {
  const mapFile = `${bytecodeFile}.map`;
  if (!fs.existsSync(mapFile)) {
    const dummyMap = JSON.stringify({ version: 3, sources: [], mappings: '' });
    fs.writeFileSync(mapFile, dummyMap, 'utf8');
    console.log(`[Hermes Compiler] Created fallback map: ${mapFile}`);
  }
}

if (result.status !== 0) {
  console.error(`[Hermes Compiler] hermesc.exe exited with code ${result.status}`);
  process.exit(result.status || 1);
}

console.log('[Hermes Compiler] Successfully generated Hermes bytecode.');
process.exit(0);

const ts = require('typescript');
const path = require('path');
const glob = require('glob');

const configPath = path.join(process.cwd(), 'tsconfig.app.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());

const files = glob.sync('src/utils/permissions/*.ts', { cwd: process.cwd(), absolute: true });

console.log('Checking', files.length, 'permissions files for TS1484/TS6133 errors...');

let errorCount = 0;
let fileErrorCount = 0;

for (const fileName of files) {
  try {
    const program = ts.createProgram([fileName], parsedConfig.options);
    const sourceFile = program.getSourceFile(fileName);
    
    if (!sourceFile) {
      continue;
    }
    
    const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile)
      .filter(d => d.code === 1484 || d.code === 6133);
    
    if (diagnostics.length > 0) {
      fileErrorCount++;
      console.log('File:', path.relative(process.cwd(), fileName));
      diagnostics.forEach(d => {
        errorCount++;
        const line = sourceFile.getLineAndCharacterOfPosition(d.start || 0);
        console.log('  Line', line.line + 1, '- TS' + d.code);
      });
    }
  } catch (e) {
    // Skip files with errors
  }
}

console.log('Summary: Found', errorCount, 'errors in', fileErrorCount, 'files');

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
if (!configPath) {
  console.error('tsconfig.json was not found. Run this command from the project root.');
  process.exit(1);
}
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  console.error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
  process.exit(1);
}
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const files = parsed.fileNames.filter((file) => {
  const normalized = file.replaceAll('\\', '/');
  const segments = normalized.split('/');
  return /\.(?:ts|tsx)$/.test(normalized) && !normalized.endsWith('.d.ts') && !segments.includes('.next') && !segments.includes('node_modules');
});
const syntaxErrors = [];
const unresolved = [];
const options = parsed.options;
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.cjs'];

function existsAsModule(candidate) {
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return true;
  for (const extension of extensions) {
    if (fs.existsSync(candidate + extension)) return true;
  }
  for (const extension of extensions) {
    const indexFile = path.join(candidate, 'index' + extension);
    if (fs.existsSync(indexFile)) return true;
  }
  return false;
}

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  for (const diagnostic of sourceFile.parseDiagnostics) {
    const position = diagnostic.start == null ? '' : `:${sourceFile.getLineAndCharacterOfPosition(diagnostic.start).line + 1}`;
    syntaxErrors.push(`${path.relative(root, file)}${position}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
  }
  const moduleSpecifiers = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      moduleSpecifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      moduleSpecifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  for (const specifier of moduleSpecifiers) {
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
    let candidate;
    if (specifier.startsWith('@/')) candidate = path.join(root, specifier.slice(2));
    else candidate = path.resolve(path.dirname(file), specifier);
    if (!existsAsModule(candidate)) unresolved.push(`${path.relative(root, file)} -> ${specifier}`);
  }
}

console.log(`TypeScript/TSX files checked: ${files.length}`);
console.log(`Syntax errors: ${syntaxErrors.length}`);
console.log(`Unresolved local imports: ${unresolved.length}`);
if (syntaxErrors.length) console.error(syntaxErrors.join('\n'));
if (unresolved.length) console.error(unresolved.join('\n'));
if (syntaxErrors.length || unresolved.length) process.exit(1);
console.log('PASS: source syntax and local import audit.');

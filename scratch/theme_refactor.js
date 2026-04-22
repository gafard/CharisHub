const fs = require('fs');
const path = require('path');

const srcDirs = ['src/components', 'src/app'];
const rootPath = path.resolve(__dirname, '..');

const replacements = [
  // Arrière-plans
  { rx: /\bbg-white(?![/\w-])/g, to: 'bg-surface' },
  { rx: /\bbg-gray-50(?![/\w-])/g, to: 'bg-surface-strong' },
  { rx: /\bbg-slate-50(?![/\w-])/g, to: 'bg-surface-strong' },
  { rx: /\bbg-\[color:var\(--surface\)\]/g, to: 'bg-surface' },
  { rx: /\bbg-\[color:var\(--surface-strong\)\]/g, to: 'bg-surface-strong' },
  
  // Bordures
  { rx: /\bborder-gray-100(?![/\w-])/g, to: 'border-border-soft' },
  { rx: /\bborder-gray-200(?![/\w-])/g, to: 'border-border-soft' },
  { rx: /\bborder-slate-100(?![/\w-])/g, to: 'border-border-soft' },
  { rx: /\bborder-slate-200(?![/\w-])/g, to: 'border-border-soft' },
  { rx: /\bborder-\[color:var\(--border-soft\)\]/g, to: 'border-border-soft' },
  { rx: /\bborder-\[color:var\(--border-strong\)\]/g, to: 'border-border-strong' },
  
  // Textes (noir / très foncé)
  { rx: /\btext-gray-900(?![/\w-])/g, to: 'text-foreground' },
  { rx: /\btext-gray-800(?![/\w-])/g, to: 'text-foreground/90' },
  { rx: /\btext-slate-900(?![/\w-])/g, to: 'text-foreground' },
  { rx: /\btext-\[color:var\(--foreground\)\]/g, to: 'text-foreground' },
  
  // Textes (gris / mutés)
  { rx: /\btext-gray-600(?![/\w-])/g, to: 'text-muted' },
  { rx: /\btext-gray-500(?![/\w-])/g, to: 'text-muted' },
  { rx: /\btext-slate-600(?![/\w-])/g, to: 'text-muted' },
  { rx: /\btext-slate-500(?![/\w-])/g, to: 'text-muted' },
];

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const { rx, to } of replacements) {
    if (rx.test(content)) {
      content = content.replace(rx, to);
      changed = true;
    }
  }

  // Handle specific manual replacements that regex might map awkwardly
  // e.g., if we had `text-foreground/90` we leave it, tailwind handles it.

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${path.relative(rootPath, filePath)}`);
  }
}

srcDirs.forEach(dir => {
  const fullDirPath = path.join(rootPath, dir);
  if (fs.existsSync(fullDirPath)) {
    processDirectory(fullDirPath);
  }
});

console.log('Refactoring complete.');

import os
import re

src_dirs = ['src/components', 'src/app']
root_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Map hardcoded patterns to our semantic variables
replacements = [
    # Backgrounds
    (re.compile(r'\bbg-white(?![/\w-])'), 'bg-surface'),
    (re.compile(r'\bbg-gray-50(?![/\w-])'), 'bg-surface-strong'),
    (re.compile(r'\bbg-slate-50(?![/\w-])'), 'bg-surface-strong'),
    (re.compile(r'\bbg-\[#FCF9F3\](?![/\w-])'), 'bg-background'),
    (re.compile(r'\bbg-\[#fffdf9\](?![/\w-])'), 'bg-surface'),
    (re.compile(r'\bbg-\[#ffffff\](?![/\w-])'), 'bg-surface'),
    (re.compile(r'\bbg-\[#fbf9f5\](?![/\w-])'), 'bg-background'), # approximate
    (re.compile(r'\bbg-\[#f6f4f0\](?![/\w-])'), 'bg-surface-strong'), # approximate
    
    # Borders
    (re.compile(r'\bborder-gray-100(?![/\w-])'), 'border-border-soft'),
    (re.compile(r'\bborder-gray-200(?![/\w-])'), 'border-border-soft'),
    (re.compile(r'\bborder-slate-100(?![/\w-])'), 'border-border-soft'),
    (re.compile(r'\bborder-slate-200(?![/\w-])'), 'border-border-soft'),
    (re.compile(r'\bborder-\[#e8ebf1\](?![/\w-])'), 'border-border-soft'),
    (re.compile(r'\bborder-\[#ebe6db\](?![/\w-])'), 'border-border-soft'),
    (re.compile(r'\bborder-\[#ece8df\](?![/\w-])'), 'border-border-soft'),
    
    # Texts
    (re.compile(r'\btext-gray-900(?![/\w-])'), 'text-foreground'),
    (re.compile(r'\btext-gray-800(?![/\w-])'), 'text-foreground/90'),
    (re.compile(r'\btext-slate-900(?![/\w-])'), 'text-foreground'),
    (re.compile(r'\btext-\[#1a2142\](?![/\w-])'), 'text-foreground'),
    (re.compile(r'\btext-\[#141b37\](?![/\w-])'), 'text-foreground'),
    (re.compile(r'\btext-\[#161c35\](?![/\w-])'), 'text-foreground'),
    
    # Specific common text-muted patterns
    (re.compile(r'\btext-gray-600(?![/\w-])'), 'text-muted'),
    (re.compile(r'\btext-gray-500(?![/\w-])'), 'text-muted'),
    (re.compile(r'\btext-slate-600(?![/\w-])'), 'text-muted'),
    (re.compile(r'\btext-slate-500(?![/\w-])'), 'text-muted'),
]

def process_directory(dir_path):
    for root, _, files in os.walk(dir_path):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                process_file(os.path.join(root, file))

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False
    for rx, to in replacements:
        if rx.search(content):
            content = rx.sub(to, content)
            changed = True

    if changed:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {os.path.relpath(file_path, root_path)}")

for d in src_dirs:
    dp = os.path.join(root_path, d)
    if os.path.exists(dp):
        process_directory(dp)

print('Refactoring complete.')

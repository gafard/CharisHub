const fs = require('fs');
const path = require('path');

const bibleDir = './public/bibles';
const keysToQuote = ['Abbreviation', 'Publisher', 'Language', 'VersionDate', 'Description', 'Introduction', 'Copyright', 'IsCompressed', 'IsProtected', 'Guid', 'Testaments', 'Books', 'Chapters', 'Verses', 'Text', 'ID'];

function fixBibleFile(filePath) {
    console.log(`Fixing ${filePath}...`);
    let raw = fs.readFileSync(filePath, 'utf8');
    
    // 1. Remove BOM
    raw = raw.replace(/^\uFEFF/, '').trim();
    
    // 2. Try to parse directly first
    try {
        JSON.parse(raw);
        console.log(`  Already valid JSON.`);
        return;
    } catch (e) {
        // Continue fixing
    }

    // 3. Robust Fix: Quote specific keys and fix characters
    const keys = ['Abbreviation', 'Publisher', 'Language', 'VersionDate', 'Description', 'Introduction', 'Copyright', 'IsCompressed', 'IsProtected', 'Guid', 'Testaments', 'Books', 'Chapters', 'Verses', 'Text', 'ID', 'Style', 'Body', 'TextAlignment', 'UseCurrentLanguage'];
    let fixed = raw;
    keys.forEach(key => {
        const regex = new RegExp(`(?<=[{,]\\s*)${key}\\s*:`, 'g');
        fixed = fixed.replace(regex, `"${key}":`);
    });

    fixed = fixed
        // b. Handle trailing commas
        .replace(/,\s*([}\]])/g, '$1')
        // c. Replace ALL newlines and tabs with spaces (safer for JSON parse)
        .replace(/[\r\n\t]+/g, ' ')
        // d. Clean up any remaining control characters (0-31)
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    // 4. Try to parse the fixed version
    try {
        const parsed = JSON.parse(fixed);
        // Save back as pretty JSON for better compatibility and future edits
        fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2));
        console.log(`  Fixed and saved!`);
    } catch (e) {
        console.error(`  Failed to fix ${filePath}: ${e.message}`);
    }
}

const bibles = fs.readdirSync(bibleDir);
bibles.forEach(bible => {
    const biblePath = path.join(bibleDir, bible, 'bible.json');
    if (fs.existsSync(biblePath)) {
        fixBibleFile(biblePath);
    }
});

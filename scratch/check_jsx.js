import fs from 'fs';

const content = fs.readFileSync('src/components/bible/ReadingPlansIndexClient.tsx', 'utf8');
const lines = content.split('\n');

let level = 0;
lines.forEach((line, i) => {
  const opens = (line.match(/<div|<Link|<motion\.|<Swiper|<AuthModal/g) || []).filter(tag => !line.includes('/>') && !line.includes('</')).length;
  const closes = (line.match(/<\/div|<\/Link|<\/motion\.|<\/Swiper|<\/AuthModal|<\/>/g) || []).length;
  level += opens - closes;
  if (level < 0) {
    console.log(`Mismatch at line ${i + 1}: level ${level}`);
  }
});
console.log(`Final level: ${level}`);

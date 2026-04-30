export function normalize(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function extractVerseNumber(verse: any, index: number): number {
  const raw = verse.verse || 
              verse.number || 
              verse.id || 
              verse.ID || 
              verse.v || 
              verse.Numero || 
              verse.numero || 
              verse.Numéro || 
              (index + 1);
  return Number(raw);
}

export function extractVerseText(verse: any): string {
  const raw = verse.text || 
              verse.Text || 
              verse.content || 
              verse.Content || 
              verse.versetext || 
              verse.scripture || 
              '';
  return String(raw).trim();
}

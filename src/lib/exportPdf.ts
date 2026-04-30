/**
 * Export PDF — Generates downloadable PDFs for notes, highlights, and bookmarks.
 *
 * Uses the browser's print API with a styled hidden iframe to generate
 * clean, formatted PDFs without any external dependency.
 */

import logger from '@/lib/logger';

export interface ExportHighlight {
  reference: string;
  text: string;
  color: string;
  date?: string;
}

export interface ExportNote {
  reference: string;
  text: string;
  note: string;
  date?: string;
}

export interface ExportBookmark {
  reference: string;
  date?: string;
}

export interface ExportData {
  highlights: ExportHighlight[];
  notes: ExportNote[];
  bookmarks: ExportBookmark[];
  userName?: string;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return ''; }
}

function generateHtml(data: ExportData): string {
  const title = data.userName ? `Notes Bibliques — ${data.userName}` : 'Notes Bibliques — CharisHub';
  const now = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const highlightRows = data.highlights.map(h => `
    <tr>
      <td class="ref">${h.reference}</td>
      <td><span class="hl" style="background:${h.color}20; border-left:3px solid ${h.color}">${h.text}</span></td>
      <td class="date">${formatDate(h.date)}</td>
    </tr>
  `).join('');

  const noteRows = data.notes.map(n => `
    <div class="note-card">
      <div class="note-ref">${n.reference}</div>
      <blockquote class="note-verse">${n.text}</blockquote>
      <p class="note-text">${n.note}</p>
      ${n.date ? `<div class="note-date">${formatDate(n.date)}</div>` : ''}
    </div>
  `).join('');

  const bookmarkList = data.bookmarks.map(b =>
    `<li>${b.reference}${b.date ? ` <span class="date">(${formatDate(b.date)})</span>` : ''}</li>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Merriweather:ital@0;1&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #1a1a2e; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; color: #0f172a; }
  .subtitle { font-size: 13px; color: #64748b; margin-bottom: 32px; }
  h2 { font-size: 18px; font-weight: 700; color: #334155; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
  .stats { display: flex; gap: 24px; margin-bottom: 24px; font-size: 13px; color: #64748b; }
  .stats span { font-weight: 700; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .ref { font-weight: 600; white-space: nowrap; color: #3b82f6; width: 140px; }
  .date { font-size: 11px; color: #94a3b8; white-space: nowrap; width: 100px; }
  .hl { display: block; padding: 6px 10px; border-radius: 4px; font-family: 'Merriweather', serif; font-size: 13px; }
  .note-card { margin-bottom: 20px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; page-break-inside: avoid; }
  .note-ref { font-weight: 700; color: #3b82f6; font-size: 14px; margin-bottom: 8px; }
  .note-verse { font-family: 'Merriweather', serif; font-style: italic; color: #475569; padding: 8px 12px; border-left: 3px solid #cbd5e1; margin-bottom: 12px; font-size: 13px; }
  .note-text { font-size: 14px; color: #1e293b; }
  .note-date { font-size: 11px; color: #94a3b8; margin-top: 8px; }
  ul { padding-left: 20px; }
  li { padding: 4px 0; font-size: 14px; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 20px; } .no-print { display: none; } }
</style>
</head>
<body>
  <h1>📖 ${title}</h1>
  <div class="subtitle">Exporté le ${now} depuis CharisHub</div>
  <div class="stats">
    <div><span>${data.highlights.length}</span> surlignages</div>
    <div><span>${data.notes.length}</span> notes</div>
    <div><span>${data.bookmarks.length}</span> favoris</div>
  </div>

  ${data.highlights.length > 0 ? `
    <h2>🖍️ Surlignages</h2>
    <table><thead><tr><th>Référence</th><th>Texte</th><th>Date</th></tr></thead><tbody>${highlightRows}</tbody></table>
  ` : ''}

  ${data.notes.length > 0 ? `
    <h2>📝 Notes personnelles</h2>
    ${noteRows}
  ` : ''}

  ${data.bookmarks.length > 0 ? `
    <h2>⭐ Favoris</h2>
    <ul>${bookmarkList}</ul>
  ` : ''}

  <div class="footer">Généré automatiquement par CharisHub — Formation Biblique</div>
</body>
</html>`;
}

/**
 * Collect export data from localStorage.
 */
export function collectExportData(): ExportData {
  if (typeof window === 'undefined') return { highlights: [], notes: [], bookmarks: [] };

  const highlights: ExportHighlight[] = [];
  const notes: ExportNote[] = [];
  const bookmarks: ExportBookmark[] = [];

  try {
    const hlRaw = localStorage.getItem('formation_biblique_bible_highlights_v1');
    if (hlRaw) {
      const hl = JSON.parse(hlRaw);
      for (const [key, val] of Object.entries(hl)) {
        const h = val as any;
        highlights.push({
          reference: key.replace(/_/g, ' '),
          text: h.text || '',
          color: h.color || '#fbbf24',
          date: h.date,
        });
      }
    }
  } catch { /* ignore */ }

  try {
    const ntRaw = localStorage.getItem('formation_biblique_bible_notes_v1');
    if (ntRaw) {
      const nt = JSON.parse(ntRaw);
      for (const [key, val] of Object.entries(nt)) {
        notes.push({
          reference: key.replace(/_/g, ' '),
          text: '',
          note: typeof val === 'string' ? val : (val as any)?.note || '',
          date: (val as any)?.date,
        });
      }
    }
    const vntRaw = localStorage.getItem('formation_biblique_bible_verse_notes_v1');
    if (vntRaw) {
      const vnt = JSON.parse(vntRaw);
      for (const [key, val] of Object.entries(vnt)) {
        notes.push({
          reference: key.replace(/_/g, ' '),
          text: (val as any)?.verseText || '',
          note: typeof val === 'string' ? val : (val as any)?.note || '',
          date: (val as any)?.date,
        });
      }
    }
  } catch { /* ignore */ }

  try {
    const bmRaw = localStorage.getItem('bible_bookmarks');
    if (bmRaw) {
      const bm = JSON.parse(bmRaw);
      if (Array.isArray(bm)) {
        bm.forEach((b: any) => {
          bookmarks.push({
            reference: typeof b === 'string' ? b.replace(/_/g, ' ') : (b?.reference || b?.id || '').replace(/_/g, ' '),
            date: b?.date,
          });
        });
      }
    }
  } catch { /* ignore */ }

  return { highlights, notes, bookmarks };
}

/**
 * Generate and download a PDF of notes, highlights and bookmarks.
 */
export function exportToPdf(data?: ExportData): void {
  const exportData = data || collectExportData();

  if (exportData.highlights.length === 0 && exportData.notes.length === 0 && exportData.bookmarks.length === 0) {
    alert('Aucune donnée à exporter. Ajoutez des surlignages, notes ou favoris d\'abord.');
    return;
  }

  const html = generateHtml(exportData);

  // Create a hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    logger.error('[ExportPdf] Could not access iframe document');
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for fonts/styles to load, then print
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } catch (err) {
      logger.error('[ExportPdf] Print failed:', err);
    }
    // Cleanup after a delay
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  }, 500);
}

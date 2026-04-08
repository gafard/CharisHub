/**
 * Génère un fichier ringtone.wav avec une sonnerie téléphonique classique
 * Fréquences : 440Hz + 480Hz (standard nord-américain)
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const DURATION = 2; // secondes
const FREQ1 = 440; // Hz
const FREQ2 = 480; // Hz
const AMPLITUDE = 0.3;

function generateWav() {
  const numSamples = SAMPLE_RATE * DURATION;
  const buffer = Buffer.alloc(44 + numSamples * 2); // header + samples
  
  // Write WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM header size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // Byte rate
  buffer.writeUInt16LE(2, 32); // Block align
  buffer.writeUInt16LE(16, 34); // Bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  
  // Generate audio samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Motif de sonnerie : 0.5s de son, 1s de silence, répétition
    const cycleTime = t % 1.5;
    const isRinging = cycleTime < 0.5;
    
    let sample = 0;
    if (isRinging) {
      // Combiner les deux fréquences
      sample = Math.sin(2 * Math.PI * FREQ1 * t) + Math.sin(2 * Math.PI * FREQ2 * t);
      sample *= AMPLITUDE / 2; // Normaliser
    }
    
    // Convert to 16-bit PCM
    const intSample = Math.max(-1, Math.min(1, sample));
    const int16 = intSample < 0 ? intSample * 0x8000 : intSample * 0x7FFF;
    buffer.writeInt16LE(int16, 44 + i * 2);
  }
  
  // Write to file
  const outputPath = path.join(__dirname, '../public/sounds/ringtone.wav');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Ringtone généré: ${outputPath}`);
  console.log(`   Duration: ${DURATION}s, Sample rate: ${SAMPLE_RATE}Hz`);
}

generateWav();

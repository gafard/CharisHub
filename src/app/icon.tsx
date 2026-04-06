import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at top, rgba(201,162,39,0.45), transparent 55%), linear-gradient(135deg, #141520, #25324f)',
        }}
      >
        <div
          style={{
            display: 'flex',
            height: 320,
            width: 320,
            borderRadius: 72,
            border: '10px solid rgba(255,255,255,0.18)',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 160,
            fontWeight: 800,
            background: 'rgba(255,255,255,0.08)',
          }}
        >
          B
        </div>
      </div>
    ),
    size
  );
}

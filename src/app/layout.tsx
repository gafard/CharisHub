import type { Metadata, Viewport } from 'next';
import { Inter, Poppins, Merriweather, Almarai, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { I18nProvider } from '../contexts/I18nContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { AuthProvider } from '../contexts/AuthContext';
import { CloudSyncProvider } from '../contexts/CloudSyncContext';
import NotificationManager from '../components/NotificationManager';
import GlobalCallManager from '../components/GlobalCallManager';
import PWAInstallPrompt from '../components/PWAInstallPrompt';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-merriweather',
  display: 'swap',
});

const almarai = Almarai({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '700', '800'],
  variable: '--font-almarai',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CharisHub',
  description: "Connectés par la grâce — Vision Miroir",
  applicationName: 'CharisHub',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#D4AF37',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning={true}
      className={`${inter.variable} ${poppins.variable} ${merriweather.variable} ${almarai.variable} ${instrumentSerif.variable}`}
    >
      <body className="overflow-x-hidden pb-[92px] font-sans antialiased md:pb-0" suppressHydrationWarning={true}>
        <AuthProvider>
          <I18nProvider>
            <SettingsProvider>
              <CloudSyncProvider>
                {children}
                <NotificationManager />
                <GlobalCallManager />
                <PWAInstallPrompt />
              </CloudSyncProvider>
            </SettingsProvider>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

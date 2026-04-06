import type { Metadata, Viewport } from 'next';
import { Inter, Poppins, Merriweather } from 'next/font/google';
import './globals.css';
import { I18nProvider } from '../contexts/I18nContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import NotificationManager from '../components/NotificationManager';
import GlobalCallManager from '../components/GlobalCallManager';

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

export const metadata: Metadata = {
  title: 'CharisHub',
  description: "Connectés par la grâce — Formation des Huios",
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
      className={`${inter.variable} ${poppins.variable} ${merriweather.variable}`}
    >
      <body className="pb-[92px] font-sans antialiased md:pb-0" suppressHydrationWarning={true}>
        <I18nProvider>
          <SettingsProvider>
            {children}
            <NotificationManager />
            <GlobalCallManager />
          </SettingsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

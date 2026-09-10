import type { Metadata } from 'next';
import { Geist, Geist_Mono, Barlow_Condensed } from 'next/font/google';
import './globals.css';
import './visual-refresh.css';
import './platform-polish.css';
import './lobby-polish.css';
import './game-polish.css';
import './responsive.css';
import AccountProviderWrapper from './provider-wrapper';
import './fragstake-polish.css';

const displayFont = Barlow_Condensed({ variable: '--font-display', subsets: ['latin'], weight: ['600', '700', '800'], display: 'swap' });

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FragStake | Enter the arena',
  icons: { icon: '/favicon.svg' },
  description: 'Practice your aim, compete in tiered free-for-all matches, and challenge rivals in 1v1 or 2v2 duels. Play the demo arena.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} antialiased`}
      >
        <AccountProviderWrapper>{children}</AccountProviderWrapper>
      </body>
    </html>
  );
}





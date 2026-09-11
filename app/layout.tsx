import type { Metadata } from 'next';
import { Geist, Geist_Mono, Barlow_Condensed } from 'next/font/google';
import './globals.css';
import './launch.css';
import './visual-refresh.css';
import './platform-polish.css';
import './lobby-polish.css';
import './game-polish.css';
import './responsive.css';
import AccountProviderWrapper from './provider-wrapper';
import './fragstake-polish.css';
import './site-motion.css';
import './site-header.css';
import './product-ui.css';

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
  description: 'Play competitive browser FPS matches against real players. Join free-for-all, 1v1 and 2v2 duels on FragStake.',
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





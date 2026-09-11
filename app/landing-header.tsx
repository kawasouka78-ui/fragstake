'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowRight, Crosshair, Menu, X } from 'lucide-react';
import { useAccount } from './account-context';
import './landing-header.css';

const links = [
  { href: '#how-to-play', label: 'How to play' },
  { href: '/rules', label: 'Game rules' },
];

export default function LandingHeader() {
  const { data } = useAccount();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const accountHref = data ? '/profile' : '/signin';
  const accountLabel = data ? 'Your account' : 'Sign in';
  return (
    <header
      className="landing-header"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className="landing-header-row">
        <Link href="/" className="landing-wordmark" aria-label="FragStake home">
          <span className="landing-brand-icon">
            <Crosshair size={23} />
          </span>
          <span>
            FRAG<em>STAKE</em>
          </span>
        </Link>
        <nav className="landing-desktop-nav" aria-label="About FragStake">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="landing-header-actions">
          <Link className="landing-account-link" href={accountHref}>
            {accountLabel}
          </Link>
          <Link className="landing-play-link" href="/play">
            Play free
            <ArrowRight size={16} />
          </Link>
          <button
            ref={toggle}
            className="landing-menu-toggle"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      <nav
        id="landing-mobile-nav"
        className="landing-mobile-nav"
        aria-label="Mobile navigation"
        hidden={!open}
      >
        {links.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
        <Link href={accountHref} onClick={() => setOpen(false)}>
          {accountLabel}
        </Link>
      </nav>
    </header>
  );
}

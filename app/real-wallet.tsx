'use client';
import { Wallet, ArrowRight, ArrowLeftRight } from 'lucide-react';
import SiteHeader from './site-header';
import { EmptyState, PageHeading } from './page-ui';

export default function RealWallet() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="main account-main">
        <PageHeading
          title="Wallet"
          description="Manage your funds and transaction history."
        />
        <section className="funding-panel">
          <div className="funding-panel-heading">
            <Wallet size={22} />
            <h2>Crypto funding</h2>
            <span className="status-label">Not available yet</span>
          </div>
          <p>
            Deposits, withdrawals and paid matches are locked until the crypto
            payment provider is connected and approved.
          </p>
          <dl className="funding-details">
            <div>
              <dt>Planned currency</dt>
              <dd>USDC</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Polygon</dd>
            </div>
            <div>
              <dt>Funding status</dt>
              <dd>Not connected</dd>
            </div>
          </dl>
          <a className="secondary" href="/play">
            Back to play <ArrowRight size={16} />
          </a>
        </section>
        <section className="records-section">
          <h2>Transactions</h2>
          <EmptyState
            icon={<ArrowLeftRight size={24} />}
            title="No wallet activity yet"
          >
            Real deposits, withdrawals and match payouts will appear here after
            payments are enabled.
          </EmptyState>
        </section>
      </main>
    </div>
  );
}

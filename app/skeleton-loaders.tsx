const Bone = ({ className = '' }: { className?: string }) => (
  <span className={`skeleton-bone ${className}`} aria-hidden="true" />
);

export function ContentSkeleton() {
  return (
    <div className="content-skeleton" role="status" aria-live="polite">
      <span className="sr-only">Loading content</span>
      <div className="content-skeleton-grid">
        <section className="skeleton-panel skeleton-panel-wide">
          <Bone className="skeleton-label" />
          <Bone className="skeleton-heading" />
          <Bone className="skeleton-copy" />
          <Bone className="skeleton-copy skeleton-copy-short" />
          <div className="skeleton-row-stack">
            <Bone className="skeleton-row" />
            <Bone className="skeleton-row" />
            <Bone className="skeleton-row" />
          </div>
        </section>
        <section className="skeleton-panel skeleton-panel-side">
          <Bone className="skeleton-label" />
          <Bone className="skeleton-heading skeleton-heading-small" />
          <Bone className="skeleton-field" />
          <Bone className="skeleton-field" />
          <Bone className="skeleton-button" />
        </section>
      </div>
    </div>
  );
}

export function AppShellSkeleton() {
  return (
    <div className="app-skeleton" role="status" aria-live="polite">
      <span className="sr-only">Loading FragStake</span>
      <aside className="app-skeleton-sidebar">
        <div className="skeleton-brand">
          <Bone className="skeleton-brand-mark" />
          <Bone className="skeleton-brand-name" />
        </div>
        <Bone className="skeleton-label skeleton-nav-label" />
        <div className="skeleton-nav">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="skeleton-nav-item" key={index}>
              <Bone className="skeleton-nav-icon" />
              <Bone className="skeleton-nav-text" />
            </div>
          ))}
        </div>
        <div className="skeleton-profile">
          <Bone className="skeleton-avatar" />
          <div>
            <Bone className="skeleton-profile-name" />
            <Bone className="skeleton-profile-handle" />
          </div>
        </div>
      </aside>
      <header className="app-skeleton-topbar">
        <Bone className="skeleton-crumb" />
        <Bone className="skeleton-balance" />
      </header>
      <main className="app-skeleton-main">
        <div className="skeleton-page-heading">
          <div>
            <Bone className="skeleton-label" />
            <Bone className="skeleton-title" />
          </div>
          <Bone className="skeleton-action" />
        </div>
        <ContentSkeleton />
      </main>
    </div>
  );
}

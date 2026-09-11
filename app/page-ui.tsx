import type { ReactNode } from 'react';

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p className="account-subtitle">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="product-empty">
      <span className="product-empty-icon" aria-hidden="true">
        {icon}
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action && <div className="product-empty-action">{action}</div>}
    </div>
  );
}

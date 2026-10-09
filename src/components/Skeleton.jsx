import React from 'react';

/**
 * Reusable Skeleton loader for the dashboard
 */
export function Skeleton({ className = '', variant = 'rectangular', style = {} }) {
  const baseClasses = 'animate-pulse';
  
  // Minimal inline styles to ensure it works with standard CSS
  const variantStyles = {
    text: { height: '1rem', borderRadius: '0.25rem', backgroundColor: 'var(--color-border-light)' },
    circular: { borderRadius: '50%', backgroundColor: 'var(--color-border-light)' },
    rectangular: { borderRadius: '0.375rem', backgroundColor: 'var(--color-border-light)' },
  };
  
  const mergedStyle = {
    ...variantStyles[variant],
    ...style,
  };
  
  return (
    <div 
      className={`${baseClasses} ${className}`} 
      style={mergedStyle}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="kpi-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton variant="text" style={{ width: '80px' }} />
        <Skeleton variant="circular" style={{ width: '24px', height: '24px' }} />
      </div>
      <Skeleton variant="text" style={{ width: '120px', height: '2rem', marginTop: '0.5rem' }} />
      <Skeleton variant="text" style={{ width: '150px', height: '0.75rem', marginTop: 'auto' }} />
    </div>
  );
}

export function SiteCardSkeleton() {
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Skeleton variant="text" style={{ width: '180px', height: '1.5rem' }} />
          <Skeleton variant="text" style={{ width: '220px', height: '0.8rem' }} />
        </div>
        <Skeleton variant="rectangular" style={{ width: '100px', height: '24px', borderRadius: '12px' }} />
      </div>
      <div className="card-body">
        <div className="stat-row">
          <div className="stat-item" style={{ gap: '0.5rem' }}>
            <Skeleton variant="text" style={{ width: '80px', height: '0.8rem' }} />
            <Skeleton variant="text" style={{ width: '60px', height: '1.5rem' }} />
            <Skeleton variant="text" style={{ width: '100px', height: '0.8rem' }} />
          </div>
          <div className="stat-item" style={{ gap: '0.5rem' }}>
            <Skeleton variant="text" style={{ width: '80px', height: '0.8rem' }} />
            <Skeleton variant="text" style={{ width: '100px', height: '1.5rem' }} />
            <Skeleton variant="text" style={{ width: '120px', height: '0.8rem' }} />
          </div>
          <div className="stat-item" style={{ gap: '0.5rem' }}>
            <Skeleton variant="text" style={{ width: '80px', height: '0.8rem' }} />
            <Skeleton variant="text" style={{ width: '80px', height: '1.5rem' }} />
            <Skeleton variant="text" style={{ width: '120px', height: '0.8rem' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Add keyframes for animate-pulse to document if it doesn't exist
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .5; }
    }
    .animate-pulse {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  `;
  document.head.appendChild(style);
}

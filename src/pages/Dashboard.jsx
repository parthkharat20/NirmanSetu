import React from 'react';
import { 
  Users, IndianRupee, AlertTriangle, PackageSearch, 
  Clock, Building2, Activity, ArrowUpRight, TrendingDown
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { StatCardSkeleton, SiteCardSkeleton } from '../components/Skeleton';
import { ActivityFeed } from '../components/ActivityFeed';

function Dashboard() {
  const { data, loading, error } = useApi('/dashboard/overview', { pollingInterval: 10000 }); // Poll every 10s for dashboard overview

  if (error) {
    return (
      <div className="empty-state" style={{ minHeight: '60vh' }}>
        <AlertTriangle size={48} color="var(--color-danger)" />
        <p>Error: {error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Owner Command Center
          </h1>
          <p className="page-description" style={{ fontSize: '1rem', marginTop: '0.5rem' }}>
            Real-time overview of all active construction sites
            {!loading && data && <span style={{ marginLeft: '0.5rem', padding: '0.2rem 0.5rem', background: 'var(--color-border-light)', borderRadius: '12px', fontSize: '0.8rem' }}>{data.date}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(34, 197, 94, 0.1)', padding: '0.5rem 1rem', borderRadius: '20px' }}>
          <span style={{ 
            display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', 
            background: 'var(--color-success)', animation: 'pulse 2s infinite' 
          }}></span>
          Live Sync Active
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: '2.5rem' }}>
        {loading || !data ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <div className="kpi-card" style={{ borderTop: '4px solid var(--color-info)' }}>
              <div className="kpi-label"><Users size={16} color="var(--color-info)" /> Workforce</div>
              <div className="kpi-value tabular-nums">
                {data.totals.totalPresent} <span style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>/ {data.totals.totalWorkers}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ArrowUpRight size={14} color="var(--color-success)" /> workers present today
              </div>
            </div>

            <div className="kpi-card" style={{ borderTop: '4px solid var(--color-danger)' }}>
              <div className="kpi-label"><IndianRupee size={16} color="var(--color-danger)" /> Daily Burn</div>
              <div className="kpi-value tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                ₹{data.totals.totalDailyBurn.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <TrendingDown size={14} color="var(--color-danger)" /> wages + expenses today
              </div>
            </div>

            <div className="kpi-card" style={{ borderTop: '4px solid var(--color-warning)' }}>
              <div className="kpi-label"><AlertTriangle size={16} color="var(--color-warning)" /> Low Stock Alert</div>
              <div className="kpi-value tabular-nums" style={{ color: data.totals.totalLowStock > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                {data.totals.totalLowStock}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>materials below threshold</div>
            </div>

            <div className="kpi-card" style={{ borderTop: '4px solid var(--color-primary)' }}>
              <div className="kpi-label"><PackageSearch size={16} color="var(--color-primary)" /> Pending Indents</div>
              <div className="kpi-value tabular-nums" style={{ color: data.totals.totalPendingIndents > 0 ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                {data.totals.totalPendingIndents}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>material requests pending</div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        
        {/* Left Column: Active Sites */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 2 }}>
          <div className="section-header" style={{ marginBottom: '0' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
              <Building2 size={20} color="var(--color-primary)" /> 
              Active Sites {!loading && data && `(${data.sites.length})`}
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loading || !data ? (
              <>
                <SiteCardSkeleton />
                <SiteCardSkeleton />
              </>
            ) : data.sites.length === 0 ? (
              <div className="empty-state card">
                <Building2 size={32} />
                <p>No active sites found</p>
              </div>
            ) : (
              data.sites.map(site => <SiteCard key={site.id} site={site} />)
            )}
          </div>
        </div>

        {/* Right Column: Activity Feed */}
        <div style={{ flex: 1, minWidth: '350px' }}>
          <ActivityFeed />
        </div>

      </div>
    </div>
  );
}

function SiteCard({ site }) {
  const { attendance } = site;
  const rate = attendance.total > 0
    ? Math.round(((attendance.present + (attendance.half_day * 0.5)) / attendance.total) * 100)
    : 0;

  return (
    <div className="card" style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'pointer' }} 
         onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
         onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}>
      <div className="card-header" style={{ padding: '1.25rem 1.5rem' }}>
        <div>
          <h3 className="card-title" style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{site.name}</h3>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span>📍 {site.location}</span>
            <span>📱 {site.supervisor_phone}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {site.dprSubmitted
            ? <span className="badge badge-success" style={{ padding: '0.35rem 0.75rem', borderRadius: '12px' }}>✓ DPR Submitted</span>
            : <span className="badge badge-warning" style={{ padding: '0.35rem 0.75rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Clock size={12} /> DPR Pending
              </span>
          }
        </div>
      </div>
      <div className="card-body" style={{ padding: '1.5rem', background: 'var(--color-bg)' }}>
        <div className="stat-row">
          <div className="stat-item">
            <span className="label">Attendance</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span className="value">{rate}%</span>
              <span className="sub" style={{ display: 'flex', gap: '0.5rem', fontWeight: 500 }}>
                <span style={{ color: 'var(--color-success)' }}>{attendance.present}P</span>
                <span style={{ color: 'var(--color-warning)' }}>{attendance.half_day}H</span>
                <span style={{ color: 'var(--color-danger)' }}>{attendance.absent}A</span>
              </span>
            </div>
          </div>
          <div className="stat-item" style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '1.5rem' }}>
            <span className="label">Today's Wages</span>
            <span className="value tabular-nums">₹{site.todayWages.toLocaleString('en-IN')}</span>
            <span className="sub">Petty Cash: <span style={{ fontWeight: 600 }}>₹{site.cashBalance.toLocaleString('en-IN')}</span></span>
          </div>
          <div className="stat-item" style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '1.5rem' }}>
            <span className="label">Materials</span>
            <span className="value tabular-nums" style={{ color: site.lowStockCount > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontSize: '1.1rem' }}>
              {site.lowStockCount > 0 ? `${site.lowStockCount} Low Stock` : 'Stock OK'}
            </span>
            <span className="sub">Pending Indents: <span style={{ fontWeight: 600 }}>{site.pendingIndents}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

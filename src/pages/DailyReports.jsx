import React, { useState, useEffect } from 'react';
import { FileText, Cloud, Users, Calendar, Loader2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { Skeleton } from '../components/Skeleton';

function DailyReports() {
  const [selectedSite, setSelectedSite] = useState(null);
  
  const { data: sites, loading: sitesLoading } = useApi('/sites');
  
  useEffect(() => {
    if (sites && sites.length > 0 && !selectedSite) {
      setSelectedSite(sites[0].id);
    }
  }, [sites, selectedSite]);

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Daily Progress Reports</h1>
          <p className="page-description">View site DPRs submitted by supervisors via Telegram</p>
        </div>
        {sitesLoading ? (
          <Skeleton variant="rectangular" style={{ width: '200px', height: '40px' }} />
        ) : (
          <select 
            className="form-select" 
            style={{ width: 'auto', minWidth: '200px', fontWeight: 500 }} 
            value={selectedSite || ''} 
            onChange={e => setSelectedSite(Number(e.target.value))}
          >
            {sites && sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {!selectedSite ? (
        <div className="empty-state">
          <Loader2 className="animate-spin" size={32} />
          <p>Loading site data...</p>
        </div>
      ) : (
        <SiteReportsView siteId={selectedSite} />
      )}
    </div>
  );
}

function SiteReportsView({ siteId }) {
  const { data: reports, loading } = useApi(`/sites/${siteId}/reports`, { pollingInterval: 15000 });

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {loading ? (
        [1, 2, 3].map(i => (
          <div className="card" key={i}>
            <div className="card-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skeleton variant="text" style={{ width: '150px', height: '1.5rem' }} />
                <Skeleton variant="rectangular" style={{ width: '100px', height: '24px', borderRadius: '12px' }} />
              </div>
            </div>
            <div className="card-body" style={{ padding: '1.5rem' }}>
              <Skeleton variant="text" style={{ width: '100%', marginBottom: '0.5rem' }} />
              <Skeleton variant="text" style={{ width: '90%', marginBottom: '1rem' }} />
              <Skeleton variant="text" style={{ width: '120px', height: '0.8rem' }} />
            </div>
          </div>
        ))
      ) : !reports || reports.length === 0 ? (
        <div className="empty-state card" style={{ minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={56} style={{ color: 'var(--color-primary)', opacity: 0.8, marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--color-text-primary)', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Reports Yet</h3>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', textAlign: 'center', lineHeight: 1.5 }}>
            DPRs are auto-created when supervisors send progress updates via Telegram.
          </p>
          <div style={{ background: 'var(--color-border-light)', padding: '1rem', borderRadius: '8px', marginTop: '1.5rem', fontSize: '0.9rem', width: '100%', maxWidth: '500px', textAlign: 'center' }}>
            <span style={{ fontWeight: 600 }}>Try sending:</span> <br/>
            <em style={{ color: 'var(--color-primary)' }}>"Aaj first floor column casting complete hua, weather clear"</em>
          </div>
        </div>
      ) : (
        reports.map((r, index) => (
          <div className="card" key={r.id} style={{ 
            transition: 'transform 0.2s, box-shadow 0.2s', 
            cursor: 'default',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
          >
            {index === 0 && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--color-primary)' }} />
            )}
            <div className="card-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Calendar size={18} color="var(--color-primary)" />
                <h3 className="card-title" style={{ fontSize: '1.15rem' }}>{r.date}</h3>
                {index === 0 && <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>LATEST</span>}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {r.weather && (
                  <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Cloud size={12} /> {r.weather}
                  </span>
                )}
                <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Users size={12} /> {r.workers_present} workers
                </span>
              </div>
            </div>
            <div className="card-body" style={{ padding: '1.5rem', background: 'var(--color-bg)' }}>
              <p style={{ 
                fontSize: '1rem', 
                lineHeight: 1.6, 
                color: 'var(--color-text-primary)',
                whiteSpace: 'pre-line' 
              }}>
                {r.summary}
              </p>
              <div style={{ 
                marginTop: '1.25rem', 
                paddingTop: '1rem',
                borderTop: '1px dashed var(--color-border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem', 
                color: 'var(--color-text-muted)' 
              }}>
                <span>Logged by: <strong style={{ color: 'var(--color-text-primary)' }}>{r.submitted_by || 'Unknown'}</strong></span>
                <span>ID: #{r.id}</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default DailyReports;

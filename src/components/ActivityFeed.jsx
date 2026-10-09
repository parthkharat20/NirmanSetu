import React from 'react';
import { useApi } from '../hooks/useApi';
import { Skeleton } from './Skeleton';
import { 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  PackageCheck,
  TrendingDown,
  UserCheck,
  Receipt,
  HardHat
} from 'lucide-react';

export function ActivityFeed({ siteId = null }) {
  const endpoint = siteId ? `/dashboard/activity?siteId=${siteId}` : '/dashboard/activity';
  const { data: activities, loading, error } = useApi(endpoint, { pollingInterval: 5000 });

  if (loading && !activities) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Live Activity</h3>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: 'flex', gap: '1rem' }}>
              <Skeleton variant="circular" style={{ width: '40px', height: '40px' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Skeleton variant="text" style={{ width: '40%' }} />
                <Skeleton variant="text" style={{ width: '80%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
        <div className="card-body">
          <p style={{ color: 'var(--color-danger)', fontWeight: 500 }}>Failed to load activity feed</p>
        </div>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Live Activity</h3>
        </div>
        <div className="empty-state" style={{ padding: '2rem' }}>
          <MessageSquare size={32} />
          <p>No recent activity</p>
        </div>
      </div>
    );
  }

  // Helper to determine the icon based on status and content
  const getIcon = (status, extractionJson) => {
    if (status === 'failed') return <XCircle size={18} color="var(--color-danger)" />;
    if (status === 'unclear') return <HelpCircle size={18} color="var(--color-warning)" />;
    
    // For successful messages, try to parse JSON and get specific icons based on type
    try {
      if (extractionJson) {
        const parsed = JSON.parse(extractionJson);
        const updates = parsed.updates || [];
        if (updates.length > 0) {
          const type = updates[0].type;
          switch (type) {
            case 'attendance': return <UserCheck size={18} color="var(--color-info)" />;
            case 'material_receipt': return <PackageCheck size={18} color="var(--color-primary)" />;
            case 'expense': return <Receipt size={18} color="var(--color-danger)" />;
            case 'material_consumption': return <TrendingDown size={18} color="var(--color-warning)" />;
            case 'daily_report': return <HardHat size={18} color="var(--color-success)" />;
            default: return <CheckCircle2 size={18} color="var(--color-success)" />;
          }
        }
      }
    } catch (e) {}
    
    return <CheckCircle2 size={18} color="var(--color-success)" />;
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ 
            display: 'inline-block', 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: 'var(--color-success)',
            boxShadow: '0 0 8px var(--color-success)',
            animation: 'pulse 2s infinite'
          }}></span>
          Live Activity
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Auto-updates every 5s</span>
      </div>
      <div className="card-body" style={{ padding: '0' }}>
        <div className="activity-list" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {activities.map((activity, index) => (
            <div 
              key={activity.id} 
              style={{ 
                padding: '1rem', 
                borderBottom: index < activities.length - 1 ? '1px solid var(--color-border-light)' : 'none',
                display: 'flex',
                gap: '1rem',
                backgroundColor: index === 0 ? 'rgba(232, 108, 37, 0.03)' : 'transparent',
                transition: 'background-color 0.3s ease'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--color-surface-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {getIcon(activity.processing_status, activity.extraction_json)}
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{activity.sender_name}</span>
                    {activity.site_name && (
                      <span style={{ 
                        fontSize: '0.7rem', 
                        background: 'var(--color-border-light)', 
                        padding: '0.1rem 0.4rem', 
                        borderRadius: '4px',
                        color: 'var(--color-text-muted)'
                      }}>
                        {activity.site_name}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    {formatTime(activity.created_at)}
                  </span>
                </div>
                <p style={{ 
                  fontSize: '0.85rem', 
                  color: 'var(--color-text-primary)',
                  margin: '0 0 0.5rem 0',
                  lineHeight: 1.4,
                  wordBreak: 'break-word'
                }}>
                  "{activity.raw_text}"
                </p>
                
                {/* Error/Unclear State details */}
                {activity.processing_status === 'unclear' && (
                  <div style={{ 
                    fontSize: '0.8rem', 
                    color: 'var(--color-warning)', 
                    background: 'rgba(234, 179, 8, 0.1)', 
                    padding: '0.5rem', 
                    borderRadius: '4px' 
                  }}>
                    Bot: Requested clarification
                  </div>
                )}
                {activity.processing_status === 'failed' && (
                  <div style={{ 
                    fontSize: '0.8rem', 
                    color: 'var(--color-danger)', 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    padding: '0.5rem', 
                    borderRadius: '4px' 
                  }}>
                    System failed to parse message
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

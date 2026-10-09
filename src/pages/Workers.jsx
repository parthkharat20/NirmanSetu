import React, { useState, useEffect } from 'react';
import { HardHat, Plus, Search, UserCheck, UserX, Clock, IndianRupee, Loader2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { Skeleton } from '../components/Skeleton';

function Workers() {
  const [selectedSite, setSelectedSite] = useState(null);
  const [tab, setTab] = useState('roster');
  
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
          <h1 className="page-title" style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Labor & Wages</h1>
          <p className="page-description">Manage workers, track attendance, and calculate wages</p>
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

      <div className="tab-nav">
        <button className={`tab-btn ${tab === 'roster' ? 'active' : ''}`} onClick={() => setTab('roster')}>
          Worker Roster
        </button>
        <button className={`tab-btn ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>
          Today's Attendance
        </button>
        <button className={`tab-btn ${tab === 'wages' ? 'active' : ''}`} onClick={() => setTab('wages')}>
          Wages & Advances
        </button>
      </div>

      {!selectedSite ? (
        <div className="empty-state">
          <Loader2 className="animate-spin" size={32} />
          <p>Loading site data...</p>
        </div>
      ) : (
        <WorkerDataView siteId={selectedSite} tab={tab} />
      )}
    </div>
  );
}

function WorkerDataView({ siteId, tab }) {
  const today = new Date().toISOString().split('T')[0];
  const { data: workers, loading: workersLoading, refetch: refetchWorkers } = useApi(`/sites/${siteId}/workers`, { pollingInterval: 10000 });
  const { data: attendance, loading: attLoading } = useApi(`/sites/${siteId}/attendance?date=${today}`, { pollingInterval: 10000 });
  const { data: wages, loading: wagesLoading } = useApi(`/sites/${siteId}/wages`, { pollingInterval: 10000 });
  
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorker, setNewWorker] = useState({ name: '', phone: '', role: 'helper', daily_wage: 600 });
  const [submitting, setSubmitting] = useState(false);

  const addWorker = async () => {
    if (!newWorker.name) return;
    setSubmitting(true);
    try {
      await fetch(`/api/sites/${siteId}/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorker),
      });
      setShowAddWorker(false);
      setNewWorker({ name: '', phone: '', role: 'helper', daily_wage: 600 });
      refetchWorkers();
    } catch (e) {
      console.error(e);
      alert('Failed to add worker');
    } finally {
      setSubmitting(false);
    }
  };

  const getAttStatus = (workerId) => {
    if (!attendance) return 'unmarked';
    const rec = attendance.find(a => a.worker_id === workerId);
    return rec?.status || 'unmarked';
  };

  const statusBadge = (s) => {
    const map = {
      present: { cls: 'badge-success', icon: <UserCheck size={12} />, label: 'Present' },
      half_day: { cls: 'badge-warning', icon: <Clock size={12} />, label: 'Half Day' },
      absent: { cls: 'badge-danger', icon: <UserX size={12} />, label: 'Absent' },
      unmarked: { cls: 'badge-info', icon: null, label: 'Unmarked' },
    };
    const m = map[s] || map.unmarked;
    return <span className={`badge ${m.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{m.icon} {m.label.toUpperCase()}</span>;
  };

  const roleColors = {
    mason: '#3B82F6', carpenter: '#8B5CF6', helper: '#6B7280', plumber: '#06B6D4',
    electrician: '#F59E0B', painter: '#EC4899', welder: '#EF4444', other: '#9CA3AF'
  };

  const totalEarned = wages?.reduce((s, w) => s + (w.total_earned || 0), 0) || 0;
  const totalAdvances = wages?.reduce((s, w) => s + (w.total_advances || 0), 0) || 0;
  const totalPayable = wages?.reduce((s, w) => s + (w.net_payable || 0), 0) || 0;

  return (
    <>
      {tab === 'roster' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title">Worker Roster</h3>
              {!workersLoading && <span className="badge badge-info" style={{ marginTop: '0.5rem' }}>{workers?.length || 0} active</span>}
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddWorker(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={16} /> Add Worker
            </button>
          </div>
          <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Worker</th><th>Role</th><th>Phone</th><th>Daily Wage</th><th>Days (P/H)</th><th>Total Advances</th><th>Today</th></tr>
              </thead>
              <tbody>
                {workersLoading ? (
                  [1, 2, 3].map(i => (
                    <tr key={i}>
                      <td><Skeleton variant="text" style={{ width: '120px' }} /></td>
                      <td><Skeleton variant="rectangular" style={{ width: '60px', height: '24px' }} /></td>
                      <td><Skeleton variant="text" style={{ width: '100px' }} /></td>
                      <td><Skeleton variant="text" style={{ width: '80px' }} /></td>
                      <td><Skeleton variant="text" style={{ width: '60px' }} /></td>
                      <td><Skeleton variant="text" style={{ width: '80px' }} /></td>
                      <td><Skeleton variant="rectangular" style={{ width: '80px', height: '24px' }} /></td>
                    </tr>
                  ))
                ) : !workers || workers.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    <HardHat size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                    No workers added yet. Click "Add Worker" to start.
                  </td></tr>
                ) : workers.map(w => (
                  <tr key={w.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{w.name}</td>
                    <td>
                      <span style={{
                        background: roleColors[w.role] + '18',
                        color: roleColors[w.role],
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}>
                        {w.role}
                      </span>
                    </td>
                    <td className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{w.phone || '—'}</td>
                    <td className="tabular-nums" style={{ fontWeight: 600 }}>₹{w.daily_wage.toLocaleString('en-IN')}</td>
                    <td className="tabular-nums" style={{ fontWeight: 500 }}>
                      <span style={{ color: 'var(--color-success)' }}>{w.days_present}P</span> / <span style={{ color: 'var(--color-warning)' }}>{w.days_half}H</span>
                    </td>
                    <td className="tabular-nums" style={{ color: w.total_advances > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: w.total_advances > 0 ? 600 : 400 }}>
                      ₹{w.total_advances.toLocaleString('en-IN')}
                    </td>
                    <td>{statusBadge(getAttStatus(w.id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} color="var(--color-primary)" /> Attendance — {today}
            </h3>
            {!attLoading && attendance && (
              <span className="badge badge-info" style={{ fontWeight: 600 }}>
                {attendance.filter(a => a.status === 'present').length}P / {attendance.filter(a => a.status === 'half_day').length}H / {attendance.filter(a => a.status === 'absent').length}A
              </span>
            )}
          </div>
          <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Worker</th><th>Role</th><th>Status</th><th>Wage</th><th>Marked By</th></tr></thead>
              <tbody>
                {attLoading ? (
                  [1, 2].map(i => (
                    <tr key={i}>
                      <td colSpan={5}><Skeleton variant="text" style={{ width: '100%' }} /></td>
                    </tr>
                  ))
                ) : !attendance || attendance.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    No attendance marked yet. Send "Sab hajir hain" via Telegram!
                  </td></tr>
                ) : attendance.map(a => (
                  <tr key={a.id} style={{ background: a.status === 'absent' ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }}>
                    <td style={{ fontWeight: 600 }}>{a.worker_name}</td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--color-text-muted)' }}>{a.worker_role}</td>
                    <td>{statusBadge(a.status)}</td>
                    <td className="tabular-nums" style={{ fontWeight: 600, color: a.status === 'absent' ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
                      ₹{(a.status === 'present' ? a.daily_wage : a.status === 'half_day' ? a.daily_wage * 0.5 : 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{a.marked_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'wages' && (
        <div>
          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            {wagesLoading ? (
              <>
                <div className="kpi-card"><Skeleton variant="text" style={{ width: '80px', marginBottom: '0.5rem' }} /><Skeleton variant="text" style={{ width: '120px', height: '2rem' }} /></div>
                <div className="kpi-card"><Skeleton variant="text" style={{ width: '80px', marginBottom: '0.5rem' }} /><Skeleton variant="text" style={{ width: '120px', height: '2rem' }} /></div>
                <div className="kpi-card"><Skeleton variant="text" style={{ width: '80px', marginBottom: '0.5rem' }} /><Skeleton variant="text" style={{ width: '120px', height: '2rem' }} /></div>
              </>
            ) : (
              <>
                <div className="kpi-card">
                  <div className="kpi-label">Total Earned</div>
                  <div className="kpi-value tabular-nums" style={{ color: 'var(--color-success)', fontSize: '1.8rem', fontWeight: 700 }}>₹{totalEarned.toLocaleString('en-IN')}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Total Advances</div>
                  <div className="kpi-value tabular-nums" style={{ color: 'var(--color-danger)', fontSize: '1.8rem', fontWeight: 700 }}>₹{totalAdvances.toLocaleString('en-IN')}</div>
                </div>
                <div className="kpi-card" style={{ borderTop: '4px solid var(--color-primary)' }}>
                  <div className="kpi-label">Net Payable</div>
                  <div className="kpi-value tabular-nums" style={{ fontSize: '2.2rem', fontWeight: 800 }}>₹{totalPayable.toLocaleString('en-IN')}</div>
                </div>
              </>
            )}
          </div>
          
          <div className="card">
            <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Worker</th><th>Role</th><th>Wage/Day</th><th>Days (P/H/A)</th><th>Earned</th><th>Advances</th><th>Net Payable</th></tr></thead>
                <tbody>
                  {wagesLoading ? (
                    [1, 2].map(i => (
                      <tr key={i}><td colSpan={7}><Skeleton variant="text" style={{ width: '100%' }} /></td></tr>
                    ))
                  ) : !wages || wages.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>No wage data available.</td></tr>
                  ) : wages.map(w => (
                    <tr key={w.id}>
                      <td style={{ fontWeight: 600 }}>{w.name}</td>
                      <td style={{ textTransform: 'capitalize', color: 'var(--color-text-muted)' }}>{w.role}</td>
                      <td className="tabular-nums">₹{w.daily_wage.toLocaleString('en-IN')}</td>
                      <td className="tabular-nums">{w.days_present}/{w.days_half}/{w.days_absent}</td>
                      <td className="tabular-nums" style={{ color: 'var(--color-success)', fontWeight: 600 }}>₹{(w.total_earned || 0).toLocaleString('en-IN')}</td>
                      <td className="tabular-nums" style={{ color: 'var(--color-danger)', fontWeight: w.total_advances > 0 ? 600 : 400 }}>₹{(w.total_advances || 0).toLocaleString('en-IN')}</td>
                      <td className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.05rem' }}>₹{(w.net_payable || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAddWorker && (
        <div className="modal-overlay" onClick={() => setShowAddWorker(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add New Worker</h3>
              <button className="btn btn-icon btn-outline" onClick={() => setShowAddWorker(false)} style={{ border: 'none' }}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Name *</label>
                <input className="form-input" value={newWorker.name} onChange={e => setNewWorker({ ...newWorker, name: e.target.value })} placeholder="e.g. Rajesh Kumar" autoFocus />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Phone</label>
                <input className="form-input" value={newWorker.phone} onChange={e => setNewWorker({ ...newWorker, phone: e.target.value })} placeholder="e.g. 9876543210" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Role</label>
                  <select className="form-select" value={newWorker.role} onChange={e => setNewWorker({ ...newWorker, role: e.target.value })}>
                    <option value="mason">Mason</option>
                    <option value="carpenter">Carpenter</option>
                    <option value="helper">Helper</option>
                    <option value="plumber">Plumber</option>
                    <option value="electrician">Electrician</option>
                    <option value="painter">Painter</option>
                    <option value="welder">Welder</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Daily Wage (₹)</label>
                  <input type="number" className="form-input" value={newWorker.daily_wage} onChange={e => setNewWorker({ ...newWorker, daily_wage: Number(e.target.value) })} />
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ background: 'var(--color-bg)', padding: '1.25rem' }}>
              <button className="btn btn-outline" onClick={() => setShowAddWorker(false)} disabled={submitting}>Cancel</button>
              <button className="btn btn-primary" onClick={addWorker} disabled={submitting || !newWorker.name}>
                {submitting ? 'Adding...' : 'Add Worker'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Workers;

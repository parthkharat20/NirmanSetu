import React, { useState, useEffect } from 'react';
import { Receipt, Plus, TrendingUp, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle, Loader2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { Skeleton } from '../components/Skeleton';

function PettyCash() {
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
          <h1 className="page-title" style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Petty Cash</h1>
          <p className="page-description">Track site expenses, fund transfers, and cash balances</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {sitesLoading ? (
            <Skeleton variant="rectangular" style={{ width: '150px', height: '40px' }} />
          ) : (
            <select 
              className="form-select" 
              style={{ width: 'auto', minWidth: '150px', fontWeight: 500 }} 
              value={selectedSite || ''} 
              onChange={e => setSelectedSite(Number(e.target.value))}
            >
              {sites && sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {!selectedSite ? (
        <div className="empty-state">
          <Loader2 className="animate-spin" size={32} />
          <p>Loading site data...</p>
        </div>
      ) : (
        <SiteCashView siteId={selectedSite} />
      )}
    </div>
  );
}

function SiteCashView({ siteId }) {
  const { data, loading, refetch } = useApi(`/sites/${siteId}/petty-cash`, { pollingInterval: 10000 });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type: 'credit', amount: '', category: 'fund_transfer', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const ledger = data?.ledger || [];
  const balance = data?.balance || 0;

  const totalCredits = ledger.filter(e => e.type === 'credit').reduce((s, e) => s + e.amount, 0);
  const totalDebits = ledger.filter(e => e.type === 'debit').reduce((s, e) => s + e.amount, 0);

  const categoryLabels = {
    tea_snacks: '☕ Tea & Snacks', transport: '🚗 Transport', hardware: '🔩 Hardware',
    medical: '🏥 Medical', fuel: '⛽ Fuel', food: '🍽️ Food', tools: '🔧 Tools',
    misc: '📦 Miscellaneous', fund_transfer: '💰 Fund Transfer',
  };

  const addEntry = async () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    setSubmitting(true);
    try {
      await fetch(`/api/sites/${siteId}/petty-cash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setShowAdd(false);
      setForm({ type: 'credit', amount: '', category: 'fund_transfer', description: '' });
      refetch();
    } catch (e) {
      console.error(e);
      alert('Failed to add entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: '2.5rem' }}>
        {loading ? (
          <>
            <div className="kpi-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Skeleton variant="text" style={{ width: '100px' }} />
              <Skeleton variant="text" style={{ width: '140px', height: '2rem' }} />
            </div>
            <div className="kpi-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Skeleton variant="text" style={{ width: '100px' }} />
              <Skeleton variant="text" style={{ width: '140px', height: '2rem' }} />
            </div>
            <div className="kpi-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Skeleton variant="text" style={{ width: '100px' }} />
              <Skeleton variant="text" style={{ width: '140px', height: '2rem' }} />
            </div>
          </>
        ) : (
          <>
            <div className="kpi-card" style={{ borderTop: `4px solid ${balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}`, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.05, transform: 'rotate(-15deg)' }}>
                <Wallet size={120} />
              </div>
              <div className="kpi-label"><Wallet size={16} color="var(--color-primary)" /> Current Balance</div>
              <div className="kpi-value tabular-nums" style={{ color: balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontSize: '2.2rem', fontWeight: 800 }}>
                ₹{balance.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label"><ArrowDownCircle size={16} color="var(--color-success)" /> Total Credits</div>
              <div className="kpi-value tabular-nums" style={{ color: 'var(--color-success)', fontSize: '1.8rem', fontWeight: 700 }}>
                ₹{totalCredits.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label"><ArrowUpCircle size={16} color="var(--color-danger)" /> Total Debits</div>
              <div className="kpi-value tabular-nums" style={{ color: 'var(--color-danger)', fontSize: '1.8rem', fontWeight: 700 }}>
                ₹{totalDebits.toLocaleString('en-IN')}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="card-title">Transaction Ledger</h3>
            {!loading && <span className="badge badge-info" style={{ marginTop: '0.5rem' }}>{ledger.length} entries</span>}
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} /> Add Entry
          </button>
        </div>
        <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Category</th><th>Description</th><th>Logged By</th></tr></thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    <td><Skeleton variant="text" style={{ width: '100px' }} /></td>
                    <td><Skeleton variant="rectangular" style={{ width: '60px', height: '20px' }} /></td>
                    <td><Skeleton variant="text" style={{ width: '80px' }} /></td>
                    <td><Skeleton variant="text" style={{ width: '100px' }} /></td>
                    <td><Skeleton variant="text" style={{ width: '150px' }} /></td>
                    <td><Skeleton variant="text" style={{ width: '80px' }} /></td>
                  </tr>
                ))
              ) : ledger.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                  <Receipt size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  No transactions yet. Add a fund credit or send "500 rupaye chai kharcha" via Telegram!
                </td></tr>
              ) : ledger.map(entry => (
                <tr key={entry.id} style={{ background: entry.type === 'credit' ? 'rgba(34, 197, 94, 0.02)' : 'rgba(239, 68, 68, 0.02)' }}>
                  <td className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{entry.date}</td>
                  <td>
                    {entry.type === 'credit'
                      ? <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><TrendingDown size={12} /> Credit</span>
                      : <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><TrendingUp size={12} /> Debit</span>
                    }
                  </td>
                  <td className="tabular-nums" style={{ fontWeight: 700, fontSize: '1.05rem', color: entry.type === 'credit' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {entry.type === 'credit' ? '+' : '-'}₹{entry.amount.toLocaleString('en-IN')}
                  </td>
                  <td style={{ fontSize: '0.9rem', fontWeight: 500 }}>{categoryLabels[entry.category] || entry.category || '—'}</td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-primary)' }}>{entry.description || '—'}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{entry.logged_by || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add Cash Entry</h3>
              <button className="btn btn-icon btn-outline" onClick={() => setShowAdd(false)} style={{ border: 'none' }}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Type</label>
                <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="credit">💰 Credit (Add Funds to Site)</option>
                  <option value="debit">💸 Debit (Site Expense)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Amount (₹)</label>
                <input type="number" className="form-input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 5000" autoFocus />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="fund_transfer">💰 Fund Transfer</option>
                  <option value="tea_snacks">☕ Tea & Snacks</option>
                  <option value="transport">🚗 Transport</option>
                  <option value="hardware">🔩 Hardware</option>
                  <option value="fuel">⛽ Fuel</option>
                  <option value="food">🍽️ Food</option>
                  <option value="tools">🔧 Tools</option>
                  <option value="medical">🏥 Medical</option>
                  <option value="misc">📦 Miscellaneous</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Description</label>
                <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Monthly fund for site expenses" />
              </div>
            </div>
            <div className="modal-footer" style={{ background: 'var(--color-bg)', padding: '1.25rem' }}>
              <button className="btn btn-outline" onClick={() => setShowAdd(false)} disabled={submitting}>Cancel</button>
              <button className="btn btn-primary" onClick={addEntry} disabled={submitting || !form.amount}>
                {submitting ? 'Adding...' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PettyCash;

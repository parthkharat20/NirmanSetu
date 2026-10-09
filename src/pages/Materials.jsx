import React, { useState, useEffect } from 'react';
import { PackageOpen, Plus, AlertTriangle, TrendingUp, TrendingDown, Package, Truck, ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { Skeleton } from '../components/Skeleton';

function Materials() {
  const [selectedSite, setSelectedSite] = useState(null);
  const [tab, setTab] = useState('inventory');
  
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
          <h1 className="page-title" style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Materials & Inventory</h1>
          <p className="page-description">Track stock levels, GRN receipts, indents, and consumption</p>
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
        <button className={`tab-btn ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>
          Stock Levels
        </button>
        <button className={`tab-btn ${tab === 'grn' ? 'active' : ''}`} onClick={() => setTab('grn')}>
          GRN / Receipts
        </button>
        <button className={`tab-btn ${tab === 'indents' ? 'active' : ''}`} onClick={() => setTab('indents')}>
          Indents
        </button>
      </div>

      {!selectedSite ? (
        <div className="empty-state">
          <Loader2 className="animate-spin" size={32} />
          <p>Loading site data...</p>
        </div>
      ) : (
        <SiteDataView siteId={selectedSite} tab={tab} />
      )}
    </div>
  );
}

function SiteDataView({ siteId, tab }) {
  const { data: inventory, loading: invLoading } = useApi(`/sites/${siteId}/inventory`, { pollingInterval: 10000 });
  const { data: indents, loading: indLoading, refetch: refetchIndents } = useApi(`/sites/${siteId}/indents`, { pollingInterval: 10000 });
  const { data: grn, loading: grnLoading } = useApi(`/sites/${siteId}/grn`, { pollingInterval: 10000 });

  const updateIndentStatus = async (id, status) => {
    try {
      await fetch(`/api/indents/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      refetchIndents();
    } catch (e) {
      console.error(e);
      alert('Failed to update status');
    }
  };

  const lowStockItems = inventory?.filter(i => i.current_stock <= i.low_stock_threshold) || [];

  return (
    <>
      {tab === 'inventory' && lowStockItems.length > 0 && (
        <div style={{ background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: 'var(--shadow-sm)' }}>
          <AlertTriangle size={20} color="var(--color-warning)" />
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#854d0e' }}>
            ⚠️ {lowStockItems.length} items below threshold: {lowStockItems.map(i => i.name).join(', ')}
          </span>
        </div>
      )}

      {tab === 'inventory' && (
        <div className="card">
          <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Material</th><th>Unit</th><th>Received</th><th>Used</th><th>Current Stock</th><th>Threshold</th><th>Total Cost</th><th>Status</th></tr></thead>
              <tbody>
                {invLoading ? (
                  [1, 2, 3].map(i => (
                    <tr key={i}>
                      <td><Skeleton variant="text" style={{ width: '120px' }} /></td>
                      <td><Skeleton variant="text" style={{ width: '40px' }} /></td>
                      <td><Skeleton variant="text" style={{ width: '60px' }} /></td>
                      <td><Skeleton variant="text" style={{ width: '60px' }} /></td>
                      <td><Skeleton variant="text" style={{ width: '80px' }} /></td>
                      <td><Skeleton variant="text" style={{ width: '40px' }} /></td>
                      <td><Skeleton variant="text" style={{ width: '80px' }} /></td>
                      <td><Skeleton variant="rectangular" style={{ width: '60px', height: '24px' }} /></td>
                    </tr>
                  ))
                ) : !inventory || inventory.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    <PackageOpen size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                    No materials logged yet. Send "50 bag cement aaya" in Telegram!
                  </td></tr>
                ) : inventory.map(item => {
                  const isLow = item.current_stock <= item.low_stock_threshold;
                  return (
                    <tr key={item.id} style={{ background: isLow ? 'rgba(239, 68, 68, 0.03)' : 'transparent' }}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.name}</td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{item.unit}</td>
                      <td className="tabular-nums" style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                        <ArrowDown size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{item.total_received}
                      </td>
                      <td className="tabular-nums" style={{ color: 'var(--color-danger)', fontWeight: 500 }}>
                        <ArrowUp size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{item.total_used}
                      </td>
                      <td className="tabular-nums" style={{ fontWeight: 700, fontSize: '1.05rem', color: isLow ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                        {item.current_stock} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>{item.unit}</span>
                      </td>
                      <td className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{item.low_stock_threshold}</td>
                      <td className="tabular-nums" style={{ fontWeight: 600 }}>₹{(item.total_cost || 0).toLocaleString('en-IN')}</td>
                      <td>
                        {isLow
                          ? <span className="badge badge-danger" style={{ fontWeight: 700 }}>LOW STOCK</span>
                          : <span className="badge badge-success">OK</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'grn' && (
        <div className="card">
          <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Material</th><th>Qty</th><th>Vendor</th><th>Invoice Amount</th><th>Quality</th><th>Received By</th></tr></thead>
              <tbody>
                {grnLoading ? (
                  [1, 2].map(i => (
                    <tr key={i}>
                      <td colSpan={7}><Skeleton variant="text" style={{ width: '100%' }} /></td>
                    </tr>
                  ))
                ) : !grn || grn.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>No GRN entries yet.</td></tr>
                ) : grn.map(g => (
                  <tr key={g.id}>
                    <td className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{g.date}</td>
                    <td style={{ fontWeight: 600 }}>{g.material_name}</td>
                    <td className="tabular-nums" style={{ fontWeight: 600 }}>{g.quantity_received} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>{g.unit}</span></td>
                    <td>{g.vendor_name || '—'}</td>
                    <td className="tabular-nums" style={{ fontWeight: 600, color: g.invoice_amount ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                      {g.invoice_amount ? `₹${g.invoice_amount.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td>
                      <span className={`badge ${g.quality_status === 'accepted' ? 'badge-success' : g.quality_status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                        {g.quality_status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{g.received_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'indents' && (
        <div className="card">
          <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Material</th><th>Qty</th><th>Urgency</th><th>Needed By</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {indLoading ? (
                  [1, 2].map(i => (
                    <tr key={i}>
                      <td colSpan={6}><Skeleton variant="text" style={{ width: '100%' }} /></td>
                    </tr>
                  ))
                ) : !indents || indents.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    No material requests pending. Send "Kal 100 bag cement chahiye urgent" via chat!
                  </td></tr>
                ) : indents.map(ind => (
                  <tr key={ind.id}>
                    <td style={{ fontWeight: 600 }}>{ind.material_name}</td>
                    <td className="tabular-nums" style={{ fontWeight: 600 }}>{ind.quantity} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>{ind.unit}</span></td>
                    <td>
                      <span className={`badge ${ind.urgency === 'critical' ? 'badge-danger' : ind.urgency === 'urgent' ? 'badge-warning' : 'badge-info'}`}>
                        {ind.urgency.toUpperCase()}
                      </span>
                    </td>
                    <td className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{ind.needed_by || '—'}</td>
                    <td>
                      <span className={`badge ${
                        ind.status === 'pending' ? 'badge-warning' :
                        ind.status === 'approved' ? 'badge-info' :
                        ind.status === 'dispatched' ? 'badge-primary' :
                        ind.status === 'received' ? 'badge-success' : 'badge-danger'
                      }`}>
                        {ind.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {ind.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-sm btn-success" onClick={() => updateIndentStatus(ind.id, 'approved')}>Approve</button>
                          <button className="btn btn-sm btn-danger" onClick={() => updateIndentStatus(ind.id, 'rejected')}>Reject</button>
                        </div>
                      )}
                      {ind.status === 'approved' && (
                        <button className="btn btn-sm btn-primary" onClick={() => updateIndentStatus(ind.id, 'dispatched')} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Truck size={14} /> Dispatch
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default Materials;

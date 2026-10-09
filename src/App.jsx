import React from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, HardHat, PackageOpen, Receipt, FileText, Settings, MessageCircle } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Workers from './pages/Workers';
import Materials from './pages/Materials';
import PettyCash from './pages/PettyCash';
import DailyReports from './pages/DailyReports';
import TelegramChat from './pages/WhatsAppChat';

function App() {
  const location = useLocation();

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <HardHat size={28} />
            SiteCommand
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/workers" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <HardHat size={18} />
            <span>Labor & Wages</span>
          </NavLink>
          <NavLink to="/materials" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <PackageOpen size={18} />
            <span>Materials</span>
          </NavLink>
          <NavLink to="/finance" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Receipt size={18} />
            <span>Petty Cash</span>
          </NavLink>
          <NavLink to="/reports" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={18} />
            <span>Daily Reports</span>
          </NavLink>
          
          <div style={{ margin: '1.5rem 1.5rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Telegram Bot
          </div>
          <NavLink to="/chat" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} style={location.pathname === '/chat' ? { color: '#2AABEE', backgroundColor: 'rgba(42, 171, 238, 0.1)', borderLeftColor: '#2AABEE' } : {}}>
            <MessageCircle size={18} />
            <span>Chat Simulator</span>
          </NavLink>
        </nav>
        
        <div style={{ padding: '1rem' }}>
          <NavLink to="/settings" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} style={{ borderRadius: 'var(--radius-md)' }}>
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workers" element={<Workers />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/finance" element={<PettyCash />} />
          <Route path="/reports" element={<DailyReports />} />
          <Route path="/chat" element={<TelegramChat />} />
          <Route path="/settings" element={<div className="page-header"><h1 className="page-title">Settings</h1><p className="page-description">System configuration</p></div>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

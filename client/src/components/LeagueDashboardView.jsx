import { useState } from 'react';

export default function LeagueDashboardView({ league, onClose }) {
    const [activeTab, setActiveTab] = useState('DASHBOARD'); // DASHBOARD, PLAYERS, TEAMS, BIDS, LOGS, CONFIG
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [copiedJson, setCopiedJson] = useState(false);

    if (!league) return null;

    const players = league.players || [];
    const teams = league.teams || [];
    const config = league.config || {};
    const activityLog = league.activityLog || [];
    const bidHistory = league.bidHistory || [];

    // Filter players for Players tab
    const filteredPlayers = players.filter(p => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = !query || 
            (p.name && p.name.toLowerCase().includes(query)) ||
            (p.category && p.category.toLowerCase().includes(query)) ||
            (p.externalId && p.externalId.toLowerCase().includes(query));

        const matchesCat = categoryFilter === 'ALL' || p.category?.toUpperCase() === categoryFilter.toUpperCase();
        const matchesStatus = statusFilter === 'ALL' || p.status?.toUpperCase() === statusFilter.toUpperCase();

        return matchesSearch && matchesCat && matchesStatus;
    });

    const handleCopyJson = () => {
        navigator.clipboard.writeText(JSON.stringify(league, null, 2));
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2000);
    };

    const formatDate = (isoString) => {
        if (!isoString) return 'N/A';
        try {
            return new Date(isoString).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return isoString;
        }
    };

    const stateColors = {
        WAITING: '#f59e0b',
        LIVE: '#10b981',
        PAUSED: '#3b82f6',
        ENDED: '#ef4444'
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: '#0b0f19', color: '#fff', zIndex: 1100,
            display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'sans-serif'
        }}>
            {/* --- TOP HEADER BAR --- */}
            <header style={{
                background: '#131b2e',
                borderBottom: '1px solid #1e293b',
                padding: '0.8rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>🏏</span>
                    <h2 style={{ margin: 0, color: '#60a5fa', fontSize: '1.4rem', fontWeight: 'bold' }}>{league.name}</h2>
                    <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: (stateColors[league.state] || '#555') + '22',
                        color: stateColors[league.state] || '#f59e0b',
                        border: `1px solid ${stateColors[league.state] || '#f59e0b'}`,
                        fontWeight: 'bold'
                    }}>
                        {league.state || 'WAITING'}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                    <span>Code: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{league.code}</strong></span>
                    <span>Admin: <strong style={{ color: '#fff' }}>{league.adminName || 'Admin'} ({league.adminEmail || 'N/A'})</strong></span>
                    <span>Created: <strong style={{ color: '#fff' }}>{formatDate(league.createdAt)}</strong></span>
                    {onClose && (
                        <button 
                            onClick={onClose} 
                            style={{ 
                                background: '#ef4444', 
                                border: 'none', 
                                color: '#fff', 
                                padding: '0.4rem 0.8rem', 
                                borderRadius: '4px', 
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '0.85rem'
                            }}
                        >
                            Close View ✕
                        </button>
                    )}
                </div>
            </header>

            {/* --- NAVIGATION TABS BAR --- */}
            <div style={{
                background: '#0f172a',
                borderBottom: '1px solid #1e293b',
                padding: '0 1.5rem',
                display: 'flex',
                gap: '0.5rem',
                overflowX: 'auto'
            }}>
                <button
                    id="tab-dashboard"
                    onClick={() => setActiveTab('DASHBOARD')}
                    style={{
                        padding: '0.8rem 1.2rem',
                        background: activeTab === 'DASHBOARD' ? '#1e293b' : 'transparent',
                        color: activeTab === 'DASHBOARD' ? '#60a5fa' : '#94a3b8',
                        border: 'none',
                        borderBottom: `2px solid ${activeTab === 'DASHBOARD' ? '#3b82f6' : 'transparent'}`,
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Dashboard
                </button>
                <button
                    id="tab-players"
                    onClick={() => setActiveTab('PLAYERS')}
                    style={{
                        padding: '0.8rem 1.2rem',
                        background: activeTab === 'PLAYERS' ? '#1e293b' : 'transparent',
                        color: activeTab === 'PLAYERS' ? '#60a5fa' : '#94a3b8',
                        border: 'none',
                        borderBottom: `2px solid ${activeTab === 'PLAYERS' ? '#3b82f6' : 'transparent'}`,
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Players ({players.length})
                </button>
                <button
                    id="tab-teams"
                    onClick={() => setActiveTab('TEAMS')}
                    style={{
                        padding: '0.8rem 1.2rem',
                        background: activeTab === 'TEAMS' ? '#1e293b' : 'transparent',
                        color: activeTab === 'TEAMS' ? '#60a5fa' : '#94a3b8',
                        border: 'none',
                        borderBottom: `2px solid ${activeTab === 'TEAMS' ? '#3b82f6' : 'transparent'}`,
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Teams ({teams.length})
                </button>
                <button
                    id="tab-bids"
                    onClick={() => setActiveTab('BIDS')}
                    style={{
                        padding: '0.8rem 1.2rem',
                        background: activeTab === 'BIDS' ? '#1e293b' : 'transparent',
                        color: activeTab === 'BIDS' ? '#60a5fa' : '#94a3b8',
                        border: 'none',
                        borderBottom: `2px solid ${activeTab === 'BIDS' ? '#3b82f6' : 'transparent'}`,
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Bid History ({bidHistory.length})
                </button>
                <button
                    id="tab-logs"
                    onClick={() => setActiveTab('LOGS')}
                    style={{
                        padding: '0.8rem 1.2rem',
                        background: activeTab === 'LOGS' ? '#1e293b' : 'transparent',
                        color: activeTab === 'LOGS' ? '#60a5fa' : '#94a3b8',
                        border: 'none',
                        borderBottom: `2px solid ${activeTab === 'LOGS' ? '#3b82f6' : 'transparent'}`,
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Activity Log ({activityLog.length})
                </button>
                <button
                    id="tab-config"
                    onClick={() => setActiveTab('CONFIG')}
                    style={{
                        padding: '0.8rem 1.2rem',
                        background: activeTab === 'CONFIG' ? '#1e293b' : 'transparent',
                        color: activeTab === 'CONFIG' ? '#60a5fa' : '#94a3b8',
                        border: 'none',
                        borderBottom: `2px solid ${activeTab === 'CONFIG' ? '#3b82f6' : 'transparent'}`,
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Config
                </button>
            </div>

            {/* --- TAB BODY CONTENT --- */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

                {/* TAB 1: DASHBOARD OVERVIEW & JSON VIEWER */}
                {activeTab === 'DASHBOARD' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
                        {/* Summary Metrics Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                            <div style={{ background: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155' }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Purse Budget</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fbbf24', marginTop: '0.3rem' }}>{config.budget || 1000} Th</div>
                            </div>
                            <div style={{ background: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155' }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Teams Registered</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#60a5fa', marginTop: '0.3rem' }}>{teams.length} / {config.teamCount || 0}</div>
                            </div>
                            <div style={{ background: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155' }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Players</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#34d399', marginTop: '0.3rem' }}>{players.length}</div>
                            </div>
                            <div style={{ background: '#1e293b', padding: '1.2rem', borderRadius: '8px', border: '1px solid #334155' }}>
                                <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Sold / Remaining</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#a78bfa', marginTop: '0.3rem' }}>
                                    {players.filter(p => p.status === 'SOLD').length} / {players.filter(p => p.status !== 'SOLD').length}
                                </div>
                            </div>
                        </div>

                        {/* Full League Details JSON Renderer */}
                        <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', padding: '1.2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.8rem' }}>
                                <div>
                                    <h3 style={{ margin: 0, color: '#60a5fa', fontSize: '1.1rem' }}>League Data JSON (View Only)</h3>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Complete raw JSON payload for league state</span>
                                </div>
                                <button
                                    onClick={handleCopyJson}
                                    style={{
                                        background: copiedJson ? '#10b981' : '#334155',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {copiedJson ? '✓ Copied JSON' : '📋 Copy League JSON'}
                                </button>
                            </div>
                            <pre id="league-json-viewer" style={{
                                background: '#020617',
                                color: '#38bdf8',
                                padding: '1rem',
                                borderRadius: '6px',
                                maxHeight: '450px',
                                overflowY: 'auto',
                                overflowX: 'auto',
                                fontSize: '0.85rem',
                                fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
                                border: '1px solid #0f172a',
                                margin: 0
                            }}>
                                {JSON.stringify(league, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}

                {/* TAB 2: PLAYERS GRID (WITH SEARCH & CATEGORIES) */}
                {activeTab === 'PLAYERS' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', maxWidth: '1200px', margin: '0 auto' }}>
                        {/* Search & Category Filter Bar */}
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', background: '#1e293b', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid #334155' }}>
                            <input
                                id="dashboard-player-search"
                                type="text"
                                placeholder="Search by name, category, external ID..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    flex: 1,
                                    minWidth: '220px',
                                    padding: '0.6rem 1rem',
                                    background: '#0f172a',
                                    border: '1px solid #334155',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '0.9rem',
                                    outline: 'none'
                                }}
                            />
                            <select
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                                style={{ padding: '0.6rem 1rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.9rem', cursor: 'pointer' }}
                            >
                                <option value="ALL">All Categories</option>
                                <option value="BATTER">Batter</option>
                                <option value="BOWLER">Bowler</option>
                                <option value="WK">WK</option>
                                <option value="ALL-ROUNDER">All-Rounder</option>
                                <option value="GENERAL">General</option>
                            </select>
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                style={{ padding: '0.6rem 1rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff', fontSize: '0.9rem', cursor: 'pointer' }}
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="WAITING">Waiting</option>
                                <option value="SOLD">Sold</option>
                                <option value="UNSOLD">Unsold</option>
                            </select>
                        </div>

                        {/* Player Cards Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                            {filteredPlayers.map(p => (
                                <div key={p.id} style={{
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    padding: '1.2rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem',
                                    position: 'relative'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }}></span>
                                        <strong style={{ color: '#fff', fontSize: '1.1rem' }}>{p.name}</strong>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span style={{
                                            background: '#312e81',
                                            color: '#c7d2fe',
                                            fontSize: '0.7rem',
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '4px',
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase'
                                        }}>
                                            {p.category}
                                        </span>
                                        {p.externalId && (
                                            <span style={{
                                                background: '#065f46',
                                                color: '#a7f3d0',
                                                fontSize: '0.7rem',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '4px',
                                                fontWeight: 'bold'
                                            }}>
                                                ExtID: {p.externalId}
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fbbf24', marginTop: '0.2rem' }}>
                                        ${p.soldAt || p.basePrice || config.basePrice} <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'normal' }}>base price</span>
                                    </div>

                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                        Status: <strong style={{ color: p.status === 'SOLD' ? '#34d399' : (p.status === 'UNSOLD' ? '#ef4444' : '#f59e0b') }}>{p.status || 'WAITING'}</strong>
                                        {p.soldTo && <span style={{ color: '#60a5fa' }}> ({p.soldTo})</span>}
                                    </div>
                                </div>
                            ))}
                            {filteredPlayers.length === 0 && (
                                <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                                    No players matching search/filter criteria.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 3: TEAMS */}
                {activeTab === 'TEAMS' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.2rem', maxWidth: '1200px', margin: '0 auto' }}>
                        {teams.map(t => (
                            <div key={t.id || t.name} style={{ background: '#1e293b', border: '1px solid #334155', padding: '1.2rem', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                    <h3 style={{ margin: 0, color: '#60a5fa' }}>{t.name}</h3>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t.email || 'No email'}</span>
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '1rem' }}>
                                    Purse Remaining: <strong style={{ color: '#fbbf24' }}>{t.budget} Th</strong> | Squad: <strong>{t.squad?.length || 0}/{config.playersPerTeam}</strong>
                                </div>
                                <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: '0.4rem', marginBottom: '0.5rem' }}>Purchased Squad</h4>
                                {(!t.squad || t.squad.length === 0) ? (
                                    <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>No players acquired yet.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto' }}>
                                        {t.squad.map((sp, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', background: '#0f172a', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>
                                                <span style={{ color: '#fff' }}>{sp.name} <small style={{ color: '#94a3b8' }}>({sp.externalId || sp.category})</small></span>
                                                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{sp.soldAt} Th</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* TAB 4: BID HISTORY */}
                {activeTab === 'BIDS' && (
                    <div style={{ maxWidth: '800px', margin: '0 auto', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155', padding: '1.2rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: '#60a5fa' }}>Historical Bids</h3>
                        {bidHistory.length === 0 ? (
                            <p style={{ color: '#64748b' }}>No bids recorded in history for current player.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {bidHistory.map((b, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.6rem 1rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                                        <span>Bidder: <strong style={{ color: '#fff' }}>{b.holderName || b.holder || 'Unknown'}</strong></span>
                                        <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{b.amount} Th</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 5: ACTIVITY LOG */}
                {activeTab === 'LOGS' && (
                    <div style={{ maxWidth: '900px', margin: '0 auto', background: '#090d16', borderRadius: '8px', border: '1px solid #1e293b', padding: '1.2rem', fontFamily: 'monospace', color: '#34d399', fontSize: '0.85rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: '#60a5fa', fontFamily: 'sans-serif' }}>Activity Log Stream</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '400px', overflowY: 'auto' }}>
                            {activityLog.map((log, idx) => (
                                <div key={idx} style={{ borderBottom: '1px solid #1e293b', paddingBottom: '0.3rem' }}>
                                    [{log.time || 'LOG'}] {log.text}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB 6: CONFIG */}
                {activeTab === 'CONFIG' && (
                    <div style={{ maxWidth: '600px', margin: '0 auto', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155', padding: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1.2rem 0', color: '#60a5fa' }}>League Configuration Parameters</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
                            <div>
                                <span style={{ color: '#94a3b8' }}>League Name:</span>
                                <div style={{ color: '#fff', fontWeight: 'bold' }}>{league.name}</div>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8' }}>League Code:</span>
                                <div style={{ color: '#fbbf24', fontWeight: 'bold', fontFamily: 'monospace' }}>{league.code}</div>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8' }}>Team Count Limit:</span>
                                <div style={{ color: '#fff', fontWeight: 'bold' }}>{config.teamCount}</div>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8' }}>Squad Size (per team):</span>
                                <div style={{ color: '#fff', fontWeight: 'bold' }}>{config.playersPerTeam}</div>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8' }}>Starting Purse Budget:</span>
                                <div style={{ color: '#fff', fontWeight: 'bold' }}>{config.budget} Th</div>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8' }}>Base Player Price:</span>
                                <div style={{ color: '#fff', fontWeight: 'bold' }}>{config.basePrice} Th</div>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8' }}>Max Bid Limit:</span>
                                <div style={{ color: '#fff', fontWeight: 'bold' }}>{config.maxBid || 'Unlimited'}</div>
                            </div>
                            <div>
                                <span style={{ color: '#94a3b8' }}>Admin Email:</span>
                                <div style={{ color: '#fff', fontWeight: 'bold' }}>{league.adminEmail || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

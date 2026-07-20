import { useState } from 'react';

export default function SuperAdminDashboard({ allLeagues = [], socket }) {
    const [selectedLeague, setSelectedLeague] = useState(null);
    const [selectedCodes, setSelectedCodes] = useState([]);
    const [modalTab, setModalTab] = useState('TEAMS'); // 'TEAMS' | 'PLAYERS' | 'LOGS'
    const [playerFilter, setPlayerFilter] = useState('ALL'); // 'ALL' | 'SOLD' | 'UNSOLD' | 'WAITING'

    // Sort leagues newest to oldest by createdAt
    const sortedLeagues = [...allLeagues].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });

    // Metrics calculation
    const totalLeagues = allLeagues.length;
    const liveLeagues = allLeagues.filter(l => l.state === 'LIVE').length;
    const waitingLeagues = allLeagues.filter(l => l.state === 'WAITING').length;
    const totalTeamsCount = allLeagues.reduce((acc, l) => acc + (l.teams?.length || 0), 0);

    const getPlayerCounts = (league) => {
        const sold = league.players?.filter(p => p.status === 'SOLD')?.length || 0;
        const unsold = league.players?.filter(p => p.status === 'UNSOLD')?.length || 0;
        const waiting = league.players?.filter(p => p.status === 'WAITING')?.length || 0;
        return { sold, unsold, waiting };
    };

    const formatDate = (isoString) => {
        if (!isoString) return 'N/A';
        try {
            const date = new Date(isoString);
            return date.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
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

    // Bulk Checkbox handlers
    const isAllSelected = allLeagues.length > 0 && selectedCodes.length === allLeagues.length;

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedCodes(allLeagues.map(l => l.code));
        } else {
            setSelectedCodes([]);
        }
    };

    const handleToggleSelect = (code) => {
        setSelectedCodes(prev => 
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        );
    };

    const handleBulkForceEnd = () => {
        const activeSelected = allLeagues.filter(l => selectedCodes.includes(l.code) && l.state !== 'ENDED');
        if (activeSelected.length === 0) {
            alert("None of the selected leagues are currently active.");
            return;
        }

        const leagueNames = activeSelected.map(l => `• ${l.name} (${l.code})`).join('\n');
        if (window.confirm(`Are you sure you want to FORCE END ${activeSelected.length} active auction(s)?\n\n${leagueNames}`)) {
            activeSelected.forEach(l => {
                socket.emit('SUPER_ADMIN_END_LEAGUE', { leagueCode: l.code });
            });
            setSelectedCodes([]);
        }
    };

    const handleSingleForceEnd = (league, e) => {
        if (e) e.stopPropagation();
        if (window.confirm(`Are you sure you want to FORCE END the auction for "${league.name}" (${league.code})?`)) {
            socket.emit('SUPER_ADMIN_END_LEAGUE', { leagueCode: league.code });
            if (selectedLeague?.code === league.code) {
                setSelectedLeague(null);
            }
        }
    };

    return (
        <div className="container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', boxSizing: 'border-box' }}>
            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: '1rem' }}>
                <div>
                    <h1 className="text-gold" style={{ fontSize: '2.5rem', margin: 0, textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>SUPER ADMIN</h1>
                    <p className="text-muted" style={{ margin: 0 }}>System Management & Active League Monitor</p>
                </div>
            </header>

            {/* Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="card" style={{ textAlign: 'center', padding: '1.2rem' }}>
                    <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase' }}>Total Leagues</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: 'var(--secondary)', marginTop: '0.3rem' }}>{totalLeagues}</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1.2rem' }}>
                    <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase' }}>Live Auctions</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#10b981', marginTop: '0.3rem' }}>{liveLeagues}</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1.2rem' }}>
                    <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase' }}>Lobby / Waiting</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#f59e0b', marginTop: '0.3rem' }}>{waitingLeagues}</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1.2rem' }}>
                    <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase' }}>Total Teams</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: '0.3rem' }}>{totalTeamsCount}</div>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedCodes.length > 0 && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    padding: '0.8rem 1.2rem',
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    animation: 'fadeIn 0.2s ease'
                }}>
                    <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.95rem' }}>
                        Selected {selectedCodes.length} of {allLeagues.length} leagues
                    </span>
                    <div style={{ display: 'flex', gap: '0.8rem' }}>
                        <button
                            className="btn"
                            onClick={handleBulkForceEnd}
                            style={{ background: '#ef4444', color: '#fff', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                        >
                            🛑 Bulk Force End Auctions ({allLeagues.filter(l => selectedCodes.includes(l.code) && l.state !== 'ENDED').length})
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={() => setSelectedCodes([])}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', background: '#333', color: '#ccc', border: '1px solid #555' }}
                        >
                            Deselect All
                        </button>
                    </div>
                </div>
            )}

            {/* Leagues Monitor Data Table */}
            <div className="card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
                <h3 style={{ marginBottom: '1.2rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem', color: '#fff' }}>
                    Active Leagues Data Table (Sorted Newest First)
                </h3>
                
                {sortedLeagues.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#666', fontSize: '1.1rem' }}>
                        No active leagues currently registered in the system.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #333', color: '#888', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                                <th style={{ padding: '0.75rem 0.5rem', width: '40px', textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={handleSelectAll}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Code</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>League Name</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Admin Name & Email</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Created At</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Teams Joined</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Players (Sold / Left)</th>
                                <th style={{ padding: '0.75rem 0.5rem' }}>Purse</th>
                                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedLeagues.map(league => {
                                const { sold, unsold, waiting } = getPlayerCounts(league);
                                const isChecked = selectedCodes.includes(league.code);

                                return (
                                    <tr
                                        key={league.code}
                                        style={{
                                            borderBottom: '1px solid #222',
                                            background: isChecked ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                                            transition: 'background 0.2s',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setSelectedLeague(league)}
                                    >
                                        <td style={{ padding: '0.8rem 0.5rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleToggleSelect(league.code)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.8rem 0.5rem', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary)' }}>
                                            {league.code}
                                        </td>
                                        <td style={{ padding: '0.8rem 0.5rem', fontWeight: 'bold', color: '#fff' }}>
                                            {league.name}
                                        </td>
                                        <td style={{ padding: '0.8rem 0.5rem', color: '#aaa' }}>
                                            <div style={{ fontWeight: 'bold', color: '#ddd' }}>{league.adminName || 'Admin'}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#888' }}>{league.adminEmail || 'N/A'}</div>
                                        </td>
                                        <td style={{ padding: '0.8rem 0.5rem', color: '#aaa', fontSize: '0.8rem' }}>
                                            {formatDate(league.createdAt)}
                                        </td>
                                        <td style={{ padding: '0.8rem 0.5rem' }}>
                                            <span style={{
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                background: (stateColors[league.state] || '#555') + '22',
                                                color: stateColors[league.state] || '#555',
                                                border: `1px solid ${stateColors[league.state] || '#555'}`,
                                                fontWeight: 'bold'
                                            }}>
                                                {league.state}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.8rem 0.5rem', color: '#ccc' }}>
                                            <strong>{league.teams?.length || 0}</strong> / {league.config?.teamCount || 0}
                                        </td>
                                        <td style={{ padding: '0.8rem 0.5rem', color: '#ccc' }}>
                                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>{sold}</span> sold, <span style={{ color: '#f59e0b' }}>{waiting + unsold}</span> left
                                        </td>
                                        <td style={{ padding: '0.8rem 0.5rem', color: '#ccc' }}>
                                            {league.config?.budget} Th
                                        </td>
                                        <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                                <button
                                                    className="btn"
                                                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid #555', color: '#fff' }}
                                                    onClick={() => setSelectedLeague(league)}
                                                >
                                                    Inspect
                                                </button>
                                                {league.state !== 'ENDED' && (
                                                    <button
                                                        className="btn"
                                                        style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', background: '#ef4444', border: 'none', color: '#fff', fontWeight: 'bold' }}
                                                        onClick={e => handleSingleForceEnd(league, e)}
                                                    >
                                                        Force End
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* --- DETAILED LEAGUE INSPECTOR MODAL --- */}
            {selectedLeague && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
                }}>
                    <div className="card neon-border" style={{ maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.2rem', position: 'relative', padding: '2rem' }}>
                        
                        {/* Close button */}
                        <button 
                            onClick={() => setSelectedLeague(null)}
                            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: '#888', fontSize: '2rem', cursor: 'pointer' }}
                        >
                            &times;
                        </button>

                        {/* Modal Header */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                <h2 style={{ textTransform: 'uppercase', color: 'var(--primary)', margin: 0 }}>{selectedLeague.name}</h2>
                                <span style={{
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    background: (stateColors[selectedLeague.state] || '#555') + '22',
                                    color: stateColors[selectedLeague.state] || '#555',
                                    border: `1px solid ${stateColors[selectedLeague.state] || '#555'}`,
                                    fontWeight: 'bold'
                                }}>
                                    {selectedLeague.state}
                                </span>
                            </div>
                            <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: '#aaa', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                <span>Code: <strong style={{ color: '#fff', fontFamily: 'monospace' }}>{selectedLeague.code}</strong></span>
                                <span>Admin: <strong style={{ color: '#fff' }}>{selectedLeague.adminName || 'Admin'} ({selectedLeague.adminEmail || 'N/A'})</strong></span>
                                <span>Created At: <strong style={{ color: '#fff' }}>{formatDate(selectedLeague.createdAt)}</strong></span>
                                <span>Purse Budget: <strong style={{ color: 'var(--primary)' }}>{selectedLeague.config?.budget} Th</strong></span>
                            </div>
                        </div>

                        {/* Current Bidding Status Bar if Live */}
                        {selectedLeague.state === 'LIVE' && selectedLeague.currentPlayer && (
                            <div className="card" style={{ background: '#0f172a', textAlign: 'center', padding: '1rem', border: '1px solid var(--primary)' }}>
                                <small style={{ color: '#888', textTransform: 'uppercase' }}>CURRENT BIDDING ROUND</small>
                                <h3 style={{ margin: '0.3rem 0', color: '#fff' }}>{selectedLeague.currentPlayer.name} ({selectedLeague.currentPlayer.category})</h3>
                                <div style={{ fontSize: '1.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                                    {selectedLeague.currentBid?.amount ? `${selectedLeague.currentBid.amount} Th` : 'No bids placed yet'}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#ccc', marginTop: '0.2rem' }}>
                                    {selectedLeague.currentBid?.holderName ? `Leading Bidder: ${selectedLeague.currentBid.holderName}` : `Base Price: ${selectedLeague.currentPlayer.basePrice} Th`}
                                    {selectedLeague.activeTurn && <span style={{ marginLeft: '1rem', color: '#f59e0b', fontWeight: 'bold' }}>| Active Turn: {selectedLeague.activeTurn}</span>}
                                </div>
                            </div>
                        )}

                        {/* Navigation Tabs */}
                        <div style={{ display: 'flex', borderBottom: '1px solid #333', gap: '0.5rem' }}>
                            <button
                                className="btn"
                                style={{
                                    background: modalTab === 'TEAMS' ? 'var(--primary)' : 'transparent',
                                    color: modalTab === 'TEAMS' ? '#000' : '#888',
                                    fontWeight: 'bold',
                                    fontSize: '0.85rem',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px 4px 0 0'
                                }}
                                onClick={() => setModalTab('TEAMS')}
                            >
                                Teams & Captains ({selectedLeague.teams?.length || 0})
                            </button>
                            <button
                                className="btn"
                                style={{
                                    background: modalTab === 'PLAYERS' ? 'var(--primary)' : 'transparent',
                                    color: modalTab === 'PLAYERS' ? '#000' : '#888',
                                    fontWeight: 'bold',
                                    fontSize: '0.85rem',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px 4px 0 0'
                                }}
                                onClick={() => setModalTab('PLAYERS')}
                            >
                                Full Player Roster ({selectedLeague.players?.length || 0})
                            </button>
                            <button
                                className="btn"
                                style={{
                                    background: modalTab === 'LOGS' ? 'var(--primary)' : 'transparent',
                                    color: modalTab === 'LOGS' ? '#000' : '#888',
                                    fontWeight: 'bold',
                                    fontSize: '0.85rem',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px 4px 0 0'
                                }}
                                onClick={() => setModalTab('LOGS')}
                            >
                                Live Activity Logs ({selectedLeague.activityLog?.length || 0})
                            </button>
                        </div>

                        {/* TAB 1: TEAMS & CAPTAINS */}
                        {modalTab === 'TEAMS' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '300px', overflowY: 'auto' }}>
                                {(!selectedLeague.teams || selectedLeague.teams.length === 0) ? (
                                    <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>No teams have joined this league yet.</div>
                                ) : (
                                    selectedLeague.teams.map(t => (
                                        <div key={t.id || t.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #333', padding: '0.8rem 1rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <h4 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>{t.name}</h4>
                                                <small style={{ color: '#888' }}>Captain Email: {t.email || 'N/A'}</small>
                                            </div>
                                            <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#ccc' }}>
                                                <div>Remaining Purse: <strong style={{ color: 'var(--primary)' }}>{t.budget} Th</strong></div>
                                                <div>Squad Size: <strong>{t.squad?.length || 0} / {selectedLeague.config?.playersPerTeam}</strong></div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* TAB 2: PLAYERS ROSTER */}
                        {modalTab === 'PLAYERS' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#888' }}>Filter:</span>
                                    {['ALL', 'SOLD', 'UNSOLD', 'WAITING'].map(f => (
                                        <button
                                            key={f}
                                            style={{
                                                padding: '0.2rem 0.6rem',
                                                fontSize: '0.75rem',
                                                borderRadius: '4px',
                                                background: playerFilter === f ? '#333' : 'transparent',
                                                color: playerFilter === f ? 'var(--primary)' : '#888',
                                                border: `1px solid ${playerFilter === f ? 'var(--primary)' : '#444'}`,
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => setPlayerFilter(f)}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>

                                <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #333', borderRadius: '4px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ background: '#111', color: '#888', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                                <th style={{ padding: '0.5rem' }}>Player Name</th>
                                                <th style={{ padding: '0.5rem' }}>Category</th>
                                                <th style={{ padding: '0.5rem' }}>Base Price</th>
                                                <th style={{ padding: '0.5rem' }}>Status</th>
                                                <th style={{ padding: '0.5rem' }}>Sold Amount</th>
                                                <th style={{ padding: '0.5rem' }}>Purchased By</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedLeague.players
                                                ?.filter(p => playerFilter === 'ALL' || p.status === playerFilter)
                                                .map(p => (
                                                    <tr key={p.id} style={{ borderBottom: '1px solid #222' }}>
                                                        <td style={{ padding: '0.5rem', fontWeight: 'bold', color: '#fff' }}>{p.name}</td>
                                                        <td style={{ padding: '0.5rem', color: '#aaa' }}>{p.category}</td>
                                                        <td style={{ padding: '0.5rem', color: '#aaa' }}>{p.basePrice} Th</td>
                                                        <td style={{ padding: '0.5rem' }}>
                                                            <span style={{
                                                                color: p.status === 'SOLD' ? '#10b981' : p.status === 'UNSOLD' ? '#ef4444' : '#f59e0b',
                                                                fontWeight: 'bold',
                                                                fontSize: '0.75rem'
                                                            }}>
                                                                {p.status}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.5rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                                                            {p.soldPrice ? `${p.soldPrice} Th` : '-'}
                                                        </td>
                                                        <td style={{ padding: '0.5rem', color: '#fff' }}>
                                                            {p.teamName || '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: ACTIVITY LOGS */}
                        {modalTab === 'LOGS' && (
                            <div style={{ maxHeight: '280px', overflowY: 'auto', background: '#090d16', padding: '0.8rem', borderRadius: '6px', border: '1px solid #222', fontSize: '0.8rem', fontFamily: 'monospace', color: '#34d399' }}>
                                {(!selectedLeague.activityLog || selectedLeague.activityLog.length === 0) ? (
                                    <div style={{ color: '#666', textStyle: 'italic' }}>No activity logged yet for this league.</div>
                                ) : (
                                    selectedLeague.activityLog.map((log, i) => (
                                        <div key={i} style={{ borderBottom: '1px solid #1e293b', padding: '0.3rem 0' }}>
                                            [{log.time || 'LOG'}] {log.text}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Modal Footer */}
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <button 
                                className="btn" 
                                onClick={() => setSelectedLeague(null)} 
                                style={{ flex: 1, background: '#334155', color: '#fff' }}
                            >
                                Close Inspection
                            </button>
                            {selectedLeague.state !== 'ENDED' && (
                                <button 
                                    className="btn" 
                                    onClick={e => handleSingleForceEnd(selectedLeague, e)} 
                                    style={{ flex: 1, background: '#ef4444', color: '#fff', fontWeight: 'bold' }}
                                >
                                    Force End Auction
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

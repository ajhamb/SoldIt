import { useState } from 'react';

export default function SuperAdminDashboard({ allLeagues, socket }) {
    const [selectedLeague, setSelectedLeague] = useState(null);

    // Calculate metrics
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

    return (
        <div className="container" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: '1rem' }}>
                <div>
                    <h1 className="text-gold" style={{ fontSize: '2.5rem', margin: 0, textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>SUPER ADMIN</h1>
                    <p className="text-muted" style={{ margin: 0 }}>System Management & Active League Monitor</p>
                </div>
            </header>

            {/* Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <div style={{ color: '#888', fontSize: '0.9rem', textTransform: 'uppercase' }}>Total Leagues</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--secondary)', marginTop: '0.5rem' }}>{totalLeagues}</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <div style={{ color: '#888', fontSize: '0.9rem', textTransform: 'uppercase' }}>Live Auctions</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981', marginTop: '0.5rem' }}>{liveLeagues}</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <div style={{ color: '#888', fontSize: '0.9rem', textTransform: 'uppercase' }}>Lobby / Setup</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#f59e0b', marginTop: '0.5rem' }}>{waitingLeagues}</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <div style={{ color: '#888', fontSize: '0.9rem', textTransform: 'uppercase' }}>Total Teams</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: '0.5rem' }}>{totalTeamsCount}</div>
                </div>
            </div>

            {/* Leagues Monitor Grid */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>Active Leagues Status</h3>
                
                {allLeagues.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#666', fontSize: '1.2rem' }}>
                        No active leagues currently running in the system.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {allLeagues.map(league => {
                            const { sold, unsold, waiting } = getPlayerCounts(league);
                            const stateColors = {
                                WAITING: '#f59e0b',
                                LIVE: '#10b981',
                                PAUSED: '#3b82f6',
                                ENDED: '#ef4444'
                            };

                            return (
                                <div key={league.code} className="card neon-border" style={{ borderColor: stateColors[league.state] || '#555', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(30, 41, 59, 0.5)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>CODE: <strong>{league.code}</strong></span>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            background: stateColors[league.state] + '22',
                                            color: stateColors[league.state],
                                            border: `1px solid ${stateColors[league.state]}`,
                                            fontWeight: 'bold'
                                        }}>
                                            {league.state}
                                        </span>
                                    </div>
                                    
                                    <div>
                                        <h3 style={{ margin: 0, textTransform: 'uppercase', color: '#fff' }}>{league.name}</h3>
                                        <small style={{ color: '#888' }}>Admin PIN: <strong style={{ color: '#ffaaaa' }}>{league.adminPin}</strong> / Captain PIN: <strong style={{ color: 'var(--primary)' }}>{league.captainPin}</strong></small>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem', color: '#ccc', borderTop: '1px solid #333', borderBottom: '1px solid #333', padding: '0.8rem 0' }}>
                                        <div>Teams: <strong>{league.teams?.length || 0} / {league.config?.teamCount}</strong></div>
                                        <div>Players Sold: <strong style={{ color: '#10b981' }}>{sold}</strong></div>
                                        <div>Budget: <strong>{league.config?.budget} Th</strong></div>
                                        <div>Players Left: <strong style={{ color: '#f59e0b' }}>{waiting + unsold}</strong></div>
                                    </div>

                                    <button 
                                        className="btn btn-primary" 
                                        style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)' }}
                                        onClick={() => setSelectedLeague(league)}
                                    >
                                        Inspect League
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Inspect Modal */}
            {selectedLeague && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '2rem'
                }}>
                    <div className="card neon-border" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', padding: '2rem' }}>
                        <button 
                            onClick={() => setSelectedLeague(null)}
                            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: '#888', fontSize: '2rem', cursor: 'pointer' }}
                        >
                            &times;
                        </button>

                        <div>
                            <span className="text-muted" style={{ fontSize: '0.9rem' }}>LEAGUE CODE: <strong>{selectedLeague.code}</strong></span>
                            <h2 style={{ textTransform: 'uppercase', color: 'var(--primary)', margin: '0.2rem 0' }}>{selectedLeague.name}</h2>
                            <small className="text-muted">State: <strong>{selectedLeague.state}</strong> | Admin PIN: <strong>{selectedLeague.adminPin}</strong> | Captain PIN: <strong>{selectedLeague.captainPin}</strong></small>
                        </div>

                        <hr style={{ borderColor: '#333' }} />

                        {selectedLeague.state === 'LIVE' && selectedLeague.currentPlayer ? (
                            <div className="card" style={{ background: '#0f172a', textAlign: 'center', padding: '1rem' }}>
                                <div className="text-muted" style={{ fontSize: '0.8rem' }}>CURRENT BIDDING ROUND</div>
                                <h3 style={{ margin: '0.5rem 0', color: '#fff' }}>{selectedLeague.currentPlayer.name} ({selectedLeague.currentPlayer.category})</h3>
                                <div style={{ fontSize: '2rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                                    {selectedLeague.currentBid?.amount ? `${selectedLeague.currentBid.amount} Th` : 'No bids yet'}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#888' }}>
                                    {selectedLeague.currentBid?.holderName ? `Highest Bidder: ${selectedLeague.currentBid.holderName}` : `Base Price: ${selectedLeague.currentPlayer.basePrice} Th`}
                                </div>
                                <div style={{ marginTop: '0.5rem', color: '#f59e0b', fontWeight: 'bold' }}>
                                    {selectedLeague.activeTurn ? `Active Bidding Turn: ${selectedLeague.activeTurn}` : 'Waiting for bid action'}
                                </div>
                            </div>
                        ) : (
                            <div className="card" style={{ background: '#0f172a', textAlign: 'center', padding: '1rem', color: '#888' }}>
                                No active bidding round currently live. (Lobby state or Round Transition)
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', minHeight: '200px' }}>
                            {/* Standings list */}
                            <div>
                                <h4 style={{ marginBottom: '0.8rem', borderBottom: '1px solid #333', paddingBottom: '0.3rem', color: 'var(--secondary)' }}>TEAMS STANDINGS</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                                    {selectedLeague.teams?.length === 0 ? (
                                        <div style={{ color: '#555', fontSize: '0.9rem' }}>No teams joined yet.</div>
                                    ) : (
                                        selectedLeague.teams?.map(t => (
                                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                                                <span style={{ fontWeight: 'bold' }}>{t.name}</span>
                                                <span style={{ color: '#ccc' }}>Purse: <strong style={{ color: 'var(--primary)' }}>{t.budget} Th</strong> ({t.squad?.length || 0} spots)</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Logs list */}
                            <div>
                                <h4 style={{ marginBottom: '0.8rem', borderBottom: '1px solid #333', paddingBottom: '0.3rem', color: 'var(--secondary)' }}>LIVE ACTIVITY LOG</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', fontSize: '0.8rem', fontFamily: 'monospace', color: '#aaa' }}>
                                    {selectedLeague.activityLog?.length === 0 ? (
                                        <div style={{ color: '#555' }}>No activity log yet.</div>
                                    ) : (
                                        selectedLeague.activityLog?.slice(0, 10).map((log, idx) => (
                                            <div key={idx} style={{ borderBottom: '1px solid #222', paddingBottom: '0.3rem' }}>
                                                [{log.time || 'INFO'}] {log.text}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button 
                                className="btn" 
                                onClick={() => setSelectedLeague(null)} 
                                style={{ flex: 1, background: '#475569', color: '#fff' }}
                            >
                                Close Monitor
                            </button>
                            {selectedLeague.state !== 'ENDED' && (
                                <button 
                                    className="btn" 
                                    onClick={() => {
                                        if (window.confirm(`Are you sure you want to FORCE END the auction for "${selectedLeague.name}"? This action cannot be undone.`)) {
                                            socket.emit('SUPER_ADMIN_END_LEAGUE', { leagueCode: selectedLeague.code });
                                            setSelectedLeague(null);
                                        }
                                    }} 
                                    style={{ flex: 1, background: '#ef4444', color: '#fff', border: '1px solid #dc2626' }}
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

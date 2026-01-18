import { useState } from 'react';
import AdminControls from './AdminControls';
import CaptainControls from './CaptainControls';
import PlayerListView from './PlayerListView';
import ActivityWidget from './ActivityWidget';
import RulesModal from './RulesModal';

export default function AuctionRoom({ socket, role, name, leagueCode, leagueState }) {
    const [showPlayers, setShowPlayers] = useState(false);
    const [showRules, setShowRules] = useState(false);
    // PIN Toggle
    const [showPin, setShowPin] = useState(false);

    // One-time onboarding modal for new leagues
    const [showSuccess, setShowSuccess] = useState(!!leagueState?.isNew);

    if (!leagueState) return <div className="container">Loading Auction Room...</div>;

    const { currentPlayer, currentBid, teams, state, players, config, biddingOrder, activeTurn } = leagueState;
    const isLive = state === 'LIVE';

    // Find my team if captain
    const myTeam = role === 'CAPTAIN' ? teams.find(t => t.name === name) : null;

    // Squad Stats
    const getSquadCount = (team) => team.squad?.length || 0;
    // Fix: Ensure we fallback to 15 only if config is missing, but config should be there.
    const getMaxSquad = () => config?.playersPerTeam || 15;

    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', gap: '1rem', boxSizing: 'border-box' }}>

            {/* ROUND ROBIN ORDER BAR */}
            {isLive && biddingOrder && biddingOrder.length > 0 && (
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflowX: 'auto', padding: '0.8rem', background: '#0f172a' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--primary)', whiteSpace: 'nowrap' }}>BIDDING ORDER:</span>
                    {biddingOrder.map((teamName, i) => (
                        <div
                            key={teamName}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.4rem 0.8rem',
                                borderRadius: '4px',
                                background: activeTurn === teamName ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${activeTurn === teamName ? 'var(--primary)' : 'transparent'}`,
                                boxSizing: 'border-box',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <span style={{ color: activeTurn === teamName ? 'var(--primary)' : '#888', fontWeight: activeTurn === teamName ? 'bold' : 'normal' }}>
                                {i + 1}. {teamName}
                            </span>
                            {activeTurn === teamName && <span style={{ fontSize: '0.8rem' }}>🟢</span>}
                        </div>
                    ))}
                </div>
            )}

            {/* TOP ROW: HEADER + STAGE + SIDEBAR */}
            {/* flex-1 to take up available space, minHeight 0 to allow internal scrolling */}
            <div className="responsive-layout">

                {/* LEFT COLUMN: HEADER & STAGE */}
                <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

                    {/* HEADER */}
                    <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center', background: '#111', padding: '1rem', borderRadius: '8px' }}>
                        <div>
                            <h2 className="text-gold" style={{ margin: 0, fontSize: '1.5rem' }}>LEAGUE: {leagueCode}</h2>
                            <small className="text-muted">{leagueState.name}</small>
                            {role === 'ADMIN' && leagueState.adminPin && (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#ff7777' }}>
                                    <span style={{ cursor: 'pointer' }} onClick={() => setShowPin(!showPin)}>
                                        🔑 ADMIN PIN: <strong>{showPin ? leagueState.adminPin : '******'}</strong> (Click to {showPin ? 'hide' : 'reveal'})
                                    </span>
                                    <span style={{ marginLeft: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                        ⚠️ PLEASE SAVE THIS PIN and LEAGUE CODE Above!
                                    </span>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button className="btn" style={{ background: '#333', border: '1px solid #555', color: '#ccc', fontSize: '0.9rem' }} onClick={() => setShowRules(true)}>
                                Rules
                            </button>
                            <button className="btn" style={{ background: '#444', color: '#fff', fontSize: '0.9rem' }} onClick={() => setShowPlayers(true)}>
                                Players ({players?.length})
                            </button>
                            <span style={{ padding: '0.5rem 1rem', background: '#222', borderRadius: '4px', border: '1px solid #444' }}>
                                <strong
                                    className={role === 'ADMIN' ? 'text-magenta' : 'text-cyan'}
                                    style={{ fontSize: '1.5rem', textTransform: 'uppercase', textShadow: '0 0 5px rgba(255,255,255,0.3)' }}
                                >
                                    {name}
                                </strong>
                            </span>
                        </div>
                    </header>

                    {/* MAIN STAGE */}
                    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        {!isLive && state !== 'ENDED' && (
                            <div style={{ textAlign: 'center' }}>
                                <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>WAITING AREA</h1>
                                <p className="text-muted">
                                    {teams.length < (leagueState.config?.teamCount || 0)
                                        ? "Waiting for more teams to join..."
                                        : "All teams joined! Admin can start the auction."}
                                </p>
                                <div style={{ marginTop: '1rem', color: '#666', fontSize: '1.2rem' }}>
                                    Teams Joined: <strong style={{ color: teams.length === leagueState.config?.teamCount ? 'var(--primary)' : '#fff' }}>
                                        {teams.length} / {leagueState.config?.teamCount}
                                    </strong>
                                </div>
                                {role === 'ADMIN' && (
                                    <div style={{ marginTop: '2rem' }}>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => socket.emit('START_AUCTION', { leagueCode })}
                                            disabled={teams.length < leagueState.config?.teamCount}
                                        >
                                            {teams.length < leagueState.config?.teamCount
                                                ? `WAITING FOR ${leagueState.config.teamCount - teams.length} MORE...`
                                                : "START AUCTION"}
                                        </button>
                                        {teams.length < leagueState.config?.teamCount && (
                                            <div style={{ marginTop: '1rem', color: '#ff7777', fontSize: '0.9rem' }}>
                                                (Auction can only start when all {leagueState.config?.teamCount} teams have joined)
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {isLive && currentPlayer && (
                            <div className="card neon-border" style={{ width: '100%', maxWidth: '600px', textAlign: 'center', padding: '2rem' }}>
                                <div style={{ fontSize: '1.2rem', color: '#777', marginBottom: '0.5rem' }}>{currentPlayer.category}</div>
                                <h1 style={{ fontSize: '3.5rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{currentPlayer.name}</h1>
                                <div style={{ fontSize: '1.8rem', color: '#fff' }}>Base Price: {currentPlayer.basePrice} Th</div>

                                <hr style={{ borderColor: '#333', margin: '1.5rem 0' }} />

                                <div style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                                    {activeTurn ? `TURN: ${activeTurn}` : "BIDDING ROUND OVER"}
                                </div>

                                <div style={{ marginBottom: '0.5rem' }}>CURRENT BID</div>
                                <div style={{ fontSize: '4rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                                    {currentBid.amount}
                                </div>
                                <div style={{ fontSize: '1.2rem', color: currentBid.holder ? 'var(--secondary)' : '#555' }}>
                                    {currentBid.holder ? `HELD BY ${currentBid.holderName}` : "NO BIDS YET"}
                                </div>
                            </div>
                        )}

                        {state === 'ENDED' && <h1>AUCTION ENDED</h1>}
                    </main>

                    {/* CONTROLS */}
                    <div style={{ marginTop: '1rem' }}>
                        {role === 'ADMIN' && isLive && (
                            <AdminControls socket={socket} leagueCode={leagueCode} maxBid={leagueState.config?.maxBid} />
                        )}
                        {role === 'CAPTAIN' && isLive && myTeam && (
                            <CaptainControls
                                socket={socket}
                                leagueCode={leagueCode}
                                currentBid={currentBid}
                                myTeam={myTeam}
                                basePrice={leagueState.config.basePrice}
                                maxBid={leagueState.config?.maxBid}
                                playersPerTeam={leagueState.config?.playersPerTeam}
                                hasPassed={leagueState.passedTeams?.includes(myTeam.name)}
                                activeTurn={activeTurn}
                            />
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: STANDINGS */}
                <div className="card responsive-sidebar">
                    <h3 style={{ marginBottom: '1rem', textTransform: 'uppercase', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>Standings</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                        {teams && teams.map(t => (
                            <div key={t.id} style={{
                                padding: '0.8rem',
                                background: activeTurn === t.name ? 'rgba(255, 215, 0, 0.1)' : '#222',
                                borderRadius: '4px',
                                borderLeft: `4px solid ${activeTurn === t.name ? 'var(--primary)' : 'transparent'}`,
                                borderRight: `4px solid ${t.id === (currentBid?.holder) ? 'var(--secondary)' : 'transparent'}`
                            }}>
                                <div style={{ fontWeight: 'bold', fontSize: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>
                                        {t.name}
                                        {activeTurn === t.name && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>👉</span>}
                                    </span>
                                    <span style={{ color: 'var(--primary)' }}>{t.budget} Th</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem', fontSize: '0.8rem' }}>
                                    <span className="text-muted">Squad: {getSquadCount(t)} / {getMaxSquad()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* BOTTOM ROW: WIDGET */}
            <div style={{ height: '200px', flexShrink: 0 }}>
                <ActivityWidget activityLog={leagueState.activityLog} />
            </div>

            {/* MODALS */}
            {showPlayers && (
                <PlayerListView
                    players={players || []}
                    teams={teams || []}
                    onClose={() => setShowPlayers(false)}
                    socket={socket}
                    role={role}
                    leagueCode={leagueCode}
                />
            )}
            {showRules && (
                <RulesModal config={config} onClose={() => setShowRules(false)} />
            )}

            {/* --- ONBOARDING / SUCCESS MODAL --- */}
            {showSuccess && role === 'ADMIN' && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 2000, padding: '1rem'
                }}>
                    <div className="card neon-border" style={{ maxWidth: '500px', width: '100%', textAlign: 'center', padding: '2rem' }}>
                        <h2 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>🎉 LEAGUE CREATED!</h2>
                        <p style={{ color: '#ccc', marginBottom: '2rem' }}>Please save your credentials carefully!</p>

                        <div style={{ background: '#111', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333', marginBottom: '2rem' }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <small style={{ color: '#888', display: 'block', textTransform: 'uppercase', fontSize: '0.7rem' }}>League Code</small>
                                <strong style={{ fontSize: '2.5rem', color: '#fff', letterSpacing: '2px' }}>{leagueCode}</strong>
                            </div>
                            <div>
                                <small style={{ color: '#888', display: 'block', textTransform: 'uppercase', fontSize: '0.7rem' }}>Admin PIN</small>
                                <strong style={{ fontSize: '2.5rem', color: '#fca5a5', letterSpacing: '2px' }}>{leagueState.adminPin}</strong>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255, 119, 119, 0.1)', padding: '1rem', borderRadius: '4px', border: '1px solid #ff7777', marginBottom: '2rem', fontSize: '0.9rem', color: '#ff7777' }}>
                            ⚠️ <strong>IMPORTANT:</strong> You will need both the League Code and PIN to rejoin as Admin if you refresh or switch devices.
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%', padding: '1rem' }} onClick={() => setShowSuccess(false)}>
                            I HAVE SAVED THEM!
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

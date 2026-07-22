import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Welcome({ onJoin, user, socket }) {
    const [view, setView] = useState('MENU'); // MENU, CREATE, JOIN, SUPER_ADMIN
    const [showCsvHelp, setShowCsvHelp] = useState(false);
    const [showHowTo, setShowHowTo] = useState(false);

    // Dashboard Leagues State
    const [adminLeagues, setAdminLeagues] = useState([]);
    const [invitedLeagues, setInvitedLeagues] = useState([]);
    const [loadingLeagues, setLoadingLeagues] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);



    // Modal to request Team Name when Captain enters league for first time
    const [captainJoinModal, setCaptainJoinModal] = useState(null); // league object
    const [newTeamName, setNewTeamName] = useState('');

    // User Identity for offline mock / super admin joins
    const [mockEmailInput, setMockEmailInput] = useState('');

    // League Config (for CREATE mode)
    const [config, setConfig] = useState({
        leagueName: "HOPL-Win-26",
        teamCount: 5,
        playersPerTeam: 9,
        budget: 1000,
        basePrice: 50,
        maxBid: 200,
        players: []
    });

    // Manual Player Entry State
    const [manualPlayer, setManualPlayer] = useState({
        name: '',
        category: 'Batter'
    });

    // Fetch dashboard data via Socket
    const loadDashboardLeagues = () => {
        if (!user) return;
        setLoadingLeagues(true);
        socket.emit('GET_MY_LEAGUES', { email: user.email.toLowerCase() });
    };

    useEffect(() => {
        if (!user) return;

        const handleMyLeagues = ({ adminLeagues, invitedLeagues, isSuperAdmin: superAdminFlag }) => {
            setAdminLeagues(adminLeagues);
            setInvitedLeagues(invitedLeagues);
            setIsSuperAdmin(Boolean(superAdminFlag));
            setLoadingLeagues(false);
        };

        socket.on('MY_LEAGUES', handleMyLeagues);
        loadDashboardLeagues();

        return () => {
            socket.off('MY_LEAGUES', handleMyLeagues);
        };
    }, [user]);

    // Google Login/Logout handlers
    const handleGoogleLogin = async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) alert("Google Login Error: " + error.message);
    };

    const handleLogout = async () => {
        localStorage.removeItem('e2e_mock_user');
        localStorage.removeItem('auction_session');
        if (supabase) {
            try {
                const { error } = await supabase.auth.signOut();
                if (error && error.message !== 'Auth session missing') {
                    console.warn("Logout error:", error.message);
                }
            } catch (err) {
                console.error("Supabase signOut error:", err);
            }
        }
        window.location.reload();
    };

    // CSV Parse
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const text = evt.target.result;
                const lines = text.split('\n');
                const players = lines
                    .map(line => {
                        const parts = line.split(',');
                        if (!parts[0] || parts[0].trim() === "") return null;
                        return {
                            name: parts[0].trim(),
                            category: parts[1]?.trim() || 'General',
                            basePrice: config.basePrice
                        };
                    })
                    .filter(p => p !== null);

                setConfig(prev => {
                    let duplicatesFound = false;
                    const currentBatchNames = new Set();
                    const newPlayers = players.filter(p => {
                        const isDuplicateInList = prev.players.some(ep => ep.name.toLowerCase() === p.name.toLowerCase());
                        const isDuplicateInBatch = currentBatchNames.has(p.name.toLowerCase());

                        if (isDuplicateInList || isDuplicateInBatch) {
                            duplicatesFound = true;
                            return false;
                        }
                        currentBatchNames.add(p.name.toLowerCase());
                        return true;
                    });

                    if (duplicatesFound) {
                        alert("Note: Some players with duplicate names were automatically skipped.");
                    }

                    return {
                        ...prev,
                        players: [...prev.players, ...newPlayers]
                    };
                });
            };
            reader.readAsText(file);
        }
    };

    const addManualPlayer = () => {
        if (!manualPlayer.name.trim()) return;
        
        const isDuplicate = config.players.some(p => p.name.toLowerCase() === manualPlayer.name.trim().toLowerCase());
        if (isDuplicate) {
            alert("A player with this name already exists in the league list.");
            return;
        }

        setConfig(prev => ({
            ...prev,
            players: [...prev.players, {
                name: manualPlayer.name.trim(),
                category: manualPlayer.category,
                basePrice: config.basePrice
            }]
        }));
        setManualPlayer({ name: '', category: 'Batter' });
    };

    const removePlayer = (index) => {
        setConfig(prev => ({
            ...prev,
            players: prev.players.filter((_, i) => i !== index)
        }));
    };

    // Actions
    const handleCreate = () => {
        const adminName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Admin";
        if (config.players.length === 0) return alert("Please add at least one player to the league!");

        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        onJoin(adminName, newCode, 'ADMIN', {
            ...config,
            adminEmail: user?.email?.toLowerCase()
        });
    };

    // Handles the entry of an admin into their own league
    const handleAdminEnter = (league) => {
        const adminName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Admin";
        onJoin(adminName, league.code, 'ADMIN');
    };

    // Handles the entry of a captain into an invited league
    const handleCaptainEnter = (league) => {
        const myTeam = league.teams?.find(t => t.email?.toLowerCase() === user.email.toLowerCase());
        if (myTeam) {
            onJoin(myTeam.name, league.code, 'CAPTAIN', { email: user.email });
        } else {
            setCaptainJoinModal(league);
            setNewTeamName('');
        }
    };

    const handleConfirmCaptainJoin = () => {
        if (!newTeamName.trim()) return alert("Please enter your Team Name");
        if (!captainJoinModal) return;

        const isTaken = captainJoinModal.teams?.some(t => t.name.toLowerCase() === newTeamName.trim().toLowerCase());
        if (isTaken) return alert(`Team Name "${newTeamName}" is already taken!`);

        onJoin(newTeamName.trim(), captainJoinModal.code, 'CAPTAIN', { email: user.email });
        setCaptainJoinModal(null);
    };



    // Mock sign-in handler for E2E and offline testing
    const handleMockLogin = (e) => {
        e.preventDefault();
        if (!mockEmailInput.trim()) return alert("Email is required");
        const email = mockEmailInput.trim().toLowerCase();
        const mockUser = {
            email,
            user_metadata: {
                full_name: email.split('@')[0]
            }
        };
        localStorage.setItem('e2e_mock_user', JSON.stringify(mockUser));
        window.location.reload();
    };

    const inputStyle = {
        width: '100%', padding: '0.8rem', marginBottom: '1rem',
        borderRadius: '4px', background: 'rgba(0,0,0,0.3)', border: '1px solid #444', color: '#fff'
    };

    // --- GATEKEEPER VIEW: Login Enforced ---
    if (!user) {
        return (
            <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '2rem' }}>
                <h1 style={{ fontSize: '4.5rem', color: 'var(--primary)', marginBottom: '1rem', textShadow: '0 0 25px rgba(255, 215, 0, 0.4)' }}>SoldIt</h1>
                <p className="text-muted" style={{ marginBottom: '3rem', fontSize: '1.25rem' }}>Real-time IPL Style Draft & Auction</p>
                
                <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2.5rem', textAlign: 'center' }}>
                    <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Welcome to SoldIt</h2>
                    
                    {supabase ? (
                        <>
                            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '2rem' }}>Sign in with Google to access your leagues, manage drafts, and bid in real-time.</p>
                            <button id="google-login-btn" className="btn" style={{ width: '100%', background: '#fff', color: '#000', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', border: 'none', padding: '1rem', borderRadius: '30px', cursor: 'pointer', fontSize: '1.05rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} onClick={handleGoogleLogin}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                                </svg>
                                Sign in with Google
                            </button>
                        </>
                    ) : (
                        <form onSubmit={handleMockLogin}>
                            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>Offline Mode: Enter your email to simulate authenticating and access the dashboard.</p>
                            <input 
                                id="offline-email-input"
                                type="email" 
                                value={mockEmailInput} 
                                onChange={e => setMockEmailInput(e.target.value)} 
                                placeholder="e.g. admin@example.com" 
                                style={inputStyle} 
                                required 
                            />
                            <button id="offline-signin-btn" className="btn btn-primary" type="submit" style={{ width: '100%', padding: '0.8rem', borderRadius: '30px' }}>
                                Sign In (Offline Dev Mode)
                            </button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '2rem', position: 'relative' }}>
            {/* --- USER WIDGET (TOP RIGHT) --- */}
            {user && (
                <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(0,0,0,0.6)', padding: '0.5rem 1rem', borderRadius: '30px', border: '1px solid #444', backdropFilter: 'blur(4px)' }}>
                        {user.user_metadata?.avatar_url && (
                            <img src={user.user_metadata.avatar_url} alt="User avatar" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                        )}
                        <span style={{ fontSize: '0.85rem', color: '#ccc' }}>{user.email}</span>
                        <button id="signout-btn" className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', border: 'none', background: '#ef4444', borderRadius: '4px', cursor: 'pointer', color: '#fff', fontWeight: 'bold' }} onClick={handleLogout}>
                            Sign Out
                        </button>
                    </div>
                </div>
            )}

            <h1 style={{ fontSize: '3.5rem', color: 'var(--primary)', marginBottom: '0.5rem', textShadow: '0 0 20px rgba(255, 215, 0, 0.3)' }}>SoldIt</h1>
            <p className="text-muted" style={{ marginBottom: '2rem', fontSize: '1.1rem' }}>Real-time IPL Style Auction</p>

            {/* --- DASHBOARD VIEW (when logged in) --- */}
            {view === 'MENU' && (
                <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button id="create-league-btn" className="btn btn-primary" onClick={() => setView('CREATE')}>
                            Create New League
                        </button>
                        <button className="btn" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #444', color: '#888' }} onClick={() => setShowHowTo(true)}>
                            How To Play?
                        </button>
                        {isSuperAdmin && (
                            <button id="super-admin-menu-btn" className="btn" style={{ background: 'transparent', border: '2px solid #8b5cf6', color: '#a78bfa' }} onClick={() => onJoin(user?.email || 'admin', '', 'SUPER_ADMIN')}>
                                Super Admin
                            </button>
                        )}
                    </div>

                    {loadingLeagues ? (
                        <div style={{ color: 'var(--primary)', fontSize: '1.2rem', padding: '2rem' }}>Loading dashboard leagues...</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            {/* Managed leagues (Admin) */}
                            <div className="card" style={{ textAlign: 'left', background: 'rgba(0,0,0,0.15)', borderColor: '#333' }}>
                                <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '0.5rem', color: 'var(--primary)', marginBottom: '1rem' }}>Leagues You Manage</h3>
                                {adminLeagues.length === 0 ? (
                                    <p className="text-muted" style={{ fontSize: '0.9rem' }}>You haven't created any leagues yet.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
                                        {adminLeagues.map(l => {
                                            const stateColors = { WAITING: '#f59e0b', LIVE: '#10b981', PAUSED: '#3b82f6', ENDED: '#ef4444' };
                                            return (
                                                <div key={l.code} className="league-card" style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <strong style={{ color: '#fff' }}>{l.name}</strong>
                                                            <span style={{
                                                                padding: '0.15rem 0.4rem',
                                                                borderRadius: '4px',
                                                                fontSize: '0.65rem',
                                                                background: (stateColors[l.state] || '#555') + '22',
                                                                color: stateColors[l.state] || '#888',
                                                                border: `1px solid ${stateColors[l.state] || '#555'}`,
                                                                fontWeight: 'bold'
                                                            }}>
                                                                {l.state || 'WAITING'}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>Code: <span style={{ color: 'var(--secondary)' }}>{l.code}</span> | Teams: {l.teams?.length || 0}/{l.config?.teamCount || 0}</div>
                                                    </div>
                                                    <button className="btn btn-primary enter-league-btn" onClick={() => handleAdminEnter(l)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Enter</button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Invited leagues (Captain) */}
                            <div className="card" style={{ textAlign: 'left', background: 'rgba(0,0,0,0.15)', borderColor: '#333' }}>
                                <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '0.5rem', color: 'var(--secondary)', marginBottom: '1rem' }}>Leagues You Participate In</h3>
                                {invitedLeagues.length === 0 ? (
                                    <p className="text-muted" style={{ fontSize: '0.9rem' }}>You haven't been invited to any leagues yet.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
                                        {invitedLeagues.map(l => {
                                            const myTeam = l.teams?.find(t => t.email?.toLowerCase() === user.email.toLowerCase());
                                            const stateColors = { WAITING: '#f59e0b', LIVE: '#10b981', PAUSED: '#3b82f6', ENDED: '#ef4444' };
                                            return (
                                                <div key={l.code} className="league-card" style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <strong style={{ color: '#fff' }}>{l.name}</strong>
                                                            <span style={{
                                                                padding: '0.15rem 0.4rem',
                                                                borderRadius: '4px',
                                                                fontSize: '0.65rem',
                                                                background: (stateColors[l.state] || '#555') + '22',
                                                                color: stateColors[l.state] || '#888',
                                                                border: `1px solid ${stateColors[l.state] || '#555'}`,
                                                                fontWeight: 'bold'
                                                            }}>
                                                                {l.state || 'WAITING'}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.2rem' }}>
                                                            Code: <span style={{ color: 'var(--secondary)' }}>{l.code}</span>
                                                            {myTeam && <span style={{ color: '#34d399' }}> | Team: {myTeam.name}</span>}
                                                        </div>
                                                    </div>
                                                    <button className="btn enter-league-btn" onClick={() => handleCaptainEnter(l)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'transparent', border: '2px solid var(--secondary)', color: 'var(--secondary)' }}>
                                                        {myTeam ? 'Rejoin' : 'Join Draft'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- CREATE VIEW --- */}
            {view === 'CREATE' && (
                <div className="card" style={{ width: '100%', maxWidth: '500px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
                        <button 
                            onClick={() => setView('MENU')} 
                            style={{ position: 'absolute', left: 0, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', padding: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', transition: 'color 0.2s' }}
                            onMouseEnter={(e) => e.target.style.color = 'var(--primary)'}
                            onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                        >
                            ←
                        </button>
                        <h2 style={{ width: '100%', margin: 0, textAlign: 'center' }}>Create League</h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>League Name</label>
                            <input id="league-name-input" type="text" value={config.leagueName} onChange={e => setConfig({ ...config, leagueName: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Teams Count</label>
                            <input id="league-teams-input" type="number" value={config.teamCount} onChange={e => setConfig({ ...config, teamCount: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Squad Size (EXCLUDING CAPTAIN)</label>
                            <input type="number" value={config.playersPerTeam} onChange={e => setConfig({ ...config, playersPerTeam: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Budget (Th)</label>
                            <input type="number" value={config.budget} onChange={e => setConfig({ ...config, budget: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Base Price (Th)</label>
                            <input type="number" value={config.basePrice} onChange={e => setConfig({ ...config, basePrice: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Max Bid(Th)</label>
                            <input type="number" value={config.maxBid} onChange={e => setConfig({ ...config, maxBid: e.target.value })} style={inputStyle} />
                        </div>
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Upload Players CSV</label>
                            <input type="file" accept=".csv" onChange={handleFileChange} style={{ ...inputStyle, padding: '0.5rem' }} />
                        </div>
                        <button className="btn" style={{ padding: '0.8rem', marginTop: '1.2rem', background: '#333', border: '1px solid #555' }} onClick={() => setShowCsvHelp(true)}>Help</button>
                    </div>

                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid #333', paddingTop: '1.5rem' }}>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Manual Player Entry</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr auto', gap: '0.5rem', alignItems: 'end' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', display: 'block' }}>Name</label>
                                <input
                                    id="manual-player-name"
                                    type="text"
                                    value={manualPlayer.name}
                                    onChange={e => setManualPlayer({ ...manualPlayer, name: e.target.value })}
                                    style={{ ...inputStyle, marginBottom: 0 }}
                                    placeholder="Player Name"
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', display: 'block' }}>Category</label>
                                <select
                                    value={manualPlayer.category}
                                    onChange={e => setManualPlayer({ ...manualPlayer, category: e.target.value })}
                                    style={{ ...inputStyle, marginBottom: 0, appearance: 'none', cursor: 'pointer' }}
                                >
                                    <option value="Batter">Batter</option>
                                    <option value="Bowler">Bowler</option>
                                    <option value="WK">WK</option>
                                    <option value="All-Rounder">All-Rounder</option>
                                </select>
                            </div>
                            <button id="add-player-btn" className="btn btn-primary" onClick={addManualPlayer} style={{ padding: '0.8rem' }}>ADD</button>
                        </div>
                    </div>

                    {config.players.length > 0 && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <h4 style={{ marginBottom: '0.5rem' }}>Added Players ({config.players.length})</h4>
                            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #333', borderRadius: '4px', background: '#111' }}>
                                {config.players.map((p, index) => (
                                    <div key={index} style={{ padding: '0.5rem', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>{p.name} <small style={{ color: '#888' }}>({p.category})</small></span>
                                        <button className="btn btn-secondary" onClick={() => removePlayer(index)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Delete</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button id="start-league-final-btn" className="btn btn-primary" style={{ width: '100%', marginTop: '2rem', padding: '1rem', fontSize: '1.1rem' }} onClick={handleCreate}>Create League</button>
                </div>
            )}

            {/* --- CAPTAIN JOIN DETAIL DIALOG (First time entering team name) --- */}
            {captainJoinModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
                    <div className="card" style={{ maxWidth: '400px', width: '100%', textAlign: 'left', position: 'relative' }}>
                        <button onClick={() => setCaptainJoinModal(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', color: '#888', fontSize: '1.5rem', border: 'none', cursor: 'pointer' }}>×</button>
                        <h3 style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }}>Join League: {captainJoinModal.name}</h3>
                        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>Enter a unique Team Name for your squad in this league.</p>
                        
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Your Team Name</label>
                            <input 
                                id="captain-team-name-input"
                                type="text" 
                                placeholder="e.g. Royal Challengers" 
                                value={newTeamName} 
                                onChange={e => setNewTeamName(e.target.value)} 
                                style={inputStyle} 
                                required
                            />
                        </div>

                        <button id="confirm-join-btn" className="btn" style={{ width: '100%', marginTop: '1rem', background: 'var(--secondary)', color: '#000', fontWeight: 'bold' }} onClick={handleConfirmCaptainJoin}>
                            Join League Draft
                        </button>
                    </div>
                </div>
            )}

            {/* --- CSV HELP MODAL --- */}
            {showCsvHelp && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: '1rem' }}>
                    <div className="card" style={{ maxWidth: '500px', width: '100%', textAlign: 'left', position: 'relative' }}>
                        <button onClick={() => setShowCsvHelp(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', color: '#888', fontSize: '1.5rem', border: 'none', cursor: 'pointer' }}>×</button>
                        <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>CSV Format Guide</h3>
                        <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#ccc' }}>
                            Upload a <code>.csv</code> file with player details. Each line should follow this format:
                            <br />
                            <code>Name, Category</code>
                        </p>
                        <div style={{ background: '#111', padding: '1rem', borderRadius: '4px', border: '1px solid #444', marginBottom: '1.5rem' }}>
                            <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: '0.5rem', borderBottom: '1px solid #333', paddingBottom: '0.3rem' }}>
                                SAMPLE_PLAYERS.CSV
                            </div>
                            <pre style={{ margin: 0, color: 'var(--secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                                {`Virat Kohli,Batter\nJasprit Bumrah,Bowler\nBen Stokes,All-Rounder\nMS Dhoni,WK\nRashid Khan,Bowler`}
                            </pre>
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} onClick={() => setShowCsvHelp(false)}>Got it!</button>
                    </div>
                </div>
            )}

            {/* --- HOW TO PLAY MODAL --- */}
            {showHowTo && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
                    <div className="card neon-border" style={{ maxWidth: '600px', width: '100%', textAlign: 'left', position: 'relative', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
                        <button onClick={() => setShowHowTo(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', color: '#888', fontSize: '1.5rem', border: 'none', cursor: 'pointer' }}>×</button>
                        <h2 style={{ color: 'var(--primary)', marginBottom: '1.5rem', textAlign: 'center' }}>How to use SoldIt</h2>
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ color: 'var(--secondary)', marginBottom: '0.8rem', fontSize: '1.2rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>🏆 For League Admins (Creators)</h3>
                            <ol style={{ paddingLeft: '1.2rem', color: '#ccc', lineHeight: '1.6', fontSize: '0.9rem' }}>
                                <li>Click <strong>Create New League</strong>.</li>
                                <li>Configure settings and upload player pool.</li>
                                <li>From your waiting room, invite Captains by entering their Gmail accounts.</li>
                                <li>Click <strong>Start League</strong> once all Captains join.</li>
                            </ol>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <h3 style={{ color: 'var(--primary)', marginBottom: '0.8rem', fontSize: '1.2rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>⚡ For Captains</h3>
                            <ol style={{ paddingLeft: '1.2rem', color: '#ccc', lineHeight: '1.6', fontSize: '0.9rem' }}>
                                <li>Log in via Google.</li>
                                <li>Your dashboard automatically lists all leagues you participate in. Simply click <strong>Enter</strong> to join your draft room!</li>
                                <li>Enter your team name and enter the draft room!</li>
                            </ol>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import { useState } from 'react';

export default function Welcome({ onJoin }) {
    const [view, setView] = useState('MENU'); // MENU, CREATE, JOIN

    // User Identity
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [pin, setPin] = useState('');
    const [role, setRole] = useState('CAPTAIN'); // Used in JOIN view

    // League Config (for CREATE mode)
    const [config, setConfig] = useState({
        leagueName: "Premier League",
        teamCount: 8,
        playersPerTeam: 15,
        budget: 10000,
        basePrice: 20,
        maxBid: 5000,
        players: []
    });

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
                            basePrice: parts[2] ? parseInt(parts[2].trim()) : null
                        };
                    })
                    .filter(p => p !== null);
                setConfig(prev => ({ ...prev, players }));
            };
            reader.readAsText(file);
        }
    };

    // Actions
    const handleCreate = () => {
        if (!name) return alert("Please enter your Admin Name");
        const newCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        // Create as Admin
        onJoin(name, newCode, 'ADMIN', config);
    };

    const handleJoin = () => {
        if (!name || !code) return alert("Please enter Name and League Code");
        if (role === 'ADMIN' && !pin) return alert("Admin PIN is required to rejoin as Admin");

        onJoin(name, code, role, role === 'ADMIN' ? { adminPin: pin } : {});
    };

    // Render Helpers
    const inputStyle = {
        width: '100%', padding: '0.8rem', marginBottom: '1rem',
        borderRadius: '4px', background: 'rgba(0,0,0,0.3)', border: '1px solid #444', color: '#fff'
    };

    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '2rem' }}>
            <h1 style={{ fontSize: '4rem', color: 'var(--primary)', marginBottom: '1rem', textShadow: '0 0 20px rgba(255, 215, 0, 0.5)' }}>SoldIt</h1>
            <p className="text-muted" style={{ marginBottom: '3rem', fontSize: '1.2rem' }}>Real-time IPL Style Auction</p>

            {/* --- MENU VIEW --- */}
            {view === 'MENU' && (
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <button className="btn btn-primary" onClick={() => setView('CREATE')}>
                        Create New League
                    </button>
                    <button className="btn" style={{ background: 'transparent', border: '2px solid var(--secondary)', color: 'var(--secondary)' }} onClick={() => setView('JOIN')}>
                        Join Existing League
                    </button>
                </div>
            )}

            {/* --- CREATE VIEW --- */}
            {view === 'CREATE' && (
                <div className="card" style={{ width: '100%', maxWidth: '500px', textAlign: 'left' }}>
                    <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Create League</h2>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Your Admin Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="e.g. Commissioner" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>League Name</label>
                            <input type="text" value={config.leagueName} onChange={e => setConfig({ ...config, leagueName: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Teams Count</label>
                            <input type="number" value={config.teamCount} onChange={e => setConfig({ ...config, teamCount: e.target.value })} style={inputStyle} />
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

                    <div style={{ marginTop: '0.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Upload Players (CSV)</label>
                        <input type="file" accept=".csv" onChange={handleFileChange} style={{ ...inputStyle, padding: '0.5rem' }} />
                        {config.players.length > 0 && <span style={{ color: 'green' }}>✓ {config.players.length} players</span>}
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate}>Start League</button>
                        <button onClick={() => setView('MENU')} style={{ background: 'transparent', color: '#777', border: '1px solid #444', padding: '0 1rem', borderRadius: '8px' }}>Back</button>
                    </div>
                </div>
            )}

            {/* --- JOIN VIEW --- */}
            {view === 'JOIN' && (
                <div className="card" style={{ width: '400px', textAlign: 'left' }}>
                    <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Join League</h2>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>League Code</label>
                        <input type="text" value={code} onChange={e => setCode(e.target.value)} style={inputStyle} placeholder="e.g. ABCD-1234" />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>{role === 'ADMIN' ? 'League Name' : 'Team Name'}</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={role === 'ADMIN' ? "e.g. Premier League" : "e.g. Royal Challengers"} />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>I am a...</label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                className={`btn ${role === 'CAPTAIN' ? 'btn-primary' : ''}`}
                                style={{ flex: 1, border: '1px solid #555' }}
                                onClick={() => setRole('CAPTAIN')}
                            >
                                Captain
                            </button>
                            <button
                                className={`btn ${role === 'ADMIN' ? 'btn-primary' : ''}`}
                                style={{ flex: 1, border: '1px solid #555' }}
                                onClick={() => setRole('ADMIN')}
                            >
                                Admin
                            </button>
                        </div>
                    </div>

                    {role === 'ADMIN' && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#fca5a5' }}>Admin PIN</label>
                            <input type="password" value={pin} onChange={e => setPin(e.target.value)} style={{ ...inputStyle, borderColor: '#fca5a5' }} placeholder="******" />
                        </div>
                    )}

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleJoin}>Enter Room</button>
                        <button onClick={() => setView('MENU')} style={{ background: 'transparent', color: '#777', border: '1px solid #444', padding: '0 1rem', borderRadius: '8px' }}>Back</button>
                    </div>
                </div>
            )}
        </div>
    );
}

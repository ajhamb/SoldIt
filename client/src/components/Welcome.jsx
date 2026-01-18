import { useState } from 'react';

export default function Welcome({ onJoin }) {
    const [view, setView] = useState('MENU'); // MENU, CREATE, JOIN
    const [showCsvHelp, setShowCsvHelp] = useState(false);

    // User Identity
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [pin, setPin] = useState('');
    const [role, setRole] = useState('CAPTAIN'); // Used in JOIN view

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
                        alert("Some duplicate players were skipped during CSV upload.");
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
        if (!manualPlayer.name.trim()) return alert("Player Name is required");

        const isDuplicate = config.players.some(p => p.name.toLowerCase() === manualPlayer.name.trim().toLowerCase());
        if (isDuplicate) return alert("Player name must be unique! This player already exists.");

        setConfig(prev => ({
            ...prev,
            players: [...prev.players, { ...manualPlayer, name: manualPlayer.name.trim(), basePrice: config.basePrice, id: Date.now() }]
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
        if (!name) return alert("Please enter your Admin Name");
        if (config.players.length === 0) return alert("Please add at least one player to the league!");

        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
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

                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid #333', paddingTop: '1.5rem' }}>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Manual Player Entry</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr auto', gap: '0.5rem', alignItems: 'end' }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', display: 'block' }}>Name</label>
                                <input
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
                            <button className="btn btn-primary" onClick={addManualPlayer} style={{ padding: '0.8rem' }}>ADD</button>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
                            * All players will use the League Base Price: <strong>{config.basePrice} Th</strong>
                        </p>
                    </div>

                    <div style={{ marginTop: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', margin: 0 }}>Upload Players (CSV)</label>
                            <button
                                onClick={() => setShowCsvHelp(true)}
                                style={{
                                    background: '#444',
                                    color: 'var(--primary)',
                                    borderRadius: '50%',
                                    width: '20px',
                                    height: '20px',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                ?
                            </button>
                        </div>
                        <input type="file" accept=".csv" onChange={handleFileChange} style={{ ...inputStyle, padding: '0.5rem' }} />
                    </div>

                    {/* Added Players List */}
                    {config.players.length > 0 && (
                        <div style={{ marginTop: '1rem', maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem', borderBottom: '1px solid #333' }}>
                                Players Added ({config.players.length})
                            </div>
                            {config.players.map((p, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.3rem 0', borderBottom: '1px solid #222' }}>
                                    <span>{p.name} <small style={{ color: '#666' }}>({p.category})</small> - <strong>{p.basePrice}</strong></span>
                                    <button
                                        onClick={() => removePlayer(idx)}
                                        style={{ background: 'transparent', color: '#ff5555', border: 'none', cursor: 'pointer', padding: '0 0.5rem' }}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

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

            {/* --- CSV HELP MODAL --- */}
            {showCsvHelp && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: '1rem'
                }}>
                    <div className="card" style={{ maxWidth: '500px', width: '100%', textAlign: 'left', position: 'relative' }}>
                        <button
                            onClick={() => setShowCsvHelp(false)}
                            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', color: '#888', fontSize: '1.5rem' }}
                        >
                            ×
                        </button>
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
                        <p style={{ fontSize: '0.8rem', color: '#777' }}>
                            * All players will automatically inherit the League Base Price ({config.basePrice} Th).
                        </p>
                        <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} onClick={() => setShowCsvHelp(false)}>
                            Got it!
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

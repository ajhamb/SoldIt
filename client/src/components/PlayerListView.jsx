import { useState } from 'react';

export default function PlayerListView({ players, teams, onClose, socket, role, leagueCode }) {
    const [filter, setFilter] = useState('ALL'); // ALL, SOLD, UNSOLD
    const [teamFilter, setTeamFilter] = useState('ALL'); // 'ALL' or specific team name

    // Edit State
    const [editPlayer, setEditPlayer] = useState(null);
    const [editTeam, setEditTeam] = useState('');
    const [editPrice, setEditPrice] = useState('');

    const filteredPlayers = players.filter(p => {
        // Status Filter
        let matchesStatus = true;
        if (filter === 'SOLD') matchesStatus = p.status === 'SOLD';
        if (filter === 'UNSOLD') matchesStatus = p.status === 'UNSOLD' || p.status === 'WAITING';

        // Team Filter
        let matchesTeam = true;
        if (teamFilter !== 'ALL') {
            matchesTeam = p.soldTo === teamFilter;
        }

        return matchesStatus && matchesTeam;
    });

    const exportCSV = () => {
        const headers = ["Name", "Role", "Status", "SoldTo", "Price"];
        const rows = players.map(p => [
            p.name,
            p.category,
            p.status,
            p.soldTo || "",
            p.soldAt || ""
        ]);

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += headers.join(",") + "\n";
        rows.forEach(r => {
            csvContent += r.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "auction_data.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleEditClick = (p) => {
        setEditPlayer(p);
        setEditTeam(p.soldTo || (teams[0] ? teams[0].name : ''));
        setEditPrice(p.soldAt || p.basePrice || 20);
    };

    const handleSave = () => {
        if (!editPlayer || !editTeam || !editPrice) return;

        socket.emit('ADMIN_ASSIGN_PLAYER', {
            leagueCode,
            playerId: editPlayer.id,
            teamName: editTeam,
            price: editPrice
        });
        setEditPlayer(null); // Close modal
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '900px', height: '90vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #444', paddingBottom: '1rem', alignItems: 'center' }}>
                    <h2>Player List ({players.length})</h2>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn" style={{ background: '#22c55e', color: '#fff', fontSize: '0.9rem', padding: '0.5rem 1rem' }} onClick={exportCSV}>
                            Export CSV
                        </button>
                        <button onClick={onClose} style={{ background: 'transparent', color: '#fff', fontSize: '1.5rem', border: 'none', cursor: 'pointer' }}>&times;</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className={`btn ${filter === 'ALL' ? 'btn-primary' : ''}`} style={{ padding: '0.5rem 1rem' }} onClick={() => setFilter('ALL')}>All</button>
                        <button className={`btn ${filter === 'SOLD' ? 'btn-primary' : ''}`} style={{ padding: '0.5rem 1rem' }} onClick={() => setFilter('SOLD')}>Sold</button>
                        <button className={`btn ${filter === 'UNSOLD' ? 'btn-primary' : ''}`} style={{ padding: '0.5rem 1rem' }} onClick={() => setFilter('UNSOLD')}>Unsold</button>
                    </div>

                    <select
                        value={teamFilter}
                        onChange={e => setTeamFilter(e.target.value)}
                        style={{ padding: '0.5rem', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}
                    >
                        <option value="ALL">All Teams</option>
                        {teams.map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                    </select>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#333', color: '#aaa' }}>
                                <th style={{ padding: '0.5rem' }}>Name</th>
                                <th style={{ padding: '0.5rem' }}>Role</th>
                                <th style={{ padding: '0.5rem' }}>Status</th>
                                <th style={{ padding: '0.5rem' }}>Sold To</th>
                                <th style={{ padding: '0.5rem' }}>Price</th>
                                {role === 'ADMIN' && <th style={{ padding: '0.5rem' }}>Edit</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPlayers.map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #333' }}>
                                    <td style={{ padding: '0.8rem 0.5rem', fontWeight: 'bold' }}>{p.name}</td>
                                    <td style={{ padding: '0.8rem 0.5rem', color: '#999' }}>{p.category}</td>
                                    <td style={{ padding: '0.8rem 0.5rem' }}>
                                        <span style={{
                                            padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem',
                                            background: p.status === 'SOLD' ? 'green' : (p.status === 'UNSOLD' ? 'red' : '#444')
                                        }}>
                                            {p.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.8rem 0.5rem', color: 'var(--primary)' }}>{p.soldTo || '-'}</td>
                                    <td style={{ padding: '0.8rem 0.5rem' }}>{p.soldAt || '-'}</td>
                                    {role === 'ADMIN' && (
                                        <td style={{ padding: '0.8rem 0.5rem' }}>
                                            <button
                                                style={{ cursor: 'pointer', background: 'transparent', border: 'none', fontSize: '1.2rem' }}
                                                onClick={() => handleEditClick(p)}
                                            >
                                                ✏️
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {filteredPlayers.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No players found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* EDIT MODAL */}
                {editPlayer && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#222', padding: '2rem', borderRadius: '8px', border: '1px solid #555', boxShadow: '0 0 20px rgba(0,0,0,0.8)', zIndex: 200, width: '400px', maxWidth: '90%' }}>
                        <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>Edit: {editPlayer.name}</h3>
                        <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1rem' }}>
                            Adjust Price or Reassign Team. (Budget will update automatically)
                        </p>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Assign To Team:</label>
                            <select
                                value={editTeam}
                                onChange={e => setEditTeam(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem', background: '#333', color: '#fff', border: '1px solid #555' }}
                            >
                                <option value="" disabled>Select Team</option>
                                {teams.map(t => (
                                    <option key={t.id} value={t.name}>{t.name} (Budget: {t.budget})</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Price:</label>
                            <input
                                type="number"
                                value={editPrice}
                                onChange={e => setEditPrice(e.target.value)}
                                style={{ width: '100%', padding: '0.5rem', background: '#333', color: '#fff', border: '1px solid #555' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>Confirm</button>
                            <button
                                className="btn"
                                style={{ flex: 1, background: '#772222', border: '1px solid #aa4444', color: '#ffaaaa' }}
                                onClick={() => {
                                    if (confirm(`Are you sure you want to release ${editPlayer.name}? Money will be refunded.`)) {
                                        socket.emit('ADMIN_UNASSIGN_PLAYER', { leagueCode, playerId: editPlayer.id });
                                        setEditPlayer(null);
                                    }
                                }}
                            >
                                Release
                            </button>
                            <button className="btn" style={{ flex: 1, background: '#444' }} onClick={() => setEditPlayer(null)}>Cancel</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

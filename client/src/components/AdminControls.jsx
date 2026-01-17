export default function AdminControls({ socket, leagueCode, maxBid }) {
    const handleSold = () => {
        socket.emit('SOLD', { leagueCode });
    };

    const handleSkip = () => {
        if (confirm("Skip this player? They will be marked as UNSOLD.")) {
            socket.emit('SKIP_PLAYER', { leagueCode });
        }
    };

    const handleRestart = () => {
        if (confirm("RESTART BIDDING? This will CLEAR all bids and passes for this player.")) {
            if (confirm("ARE YOU ABSOLUTELY SURE?")) {
                socket.emit('RESTART_BIDDING', { leagueCode });
            }
        }
    };

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', background: '#330000', borderColor: 'red' }}>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', width: '100%', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={handleSold} style={{ background: '#22c55e', color: '#fff', fontSize: '1.2rem', padding: '1rem 3rem' }}>
                    SOLD
                </button>
                <button className="btn"
                    style={{ background: '#333', border: '1px solid #555', color: '#ccc' }}
                    onClick={() => socket.emit('SKIP_PLAYER', { leagueCode })}
                >
                    Skip Player
                </button>
                <button className="btn"
                    style={{ background: '#772222', border: '1px solid #aa4444', color: '#ffaaaa' }}
                    onClick={() => {
                        if (confirm("Undo the last bid? This will revert to the previous price.")) {
                            socket.emit('UNDO_BID', { leagueCode });
                        }
                    }}
                >
                    Undo Bid ↩️
                </button>

                <button className="btn"
                    style={{ background: '#775522', border: '1px solid #aa8844', color: '#ffeebb' }}
                    onClick={handleRestart}
                >
                    Restart Bidding 🔄
                </button>

                <button className="btn"
                    style={{ background: '#552222', border: '1px solid #774444', color: '#eaa' }}
                    onClick={() => {
                        if (confirm("End the auction session? This will save a final report.")) {
                            socket.emit('END_SESSION', { leagueCode });
                        }
                    }}
                >
                    End Auction
                </button>
            </div>
            {maxBid && maxBid !== Infinity && (
                <div style={{ fontSize: '0.9rem', color: '#ffaaaa', fontWeight: 'bold' }}>
                    MAX BID LIMIT: {maxBid} Th
                </div>
            )}
        </div>
    );
}

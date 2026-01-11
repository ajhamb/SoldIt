export default function AdminControls({ socket, leagueCode }) {
    const handleSold = () => {
        socket.emit('SOLD', { leagueCode });
    };

    const handleSkip = () => {
        if (confirm("Skip this player? They will be marked as UNSOLD.")) {
            socket.emit('SKIP_PLAYER', { leagueCode });
        }
    };

    return (
        <div className="card" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', background: '#330000', borderColor: 'red' }}>
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
    );
}

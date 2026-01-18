import { useState, useEffect } from 'react';

export default function CaptainControls({ socket, leagueCode, currentBid, myTeam, basePrice, maxBid, hasPassed, activeTurn }) {
    // Determine if it's my turn
    const isMyTurn = myTeam.name === activeTurn;

    // Determine min bid: If 0 (nobid), min is basePrice. Else current + 5.
    const effectiveCurrent = currentBid.amount || 0;
    const nextMinBid = effectiveCurrent === 0 ? basePrice : effectiveCurrent + 5;

    const [customBid, setCustomBid] = useState(nextMinBid);

    // Sync input with nextMinBid whenever currentBid changes
    useEffect(() => {
        setCustomBid(nextMinBid);
    }, [currentBid.amount, basePrice]);

    const placeBid = () => {
        if (!isMyTurn || hasPassed) return;
        const amount = parseInt(customBid);
        if (isNaN(amount)) return alert("Please enter a valid number");

        if (amount > myTeam.budget) return alert("Insufficient Budget!");

        // Validation logic
        if (currentBid.amount > 0 && amount <= currentBid.amount) return alert("Bid too low! Must be higher than current bid.");
        if (currentBid.amount === 0 && amount < basePrice) return alert(`Bid must be at least Base Price (${basePrice})`);

        // Phase 4: Max Bid Check
        if (maxBid && amount > maxBid) return alert(`Bid exceeds Max Bid Limit (${maxBid} Th)!`);

        socket.emit('PLACE_BID', { leagueCode, amount });
    };

    return (
        <div className="card" style={{ textAlign: 'center', opacity: (hasPassed || !isMyTurn) ? 0.7 : 1, transition: 'all 0.3s ease' }}>
            <h3 style={{ marginBottom: '1rem', color: isMyTurn ? 'var(--primary)' : '#888' }}>
                {hasPassed ? 'You have Passed 🛑' : isMyTurn ? 'YOUR TURN TO BID! 🪙' : `Waiting for ${activeTurn || 'next round'}...`}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'center' }}>
                    <input
                        type="number"
                        value={customBid}
                        onChange={e => setCustomBid(e.target.value)}
                        disabled={hasPassed || !isMyTurn}
                        style={{
                            padding: '1rem',
                            width: '120px',
                            borderRadius: '4px',
                            border: `1px solid ${isMyTurn ? 'var(--primary)' : '#555'}`,
                            background: (hasPassed || !isMyTurn) ? '#111' : '#222',
                            color: (hasPassed || !isMyTurn) ? '#555' : '#fff',
                            fontSize: '1.5rem',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            boxShadow: isMyTurn ? '0 0 10px rgba(255, 215, 0, 0.2)' : 'none'
                        }}
                    />
                    <button
                        className="btn btn-primary"
                        style={{ padding: '0 2rem', fontSize: '1.2rem' }}
                        onClick={placeBid}
                        disabled={hasPassed || !isMyTurn}
                    >
                        BID
                    </button>
                </div>

                <div style={{ fontSize: '0.9rem', color: '#888', display: 'flex', gap: '1rem' }}>
                    <span>{currentBid.amount === 0 ? `Minimum: ${basePrice} Th` : `Next Min: ${currentBid.amount + 1} Th`}</span>
                    {maxBid && maxBid !== Infinity && (
                        <span style={{ color: '#ffaa00' }}>Max Bid: {maxBid} Th</span>
                    )}
                </div>

                <button className="btn"
                    style={{
                        width: '100%',
                        background: (hasPassed || !isMyTurn) ? '#333' : '#ff3333',
                        color: (hasPassed || !isMyTurn) ? '#666' : '#fff',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        marginTop: '0.5rem'
                    }}
                    onClick={() => socket.emit('CAPTAIN_PASS', { leagueCode })}
                    disabled={hasPassed || !isMyTurn}
                >
                    {hasPassed ? 'PASSED 🛑' : isMyTurn ? 'PASS TURN 🛑' : 'WAITING...'}
                </button>

                <div style={{ marginTop: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: myTeam.budget < customBid ? 'red' : 'green' }}>
                    Your Budget: {myTeam.budget} Th
                </div>
            </div>
        </div>
    );
}

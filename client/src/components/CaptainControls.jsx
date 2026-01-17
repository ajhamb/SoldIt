import { useState, useEffect } from 'react';

export default function CaptainControls({ socket, leagueCode, currentBid, myTeam, basePrice, maxBid, hasPassed }) {
    // Determine min bid: If 0 (nobid), min is basePrice. Else current + 20.
    const effectiveCurrent = currentBid.amount || 0;
    const nextMinBid = effectiveCurrent === 0 ? basePrice : effectiveCurrent + 20;

    const [customBid, setCustomBid] = useState(nextMinBid);

    // Sync input with nextMinBid whenever currentBid changes
    useEffect(() => {
        setCustomBid(nextMinBid);
    }, [currentBid.amount, basePrice]);

    const placeBid = () => {
        if (hasPassed) return;
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
        <div className="card" style={{ textAlign: 'center', opacity: hasPassed ? 0.7 : 1 }}>
            <h3 style={{ marginBottom: '1rem' }}>{hasPassed ? 'You have Passed 🛑' : 'Place Bid'}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'center' }}>
                    <input
                        type="number"
                        value={customBid}
                        onChange={e => setCustomBid(e.target.value)}
                        disabled={hasPassed}
                        style={{
                            padding: '1rem',
                            width: '120px',
                            borderRadius: '4px',
                            border: '1px solid #555',
                            background: hasPassed ? '#111' : '#222',
                            color: hasPassed ? '#555' : '#fff',
                            fontSize: '1.5rem',
                            textAlign: 'center',
                            fontWeight: 'bold'
                        }}
                    />
                    <button
                        className="btn btn-primary"
                        style={{ padding: '0 2rem', fontSize: '1.2rem' }}
                        onClick={placeBid}
                        disabled={hasPassed}
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
                    style={{ width: '100%', background: hasPassed ? '#333' : '#ff3333', color: hasPassed ? '#666' : '#fff', fontSize: '1rem', fontWeight: 'bold', marginTop: '0.5rem' }}
                    onClick={() => socket.emit('CAPTAIN_PASS', { leagueCode })}
                    disabled={hasPassed}
                >
                    {hasPassed ? 'PASSED 🛑' : 'PASS 🛑'}
                </button>

                <div style={{ marginTop: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: myTeam.budget < customBid ? 'red' : 'green' }}>
                    Your Budget: {myTeam.budget} Th
                </div>
            </div>
        </div>
    );
}

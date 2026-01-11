import { useState } from 'react';

export default function CaptainControls({ socket, leagueCode, currentBid, myTeam, basePrice }) {
    // Determine min bid: If 0 (nobid), min is basePrice. Else current + 20.
    const effectiveCurrent = currentBid.amount || basePrice || 0;

    // Default custom input
    const [customBid, setCustomBid] = useState(effectiveCurrent > 0 ? effectiveCurrent + 20 : 20);

    // Sync input with minBid if currentBid changes (optional UX choice, keeps it fresh)
    // useEffect(() => setCustomBid(minBid), [minBid]);

    const placeBid = (amount) => {
        if (amount > myTeam.budget) return alert("Insufficient Budget!");
        // Allow if amount > current, or if current is 0 and amount >= basePrice
        if (currentBid.amount > 0 && amount <= currentBid.amount) return alert("Bid too low!");
        if (currentBid.amount === 0 && amount < basePrice) return alert(`Bid must be at least Base Price (${basePrice})`);

        socket.emit('PLACE_BID', { leagueCode, amount });
    };

    return (
        <div className="card" style={{ textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem' }}>Bids</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                {currentBid.amount === 0 ? (
                    // INITIAL BID STATE
                    <>
                        <button className="btn" style={{ background: '#22c55e', border: '1px solid #16a34a', color: '#fff', fontSize: '0.9rem' }} onClick={() => placeBid(basePrice)}>
                            Bid Base ({basePrice})
                        </button>
                        <button className="btn" style={{ background: '#333', border: '1px solid #555', color: '#fff' }} onClick={() => placeBid(basePrice + 20)}>
                            {basePrice + 20} Th
                        </button>
                        <button className="btn" style={{ background: '#333', border: '1px solid #555', color: '#fff' }} onClick={() => placeBid(basePrice + 50)}>
                            {basePrice + 50} Th
                        </button>
                        <button className="btn" style={{ background: '#333', border: '1px solid #555', color: '#fff' }} onClick={() => placeBid(basePrice * 2)}>
                            Double Base
                        </button>
                    </>
                ) : (
                    // NORMAL BID STATE
                    <>
                        <button className="btn" style={{ background: '#333', border: '1px solid #555', color: '#fff' }} onClick={() => placeBid(currentBid.amount + 20)}>
                            + 20 Th
                        </button>
                        <button className="btn" style={{ background: '#333', border: '1px solid #555', color: '#fff' }} onClick={() => placeBid(currentBid.amount + 50)}>
                            + 50 Th
                        </button>
                        <button className="btn" style={{ background: '#333', border: '1px solid #555', color: '#fff' }} onClick={() => placeBid(currentBid.amount + 100)}>
                            + 100 Th
                        </button>
                        <button className="btn" style={{ background: '#333', border: '1px solid #555', color: '#fff' }} onClick={() => placeBid(currentBid.amount * 2)}>
                            Double
                        </button>
                    </>
                )}
            </div>

            <button className="btn"
                style={{ width: '100%', background: '#ff3333', color: '#fff', fontSize: '1rem', fontWeight: 'bold' }}
                onClick={() => socket.emit('CAPTAIN_PASS', { leagueCode })}
            >
                PASS 🛑
            </button>


            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center', marginTop: '1rem' }}>
                <input
                    type="number"
                    value={customBid}
                    onChange={e => setCustomBid(parseInt(e.target.value))}
                    style={{ padding: '0.8rem', width: '120px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: '#fff', fontSize: '1.2rem', textAlign: 'center' }}
                />
                <button className="btn btn-primary" style={{ padding: '0.8rem 2rem' }} onClick={() => placeBid(customBid)}>
                    BID
                </button>
            </div>

            <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: myTeam.budget < currentBid.amount ? 'red' : 'green' }}>
                Your Budget: {myTeam.budget} Th
            </div>
        </div>
    );
}

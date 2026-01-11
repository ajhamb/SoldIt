export default function RulesModal({ config, onClose }) {
    if (!config) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="card" style={{ width: '400px', maxWidth: '90%', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Auction Rules</h2>

                <ul style={{ textAlign: 'left', marginBottom: '2rem', paddingLeft: '1.5rem', lineHeight: '1.8rem' }}>
                    <li><strong>Total Budget:</strong> {config.budget} Th</li>
                    <li><strong>Base Price:</strong> {config.basePrice} Th</li>
                    <li><strong>Max Squad Size:</strong> {config.playersPerTeam} Players</li>
                    <li><strong>Max Bid Limit:</strong> {config.maxBid ? `${config.maxBid} Th` : 'Unlimited'}</li>
                    <li><strong>Min Reserve:</strong> You must keep enough budget to fill your squad at Base Price.</li>
                </ul>

                <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>Got it</button>
            </div>
        </div>
    );
}

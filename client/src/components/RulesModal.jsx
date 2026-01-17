export default function RulesModal({ config, onClose }) {
    if (!config) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="card" style={{ width: '400px', maxWidth: '90%', textAlign: 'center' }}>
                <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '0.5rem', marginTop: '1.5rem' }}>Auction Process (Admin Guide)</h3>
                <ol style={{ marginLeft: '1.5rem', lineHeight: '1.6', color: '#ccc' }}>
                    <li><strong>Start:</strong> Admin clicks "START AUCTION" to begin. The system randomizes the player list.</li>
                    <li><strong>Bidding:</strong>
                        <ul>
                            <li>A player appears on screen. Captains place bids.</li>
                            <li>The bid timer resets after every new bid.</li>
                        </ul>
                    </li>
                    <li><strong>Selling:</strong>
                        <ul>
                            <li>When bidding stops, Admin clicks <strong>"SOLD"</strong>.</li>
                            <li>Money is deducted, and the player joins the winner's squad.</li>
                        </ul>
                    </li>
                    <li><strong>Unsold:</strong> If no one bids, Admin clicks <strong>"SKIP"</strong>. The player is marked Unsold.</li>
                    <li><strong>Mistakes?</strong> Admin can use <strong>"Undo Bid"</strong> to revert the last action, or <strong>"Edit"</strong> in the Player List to manually fix assignments.</li>
                    <li><strong>End:</strong> Use "End Auction" to finish the session and download the final report.</li>
                </ol>

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

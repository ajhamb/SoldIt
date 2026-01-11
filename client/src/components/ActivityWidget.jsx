export default function ActivityWidget({ activityLog }) {
    if (!activityLog || activityLog.length === 0) return null;

    return (
        <div className="card" style={{ height: '100%', overflowY: 'auto', background: 'rgba(0,0,0,0.5)', border: '1px solid #444', padding: 0 }}>
            <h4 style={{ position: 'sticky', top: 0, background: '#222', padding: '0.5rem 1rem', margin: 0, borderBottom: '1px solid #444', zIndex: 10 }}>Live Activity</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {activityLog.map((log, index) => (
                    <li key={index} style={{ padding: '0.5rem', borderBottom: '1px solid #333', fontSize: '0.9rem', color: getColor(log.type) }}>
                        {log.text}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function getColor(type) {
    switch (type) {
        case 'BID': return '#cyan'; // Cyan
        case 'SOLD': return '#22c55e'; // Green
        case 'SKIP': return '#ef4444'; // Red
        case 'PASS': return '#777'; // Gray
        default: return '#fff';
    }
}

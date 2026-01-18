import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Welcome from './components/Welcome';
import AuctionRoom from './components/AuctionRoom';

// Connect to backend (relative path for proxy support)
const socket = io();

function App() {
  const [role, setRole] = useState(null); // 'ADMIN' | 'CAPTAIN'
  const [name, setName] = useState('');
  const [leagueCode, setLeagueCode] = useState('');
  const [leagueState, setLeagueState] = useState(null); // Entire league object
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    // --- PERSISTENCE: Check for existing session ---
    const savedSession = localStorage.getItem('auction_session');
    if (savedSession) {
      try {
        const { name: sName, leagueCode: sCode, role: sRole } = JSON.parse(savedSession);
        if (sName && sCode && sRole) {
          handleJoin(sName, sCode, sRole);
        }
      } catch (e) {
        localStorage.removeItem('auction_session');
      }
    }

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('LEAGUE_UPDATE', (newState) => {
      setLeagueState(prev => prev ? { ...prev, ...newState } : newState);
    });

    socket.on('ADMIN_RESTORE', (state) => {
      setLeagueState(state);
    });
    socket.on('ERROR', (err) => {
      alert(err.message);
      if (err.message.includes('not found') || err.message.includes('Full')) {
        localStorage.removeItem('auction_session');
        setRole(null);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('LEAGUE_UPDATE');
      socket.off('NEW_PLAYER');
      socket.off('BID_UPDATE');
      socket.off('ERROR');
    };
  }, []);

  const handleJoin = (enteredName, enteredCode, chosenRole, settings = {}) => {
    setName(enteredName);
    setLeagueCode(enteredCode);
    setRole(chosenRole);

    // Persist session
    localStorage.setItem('auction_session', JSON.stringify({
      name: enteredName,
      leagueCode: enteredCode,
      role: chosenRole
    }));

    socket.emit('JOIN_LEAGUE', {
      leagueCode: enteredCode,
      name: enteredName,
      role: chosenRole,
      settings
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('auction_session');
    setRole(null);
    window.location.reload(); // Hard reset to clear socket state
  };

  if (!role) {
    return <Welcome onJoin={handleJoin} />;
  }

  return (
    <div className="app-container">
      <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 1000 }}>
        <button onClick={handleLogout} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>EXIT LEAGUE</button>
      </div>
      <AuctionRoom
        socket={socket}
        role={role}
        name={name}
        leagueCode={leagueCode}
        leagueState={leagueState}
      />
    </div>
  );
}

export default App;

import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Welcome from './components/Welcome';
import AuctionRoom from './components/AuctionRoom';
import SuperAdminDashboard from './components/SuperAdminDashboard';

// Connect to backend (relative path for proxy support)
const socket = io();

function App() {
  const [role, setRole] = useState(null); // 'ADMIN' | 'CAPTAIN' | 'SUPER_ADMIN'
  const [name, setName] = useState('');
  const [leagueCode, setLeagueCode] = useState('');
  const [leagueState, setLeagueState] = useState(null); // Entire league object
  const [allLeagues, setAllLeagues] = useState([]); // All active leagues (Super Admin only)
  const [isConnected, setIsConnected] = useState(socket.connected);

  const handleJoin = (enteredName, enteredCode, chosenRole, settings = {}) => {
    setName(enteredName);
    setLeagueCode(enteredCode);
    setRole(chosenRole);

    const savedPin = settings.adminPin || settings.captainPin || settings.password;

    // Persist session including security PIN/password
    localStorage.setItem('auction_session', JSON.stringify({
      name: enteredName,
      leagueCode: enteredCode,
      role: chosenRole,
      pin: savedPin
    }));

    socket.emit('JOIN_LEAGUE', {
      leagueCode: enteredCode,
      name: enteredName,
      role: chosenRole,
      settings
    });
  };

  useEffect(() => {
    // --- PERSISTENCE: Check for existing session ---
    const savedSession = localStorage.getItem('auction_session');
    if (savedSession) {
      try {
        const { name: sName, leagueCode: sCode, role: sRole, pin: sPin } = JSON.parse(savedSession);
        if (sName && sCode && sRole) {
          handleJoin(sName, sCode, sRole, sRole === 'ADMIN' ? { adminPin: sPin } : sRole === 'SUPER_ADMIN' ? { password: sPin } : { captainPin: sPin });
        }
      } catch (e) {
        localStorage.removeItem('auction_session');
      }
    }

    socket.on('connect', () => {
      setIsConnected(true);
      // Auto-rejoin on connection restore if session credentials exist
      const sessionData = localStorage.getItem('auction_session');
      if (sessionData) {
        try {
          const { name: sName, leagueCode: sCode, role: sRole, pin: sPin } = JSON.parse(sessionData);
          if (sName && sCode && sRole) {
            socket.emit('JOIN_LEAGUE', {
              leagueCode: sCode,
              name: sName,
              role: sRole,
              settings: sRole === 'ADMIN' ? { adminPin: sPin } : sRole === 'SUPER_ADMIN' ? { password: sPin } : { captainPin: sPin }
            });
          }
        } catch (e) {
          // Ignore
        }
      }
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('LEAGUE_UPDATE', (newState) => {
      setLeagueState(prev => prev ? { ...prev, ...newState } : newState);
    });

    socket.on('ADMIN_RESTORE', (state) => {
      setLeagueState(state);
      // Cache server-generated admin PIN in localStorage
      if (state && state.adminPin) {
        const sessionData = localStorage.getItem('auction_session');
        if (sessionData) {
          try {
            const session = JSON.parse(sessionData);
            session.pin = state.adminPin;
            localStorage.setItem('auction_session', JSON.stringify(session));
          } catch (e) {
            // Ignore
          }
        }
      }
    });

    socket.on('SUPER_ADMIN_RESTORE', (leagues) => {
      setAllLeagues(leagues);
    });

    socket.on('SUPER_ADMIN_UPDATE', (leagues) => {
      setAllLeagues(leagues);
    });

    socket.on('ERROR', (err) => {
      alert(err.message);
      if (err.message.includes('not found') || err.message.includes('Full') || err.message.includes('PIN') || err.message.includes('Credentials')) {
        localStorage.removeItem('auction_session');
        setRole(null);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('LEAGUE_UPDATE');
      socket.off('ADMIN_RESTORE');
      socket.off('SUPER_ADMIN_RESTORE');
      socket.off('SUPER_ADMIN_UPDATE');
      socket.off('ERROR');
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auction_session');
    setRole(null);
    window.location.reload(); // Hard reset to clear socket state
  };

  if (!role) {
    return (
      <>
        {!isConnected && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0,
            background: '#ef4444', color: '#fff', textAlign: 'center',
            padding: '0.5rem', zIndex: 9999, fontSize: '0.9rem', fontWeight: 'bold',
            boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
          }}>
            ⚠️ Connection lost. Reconnecting...
          </div>
        )}
        <Welcome onJoin={handleJoin} />
      </>
    );
  }

  if (role === 'SUPER_ADMIN') {
    return (
      <div className="app-container">
        {!isConnected && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0,
            background: '#ef4444', color: '#fff', textAlign: 'center',
            padding: '0.5rem', zIndex: 9999, fontSize: '0.9rem', fontWeight: 'bold',
            boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
          }}>
            ⚠️ Connection lost. Reconnecting...
          </div>
        )}
        <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 1000 }}>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>EXIT DASHBOARD</button>
        </div>
        <SuperAdminDashboard allLeagues={allLeagues} socket={socket} />
      </div>
    );
  }

  return (
    <div className="app-container">
      {!isConnected && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          background: '#ef4444', color: '#fff', textAlign: 'center',
          padding: '0.5rem', zIndex: 9999, fontSize: '0.9rem', fontWeight: 'bold',
          boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
        }}>
          ⚠️ Connection lost. Reconnecting...
        </div>
      )}
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

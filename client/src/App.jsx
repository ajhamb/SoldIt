import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Welcome from './components/Welcome';
import AuctionRoom from './components/AuctionRoom';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { supabase } from './supabaseClient';

// Connect to backend (relative path for proxy support)
const socket = io();

function App() {
  const [role, setRole] = useState(null); // 'ADMIN' | 'CAPTAIN' | 'SUPER_ADMIN'
  const [name, setName] = useState('');
  const [leagueCode, setLeagueCode] = useState('');
  const [leagueState, setLeagueState] = useState(null); // Entire league object
  const [allLeagues, setAllLeagues] = useState([]); // All active leagues (Super Admin only)
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [user, setUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(!supabase);

  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    // Check for E2E mock user in localStorage first
    const mockUserStr = localStorage.getItem('e2e_mock_user');
    if (mockUserStr) {
      try {
        const mockUser = JSON.parse(mockUserStr);
        setUser(mockUser);
        setAuthInitialized(true);
        return;
      } catch (e) {
        // Ignore
      }
    }

    if (!supabase) return;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthInitialized(true);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthInitialized(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 1. Connection status listeners (runs immediately on mount)
  useEffect(() => {
    setIsConnected(socket.connected);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const handleJoin = (enteredName, enteredCode, chosenRole, settings = {}) => {
    setName(enteredName);
    setLeagueCode(enteredCode);
    setRole(chosenRole);

    // Persist session (no PINs stored!)
    localStorage.setItem('auction_session', JSON.stringify({
      name: enteredName,
      leagueCode: enteredCode,
      role: chosenRole
    }));

    // Attach current user's email if logged in via Google
    const email = userRef.current?.email || null;

    socket.emit('JOIN_LEAGUE', {
      leagueCode: enteredCode,
      name: enteredName,
      role: chosenRole,
      settings: {
        ...settings,
        email
      }
    });
  };

  useEffect(() => {
    if (!authInitialized) return;

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

    const handleAutoRejoin = () => {
      const sessionData = localStorage.getItem('auction_session');
      if (sessionData) {
        try {
          const { name: sName, leagueCode: sCode, role: sRole } = JSON.parse(sessionData);
          if (sName && sCode && sRole) {
            const email = userRef.current?.email || null;
            socket.emit('JOIN_LEAGUE', {
              leagueCode: sCode,
              name: sName,
              role: sRole,
              settings: {
                email
              }
            });
          }
        } catch (e) {
          // Ignore
        }
      }
    };

    socket.on('connect', handleAutoRejoin);

    socket.on('LEAGUE_UPDATE', (newState) => {
      setLeagueState(prev => prev ? { ...prev, ...newState } : newState);
    });

    socket.on('ADMIN_RESTORE', (state) => {
      setLeagueState(state);
    });

    socket.on('SUPER_ADMIN_RESTORE', (leagues) => {
      setAllLeagues(leagues);
    });

    socket.on('SUPER_ADMIN_UPDATE', (leagues) => {
      setAllLeagues(leagues);
    });

    socket.on('ERROR', (err) => {
      alert(err.message);
      if (err.message.includes('not found') || err.message.includes('Full') || err.message.includes('PIN') || err.message.includes('Credentials') || err.message.includes('invited') || err.message.includes('removed')) {
        localStorage.removeItem('auction_session');
        setRole(null);
      }
    });

    return () => {
      socket.off('connect', handleAutoRejoin);
      socket.off('LEAGUE_UPDATE');
      socket.off('ADMIN_RESTORE');
      socket.off('SUPER_ADMIN_RESTORE');
      socket.off('SUPER_ADMIN_UPDATE');
      socket.off('ERROR');
    };
  }, [authInitialized]);

  const handleExitLeague = () => {
    localStorage.removeItem('auction_session');
    setRole(null);
    setLeagueState(null);
    window.location.reload(); // Reload to cleanly reset socket connection and show Dashboard
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
        <Welcome onJoin={handleJoin} user={user} socket={socket} />
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
          <button onClick={handleExitLeague} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>EXIT DASHBOARD</button>
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
        <button onClick={handleExitLeague} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>EXIT LEAGUE</button>
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

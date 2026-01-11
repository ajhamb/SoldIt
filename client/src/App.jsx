import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Welcome from './components/Welcome';
import AuctionRoom from './components/AuctionRoom';

// Connect to backend (adjust URL if needed, e.g. defined in .env)
const socket = io('http://localhost:3000');

function App() {
  const [role, setRole] = useState(null); // 'ADMIN' | 'CAPTAIN'
  const [name, setName] = useState('');
  const [leagueCode, setLeagueCode] = useState('');
  const [leagueState, setLeagueState] = useState(null); // Entire league object
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('LEAGUE_UPDATE', (updatedLeague) => {
      // Merge updates (careful not to overwrite if updatedLeague is partial, but server sends full state usually)
      // Actually server sends partial { teams, state, currentBid } sometimes?
      // Let's assume server sends what it sends.
      setLeagueState(prev => ({ ...prev, ...updatedLeague }));
    });

    socket.on('NEW_PLAYER', (data) => {
      setLeagueState(prev => ({
        ...prev,
        currentPlayer: data.player,
        currentBid: data.currentBid
      }));
    });

    socket.on('BID_UPDATE', (newBid) => {
      setLeagueState(prev => ({ ...prev, currentBid: newBid }));
    });

    socket.on('PLAYER_SOLD', (data) => {
      // Show notification? 
      console.log("SOLD:", data);
    });

    socket.on('ADMIN_RESTORE', (fullLeague) => {
      setLeagueState(fullLeague);
    });

    socket.on('ERROR', (err) => alert(err.message));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('LEAGUE_UPDATE');
      socket.off('NEW_PLAYER');
      socket.off('BID_UPDATE');
    };
  }, []);

  const handleJoin = (enteredName, enteredCode, chosenRole, settings = {}) => {
    setName(enteredName);
    setLeagueCode(enteredCode);
    setRole(chosenRole);

    socket.emit('JOIN_LEAGUE', {
      leagueCode: enteredCode,
      name: enteredName,
      role: chosenRole,
      settings
    });
  };

  if (!role) {
    return <Welcome onJoin={handleJoin} />;
  }

  return (
    <div className="app-container">
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

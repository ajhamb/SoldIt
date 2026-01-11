const fs = require('fs');
const path = require('path');

module.exports = (io, socket, data) => {

    // --- CREATE / JOIN LEAGUE ---
    // Now accepts detailed settings for Admin creation
    socket.on('JOIN_LEAGUE', ({ leagueCode, name, role, settings }) => {
        socket.join(leagueCode);

        let league = data.leagues.get(leagueCode);

        if (role === 'ADMIN') {
            if (!league) {
                // Validate settings or use defaults
                const config = settings || {};
                const basePrice = parseInt(config.basePrice) || 20;

                // Process players from CSV/Input or use Mock
                let initialPlayers = [];
                if (config.players && config.players.length > 0) {
                    initialPlayers = config.players.map((p, i) => ({
                        id: i + 1,
                        name: p.name,
                        category: p.category || 'General',
                        basePrice: p.basePrice || basePrice,
                        status: 'WAITING'
                    }));
                } else {
                    initialPlayers = generateMockPlayers();
                }

                // Create new league
                league = {
                    code: leagueCode,
                    name: config.leagueName || "Premier League",
                    adminId: socket.id,
                    config: {
                        teamCount: parseInt(config.teamCount) || 8,
                        playersPerTeam: parseInt(config.playersPerTeam) || 15,
                        budget: parseInt(config.budget) || 10000,
                        basePrice: basePrice,
                        playersPerTeam: parseInt(config.playersPerTeam) || 15,
                        budget: parseInt(config.budget) || 10000,
                        basePrice: basePrice,
                        maxBid: parseInt(config.maxBid) || Infinity // No limit if not set
                    },
                    adminPin: Math.floor(100000 + Math.random() * 900000).toString(),
                    teams: [],
                    players: initialPlayers,
                    unpickedPlayers: [...initialPlayers], // Copy for randomizer
                    currentPlayer: null,
                    currentPlayer: null,
                    currentBid: { amount: 0, holder: null, holderName: null },
                    state: 'WAITING', // WAITING, LIVE, PAUSED, ENDED
                    activityLog: [] // [{ type: 'BID', text: '...' }]
                };
                data.leagues.set(leagueCode, league);
            } else {
                // Rejoin as admin
                // Verify PIN
                if (settings.adminPin && settings.adminPin !== league.adminPin) {
                    socket.emit('ERROR', { message: "Invalid Admin PIN!" });
                    return;
                }

                league.adminId = socket.id;
            }
            socket.emit('ADMIN_RESTORE', league);
        } else {
            // CAPTAIN
            if (!league) {
                socket.emit('ERROR', { message: "League not found" });
                return;
            }

            // Check max teams - Strict Check
            if (league.teams.length >= league.config.teamCount) {
                // Allow rejoin if name matches existing team
                const existing = league.teams.find(t => t.name === name);
                if (!existing) {
                    socket.emit('ERROR', { message: `League Full! Max ${league.config.teamCount} teams allowed.` });
                    return;
                }
                // Update socket id for existing team
                existing.id = socket.id;
            } else {
                // Check name collision
                if (league.teams.find(t => t.name === name)) {
                    const existing = league.teams.find(t => t.name === name);
                    existing.id = socket.id; // Reconnect
                } else {
                    // New Team
                    const newTeam = {
                        id: socket.id,
                        name: name,
                        budget: league.config.budget,
                        squad: []
                    };
                    league.teams.push(newTeam);
                }
            }
        }

        // Notify everyone
        console.log(`[JOIN] ${name} joined league ${leagueCode} as ${role}`);
        saveSnapshot(league);
        broadcastUpdate(io, leagueCode, league);
    });

    // --- START AUCTION ---
    socket.on('START_AUCTION', ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league) return;

        league.state = 'LIVE';
        // Randomize
        shuffleArray(league.unpickedPlayers);

        pickNextPlayer(league, io, leagueCode);
    });

    // --- PLACE BID ---
    socket.on('PLACE_BID', ({ leagueCode, amount }) => {
        const league = data.leagues.get(leagueCode);
        if (!league || league.state !== 'LIVE') return;

        const team = league.teams.find(t => t.id === socket.id);
        if (!team) return;

        // Validation
        if (!league.currentPlayer) return;
        if (amount <= league.currentBid.amount) return;
        if (amount > team.budget) return;
        if (team.squad.length >= league.config.playersPerTeam) return;

        // Phase 4: Max Bid Check
        if (league.config.maxBid && amount > league.config.maxBid) return;

        // Phase 4: Reserve Budget Check (Sustainability)
        // We need to buy (TotalSlots - CurrentSquad - 1) more players AFTER this one.
        const slotsRemainingAfterThis = league.config.playersPerTeam - team.squad.length - 1;
        if (slotsRemainingAfterThis > 0) {
            const reserveNeeded = slotsRemainingAfterThis * league.config.basePrice;
            if ((team.budget - amount) < reserveNeeded) {
                // Not enough money left to fill squad
                return;
            }
        }

        // Update Bid
        league.currentBid = {
            amount: amount,
            holder: socket.id,
            holderName: team.name
        };

        // Log Activity
        const logEntry = { type: 'BID', text: `${team.name} bid ${amount} Th`, time: new Date().toLocaleTimeString() };
        league.activityLog.unshift(logEntry);
        if (league.activityLog.length > 50) league.activityLog.pop();


        console.log(`[BID] ${team.name} bid ${amount} on ${league.currentPlayer.name}`);
        saveSnapshot(league);
        io.to(leagueCode).emit('BID_UPDATE', league.currentBid);
        broadcastUpdate(io, leagueCode, league); // Broadcast for log update
    });

    // --- CAPTAIN PASS ---
    socket.on('CAPTAIN_PASS', ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league || !league.currentPlayer) return;

        const team = league.teams.find(t => t.id === socket.id);
        if (!team) return;

        league.activityLog.unshift({ type: 'PASS', text: `${team.name} passed` });
        console.log(`[PASS] ${team.name} passed on ${league.currentPlayer.name}`);
        saveSnapshot(league);
        broadcastUpdate(io, leagueCode, league);
    });

    // --- SOLD ---
    socket.on('SOLD', ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league || !league.currentBid.holder) return;

        const team = league.teams.find(t => t.id === league.currentBid.holder);
        const player = league.currentPlayer;

        // Transact
        team.budget -= league.currentBid.amount;
        player.status = 'SOLD';
        player.soldTo = team.name;
        player.soldAt = league.currentBid.amount;

        team.squad.push({ ...player });

        // Log Activity
        league.activityLog.unshift({ type: 'SOLD', text: `${player.name} SOLD to ${team.name} for ${league.currentBid.amount} Th` });

        console.log(`[SOLD] ${player.name} -> ${team.name} (${league.currentBid.amount})`);
        saveSnapshot(league);

        // Remove from unpicked (it was already popped, but just ensuring status is updated in main list too)
        const mainListPlayer = league.players.find(p => p.id === player.id);
        if (mainListPlayer) {
            mainListPlayer.status = 'SOLD';
            mainListPlayer.soldTo = team.name;
            mainListPlayer.soldAt = league.currentBid.amount;
        }

        io.to(leagueCode).emit('PLAYER_SOLD', {
            player: player,
            winner: team.name,
            amount: league.currentBid.amount
        });

        broadcastUpdate(io, leagueCode, league);

        // Next
        setTimeout(() => pickNextPlayer(league, io, leagueCode), 1000);
    });

    // --- UNSOLD / PASS ---
    socket.on('SKIP_PLAYER', ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league || !league.currentPlayer) return;

        const player = league.currentPlayer;
        player.status = 'UNSOLD';

        league.activityLog.unshift({ type: 'SKIP', text: `${player.name} was UNSOLD (Skipped)` });

        console.log(`[SKIP] ${player.name} marked UNSOLD`);
        saveSnapshot(league);

        const mainListPlayer = league.players.find(p => p.id === player.id);
        if (mainListPlayer) mainListPlayer.status = 'UNSOLD';

        io.to(leagueCode).emit('PLAYER_UNSOLD', { player });
        broadcastUpdate(io, leagueCode, league);

        setTimeout(() => pickNextPlayer(league, io, leagueCode), 1000);
    });

    // --- END SESSION ---
    socket.on('END_SESSION', ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league) return;

        league.state = 'ENDED';
        console.log(`[END] Auction Ended for ${leagueCode}`);
        saveSnapshot(league, 'FINAL_SESSION');

        io.to(leagueCode).emit('AUCTION_ENDED');
        broadcastUpdate(io, leagueCode, league);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
};

// Utils
function broadcastUpdate(io, leagueCode, league) {
    io.to(leagueCode).emit('LEAGUE_UPDATE', {
        code: league.code,
        name: league.name,
        config: league.config,
        teams: league.teams,
        state: league.state,
        currentBid: league.currentBid,
        currentPlayer: league.currentPlayer,
        players: league.players, // Send full list for Admin view
        activityLog: league.activityLog || []
    });
}

function pickNextPlayer(league, io, leagueCode) {
    if (league.unpickedPlayers.length === 0) {
        league.state = 'ENDED';
        league.currentPlayer = null;
        io.to(leagueCode).emit('AUCTION_ENDED');
        broadcastUpdate(io, leagueCode, league);
        return;
    }

    const nextP = league.unpickedPlayers.pop();
    league.currentPlayer = nextP;
    league.currentBid = { amount: 0, holder: null, holderName: null };

    io.to(leagueCode).emit('NEW_PLAYER', {
        player: nextP,
        currentBid: league.currentBid
    });

    broadcastUpdate(io, leagueCode, league);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function generateMockPlayers() {
    return [
        { id: 1, name: "Virat Kohli", category: "Batter", basePrice: 200, status: 'WAITING' },
        { id: 2, name: "Jasprit Bumrah", category: "Bowler", basePrice: 200, status: 'WAITING' },
        { id: 3, name: "Ben Stokes", category: "All-Rounder", basePrice: 200, status: 'WAITING' },
        { id: 4, name: "MS Dhoni", category: "WK", basePrice: 150, status: 'WAITING' },
        { id: 5, name: "Rashid Khan", category: "Bowler", basePrice: 150, status: 'WAITING' },
        { id: 6, name: "Hardik Pandya", category: "All-Rounder", basePrice: 150, status: 'WAITING' },
        { id: 7, name: "Rohit Sharma", category: "Batter", basePrice: 200, status: 'WAITING' },
        { id: 8, name: "Suryakumar Yadav", category: "Batter", basePrice: 150, status: 'WAITING' },
        { id: 9, name: "Trent Boult", category: "Bowler", basePrice: 150, status: 'WAITING' },
        { id: 10, name: "Glenn Maxwell", category: "All-Rounder", basePrice: 150, status: 'WAITING' },
    ];
}

function saveSnapshot(league, suffix = '') {
    try {
        const timestamp = Date.now();
        const s = suffix ? `-${suffix}` : '';
        const filename = `${league.code}-${league.name.replace(/[^a-z0-9]/gi, '_')}-${timestamp}${s}.json`;
        const filepath = path.join(__dirname, 'backups', filename);

        const data = JSON.stringify(league, null, 2);
        fs.writeFile(filepath, data, (err) => {
            if (err) console.error("Error saving snapshot:", err);
        });
    } catch (e) {
        console.error("Snapshot failed:", e);
    }
}

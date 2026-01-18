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
                const basePrice = parseInt(config.basePrice) || 50;

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
                    socket.emit('ERROR', { message: "Cannot create league without players! Please add players manually or via CSV." });
                    return;
                }

                // Create new league
                league = {
                    code: leagueCode,
                    name: config.leagueName || "Premier League",
                    adminId: socket.id,
                    config: {
                        teamCount: parseInt(config.teamCount) || 5,
                        playersPerTeam: parseInt(config.playersPerTeam) || 9,
                        budget: parseInt(config.budget) || 1000,
                        basePrice: basePrice,
                        maxBid: parseInt(config.maxBid) || Infinity // No limit if not set
                    },
                    adminPin: Math.floor(100000 + Math.random() * 900000).toString(),
                    teams: [],
                    players: initialPlayers,
                    unpickedPlayers: [...initialPlayers], // Copy for randomizer
                    currentPlayer: null,
                    currentBid: { amount: 0, holder: null, holderName: null },
                    bidHistory: [], // Track bids for undo
                    passedTeams: [], // Teams that passed on CURRENT player (storing team names)
                    biddingOrder: [], // Randomized order of team names
                    activeTurn: null, // Team name whose turn it is
                    roundRobinStartIndex: -1, // Which index in biddingOrder starts for this player
                    state: 'WAITING', // WAITING, LIVE, PAUSED, ENDED
                    activityLog: [] // [{ type: 'BID', text: '...' }]
                };
                data.leagues.set(leagueCode, league);
                console.log(`[${leagueCode}][CREATE] League ${league.name} created. Admin PIN: ${league.adminPin}`);
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
        console.log(`[${leagueCode}][JOIN] ${name} joined as ${role}`);
        saveSnapshot(league);
        broadcastUpdate(io, leagueCode, league);
    });

    // --- START AUCTION ---
    socket.on('START_AUCTION', ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league) return;

        // Validation: All teams must be joined
        if (league.teams.length < league.config.teamCount) {
            socket.emit('ERROR', { message: `Cannot start! Only ${league.teams.length}/${league.config.teamCount} teams joined.` });
            return;
        }

        league.state = 'LIVE';
        // Randomize Players
        shuffleArray(league.unpickedPlayers);

        // Initialize Round Robin Order
        league.biddingOrder = league.teams.map(t => t.name);
        shuffleArray(league.biddingOrder);
        console.log(`[${leagueCode}][ORDER] Bidding order: ${league.biddingOrder.join(' -> ')}`);

        pickNextPlayer(league, io, leagueCode);
    });

    // --- PLACE BID ---
    socket.on('PLACE_BID', ({ leagueCode, amount }) => {
        const league = data.leagues.get(leagueCode);
        if (!league || league.state !== 'LIVE') return;

        const team = league.teams.find(t => t.id === socket.id);
        if (!team) return;

        // Round Robin: Check Turn
        if (league.activeTurn && team.name !== league.activeTurn) return;

        // Pass Restriction
        if (league.passedTeams && league.passedTeams.includes(team.name)) return;

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

        // Push current bid to history before updating (Deep copy)
        league.bidHistory.push({ ...league.currentBid });

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


        console.log(`[${leagueCode}][BID] ${team.name} bid ${amount} on ${league.currentPlayer.name}`);
        saveSnapshot(league);

        // Advance Turn
        findNextTurn(league);

        io.to(leagueCode).emit('BID_UPDATE', league.currentBid);
        broadcastUpdate(io, leagueCode, league);
    });

    // --- UNDO BID ---
    socket.on('UNDO_BID', ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league || league.state !== 'LIVE') return;
        if (league.bidHistory.length === 0) return;

        // Revert to previous bid
        const previousBid = league.bidHistory.pop();
        league.currentBid = previousBid;

        // Log Activity
        league.activityLog.unshift({ type: 'UNDO', text: `⚠️ Previous Bid UNDONE by Admin` });

        console.log(`[${leagueCode}][UNDO] Bid reverted to ${previousBid.amount} by ${previousBid.holderName || 'None'}`);
        saveSnapshot(league);

        io.to(leagueCode).emit('BID_UPDATE', league.currentBid);
        broadcastUpdate(io, leagueCode, league);
    });

    // --- RESTART BIDDING ---
    socket.on('RESTART_BIDDING', ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league || league.state !== 'LIVE') return;
        if (socket.id !== league.adminId) return;

        // Reset current bid and history
        league.currentBid = { amount: 0, holder: null, holderName: null };
        league.bidHistory = [];
        league.passedTeams = []; // Allow everyone to bid again

        // Reset turn to the original starter for this player
        if (league.biddingOrder.length > 0) {
            league.activeTurn = league.biddingOrder[league.roundRobinStartIndex % league.biddingOrder.length];
        }

        // Log Activity
        league.activityLog.unshift({ type: 'UNDO', text: `🔄 Bidding RESTARTED by Admin` });

        console.log(`[${leagueCode}][RESTART] Bidding restarted for ${league.currentPlayer?.name}`);
        saveSnapshot(league);

        io.to(leagueCode).emit('BID_UPDATE', league.currentBid);
        broadcastUpdate(io, leagueCode, league);
    });

    // --- MANUAL ASSIGN (ADMIN REASSIGNMENT) ---
    socket.on('ADMIN_ASSIGN_PLAYER', ({ leagueCode, playerId, teamName, price }) => {
        const league = data.leagues.get(leagueCode);
        if (!league) return;
        if (socket.id !== league.adminId) return;

        const player = league.players.find(p => p.id === playerId);
        const targetTeam = league.teams.find(t => t.name === teamName);
        const assignPrice = parseInt(price);

        if (!player || !targetTeam || isNaN(assignPrice)) return;

        // --- VALIDATIONS ---

        // 1. Price Limits
        if (assignPrice < league.config.basePrice) {
            socket.emit('ERROR', { message: `Price cannot be lower than Base Price (${league.config.basePrice})` });
            return;
        }
        if (league.config.maxBid && assignPrice > league.config.maxBid) {
            socket.emit('ERROR', { message: `Price cannot exceed Max Bid Limit (${league.config.maxBid})` });
            return;
        }

        // 2. Squad Size Limit
        // Only check if we are adding a NEW player to this team (not just adjusting price for same team)
        if (player.soldTo !== targetTeam.name) {
            if (targetTeam.squad.length >= league.config.playersPerTeam) {
                socket.emit('ERROR', { message: `Team ${targetTeam.name} is already full! (Max ${league.config.playersPerTeam})` });
                return;
            }
        }

        // PRE-CALCULATION
        let netBudget = targetTeam.budget;

        // If player is currently owned by THIS target team, they will get a refund first
        if (player.status === 'SOLD' && player.soldTo === targetTeam.name) {
            netBudget += player.soldAt;
        }

        // Check Affordability
        if (netBudget < assignPrice) {
            socket.emit('ERROR', { message: `Insufficient Budget! ${targetTeam.name} needs ${assignPrice} but has effective ${netBudget}.` });
            return;
        }

        // EXECUTE
        // 1. Refund Old Owner (if any)
        if (player.status === 'SOLD' && player.soldTo) {
            const previousTeam = league.teams.find(t => t.name === player.soldTo);
            if (previousTeam) {
                previousTeam.squad = previousTeam.squad.filter(p => p.id !== player.id);
                previousTeam.budget += player.soldAt;
            }
        }

        // 2. Charge New Owner
        targetTeam.budget -= assignPrice;
        targetTeam.squad.push(player);

        // 3. Update Player
        player.status = 'SOLD';
        player.soldTo = targetTeam.name;
        player.soldAt = assignPrice;

        // Log Activity
        league.activityLog.unshift({ type: 'SOLD', text: `ADMIN: Assigned ${player.name} to ${targetTeam.name} for ${assignPrice}` });

        console.log(`[${leagueCode}][ADMIN ASSIGN] ${player.name} -> ${targetTeam.name} (${assignPrice})`);
        saveSnapshot(league);
        broadcastUpdate(io, leagueCode, league);
    });

    // --- MANUAL UNASSIGN (ADMIN RELEASE) ---
    socket.on('ADMIN_UNASSIGN_PLAYER', ({ leagueCode, playerId }) => {
        const league = data.leagues.get(leagueCode);
        if (!league) return;
        if (socket.id !== league.adminId) return;

        const player = league.players.find(p => p.id === playerId);
        if (!player) return;

        // Refund if sold
        if (player.status === 'SOLD' && player.soldTo) {
            const team = league.teams.find(t => t.name === player.soldTo);
            if (team) {
                team.squad = team.squad.filter(p => p.id !== player.id);
                team.budget += player.soldAt;
                console.log(`[${leagueCode}][UNASSIGN] Refunded ${team.name} ${player.soldAt}`);
            }
        }

        // Reset Player
        player.status = 'UNSOLD';
        player.soldTo = null;
        player.soldAt = null;

        // Log
        league.activityLog.unshift({ type: 'SKIP', text: `ADMIN: Unassigned/Released ${player.name}` });
        console.log(`[${leagueCode}][UNASSIGN] Admin released ${player.name}`);

        saveSnapshot(league);
        broadcastUpdate(io, leagueCode, league);
    });

    // --- CAPTAIN PASS ---
    socket.on('CAPTAIN_PASS', ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league || !league.currentPlayer) return;

        const team = league.teams.find(t => t.id === socket.id);
        if (!team) return;

        // Turn Check
        if (league.activeTurn && team.name !== league.activeTurn) return;

        league.activityLog.unshift({ type: 'PASS', text: `${team.name} passed` });

        // Add to passed teams
        if (!league.passedTeams) league.passedTeams = [];
        if (!league.passedTeams.includes(team.name)) {
            league.passedTeams.push(team.name);
        }

        console.log(`[${leagueCode}][PASS] ${team.name} passed on ${league.currentPlayer.name}`);
        saveSnapshot(league);

        // Advance Turn
        findNextTurn(league);

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

        console.log(`[${leagueCode}][SOLD] ${player.name} -> ${team.name} (${league.currentBid.amount})`);
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

        console.log(`[${leagueCode}][SKIP] ${player.name} marked UNSOLD`);
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
        console.log(`[${leagueCode}][END] Auction Ended`);
        saveSnapshot(league, 'FINAL_SESSION');

        io.to(leagueCode).emit('AUCTION_ENDED');
        broadcastUpdate(io, leagueCode, league);
    });

    socket.on('disconnect', () => {
        const ip = socket.handshake.address;
        console.log(`User disconnected: ${socket.id} (IP: ${ip})`);
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
        activityLog: league.activityLog || [],
        passedTeams: league.passedTeams || [],
        biddingOrder: league.biddingOrder || [],
        activeTurn: league.activeTurn || null
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
    league.bidHistory = []; // Reset history for new player
    league.passedTeams = []; // Reset passed teams for new player

    // Round Robin: Rotate starting team
    league.roundRobinStartIndex = (league.roundRobinStartIndex + 1) % league.biddingOrder.length;
    league.activeTurn = league.biddingOrder[league.roundRobinStartIndex];

    // Log Activity
    league.activityLog.unshift({ type: 'NEW', text: `${nextP.name} is available. TURN: ${league.activeTurn}` });
    console.log(`[${league.code}][NEW] Player: ${nextP.name} (${nextP.category}, Base: ${nextP.basePrice})`);

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

function findNextTurn(league) {
    if (!league.biddingOrder || league.biddingOrder.length === 0) return;

    const currentIndex = league.biddingOrder.indexOf(league.activeTurn);
    const orderLength = league.biddingOrder.length;

    // Check next teams in order
    for (let i = 1; i <= orderLength; i++) {
        const nextIndex = (currentIndex + i) % orderLength;
        const nextTeamName = league.biddingOrder[nextIndex];
        const team = league.teams.find(t => t.name === nextTeamName);

        if (!team) continue;

        // Skip conditions:
        // 1. Already passed on this player
        if (league.passedTeams.includes(nextTeamName)) continue;

        // 2. Out of budget (less than base price or current bid + 1)
        const minNeed = league.currentBid.amount > 0 ? league.currentBid.amount + 1 : league.config.basePrice;
        if (team.budget < minNeed) continue;

        // 3. Squad full
        if (team.squad.length >= league.config.playersPerTeam) continue;

        // Valid turn found
        league.activeTurn = nextTeamName;
        return;
    }

    // No one left to bid?
    league.activeTurn = null;
}

function saveSnapshot(league, suffix = '') {
    try {
        const timestamp = Date.now();
        const s = suffix ? `-${suffix}` : '';
        const filename = `${league.code}-${league.name.replace(/[^a-z0-9]/gi, '_')}-${timestamp}${s}.json`;
        const backupDir = path.join(__dirname, 'backups');

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const filepath = path.join(backupDir, filename);

        const data = JSON.stringify(league, null, 2);
        fs.writeFile(filepath, data, (err) => {
            if (err) console.error(`[${league.code}] Error saving snapshot:`, err);
        });
    } catch (e) {
        console.error(`[${league.code}] Snapshot failed:`, e);
    }
}

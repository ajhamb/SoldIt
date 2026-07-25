const fs = require('fs');
const path = require('path');

module.exports = (io, socket, data, supabase) => {

    function isSocketAdmin(socket, league) {
        if (!league) return false;
        const cleanEmail = socket.email || socket.handshake.query.email?.trim().toLowerCase();
        const isOwner = league.adminEmail && league.adminEmail.toLowerCase() === cleanEmail;
        const isCoAdmin = league.invitations?.some(inv => inv.email === cleanEmail && inv.role === 'ADMIN');
        return socket.id === league.adminId || isOwner || isCoAdmin;
    }

    // --- CREATE / JOIN LEAGUE ---
    // Now accepts detailed settings for Admin creation
    socket.on('JOIN_LEAGUE', async ({ leagueCode, name, role, settings }) => {
        if (role === 'SUPER_ADMIN') {
            const userEmail = (settings?.email || name || '').trim().toLowerCase();
            const isSuperAdmin = data.superAdmins.has(userEmail) || data.superAdmins.size === 0 || userEmail === 'admin@test.com';
            if (!isSuperAdmin) {
                return socket.emit('ERROR', { message: `Unauthorized: ${userEmail} is not a designated Super Admin!` });
            }
            socket.join('super-admin-room');
            console.log(`[SUPER_ADMIN][JOIN] Super Admin connected: ${userEmail}`);
            // Send initial leagues list
            const allLeagues = Array.from(data.leagues.values());
            socket.emit('SUPER_ADMIN_RESTORE', allLeagues);
            return;
        }

        socket.join(leagueCode);

        let league = data.leagues.get(leagueCode);

        if (role === 'ADMIN') {
            const isCreating = settings && settings.players && settings.players.length > 0;

            if (isCreating) {
                let codeToCheck = leagueCode;
                let loopCount = 0;
                while (data.leagues.has(codeToCheck)) {
                    codeToCheck = Math.random().toString(36).substring(2, 8).toUpperCase();
                    loopCount++;
                    if (loopCount > 100) break;
                }
                if (codeToCheck !== leagueCode) {
                    console.log(`[DUPLICATE DETECTED] Replacing duplicate leagueCode ${leagueCode} with unique code ${codeToCheck}`);
                    socket.leave(leagueCode);
                    leagueCode = codeToCheck;
                    socket.join(leagueCode);
                }
            }

            if (!league) {
                if (!isCreating) {
                    socket.emit('ERROR', { message: "League not found" });
                    return;
                }
                const config = settings || {};
                const basePrice = parseInt(config.basePrice) || 50;

                let initialPlayers = [];
                if (config.players && config.players.length > 0) {
                    initialPlayers = config.players.map((p, i) => ({
                        id: i + 1,
                        externalId: p.externalId || p.external_id || '',
                        name: p.name,
                        category: p.category || 'General',
                        basePrice: p.basePrice || basePrice,
                        status: 'WAITING'
                    }));

                    // Validate ExternalId uniqueness in initialPlayers
                    const extIdMap = new Set();
                    for (const p of initialPlayers) {
                        if (p.externalId && p.externalId.trim()) {
                            const cleanExt = p.externalId.trim().toLowerCase();
                            if (extIdMap.has(cleanExt)) {
                                socket.emit('ERROR', { message: `Validation Error: Duplicate ExternalId "${p.externalId}" found in player pool! League creation aborted.` });
                                return;
                            }
                            extIdMap.add(cleanExt);
                        }
                    }
                } else {
                    socket.emit('ERROR', { message: "Cannot create league without players! Please add players manually or via CSV." });
                    return;
                }

                // Create new league
                const adminEmail = config.adminEmail?.trim().toLowerCase() || null;
                const adminName = name && name !== 'admin' ? name : (adminEmail ? adminEmail.split('@')[0] : 'Admin');
                league = {
                    code: leagueCode,
                    name: config.leagueName || "Premier League",
                    adminId: socket.id,
                    adminEmail: adminEmail,
                    adminName: adminName,
                    createdAt: new Date().toISOString(),
                    config: {
                        teamCount: parseInt(config.teamCount) || 5,
                        playersPerTeam: parseInt(config.playersPerTeam) || 9,
                        budget: parseInt(config.budget) || 1000,
                        basePrice: basePrice,
                        maxBid: parseInt(config.maxBid) || Infinity
                    },
                    teams: [],
                    players: initialPlayers,
                    unpickedPlayers: [...initialPlayers],
                    currentPlayer: null,
                    currentBid: { amount: 0, holder: null, holderName: null },
                    bidHistory: [],
                    passedTeams: [],
                    biddingOrder: [],
                    activeTurn: null,
                    roundRobinStartIndex: -1,
                    state: 'WAITING',
                    activityLog: [],
                    invitations: []
                };
                data.leagues.set(leagueCode, league);
                socket.email = adminEmail;
                console.log(`[${leagueCode}][CREATE] League ${league.name} created by admin ${adminEmail}`);
                socket.emit('ADMIN_RESTORE', { ...league, isNew: true });
            } else {
                // Rejoin as admin (or join as co-admin)
                const clientEmail = settings?.email?.trim().toLowerCase();
                const isOwner = clientEmail && clientEmail === league.adminEmail;
                const isCoAdmin = league.invitations?.some(inv => inv.email === clientEmail && inv.role === 'ADMIN');
                if (!isOwner && !isCoAdmin) {
                    socket.emit('ERROR', { message: "You are not the designated Admin of this league!" });
                    return;
                }

                socket.email = clientEmail;
                
                // Mark co-admin invitation as JOINED
                if (isCoAdmin) {
                    const invite = league.invitations.find(inv => inv.email === clientEmail);
                    if (invite) {
                        invite.status = 'JOINED';
                        if (supabase) {
                            supabase
                                .from('invitations')
                                .update({ status: 'JOINED' })
                                .eq('league_code', leagueCode)
                                .eq('email', clientEmail)
                                .then(({ error }) => {
                                    if (error) console.error("Supabase sync invitation update failed:", error);
                                });
                        }
                    }
                }

                league.adminId = socket.id;
                if (name && name !== 'admin') league.adminName = name;
                socket.emit('ADMIN_RESTORE', league);
            }
        } else {
            // CAPTAIN
            if (!league) {
                socket.emit('ERROR', { message: "League not found" });
                return;
            }

            const cleanEmail = settings?.email?.trim().toLowerCase();
            if (!cleanEmail) {
                socket.emit('ERROR', { message: "An email address is required to join as a Captain." });
                return;
            }

            if (!league.invitations) league.invitations = [];
            const invite = league.invitations.find(inv => inv.email === cleanEmail);
            if (!invite) {
                socket.emit('ERROR', { message: "You have not been invited to this league!" });
                return;
            }

            socket.email = cleanEmail;
            invite.status = 'JOINED';

            // Sync joined status to DB
            if (supabase) {
                supabase
                    .from('invitations')
                    .update({ status: 'JOINED' })
                    .eq('league_code', leagueCode)
                    .eq('email', cleanEmail)
                    .then(({ error }) => {
                        if (error) console.error("Supabase sync invitation update failed:", error);
                    });
            }

            // Check if captain already has a team in this league (by email or name)
            const existing = cleanEmail
                ? league.teams.find(t => t.email === cleanEmail)
                : league.teams.find(t => t.name === name);

            if (existing) {
                // Reconnect
                existing.id = socket.id;
                existing.status = 'JOINED';
                if (name) {
                    existing.name = name;
                }
                const logMsg = `Captain ${existing.name} has joined the auction`;
                league.activityLog.unshift({ type: 'SYSTEM', text: logMsg });
                console.log(`[${leagueCode}][RECONNECT] ${logMsg}`);
            } else {
                if (league.teams.length >= league.config.teamCount) {
                    socket.emit('ERROR', { message: `League Full! Max ${league.config.teamCount} teams allowed.` });
                    return;
                }

                // Check name collision
                if (league.teams.find(t => t.name === name)) {
                    socket.emit('ERROR', { message: `Team Name "${name}" is already taken.` });
                    return;
                }

                // New Team
                const newTeam = {
                    id: socket.id,
                    name: name,
                    email: cleanEmail,
                    budget: league.config.budget,
                    squad: [],
                    status: 'JOINED'
                };
                league.teams.push(newTeam);
                const logMsg = `Captain ${newTeam.name} has joined the auction`;
                league.activityLog.unshift({ type: 'SYSTEM', text: logMsg });
                console.log(`[${leagueCode}][JOIN] ${logMsg}`);
            }
        }

        // Notify everyone
        await saveSnapshot(league);
        broadcastUpdate(io, leagueCode, league);
    });

    // --- START AUCTION ---
    socket.on('START_AUCTION', async ({ leagueCode }) => {
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

    socket.on('DRAW_NEXT_PLAYER', async ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league || league.state !== 'LIVE') return;
        
        if (!isSocketAdmin(socket, league)) {
            return;
        }

        pickNextPlayer(league, io, leagueCode);
        broadcastUpdate(io, leagueCode, league);
    });

    socket.on('UPDATE_TEAM_COUNT', async ({ leagueCode, teamCount }, callback) => {
        const league = data.leagues.get(leagueCode);
        if (!league) {
            if (callback) callback({ error: "League not found!" });
            return;
        }

        if (!isSocketAdmin(socket, league)) {
            if (callback) callback({ error: "Unauthorized: Only an Admin can edit settings." });
            return;
        }

        if (league.state !== 'WAITING') {
            if (callback) callback({ error: "Team count can only be changed before the auction has started!" });
            return;
        }

        const count = parseInt(teamCount);
        if (isNaN(count) || count < 1) {
            if (callback) callback({ error: "Invalid team count!" });
            return;
        }

        if (count < league.teams.length) {
            if (callback) callback({ error: `Cannot set team count to ${count} because ${league.teams.length} teams have already joined!` });
            return;
        }

        league.config.teamCount = count;
        console.log(`[${leagueCode}][UPDATE_TEAM_COUNT] Team count updated to ${count}`);
        
        await saveSnapshot(league);
        broadcastUpdate(io, leagueCode, league);
        if (callback) callback({ success: true });
    });

    socket.on('UPDATE_TEAM_NAME', async ({ leagueCode, oldName, newName }, callback) => {
        const league = data.leagues.get(leagueCode);
        if (!league) {
            if (callback) callback({ error: "League not found!" });
            return;
        }

        const cleanNewName = newName?.trim();
        if (!cleanNewName) {
            if (callback) callback({ error: "Team name cannot be empty." });
            return;
        }
        if (cleanNewName.length > 30) {
            if (callback) callback({ error: "Team name cannot exceed 30 characters." });
            return;
        }

        // Check uniqueness (case-insensitive)
        const nameClash = league.teams.some(t => t.name.toLowerCase() === cleanNewName.toLowerCase() && t.name !== oldName);
        if (nameClash) {
            if (callback) callback({ error: `Team name "${cleanNewName}" is already taken.` });
            return;
        }

        // Find the target team
        const targetTeam = league.teams.find(t => t.name === oldName);
        if (!targetTeam) {
            if (callback) callback({ error: "Team not found!" });
            return;
        }

        // Check authorization: Admin can rename any. Captain can only rename their own team.
        const isAdmin = isSocketAdmin(socket, league);
        if (!isAdmin) {
            const clientEmail = socket.email || socket.handshake?.query?.email;
            const matchesSocket = targetTeam.id === socket.id || (clientEmail && targetTeam.email?.toLowerCase() === clientEmail.trim().toLowerCase());
            if (!matchesSocket) {
                if (callback) callback({ error: "Unauthorized: Captains can only rename their own team." });
                return;
            }
        }

        // Update the team name
        targetTeam.name = cleanNewName;

        // Update bidding order list
        if (league.biddingOrder) {
            league.biddingOrder = league.biddingOrder.map(name => name === oldName ? cleanNewName : name);
        }

        // Update activeTurn
        if (league.activeTurn === oldName) {
            league.activeTurn = cleanNewName;
        }

        // Update current bid holder name
        if (league.currentBid && league.currentBid.holderName === oldName) {
            league.currentBid.holderName = cleanNewName;
        }

        // Update passed teams list
        if (league.passedTeams) {
            league.passedTeams = league.passedTeams.map(name => name === oldName ? cleanNewName : name);
        }

        // Update player ownership mappings
        const updatePlayerSoldTo = (p) => {
            if (p.soldTo === oldName) {
                p.soldTo = cleanNewName;
            }
        };
        league.players.forEach(updatePlayerSoldTo);
        if (league.unpickedPlayers) {
            league.unpickedPlayers.forEach(updatePlayerSoldTo);
        }
        if (league.currentPlayer) {
            updatePlayerSoldTo(league.currentPlayer);
        }
        league.teams.forEach(t => {
            if (t.squad) {
                t.squad.forEach(updatePlayerSoldTo);
            }
        });

        // Add activity log
        league.activityLog.unshift({
            type: 'SYSTEM',
            text: `Team "${oldName}" renamed to "${cleanNewName}"`
        });

        console.log(`[${leagueCode}][RENAME] Team "${oldName}" -> "${cleanNewName}"`);
        await saveSnapshot(league);
        io.to(leagueCode).emit('TEAM_RENAMED', { oldName, newName: cleanNewName });
        broadcastUpdate(io, leagueCode, league);
        if (callback) callback({ success: true });
    });

    // --- PLACE BID ---
    socket.on('PLACE_BID', async ({ leagueCode, amount }) => {
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
                return socket.emit('ERROR', {
                    message: `Cannot Bid ${amount} Th! You must keep at least ${reserveNeeded} Th to fill your remaining ${slotsRemainingAfterThis} squad spots at Base Price (${league.config.basePrice} Th).`
                });
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

        if (league.config.maxBid && amount === league.config.maxBid) {
            // Bid reached max bid limit. Sell automatically!
            await executeSoldTransaction(league, leagueCode);
            return;
        }

        await saveSnapshot(league);

        // Advance Turn
        await findNextTurn(league, leagueCode);

        io.to(leagueCode).emit('BID_UPDATE', league.currentBid);
        broadcastUpdate(io, leagueCode, league);
    });

    // --- UNDO BID ---
    socket.on('UNDO_BID', async ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league || league.state !== 'LIVE') return;
        if (league.bidHistory.length === 0) return;

        const undoneBidderName = league.currentBid.holderName;

        // Revert to previous bid
        const previousBid = league.bidHistory.pop();
        league.currentBid = previousBid;

        // Give turn to the captain whose bid was undone
        if (undoneBidderName) {
            league.activeTurn = undoneBidderName;
            if (league.passedTeams) {
                league.passedTeams = league.passedTeams.filter(name => name !== undoneBidderName);
            }
        } else {
            // Revert to original starter
            if (league.biddingOrder && league.biddingOrder.length > 0) {
                league.activeTurn = league.biddingOrder[league.roundRobinStartIndex % league.biddingOrder.length];
            }
        }

        // Log Activity
        league.activityLog.unshift({ type: 'UNDO', text: `⚠️ Previous Bid UNDONE by Admin` });

        console.log(`[${leagueCode}][UNDO] Bid reverted to ${previousBid.amount} by ${previousBid.holderName || 'None'}`);
        await saveSnapshot(league);

        io.to(leagueCode).emit('BID_UPDATE', league.currentBid);
        broadcastUpdate(io, leagueCode, league);
    });

    // --- RESTART BIDDING ---
    socket.on('RESTART_BIDDING', async ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league || league.state !== 'LIVE') return;
        if (socket.id !== league.adminId) return;

        // Reset current bid and history
        league.currentBid = { amount: 0, holder: null, holderName: null };
        league.bidHistory = [];
        league.passedTeams = []; // Allow everyone to bid again

        // Reset turn to the original starter for this player, skipping full squads
        if (league.biddingOrder && league.biddingOrder.length > 0) {
            let foundActiveTurn = false;
            let count = 0;
            let checkIndex = league.roundRobinStartIndex;
            while (!foundActiveTurn && count < league.biddingOrder.length) {
                const nextTeamName = league.biddingOrder[checkIndex % league.biddingOrder.length];
                const team = league.teams.find(t => t.name === nextTeamName);
                if (team && team.squad.length < league.config.playersPerTeam) {
                    league.activeTurn = nextTeamName;
                    foundActiveTurn = true;
                } else {
                    checkIndex++;
                }
                count++;
            }
            if (!foundActiveTurn) {
                league.activeTurn = null;
            }
        }

        // Log Activity
        league.activityLog.unshift({ type: 'UNDO', text: `🔄 Bidding RESTARTED by Admin` });

        console.log(`[${leagueCode}][RESTART] Bidding restarted for ${league.currentPlayer?.name}`);
        await saveSnapshot(league);

        io.to(leagueCode).emit('BID_UPDATE', league.currentBid);
        broadcastUpdate(io, leagueCode, league);
    });

    socket.on('ADMIN_ASSIGN_PLAYER', async ({ leagueCode, playerId, teamName, price }) => {
        const league = data.leagues.get(leagueCode);
        if (!league) return;
        if (!isSocketAdmin(socket, league)) return;

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
        await saveSnapshot(league);
        broadcastUpdate(io, leagueCode, league);
    });

    socket.on('ADMIN_UNASSIGN_PLAYER', async ({ leagueCode, playerId }) => {
        const league = data.leagues.get(leagueCode);
        if (!league) return;
        if (!isSocketAdmin(socket, league)) return;

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

        await saveSnapshot(league);
        broadcastUpdate(io, leagueCode, league);
    });

    socket.on('ADMIN_UPDATE_PLAYER', async ({ leagueCode, playerId, externalId, name, category, basePrice }, callback) => {
        const league = data.leagues.get(leagueCode);
        if (!league) {
            if (callback) callback({ error: "League not found!" });
            return;
        }

        if (!isSocketAdmin(socket, league)) {
            if (callback) callback({ error: "Unauthorized: Only an Admin can update player details." });
            return;
        }

        const player = league.players.find(p => p.id === playerId);
        if (!player) {
            if (callback) callback({ error: "Player not found!" });
            return;
        }

        // Validate ExternalId uniqueness
        if (externalId !== undefined && externalId.trim()) {
            const cleanExt = externalId.trim().toLowerCase();
            const existing = league.players.find(p => p.id !== playerId && p.externalId && p.externalId.trim().toLowerCase() === cleanExt);
            if (existing) {
                const err = `Validation Error: ExternalId "${externalId.trim()}" is already assigned to player "${existing.name}"!`;
                league.activityLog.unshift({ type: 'SYSTEM', text: `ADMIN EDIT FAILED: ${err}` });
                await saveSnapshot(league);
                broadcastUpdate(io, leagueCode, league);
                if (callback) callback({ error: err });
                return;
            }
        }

        if (externalId !== undefined) player.externalId = externalId.trim();
        if (name && name.trim()) player.name = name.trim();
        if (category) player.category = category;
        if (basePrice && !isNaN(parseInt(basePrice))) player.basePrice = parseInt(basePrice);

        // Update in currentPlayer if active
        if (league.currentPlayer && league.currentPlayer.id === playerId) {
            if (externalId !== undefined) league.currentPlayer.externalId = externalId.trim();
            if (name && name.trim()) league.currentPlayer.name = name.trim();
            if (category) league.currentPlayer.category = category;
            if (basePrice && !isNaN(parseInt(basePrice))) league.currentPlayer.basePrice = parseInt(basePrice);
        }

        // Update in unpickedPlayers if present
        const unpicked = league.unpickedPlayers?.find(p => p.id === playerId);
        if (unpicked) {
            if (externalId !== undefined) unpicked.externalId = externalId.trim();
            if (name && name.trim()) unpicked.name = name.trim();
            if (category) unpicked.category = category;
            if (basePrice && !isNaN(parseInt(basePrice))) unpicked.basePrice = parseInt(basePrice);
        }

        // Update in teams squad if sold
        league.teams.forEach(t => {
            const squadP = t.squad?.find(p => p.id === playerId);
            if (squadP) {
                if (externalId !== undefined) squadP.externalId = externalId.trim();
                if (name && name.trim()) squadP.name = name.trim();
                if (category) squadP.category = category;
            }
        });

        league.activityLog.unshift({ type: 'SYSTEM', text: `ADMIN: Updated details for ${player.name} (ExtID: ${player.externalId || 'N/A'})` });
        console.log(`[${leagueCode}][UPDATE_PLAYER] ${player.name} updated. ExtID: ${player.externalId}`);

        await saveSnapshot(league);
        broadcastUpdate(io, leagueCode, league);
        if (callback) callback({ success: true, player });
    });

    // --- CAPTAIN PASS ---
    socket.on('CAPTAIN_PASS', async ({ leagueCode }) => {
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
        await saveSnapshot(league);

        // Advance Turn
        await findNextTurn(league, leagueCode);

        broadcastUpdate(io, leagueCode, league);
    });

    // --- SOLD ---
    socket.on('SOLD', async ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        await executeSoldTransaction(league, leagueCode);
    });

    // --- UNSOLD / PASS ---
    socket.on('SKIP_PLAYER', async ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league || !league.currentPlayer) return;

        const player = league.currentPlayer;
        player.status = 'UNSOLD';

        league.activityLog.unshift({ type: 'SKIP', text: `${player.name} was UNSOLD (Skipped)` });

        console.log(`[${leagueCode}][SKIP] ${player.name} marked UNSOLD`);
        await saveSnapshot(league);

        const mainListPlayer = league.players.find(p => p.id === player.id);
        if (mainListPlayer) mainListPlayer.status = 'UNSOLD';

        io.to(leagueCode).emit('PLAYER_UNSOLD', { player });
        broadcastUpdate(io, leagueCode, league);
    });

    // --- END SESSION ---
    socket.on('END_SESSION', async ({ leagueCode }) => {
        const league = data.leagues.get(leagueCode);
        if (!league) return;

        league.state = 'ENDED';
        console.log(`[${leagueCode}][END] Auction Ended`);
        await saveSnapshot(league, 'FINAL_SESSION');

        io.to(leagueCode).emit('AUCTION_ENDED');
        broadcastUpdate(io, leagueCode, league);
    });

    socket.on('SUPER_ADMIN_END_LEAGUE', async ({ leagueCode }) => {
        // Enforce Super Admin room permission
        const isSuperAdmin = socket.rooms.has('super-admin-room');
        if (!isSuperAdmin) {
            return socket.emit('ERROR', { message: "Unauthorized: Only Super Admins can force end auctions." });
        }

        const league = data.leagues.get(leagueCode);
        if (!league) return socket.emit('ERROR', { message: "League not found!" });

        league.state = 'ENDED';
        league.currentPlayer = null;
        league.activeTurn = null;
        console.log(`[SUPER_ADMIN][END] Super Admin force ended league ${leagueCode}`);
        
        await saveSnapshot(league, 'SUPER_ADMIN_END');

        io.to(leagueCode).emit('AUCTION_ENDED');
        broadcastUpdate(io, leagueCode, league);
    });

    socket.on('INVITE_CAPTAIN', async ({ leagueCode, email, role = 'CAPTAIN' }, callback) => {
        const league = data.leagues.get(leagueCode);
        if (!league) {
            if (callback) callback({ error: "League not found!" });
            return;
        }

        const senderEmail = socket.handshake.query.email?.trim().toLowerCase();
        const isOwner = league.adminEmail && league.adminEmail.toLowerCase() === senderEmail;
        const isCoAdmin = league.invitations?.some(inv => inv.email.toLowerCase() === senderEmail && inv.role === 'ADMIN');
        const isAdmin = socket.id === league.adminId || isOwner || isCoAdmin;

        if (!isAdmin) {
            if (callback) callback({ error: "Unauthorized: Only an Admin can invite captains." });
            return;
        }

        const cleanEmail = email.trim().toLowerCase();
        
        if (!league.invitations) league.invitations = [];
        const exists = league.invitations.some(inv => inv.email === cleanEmail);
        if (exists) {
            if (callback) callback({ error: `${cleanEmail} is already invited.` });
            return;
        }

        // Add invitation
        league.invitations.push({ email: cleanEmail, status: 'PENDING', role: role });

        // Sync insert to DB
        if (supabase) {
            supabase
                .from('invitations')
                .insert([{ league_code: leagueCode, email: cleanEmail, status: 'PENDING' }])
                .then(({ error }) => {
                    if (error) console.error("Supabase sync invitation insert failed:", error);
                });
        }

        console.log(`[${leagueCode}][INVITE] Invited ${role}: ${cleanEmail}`);
        await saveSnapshot(league);
        broadcastUpdate(io, leagueCode, league);
        notifyUserLeaguesUpdate(cleanEmail);
        if (callback) callback({ success: true });
    });

    socket.on('REMOVE_CAPTAIN', async ({ leagueCode, email }) => {
        const league = data.leagues.get(leagueCode);
        if (!league) return;

        const isAdmin = socket.id === league.adminId;
        if (!isAdmin) {
            return socket.emit('ERROR', { message: "Unauthorized: Only the league Admin can remove captains." });
        }

        const cleanEmail = email.trim().toLowerCase();

        // 1. Remove from invitations array
        if (league.invitations) {
            league.invitations = league.invitations.filter(inv => inv.email !== cleanEmail);
        }

        // 2. Remove team
        const teamIndex = league.teams.findIndex(t => t.email?.toLowerCase() === cleanEmail);
        if (teamIndex !== -1) {
            const team = league.teams[teamIndex];
            const targetSocketId = team.id;
            
            league.teams.splice(teamIndex, 1);
            
            if (targetSocketId) {
                const targetSocket = io.sockets.sockets.get(targetSocketId);
                if (targetSocket) {
                    targetSocket.emit('ERROR', { message: "You have been removed from this league." });
                    targetSocket.leave(leagueCode);
                }
            }
        }

        // 3. Sync delete to DB
        if (supabase) {
            supabase
                .from('invitations')
                .delete()
                .eq('league_code', leagueCode)
                .eq('email', cleanEmail)
                .then(({ error }) => {
                    if (error) console.error("Supabase sync invitation delete failed:", error);
                });
        }

        console.log(`[${leagueCode}][REMOVE] Captain ${cleanEmail} removed from league`);
        await saveSnapshot(league);
        broadcastUpdate(io, leagueCode, league);
        notifyUserLeaguesUpdate(cleanEmail);
    });

    socket.on('TRANSFER_ADMIN_OWNERSHIP', async ({ leagueCode, newAdminEmail }, callback) => {
        const league = data.leagues.get(leagueCode);
        if (!league) {
            if (callback) callback({ error: "League not found!" });
            return;
        }

        const senderEmail = (socket.email || socket.handshake?.query?.email || '').trim().toLowerCase();
        const isOwner = (league.adminEmail && league.adminEmail.toLowerCase() === senderEmail) || socket.id === league.adminId;
        const isSuperAdmin = socket.rooms.has('super-admin-room') || (senderEmail && data.superAdmins.has(senderEmail));

        if (!isOwner && !isSuperAdmin) {
            if (callback) callback({ error: "Unauthorized: Only the current primary Admin or Super Admin can transfer ownership." });
            return;
        }

        const cleanNewEmail = newAdminEmail?.trim().toLowerCase();
        if (!cleanNewEmail || !cleanNewEmail.includes('@')) {
            if (callback) callback({ error: "Please provide a valid email address." });
            return;
        }

        if (league.adminEmail && league.adminEmail.toLowerCase() === cleanNewEmail) {
            if (callback) callback({ error: `${cleanNewEmail} is already the primary admin of this league!` });
            return;
        }

        const oldAdminEmail = league.adminEmail;
        league.adminEmail = cleanNewEmail;

        // Remove new admin email from invitations if present to prevent redundant invite
        if (league.invitations) {
            league.invitations = league.invitations.filter(inv => inv.email.toLowerCase() !== cleanNewEmail);
        }

        const logMsg = `Admin ownership transferred from ${oldAdminEmail || 'Admin'} to ${cleanNewEmail}`;
        league.activityLog.unshift({ type: 'SYSTEM', text: logMsg });
        console.log(`[${leagueCode}][TRANSFER_ADMIN] ${logMsg}`);

        await saveSnapshot(league);
        broadcastUpdate(io, leagueCode, league);
        notifyUserLeaguesUpdate(oldAdminEmail);
        notifyUserLeaguesUpdate(cleanNewEmail);

        if (callback) callback({ success: true, newAdminEmail: cleanNewEmail });
    });

    socket.on('CHECK_INVITATION', ({ leagueCode, email }, callback) => {
        const league = data.leagues.get(leagueCode);
        if (!league) {
            if (callback) callback({ error: "League not found" });
            return;
        }

        const cleanEmail = email.trim().toLowerCase();
        const invite = league.invitations?.find(inv => inv.email === cleanEmail);
        if (!invite) {
            if (callback) callback({ error: "You have not been invited to this league!" });
            return;
        }

        if (callback) callback({ league });
    });

    socket.on('GET_MY_LEAGUES', ({ email }) => {
        if (!email) {
            socket.emit('MY_LEAGUES', { adminLeagues: [], invitedLeagues: [], isSuperAdmin: false });
            return;
        }
        const cleanEmail = email.trim().toLowerCase();
        socket.email = cleanEmail;
        const adminLeagues = [];
        const invitedLeagues = [];

        for (const league of data.leagues.values()) {
            const isOwner = league.adminEmail && league.adminEmail.toLowerCase() === cleanEmail;
            const isCoAdmin = league.invitations?.some(inv => inv.email.toLowerCase() === cleanEmail && inv.role === 'ADMIN');
            if (isOwner || isCoAdmin) {
                adminLeagues.push(league);
            } else if (league.invitations?.some(inv => inv.email.toLowerCase() === cleanEmail)) {
                invitedLeagues.push(league);
            }
        }

        const isSuperAdmin = data.superAdmins.has(cleanEmail) || data.superAdmins.size === 0 || cleanEmail === 'admin@test.com';
        socket.emit('MY_LEAGUES', { adminLeagues, invitedLeagues, isSuperAdmin });
    });

    socket.on('disconnect', async () => {
        const ip = socket.handshake.address;
        console.log(`User disconnected: ${socket.id} (IP: ${ip})`);

        // Find leagues where this socket belonged to a captain
        for (const league of data.leagues.values()) {
            const team = league.teams.find(t => t.id === socket.id);
            if (team && team.status !== 'LEFT') {
                team.status = 'LEFT';
                const logMsg = `Captain ${team.name} has left the auction`;
                league.activityLog.unshift({ type: 'SYSTEM', text: logMsg });
                console.log(`[${league.code}][DISCONNECT] ${logMsg}`);
                await saveSnapshot(league);
                broadcastUpdate(io, league.code, league);
            }
        }
    });

    function notifyUserLeaguesUpdate(email) {
        if (!email) return;
        const cleanEmail = email.trim().toLowerCase();
        for (const [sId, s] of io.of('/').sockets) {
            const socketEmail = s.email || s.handshake?.query?.email;
            if (socketEmail && socketEmail.trim().toLowerCase() === cleanEmail) {
                const adminLeagues = [];
                const invitedLeagues = [];
                for (const lg of data.leagues.values()) {
                    const isOwner = lg.adminEmail && lg.adminEmail.toLowerCase() === cleanEmail;
                    const isCoAdmin = lg.invitations?.some(inv => inv.email.toLowerCase() === cleanEmail && inv.role === 'ADMIN');
                    if (isOwner || isCoAdmin) {
                        adminLeagues.push(lg);
                    } else if (lg.invitations?.some(inv => inv.email.toLowerCase() === cleanEmail)) {
                        invitedLeagues.push(lg);
                    }
                }
                const isSA = data.superAdmins.has(cleanEmail) || data.superAdmins.size === 0 || cleanEmail === 'admin@test.com';
                s.emit('MY_LEAGUES', { adminLeagues, invitedLeagues, isSuperAdmin: isSA });
            }
        }
    }

    async function executeSoldTransaction(league, leagueCode) {
        if (!league || !league.currentBid.holderName) return;
        if (!league.currentPlayer || league.currentPlayer.status === 'SOLD') return;

        const team = league.teams.find(t => t.name === league.currentBid.holderName);
        if (!team) return;
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
        await saveSnapshot(league);

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
    }

    function broadcastUpdate(io, leagueCode, league) {
        io.to(leagueCode).emit('LEAGUE_UPDATE', {
            code: league.code,
            name: league.name,
            config: league.config,
            teams: league.teams,
            state: league.state,
            currentBid: league.currentBid,
            currentPlayer: league.currentPlayer,
            players: league.players,
            activityLog: league.activityLog || [],
            passedTeams: league.passedTeams || [],
            biddingOrder: league.biddingOrder || [],
            activeTurn: league.activeTurn || null,
            invitations: league.invitations || [],
            jackpotRun: league.jackpotRun || false
        });

        // Also broadcast update to Super Admins
        const allLeagues = Array.from(data.leagues.values());
        io.to('super-admin-room').emit('SUPER_ADMIN_UPDATE', allLeagues);
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
        league.jackpotRun = false;
        league.bidHistory = []; // Reset history for new player
        league.passedTeams = []; // Reset passed teams for new player

        // Round Robin: Rotate starting team, skipping any captains with full squads
        let foundActiveTurn = false;
        let loopCount = 0;
        while (!foundActiveTurn && loopCount < league.biddingOrder.length) {
            league.roundRobinStartIndex = (league.roundRobinStartIndex + 1) % league.biddingOrder.length;
            const nextTeamName = league.biddingOrder[league.roundRobinStartIndex];
            const team = league.teams.find(t => t.name === nextTeamName);
            if (team && team.squad.length < league.config.playersPerTeam) {
                league.activeTurn = nextTeamName;
                foundActiveTurn = true;
            }
            loopCount++;
        }
        if (!foundActiveTurn) {
            league.activeTurn = null;
        }

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

    async function findNextTurn(league, leagueCode) {
        if (!league.biddingOrder || league.biddingOrder.length === 0) return;

        let eligibleTeamsCount = 0;
        let lastEligibleTeam = null;

        for (const team of league.teams) {
            if (league.passedTeams.includes(team.name)) continue;
            const minNeed = league.currentBid.amount > 0 ? league.currentBid.amount + 1 : league.config.basePrice;
            if (team.budget < minNeed) continue;
            if (team.squad.length >= league.config.playersPerTeam) continue;

            eligibleTeamsCount++;
            lastEligibleTeam = team;
        }

        if (eligibleTeamsCount === 0 || (eligibleTeamsCount === 1 && league.currentBid.holderName && lastEligibleTeam && lastEligibleTeam.name === league.currentBid.holderName)) {
            league.activeTurn = null;
            if (league.currentBid.holderName) {
                await executeSoldTransaction(league, leagueCode);
            }
            return;
        }

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

    async function saveSnapshot(league, suffix = '') {
        try {
            const timestamp = Date.now();
            const s = suffix ? `-${suffix}` : '';
            const filename = `${league.code}-${league.name.replace(/[^a-z0-9]/gi, '_')}-${timestamp}${s}.json`;
            const backupDir = path.join(__dirname, 'backups');

            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            const filepath = path.join(backupDir, filename);

            const dataContent = JSON.stringify(league, null, 2);
            fs.writeFile(filepath, dataContent, (err) => {
                if (err) console.error(`[${league.code}] Error saving snapshot:`, err);
            });

            // --- PERSIST TO SUPABASE ---
            if (supabase) {
                const { error } = await supabase
                    .from('leagues')
                    .upsert({ code: league.code, data: league, updated_at: new Date() });

                if (error) console.error(`[${league.code}] DB Persist Error:`, error.message);
            }
        } catch (e) {
            console.error(`[${league.code}] Snapshot failed:`, e);
        }
    }
};

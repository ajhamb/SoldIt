# SoldIt - Walkthrough

Welcome to **SoldIt**, your real-time auction app!

## 🚀 How to Run

1. **Backend**: `cd server && node server.js`
2. **Frontend**: `cd client && npm run dev`

---

## 🎮 How to Play (Phase 2 Features)

### Step 1: The Auctioneer (Admin)
1. Open [http://localhost:5173](http://localhost:5173).
2. Click **Create New League**.
3. **Setup Modal**:
    - **Name**: Name your league (e.g., "IPL 2026").
    - **Team Count**: Max teams allowed.
    - **Budget**: Total purse (e.g., 5000 Lakhs).
    - **Base Price**: Default price if not specified in CSV.
    - **Upload Players**: Upload a `.csv` file. 
        - Format: `Name, Category, BasePrice (Optional)`
        - Example:
        ```csv
        Rohit Sharma, Batter, 200
        Jasprit Bumrah, Bowler, 200
        Uncapped Player, All-Rounder, 20
        ```
4. Click **Start League** and share the Code.

### Step 2: The Auction
- **Randomizer**: Players appear in **random order** automatically.
- **Controls**:
    - **SOLD**: Sell to highest bidder.
    - **SKIP**: Mark player as Unsold and move to next.
- **View List**: Admin can click "View All Players" to see who is Sold/Unsold.

### Step 3: The Captains
- Join with code and name.
- Bid using the paddles.
- **Squad Limits**: You cannot bid if your squad is full (Default: 15).

## 🎨 Features to Notice
- **Admin Dashboard**: New setup form and player list view.
- **Smart Logic**: Prevents overspending or over-filling squad.
- **Visuals**: Dark/Gold UI remains consistent.

Enjoy your customized auction! 🏏


## Misc CloudFlare hosting
- Start Tunnel cloudflared tunnel --url http://localhost:5173 
- Backend port



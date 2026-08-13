// Modren Bank - Game Bank API
// Handles game registration, player balances, permissions and purchases.

const STORAGE_KEY = "modren-bank:games";

function readGames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeGames(games) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
}

export function registerGame(gameId, gameName = gameId) {
  if (!gameId || !String(gameId).trim()) {
    throw new Error("Game ID is required");
  }

  const games = readGames();
  const id = String(gameId).trim();

  if (!games[id]) {
    games[id] = {
      id,
      name: String(gameName || id).trim(),
      players: {},
      createdAt: Date.now()
    };

    writeGames(games);
  }

  return games[id];
}

export function getGame(gameId) {
  const games = readGames();
  return games[String(gameId).trim()] || null;
}

export function addPlayer(gameId, username) {
  const games = readGames();
  const id = String(gameId).trim();
  const user = String(username).trim();

  if (!games[id]) {
    throw new Error("Game not found");
  }

  if (!user) {
    throw new Error("Username is required");
  }

  if (!games[id].players[user]) {
    games[id].players[user] = {
      username: user,
      balance: 0,
      unlimited: false,
      purchases: []
    };

    writeGames(games);
  }

  return games[id].players[user];
}

export function getPlayer(gameId, username) {
  const game = getGame(gameId);

  if (!game) return null;

  return game.players[String(username).trim()] || null;
}

export function setUnlimited(gameId, username, enabled = true) {
  const games = readGames();
  const id = String(gameId).trim();
  const user = String(username).trim();

  if (!games[id]) {
    throw new Error("Game not found");
  }

  if (!games[id].players[user]) {
    games[id].players[user] = {
      username: user,
      balance: 0,
      unlimited: false,
      purchases: []
    };
  }

  games[id].players[user].unlimited = Boolean(enabled);

  writeGames(games);

  return games[id].players[user];
}

export function addCoins(gameId, username, amount) {
  const games = readGames();
  const id = String(gameId).trim();
  const user = String(username).trim();
  const value = Number(amount);

  if (!games[id]) {
    throw new Error("Game not found");
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid coin amount");
  }

  if (!games[id].players[user]) {
    games[id].players[user] = {
      username: user,
      balance: 0,
      unlimited: false,
      purchases: []
    };
  }

  const player = games[id].players[user];

  if (!player.unlimited) {
    player.balance += value;
  }

  writeGames(games);

  return player;
}

export function spendCoins(gameId, username, amount, item = "") {
  const games = readGames();
  const id = String(gameId).trim();
  const user = String(username).trim();
  const value = Number(amount);

  if (!games[id]) {
    throw new Error("Game not found");
  }

  const player = games[id].players[user];

  if (!player) {
    throw new Error("Player not found");
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Invalid price");
  }

  if (!player.unlimited && player.balance < value) {
    throw new Error("Not enough coins");
  }

  if (!player.unlimited) {
    player.balance -= value;
  }

  player.purchases.push({
    item: String(item || ""),
    price: value,
    time: Date.now()
  });

  writeGames(games);

  return player;
}

export function canOpenGame(gameId, username) {
  const player = getPlayer(gameId, username);

  return Boolean(player);
}

export function getBalance(gameId, username) {
  const player = getPlayer(gameId, username);

  if (!player) return 0;

  if (player.unlimited) {
    return Infinity;
  }

  return Number(player.balance || 0);
}

export function getPurchases(gameId, username) {
  const player = getPlayer(gameId, username);

  return player ? [...player.purchases] : [];
}export function setPlayerUnlimited(gameId, username, unlimited = true) {
  const games = readGames();
  const id = String(gameId).trim();
  const user = String(username).trim();

  if (!games[id]) {
    throw new Error("Game not found");
  }

  if (!user) {
    throw new Error("Username is required");
  }

  if (!games[id].players[user]) {
    throw new Error("Player not found");
  }

  games[id].players[user].unlimited = Boolean(unlimited);

  writeGames(games);

  return games[id].players[user];
}

export function addPlayerPurchase(gameId, username, purchase) {
  const games = readGames();
  const id = String(gameId).trim();
  const user = String(username).trim();

  if (!games[id]) {
    throw new Error("Game not found");
  }

  if (!user) {
    throw new Error("Username is required");
  }

  if (!games[id].players[user]) {
    throw new Error("Player not found");
  }

  if (!Array.isArray(games[id].players[user].purchases)) {
    games[id].players[user].purchases = [];
  }

  games[id].players[user].purchases.push({
    ...purchase,
    purchasedAt: Date.now()
  });

  writeGames(games);

  return games[id].players[user].purchases;
}

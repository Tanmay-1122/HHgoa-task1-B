// Anonymous, no-login "ownership" — the delete token for a card the current
// browser created is stashed here. This is the only place that knowledge
// lives; if localStorage is cleared or a different device opens the card's
// public page, the delete option just won't be offered there.

const MY_CARDS_KEY = "hhgoa_my_cards"; // { [id: string]: deleteToken }

export function rememberCard(id: number, deleteToken: string) {
  try {
    const raw = localStorage.getItem(MY_CARDS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[id] = deleteToken;
    localStorage.setItem(MY_CARDS_KEY, JSON.stringify(map));
  } catch {
    /* localStorage unavailable — non-fatal, delete just won't be offered later */
  }
}

export function forgetCard(id: number) {
  try {
    const raw = localStorage.getItem(MY_CARDS_KEY);
    if (!raw) return;
    const map = JSON.parse(raw);
    delete map[id];
    localStorage.setItem(MY_CARDS_KEY, JSON.stringify(map));
  } catch {
    /* non-fatal */
  }
}

export function getMyDeleteToken(id: number): string | null {
  try {
    const raw = localStorage.getItem(MY_CARDS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[id] ?? null;
  } catch {
    return null;
  }
}

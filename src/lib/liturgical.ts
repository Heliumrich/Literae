export type LitColor = "vert" | "violet" | "blanc" | "rouge" | "rose";

export type LitDay = {
  date: string;
  title: string;
  season: string;
  color: LitColor;
  rank: "solennité" | "fête" | "mémoire" | "dimanche" | "férial";
  note?: string;
};

const COLOR_HEX: Record<LitColor, string> = {
  vert: "#2f5d3a",
  violet: "#5b3a7a",
  blanc: "#e8e0cc",
  rouge: "#8b2c2c",
  rose: "#c4849a",
};

export function liturgicalColorHex(color: LitColor) {
  return COLOR_HEX[color];
}

function iso(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function atMidnight(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function easterDate(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function adventStart(year: number) {
  const christmas = new Date(year, 11, 25);
  const dow = christmas.getDay();
  const sundayOnOrBefore = addDays(christmas, -dow);
  return addDays(sundayOnOrBefore, -21);
}

export function liturgicalDay(dateInput = new Date()): LitDay {
  const date = atMidnight(dateInput);
  const y = date.getFullYear();
  const easter = easterDate(y);
  const ash = addDays(easter, -46);
  const palm = addDays(easter, -7);
  const holyThursday = addDays(easter, -3);
  const goodFriday = addDays(easter, -2);
  const holySaturday = addDays(easter, -1);
  const ascension = addDays(easter, 39);
  const pentecost = addDays(easter, 49);
  const trinity = addDays(easter, 56);
  const corpus = addDays(easter, 60);
  const sacredHeart = addDays(easter, 68);
  const christKing = addDays(adventStart(y), -7);
  const advent = adventStart(y);
  const baptiste = new Date(y, 0, 6);
  // Baptism of the Lord: Sunday after Jan 6
  const baptism = addDays(baptiste, (7 - baptiste.getDay()) % 7 || 7);

  const key = iso(date);
  const fixed: Record<string, Omit<LitDay, "date">> = {
    [`${y}-01-01`]: { title: "Sainte Marie, Mère de Dieu", season: "Temps de Noël", color: "blanc", rank: "solennité" },
    [`${y}-01-06`]: { title: "Épiphanie du Seigneur", season: "Temps de Noël", color: "blanc", rank: "solennité" },
    [`${y}-02-02`]: { title: "Présentation du Seigneur", season: "Temps ordinaire", color: "blanc", rank: "fête" },
    [`${y}-03-19`]: { title: "Saint Joseph", season: "Temps ordinaire", color: "blanc", rank: "solennité" },
    [`${y}-03-25`]: { title: "Annonciation du Seigneur", season: "Temps ordinaire", color: "blanc", rank: "solennité" },
    [`${y}-06-24`]: { title: "Nativité de saint Jean-Baptiste", season: "Temps ordinaire", color: "blanc", rank: "solennité" },
    [`${y}-06-29`]: { title: "Saints Pierre et Paul", season: "Temps ordinaire", color: "rouge", rank: "solennité" },
    [`${y}-08-06`]: { title: "Transfiguration du Seigneur", season: "Temps ordinaire", color: "blanc", rank: "fête" },
    [`${y}-08-15`]: { title: "Assomption de la Vierge Marie", season: "Temps ordinaire", color: "blanc", rank: "solennité" },
    [`${y}-09-14`]: { title: "Exaltation de la Sainte Croix", season: "Temps ordinaire", color: "rouge", rank: "fête" },
    [`${y}-09-29`]: { title: "Saints Michel, Gabriel et Raphaël", season: "Temps ordinaire", color: "blanc", rank: "fête" },
    [`${y}-11-01`]: { title: "Toussaint", season: "Temps ordinaire", color: "blanc", rank: "solennité" },
    [`${y}-11-02`]: { title: "Commémoration des fidèles défunts", season: "Temps ordinaire", color: "violet", rank: "mémoire" },
    [`${y}-11-09`]: { title: "Dédicace de la basilique du Latran", season: "Temps ordinaire", color: "blanc", rank: "fête" },
    [`${y}-12-08`]: { title: "Immaculée Conception", season: "Avent", color: "blanc", rank: "solennité" },
    [`${y}-12-25`]: { title: "Nativité du Seigneur", season: "Temps de Noël", color: "blanc", rank: "solennité" },
    [`${y}-12-26`]: { title: "Saint Étienne, premier martyr", season: "Temps de Noël", color: "rouge", rank: "fête" },
    [`${y}-12-27`]: { title: "Saint Jean, apôtre et évangéliste", season: "Temps de Noël", color: "blanc", rank: "fête" },
    [`${y}-12-28`]: { title: "Saints Innocents", season: "Temps de Noël", color: "rouge", rank: "fête" },
    [iso(ash)]: { title: "Mercredi des Cendres", season: "Carême", color: "violet", rank: "férial", note: "Jeûne et abstinence" },
    [iso(palm)]: { title: "Dimanche des Rameaux", season: "Carême", color: "rouge", rank: "dimanche" },
    [iso(holyThursday)]: { title: "Jeudi saint", season: "Triduum pascal", color: "blanc", rank: "solennité" },
    [iso(goodFriday)]: { title: "Vendredi saint", season: "Triduum pascal", color: "rouge", rank: "solennité", note: "Jeûne et abstinence" },
    [iso(holySaturday)]: { title: "Samedi saint / Vigile pascale", season: "Triduum pascal", color: "blanc", rank: "solennité" },
    [iso(easter)]: { title: "Résurrection du Seigneur", season: "Temps pascal", color: "blanc", rank: "solennité" },
    [iso(ascension)]: { title: "Ascension du Seigneur", season: "Temps pascal", color: "blanc", rank: "solennité" },
    [iso(pentecost)]: { title: "Pentecôte", season: "Temps pascal", color: "rouge", rank: "solennité" },
    [iso(trinity)]: { title: "Sainte Trinité", season: "Temps ordinaire", color: "blanc", rank: "solennité" },
    [iso(corpus)]: { title: "Saint-Sacrement (Fête-Dieu)", season: "Temps ordinaire", color: "blanc", rank: "solennité" },
    [iso(sacredHeart)]: { title: "Sacré-Cœur de Jésus", season: "Temps ordinaire", color: "blanc", rank: "solennité" },
    [iso(christKing)]: { title: "Christ Roi de l’univers", season: "Temps ordinaire", color: "blanc", rank: "solennité" },
    [iso(baptism)]: { title: "Baptême du Seigneur", season: "Temps de Noël", color: "blanc", rank: "fête" },
    [`${y}-08-28`]: { title: "Saint Augustin, évêque et docteur", season: "Temps ordinaire", color: "blanc", rank: "mémoire" },
  };

  if (fixed[key]) return { date: key, ...fixed[key]! };

  const t = date.getTime();
  const sunday = date.getDay() === 0;

  if (t >= advent.getTime() && t < new Date(y, 11, 25).getTime()) {
    const gaudete = addDays(advent, 14);
    const rose = iso(date) === iso(gaudete);
    return {
      date: key,
      title: rose ? "3e dimanche de l’Avent (Gaudete)" : sunday ? "Dimanche de l’Avent" : "Férie de l’Avent",
      season: "Avent",
      color: rose ? "rose" : "violet",
      rank: sunday ? "dimanche" : "férial",
    };
  }
  if (t >= new Date(y, 11, 25).getTime() || t < baptism.getTime()) {
    return {
      date: key,
      title: sunday ? "Dimanche du temps de Noël" : "Férie du temps de Noël",
      season: "Temps de Noël",
      color: "blanc",
      rank: sunday ? "dimanche" : "férial",
    };
  }
  if (t >= ash.getTime() && t < palm.getTime()) {
    const laetare = addDays(easter, -21);
    const rose = iso(date) === iso(laetare);
    return {
      date: key,
      title: rose ? "4e dimanche de Carême (Lætare)" : sunday ? "Dimanche de Carême" : "Férie de Carême",
      season: "Carême",
      color: rose ? "rose" : "violet",
      rank: sunday ? "dimanche" : "férial",
    };
  }
  if (t > easter.getTime() && t < pentecost.getTime()) {
    return {
      date: key,
      title: sunday ? "Dimanche de Pâques" : "Férie du temps pascal",
      season: "Temps pascal",
      color: "blanc",
      rank: sunday ? "dimanche" : "férial",
    };
  }
  return {
    date: key,
    title: sunday ? "Dimanche du temps ordinaire" : "Férie du temps ordinaire",
    season: "Temps ordinaire",
    color: "vert",
    rank: sunday ? "dimanche" : "férial",
  };
}

export function monthCalendar(year: number, month: number): LitDay[] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => liturgicalDay(new Date(year, month, i + 1))).map((d, i) => ({
    ...d,
    date: iso(new Date(first.getFullYear(), first.getMonth(), i + 1)),
  }));
}

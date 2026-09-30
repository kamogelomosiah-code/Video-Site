/**
 * High-performance search and relevance ranking engine.
 * Implements multi-token weighted matching, synonym expansion,
 * typo tolerance (Levenshtein distance), field weighting,
 * token coverage synergy, and popularity priors.
 */

import { MediaItem, TalentProfile } from '../types';

export interface ScoredMediaItem extends MediaItem {
  score: number;
  matchReasons: string[];
  matchedField?: string;
}

export interface ScoredTalentProfile extends TalentProfile {
  score: number;
  matchReasons: string[];
  matchedField?: string;
}

export interface SearchOptions {
  type?: 'all' | 'media' | 'talent';
  category?: string;
  location?: string;
  sort?: 'relevance' | 'views' | 'rating' | 'newest';
  minRating?: number;
  verifiedOnly?: boolean;
  limit?: number;
}

export interface SearchResult {
  media: ScoredMediaItem[];
  talent: ScoredTalentProfile[];
  total: number;
  tookMs: number;
  query: string;
  suggestions: string[];
}

// Common South African geographic & content synonyms
const SYNONYM_MAP: Record<string, string[]> = {
  cpt: ['cape', 'town', 'capetown'],
  kaapstad: ['cape', 'town'],
  jhb: ['johannesburg', 'joburg', 'jozi', 'gauteng'],
  joburg: ['johannesburg', 'jhb'],
  jozi: ['johannesburg', 'jhb'],
  dbn: ['durban', 'ethekwini', 'kwazulu'],
  pta: ['pretoria', 'tshwane'],
  tshwane: ['pretoria', 'pta'],
  sandton: ['sandton', 'johannesburg'],
  gauteng: ['johannesburg', 'pretoria', 'sandton'],
  '4k': ['uhd', 'hd', 'ultra', '1080p'],
  uhd: ['4k', 'hd'],
  hd: ['4k', 'uhd'],
  bts: ['behind', 'scenes', 'backstage'],
  vr: ['360', 'virtual', 'immersive'],
  '360': ['vr', 'panoramic'],
  milf: ['mom', 'stepmom', 'mature'],
  stepmom: ['milf', 'mom'],
  model: ['talent', 'creator', 'performer'],
  creator: ['model', 'talent', 'verified'],
  talent: ['creator', 'model', 'professional'],
  party: ['parties', 'events', 'club', 'nightlife', 'vip'],
  events: ['party', 'parties', 'functions'],
  shoot: ['photo', 'photoshoot', 'video', 'filming'],
  cam: ['chat', 'live', 'messages'],
};

// Common stopwords to reduce false positive saturation
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'or', 'me', 'my'
]);

/**
 * Normalizes a string: removes accents, converts to lowercase, removes punctuation
 */
export function normalizeText(str: string = ''): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits query into clean tokens, filtering out trivial single characters
 */
export function tokenize(str: string): string[] {
  const norm = normalizeText(str);
  if (!norm) return [];
  return norm.split(' ').filter(t => t.length > 0);
}

/**
 * Expands tokens with known domain synonyms
 */
export function expandTokens(tokens: string[]): { original: string[]; expanded: string[] } {
  const expandedSet = new Set<string>();
  for (const token of tokens) {
    expandedSet.add(token);
    const syns = SYNONYM_MAP[token];
    if (syns) {
      syns.forEach(s => expandedSet.add(s));
    }
  }
  return {
    original: tokens,
    expanded: Array.from(expandedSet)
  };
}

/**
 * Damerau-Levenshtein distance calculation for typo tolerance
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const al = a.length;
  const bl = b.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= al; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bl; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let min = Math.min(
        matrix[i - 1][j] + 1,       // deletion
        matrix[i][j - 1] + 1,       // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        min = Math.min(min, matrix[i - 2][j - 2] + 1);
      }

      matrix[i][j] = min;
    }
  }

  return matrix[al][bl];
}

/**
 * Checks similarity between a query token and a candidate word
 */
function tokenMatchScore(queryToken: string, candidateWord: string): { score: number; matchType: 'exact' | 'prefix' | 'fuzzy' | 'none' } {
  if (!queryToken || !candidateWord) return { score: 0, matchType: 'none' };
  
  if (queryToken === candidateWord) {
    return { score: 1.0, matchType: 'exact' };
  }

  // Prefix match (e.g. 'therap' matches 'therapist')
  if (candidateWord.startsWith(queryToken) && queryToken.length >= 3) {
    const ratio = queryToken.length / candidateWord.length;
    return { score: Math.max(0.7, ratio), matchType: 'prefix' };
  }

  // Substring match
  if (candidateWord.includes(queryToken) && queryToken.length >= 3) {
    return { score: 0.6, matchType: 'prefix' };
  }

  // Typo tolerance for words with length >= 4
  // For 4-5 letter words, require first character to match to prevent false rhyming positives (e.g. town/down, cape/came)
  if (queryToken.length >= 4 && candidateWord.length >= 4) {
    const sameFirstLetter = queryToken[0] === candidateWord[0];
    if (queryToken.length <= 5 && !sameFirstLetter) {
      return { score: 0, matchType: 'none' };
    }
    const maxDist = queryToken.length >= 8 ? 2 : 1;
    const dist = levenshteinDistance(queryToken, candidateWord);
    if (dist <= maxDist) {
      const fuzzyScore = dist === 1 ? 0.65 : 0.4;
      return { score: fuzzyScore, matchType: 'fuzzy' };
    }
  }

  return { score: 0, matchType: 'none' };
}

/**
 * Scores a single field string against search query tokens
 */
function scoreField(
  fieldContent: string,
  fieldWeight: number,
  tokens: string[],
  fullQuery: string,
  fieldName: string
): { fieldScore: number; matchedTokens: Set<string>; reasons: string[] } {
  if (!fieldContent) return { fieldScore: 0, matchedTokens: new Set(), reasons: [] };

  const normField = normalizeText(fieldContent);
  const fieldWords = normField.split(' ').filter(Boolean);
  const matchedTokens = new Set<string>();
  const reasons: string[] = [];
  let fieldScore = 0;

  // Exact full query substring bonus
  if (fullQuery && normField.includes(fullQuery) && fullQuery.length >= 3) {
    fieldScore += 30 * fieldWeight;
    reasons.push(`Exact phrase match in ${fieldName}: "${fieldContent.slice(0, 45)}"`);
  }

  // Token-level scoring
  for (const token of tokens) {
    if (STOPWORDS.has(token) && tokens.length > 1) {
      continue;
    }

    let bestTokenScore = 0;
    let bestWord = '';
    let matchType = 'none';

    for (const word of fieldWords) {
      const res = tokenMatchScore(token, word);
      if (res.score > bestTokenScore) {
        bestTokenScore = res.score;
        bestWord = word;
        matchType = res.matchType;
      }
      if (bestTokenScore >= 1.0) break; // Maximum possible for this token
    }

    if (bestTokenScore > 0) {
      matchedTokens.add(token);
      const points = bestTokenScore * 10 * fieldWeight;
      fieldScore += points;
      
      if (matchType === 'exact') {
        reasons.push(`${fieldName}: matched "${token}"`);
      } else if (matchType === 'prefix') {
        reasons.push(`${fieldName}: "${token}" matched in "${bestWord}"`);
      } else if (matchType === 'fuzzy') {
        reasons.push(`${fieldName}: typo match "${token}" ~ "${bestWord}"`);
      }
    }
  }

  return { fieldScore, matchedTokens, reasons };
}

/**
 * Scores a MediaItem based on relevance to query
 */
export function scoreMediaItem(item: MediaItem, rawQuery: string): ScoredMediaItem | null {
  const normQuery = normalizeText(rawQuery);
  const queryTokens = tokenize(normQuery);
  if (queryTokens.length === 0) return null;

  const { original, expanded } = expandTokens(queryTokens);
  const allReasons: string[] = [];
  const matchedQueryTokens = new Set<string>();
  let totalScore = 0;

  // 1. Title (Weight: 6.0)
  const titleRes = scoreField(item.title, 6.0, expanded, normQuery, 'Title');
  totalScore += titleRes.fieldScore;
  titleRes.reasons.forEach(r => allReasons.push(r));
  titleRes.matchedTokens.forEach(t => matchedQueryTokens.add(t));

  // 2. Tags (Weight: 5.0)
  if (Array.isArray(item.tags) && item.tags.length > 0) {
    const tagsString = item.tags.join(' ');
    const tagRes = scoreField(tagsString, 5.0, expanded, normQuery, 'Tag');
    totalScore += tagRes.fieldScore;
    tagRes.reasons.forEach(r => allReasons.push(r));
    tagRes.matchedTokens.forEach(t => matchedQueryTokens.add(t));
  }

  // 3. Creator Name (Weight: 4.5)
  if (item.creatorName) {
    const creatorRes = scoreField(item.creatorName, 4.5, expanded, normQuery, 'Creator');
    totalScore += creatorRes.fieldScore;
    creatorRes.reasons.forEach(r => allReasons.push(r));
    creatorRes.matchedTokens.forEach(t => matchedQueryTokens.add(t));
  }

  // 4. Description (Weight: 2.0)
  if (item.description) {
    const descRes = scoreField(item.description, 2.0, expanded, normQuery, 'Description');
    totalScore += descRes.fieldScore;
    descRes.reasons.slice(0, 2).forEach(r => allReasons.push(r));
    descRes.matchedTokens.forEach(t => matchedQueryTokens.add(t));
  }

  // If no tokens matched at all, item is irrelevant
  if (totalScore <= 0 || matchedQueryTokens.size === 0) {
    return null;
  }

  // Token coverage multiplier (Reward items that match multiple words in the query)
  const coverageRatio = matchedQueryTokens.size / original.length;
  if (original.length > 1) {
    if (coverageRatio >= 1.0) {
      totalScore *= 1.8; // Full conjunction bonus!
    } else if (coverageRatio >= 0.5) {
      totalScore *= 1.25;
    }
  }

  // Quality & Popularity signals (PageRank / Engagement boost)
  const viewCount = Number(item.views) || 0;
  if (viewCount > 0) {
    const viewBoost = Math.min(25, Math.log10(viewCount + 1) * 4);
    totalScore += viewBoost;
  }

  if (item.isPremium) {
    totalScore += 2;
  }

  // Primary matched field determination
  let matchedField = 'Content';
  if (titleRes.fieldScore > 0) matchedField = 'Title';
  else if (item.creatorName && allReasons.some(r => r.startsWith('Creator'))) matchedField = 'Creator';
  else if (allReasons.some(r => r.startsWith('Tag'))) matchedField = 'Tag';

  return {
    ...item,
    score: Math.round(totalScore * 10) / 10,
    matchReasons: allReasons.slice(0, 4),
    matchedField
  };
}

/**
 * Scores a TalentProfile based on relevance to query
 */
export function scoreTalentProfile(talent: TalentProfile, rawQuery: string): ScoredTalentProfile | null {
  const normQuery = normalizeText(rawQuery);
  const queryTokens = tokenize(normQuery);
  if (queryTokens.length === 0) return null;

  const { original, expanded } = expandTokens(queryTokens);
  const allReasons: string[] = [];
  const matchedQueryTokens = new Set<string>();
  let totalScore = 0;

  // 1. Name (Weight: 6.0)
  const nameRes = scoreField(talent.name, 6.0, expanded, normQuery, 'Name');
  totalScore += nameRes.fieldScore;
  nameRes.reasons.forEach(r => allReasons.push(r));
  nameRes.matchedTokens.forEach(t => matchedQueryTokens.add(t));

  // 2. Location (City / Province) (Weight: 5.0)
  if (talent.location) {
    const locRes = scoreField(talent.location, 5.0, expanded, normQuery, 'Location');
    totalScore += locRes.fieldScore;
    locRes.reasons.forEach(r => allReasons.push(r));
    locRes.matchedTokens.forEach(t => matchedQueryTokens.add(t));
  }

  // 3. Tags & Specialties (Weight: 4.5)
  if (Array.isArray(talent.tags) && talent.tags.length > 0) {
    const tagsRes = scoreField(talent.tags.join(' '), 4.5, expanded, normQuery, 'Tag');
    totalScore += tagsRes.fieldScore;
    tagsRes.reasons.forEach(r => allReasons.push(r));
    tagsRes.matchedTokens.forEach(t => matchedQueryTokens.add(t));
  }

  // 4. Title / Headline (Weight: 4.0)
  if (talent.title) {
    const titleRes = scoreField(talent.title, 4.0, expanded, normQuery, 'Headline');
    totalScore += titleRes.fieldScore;
    titleRes.reasons.forEach(r => allReasons.push(r));
    titleRes.matchedTokens.forEach(t => matchedQueryTokens.add(t));
  }

  // 5. Products / Services offerings (Weight: 3.0)
  if (Array.isArray(talent.products) && talent.products.length > 0) {
    const prodNames = talent.products.map(p => `${p.name} ${p.description || ''}`).join(' ');
    const prodRes = scoreField(prodNames, 3.0, expanded, normQuery, 'Service');
    totalScore += prodRes.fieldScore;
    prodRes.reasons.slice(0, 2).forEach(r => allReasons.push(r));
    prodRes.matchedTokens.forEach(t => matchedQueryTokens.add(t));
  }

  // 6. Bio / Description (if available in any extended field)
  const bio = (talent as any).bio || '';
  if (bio) {
    const bioRes = scoreField(bio, 2.0, expanded, normQuery, 'Bio');
    totalScore += bioRes.fieldScore;
    bioRes.reasons.slice(0, 2).forEach(r => allReasons.push(r));
    bioRes.matchedTokens.forEach(t => matchedQueryTokens.add(t));
  }

  if (totalScore <= 0 || matchedQueryTokens.size === 0) {
    return null;
  }

  // Multi-token coverage boost
  const coverageRatio = matchedQueryTokens.size / original.length;
  if (original.length > 1) {
    if (coverageRatio >= 1.0) {
      totalScore *= 1.8;
    } else if (coverageRatio >= 0.5) {
      totalScore *= 1.25;
    }
  }

  // Trust & Verification Boost
  if (talent.verified) {
    totalScore += 15;
  }
  if (talent.online || talent.chatOnline) {
    totalScore += 8;
  }
  if (talent.availability === 'Available Now') {
    totalScore += 6;
  }
  if (talent.rating > 0) {
    totalScore += Math.min(15, (talent.rating / 5) * 12);
  }

  let matchedField = 'Talent';
  if (nameRes.fieldScore > 0) matchedField = 'Name';
  else if (allReasons.some(r => r.startsWith('Location'))) matchedField = 'Location';
  else if (allReasons.some(r => r.startsWith('Tag'))) matchedField = 'Tag';

  return {
    ...talent,
    score: Math.round(totalScore * 10) / 10,
    matchReasons: allReasons.slice(0, 4),
    matchedField
  };
}

/**
 * Executes full optimized search across media and talent collections
 */
export function executeSearch(
  mediaList: MediaItem[],
  talentList: TalentProfile[],
  query: string,
  options: SearchOptions = {}
): SearchResult {
  const startTime = Date.now();
  const trimmedQuery = (query || '').trim();

  if (!trimmedQuery) {
    return {
      media: [],
      talent: [],
      total: 0,
      tookMs: Date.now() - startTime,
      query: '',
      suggestions: generateTrendingSuggestions(mediaList, talentList)
    };
  }

  const {
    type = 'all',
    category,
    location,
    sort = 'relevance',
    minRating,
    verifiedOnly,
    limit = 50
  } = options;

  let scoredMedia: ScoredMediaItem[] = [];
  let scoredTalent: ScoredTalentProfile[] = [];

  // 1. Process Media Items
  if (type === 'all' || type === 'media') {
    for (const item of mediaList) {
      if (category && category !== 'all') {
        const itemCat = (item as any).category?.toLowerCase();
        const itemTags = Array.isArray(item.tags) ? item.tags.map(t => t.toLowerCase()) : [];
        if (itemCat !== category.toLowerCase() && !itemTags.includes(category.toLowerCase())) {
          continue;
        }
      }

      const scored = scoreMediaItem(item, trimmedQuery);
      if (scored) {
        scoredMedia.push(scored);
      }
    }
  }

  // 2. Process Talent Items
  if (type === 'all' || type === 'talent') {
    for (const talent of talentList) {
      if (location && talent.location) {
        if (!normalizeText(talent.location).includes(normalizeText(location))) {
          continue;
        }
      }
      if (verifiedOnly && !talent.verified) {
        continue;
      }
      if (minRating && (talent.rating || 0) < minRating) {
        continue;
      }

      const scored = scoreTalentProfile(talent, trimmedQuery);
      if (scored) {
        scoredTalent.push(scored);
      }
    }
  }

  // 3. Sorting logic
  const sortComparator = (a: { score: number; [key: string]: any }, b: { score: number; [key: string]: any }) => {
    if (sort === 'views') {
      const viewsA = Number(a.views) || 0;
      const viewsB = Number(b.views) || 0;
      if (viewsB !== viewsA) return viewsB - viewsA;
    } else if (sort === 'rating') {
      const ratingA = Number(a.rating) || 0;
      const ratingB = Number(b.rating) || 0;
      if (ratingB !== ratingA) return ratingB - ratingA;
    } else if (sort === 'newest') {
      const dateA = new Date(a.uploadedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.uploadedAt || b.createdAt || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
    }
    // Default: Relevance score descending
    return b.score - a.score;
  };

  scoredMedia.sort(sortComparator);
  scoredTalent.sort(sortComparator);

  const finalMedia = scoredMedia.slice(0, limit);
  const finalTalent = scoredTalent.slice(0, limit);
  const total = finalMedia.length + finalTalent.length;

  // 4. Generate intelligent suggestions if results are low or empty
  let suggestions: string[] = [];
  if (total < 3) {
    suggestions = generateSpellingAndTopicSuggestions(trimmedQuery, mediaList, talentList);
  }

  return {
    media: finalMedia,
    talent: finalTalent,
    total,
    tookMs: Date.now() - startTime,
    query: trimmedQuery,
    suggestions
  };
}

/**
 * Generates spelling & alternative suggestions for queries with few results
 */
function generateSpellingAndTopicSuggestions(
  query: string,
  mediaList: MediaItem[],
  talentList: TalentProfile[]
): string[] {
  const normQuery = normalizeText(query);
  const queryWords = normQuery.split(' ').filter(Boolean);
  const candidates = new Set<string>();

  // Extract common vocabulary
  for (const m of mediaList.slice(0, 30)) {
    if (m.creatorName) candidates.add(m.creatorName);
    if (Array.isArray(m.tags)) m.tags.slice(0, 4).forEach(t => candidates.add(t));
  }
  for (const t of talentList.slice(0, 30)) {
    if (t.name) candidates.add(t.name);
    if (t.location) candidates.add(t.location.split(',')[0].trim());
    if (Array.isArray(t.tags)) t.tags.slice(0, 3).forEach(tag => candidates.add(tag));
  }

  const matches: Array<{ term: string; dist: number }> = [];
  for (const word of queryWords) {
    if (word.length < 3) continue;
    for (const cand of candidates) {
      const normCand = normalizeText(cand);
      const dist = levenshteinDistance(word, normCand);
      if (dist <= 2 && dist > 0) {
        matches.push({ term: cand, dist });
      }
    }
  }

  matches.sort((a, b) => a.dist - b.dist);
  const suggestions = Array.from(new Set(matches.map(m => m.term))).slice(0, 4);

  // If no spelling match, suggest trending topics
  if (suggestions.length === 0) {
    return ['Cape Town', '4K UHD', 'Melony Melons', 'Johannesburg', 'Exclusive', 'Behind The Scenes'];
  }

  return suggestions;
}

/**
 * Returns popular trending searches for empty queries
 */
function generateTrendingSuggestions(mediaList: MediaItem[], talentList: TalentProfile[]): string[] {
  const trending = ['Cape Town', '4K Ultra HD', 'Melony Melons', 'Johannesburg', 'Exclusive', 'Available Now'];
  if (mediaList.length > 0 && mediaList[0].creatorName) {
    trending.push(mediaList[0].creatorName);
  }
  return Array.from(new Set(trending)).slice(0, 6);
}

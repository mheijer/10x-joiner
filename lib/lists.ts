// Saved lists: a user flags companies into named lists ("Interviewing", "Boston fintech"), saved with their profile.
// Pure helpers; the profile hook persists them.
export interface SavedList {
  id: string;
  name: string;
  company_ids: string[];
  created_at: string;
}

const newId = () => `l_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createList(lists: SavedList[], name: string, firstCompanyId?: string): SavedList[] {
  const clean = name.trim().slice(0, 60);
  if (!clean) return lists;
  const existing = lists.find((l) => l.name.toLowerCase() === clean.toLowerCase());
  if (existing) return firstCompanyId ? setMembership(lists, existing.id, firstCompanyId, true) : lists;
  return [...lists, { id: newId(), name: clean, company_ids: firstCompanyId ? [firstCompanyId] : [], created_at: new Date().toISOString() }];
}

export function setMembership(lists: SavedList[], listId: string, companyId: string, member: boolean): SavedList[] {
  return lists.map((l) =>
    l.id !== listId
      ? l
      : { ...l, company_ids: member ? [...new Set([...l.company_ids, companyId])] : l.company_ids.filter((x) => x !== companyId) },
  );
}

export const renameList = (lists: SavedList[], listId: string, name: string): SavedList[] =>
  name.trim() ? lists.map((l) => (l.id === listId ? { ...l, name: name.trim().slice(0, 60) } : l)) : lists;

export const deleteList = (lists: SavedList[], listId: string): SavedList[] => lists.filter((l) => l.id !== listId);

export const listsFor = (lists: SavedList[], companyId: string): SavedList[] => lists.filter((l) => l.company_ids.includes(companyId));

import Dexie from 'dexie';
import { phones } from '../data/phones.js';

export const db = new Dexie('AetherPhoneDB');
db.version(1).stores({
  phones: 'id, brand, model, released',
  favorites: 'id',
  compare: 'id',
  meta: 'key'
});

export async function initDB(){
  const count = await db.phones.count();
  if(count === 0){
    await db.phones.bulkPut(phones);
    await db.meta.put({key:'seedVersion', value:'1.0', updated: new Date().toISOString()});
    await db.meta.put({key:'totalDevices', value: phones.length});
  } else if(count !== phones.length){
    // sync delta
    await db.phones.bulkPut(phones);
  }
  return count;
}

export async function getAllPhones(){
  return await db.phones.toArray();
}
export async function toggleFavorite(id){
  const exists = await db.favorites.get(id);
  if(exists) await db.favorites.delete(id);
  else await db.favorites.put({id, ts: Date.now()});
  return !exists;
}
export async function getFavorites(){
  const favs = await db.favorites.toArray();
  const ids = new Set(favs.map(f=>f.id));
  const all = await db.phones.toArray();
  return all.filter(p=>ids.has(p.id));
}
export async function getCompareIds(){
  const c = await db.compare.toArray();
  return c.map(x=>x.id);
}
export async function toggleCompare(id){
  const exists = await db.compare.get(id);
  if(exists){ await db.compare.delete(id); return false; }
  else {
    const current = await db.compare.count();
    if(current >= 4) throw new Error('Max 4 devices in comparison');
    await db.compare.put({id, ts: Date.now()});
    return true;
  }
}
export async function clearCompare(){ await db.compare.clear(); }

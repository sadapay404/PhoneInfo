import Dexie from 'dexie';
import { catalog } from '../data/catalog.js';

export const db = new Dexie('AetherPhoneDB');
db.version(2).stores({
  phones: 'id, brand, model, released, brand, year',
  favorites: 'id',
  compare: 'id',
  meta: 'key'
});

export async function initDB(){
  const count = await db.phones.count();
  // Always sync to latest catalog (handles adds)
  if(count === 0){
    await db.phones.bulkPut(catalog);
    await db.meta.put({key:'seedVersion', value:'2.0', updated: new Date().toISOString()});
    await db.meta.put({key:'totalDevices', value: catalog.length});
  } else if(count !== catalog.length){
    await db.phones.bulkPut(catalog);
    await db.meta.put({key:'totalDevices', value: catalog.length});
  }
  return await db.phones.count();
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

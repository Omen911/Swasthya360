// Local Mock Firebase implementation using localStorage
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('Mock Firestore Error: ', error, operationType, path);
}

export type User = {
  uid: string;
  displayName: string | null;
  email: string | null;
};

// --- Mock Auth ---
export const auth = {
  currentUser: JSON.parse(localStorage.getItem('swasthya_user') || 'null') as User | null,
};

const authListeners: ((user: User | null) => void)[] = [];

export const onAuthStateChanged = (authObj: any, callback: (user: User | null) => void) => {
  authListeners.push(callback);
  setTimeout(() => callback(auth.currentUser), 0);
  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx > -1) authListeners.splice(idx, 1);
  };
};

export const signIn = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const user: User = { 
        uid: 'local-user-' + Math.floor(Math.random() * 10000), 
        displayName: 'Guest User', 
        email: 'guest@example.com' 
      };
      localStorage.setItem('swasthya_user', JSON.stringify(user));
      auth.currentUser = user;
      authListeners.forEach(l => l(user));
      resolve({ user });
    }, 800);
  });
};

export const signInRedirect = signIn;

export const logOut = async () => {
  localStorage.removeItem('swasthya_user');
  auth.currentUser = null;
  authListeners.forEach(l => l(null));
};

export const getRedirectResult = async (authObj?: any) => null;

// --- Mock Firestore ---
export const db = {};

const getLocalData = () => JSON.parse(localStorage.getItem('swasthya_db') || '{}');
const setLocalData = (data: any) => localStorage.setItem('swasthya_db', JSON.stringify(data));

export const doc = (dbObj: any, ...path: string[]) => ({ path: path.join('/') });
export const collection = (dbObj: any, ...path: string[]) => ({ path: path.join('/') });

const snapshotListeners: Record<string, any[]> = {};

const triggerSnapshot = (path: string) => {
  // trigger exact doc matches
  if (snapshotListeners[path]) {
    const dbData = getLocalData();
    const data = dbData[path];
    snapshotListeners[path].forEach(cb => cb({
      exists: () => !!data,
      data: () => data,
      id: path.split('/').pop()
    }));
  }
  // trigger collection matches
  const parentPath = path.split('/').slice(0, -1).join('/');
  if (snapshotListeners[parentPath]) {
    const dbData = getLocalData();
    const docs = Object.keys(dbData)
      .filter(k => k.startsWith(parentPath + '/') && k.split('/').length === parentPath.split('/').length + 1)
      .map(k => ({ id: k.split('/').pop(), data: () => dbData[k] }));
    
    snapshotListeners[parentPath].forEach(cb => cb({
      docs
    }));
  }
};

export const setDoc = async (docRef: any, data: any, options?: any) => {
  const dbData = getLocalData();
  if (options?.merge) {
    dbData[docRef.path] = { ...(dbData[docRef.path] || {}), ...data };
  } else {
    dbData[docRef.path] = data;
  }
  setLocalData(dbData);
  triggerSnapshot(docRef.path);
};

export const addDoc = async (collRef: any, data: any) => {
  const id = Math.random().toString(36).substring(2, 9);
  const path = `${collRef.path}/${id}`;
  const dbData = getLocalData();
  dbData[path] = data;
  setLocalData(dbData);
  triggerSnapshot(collRef.path);
  return { id, path };
};

export const query = (collRef: any, ...args: any[]) => ({ ...collRef, queryArgs: args });
export const orderBy = (field: string, dir: string) => ({ type: 'orderBy', field, dir });
export const limit = (num: number) => ({ type: 'limit', num });

export const onSnapshot = (ref: any, callback: any, onError?: any) => {
  const path = ref.path;
  if (!snapshotListeners[path]) snapshotListeners[path] = [];
  snapshotListeners[path].push(callback);
  
  // Initial trigger
  setTimeout(() => {
    const dbData = getLocalData();
    if (path.split('/').length % 2 === 0) {
      // Document
      const data = dbData[path];
      callback({
        exists: () => !!data,
        data: () => data,
        id: path.split('/').pop()
      });
    } else {
      // Collection
      let docs = Object.keys(dbData)
        .filter(k => k.startsWith(path + '/') && k.split('/').length === path.split('/').length + 1)
        .map(k => ({ id: k.split('/').pop(), data: () => dbData[k] }));
      
      // Handle simple orderBy (mock)
      if (ref.queryArgs) {
        const order = ref.queryArgs.find((a: any) => a.type === 'orderBy');
        if (order) {
          docs.sort((a, b) => {
            const valA = a.data()[order.field];
            const valB = b.data()[order.field];
            if (valA < valB) return order.dir === 'asc' ? -1 : 1;
            if (valA > valB) return order.dir === 'asc' ? 1 : -1;
            return 0;
          });
        }
        const lim = ref.queryArgs.find((a: any) => a.type === 'limit');
        if (lim) {
          docs = docs.slice(0, lim.num);
        }
      }

      callback({ docs });
    }
  }, 0);

  return () => {
    const idx = snapshotListeners[path].indexOf(callback);
    if (idx > -1) snapshotListeners[path].splice(idx, 1);
  };
};

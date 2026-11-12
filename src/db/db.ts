const DB_NAME = 'habitos'
const DB_VERSION = 1

export const STORE_HABITS = 'habits'
export const STORE_CHECKINS = 'checkins'

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_HABITS)) {
        db.createObjectStore(STORE_HABITS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_CHECKINS)) {
        db.createObjectStore(STORE_CHECKINS, { keyPath: ['habitId', 'date'] })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB'))
    request.onblocked = () => reject(new Error('IndexedDB está bloqueada por otra pestaña'))
  })

  return dbPromise
}

function run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode)
        const request = action(transaction.objectStore(storeName))
        transaction.oncomplete = () => resolve(request.result)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      }),
  )
}

export function getAll<T>(storeName: string): Promise<T[]> {
  return run<T[]>(storeName, 'readonly', (store) => store.getAll() as IDBRequest<T[]>)
}

export function put<T>(storeName: string, value: T): Promise<IDBValidKey> {
  return run<IDBValidKey>(storeName, 'readwrite', (store) => store.put(value))
}

export function remove(storeName: string, key: IDBValidKey): Promise<undefined> {
  return run<undefined>(storeName, 'readwrite', (store) => store.delete(key) as IDBRequest<undefined>)
}

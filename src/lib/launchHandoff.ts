const DB_NAME = 'platinum-web-launch-handoff'
const STORE_NAME = 'pending-roms'
const PENDING_ROM_KEY = 'pending-randomized-rom'

export interface PendingRandomizedRom {
  fileName: string
  sourceLabel: string
  fileData: Uint8Array
}

interface PendingRandomizedRomRecord {
  key: string
  fileName: string
  sourceLabel: string
  fileData: Blob
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1)

    request.onerror = () => {
      reject(request.error ?? new Error('Could not open launch handoff storage.'))
    }

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, finish: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  const database = await openDatabase()

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    let pendingValue: T | undefined
    let hasPendingValue = false

    transaction.oncomplete = () => {
      if (hasPendingValue) {
        resolve(pendingValue as T)
      }
      database.close()
    }
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('Launch handoff storage failed.'))
      database.close()
    }
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('Launch handoff storage was aborted.'))
      database.close()
    }

    run(
      store,
      (value) => {
        pendingValue = value
        hasPendingValue = true
      },
      reject,
    )
  })
}

export async function savePendingRandomizedRom(payload: PendingRandomizedRom): Promise<void> {
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const copiedBytes = payload.fileData.slice()
    const record: PendingRandomizedRomRecord = {
      key: PENDING_ROM_KEY,
      fileName: payload.fileName,
      sourceLabel: payload.sourceLabel,
      fileData: new Blob([copiedBytes.buffer as ArrayBuffer], { type: 'application/octet-stream' }),
    }
    const request = store.put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Could not save the pending randomized ROM.'))
  })
}

export async function loadPendingRandomizedRom(): Promise<PendingRandomizedRom | null> {
  const record = await withStore<PendingRandomizedRomRecord | null>('readonly', (store, finish, reject) => {
    const request = store.get(PENDING_ROM_KEY)

    request.onsuccess = () => {
      finish((request.result as PendingRandomizedRomRecord | undefined) ?? null)
    }

    request.onerror = () => reject(request.error ?? new Error('Could not read the pending randomized ROM.'))
  })

  if (!record) {
    return null
  }

  return {
    fileName: record.fileName,
    sourceLabel: record.sourceLabel,
    fileData: new Uint8Array(await record.fileData.arrayBuffer()),
  }
}

export async function clearPendingRandomizedRom(): Promise<void> {
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(PENDING_ROM_KEY)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Could not clear the pending randomized ROM.'))
  })
}

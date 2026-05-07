// js/libs/pdf_storage.js
/**
 * Utility for storing PDF files in IndexedDB to persist across page refreshes.
 */
window.PDFStorage = {
  DB_NAME: 'NexAI_PDF_Storage',
  DB_VERSION: 1,
  STORE_NAME: 'invoices',

  _db: null,

  init: function() {
    return new Promise((resolve, reject) => {
      if (this._db) return resolve(this._db);

      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve(this._db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  },

  /**
   * Saves a PDF file (Blob or File) to IndexedDB.
   * @param {string} id - The unique invoice ID.
   * @param {Blob|File} file - The PDF file.
   */
  savePDF: async function(id, file) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(file, id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Retrieves a PDF file from IndexedDB.
   * @param {string} id - The invoice ID.
   * @returns {Promise<Blob|null>}
   */
  getPDF: async function(id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Deletes a PDF file from IndexedDB.
   * @param {string} id - The invoice ID.
   */
  deletePDF: async function(id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Clears all PDFs from IndexedDB.
   */
  clearAll: async function() {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Uploads a PDF to Firebase Storage and returns the download URL.
   */
  uploadToCloud: async function(id, file) {
    if (!window.firebaseStorage) {
      console.warn('Firebase Storage not initialized');
      return null;
    }
    const storageRef = window.firebaseStorage.ref();
    const invoiceRef = storageRef.child(`invoices/${id}.pdf`);
    
    try {
      // Add a 10-second timeout to prevent hanging the whole process
      const uploadPromise = (async () => {
        const snapshot = await invoiceRef.put(file);
        return await snapshot.ref.getDownloadURL();
      })();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Cloud upload timeout')), 10000)
      );

      const downloadURL = await Promise.race([uploadPromise, timeoutPromise]);
      console.log('☁️ PDF uploaded to cloud:', downloadURL);
      return downloadURL;
    } catch (e) {
      console.error('Cloud Upload Error (or timeout):', e);
      return null;
    }
  },

  /**
   * Deletes a PDF from Firebase Storage.
   */
  deleteFromCloud: async function(id) {
    if (!window.firebaseStorage) return;
    try {
      const storageRef = window.firebaseStorage.ref();
      const invoiceRef = storageRef.child(`invoices/${id}.pdf`);
      await invoiceRef.delete();
      console.log('☁️ PDF deleted from cloud');
    } catch (e) {
      console.error('Cloud Delete Error:', e);
    }
  }
};

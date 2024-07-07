const fs = require('fs');
const crypto = require('crypto');

var pbkdf2Params = {
    name: "PBKDF2",
    hash: "SHA-256",
    iterations: 1000,
    salt: null
  };

async function encryptString(string, password) {
    // Generate a random salt
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    pbkdf2Params.salt = salt;
    // Derive a key from the password using PBKDF2
    const key = await crypto.subtle.deriveKey(
        pbkdf2Params,
        await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        ),
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt"]
    );

    // Encrypt the string using AES-GCM
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const encryptedData = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        new TextEncoder().encode(string)
    );

    // Return the encrypted data as a binary array
    const binaryData = new Uint8Array(encryptedData.byteLength + salt.byteLength + iv.byteLength);
    binaryData.set(salt, 0);
    binaryData.set(iv, salt.byteLength);
    binaryData.set(new Uint8Array(encryptedData), salt.byteLength + iv.byteLength);
    return binaryData;
}

async function decryptString(binaryData, password) {
    // Extract the salt, IV, and encrypted data from the binary array
    const salt = binaryData.slice(0, 16);
    const iv = binaryData.slice(16, 28); // 12 bytes
    const encryptedData = binaryData.slice(28);
  
    pbkdf2Params.salt = salt;
    // Derive a key from the password using PBKDF2
    const key = await crypto.subtle.deriveKey(
      pbkdf2Params,
      await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      ),
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );
  
    // Decrypt the data using AES-GCM
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      key,
      encryptedData
    );
  
    // Return the decrypted string
    const textDecoder = new TextDecoder('utf-8');
    return textDecoder.decode(decryptedData);
  }

exports.encryptDb = (db, password) => {
    const jsonDb = JSON.stringify(db);
    return encryptString(jsonDb, password);
};

exports.decryptDb = async (encrypted, password) => {
    const decrypted = await decryptString(encrypted, password);
    try {
        return JSON.parse(decrypted);
    } catch (error) {
        return;
    }
};

exports.saveDB = function (password, db, filePath) {
    return new Promise(async (resolve, reject) => {
        const encryptedDb = await exports.encryptDb(db, password);
        fs.writeFile(filePath, encryptedDb, 'binary', (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};


exports.loadDBFromFile = (password, filePath) => {
    return new Promise((resolve, reject) => {
        fs.stat(filePath, (err, stats) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    resolve(null); // file does not exist
                } else {
                    reject(err);
                }
            } else {
                fs.readFile(filePath, async (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        const decryptedDb = await exports.decryptDb(data, password);
                        resolve(decryptedDb);
                    }
                });
            }
        });
    });
};

const admin = require('firebase-admin');
const fs = require('fs');

var serviceAccount;
function loadFirebaseServiceAccount() {
    // Try to load firebase.json file
    try {
        const firebaseJson = fs.readFileSync('firebase.json', 'utf8');
        serviceAccount = JSON.parse(firebaseJson);
        if (serviceAccount) {
            // If serviceAccount is set, encode it as base64 and output it
            const jsonString = JSON.stringify(serviceAccount);
            const buffer = Buffer.from(jsonString, 'utf8');
            const base64String = buffer.toString('base64');
            console.log(base64String);
        }
    } catch (error) {
        // If file doesn't exist or can't be parsed, try to load from environment variable
        if (process.env.FIREBASE) {
            try {
                const base64String = process.env.FIREBASE;
                const buffer = Buffer.from(base64String, 'base64');
                const jsonString = buffer.toString('utf8');
                serviceAccount = JSON.parse(jsonString);
            } catch (error) {
                console.log('Error parsing firebase serviceAccount from env. variable');
            }
        }
    }
}

var db;
var dbg = false;
// Set a variable in a Firestore document
async function setVariable(collectionName, documentName, fieldName, fieldValue) {
    try {
        const docRef = db.collection(collectionName).doc(documentName);
        await docRef.update({ [fieldName]: fieldValue });
        if(dbg){
            console.log(`Set ${fieldName} to ${fieldValue} in ${collectionName}/${documentName}`);
        }
    } catch (error) {
        console.error('Error setting variable:', error);
    }
}

// Get a variable from a Firestore document
async function getVariable(collectionName, documentName, fieldName) {
    try {
        const docRef = db.collection(collectionName).doc(documentName);
        const doc = await docRef.get();
        if (doc.exists) {
            const fieldValue = doc.data()[fieldName];
            if(dbg){
                console.log(`Got ${fieldName} = ${fieldValue} from ${collectionName}/${documentName}`);
            }
            return fieldValue;
        } else {
            if(dbg){
                console.log(`Document ${collectionName}/${documentName} does not exist`);
            }
            return null;
        }
    } catch (error) {
        console.error('Error getting variable:', error);
        return null;
    }
}

function main() {
    loadFirebaseServiceAccount();
    if (serviceAccount) {
        // Initialize the Firebase app
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        // Get a reference to the Firestore database
        db = admin.firestore();
    }
}

const maxChar = 262122;

async function writeArrayBufferToDB(arrayBuffer) {
    if(!serviceAccount){
        return;
    }
    const chunkSize = maxChar / 2;
    const chunks = [];
    for (let i = 0; i < arrayBuffer.byteLength; i += chunkSize) {
        const chunk = Array.prototype.map.call(new Uint8Array(arrayBuffer, i, Math.min(chunkSize, arrayBuffer.byteLength - i)), x => x.toString(16).padStart(2, '0')).join('');
        chunks.push(chunk);
    }

    await setVariable('db', 'db', 'l', arrayBuffer.byteLength.toString());

    for (let i = 0; i < chunks.length; i++) {
        await setVariable('db', 'db', i.toString(), chunks[i]);
    }
}

async function readArrayBufferFromDB() {
    if(!serviceAccount){
        return;
    }
    const stringLength = await getVariable('db', 'db', 'l');
    const length = parseInt(stringLength);
    if(Number.isNaN(length)){
        return;
    }
    const chunks = [];

    for (let i = 0; i < Math.ceil(length / (maxChar / 2)); i++) {
        const chunk = await getVariable('db', 'db', i.toString());
        chunks.push(chunk);
    }

    const arrayBuffer = new ArrayBuffer(length);
    const uint8Array = new Uint8Array(arrayBuffer);

    let offset = 0;
    for (let i = 0; i < chunks.length; i++) {
        for (let j = 0; j < chunks[i].length; j += 2) {
            uint8Array[offset + j / 2] = parseInt(chunks[i].substr(j, 2), 16);
        }
        offset += chunks[i].length / 2;
    }
    return arrayBuffer;
}

async function test() {
    // Example usage:
    await setVariable('db', 'db', 'db', 'Hello, World!');
    const fieldValue = await getVariable('db', 'db', 'db');
    console.log(`Field value: ${fieldValue}`);
}

async function testArrayBufferRW() {
    // Generate a random 1024-byte ArrayBuffer
    const arrayBuffer = new ArrayBuffer(1024);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < 1024; i++) {
        uint8Array[i] = Math.floor(Math.random() * 256);
    }

    // Write the ArrayBuffer to the database
    await writeArrayBufferToDB(arrayBuffer);

    // Read the ArrayBuffer from the database
    
    const readArrayBuffer = await readArrayBufferFromDB();

    // Verify that the read ArrayBuffer matches the original
    const readUint8Array = new Uint8Array(readArrayBuffer);
    for (let i = 0; i < 1024; i++) {
        if (uint8Array[i] !== readUint8Array[i]) {
            throw new Error(`Mismatch at index ${i}: ${uint8Array[i]} !== ${readUint8Array[i]}`);
        }
    }
    
    console.log("ArrayBuffer round-trip test passed!");
}

main();
// test();
// testArrayBufferRW();
exports.writeArrayBufferToDB = writeArrayBufferToDB;
exports.readArrayBufferFromDB = readArrayBufferFromDB;
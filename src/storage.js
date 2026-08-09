// Drop-in replacement for the Claude-artifact "window.storage" API, backed by
// Firebase Firestore so the app works as a normal standalone website.
// Every key is stored as a document in one Firestore collection.
import { db } from "./firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

const COLLECTION = "modren-bank-kv";

export const storage = {
  async get(key) {
    const snap = await getDoc(doc(db, COLLECTION, key));
    if (!snap.exists()) return null;
    return { key, value: snap.data().value };
  },

  async set(key, value) {
    await setDoc(doc(db, COLLECTION, key), { value });
    return { key, value };
  },

  async delete(key) {
    await deleteDoc(doc(db, COLLECTION, key));
    return { key, deleted: true };
  },
};

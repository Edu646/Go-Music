import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "./firebaseconfig";

export async function uploadSongFile(file, metadata = { name: "", artist: "" }, onProgress) {
  if (!file) throw new Error("No file provided");
  const filename = `songs/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
  const storageRef = ref(storage, filename);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      snapshot => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (onProgress) onProgress(percent);
      },
      err => reject(err),
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          const docRef = await addDoc(collection(db, "songs"), {
            name: metadata.name || file.name,
            artist: metadata.artist || "",
            audio: url,
            storagePath: filename,
            createdAt: serverTimestamp()
          });
          resolve({ id: docRef.id, url });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}
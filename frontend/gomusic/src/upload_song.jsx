import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "./firebaseconfig";

export async function uploadSongFile(file, metadata = { name: "", artist: "", createdBy: "" }, onProgress) {
  if (!file) throw new Error("No file provided");
  if (!metadata.createdBy) throw new Error("User ID (createdBy) is required");

  const filename = `songs/${metadata.createdBy}/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
  const storageRef = ref(storage, filename);

  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      uploadedBy: metadata.createdBy,
      originalName: file.name
    }
  });

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

          const songData = {
            name: metadata.name || file.name,
            artist: metadata.artist || "Desconocido",
            audio: url,
            storagePath: filename,
            createdBy: metadata.createdBy,
            fileSize: file.size,
            fileType: file.type,
            createdAt: serverTimestamp(),
            uploadedAt: new Date().toISOString()
          };

          const docRef = await addDoc(collection(db, "songs"), songData);

          if (onProgress) onProgress(100);

          resolve({ id: docRef.id, url, ...songData });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

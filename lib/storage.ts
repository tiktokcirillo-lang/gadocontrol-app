'use client';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import { uid } from './db';

/**
 * Verifica se o Storage está configurado (storageBucket presente).
 * Se não estiver, as fotos ficam como base64 no localStorage mesmo.
 */
function storageDisponivel(): boolean {
  return !!(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
}

/**
 * Faz upload de um base64 dataURL para o Firebase Storage.
 * Retorna a URL pública para download.
 *
 * @param dataUrl  - base64 dataURL (ex: "data:image/jpeg;base64,...")
 * @param path     - caminho no Storage (ex: "animais/{uid}/{filename}.jpg")
 */
export async function uploadFoto(dataUrl: string, ownerUid: string): Promise<string> {
  if (!storageDisponivel()) {
    // Sem Storage configurado — devolve o próprio dataUrl (base64 local)
    return dataUrl;
  }

  const filename = `${uid()}.jpg`;
  const storagePath = `fotos/${ownerUid}/${filename}`;
  const storageRef = ref(storage, storagePath);

  // uploadString aceita base64 com prefixo data URL
  await uploadString(storageRef, dataUrl, 'data_url');
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
}

/**
 * Remove uma foto do Firebase Storage pelo URL.
 * Falha silenciosamente se a URL for base64 ou Storage indisponível.
 */
export async function deletarFoto(url: string): Promise<void> {
  if (!storageDisponivel()) return;
  if (url.startsWith('data:')) return; // é base64, não está no Storage

  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch {
    // Ignora erros (arquivo já deletado, permissões, etc.)
  }
}

export { storageDisponivel };

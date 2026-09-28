/** Doc thoi luong file audio truc tiep tren trinh duyet (khong can thu vien ngoai) */
export function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";

    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? Math.round(audio.duration) : null;
      URL.revokeObjectURL(objectUrl);
      resolve(duration);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    audio.src = objectUrl;
  });
}

// src/lib/speech.ts
export const speakText = (text: string) => {
  if (!("speechSynthesis" in window)) {
    alert("このブラウザは音声読み上げに対応していません");
    return;
  }
  if (!text || text.trim() === "") return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  const voices = window.speechSynthesis.getVoices();
  const enVoice =
    voices.find(
      (v) =>
        v.lang.startsWith("en-US") &&
        (v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Samantha"))
    ) || voices.find((v) => v.lang.startsWith("en")) || voices[0];
  utterance.voice = enVoice;

  utterance.rate = 0.95;
  utterance.pitch = 1.05;

  utterance.onend = () => console.log("読み上げ完了:", text);

  window.speechSynthesis.speak(utterance);
};
// src/lib/speech.ts

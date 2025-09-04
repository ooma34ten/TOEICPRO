// src/components/WordCard.tsx
"use client";
type Word = {
  id: number;
  word: string;
  meaning: string;
};

export default function WordCard({ wordData }: { wordData: Word }) {
  return (
    <div className="p-4 bg-white rounded-xl shadow-md mb-4">
      <h3 className="text-xl font-bold text-blue-600">{wordData.word}</h3>
      <p className="text-gray-700 mt-1">{wordData.meaning}</p>
    </div>
  );
}
// src/components/WordCard.tsx
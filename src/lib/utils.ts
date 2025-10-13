// src/lib/utils.ts
export const getImportanceClasses = (importance: string) => {
  const count = importance.length;
  switch (count) {
    case 1:
      return "bg-gray-100 text-gray-800";
    case 2:
      return "bg-yellow-100 text-yellow-700";
    case 3:
      return "bg-yellow-200 text-yellow-800";
    case 4:
      return "bg-orange-200 text-orange-800";
    case 5:
      return "bg-red-300 text-red-900";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export const getPartOfSpeechClasses = (part: string) => {
  switch (part) {
    case "名詞":
      return "bg-blue-100 text-blue-700";
    case "動詞":
      return "bg-green-100 text-green-700";
    case "形容詞":
      return "bg-purple-100 text-purple-700";
    case "副詞":
      return "bg-pink-100 text-pink-700";
    case "接続詞":
      return "bg-yellow-100 text-yellow-800";
    case "前置詞":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

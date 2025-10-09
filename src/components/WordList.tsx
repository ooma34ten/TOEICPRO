"use client";

interface Row {
  part_of_speech: string;
  meaning: string;
  example: string;
  translation: string;
  importance: string;
}

interface WordListProps {
  rows: Row[];
}

export default function WordList({ rows }: WordListProps) {
  if (rows.length === 0) return <p>登録済み単語はありません</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>品詞</th>
          <th>意味</th>
          <th>例文</th>
          <th>翻訳</th>
          <th>重要度</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.part_of_speech}</td>
            <td>{r.meaning}</td>
            <td>{r.example}</td>
            <td>{r.translation}</td>
            <td>{r.importance}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
//src/components/WordList.tsx

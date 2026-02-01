"use client";

import { useState } from "react";

export default function AiProcessTestPage() {
  const [result1, setResult1] = useState<string>("");
  const [result2, setResult2] = useState<string>("");
  const [result3, setResult3] = useState<string>("");

  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [loading3, setLoading3] = useState(false);


  const handlePost = async (): Promise<void> => {
    setLoading1(true);
    setResult1("");

    try {
      const response: Response = await fetch("/api/ai-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          level: 3,
          category: "vocabulary"
        })
      });

      const data: unknown = await response.json();
      setResult1(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult1("Request failed");
    } finally {
      setLoading1(false);
    }
  };
    

  const handlePost2 = async (): Promise<void> => {
    setLoading2(true);
    setResult2("");

    try {
      const response: Response = await fetch("/api/save_test_type", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          level: 3,
          category: "vocabulary"
        })
      });

      const data: unknown = await response.json();
      setResult2(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult2("Request failed");
    } finally {
      setLoading2(false);
    }
  };

  const handlePost3 = async (): Promise<void> => {
    setLoading3(true);
    setResult3("");

    try {
      const response: Response = await fetch("/api/create_question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
      });

      const data: unknown = await response.json();
      setResult3(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult3("Request failed");
    } finally {
      setLoading3(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="text-xl font-semibold mb-4">AI Process POST Test</h1>

        <button
          onClick={handlePost}
          disabled={loading1}
          className="w-full rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading1 ? "Sending..." : "POST /api/ai-process"}
        </button>

        <pre className="mt-4 rounded bg-gray-100 p-3 text-sm overflow-auto">
          {result1}
        </pre>

        <h1 className="text-xl font-semibold mb-4">AI Process POST Test</h1>

        <button
          onClick={handlePost2}
          disabled={loading2}
          className="w-full rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading2 ? "Sending..." : "POST /apisave_test_type"}
        </button>

        <pre className="mt-4 rounded bg-gray-100 p-3 text-sm overflow-auto">
          {result2}
        </pre>

        <h1 className="text-xl font-semibold mb-4">AI Process POST Test</h1>

        <button
          onClick={handlePost3}
          disabled={loading3}
          className="w-full rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading3 ? "Sending..." : "POST /api/create_question"}
        </button>

        <pre className="mt-4 rounded bg-gray-100 p-3 text-sm overflow-auto">
          {result3}
        </pre>
      </div>
    </div>
  );
}

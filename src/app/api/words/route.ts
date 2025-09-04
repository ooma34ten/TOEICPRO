import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GEMINI_API_KEY || "",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: question }] }],
        }),
      }
    );

    const data = await res.json();
    console.log("Gemini response:", JSON.stringify(data, null, 2));

    let answer = "回答なし";
    const candidate = data?.candidates?.[0]?.content?.[0];
    if (candidate?.parts?.[0]?.text) {
      answer = candidate.parts[0].text;
    } else if (candidate?.text) {
      answer = candidate.text;
    }

    return NextResponse.json({ answer });
  } catch (e: unknown) {
    let errorMessage = "不明なエラーです";
    if (e instanceof Error) {
      errorMessage = e.message;
    }

    return NextResponse.json({ answer: "回答なし", error: errorMessage });
  }
}

//src/app/api/words/register/route.ts
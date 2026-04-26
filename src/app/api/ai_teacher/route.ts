// 完全版 /api/ai_teacher
// ユーザー指定: TypeScript で any を使わない

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { normalizePartOfSpeech } from "@/lib/utils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// =============================
// 型定義
// =============================
type Question = {
  id: string;
  question: string;
  translation: string;
  options: [string, string, string, string];
  answer: string;
  explanation: string;
  partOfSpeech: string;
  example?: string;
  category: string;
  importance: number;
  synonyms: string[];
  optionDetails?: {
    option: string;
    meaning: string;
    partOfSpeech: string;
  }[];
  accuracy?: number | null;
};

type RawQuestion = Record<string, unknown>;

type ParsedResponse = {
  questions: RawQuestion[];
};

// =============================
// 型ガード
// =============================
function isQuestion(obj: unknown): obj is Question {
  if (typeof obj !== "object" || obj === null) {
    console.log("[isQuestion] Failed: Not an object");
    return false;
  }
  const q = obj as Record<string, unknown>;
  const isValid =
    typeof q.id === "string" &&
    typeof q.question === "string" &&
    typeof q.translation === "string" &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every((o) => typeof o === "string") &&
    typeof q.answer === "string" &&
    typeof q.explanation === "string" &&
    typeof q.partOfSpeech === "string" &&
    typeof q.category === "string" &&
    typeof q.importance === "number" &&
    (q.synonyms === undefined ||
      (Array.isArray(q.synonyms) &&
        q.synonyms.every((s) => typeof s === "string")));
  if (!isValid) {
    console.log(
      "[isQuestion] Failed for object. id:",
      typeof q.id,
      "q:",
      typeof q.question,
      "trans:",
      typeof q.translation,
      "opt:",
      Array.isArray(q.options),
      "ans:",
      typeof q.answer,
      "exp:",
      typeof q.explanation,
      "pos:",
      typeof q.partOfSpeech,
      "cat:",
      typeof q.category,
      "imp:",
      typeof q.importance,
    );
  }
  return isValid;
}

// =============================
// JSON パース
// =============================
function parseJsonSafe(text: string): ParsedResponse | null {
  try {
    const clean = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const first = clean.indexOf("{");
    const last = clean.lastIndexOf("}");
    if (first === -1 || last === -1) return null;
    const parsed = JSON.parse(clean.slice(first, last + 1));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "questions" in parsed &&
      Array.isArray((parsed as ParsedResponse).questions)
    ) {
      return parsed as ParsedResponse;
    }
    return null;
  } catch {
    return null;
  }
}

// =============================
// 選択肢正規化
// =============================
function normalizeOptionText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let text = raw.replace(/^[\(（][A-Da-d1-4][\)）]([\.\:\：]?\s*)?/, "").trim();
  text = text.replace(/^[A-Da-d1-4][\.\)\:\：]\s*/, "").trim();
  text = text.replace(/^[\.\-\:\：]\s*/, "").trim();
  return text;
}

// =============================
// 翻訳の空欄補完
// =============================
function fillTranslationPlaceholder(translation: string): string {
  return translation.replace(
    /_{2,}|＿{2,}|＿|_____|____|__|（　）|（☐）/g,
    "（空欄）",
  );
}

// =============================
// 回答を A/B → 選択肢テキストに解決
// =============================
function resolveAnswer(
  answerRaw: unknown,
  options: [string, string, string, string],
): string {
  if (typeof answerRaw !== "string") return "";
  const trimmed = answerRaw.trim();
  const letter = trimmed.match(/^([A-Da-d])[\)\.\:\s]*$/);
  if (letter) {
    const index = letter[1].toUpperCase().charCodeAt(0) - 65;
    return options[index] ?? "";
  }
  for (let i = 0; i < 4; i++) {
    if (trimmed === options[i]) return options[i];
  }
  return trimmed;
}

// =============================
// スコア → レベル変換
// =============================
function scoreToLevel(score: number): number {
  if (score < 400) return 1; // Beginner
  if (score < 600) return 2; // Basic
  if (score < 800) return 3; // Intermediate
  return 4; // Advanced
}

// =============================
// API 本体
// =============================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = body.mode || "both"; // 'initial', 'fill', or 'both'
    console.log(`\n========== [ai_teacher] START mode: ${mode} ==========`);

    const userId = req.headers.get("userId");
    if (!userId) {
      console.log("[ai_teacher] Error: userId is missing");
      return NextResponse.json({ error: "userId が必要です" }, { status: 400 });
    }

    const dbQuestions: Question[] = [];
    let allCategoriesData: any[] = [];
    let estimatedScore = 450;
    let weaknesses: string[] = [];

    console.time("[ai_teacher] total");
    console.time("[ai_teacher] db_basic_fetch");
    // 1. 基本データ (カテゴリ、最新スコア、学習履歴) を並列で取得
    const [catRes, scoreRes, historyRes] = await Promise.all([
      supabase.from("categories").select("id, level1, level2").order("id"),
      supabase
        .from("test_results")
        .select("predicted_score, weak_categories")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      mode === "initial" || mode === "both"
        ? supabase
          .from("test_results")
          .select("created_at, test_result_items(question_id, is_correct)")
          .eq("user_id", userId)
        : Promise.resolve({ data: [] as any[], error: null as any }),
    ]);
    console.timeEnd("[ai_teacher] db_basic_fetch");
    if (catRes.error) console.error("[ai_teacher] catRes error:", catRes.error);
    if (scoreRes.error) console.error("[ai_teacher] scoreRes error:", scoreRes.error);
    if (historyRes.error) console.error("[ai_teacher] historyRes error:", historyRes.error);

    if (catRes.error || scoreRes.error || historyRes.error) {
      return NextResponse.json({
        questions: [],
        error: "DB_FETCH_FAILED",
        details: { cat: catRes.error, score: scoreRes.error, history: historyRes.error }
      }, { status: 500 });
    }

    allCategoriesData = catRes.data || [];
    const latestResult = scoreRes.data;
    estimatedScore = latestResult?.predicted_score ?? 450;
    weaknesses = latestResult?.weak_categories ?? [];
    const level = scoreToLevel(estimatedScore);

    // ----------------------------
    // 2. DBから既存の弱点問題を抽出
    // ----------------------------
    if (mode === "initial" || mode === "both") {
      const rawHistoryData = historyRes.data || [];
      const historyMap = new Map<
        string,
        { correct: number; incorrect: number; lastAnswered: number }
      >();

      rawHistoryData.forEach((res: any) => {
        const time = new Date(res.created_at).getTime();
        res.test_result_items?.forEach((item: any) => {
          const qId = item.question_id;
          if (!historyMap.has(qId)) {
            historyMap.set(qId, { correct: 0, incorrect: 0, lastAnswered: 0 });
          }
          const stats = historyMap.get(qId)!;
          if (item.is_correct) stats.correct++;
          else stats.incorrect++;
          if (time > stats.lastAnswered) stats.lastAnswered = time;
        });
      });

      const history = Array.from(historyMap.entries()).map(
        ([question_id, stats]) => ({
          question_id,
          correct_count: stats.correct,
          incorrect_count: stats.incorrect,
          last_answered_at: new Date(stats.lastAnswered).toISOString(),
        }),
      );

      const now = new Date();

      // すべての履歴問題に対して、正解率による次の復習期限を計算する
      const historySpecs = history.map((h) => {
        const total = h.correct_count + h.incorrect_count;
        const accuracy =
          total > 0 ? Math.round((h.correct_count / total) * 100) : 0;

        let intervalMs = 0;
        if (accuracy === 0) intervalMs = 1 * 60 * 60 * 1000;
        else if (accuracy <= 20) intervalMs = 12 * 60 * 60 * 1000;
        else if (accuracy <= 40) intervalMs = 1 * 24 * 60 * 60 * 1000;
        else if (accuracy <= 60) intervalMs = 3 * 24 * 60 * 60 * 1000;
        else if (accuracy <= 80) intervalMs = 7 * 24 * 60 * 60 * 1000;
        else if (accuracy <= 90) intervalMs = 14 * 24 * 60 * 60 * 1000;
        else intervalMs = 30 * 24 * 60 * 60 * 1000;

        const lastAnswered = new Date(h.last_answered_at);
        const nextReview = new Date(lastAnswered.getTime() + intervalMs);
        const isDue = now >= nextReview;

        return { id: h.question_id, accuracy, isDue };
      });

      const weakQuestionSpecs = historySpecs
        .filter((q) => q.isDue)
        .map((q) => {
          // 正解率が低いほどスコアが高くなり優先的に選ばれるよう重み付け
          const weight = Math.pow(100 - q.accuracy + 1, 1.5);
          return { ...q, score: Math.random() * weight };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // スコア順で上位5問を選ぶ

      if (weakQuestionSpecs.length > 0) {
        console.log(`[ai_teacher] Fetching ${weakQuestionSpecs.length} weak questions from DB`);
        console.time("[ai_teacher] db_questions_fetch");
        const { data: dbQData } = await supabase
          .from("toeic_questions")
          .select("*")
          .in(
            "id",
            weakQuestionSpecs.map((s) => s.id),
          );
        console.timeEnd("[ai_teacher] db_questions_fetch");

        dbQData?.forEach((q) => {
          const h = history.find((h: any) => h.question_id === q.id);
          const accuracy = h
            ? Math.round(
              (h.correct_count / (h.correct_count + h.incorrect_count)) * 100,
            )
            : null;

          dbQuestions.push({
            id: q.id,
            question: q.question,
            translation: q.translation || "",
            options: q.options as [string, string, string, string],
            answer: q.answer,
            explanation: q.explanation || "",
            partOfSpeech: q.part_of_speech || "",
            example: q.example_sentence || "",
            category: q.category || "",
            importance: q.importance || 3,
            synonyms: q.synonyms || [],
            accuracy,
          });
        });
      }

      const needed = 10 - dbQuestions.length;
      if (needed > 0) {
        console.time("[ai_teacher] db_random_fill");

        // 直近に解答したかどうかだけでなく、「復習時期がまだ来ていない」問題はすべて除外する
        // （正解率に基づく間隔ルールを完全に適用するため）
        const notDueIds = historySpecs.filter((h) => !h.isDue).map((h) => h.id);

        // 既に選ばれた弱点問題 + 復習時期が来ていない問題をすべて除外対象にする
        const excludeIdsSet = new Set([
          ...dbQuestions.map((q) => q.id),
          ...notDueIds,
        ]);

        // "not in" クエリは上限（数十〜100件）があるため、DBから多めに取得してからプログラム側でフィルタする
        const { data: allIdData } = await supabase
          .from("toeic_questions")
          .select("id")
          .eq("level", level)
          .limit(2000); // 余裕を持って十分取得

        const allIds = allIdData?.map(row => row.id) || [];
        const validIds = allIds.filter(id => !excludeIdsSet.has(id));
        console.log(`[ai_teacher] allIds: ${allIds.length}, excludeIdsSet: ${excludeIdsSet.size}, validIds: ${validIds.length}, needed: ${needed}`);

        // シャッフルして必要な数だけ選別
        validIds.sort(() => Math.random() - 0.5);
        const selectedIds = validIds.slice(0, needed);
        console.log(`[ai_teacher] selectedIds: ${selectedIds.length}`);

        if (selectedIds.length > 0) {
          const { data: randomQData } = await supabase
            .from("toeic_questions")
            .select("*")
            .in("id", selectedIds);

          console.timeEnd("[ai_teacher] db_random_fill");

          if (randomQData) {
            randomQData.forEach((q) => {
              const h = history.find((h: any) => h.question_id === q.id);
              const accuracy = h
                ? Math.round(
                  (h.correct_count / (h.correct_count + h.incorrect_count)) *
                  100,
                )
                : null;

              dbQuestions.push({
                id: q.id,
                question: q.question,
                translation: q.translation || "",
                options: q.options as [string, string, string, string],
                answer: q.answer,
                explanation: q.explanation || "",
                partOfSpeech: q.part_of_speech || "",
                example: q.example_sentence || "",
                category: q.category || "",
                importance: q.importance || 3,
                synonyms: q.synonyms || [],
                accuracy,
              });
            });
          }
        } else {
          console.timeEnd("[ai_teacher] db_random_fill");
        } // if (randomQData)
      } // if (needed > 0)
    } // if (mode === "initial" || mode === "both")
    // ----------------------------
    // 2. モードが initial の場合は、DBにある分だけで即座に返す
    // ----------------------------
    if (mode === "initial") {
      const categoryMap = new Map<string, string>();
      allCategoriesData.forEach((c: any) => {
        const name =
          c.level1 && c.level2
            ? `${c.level1} > ${c.level2}`
            : c.level2 || c.level1 || "";
        categoryMap.set(String(c.id), name);
      });

      const finalQuestions = dbQuestions.map((q) => ({
        ...q,
        category: categoryMap.get(String(q.category)) || q.category,
      }));

      console.timeEnd("[ai_teacher] total");
      return NextResponse.json({
        questions: finalQuestions,
        limitReached: false,
        message: "DBからの問題取得に成功しました",
        needsMore: finalQuestions.length < 10,
      });
    }

    // ----------------------------
    // 3. 残りをAIで生成 (fill または both の場合)
    // ----------------------------
    const targetCount = 10;
    let aiCount = 0;
    if (mode === "fill") {
      aiCount = body.count || 10;
    } else {
      aiCount = Math.max(0, targetCount - dbQuestions.length);
    }
    console.log(`[ai_teacher] dbQuestions so far: ${dbQuestions.length}, aiCount to generate: ${aiCount}`);

    // (既に並列実行済みで取得済みの latestResult, estimatedScore, weaknesses, level を使用)

    const categoryListText = allCategoriesData
      ? allCategoriesData.map((c: any) => `- ${c.level2}`).join("\n")
      : "";

    const weaknessText = weaknesses.length > 0 ? weaknesses.join(", ") : "";

    let aiQuestions: Question[] = [];

    const avoidWordsText =
      dbQuestions.length > 0
        ? `\n   - 今回、既に以下の単語・フレーズが出題されているため、今回の正解(answer)には絶対に使用しないでください: ${[...new Set(dbQuestions.map((q) => q.answer))].filter(Boolean).join(", ")}`
        : "";

    if (aiCount > 0) {
      // サブスク確認 & 無料制限
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("is_active")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      const subscribed = sub?.is_active === true;
      if (!subscribed) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: usage } = await supabase
          .from("ai_usage_log")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("used_at", today.toISOString());

        console.log(`[ai_teacher] user is free. daily usage: ${usage}`);
        if ((usage ?? 0) >= 1) {
          // すでに利用済みの場合はDB問題のみ返すかエラー
          console.log(`[ai_teacher] User hit free limit. DB qs: ${dbQuestions.length}`);
          if (dbQuestions.length === 0) {
            return NextResponse.json({
              questions: [],
              limitReached: true,
              message: "無料ユーザーは本日すでに1回利用済みです。",
            });
          }
        }
      }

      const prompt = `
あなたはプロのTOEIC講師です。以下のルール厳守：
1) 出力は JSON のみ
2) 問題数は ${aiCount} 問
3) **重要: "translation", "explanation", "partOfSpeech" は必ず日本語で出力すること。** 特に translation は自然な和訳にし、英語のままにしないこと。
   - translation に "(A) registration" のような英語の選択肢を含めないこと。
   - translation に "_____" や "(  )" のような空欄記号を含めず、正解を当てはめた【完全な日本語の文】にすること。
   - options の配列には、選択肢の記記号(A, B, C, D)を含めないこと。純粋な単語/フレーズのみ。
   - "partOfSpeech" は必ず、名詞, 動詞, 形容詞, 副詞, 前置詞, 接続詞, 代名詞, 冠詞, 助動詞, 間投詞, 熟語・フレーズ, その他 のいずれか完全一致にすること。
4) **出題形式・難易度・重要度の厳密な調整**:
   - 出題形式は【すべて TOEIC Part 5 形式の短文穴埋め問題】のみに限定してください。
   - ユーザーの推定スコアは ${estimatedScore} 点です（難易度レベル: 1-4中 ${level}）。
   - **重要度 (importance) は、1 (たまに出る), 2 (標準), 3 (超頻出) のいずれかを数値で指定してください**。
   - **重要: 各問題の "category" は、必ず以下のリストにある「中分類名」のいずれか1つを【正確に】指定してください。**
${categoryListText}
   - 苦手分野 ${weaknessText} を意識してください。
5) **多様性と重複の排除 (最重要)**:
   - 全く同じ単語、似たフレーズ（例: 'are required', 'although' 等）を複数回の正解(answer)にすることは厳禁です。AIが生成する ${aiCount} 問は、すべて異なる文法事項・単語を問う問題にしてください。${avoidWordsText}
6) 形式：
{
  "questions": [
    {
      "id": "一意ID",
      "question": "...",
      "translation": "...",
      "options": ["...", "...", "...", "..."],
      "answer": "...",
      "explanation": "...",
      "partOfSpeech": "...",
      "example": "...",
      "category": "...",
      "importance": 1,
      "synonyms": ["..."],
      "optionDetails": [
        { "option": "...", "meaning": "...", "partOfSpeech": "..." }
      ]
    }
  ]
}
`;

      console.log(`[ai_teacher] initiating gemini call for aiCount: ${aiCount}...`);
      console.time("[ai_teacher] gemini_generate");
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.9, // 創造性と多様性を高めるために引き上げ
        },
      });
      let parsed: ParsedResponse | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`[ai_teacher] gemini attempt ${attempt}`);
        const result = await model.generateContent(prompt);
        parsed = parseJsonSafe(result.response.text());
        if (parsed) {
          console.log(`[ai_teacher] gemini success on attempt ${attempt}`);
          break;
        }
        console.log(`[ai_teacher] gemini failed parsing on attempt ${attempt}`);
      }
      console.timeEnd("[ai_teacher] gemini_generate");

      if (parsed) {
        aiQuestions = parsed.questions
          .map((raw, i) => {
            if (typeof raw !== "object" || raw === null) return null;
            const r = raw as RawQuestion;
            const rawOps = Array.isArray(r.options) ? r.options : [];
            const options: [string, string, string, string] = ["", "", "", ""];
            for (let j = 0; j < 4; j++)
              options[j] = normalizeOptionText(rawOps[j]);
            for (let j = 0; j < 4; j++)
              if (!options[j]) options[j] = `Option ${j + 1}`;

            const answer = resolveAnswer(r.answer ?? "", options);
            const translation = fillTranslationPlaceholder(
              typeof r.translation === "string" ? r.translation : "",
            );

            const q: Question = {
              id: typeof r.id === "string" ? r.id : `q_${Date.now()}_${i}`,
              question: typeof r.question === "string" ? r.question : "",
              translation,
              options,
              answer,
              explanation:
                typeof r.explanation === "string" ? r.explanation : "",
              partOfSpeech:
                typeof r.partOfSpeech === "string" ? r.partOfSpeech : "",
              example: typeof r.example === "string" ? r.example : undefined,
              category: typeof r.category === "string" ? r.category : "other",
              importance:
                typeof r.importance === "number"
                  ? Math.min(3, Math.max(1, r.importance))
                  : 2,
              synonyms: Array.isArray(r.synonyms)
                ? r.synonyms.filter((s): s is string => typeof s === "string")
                : [],
              optionDetails: Array.isArray(r.optionDetails)
                ? (
                  r.optionDetails as {
                    option: string;
                    meaning: string;
                    partOfSpeech: string;
                  }[]
                ).filter(
                  (d) =>
                    typeof d === "object" &&
                    d !== null &&
                    typeof d.option === "string" &&
                    typeof d.meaning === "string" &&
                    typeof d.partOfSpeech === "string",
                )
                : [],
              accuracy: null, // 新規作成
            };
            return isQuestion(q) ? q : null;
          })
          .filter((q): q is Question => q !== null);

        // 新規問題をDBに保存
        const getCategoryId = (catName: string): string => {
          if (!allCategoriesData) return catName;
          const match = allCategoriesData.find(
            (c: any) => c.level2 === catName || c.level1 === catName,
          );
          return match ? String(match.id) : catName;
        };

        const { data: savedAIQ } = await supabase
          .from("toeic_questions")
          .insert(
            aiQuestions.map((q) => ({
              question: q.question,
              translation: q.translation,
              options: q.options,
              answer: q.answer,
              explanation: q.explanation,
              example_sentence: q.example,
              part_of_speech: normalizePartOfSpeech(q.partOfSpeech),
              category: getCategoryId(q.category),
              importance: q.importance,
              synonyms: q.synonyms,
              level,
              created_by: "ai_teacher",
            })),
          )
          .select();

        if (savedAIQ) {
          aiQuestions = savedAIQ.map((q) => ({
            id: q.id,
            question: q.question,
            translation: q.translation || "",
            options: q.options as [string, string, string, string],
            answer: q.answer,
            explanation: q.explanation || "",
            partOfSpeech: q.part_of_speech || "",
            example: q.example_sentence || "",
            category: q.category || "",
            importance: q.importance || 3,
            synonyms: q.synonyms || [],
            accuracy: null,
          }));
        }

        // 利用ログ保存
        await supabase.from("ai_usage_log").insert({ user_id: userId });
      }
    }

    // ----------------------------
    // 3. 結合 & カテゴリ名をIDから文字に変換
    // ----------------------------
    const categoryMap = new Map<string, string>();
    allCategoriesData?.forEach((c: any) => {
      // 大分類 > 中分類 の形式にする（中分類がなければ大分類のみ、逆も然り）
      const name =
        c.level1 && c.level2
          ? `${c.level1} > ${c.level2}`
          : c.level2 || c.level1 || "";
      categoryMap.set(String(c.id), name);
    });

    const finalQuestions = [...dbQuestions, ...aiQuestions]
      .slice(0, targetCount)
      .map((q) => ({
        ...q,
        category: categoryMap.get(String(q.category)) || q.category,
      }));

    console.timeEnd("[ai_teacher] total");
    return NextResponse.json({
      questions: finalQuestions,
      limitReached: false,
      message: "問題の取得・生成に成功しました",
    });
  } catch (err: any) {
    console.error("[ai_teacher] Error in API:", err);
    return NextResponse.json(
      {
        questions: [],
        limitReached: false,
        message: `サーバーエラー: ${err?.message || String(err)}`,
        stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
      },
      { status: 500 },
    );
  }
}

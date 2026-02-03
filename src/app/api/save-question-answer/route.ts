import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================
// 型定義
// =============================
type SaveAnswerRequest = {
    userId: string;
    questionId: string;
    userAnswer: string;
    isCorrect: boolean;
    answerTimeMs?: number;
    sessionId?: string;
};

type BatchSaveRequest = {
    userId: string;
    answers: {
        questionId: string;
        userAnswer: string;
        isCorrect: boolean;
        answerTimeMs?: number;
    }[];
    sessionId?: string;
};

// =============================
// 単一回答保存
// =============================
async function saveAnswer(data: SaveAnswerRequest): Promise<{ success: boolean; error?: string }> {
    const { userId, questionId, userAnswer, isCorrect, answerTimeMs, sessionId } = data;

    try {
        // 1. 回答履歴に追加
        const { error: historyError } = await supabase.from("question_answer_history").insert({
            user_id: userId,
            question_id: questionId,
            user_answer: userAnswer,
            is_correct: isCorrect,
            answer_time_ms: answerTimeMs ?? null,
            session_id: sessionId ?? null,
            answered_at: new Date().toISOString(),
        });

        if (historyError) {
            console.error("Failed to insert history:", historyError);
            return { success: false, error: historyError.message };
        }

        // 2. user_question_history を更新（upsert）
        const { data: existing, error: fetchError } = await supabase
            .from("user_question_history")
            .select("id, correct_count, incorrect_count")
            .eq("user_id", userId)
            .eq("question_id", questionId)
            .maybeSingle();

        if (fetchError) {
            console.error("Failed to fetch existing history:", fetchError);
        }

        if (existing) {
            // 既存レコードを更新
            const { error: updateError } = await supabase
                .from("user_question_history")
                .update({
                    correct_count: existing.correct_count + (isCorrect ? 1 : 0),
                    incorrect_count: existing.incorrect_count + (isCorrect ? 0 : 1),
                    last_answered_at: new Date().toISOString(),
                })
                .eq("id", existing.id);

            if (updateError) {
                console.error("Failed to update history:", updateError);
                return { success: false, error: updateError.message };
            }
        } else {
            // 新規レコードを作成
            const { error: insertError } = await supabase.from("user_question_history").insert({
                user_id: userId,
                question_id: questionId,
                correct_count: isCorrect ? 1 : 0,
                incorrect_count: isCorrect ? 0 : 1,
                last_answered_at: new Date().toISOString(),
            });

            if (insertError) {
                console.error("Failed to insert history:", insertError);
                return { success: false, error: insertError.message };
            }
        }

        return { success: true };
    } catch (err) {
        console.error("saveAnswer error:", err);
        return { success: false, error: "Unexpected error" };
    }
}

// =============================
// セッション統計を更新
// =============================
async function updateSessionStats(
    userId: string,
    sessionId: string,
    isCorrect: boolean
): Promise<void> {
    try {
        const { data: session, error: fetchError } = await supabase
            .from("learning_sessions")
            .select("id, total_questions, correct_count")
            .eq("session_id", sessionId)
            .eq("user_id", userId)
            .maybeSingle();

        if (fetchError) {
            console.error("Failed to fetch session:", fetchError);
            return;
        }

        if (session) {
            await supabase
                .from("learning_sessions")
                .update({
                    total_questions: session.total_questions + 1,
                    correct_count: session.correct_count + (isCorrect ? 1 : 0),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", session.id);
        } else {
            await supabase.from("learning_sessions").insert({
                user_id: userId,
                session_id: sessionId,
                total_questions: 1,
                correct_count: isCorrect ? 1 : 0,
                started_at: new Date().toISOString(),
            });
        }
    } catch (err) {
        console.error("updateSessionStats error:", err);
    }
}

// =============================
// API エンドポイント
// =============================
export async function POST(req: Request) {
    try {
        const body = await req.json();

        // バッチ保存の場合
        if (body.answers && Array.isArray(body.answers)) {
            const batchData = body as BatchSaveRequest;
            const { userId, answers, sessionId } = batchData;

            if (!userId) {
                return NextResponse.json({ error: "userId is required" }, { status: 400 });
            }

            const results = await Promise.all(
                answers.map((a) =>
                    saveAnswer({
                        userId,
                        questionId: a.questionId,
                        userAnswer: a.userAnswer,
                        isCorrect: a.isCorrect,
                        answerTimeMs: a.answerTimeMs,
                        sessionId,
                    })
                )
            );

            const successCount = results.filter((r) => r.success).length;
            const failCount = results.filter((r) => !r.success).length;

            // セッション統計を更新
            if (sessionId) {
                const correctCount = answers.filter((a) => a.isCorrect).length;
                for (let i = 0; i < answers.length; i++) {
                    await updateSessionStats(userId, sessionId, answers[i].isCorrect);
                }
            }

            return NextResponse.json({
                success: failCount === 0,
                saved: successCount,
                failed: failCount,
            });
        }

        // 単一保存の場合
        const singleData = body as SaveAnswerRequest;
        const { userId, questionId, userAnswer, isCorrect, answerTimeMs, sessionId } = singleData;

        if (!userId || !questionId) {
            return NextResponse.json(
                { error: "userId and questionId are required" },
                { status: 400 }
            );
        }

        const result = await saveAnswer({
            userId,
            questionId,
            userAnswer,
            isCorrect,
            answerTimeMs,
            sessionId,
        });

        // セッション統計を更新
        if (sessionId) {
            await updateSessionStats(userId, sessionId, isCorrect);
        }

        if (result.success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
    } catch (err) {
        console.error("save-question-answer error:", err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}

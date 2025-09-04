export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      word_master: {
        Row: {
          id: number;
          word: string;
          part_of_speech: string;
          meaning: string;
          example_sentence: string;
          translation: string;
          importance: string;
        };
        Insert: Omit<{
          id: number;
          word: string;
          part_of_speech: string;
          meaning: string;
          example_sentence: string;
          translation: string;
          importance: string;
        }, "id">;
        Update: Partial<Omit<{
          id: number;
          word: string;
          part_of_speech: string;
          meaning: string;
          example_sentence: string;
          translation: string;
          importance: string;
        }, "id">>;
      };
      user_words: {
        Row: {
          id: number;
          user_id: string;
          word_id: number;
          correct_count: number;
          correct_dates: string[];
          registered_at: string;
        };
        Insert: Omit<{
          id: number;
          user_id: string;
          word_id: number;
          correct_count: number;
          correct_dates: string[];
          registered_at: string;
        }, "id">;
        Update: Partial<Omit<{
          id: number;
          user_id: string;
          word_id: number;
          correct_count: number;
          correct_dates: string[];
          registered_at: string;
        }, "id">>;
      };
    };
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
    CompositeTypes: Record<string, unknown>;
  };
}

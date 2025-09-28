import { cookies as nextCookies } from "next/headers";

// Supabase が期待する get/set/delete メソッドを持つオブジェクトに変換
export async function createSupabaseCookies() {
  const store = await nextCookies(); 
  console.log("store:", store);
  return {
    // get は同期的に動作する必要があるため、事前に取得しておく
    get: (key: string) => {
      const cookie = store.get(key);
      return cookie ? cookie.value : null;
    },
    set: (_key: string, _value: string) => {
      throw new Error("Server-side set not supported");
    },
    delete: (_key: string) => {
      throw new Error("Server-side delete not supported");
    },
  };
}

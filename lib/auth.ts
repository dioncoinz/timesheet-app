import { cookies } from "next/headers";

export async function hasPinSession() {
  const cookieStore = await cookies();
  return cookieStore.get("pin_ok")?.value === "1";
}

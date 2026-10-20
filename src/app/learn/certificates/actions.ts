"use server";

import { revalidatePath } from "next/cache";
import { site } from "@/content/site";
import { setEmptyHolderName, setSearchVisible } from "@/lib/lms/certificates";
import { requireUser } from "@/lib/session";

export type NameState = { error: string | null };

/** Sets the printed name on one of the learner's certificates, only while it is empty. */
export async function setCertificateName(_prev: NameState, formData: FormData): Promise<NameState> {
  const user = await requireUser("/learn/certificates");
  const serial = String(formData.get("serial") ?? "");
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) {
    return { error: "Enter your full name as it should be printed, 2 to 100 characters." };
  }
  if (!(await setEmptyHolderName(user.id, serial, name))) {
    return { error: `This certificate already has a name. To correct it, email ${site.email}.` };
  }
  revalidatePath("/learn/certificates");
  return { error: null };
}

/** Shows or hides one of the learner's certificate pages in search engines. */
export async function setCertificateSearchVisible(formData: FormData) {
  const user = await requireUser("/learn/certificates");
  await setSearchVisible(user.id, String(formData.get("serial") ?? ""), formData.get("visible") === "1");
  revalidatePath("/learn/certificates");
  revalidatePath("/sitemap.xml");
}

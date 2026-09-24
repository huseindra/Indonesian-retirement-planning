import { redirect } from "next/navigation";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth/constants";

export default function HomePage() {
  redirect(DEFAULT_AUTHENTICATED_PATH);
}

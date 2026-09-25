import { redirect } from "next/navigation";

export default function FormacionRedirect() {
  redirect("/jugadores?tab=formacion");
}

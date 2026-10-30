import { cookies } from "next/headers";
import { authConfig, CONFIG_ERROR, COOKIE_NAME, validSession } from "../lib/session";
import Chat from "./chat";
import Login from "./login";

export default async function Home() {
  const configured = Boolean(authConfig());
  const authenticated = validSession((await cookies()).get(COOKIE_NAME)?.value);
  return authenticated ? <Chat /> : <Login configurationError={configured ? "" : CONFIG_ERROR} />;
}

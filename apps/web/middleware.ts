import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtected = createRouteMatcher([
  "/dashboard(.*)", "/members(.*)", "/attendance(.*)", "/memberships(.*)",
  "/renewals(.*)", "/payments(.*)", "/retention(.*)", "/add-ons(.*)",
  "/staff(.*)", "/reports(.*)", "/settings(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (isProtected(req)) auth().protect();
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/", "/(api|trpc)(.*)"],
};

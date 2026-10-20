"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

// Same-origin: the API lives at /api/auth.
export const authClient = createAuthClient({ plugins: [magicLinkClient()] });

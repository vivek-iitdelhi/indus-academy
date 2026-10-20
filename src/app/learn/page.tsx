import { Accent, Container, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/session";

// Placeholder: the learner dashboard feature replaces this file.
export default async function LearnPage() {
  const user = await requireUser("/learn");
  return (
    <Container className="py-16 sm:py-24">
      <Eyebrow>My learning</Eyebrow>
      <h1 className="mt-6 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
        Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}. <Accent>Coming soon.</Accent>
      </h1>
      <p className="mt-4 text-lg text-muted">Your courses will appear here.</p>
    </Container>
  );
}

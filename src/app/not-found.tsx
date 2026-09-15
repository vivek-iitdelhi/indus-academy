import { Accent, ButtonLink, Container, Eyebrow } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="py-32 text-center">
      <div className="flex justify-center">
        <Eyebrow>404</Eyebrow>
      </div>
      <h1 className="mt-6 text-5xl font-semibold tracking-[-0.035em]">
        This page is still <Accent>in training</Accent>.
      </h1>
      <p className="mx-auto mt-5 max-w-md text-lg text-muted">
        We couldn&apos;t find what you were looking for. Let&apos;s get you back on track.
      </p>
      <div className="mt-10 flex justify-center">
        <ButtonLink href="/" variant="dark">
          Back to home
        </ButtonLink>
      </div>
    </Container>
  );
}

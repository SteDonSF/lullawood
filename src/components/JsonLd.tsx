// =============================================================================
// JsonLd  —  Renders a JSON-LD <script> for structured data. Server component;
// the object is serialized at render time so the markup ships in the initial
// HTML where crawlers read it.
// =============================================================================
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is trusted (built from our own content), and we
      // escape "<" to keep it from ever breaking out of the script element.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

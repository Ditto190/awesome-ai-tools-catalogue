/**
 * Serialize a value as JSON safe for embedding in an inline <script> tag.
 * Escapes `<` so content containing `</script>` cannot break out of the tag.
 */
export function safeJsonForScript(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

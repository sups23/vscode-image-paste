export const imageMimes = ['image/png', 'image/jpeg', 'image/webp'] as const;

// A MIME list establishes representations, not the number of original images.
export function preferredMime(mimes: readonly string[]): string | undefined {
  return imageMimes.find(mime => mimes.includes(mime));
}

export function eligibleDocument(input: {
  language: string; scheme: string; filename: string;
  untitled: boolean; localWorkspace: boolean; remote: boolean;
}): boolean {
  return input.language === 'markdown' && input.scheme === 'file'
    && /\.md$/i.test(input.filename) && !input.untitled
    && input.localWorkspace && !input.remote;
}

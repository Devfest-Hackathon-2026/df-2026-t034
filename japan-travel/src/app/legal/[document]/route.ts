import { legalDocument } from '@/lib/server/legal';
export async function GET(_request: Request, context: { params: Promise<{ document: string }> }) {
  return legalDocument((await context.params).document);
}

import { z } from 'zod';
import type { CourseInventory } from './types';

const localPath = z.string().refine(p => !/^(?:[a-z]+:|[/\\\\])|(?:^|[/\\\\])\.\.(?:[/\\\\]|$)/i.test(p), 'Evidence paths must be package-relative');
const evidence = z.object({ sourceId: z.string(), packagedPath: localPath, sourceHash: z.string().regex(/^[a-f0-9]{64}$/i),
  jsonPointerOrHeading: z.string().min(1), classification: z.enum(['O', 'M', 'I', 'P', 'U']) });
const field = z.object({ value: z.string().nullable(), availability: z.enum(['available', 'partial', 'missing', 'unknown', 'inapplicable']),
  origin: z.enum(['source_observation', 'map_paraphrase', 'app_authored', 'test_fixture', 'unknown']), evidence: z.array(evidence).min(1) });
const schema = z.object({ version: z.literal('1.0.0'), courseId: z.literal('complete-japanese'), title: z.string(),
  levels: z.array(z.object({ id: z.enum(['A1', 'A2', 'B1', 'B2']), name: z.string(), chapters: z.array(z.object({
    id: z.string(), number: z.number().int().positive(), label: z.string(), entries: z.array(z.object({
      id: z.string(), kind: z.enum(['teaching_review_card', 'checkpoint', 'certificate_entry']),
      cardOrder: z.number().int().positive().nullable(), afterCardOrder: z.number().int().nonnegative().nullable(),
      recordedSourceLabel: z.string().nullable(),
      sourceLabel: field, mappedObjective: field, evidenceDepth: z.string(), evidence: z.array(evidence).min(1),
    })),
  })) })),
});

export function validateInventory(input: unknown): CourseInventory {
  const data = schema.parse(input);
  const seen = new Set<string>();
  if (data.levels.map(l => l.id).join(',') !== 'A1,A2,B1,B2') throw new Error('Invalid level order');
  const expected = [[31, 249], [22, 208], [18, 174], [10, 73]];
  data.levels.forEach((l, li) => {
    if (l.chapters.length !== expected[li][0] || l.chapters.flatMap(c => c.entries).length !== expected[li][1]) throw new Error('Invalid totals');
    l.chapters.forEach((c, ci) => {
      const chapterId = `${l.id}.C${String(ci + 1).padStart(2, '0')}`;
      if (c.id !== chapterId || c.number !== ci + 1) throw new Error('Invalid chapter order');
      let cardOrder = 0;
      c.entries.forEach(e => {
        if (seen.has(e.id)) throw new Error('Duplicate entry');
        seen.add(e.id);
        if (e.kind === 'teaching_review_card') {
          cardOrder++;
          if (e.id !== `${c.id}.L${String(cardOrder).padStart(2, '0')}` || e.cardOrder !== cardOrder || e.afterCardOrder !== null) throw new Error('Invalid card order');
        } else {
          const suffix = e.kind === 'checkpoint' ? 'CP' : 'LT';
          if (e.id !== `${c.id}.${suffix}` || e.afterCardOrder !== cardOrder || e.cardOrder !== null) throw new Error('Invalid assessment placement');
          if (suffix === 'LT' && (l.id === 'B2' || ci !== l.chapters.length - 1)) throw new Error('Invalid certificate');
        }
      });
    });
  });
  const entries = data.levels.flatMap(l => l.chapters.flatMap(c => c.entries));
  if (entries.filter(e => e.kind === 'teaching_review_card').length !== 623 || entries.filter(e => e.kind === 'checkpoint').length !== 78 || entries.filter(e => e.kind === 'certificate_entry').length !== 3) throw new Error('Invalid entry kinds');
  return data;
}

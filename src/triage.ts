interface TriageInput {
  title: string;
  body: string;
  owner: string;
  repo: string;
  octokit: any;
}

interface TriageResult {
  labels: string[];
  comment: string | null;
}

const AREA_PATTERNS: Record<string, RegExp[]> = {
  core: [/packages\/core/i, /drizzle/i, /database/i, /queue/i, /bullmq/i, /redis/i, /neon/i],
  engineering: [/api/i, /apps\/api/i, /hono/i, /endpoint/i, /route/i, /auth/i, /oauth/i],
  design: [/ui/i, /packages\/ui/i, /component/i, /layout/i, /style/i, /css/i, /theme/i],
  documentation: [/docs/i, /apps\/docs/i, /readme/i, /documentation/i, /typo/i],
  marketing: [/apps\/web/i, /landing/i, /seo/i, /marketing/i, /copy/i],
  integration: [/github app/i, /webhook/i, /integration/i, /mcp/i, /slack/i, /linear/i],
};

const TYPE_PATTERNS: Record<string, RegExp[]> = {
  bug: [/bug/i, /broken/i, /crash/i, /error/i, /fail/i, /not working/i, /doesn't work/i, /regression/i, /500/i, /404/i, /exception/i],
  feature: [/feature/i, /add support/i, /would be nice/i, /request/i, /implement/i, /should be able/i, /new/i],
  documentation: [/docs/i, /typo/i, /documentation/i, /readme/i, /unclear/i, /confusing/i],
  question: [/how to/i, /how do/i, /is it possible/i, /\?$/i, /question/i, /help/i],
};

const PRIORITY_HIGH_PATTERNS = [/crash/i, /data loss/i, /security/i, /production/i, /urgent/i, /critical/i, /blocker/i, /can't deploy/i, /down/i];

function classify(title: string, body: string): string[] {
  const text = `${title} ${body}`;
  const labels: string[] = [];

  // Type classification
  for (const [type, patterns] of Object.entries(TYPE_PATTERNS)) {
    if (patterns.some((p) => p.test(text))) {
      labels.push(type === "feature" ? "enhancement" : type);
      break;
    }
  }

  // Area classification
  for (const [area, patterns] of Object.entries(AREA_PATTERNS)) {
    if (patterns.some((p) => p.test(text))) {
      labels.push(area);
      break;
    }
  }

  // Priority
  if (PRIORITY_HIGH_PATTERNS.some((p) => p.test(text))) {
    labels.push("priority:high");
  }

  return labels;
}

async function findDuplicates(input: TriageInput): Promise<{ number: number; title: string }[]> {
  // Get keywords from title (3+ char words, no stopwords)
  const stopwords = new Set(["the", "this", "that", "with", "from", "have", "been", "when", "does", "not", "are", "for", "and", "but"]);
  const keywords = input.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopwords.has(w));

  if (keywords.length === 0) return [];

  const { data: issues } = await input.octokit.rest.issues.listForRepo({
    owner: input.owner,
    repo: input.repo,
    state: "open",
    per_page: 50,
  });

  const matches = issues
    .filter((issue: any) => !issue.pull_request)
    .map((issue: any) => {
      const issueWords = issue.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
      const overlap = keywords.filter((k) => issueWords.includes(k)).length;
      const score = overlap / keywords.length;
      return { number: issue.number, title: issue.title, score };
    })
    .filter((m: any) => m.score >= 0.5)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 3);

  return matches;
}

export async function triageIssue(input: TriageInput): Promise<TriageResult> {
  const labels = classify(input.title, input.body);
  const duplicates = await findDuplicates(input);

  let comment: string | null = null;

  if (duplicates.length > 0) {
    const dupeList = duplicates.map((d) => `- #${d.number} — ${d.title}`).join("\n");
    comment = `👋 Thanks for opening this issue!\n\n**Possible related issues:**\n${dupeList}\n\nIf one of these covers your case, feel free to close this and add a comment there instead.`;
  }

  return { labels, comment };
}

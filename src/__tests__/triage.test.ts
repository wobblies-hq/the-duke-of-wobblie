import { describe, it, expect, vi } from "vitest";
import { triageIssue } from "../triage";

const mockOctokit = {
  rest: {
    issues: {
      listForRepo: vi.fn().mockResolvedValue({ data: [] }),
    },
  },
};

describe("triageIssue", () => {
  it("classifies a bug via keywords when no LLM available", async () => {
    const result = await triageIssue({
      title: "App crashes on login",
      body: "Getting a 500 error when trying to log in",
      owner: "wobblies-hq",
      repo: "wobbli.es",
      octokit: mockOctokit,
    });

    expect(result.labels).toContain("bug");
  });

  it("classifies a feature request", async () => {
    const result = await triageIssue({
      title: "Add support for Slack notifications",
      body: "Would be nice to get notified in Slack when a wobblie runs",
      owner: "wobblies-hq",
      repo: "wobbli.es",
      octokit: mockOctokit,
    });

    expect(result.labels).toContain("enhancement");
  });

  it("classifies documentation issues", async () => {
    const result = await triageIssue({
      title: "Typo in README",
      body: "The docs section has a broken link",
      owner: "wobblies-hq",
      repo: "wobbli.es",
      octokit: mockOctokit,
    });

    expect(result.labels).toContain("documentation");
  });

  it("detects high priority", async () => {
    const result = await triageIssue({
      title: "Security vulnerability in auth flow",
      body: "Tokens are being leaked in production logs",
      owner: "wobblies-hq",
      repo: "wobbli.es",
      octokit: mockOctokit,
    });

    expect(result.labels).toContain("priority:high");
  });

  it("detects area routing", async () => {
    const result = await triageIssue({
      title: "Bug in packages/core wobblie parser",
      body: "The drizzle query fails",
      owner: "wobblies-hq",
      repo: "wobbli.es",
      octokit: mockOctokit,
    });

    expect(result.labels).toContain("core");
  });

  it("finds duplicates when similar issues exist", async () => {
    mockOctokit.rest.issues.listForRepo.mockResolvedValueOnce({
      data: [
        { number: 5, title: "App crashes on login page", pull_request: undefined },
        { number: 10, title: "Unrelated issue about styling", pull_request: undefined },
      ],
    });

    const result = await triageIssue({
      title: "Login page crash",
      body: "",
      owner: "wobblies-hq",
      repo: "wobbli.es",
      octokit: mockOctokit,
    });

    expect(result.comment).toContain("#5");
  });

  it("returns no comment when no duplicates", async () => {
    mockOctokit.rest.issues.listForRepo.mockResolvedValueOnce({ data: [] });

    const result = await triageIssue({
      title: "Completely unique issue",
      body: "",
      owner: "wobblies-hq",
      repo: "wobbli.es",
      octokit: mockOctokit,
    });

    expect(result.comment).toBeNull();
  });
});

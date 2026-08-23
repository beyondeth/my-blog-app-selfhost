import type { Metadata } from 'next';
import Link from 'next/link';
import DocsPageLayout from '@/components/public-site/DocsPageLayout';
import {
  getSkillsInstallSnippet,
  getSkillsMaintenanceSnippet,
  getSkillsPerAgentInstallSnippet,
} from '@/app/settings/api-keys/configSnippets';

export const metadata: Metadata = {
  title: 'SKILLS',
  description:
    'Documentation for installing Codebase skills, connecting each agent, verifying setup, and guiding LLM agents.',
  alternates: {
    canonical: '/docs/skills',
  },
};

const toc = [
  { id: 'overview', label: 'Overview' },
  { id: 'global-install', label: 'Global install' },
  { id: 'per-agent-install', label: 'Per-agent install' },
  { id: 'verify-and-maintain', label: 'Verify & maintain' },
  { id: 'llm-agents', label: 'For LLM Agents' },
];

const skillsGlobalInstallCommand = getSkillsInstallSnippet(false, true);
const skillsPerAgentInstallCommands = getSkillsPerAgentInstallSnippet(false, false)
  .split('\n')
  .map((line: string) => line.trim())
  .filter(Boolean);
const skillsVerifyGlobalByAgentsCommand =
  'npx -y skills list -g -a codex -a claude-code -a gemini-cli -a antigravity';
const llmAgentsInstallGuideFetchCommand =
  'curl -s https://raw.githubusercontent.com/beyondeth/codebase-skills/refs/heads/main/docs/guide/installation.md';
const skillsMaintenanceCommands = getSkillsMaintenanceSnippet(false, true);

const agentCards = [
  { title: 'Codex', description: 'CLI install', command: skillsPerAgentInstallCommands[0] ?? '' },
  { title: 'Claude Code', description: 'CLI install', command: skillsPerAgentInstallCommands[1] ?? '' },
  { title: 'Gemini CLI', description: 'CLI install', command: skillsPerAgentInstallCommands[2] ?? '' },
  { title: 'Antigravity', description: 'CLI install', command: skillsPerAgentInstallCommands[3] ?? '' },
].filter((card) => card.command);

export default function SkillsDocsPage() {
  return (
    <DocsPageLayout
      currentPath="/docs/skills"
      title="SKILLS"
      description="A docs-style guide to the SKILLS installation flow from `/settings/api-keys`, including global install, per-agent install, verification, and the fetch path for LLM agents."
      toc={toc}
      eyebrow="Documentation"
    >
      <section id="overview">
        <h2>Overview</h2>
        <p>
          The SKILLS flow installs the Codebase skill so Codex, Claude Code, Gemini CLI, and Antigravity can use the same onboarding path.
          This page repackages the `SKILLS install` and `LLM Agents install` sections from{' '}
          <Link href="/settings/api-keys">Auto-publishing connection</Link> into docs form.
        </p>
        <div className="not-prose mt-6 rounded-[28px] border border-[#E6ECF3] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#223244] dark:bg-[#0F1720] dark:shadow-none">
          <a
            href="https://github.com/beyondeth/codebase-skills"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[#D7E3F5] bg-[#F5F9FF] px-3 py-1 text-xs font-medium text-[#1A56B5] dark:border-[#2C425A] dark:bg-[#111D29] dark:text-[#8AB4F8]"
          >
            Source · github.com/beyondeth/codebase-skills
          </a>
        </div>
      </section>

      <section id="global-install">
        <h2>Global install</h2>
        <p>
          Global install is the simplest option when you want the same skill available across all projects.
          It is also the default onboarding path in the settings screen.
        </p>
        <DocsCommandPanel
          title="Multi-agent global install"
          description="The default path for installing Codex, Claude Code, Gemini CLI, and Antigravity in one step."
          command={skillsGlobalInstallCommand}
        />
      </section>

      <section id="per-agent-install">
        <h2>Per-agent install</h2>
        <p>
          If you only want selected agents, use per-agent install. The commands below mirror the `Install by agent` cards from settings.
        </p>
        <div className="not-prose mt-6 grid gap-4 xl:grid-cols-2">
          {agentCards.map((card) => (
            <DocsCommandPanel
              key={card.title}
              title={card.title}
              description={card.description}
              command={card.command}
            />
          ))}
        </div>
      </section>

      <section id="verify-and-maintain">
        <h2>Verify &amp; maintain</h2>
        <p>
          After installation, verify the links and use the same workflow for updates or removal when needed.
        </p>
        <div className="not-prose mt-6 grid gap-4 lg:grid-cols-2">
          <DocsCommandPanel
            title="Verify agent links"
            description="Check that the skill is linked to Codex, Claude Code, Gemini CLI, and Antigravity after a global install."
            command={skillsVerifyGlobalByAgentsCommand}
          />
          <DocsCommandPanel
            title="Update / remove"
            description="Commands for checking updates or removing the installed skill."
            command={skillsMaintenanceCommands}
          />
        </div>
      </section>

      <section id="llm-agents">
        <h2>For LLM Agents</h2>
        <p>
          The `LLM Agents install` section in settings is not a separate fourth flow. It is a helper path that hands the SKILLS workflow to an agent through documentation.
          Send the fetch command below to an agent so it can read the installation guide and follow the steps.
        </p>
        <DocsCommandPanel
          title="Fetch the install guide"
          description="A fetch command you can hand to an agent so it can read and follow the installation guide."
          command={llmAgentsInstallGuideFetchCommand}
        />
      </section>
    </DocsPageLayout>
  );
}

type DocsCommandPanelProps = {
  title: string;
  description: string;
  command: string;
};

function DocsCommandPanel({ title, description, command }: DocsCommandPanelProps) {
  return (
    <div className="not-prose rounded-[28px] border border-[#E6ECF3] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#223244] dark:bg-[#0F1720] dark:shadow-none">
      <h3 className="text-lg font-semibold text-[#101828] dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">{description}</p>
      <pre className="mt-5 overflow-x-auto rounded-2xl border border-[#E6ECF3] bg-[#F8F9FA] px-4 py-4 text-[13px] leading-6 text-[#202124] dark:border-[#303134] dark:bg-[#202124] dark:text-[#E8EAED]">
        <code>{command}</code>
      </pre>
    </div>
  );
}

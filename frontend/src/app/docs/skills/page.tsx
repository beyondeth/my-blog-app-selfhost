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
    'Codebase skill 설치, agent별 연결, 설치 확인, LLM Agents 가이드를 docs 형식으로 정리한 문서입니다.',
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
  .map((line) => line.trim())
  .filter(Boolean);
const skillsVerifyGlobalByAgentsCommand =
  'npx -y skills list -g -a codex -a claude-code -a gemini-cli -a antigravity';
const llmAgentsInstallGuideFetchCommand =
  'curl -s https://raw.githubusercontent.com/beyondeth/codebase-skills/refs/heads/main/docs/guide/installation.md';
const skillsMaintenanceCommands = getSkillsMaintenanceSnippet(false, true);

const agentCards = [
  { title: 'Codex', description: 'CLI 설치', command: skillsPerAgentInstallCommands[0] ?? '' },
  { title: 'Claude Code', description: 'CLI 설치', command: skillsPerAgentInstallCommands[1] ?? '' },
  { title: 'Gemini CLI', description: 'CLI 설치', command: skillsPerAgentInstallCommands[2] ?? '' },
  { title: 'Antigravity', description: 'CLI 설치', command: skillsPerAgentInstallCommands[3] ?? '' },
].filter((card) => card.command);

export default function SkillsDocsPage() {
  return (
    <DocsPageLayout
      currentPath="/docs/skills"
      title="SKILLS"
      description="`/settings/api-keys`의 SKILLS 설치 흐름을 docs 스타일로 정리한 가이드입니다. Global 설치, agent별 설치, 설치 확인, 그리고 LLM Agents용 fetch 가이드를 한 곳에서 볼 수 있습니다."
      toc={toc}
      eyebrow="Documentation"
    >
      <section id="overview">
        <h2>Overview</h2>
        <p>
          SKILLS 방식은 Codebase skill을 설치해 Codex, Claude Code, Gemini CLI, Antigravity 같은
          환경에서 공통 온보딩 흐름을 쓰는 방법입니다. 현재 문서는{' '}
          <Link href="/settings/api-keys">자동포스팅 연결</Link> 화면의 `SKILLS 설치`와
          `LLM Agents 설치` 내용을 docs 형식으로 재정리한 것입니다.
        </p>
        <div className="not-prose mt-6 rounded-[28px] border border-[#E6ECF3] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#223244] dark:bg-[#0F1720] dark:shadow-none">
          <a
            href="https://github.com/beyondeth/codebase-skills"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[#D7E3F5] bg-[#F5F9FF] px-3 py-1 text-xs font-medium text-[#1A56B5] dark:border-[#2C425A] dark:bg-[#111D29] dark:text-[#8AB4F8]"
          >
            설치 소스 · github.com/beyondeth/codebase-skills
          </a>
        </div>
      </section>

      <section id="global-install">
        <h2>Global install</h2>
        <p>
          모든 프로젝트에서 공통으로 같은 skill을 사용하고 싶다면 전역 설치가 가장 간단합니다.
          현재 settings 화면에서도 이 경로를 기본 온보딩으로 안내합니다.
        </p>
        <DocsCommandPanel
          title="멀티 에이전트 전역 설치"
          description="Codex + Claude Code + Gemini CLI + Antigravity를 한 번에 설치하는 기본 경로입니다."
          command={skillsGlobalInstallCommand}
        />
      </section>

      <section id="per-agent-install">
        <h2>Per-agent install</h2>
        <p>
          필요한 에이전트만 따로 설치하고 싶다면 agent별 설치를 사용합니다. 아래 명령은 settings 화면의
          `Agent별 설치` 카드와 같은 내용을 문서형으로 정리한 것입니다.
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
          설치가 끝나면 링크 상태를 확인하고, 필요할 때는 업데이트와 제거도 같은 흐름에서 관리합니다.
        </p>
        <div className="not-prose mt-6 grid gap-4 lg:grid-cols-2">
          <DocsCommandPanel
            title="에이전트별 설치 확인"
            description="전역 설치 기준으로 Codex, Claude Code, Gemini CLI, Antigravity에 skill이 연결되어 있는지 확인합니다."
            command={skillsVerifyGlobalByAgentsCommand}
          />
          <DocsCommandPanel
            title="업데이트 / 제거"
            description="현재 설치된 skill의 업데이트를 확인하거나 제거할 때 사용하는 명령입니다."
            command={skillsMaintenanceCommands}
          />
        </div>
      </section>

      <section id="llm-agents">
        <h2>For LLM Agents</h2>
        <p>
          settings 화면의 `LLM Agents 설치` 영역은 별도 4번째 방식이 아니라, SKILLS 흐름을
          문서 기반 자동 설치로 넘겨주는 보조 경로입니다. 아래 fetch 명령을 에이전트에게 전달하면
          설치 문서를 읽고 절차를 따라가도록 유도할 수 있습니다.
        </p>
        <DocsCommandPanel
          title="설치 가이드 fetch"
          description="에이전트가 설치 문서를 읽고 절차를 따라가도록 전달할 수 있는 fetch 명령입니다."
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

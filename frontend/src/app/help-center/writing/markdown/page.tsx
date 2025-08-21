'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  FiArrowLeft, 
  FiChevronRight,
  FiClock,
  FiBookOpen,
  FiCode,
  FiCopy,
  FiCheck,
  FiFileText
} from 'react-icons/fi';

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

interface CodeExample {
  markdown: string;
  preview: React.ReactNode;
}

export default function MarkdownGuidePage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('basics');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ markdown, preview }: CodeExample) => (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="grid md:grid-cols-2">
        <div className="bg-gray-50 p-4 border-r border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">MARKDOWN</span>
            <button
              onClick={() => copyCode(markdown)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              {copiedCode === markdown ? (
                <FiCheck className="w-4 h-4 text-green-600" />
              ) : (
                <FiCopy className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
            {markdown}
          </pre>
        </div>
        <div className="bg-white p-4">
          <div className="mb-2">
            <span className="text-xs font-medium text-gray-500">미리보기</span>
          </div>
          <div className="prose prose-sm max-w-none">{preview}</div>
        </div>
      </div>
    </div>
  );

  const sections: Section[] = [
    {
      id: 'basics',
      title: '기본 문법',
      content: (
        <div className="space-y-6">
          <p className="text-gray-700">
            마크다운은 일반 텍스트를 서식이 있는 문서로 변환하는 간단한 마크업 언어입니다.
            몇 가지 기호만 익히면 아름다운 문서를 쉽게 작성할 수 있습니다.
          </p>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">제목 (Headers)</h3>
            <CodeBlock
              markdown={`# 제목 1
## 제목 2
### 제목 3
#### 제목 4
##### 제목 5
###### 제목 6`}
              preview={
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold">제목 1</h1>
                  <h2 className="text-2xl font-bold">제목 2</h2>
                  <h3 className="text-xl font-bold">제목 3</h3>
                  <h4 className="text-lg font-bold">제목 4</h4>
                  <h5 className="text-base font-bold">제목 5</h5>
                  <h6 className="text-sm font-bold">제목 6</h6>
                </div>
              }
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">강조 (Emphasis)</h3>
            <CodeBlock
              markdown={`*기울임체* 또는 _기울임체_
**굵은 글씨** 또는 __굵은 글씨__
***굵은 기울임체***
~~취소선~~`}
              preview={
                <div className="space-y-1">
                  <p><em>기울임체</em> 또는 <em>기울임체</em></p>
                  <p><strong>굵은 글씨</strong> 또는 <strong>굵은 글씨</strong></p>
                  <p><strong><em>굵은 기울임체</em></strong></p>
                  <p><del>취소선</del></p>
                </div>
              }
            />
          </div>
        </div>
      )
    },
    {
      id: 'lists',
      title: '목록',
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">순서 없는 목록</h3>
            <CodeBlock
              markdown={`- 첫 번째 항목
- 두 번째 항목
  - 중첩된 항목
  - 또 다른 중첩 항목
- 세 번째 항목

* 별표로도 가능
+ 더하기 기호도 가능`}
              preview={
                <div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>첫 번째 항목</li>
                    <li>두 번째 항목
                      <ul className="list-disc list-inside ml-4">
                        <li>중첩된 항목</li>
                        <li>또 다른 중첩 항목</li>
                      </ul>
                    </li>
                    <li>세 번째 항목</li>
                  </ul>
                  <ul className="list-disc list-inside mt-4">
                    <li>별표로도 가능</li>
                    <li>더하기 기호도 가능</li>
                  </ul>
                </div>
              }
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">순서 있는 목록</h3>
            <CodeBlock
              markdown={`1. 첫 번째 단계
2. 두 번째 단계
   1. 세부 단계 A
   2. 세부 단계 B
3. 세 번째 단계`}
              preview={
                <ol className="list-decimal list-inside space-y-1">
                  <li>첫 번째 단계</li>
                  <li>두 번째 단계
                    <ol className="list-decimal list-inside ml-4">
                      <li>세부 단계 A</li>
                      <li>세부 단계 B</li>
                    </ol>
                  </li>
                  <li>세 번째 단계</li>
                </ol>
              }
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">체크리스트</h3>
            <CodeBlock
              markdown={`- [x] 완료된 작업
- [ ] 진행 중인 작업
- [ ] 예정된 작업`}
              preview={
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" checked readOnly className="mr-2" />
                    <span>완료된 작업</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" readOnly className="mr-2" />
                    <span>진행 중인 작업</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" readOnly className="mr-2" />
                    <span>예정된 작업</span>
                  </label>
                </div>
              }
            />
          </div>
        </div>
      )
    },
    {
      id: 'links-images',
      title: '링크와 이미지',
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">링크</h3>
            <CodeBlock
              markdown={`[MyBlog 홈페이지](https://myblog.com)
[고객센터로 이동](/help-center)
<https://myblog.com>
[참조 스타일 링크][1]

[1]: https://myblog.com "MyBlog"`}
              preview={
                <div className="space-y-2">
                  <p><a href="#" className="text-blue-600 hover:underline">MyBlog 홈페이지</a></p>
                  <p><a href="#" className="text-blue-600 hover:underline">고객센터로 이동</a></p>
                  <p><a href="#" className="text-blue-600 hover:underline">https://myblog.com</a></p>
                  <p><a href="#" className="text-blue-600 hover:underline">참조 스타일 링크</a></p>
                </div>
              }
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">이미지</h3>
            <CodeBlock
              markdown={`![대체 텍스트](image.jpg)
![로고](logo.png "마우스 오버 텍스트")
[![클릭 가능한 이미지](thumbnail.jpg)](https://myblog.com)`}
              preview={
                <div className="space-y-4">
                  <div className="bg-gray-200 p-8 rounded text-center text-gray-500">
                    [이미지: 대체 텍스트]
                  </div>
                  <div className="bg-gray-200 p-8 rounded text-center text-gray-500">
                    [이미지: 로고]
                  </div>
                  <div className="bg-blue-100 p-8 rounded text-center text-blue-600 cursor-pointer">
                    [클릭 가능한 이미지]
                  </div>
                </div>
              }
            />
          </div>
        </div>
      )
    },
    {
      id: 'code',
      title: '코드',
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">인라인 코드</h3>
            <CodeBlock
              markdown={`텍스트 중간에 \`code\` 를 삽입할 수 있습니다.
\`npm install\` 명령어를 실행하세요.`}
              preview={
                <div className="space-y-2">
                  <p>텍스트 중간에 <code className="bg-gray-100 px-1 py-0.5 rounded">code</code> 를 삽입할 수 있습니다.</p>
                  <p><code className="bg-gray-100 px-1 py-0.5 rounded">npm install</code> 명령어를 실행하세요.</p>
                </div>
              }
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">코드 블록</h3>
            <CodeBlock
              markdown={`\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet('World');
\`\`\`

\`\`\`python
def greet(name):
    print(f"Hello, {name}!")
    
greet("World")
\`\`\``}
              preview={
                <div className="space-y-4">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <code>{`function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet('World');`}</code>
                  </pre>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                    <code>{`def greet(name):
    print(f"Hello, {name}!")
    
greet("World")`}</code>
                  </pre>
                </div>
              }
            />
          </div>
        </div>
      )
    },
    {
      id: 'quotes-lines',
      title: '인용문과 구분선',
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">인용문 (Blockquotes)</h3>
            <CodeBlock
              markdown={`> 이것은 인용문입니다.
> 여러 줄로 작성할 수 있습니다.
>
> > 중첩된 인용문도 가능합니다.
> > 이렇게 들여쓰기를 합니다.`}
              preview={
                <div className="space-y-2">
                  <blockquote className="border-l-4 border-gray-300 pl-4 text-gray-600">
                    <p>이것은 인용문입니다.</p>
                    <p>여러 줄로 작성할 수 있습니다.</p>
                    <blockquote className="border-l-4 border-gray-300 pl-4 mt-2">
                      <p>중첩된 인용문도 가능합니다.</p>
                      <p>이렇게 들여쓰기를 합니다.</p>
                    </blockquote>
                  </blockquote>
                </div>
              }
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">수평선 (Horizontal Rules)</h3>
            <CodeBlock
              markdown={`첫 번째 섹션

---

두 번째 섹션

***

세 번째 섹션

___`}
              preview={
                <div className="space-y-4">
                  <p>첫 번째 섹션</p>
                  <hr className="border-gray-300" />
                  <p>두 번째 섹션</p>
                  <hr className="border-gray-300" />
                  <p>세 번째 섹션</p>
                  <hr className="border-gray-300" />
                </div>
              }
            />
          </div>
        </div>
      )
    },
    {
      id: 'tables',
      title: '표 (Tables)',
      content: (
        <div className="space-y-6">
          <p className="text-gray-700">
            마크다운으로 표를 만들 수 있습니다. 파이프(|)와 하이픈(-)을 사용합니다.
          </p>

          <CodeBlock
            markdown={`| 제목 1 | 제목 2 | 제목 3 |
|--------|--------|--------|
| 내용 1 | 내용 2 | 내용 3 |
| 내용 4 | 내용 5 | 내용 6 |

| 왼쪽 정렬 | 가운데 정렬 | 오른쪽 정렬 |
|:----------|:-----------:|------------:|
| 왼쪽      | 가운데      | 오른쪽      |
| Left      | Center      | Right       |`}
            preview={
              <div className="space-y-4">
                <table className="min-w-full border border-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2">제목 1</th>
                      <th className="border border-gray-300 px-4 py-2">제목 2</th>
                      <th className="border border-gray-300 px-4 py-2">제목 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">내용 1</td>
                      <td className="border border-gray-300 px-4 py-2">내용 2</td>
                      <td className="border border-gray-300 px-4 py-2">내용 3</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">내용 4</td>
                      <td className="border border-gray-300 px-4 py-2">내용 5</td>
                      <td className="border border-gray-300 px-4 py-2">내용 6</td>
                    </tr>
                  </tbody>
                </table>

                <table className="min-w-full border border-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2 text-left">왼쪽 정렬</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">가운데 정렬</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">오른쪽 정렬</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 text-left">왼쪽</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">가운데</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">오른쪽</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 text-left">Left</td>
                      <td className="border border-gray-300 px-4 py-2 text-center">Center</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">Right</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            }
          />
        </div>
      )
    },
    {
      id: 'advanced',
      title: '고급 기능',
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">각주 (Footnotes)</h3>
            <CodeBlock
              markdown={`이것은 각주가 있는 문장입니다[^1].
또 다른 각주입니다[^note].

[^1]: 첫 번째 각주 내용
[^note]: 두 번째 각주 내용`}
              preview={
                <div>
                  <p>이것은 각주가 있는 문장입니다<sup className="text-blue-600">[1]</sup>.</p>
                  <p>또 다른 각주입니다<sup className="text-blue-600">[2]</sup>.</p>
                  <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                    <p>[1] 첫 번째 각주 내용</p>
                    <p>[2] 두 번째 각주 내용</p>
                  </div>
                </div>
              }
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">이스케이프 문자</h3>
            <p className="text-gray-700 text-sm">
              마크다운 기호를 그대로 표시하려면 백슬래시(\)를 사용합니다.
            </p>
            <CodeBlock
              markdown={`\\*별표를 그대로 표시\\*
\\# 샵 기호 표시
\\[대괄호 표시\\]`}
              preview={
                <div className="space-y-1">
                  <p>*별표를 그대로 표시*</p>
                  <p># 샵 기호 표시</p>
                  <p>[대괄호 표시]</p>
                </div>
              }
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">HTML 태그</h3>
            <p className="text-gray-700 text-sm">
              마크다운 내에서 HTML 태그를 직접 사용할 수 있습니다.
            </p>
            <CodeBlock
              markdown={`<div style="color: blue;">
  파란색 텍스트
</div>

<details>
<summary>클릭하여 펼치기</summary>
숨겨진 내용이 여기에 표시됩니다.
</details>`}
              preview={
                <div className="space-y-4">
                  <div style={{ color: 'blue' }}>파란색 텍스트</div>
                  <details className="border border-gray-200 rounded p-2">
                    <summary className="cursor-pointer font-medium">클릭하여 펼치기</summary>
                    <p className="mt-2">숨겨진 내용이 여기에 표시됩니다.</p>
                  </details>
                </div>
              }
            />
          </div>
        </div>
      )
    },
    {
      id: 'tips',
      title: '작성 팁',
      content: (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">💡 마크다운 작성 팁</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-amber-600 mr-2">•</span>
                <span>제목은 계층 구조를 지켜서 작성하세요 (h1 → h2 → h3)</span>
              </li>
              <li className="flex items-start">
                <span className="text-amber-600 mr-2">•</span>
                <span>문단 사이에는 빈 줄을 넣어 가독성을 높이세요</span>
              </li>
              <li className="flex items-start">
                <span className="text-amber-600 mr-2">•</span>
                <span>코드는 언어를 명시하면 구문 강조가 적용됩니다</span>
              </li>
              <li className="flex items-start">
                <span className="text-amber-600 mr-2">•</span>
                <span>이미지는 적절한 대체 텍스트를 제공하세요</span>
              </li>
              <li className="flex items-start">
                <span className="text-amber-600 mr-2">•</span>
                <span>링크는 설명적인 텍스트를 사용하세요</span>
              </li>
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">✅ 권장 사항</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-900 mb-2">좋은 예:</p>
                <code className="block bg-white p-2 rounded border border-green-200">
                  [GitHub 저장소 보기](https://github.com/...)
                </code>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-2">피해야 할 예:</p>
                <code className="block bg-white p-2 rounded border border-red-200">
                  [여기를 클릭](https://github.com/...)
                </code>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🔧 유용한 도구</h3>
            <ul className="space-y-2 text-gray-700">
              <li>• <strong>실시간 미리보기</strong>: 작성하면서 바로 결과를 확인하세요</li>
              <li>• <strong>자동 저장</strong>: 작성 중인 내용이 자동으로 저장됩니다</li>
              <li>• <strong>단축키</strong>: Ctrl/Cmd + B (굵게), Ctrl/Cmd + I (기울임)</li>
              <li>• <strong>드래그 앤 드롭</strong>: 이미지를 끌어다 놓으면 자동 업로드</li>
            </ul>
          </div>
        </div>
      )
    }
  ];

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash) {
        setActiveSection(hash);
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b bg-gray-50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                aria-label="뒤로가기"
              >
                <FiArrowLeft className="w-5 h-5" />
              </button>
              <nav className="flex items-center text-sm">
                <Link href="/help-center" className="text-gray-600 hover:text-gray-900">
                  고객센터
                </Link>
                <FiChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                <Link href="/help-center#writing" className="text-gray-600 hover:text-gray-900">
                  글쓰기 및 편집
                </Link>
                <FiChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                <span className="text-gray-900 font-medium">마크다운 가이드</span>
              </nav>
            </div>
            <div className="flex items-center text-sm text-gray-500">
              <FiClock className="w-4 h-4 mr-1" />
              <span>10분 소요</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar - Table of Contents */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">목차</h3>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveSection(section.id);
                      document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`block py-2 px-3 text-sm rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-amber-50 text-amber-700 font-medium'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 max-w-3xl">
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">마크다운 가이드</h1>
              <p className="text-lg text-gray-600">
                마크다운 문법을 익혀 더 풍부하고 아름다운 콘텐츠를 작성하세요
              </p>
            </header>

            <div className="space-y-12">
              {sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24"
                >
                  <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                    {section.title}
                  </h2>
                  {section.content}
                </section>
              ))}
            </div>

            {/* Footer Navigation */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <Link
                  href="/help-center"
                  className="inline-flex items-center text-gray-600 hover:text-gray-900"
                >
                  <FiArrowLeft className="w-4 h-4 mr-2" />
                  고객센터 홈
                </Link>
                <Link
                  href="/help-center/writing/images"
                  className="inline-flex items-center text-amber-600 hover:text-amber-700 font-medium"
                >
                  다음: 이미지 업로드
                  <FiChevronRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
            </div>
          </main>

          {/* Right Sidebar - Quick Reference */}
          <aside className="hidden xl:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">빠른 참조</h3>
              <div className="space-y-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900 mb-1">제목</p>
                  <code className="text-xs text-gray-600"># H1  ## H2  ### H3</code>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900 mb-1">강조</p>
                  <code className="text-xs text-gray-600">**굵게** *기울임* ~~취소~~</code>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900 mb-1">링크</p>
                  <code className="text-xs text-gray-600">[텍스트](URL)</code>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900 mb-1">이미지</p>
                  <code className="text-xs text-gray-600">![대체텍스트](URL)</code>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900 mb-1">코드</p>
                  <code className="text-xs text-gray-600">`인라인` ```블록```</code>
                </div>
              </div>

              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <FiFileText className="w-5 h-5 text-gray-600 mb-2" />
                <p className="text-sm font-medium text-gray-900 mb-1">연습해보세요!</p>
                <p className="text-xs text-gray-600 mb-3">
                  실시간 미리보기로 바로 확인
                </p>
                <Link
                  href="/posts/new"
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  글쓰기 시작 →
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
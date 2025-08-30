## Gemini CLI에 커스텀 MCP 서버 등록하기

Gemini CLI의 강력한 기능 중 하나는 MCP(Model Context Protocol)를 통해 기능을 확장할 수 있다는 것입니다. MCP를 사용하면 자신만의 커스텀 서버를 만들어 Gemini의 컨텍스트에 실시간으로 정보를 추가할 수 있습니다. 이 글에서는 직접 만든 MCP 서버를 Gemini CLI에 등록하는 방법을 단계별로 알아보겠습니다.

### 흔히 하는 실수: `gemini mcp add`

처음 MCP를 등록할 때 다음과 같은 명령어를 시도하기 쉽습니다.

```bash
gemini mcp add python-server python fastmcp_blog_server.py --port 8080
```

하지만 이 명령어는 'Unknown arguments' 오류를 발생시킵니다. Gemini CLI에는 'mcp add'와 같은 하위 명령어가 존재하지 않기 때문입니다.

### 올바른 등록 방법: 2단계 프로세스

올바른 방법은 '서버 실행'과 'CLI 재시작'의 2단계로 이루어집니다.

#### 1단계: MCP 서버 실행하기

먼저, 등록하려는 MCP 서버를 터미널에서 직접 실행해야 합니다. 이때 Gemini CLI와의 동시 작업을 위해 백그라운드에서 실행하는 것이 좋습니다. (명령어 끝에 `&` 추가)

```bash
python3 your_mcp_server.py --port 8080 &
```

#### 2단계: `--allowed-mcp-server-names` 플래그와 함께 Gemini CLI 재시작

MCP 서버가 실행되었다면, Gemini CLI를 다시 시작할 차례입니다. 이때 `--allowed-mcp-server-names` 플래그에 MCP 서버의 이름을 지정해주어야 합니다. 이 이름은 앞으로 해당 MCP를 식별하는 데 사용됩니다.

```bash
gemini --allowed-mcp-server-names your-server-name
```

### 정리

정리하자면, Gemini CLI에 커스텀 MCP 서버를 등록하는 과정은 다음과 같습니다.

1.  MCP 서버를 백그라운드에서 실행합니다.
2.  `--allowed-mcp-server-names` 플래그에 서버 이름을 지정하여 Gemini CLI를 실행합니다.

이제 여러분도 자신만의 MCP 서버를 만들어 Gemini의 능력을 한층 더 끌어올릴 수 있습니다!

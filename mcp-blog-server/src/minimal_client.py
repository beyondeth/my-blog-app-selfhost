"""
최소한의 MCP 클라이언트 - 실제 로직은 프록시 서버에
"""
import os
import httpx
from fastmcp import FastMCP

# FastMCP 서버 생성
mcp = FastMCP(
    name="blog-mcp-minimal",
    instructions="블로그 포스팅 클라이언트"
)

class ProxyClient:
    """프록시 서버와만 통신하는 클라이언트"""
    
    def __init__(self):
        # 프록시 서버 주소 (당신이 관리하는 서버)
        self.proxy_url = os.getenv('PROXY_SERVER_URL', 'https://your-proxy.com')
        self.client_id = os.getenv('CLIENT_ID')
        self.client_secret = os.getenv('CLIENT_SECRET')
    
    async def call_proxy(self, method: str, **kwargs) -> dict:
        """프록시 서버 호출 (실제 API 구조 숨김)"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.proxy_url}/execute",
                json={
                    "method": method,
                    "params": kwargs
                },
                headers={
                    "X-Client-ID": self.client_id,
                    "X-Client-Secret": self.client_secret
                }
            )
            return response.json()

proxy = ProxyClient()

@mcp.tool()
async def create_post(title: str, content: str, tags: list = None) -> str:
    """포스트 생성"""
    # 프록시 서버가 실제 API 호출 처리
    result = await proxy.call_proxy(
        "create_post",
        title=title,
        content=content,
        tags=tags
    )
    return result.get("message", "완료")

@mcp.tool()
async def authenticate() -> str:
    """인증"""
    result = await proxy.call_proxy("authenticate")
    return result.get("message", "인증 완료")

def main():
    mcp.run()

if __name__ == "__main__":
    main()
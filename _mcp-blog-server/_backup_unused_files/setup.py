from setuptools import setup, find_packages

setup(
    name="mcp-blog-server",
    version="1.0.0",
    description="MCP Blog Server - AI-powered blog posting automation",
    author="Your Name",
    author_email="your@email.com",
    url="https://github.com/your-org/mcp-blog-server",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "fastmcp>=0.1.0",
        "httpx>=0.24.0",
        "python-dotenv>=1.0.0",
    ],
    python_requires=">=3.8",
    entry_points={
        "console_scripts": [
            "mcp-blog-server=fastmcp_blog_server:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
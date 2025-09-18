import React from 'react';
import { KakaoTalkBubbleAdvanced, KakaoTalkBubbleCSS, KakaoTalkChat } from './KakaoTalkBubbleAdvanced';

/**
 * Demo component showing different KakaoTalk bubble implementations
 */
export const KakaoTalkDemo: React.FC = () => {
  const messages = [
    { text: "안녕하세요! 😊", isSender: false, timestamp: "오후 2:30" },
    { text: "안녕하세요!", isSender: true, timestamp: "오후 2:31" },
    { text: "오늘 날씨가 정말 좋네요", isSender: false, timestamp: "오후 2:31" },
    { text: "맞아요! 산책하기 딱 좋은 날씨예요 ☀️", isSender: true, timestamp: "오후 2:32" },
    { text: "혹시 시간 되시면 같이 커피 한 잔 어떠세요?", isSender: false, timestamp: "오후 2:33" },
    { text: "좋아요! 몇 시에 만날까요?", isSender: true, timestamp: "오후 2:33" },
  ];

  return (
    <div className="space-y-8 p-8 bg-gray-50 min-h-screen">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">KakaoTalk Message Bubbles</h1>
        <p className="text-gray-600">Exact recreation of KakaoTalk message bubble design</p>
      </div>

      {/* SVG Version */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-center">SVG Tail Version</h2>
        <KakaoTalkChat>
          {messages.map((msg, index) => (
            <KakaoTalkBubbleAdvanced
              key={index}
              message={msg.text}
              isSender={msg.isSender}
              timestamp={msg.timestamp}
            />
          ))}
        </KakaoTalkChat>
      </div>

      {/* CSS Version */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-center">Pure CSS Version</h2>
        <KakaoTalkChat>
          {messages.map((msg, index) => (
            <KakaoTalkBubbleCSS
              key={index}
              message={msg.text}
              isSender={msg.isSender}
              timestamp={msg.timestamp}
            />
          ))}
        </KakaoTalkChat>
      </div>

      {/* Usage Examples */}
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Usage Examples</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Basic Usage:</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`import { KakaoTalkBubbleAdvanced } from './KakaoTalkBubbleAdvanced';

// Sender message (yellow bubble, tail on right)
<KakaoTalkBubbleAdvanced
  message="Hello!"
  isSender={true}
  timestamp="오후 2:30"
/>

// Receiver message (gray bubble, tail on left)
<KakaoTalkBubbleAdvanced
  message="Hi there!"
  isSender={false}
  timestamp="오후 2:31"
/>`}
            </pre>
          </div>

          <div>
            <h3 className="font-medium mb-2">CSS Classes (for vanilla CSS):</h3>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`/* Import the CSS file */
@import './styles/kakao-bubble.css';

/* Use classes directly */
<div class="kakao-bubble-enhanced sender">Your message</div>
<div class="kakao-bubble-enhanced receiver">Their message</div>

/* Or use Tailwind classes */
<div class="kakao-sender">Your message</div>
<div class="kakao-receiver">Their message</div>`}
            </pre>
          </div>
        </div>
      </div>

      {/* Technical Details */}
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Technical Details</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-2">Design Specifications:</h3>
            <ul className="text-sm space-y-1 text-gray-600">
              <li>• Border radius: 18px for organic curves</li>
              <li>• Sender color: #FAE100 (KakaoTalk yellow)</li>
              <li>• Receiver color: #3d3d3d (dark gray)</li>
              <li>• Tail positioned at top-right/left</li>
              <li>• Smooth curved tail transition</li>
              <li>• Max width: 280px (mobile-friendly)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Implementation Options:</h3>
            <ul className="text-sm space-y-1 text-gray-600">
              <li>• SVG tails for perfect curves</li>
              <li>• CSS pseudo-elements for performance</li>
              <li>• Clip-path for complex shapes</li>
              <li>• Tailwind CSS compatible</li>
              <li>• React TypeScript components</li>
              <li>• Production-ready and accessible</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KakaoTalkDemo;
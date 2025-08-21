'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  FiArrowLeft, 
  FiMail, 
  FiMessageSquare, 
  FiClock,
  FiSend,
  FiAlertCircle
} from 'react-icons/fi';
import { toast } from 'sonner';

interface ContactForm {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
}

export default function ContactPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ContactForm>({
    name: '',
    email: '',
    category: 'general',
    subject: '',
    message: ''
  });

  const categories = [
    { value: 'general', label: '일반 문의' },
    { value: 'account', label: '계정 문제' },
    { value: 'billing', label: '결제 및 환불' },
    { value: 'technical', label: '기술 지원' },
    { value: 'bug', label: '버그 신고' },
    { value: 'feature', label: '기능 제안' },
    { value: 'abuse', label: '신고 및 악용' },
    { value: 'other', label: '기타' },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast.error('모든 필수 항목을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Implement actual submission to backend
      // const response = await fetch('/api/v1/support/contact', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData),
      // });

      // Simulate submission
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('문의가 성공적으로 접수되었습니다. 빠른 시일 내에 답변 드리겠습니다.');
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        category: 'general',
        subject: '',
        message: ''
      });
      
      // Redirect to help center after 2 seconds
      setTimeout(() => {
        router.push('/help-center');
      }, 2000);
    } catch (error) {
      toast.error('문의 접수 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/help-center"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <FiArrowLeft className="w-4 h-4 mr-2" />
            고객센터로 돌아가기
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">문의하기</h1>
          <p className="mt-2 text-gray-600">궁금한 점이나 문제가 있으신가요? 언제든지 문의해주세요.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Contact Information */}
          <div className="md:col-span-1">
            <div className="bg-gray-50 rounded-lg p-6 space-y-6">
              <div>
                <div className="flex items-center mb-3">
                  <FiMail className="w-5 h-5 text-amber-600 mr-3" />
                  <h3 className="font-semibold text-gray-900">이메일</h3>
                </div>
                <p className="text-gray-600 text-sm">support@myblog.com</p>
                <p className="text-gray-500 text-xs mt-1">24시간 이내 답변</p>
              </div>

              <div>
                <div className="flex items-center mb-3">
                  <FiClock className="w-5 h-5 text-amber-600 mr-3" />
                  <h3 className="font-semibold text-gray-900">운영 시간</h3>
                </div>
                <p className="text-gray-600 text-sm">평일 09:00 - 18:00</p>
                <p className="text-gray-500 text-xs mt-1">주말 및 공휴일 휴무</p>
              </div>

              <div>
                <div className="flex items-center mb-3">
                  <FiMessageSquare className="w-5 h-5 text-amber-600 mr-3" />
                  <h3 className="font-semibold text-gray-900">답변 시간</h3>
                </div>
                <p className="text-gray-600 text-sm">평균 12시간 이내</p>
                <p className="text-gray-500 text-xs mt-1">긴급 문의는 우선 처리</p>
              </div>
            </div>

            {/* Quick Links */}
            <div className="mt-6 bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">빠른 도움말</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/help-center/faq" className="text-sm text-blue-600 hover:text-blue-800">
                    → 자주 묻는 질문
                  </Link>
                </li>
                <li>
                  <Link href="/help-center/getting-started" className="text-sm text-blue-600 hover:text-blue-800">
                    → 시작 가이드
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-sm text-blue-600 hover:text-blue-800">
                    → 이용약관
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-sm text-blue-600 hover:text-blue-800">
                    → 개인정보처리방침
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Contact Form */}
          <div className="md:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="홍길동"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    이메일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                  문의 유형 <span className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6">
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="문의 제목을 입력해주세요"
                />
              </div>

              <div className="mt-6">
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  문의 내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="문의하실 내용을 자세히 작성해주세요..."
                />
                <p className="mt-2 text-sm text-gray-500">
                  최대한 자세히 작성해주시면 더 정확한 답변을 드릴 수 있습니다.
                </p>
              </div>

              {/* Notice */}
              <div className="mt-6 p-4 bg-amber-50 rounded-lg flex items-start">
                <FiAlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm text-amber-800">
                    <strong>개인정보 보호 안내</strong>
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    문의 내용에 비밀번호, 카드번호 등의 민감한 정보는 포함하지 마세요.
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="mt-8">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full md:w-auto px-8 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      전송 중...
                    </>
                  ) : (
                    <>
                      <FiSend className="w-4 h-4 mr-2" />
                      문의 보내기
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load env from openclaw-lab
dotenv.config({ path: resolve(__dirname, '../../openclaw-lab/.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PLAN_DATA = {
  meta: {
    title: '나의 사업계획서',
    version: 1,
  },
  general_status: {
    item_name: 'MCP 기반 AI 자동 블로깅 및 인사이트 커뮤니티 SaaS',
    product_type: '웹 서비스(my-blog-app), MCP 서버, 페르소나 엔진',
    representative: { 
      name: '박시형', 
      career: '비개발자 출신 풀스택 개발자 / AI 프롬프트 엔지니어링 전문가' 
    },
    team_members: []
  },
  overview: {
    item_name: 'my-blog-app (Moltbook)',
    category: '지식서비스 / 인공지능 / 소셜 커뮤니티',
    summary: 'AI 학습 및 연구 과정에서 발생하는 방대한 대화와 맥락을 단순히 저장하는 것을 넘어, 사용자의 페르소나를 입혀 "읽기 좋은 블로그 글"로 자동 변환하고 아카이빙하는 서비스입니다. 이를 통해 개인은 "지식의 휘발"을 막고, 플랫폼은 검증된 AI 활용 노하우가 공유되는 "한국형 AI 3대 강국 도약의 공론장"을 제공합니다.',
    problem_awareness: 'AI 기술의 급격한 발전으로 정보 습득 속도는 빨라졌으나, 이를 정리하고 내재화하는 "기록의 속도"는 따라가지 못하고 있습니다. 개인의 귀중한 인사이트가 채팅 로그 속에 매몰되고 있으며, 검증된 프롬프트 엔지니어링 노하우가 공유되지 않아 사회적 AI 문해력 격차가 심화되고 있습니다.',
    realization_plan: '1단계로 MCP(Model Context Protocol) 기술을 활용해 로컬 LLM과 직접 연동되는 "자동 블로깅 에이전트"를 개발하여 기록의 장벽을 제거합니다. 2단계로 다양한 글쓰기 스타일을 모사하는 "페르소나 엔진"을 탑재해 콘텐츠의 품질을 높입니다. 3단계로 이렇게 생성된 고품질 콘텐츠가 모이는 커뮤니티를 구축하여 "프롬프트 마켓플레이스"로 확장합니다.',
    growth_strategy: '초기에는 개발자 및 AI 얼리어답터를 대상으로 무료 베타 서비스를 제공하여 "헤비 유저"를 확보하고 기술적 완성도를 높입니다. 이후 검증된 프롬프트와 페르소나 템플릿을 유료로 거래할 수 있는 마켓을 오픈하여 크리에이터 경제를 구축합니다. 장기적으로는 기업용 B2B 지식 관리 솔루션(SaaS)으로 확장하여 안정적인 수익 모델을 창출합니다.',
    team_plan: '현재 AI 및 풀스택 개발 역량을 보유한 1인 대표 체제로 시작하며, 초기 MVP 개발 완료 후 마케팅/커뮤니티 매니저를 영입하여 유저 확보에 주력할 예정입니다. 시리즈 A 투자 유치 시점에는 전문 CTO 및 AI 리서처를 채용하여 기술 격차를 벌리고 글로벌 진출을 준비할 계획입니다.'
  },
  problem: {
    title1: '지식의 휘발과 기록의 한계 (Velocity Problem)',
    content1: '비개발자 출신으로 AI를 독학하며 느낀 가장 큰 고통은 "배움의 속도를 기록이 따라가지 못한다"는 것이었습니다. AI와의 대화에서 얻은 엄청난 인사이트들이 채팅창 속에 갇혀 휘발되거나, 이를 정리하려면 과거의 대화 맥락을 다시 찾는 데만 1시간이 걸리는 등 막대한 비효율이 발생했습니다. 기존의 블로그는 수동 작성을 전제로 하기에 AI 시대의 학습 속도를 감당할 수 없습니다.',
    title2: '고품질 AI 학습 데이터 및 커뮤니티의 부재 (The Gap)',
    content2: '현재 AI 관련 정보는 범람하지만, "실제 맥락(Context)이 살아있는 검증된 정보"는 부족합니다. 대부분 파편화된 프롬프트나 결과물만 공유될 뿐, 어떤 맥락에서 도출되었는지 알 수 없습니다. Reddit 같은 고밀도 기술 커뮤니티가 국내에는 부재하여, 정보 격차로 인해 도태되는 계층이 늘어나고 있습니다.'
  },
  solution: {
    title1: 'MCP 기반 자동 블로깅 시스템',
    content1: '사용자 로컬 환경의 LLM과 직접 연동되는 MCP(Model Context Protocol) 서버를 구축했습니다. 사용자가 "이 내용 포스팅해줘"라고 명령하면, AI는 단순 요약이 아닌 저장된 사용자의 문체, 선호 형식, 기존 지식 맥락을 모두 반영하여 마치 "또 다른 자아"가 쓴 듯한 고품질 포스팅을 실시간으로 자동 생성합니다.',
    title2: '커스터마이징 가능한 페르소나 엔진',
    content2: '단일한 AI 말투가 아닌, 사용자가 직접 정의한 "글쓰기 페르소나"를 적용할 수 있습니다. 예를 들어 "친절한 선생님 톤", "냉철한 분석가 톤" 등을 스킨처럼 교체하며 글을 재생산할 수 있습니다. 이는 단순 텍스트 생성을 넘어 프롬프트 엔지니어링의 대중화를 이끄는 핵심 킬러 기능입니다.',
    schedule: [
      { id: 1, task: 'MVP 개발 및 MCP 서버 구축', period: '2026.01 - 2026.03', detail: '기본적인 자동 포스팅 기능 및 로컬 LLM 연동 테스트 완료' },
      { id: 2, task: '클로즈 베타 (CBT) 및 페르소나 엔진 고도화', period: '2026.04 - 2026.06', detail: '초기 유저 100명 모집, 피드백 반영 및 다양한 글쓰기 스타일 템플릿 추가' },
      { id: 3, task: '오픈 베타 (OBT) 및 커뮤니티 기능 런칭', period: '2026.07 - 2026.09', detail: '게시글 공유, 댓글, 좋아요 등 소셜 기능 추가 및 마케팅 시작' },
      { id: 4, task: '정식 서비스 런칭 및 유료 모델 도입', period: '2026.10 - ', detail: '프리미엄 페르소나 구독 모델 및 프롬프트 마켓플레이스 오픈' }
    ]
  },
  budget: {
    step1: [
        { category: '인건비', basis: '백엔드/AI 모델링 개발자 (1명 * 8개월)', amount: '30,000,000' },
        { category: '광고선전비', basis: '초기 커뮤니티 시딩 및 챌린지 이벤트', amount: '10,000,000' },
        { category: '서버/인프라비', basis: 'Vector DB 및 GPU 인스턴스 비용', amount: '5,000,000' },
        { category: '지급수수료', basis: 'PG사 연동 및 세무기장', amount: '2,000,000' },
    ],
    step1_total: '47,000,000',
    step2: [
        { category: '재료비', basis: '-', amount: '0' },
        { category: '외주용역비', basis: 'UI/UX 디자인 리뉴얼 용역', amount: '5,000,000' },
        { category: '기계장치', basis: '개발용 고성능 GPU 워크스테이션', amount: '3,000,000' },
        { category: '특허권등', basis: '상표권 및 기술 특허 출원 비용', amount: '2,000,000' },
        { category: '인건비', basis: '-', amount: '0' },
        { category: '지급수수료', basis: '법률 자문 및 회계 감사', amount: '1,000,000' },
        { category: '교육훈련비', basis: '최신 AI 트렌드 컨퍼런스 참가', amount: '1,000,000' },
        { category: '여비', basis: '투자자 미팅 및 영업 활동비', amount: '1,000,000' },
        { category: '회계감사비', basis: '-', amount: '0' },
    ],
    step2_total: '13,000,000'
  },
  scale_up: {
    title1: '"유저는 돈이 아니다, 자산이다" (Free Traffic Model)',
    content1: '초기 진입 장벽을 없애기 위해 B2C 서비스는 전면 무료로 제공합니다. 이를 통해 대규모 트래픽과 "헤비 유저(프롬프트 엔지니어)"를 확보합니다. 유저 자체가 플랫폼의 가치가 되는 구조를 만듭니다.',
    title2: '데이터 판매 및 네이티브 광고 (B2B Revenue)',
    content2: '1. Data Sales: 플랫폼에 쌓인 "맥락이 포함된 고품질 AI 대화 데이터"는 일반 웹 크롤링 데이터보다 AI 학습용으로 훠씬 높은 가치를 지닙니다. 이를 익명화하여 AI 기업에 라이선싱합니다.\n2. Native Ads: Reddit처럼 피드 사이에 자연스럽게 녹아드는 "맥락 광고"를 도입하여, 유저 경험을 해치지 않으면서 수익을 창출합니다.',
    schedule: [
      { id: 1, task: '글로벌 버전 출시 (영어/일본어 지원)', period: '2027.01 - 2027.06', detail: '해외 LLM 유저 유입을 위한 다국어 지원 및 해외 커뮤니티 마케팅' },
      { id: 2, task: '엔터프라이즈 B2B 솔루션 런칭', period: '2027.07 - 2027.12', detail: '기업 내부 지식 공유 및 온보딩 자동화를 위한 Private SaaS 제공' },
      { id: 3, task: '시리즈 A 투자 유치', period: '2028.01 - 2028.06', detail: '기업 가치 100억 목표, 전문 인력 대규모 채용' },
      { id: 4, task: 'AI 데이터 파이프라인 수익화', period: '2028.07 - ', detail: '고품질 대화 데이터를 정제하여 LLM 개발사(OpenAI, Google 등)에 데이터셋 판매' }
    ]
  },
  team: {
    title1: '대표자 역량',
    content1: '비개발자 출신으로 시작하여 독학으로 풀스택 개발 및 AI 서비스를 구축한 집념의 실행가. 사용자의 니즈(Needs)와 페인포인트(Pain Point)를 누구보다 정확히 이해하고 있습니다. 특히 MCP 등 최신 AI 기술 트렌드에 대한 높은 이해도를 바탕으로 빠르게 제품을 기획하고 실행할 수 있는 역량을 갖추고 있습니다.',
    members: [
      { id: 1, role: '기획/마케팅', task: '서비스 기획 및 커뮤니티 운영', career: '스타트업 마케팅 3년 경력, 브런치 작가 활동 중', status: '채용 예정' },
      { id: 2, role: '프론트엔드', task: '웹 대시보드 및 UI/UX 개발', career: 'React/Next.js 프로젝트 다수 경험', status: '채용 예정' }
    ],
    partners: [
      { id: 1, name: 'Google for Startups', capability: '클라우드 인프라 지원', method: 'Credits 프로그램 지원', timing: '2026.01' },
      { id: 2, name: '예비창업패키지 멘토단', capability: '사업화 멘토링 및 네트워킹', method: '정기 멘토링 세션', timing: '2026.05' }
    ]
  }
};

async function seed() {
  console.log("Seeding Plan Data...");
  
  // Assuming we are updating a specific plan OR creating a new snapshot.
  // For demo, let's create a new 'plan_snapshots' row for a dummy plan_id or current user.
  // Actually, 'usePlanStore' saves to 'plan_snapshots'.
  // However, without a 'business_plans' row, it might fail foreign key.
  
  let { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
  
  let USER_ID: string;

  if (!users || users.length === 0) {
      console.log("No users found. Creating dummy user...");
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: 'admin@moltbook.com',
          password: 'password123',
          email_confirm: true
      });
      if (createError || !newUser.user) {
         console.error("Failed to create user:", createError);
         return;
      }
      USER_ID = newUser.user.id;
  } else {
      USER_ID = users[0].id;
  }
  const PLAN_ID = '931cb178-1e8d-4492-89d8-958508b9f209'; // Conversation ID as Plan ID for uniqueness
  
  console.log(`Attaching Plan to User: ${USER_ID}`);

  // Ensure Plan Exists
  const { error: planError } = await supabase
    .from('business_plans')
    .upsert({ id: PLAN_ID, user_id: USER_ID, title: 'AI Blog SaaS Plan' });
    
  if (planError) console.warn("Plan Upsert Warning:", planError.message);

  console.log("Clearing old snapshots...");
  await supabase.from('plan_snapshots').delete().eq('plan_id', PLAN_ID);
  
  const { error } = await supabase
        .from('plan_snapshots')
        .insert({
          plan_id: PLAN_ID,
          content: PLAN_DATA,
          version: 1,
          // created_at: new Date() // Let DB handle defaults to avoid schema cache issues
        });
        
  if (error) {
      console.error("Seeding Failed:", error);
  } else {
      console.log("Seeding Successful! Plan ID:", PLAN_ID);
  }
}

seed();

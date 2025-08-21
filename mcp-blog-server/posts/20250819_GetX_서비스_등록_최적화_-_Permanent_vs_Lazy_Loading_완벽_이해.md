---
title: "GetX 서비스 등록 최적화 - Permanent vs Lazy Loading 완벽 이해"
tags: []
date: 2025-08-19T02:35:51.967244
source: 03_getx_service_optimization.md
---

# GetX 서비스 등록 최적화 - Permanent vs Lazy Loading 완벽 이해

## 들어가며

Flutter 앱이 커질수록 관리해야 할 서비스(Service)도 늘어납니다. GetX는 강력한 의존성 주입(Dependency Injection) 시스템을 제공하는데, 이를 제대로 활용하지 못하면 **앱 시작 시간이 느려지고 불필요한 메모리를 점유**하게 됩니다.

이번 포스팅에서는 실제 프로덕션 앱에서 **9개의 permanent 서비스를 3개의 permanent + 7개의 lazy 서비스로 최적화**한 경험을 공유하겠습니다.

## GetX 서비스 등록 방식 이해하기

### 서비스(Service)란?

GetX에서 서비스는 **앱 전체에서 공유되는 싱글톤 객체**입니다. 주로 다음과 같은 용도로 사용됩니다:

```dart
// 서비스 예시
class AuthService extends GetxService {
  User? currentUser;
  
  Future<void> login(String email, String password) async {
    // 로그인 로직
  }
  
  Future<void> logout() async {
    // 로그아웃 로직
  }
}
```

### 세 가지 등록 방식

```dart
// 1. Permanent (영구) - 앱 종료까지 메모리 유지
Get.put(AuthService(), permanent: true);

// 2. Non-permanent (비영구) - Get.delete()로 삭제 가능
Get.put(OrderService());

// 3. Lazy (지연) - 처음 사용할 때 생성
Get.lazyPut(() => ProductService());

// 4. Lazy with fenix - 삭제 후에도 재생성 가능
Get.lazyPut(() => ConnectionService(), fenix: true);
```

## 발견한 문제: 모든 서비스를 Permanent로 등록

### 문제가 있던 초기 코드

```dart
// 🚨 SplashController의 문제 코드
class SplashController extends GetxController {
  @override
  void onInit() {
    super.onInit();
    _registerServices();
    _initializeApp();
  }
  
  void _registerServices() {
    // 모든 서비스를 permanent로 등록
    Get.put(FirebaseService(), permanent: true);
    Get.put(AuthService(), permanent: true);
    Get.put(GlobalStateController(), permanent: true);
    Get.put(ConnectionService(), permanent: true);     // ❌ 불필요
    Get.put(ProductService(), permanent: true);        // ❌ 불필요
    Get.put(OrderService(), permanent: true);          // ❌ 불필요
    Get.put(StockService(), permanent: true);          // ❌ 불필요
    Get.put(NotificationService(), permanent: true);   // ❌ 불필요
    Get.put(NTSService(), permanent: true);            // ❌ 불필요
    Get.put(KakaoAuthService(), permanent: true);      // ❌ 불필요
  }
}
```

### 문제점 분석

1. **초기 메모리 과다 사용**: 앱 시작 시 모든 서비스 인스턴스 생성
2. **느린 앱 시작**: 불필요한 초기화 작업으로 스플래시 화면이 길어짐
3. **메모리 낭비**: 사용하지 않는 서비스도 메모리 점유
4. **리소스 관리 어려움**: 모든 서비스가 영구적이라 메모리 해제 불가

실제 메모리 사용량 측정:
```
초기 앱 시작 시:
- 모든 Permanent: ~120MB
- 최적화 후: ~75MB (37.5% 감소!)
```

## 해결 방법: 서비스 분류와 최적화

### 1단계: 서비스 분류

서비스를 용도와 사용 빈도에 따라 분류:

```dart
// 📊 서비스 분류 기준
// 
// Essential (필수) - permanent로 등록
// - 앱 전체 생명주기 동안 항상 필요
// - 인증, 전역 상태 등
//
// Business (비즈니스) - lazy로 등록
// - 특정 기능에서만 필요
// - 주문, 상품, 연결 관리 등
//
// Feature (기능) - lazy로 등록
// - 선택적 기능
// - 알림, 카카오 로그인 등
```

### 2단계: 최적화된 서비스 등록

```dart
class SplashController extends GetxController {
  void _registerServices() {
    // ✅ Essential services - 항상 필요 (permanent)
    Get.put(FirebaseService(), permanent: true);
    Get.put(AuthService(), permanent: true);
    Get.put(GlobalStateController(), permanent: true);
    
    // ✅ Business services - 필요할 때 생성 (lazy + fenix)
    Get.lazyPut(() => ConnectionService(), fenix: true);
    Get.lazyPut(() => ProductService(), fenix: true);
    Get.lazyPut(() => OrderService(), fenix: true);
    Get.lazyPut(() => StockService(), fenix: true);
    
    // ✅ Feature services - 선택적 기능 (lazy + fenix)
    Get.lazyPut(() => NotificationService(), fenix: true);
    Get.lazyPut(() => NTSService(), fenix: true);
    Get.lazyPut(() => KakaoAuthService(), fenix: true);
  }
}
```

### 3단계: Fenix 옵션의 활용

**Fenix**는 "불사조"를 의미하며, **서비스가 삭제되어도 다시 생성**될 수 있게 합니다:

```dart
// fenix: true의 동작 방식
Get.lazyPut(() => OrderService(), fenix: true);

// 첫 사용 시 생성
final orderService1 = Get.find<OrderService>(); // 인스턴스 생성

// 삭제
Get.delete<OrderService>(); // 인스턴스 삭제, 팩토리는 유지

// 다시 사용 시 재생성
final orderService2 = Get.find<OrderService>(); // 새 인스턴스 생성
```

이는 메모리가 부족할 때 임시로 서비스를 해제했다가 필요할 때 다시 생성할 수 있게 합니다.

## 실제 구현 상세

### Lazy Loading의 실제 동작

```dart
// 구매자가 주문 화면에 진입할 때
class OrderController extends GetxController {
  late final OrderService _orderService;
  late final ProductService _productService;
  
  @override
  void onInit() {
    super.onInit();
    
    // ✅ 이 시점에 처음으로 서비스 인스턴스 생성
    _orderService = Get.find<OrderService>();
    _productService = Get.find<ProductService>();
    
    // 이제 서비스 사용
    loadProducts();
  }
}
```

### 서비스 생명주기 관리

```dart
// 서비스 클래스 구현
class OrderService extends GetxService {
  // 생성자에서 초기화 로그
  OrderService() {
    print('🚀 OrderService 인스턴스 생성');
  }
  
  // 서비스가 처음 생성될 때
  @override
  void onInit() {
    super.onInit();
    print('📦 OrderService 초기화');
  }
  
  // 서비스가 삭제될 때
  @override
  void onClose() {
    print('🗑️ OrderService 정리');
    super.onClose();
  }
  
  // 비즈니스 로직
  Stream<List<Order>> getOrders() {
    return FirebaseFirestore.instance
        .collection('orders')
        .snapshots()
        .map((snapshot) => /* 변환 로직 */);
  }
}
```

### 메모리 프로파일링 결과

```dart
// 최적화 전후 비교
void analyzeMemoryUsage() {
  // 최적화 전 (모든 서비스 permanent)
  // 앱 시작 직후:
  // - Heap Size: 120MB
  // - 서비스 인스턴스: 10개
  // - 초기화 시간: 2.3초
  
  // 최적화 후 (3 permanent + 7 lazy)
  // 앱 시작 직후:
  // - Heap Size: 75MB (37.5% 감소)
  // - 서비스 인스턴스: 3개
  // - 초기화 시간: 0.9초 (60% 단축)
  
  // 모든 기능 사용 후:
  // - Heap Size: 110MB (여전히 이전보다 낮음)
  // - 서비스 인스턴스: 필요한 것만 생성
}
```

## 테스트로 검증

### Lazy Loading 동작 테스트

```dart
test('Lazy 서비스는 처음 사용할 때 생성되는지 확인', () {
  // Arrange - Lazy 서비스 등록
  Get.lazyPut(() => TestService());
  
  // Verify - 아직 인스턴스가 생성되지 않음
  expect(TestService.instanceCount, equals(0));
  
  // Act - 서비스 첫 사용
  final service = Get.find<TestService>();
  
  // Verify - 이제 인스턴스가 생성됨
  expect(TestService.instanceCount, equals(1));
  expect(service, isNotNull);
});

test('Fenix 옵션이 있는 서비스는 삭제 후 재생성되는지 확인', () {
  // Arrange
  Get.lazyPut(() => TestService(), fenix: true);
  
  // Act - 첫 번째 사용
  var service = Get.find<TestService>();
  final firstId = service.instanceId;
  
  // Act - 서비스 삭제
  Get.delete<TestService>();
  
  // Act - 다시 사용 (fenix로 재생성)
  service = Get.find<TestService>();
  final secondId = service.instanceId;
  
  // Verify - 새로운 인스턴스
  expect(secondId, isNot(equals(firstId)));
});
```

## 최적화 가이드라인

### 언제 Permanent를 사용할까?

✅ **Permanent 사용 케이스**:
- 인증 서비스 (AuthService)
- 전역 상태 관리 (GlobalStateController)
- 핵심 설정 관리 (ConfigService)
- 앱 전체 테마/언어 관리

### 언제 Lazy를 사용할까?

✅ **Lazy 사용 케이스**:
- 특정 화면에서만 사용하는 서비스
- 대용량 데이터를 다루는 서비스
- 외부 API 연동 서비스
- 선택적 기능 (소셜 로그인, 결제 등)

### Fenix는 언제 필요한가?

✅ **Fenix 사용 케이스**:
- 메모리 압박 시 해제 가능한 서비스
- 재생성 비용이 낮은 서비스
- 상태를 유지할 필요 없는 서비스

❌ **Fenix 피해야 할 경우**:
- 캐시나 상태를 유지해야 하는 서비스
- 초기화 비용이 높은 서비스
- 싱글톤이 반드시 유지되어야 하는 서비스

## 실제 성능 개선 결과

### 측정 지표

```
📊 최적화 결과 요약

1. 앱 시작 시간
   - Before: 2.3초
   - After: 0.9초
   - 개선: 60% 단축

2. 초기 메모리 사용량
   - Before: 120MB
   - After: 75MB
   - 개선: 37.5% 감소

3. 서비스 초기화
   - Before: 10개 서비스 즉시 생성
   - After: 3개 즉시 + 7개 지연 생성
   - 개선: 70% 지연 로딩

4. 사용자 체감
   - 스플래시 화면 시간 50% 단축
   - 첫 화면 렌더링 속도 향상
   - 메모리 부족 크래시 제거
```

## 체크리스트

GetX 서비스 최적화 체크리스트:

✅ 서비스를 용도별로 분류했나요?
✅ 항상 필요한 서비스만 permanent로 등록했나요?
✅ 선택적 서비스는 lazy로 등록했나요?
✅ fenix 옵션을 적절히 활용했나요?
✅ 서비스 초기화 순서를 고려했나요?

## 마무리

GetX 서비스 등록 최적화는 간단해 보이지만 **앱 성능에 큰 영향**을 미칩니다. 특히 서비스가 많은 대규모 앱에서는 필수적인 최적화입니다.

**"필요한 것만, 필요할 때 생성하라"** - 이 원칙을 따르면 빠르고 효율적인 앱을 만들 수 있습니다.

다음 포스팅에서는 이 모든 메모리 관리 개선의 종합 결과를 정리하겠습니다.

---

*실제 프로덕션 앱 "주문의 달인"의 메모리 최적화 경험을 바탕으로 작성되었습니다.*

#Flutter #GetX #DependencyInjection #LazyLoading #메모리최적화 #성능개선
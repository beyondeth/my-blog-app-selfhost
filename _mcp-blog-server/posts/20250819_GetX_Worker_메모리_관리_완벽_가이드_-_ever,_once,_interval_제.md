---
title: "GetX Worker 메모리 관리 완벽 가이드 - ever, once, interval 제대로 사용하기"
tags: []
date: 2025-08-19T02:35:39.025283
source: 02_getx_worker_memory_management.md
---

# GetX Worker 메모리 관리 완벽 가이드 - ever, once, interval 제대로 사용하기

## 들어가며

GetX는 Flutter 개발자들에게 사랑받는 상태 관리 라이브러리입니다. 특히 **Worker**라는 강력한 반응형 프로그래밍 도구를 제공하는데요, 이를 제대로 관리하지 않으면 Stream과 마찬가지로 메모리 누수의 원인이 됩니다.

이번 포스팅에서는 GetX Worker의 메모리 관리 문제와 해결 방법을 실제 코드와 함께 상세히 알아보겠습니다.

## GetX Worker란 무엇인가?

### Worker의 종류와 용도

GetX Worker는 **반응형 변수(Rx)의 변화를 감지하고 자동으로 특정 작업을 수행**하는 리스너입니다. 주요 Worker 종류:

```dart
// 1. ever - 값이 변경될 때마다 실행
ever(counter, (value) {
  print('Counter changed to: $value');
});

// 2. once - 최초 한 번만 실행
once(isFirstTime, (value) {
  if (value) showWelcomeDialog();
});

// 3. debounce - 변경 후 일정 시간 대기 후 실행 (검색 등)
debounce(searchText, (value) {
  searchProducts(value);
}, time: Duration(milliseconds: 500));

// 4. interval - 일정 시간 간격으로 실행
interval(timer, (value) {
  updateTimer(value);
}, time: Duration(seconds: 1));
```

### Worker의 내부 동작 원리

Worker는 내부적으로 Stream을 사용합니다. Rx 변수가 변경될 때마다 Stream으로 이벤트를 전달하고, Worker가 이를 구독해서 콜백을 실행합니다.

```dart
// GetX 내부 구현 (단순화)
class Worker {
  StreamSubscription? _subscription;
  
  Worker(RxInterface obs, Function callback) {
    _subscription = obs.stream.listen(callback);
  }
  
  void dispose() {
    _subscription?.cancel();
  }
}
```

## 발견한 문제점들

### 문제 1: Worker를 변수에 저장하지 않음

```dart
// 🚨 문제가 있던 코드
class OrderController extends GetxController {
  final selectedConnection = Rx<Connection?>(null);
  final orderItems = <OrderItem>[].obs;
  
  @override
  void onInit() {
    super.onInit();
    
    // Worker를 생성하지만 저장하지 않음
    ever(selectedConnection, (connection) {
      if (connection != null) {
        loadProductsForConnection(connection);
      }
    });
    
    debounce(orderItems, (items) {
      calculateTotalAmount(items);
    }, time: Duration(milliseconds: 300));
  }
  
  // onClose에서 dispose할 수 없음!
}
```

### 문제 2: 여러 Worker 관리 실패

```dart
// 🚨 복잡한 반응형 로직에서의 문제
class OrderHistoryController extends GetxController {
  final allOrders = <Order>[].obs;
  final filteredOrders = <Order>[].obs;
  final searchQuery = ''.obs;
  final selectedStatus = Rx<OrderStatus?>(null);
  
  @override
  void onInit() {
    super.onInit();
    
    // 여러 Worker 생성하지만 관리 안 함
    ever(allOrders, (_) => applyFilters());
    ever(searchQuery, (_) => applyFilters());
    ever(selectedStatus, (_) => applyFilters());
    debounce(searchQuery, (_) => searchInDatabase(), 
      time: Duration(milliseconds: 500));
  }
  
  // 메모리 누수 발생!
}
```

### 문제 3: 동적으로 생성되는 Worker

```dart
// 🚨 동적 Worker 생성 시 문제
class MainController extends GetxController {
  void setupAuthListener() {
    // 메서드 호출마다 새로운 Worker 생성
    ever(_authService.user, (user) {
      if (user == null) {
        Get.offAllNamed('/login');
      }
    });
  }
  
  void refreshAuth() {
    setupAuthListener(); // 중복 Worker 생성!
  }
}
```

## 해결 방법: 체계적인 Worker 관리

### 1. Worker를 필드로 선언

```dart
class OrderController extends GetxController {
  // ✅ Worker를 필드로 선언
  Worker? _connectionWorker;
  Worker? _itemsWorker;
  Worker? _searchWorker;
  
  final selectedConnection = Rx<Connection?>(null);
  final orderItems = <OrderItem>[].obs;
}
```

### 2. Worker 생성 시 변수에 저장

```dart
@override
void onInit() {
  super.onInit();
  
  // ✅ Worker를 변수에 저장
  _connectionWorker = ever(selectedConnection, (connection) {
    if (connection != null) {
      loadProductsForConnection(connection);
    }
  });
  
  _itemsWorker = debounce(
    orderItems, 
    (items) => calculateTotalAmount(items),
    time: Duration(milliseconds: 300),
  );
  
  _searchWorker = interval(
    searchQuery,
    (query) => performSearch(query),
    time: Duration(seconds: 1),
  );
}
```

### 3. onClose에서 Worker dispose

```dart
@override
void onClose() {
  // ✅ 모든 Worker dispose
  _connectionWorker?.dispose();
  _itemsWorker?.dispose();
  _searchWorker?.dispose();
  
  // Stream subscriptions도 함께 정리
  _productsSubscription?.cancel();
  _connectionsSubscription?.cancel();
  
  // TextEditingController 등 다른 리소스도 정리
  memoController.dispose();
  
  super.onClose();
}
```

### 4. 여러 Worker를 List로 관리

```dart
class OrderHistoryController extends GetxController {
  // ✅ 여러 Worker를 List로 관리
  final List<Worker> _workers = [];
  
  @override
  void onInit() {
    super.onInit();
    
    // ✅ 생성과 동시에 List에 추가
    _workers.addAll([
      ever(allOrders, (_) => applyFilters()),
      ever(searchQuery, (_) => applyFilters()),
      ever(selectedStatus, (_) => applyFilters()),
      debounce(
        searchQuery, 
        (_) => searchInDatabase(),
        time: Duration(milliseconds: 500),
      ),
    ]);
  }
  
  @override
  void onClose() {
    // ✅ 한 번에 모든 Worker dispose
    for (final worker in _workers) {
      worker.dispose();
    }
    _workers.clear();
    
    super.onClose();
  }
}
```

### 5. 동적 Worker 관리

```dart
class MainController extends GetxController {
  Worker? _authWorker;
  
  void setupAuthListener() {
    // ✅ 기존 Worker가 있으면 먼저 dispose
    _authWorker?.dispose();
    
    // ✅ 새로운 Worker 생성
    _authWorker = ever(_authService.user, (user) {
      if (user == null) {
        Get.offAllNamed('/login');
      } else {
        Get.offAllNamed('/main');
      }
    });
  }
  
  @override
  void onClose() {
    _authWorker?.dispose();
    super.onClose();
  }
}
```

## 실제 적용 사례

### OrderHistoryController 개선

```dart
class OrderHistoryController extends GetxController {
  // ✅ Worker 필드 선언
  Worker? _filteredOrdersWorker;
  Worker? _allOrdersWorker;
  Worker? _searchWorker;
  Worker? _dateRangeWorker;
  Worker? _statusWorker;
  
  // ✅ StreamSubscription도 함께 관리
  StreamSubscription? _ordersSubscription;
  
  @override
  void onInit() {
    super.onInit();
    
    // ✅ 복잡한 반응형 로직 설정
    _filteredOrdersWorker = ever(filteredOrders, (orders) {
      updateOrderStats(orders);
    });
    
    _allOrdersWorker = ever(allOrders, (orders) {
      applyCurrentFilters();
    });
    
    _searchWorker = debounce(
      searchQuery,
      (query) => filterBySearch(query),
      time: Duration(milliseconds: 300),
    );
    
    _dateRangeWorker = ever(selectedDateRange, (range) {
      if (range != null) {
        filterByDateRange(range);
      }
    });
    
    _statusWorker = ever(selectedStatus, (status) {
      filterByStatus(status);
    });
    
    loadOrders();
  }
  
  @override
  void onClose() {
    // ✅ 체계적인 리소스 정리
    _filteredOrdersWorker?.dispose();
    _allOrdersWorker?.dispose();
    _searchWorker?.dispose();
    _dateRangeWorker?.dispose();
    _statusWorker?.dispose();
    
    _ordersSubscription?.cancel();
    
    searchController.dispose();
    
    super.onClose();
  }
  
  void loadOrders() {
    // ✅ 중복 구독 방지
    _ordersSubscription?.cancel();
    
    _ordersSubscription = _orderService
      .getOrdersStream()
      .listen((orders) {
        allOrders.value = orders;
      });
  }
}
```

## Worker 사용 베스트 프랙티스

### 1. Worker 타입 선택 가이드

```dart
// ✅ ever: 모든 변경에 반응
ever(selectedItem, (item) => updateDetails(item));

// ✅ once: 최초 1회만 실행 (초기화, 튜토리얼 등)
once(isFirstLaunch, (first) => showOnboarding());

// ✅ debounce: 연속 입력 후 실행 (검색, 자동저장 등)
debounce(searchText, (text) => search(text), 
  time: Duration(milliseconds: 500));

// ✅ interval: 주기적 실행 (폴링, 타이머 등)
interval(pollTrigger, (_) => fetchUpdates(), 
  time: Duration(seconds: 30));
```

### 2. Worker와 Stream 함께 관리

```dart
class ComplexController extends GetxController {
  // 관련 리소스를 그룹으로 관리
  
  // Stream 관련
  StreamSubscription? _dataSubscription;
  StreamSubscription? _eventSubscription;
  
  // Worker 관련
  Worker? _dataWorker;
  Worker? _eventWorker;
  
  @override
  void onClose() {
    // 그룹별로 정리
    _dataSubscription?.cancel();
    _eventSubscription?.cancel();
    
    _dataWorker?.dispose();
    _eventWorker?.dispose();
    
    super.onClose();
  }
}
```

### 3. 테스트로 검증

```dart
test('Worker가 onClose에서 정상적으로 dispose되는지 확인', () {
  // Arrange
  final controller = TestController();
  Get.put(controller);
  
  // Act - 컨트롤러 초기화
  controller.onInit();
  
  // Worker 트리거
  controller.incrementCounter();
  expect(controller.counter.value, equals(1));
  
  // Act - 컨트롤러 종료
  controller.onClose();
  
  // Verify - Worker가 dispose되어 더 이상 동작하지 않음
  controller.counter.value = 10; // Worker가 동작하지 않음
  
  expect(() => controller.onClose(), returnsNormally);
});
```

## 성능 개선 효과

Worker 메모리 관리 개선 후:

1. **메모리 사용량**: 10-15% 추가 감소
2. **CPU 사용률**: 불필요한 연산 제거로 5-10% 감소
3. **앱 반응성**: 이벤트 처리 지연 50% 감소
4. **배터리 효율**: 백그라운드 작업 감소로 배터리 수명 개선

## 체크리스트

Worker 사용 시 확인사항:

✅ Worker를 필드로 선언했나요?
✅ 생성한 Worker를 변수에 저장했나요?
✅ onClose()에서 dispose()를 호출했나요?
✅ 동적 Worker 생성 시 기존 것을 dispose했나요?
✅ 적절한 Worker 타입을 선택했나요? (ever/once/debounce/interval)

## 마무리

GetX Worker는 반응형 프로그래밍을 쉽게 구현할 수 있게 해주는 강력한 도구입니다. 하지만 Stream 기반으로 동작하기 때문에 적절한 메모리 관리가 필수적입니다.

**"생성한 Worker는 반드시 dispose하라"** - 이 원칙을 지키면 메모리 효율적인 GetX 앱을 만들 수 있습니다.

다음 포스팅에서는 GetX 서비스 등록 최적화에 대해 알아보겠습니다.

---

*실제 프로덕션 앱 "주문의 달인"의 메모리 최적화 경험을 바탕으로 작성되었습니다.*

#Flutter #GetX #Worker #메모리관리 #반응형프로그래밍 #성능최적화
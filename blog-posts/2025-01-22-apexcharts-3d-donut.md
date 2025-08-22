# ApexCharts로 3D 도넛 차트 만들기: 사용자 분포 시각화 개선

## 배경

평범한 2D 도넛 차트를 보고 "뭔가 심심한데... 3D 느낌으로 만들 수 없을까?"라는 요청을 받았습니다. ApexCharts는 진짜 3D를 지원하지 않지만, 시각적 트릭으로 3D 효과를 낼 수 있습니다.

## 문제점

기존 도넛 차트의 문제:
1. **평면적인 느낌** - 깊이감 부족
2. **단조로운 색상** - 그라데이션 없음
3. **정보 표시 부족** - 중앙 공간 활용 미흡

## 해결 방안: 가짜 3D 효과 만들기

### 1. 그라데이션으로 깊이감 표현

```javascript
fill: {
  type: 'gradient',
  gradient: {
    shade: 'dark',
    type: 'vertical',
    shadeIntensity: 0.4,
    gradientToColors: ['#059669', '#DC2626', '#2563EB'],
    inverseColors: false,
    opacityFrom: 1,
    opacityTo: 0.8,
    stops: [0, 100]
  }
}
```

**핵심 포인트:**
- `shade: 'dark'` - 어두운 톤으로 그라데이션
- `type: 'vertical'` - 세로 방향으로 색상 변화
- `opacityFrom/To` - 투명도 변화로 입체감

### 2. 드롭 쉐도우로 떠있는 효과

```javascript
chart: {
  dropShadow: {
    enabled: true,
    color: '#000',
    top: 3,
    left: 0,
    blur: 10,
    opacity: 0.15
  }
}
```

### 3. 스트로크로 섹션 구분

```javascript
stroke: {
  width: 2,
  colors: ['#ffffff']
}
```
흰색 테두리로 각 섹션을 명확히 구분

### 4. 중앙 정보 표시 활용

```javascript
plotOptions: {
  pie: {
    donut: {
      labels: {
        show: true,
        total: {
          show: true,
          showAlways: true,
          label: '전체 사용자',
          formatter: function(w) {
            return (stats?.users.total || 0) + '명';
          }
        }
      }
    }
  }
}
```

## 실제 구현 전체 코드

```javascript
const donutChartOptions = {
  chart: {
    type: 'donut',
    dropShadow: {
      enabled: true,
      color: '#000',
      top: 3,
      left: 0,
      blur: 10,
      opacity: 0.15
    }
  },
  colors: ['#10B981', '#EF4444', '#3B82F6'],
  fill: {
    type: 'gradient',
    gradient: {
      shade: 'dark',
      type: 'vertical',
      shadeIntensity: 0.4,
      gradientToColors: ['#059669', '#DC2626', '#2563EB'],
      opacityFrom: 1,
      opacityTo: 0.8,
      stops: [0, 100]
    }
  },
  stroke: {
    width: 2,
    colors: ['#ffffff']
  },
  dataLabels: {
    enabled: true,
    style: {
      fontSize: '12px',
      fontWeight: 'bold',
      colors: ['#ffffff']
    },
    dropShadow: {
      enabled: true,
      blur: 1,
      opacity: 0.45
    }
  }
};
```

## 데이터 정확성 이슈

### 문제 발견
차트 중앙에 표시되는 "전체 사용자"가 각 섹션의 합계를 보여주고 있었는데, 이는 중복 계산의 위험이 있었습니다.

### 해결
```javascript
formatter: function(w) {
  // 잘못된 방식: 섹션 합계
  // const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
  
  // 올바른 방식: 실제 전체 사용자 수
  return (stats?.users.total || 0) + '명';
}
```

## 효과 및 성과

1. **시각적 개선**: 평면적인 차트가 입체적으로 보임
2. **정보 전달력 향상**: 중앙에 전체 수치 표시
3. **인터랙션 개선**: 호버 시 툴팁으로 상세 정보

## 교훈

### 1. 제약을 창의적으로 극복
ApexCharts가 진짜 3D를 지원하지 않아도, 그라데이션과 그림자로 충분히 3D 효과를 낼 수 있습니다.

### 2. 작은 디테일의 중요성
- 그림자 한 줄이 차트를 떠있게 만듦
- 흰색 테두리가 섹션을 명확히 구분
- 그라데이션이 깊이감을 만듦

### 3. 데이터 정확성 우선
아무리 예쁜 차트라도 잘못된 데이터를 보여주면 의미가 없습니다. 항상 데이터 소스를 확인하세요.

## 마무리

3D 라이브러리를 쓰지 않고도 시각적 트릭만으로 충분히 입체적인 차트를 만들 수 있습니다. 중요한 건 **사용자가 3D처럼 느끼는가**입니다.

#ApexCharts #DataVisualization #UI개선 #차트디자인 #JavaScript
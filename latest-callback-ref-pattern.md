# React Native Event Handler와 Latest Callback Ref 패턴

React에서 대부분의 이벤트는 `onClick`, `onInput`, `onKeyDown` 같은 synthetic event props로 처리한다. 이 방식은 편하다. React가 렌더링 주기와 이벤트 위임을 관리해주고, 컴포넌트가 다시 렌더링되면 이벤트 핸들러도 자연스럽게 최신 props와 state를 바라본다.

그런데 가끔 React 이벤트 시스템 바깥으로 나가야 하는 순간이 있다. 예를 들어 DOM node에 직접 native event listener를 붙여야 하는 경우다.

```tsx
root.addEventListener("beforeinput", listener);
```

이런 코드를 작성하는 순간, 이벤트 핸들러는 React의 자동 관리 영역에서 살짝 벗어난다. 그리고 여기서 흔히 두 가지 문제가 생긴다.

## 문제 상황

이번 에디터 구현에서는 `beforeinput`을 이용해 사용자의 입력 의도를 먼저 읽고 싶었다. 특히 `InputEvent.inputType`이 `"insertText"`인지, `"insertParagraph"`인지 확인한 뒤 editor command로 라우팅하는 구조가 필요했다.

처음에는 block DOM node나 editor root에 직접 listener를 붙이는 식으로 접근할 수 있다.

```tsx
useLayoutEffect(() => {
	const listener = (event: Event) => {
		handleNativeBeforeInput(event as InputEvent);
	};

	root.addEventListener("beforeinput", listener);

	return () => {
		root.removeEventListener("beforeinput", listener);
	};
}, [handleNativeBeforeInput]);
```

이 코드는 얼핏 괜찮아 보인다. `handleNativeBeforeInput`이 바뀌면 listener를 다시 붙이고, 이전 listener는 cleanup에서 제거한다.

하지만 editor 같은 입력 UI에서는 이 방식이 조금 거칠 수 있다.

`handleNativeBeforeInput`은 내부에서 여러 값을 참조한다.

```tsx
const handleNativeBeforeInput = useCallback(
	(event: InputEvent) => {
		if (readOnly) return;

		// selection, block id, inputType 등을 읽고
		// editor command를 실행한다.
	},
	[dispatchBeforeInputCommand, readOnly],
);
```

그리고 `dispatchBeforeInputCommand`도 다시 `commitBlockContent`, `setSelection`, `splitBlock`, `editor` 같은 값에 의존한다. 즉 React 렌더링이 일어날 때마다 핸들러가 새로 만들어질 가능성이 있다.

그 결과 native listener도 자주 제거되고 다시 붙는다.

기능적으로는 대개 동작한다. 하지만 입력 이벤트는 타이밍에 민감하다. selection, composition, beforeinput, input이 촘촘하게 이어지는 편집기에서는 listener를 자주 갈아끼우는 구조가 마음에 걸릴 수 있다.

그렇다고 effect dependency를 비워버리면 다른 문제가 생긴다.

```tsx
useLayoutEffect(() => {
	const listener = (event: Event) => {
		handleNativeBeforeInput(event as InputEvent);
	};

	root.addEventListener("beforeinput", listener);
	return () => root.removeEventListener("beforeinput", listener);
}, []);
```

이렇게 하면 listener는 한 번만 붙는다. 하지만 listener가 처음 렌더의 `handleNativeBeforeInput`을 기억하게 된다. 이후 `readOnly`가 바뀌거나 command 함수가 바뀌어도 오래된 값을 볼 수 있다.

이것이 stale closure 문제다.

정리하면 선택지가 둘 다 아쉽다.

- dependency를 넣으면 최신 값은 보지만 listener를 자주 다시 붙인다.
- dependency를 비우면 listener는 안정적이지만 오래된 값을 볼 수 있다.

이 중간 지점을 해결하는 패턴이 latest callback ref다.

## Latest Callback Ref 패턴

latest callback ref 패턴은 아이디어가 단순하다.

DOM에 붙이는 native listener는 안정적으로 유지한다. 대신 listener 안에서 직접 로직을 실행하지 않고, ref에 들어 있는 최신 callback을 호출한다.

```tsx
const handlerRef = useRef<(event: InputEvent) => void>(() => {});

useLayoutEffect(() => {
	handlerRef.current = handleNativeBeforeInput;
}, [handleNativeBeforeInput]);

useLayoutEffect(() => {
	const listener = (event: Event) => {
		handlerRef.current(event as InputEvent);
	};

	root.addEventListener("beforeinput", listener);

	return () => {
		root.removeEventListener("beforeinput", listener);
	};
}, []);
```

이 구조에서는 역할이 분리된다.

첫 번째 effect는 최신 핸들러를 ref에 저장한다.

```tsx
useLayoutEffect(() => {
	handlerRef.current = handleNativeBeforeInput;
}, [handleNativeBeforeInput]);
```

두 번째 effect는 native listener를 한 번만 등록한다.

```tsx
useLayoutEffect(() => {
	const listener = (event: Event) => {
		handlerRef.current(event as InputEvent);
	};

	root.addEventListener("beforeinput", listener);

	return () => {
		root.removeEventListener("beforeinput", listener);
	};
}, []);
```

이제 DOM 입장에서는 listener가 안정적이다. 같은 listener가 계속 붙어 있다.

반면 React 로직 입장에서는 이벤트가 발생하는 순간마다 `handlerRef.current`를 통해 최신 `handleNativeBeforeInput`을 실행한다. 따라서 stale closure도 피할 수 있다.

## 왜 ref를 쓰면 최신 값을 볼 수 있을까?

`useRef`가 반환하는 객체는 렌더 사이에서 같은 identity를 유지한다.

```tsx
const handlerRef = useRef(fn);
```

컴포넌트가 다시 렌더링되어도 `handlerRef` 객체 자체는 바뀌지 않는다. 대신 `handlerRef.current`만 바꿀 수 있다.

native listener는 처음 만들어질 때 `handlerRef` 객체를 closure로 잡는다.

```tsx
const listener = (event: Event) => {
	handlerRef.current(event as InputEvent);
};
```

여기서 중요한 점은 listener가 특정 시점의 `handleNativeBeforeInput` 함수를 직접 잡고 있지 않다는 것이다. listener가 잡고 있는 것은 안정적인 ref 객체다. 그리고 이벤트가 발생하는 시점에 그 ref의 `.current`를 읽는다.

그래서 `.current`만 최신 핸들러로 계속 갱신해두면, listener는 다시 등록하지 않아도 최신 로직을 실행할 수 있다.

## 왜 useLayoutEffect를 쓸까?

이 패턴은 `useEffect`로도 자주 작성된다.

```tsx
useEffect(() => {
	handlerRef.current = handler;
}, [handler]);
```

하지만 editor, selection, input event처럼 DOM 타이밍이 민감한 영역에서는 `useLayoutEffect`가 더 보수적인 선택이다.

`useLayoutEffect`는 React가 DOM을 반영한 뒤, 브라우저가 화면을 그리기 전에 실행된다. 즉 화면이 그려지고 사용자의 다음 입력이 들어오기 전에 ref를 최신 handler로 맞춰둘 가능성이 더 높다.

이번 사례처럼 `beforeinput`과 selection restore가 엮이는 코드에서는 작은 타이밍 차이가 체감 버그로 이어질 수 있다. 그래서 layout effect를 쓰는 쪽이 더 안정적인 선택이다.

## 이 패턴이 필요한 때

latest callback ref는 모든 이벤트 처리에 필요한 패턴은 아니다. React 이벤트 props를 사용할 수 있다면 보통 그쪽이 더 단순하다.

```tsx
<button onClick={handleClick}>Save</button>
```

이런 코드는 React가 이미 잘 관리해준다.

이 패턴이 유용해지는 건 React 바깥에 listener를 붙이는 경우다.

- `window.addEventListener`
- `document.addEventListener`
- 특정 DOM node의 native event listener
- pointer, keyboard, resize, scroll 같은 global event
- editor의 `beforeinput`, selection, composition 관련 이벤트
- 서드파티 라이브러리가 제공하는 subscribe API

특히 이벤트 listener를 한 번만 등록하고 싶은데, 내부 로직은 최신 props/state를 봐야 할 때 잘 맞는다.

## 이번 editor 코드에 적용하면

이번 구현에서는 native `beforeinput` listener를 editor root에 붙인다.

```tsx
const editorRootRef = useRef<HTMLDivElement | null>(null);
const beforeInputHandlerRef = useRef<(event: InputEvent) => void>(() => {});
```

그리고 현재 렌더의 최신 handler를 ref에 넣는다.

```tsx
useLayoutEffect(() => {
	beforeInputHandlerRef.current = handleNativeBeforeInput;
}, [handleNativeBeforeInput]);
```

listener는 mount 시점에 한 번 붙인다.

```tsx
useLayoutEffect(() => {
	const root = editorRootRef.current;
	if (!root) return;

	const listener = (event: Event) => {
		beforeInputHandlerRef.current(event as InputEvent);
	};

	root.addEventListener("beforeinput", listener);

	return () => {
		root.removeEventListener("beforeinput", listener);
	};
}, []);
```

이렇게 하면 다음 두 조건을 동시에 만족한다.

- DOM listener는 불필요하게 재등록되지 않는다.
- 실제 beforeinput 처리 로직은 최신 `readOnly`, 최신 command dispatcher, 최신 editor 상태를 기준으로 실행된다.

## 주의할 점

latest callback ref는 stale closure를 피하기 위한 실용적인 패턴이지만, 아무 곳에나 남용할 필요는 없다.

첫째, React event prop으로 충분하면 굳이 native listener로 내려가지 않는 편이 낫다.

둘째, ref에 최신 callback을 넣는 effect가 빠지면 패턴이 깨진다.

```tsx
useLayoutEffect(() => {
	handlerRef.current = handler;
}, [handler]);
```

이 부분이 있어야 `handlerRef.current`가 최신 로직을 가리킨다.

셋째, listener를 한 번만 붙이는 effect에서 참조하는 값은 안정적이어야 한다. `root`처럼 mount 시점에 결정되는 DOM node는 괜찮지만, target 자체가 자주 바뀌는 구조라면 target을 dependency로 다뤄야 한다.

넷째, 이 패턴은 최신 callback을 호출하게 해줄 뿐이다. callback 내부의 비즈니스 로직, selection 계산, DOM offset 계산이 올바른지는 별도로 검증해야 한다.

## 마무리

native event listener를 React 컴포넌트 안에서 다룰 때는 두 세계가 만난다.

React는 렌더마다 새로운 props와 state를 기준으로 UI를 다시 계산한다. 반면 native event listener는 DOM에 직접 붙은 함수이고, 한 번 붙으면 그 함수가 closure로 잡은 값을 계속 기억한다.

latest callback ref 패턴은 이 둘 사이의 접점이다.

listener는 안정적으로 유지하고, 실행 로직은 최신으로 유지한다.

편집기처럼 입력 이벤트 타이밍이 민감한 UI에서는 이 차이가 꽤 중요하다. 작은 패턴이지만, stale closure와 listener 재등록 사이에서 균형을 잡아주는 좋은 도구다.

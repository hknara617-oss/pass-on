"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="app">
      <h1>잠시 연결하지 못했습니다</h1>
      <p>기록을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.</p>
      <button className="primary" onClick={reset}>
        다시 시도
      </button>
    </main>
  );
}

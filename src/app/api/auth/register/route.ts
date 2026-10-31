export async function POST() { return Response.json({ error: "개인 전용 앱입니다. 개인 연결 링크를 사용해 주세요." }, { status: 403, headers: { "Cache-Control": "no-store" } }); }

import Link from "next/link";
import { AuthFrame, LoginLink } from "@/components/auth-ui";
export default function Page() {
  return (
    <AuthFrame
      title="인증 링크를 확인해 주세요"
      description="링크가 만료되었거나 이미 사용됐을 수 있습니다. 메일을 요청한 브라우저에서 열거나 새 링크를 받아 주세요."
    >
      <Link href="/forgot-password" className="primary block">
        새 인증 링크 받기
      </Link>
      <LoginLink />
    </AuthFrame>
  );
}

export const RECOVERY_MESSAGE =
  "등록된 이메일이라면 비밀번호 재설정 링크를 보냈습니다. 받은편지함과 스팸함을 확인해 주세요.";

export function safeNext(value: string | null | undefined): string {
  return value &&
    [
      "/capture",
      "/archive",
      "/data",
      "/data/security",
      "/revisit",
      "/auth/update-password",
    ].includes(value)
    ? value
    : "/capture";
}
export function passwordError(
  password: string,
  confirm: string,
): string | null {
  if (password.length < 12) return "새 비밀번호는 12자 이상으로 입력해 주세요.";
  if (password.length > 128) return "새 비밀번호는 128자 이내로 입력해 주세요.";
  if (password !== confirm) return "두 비밀번호가 일치하지 않습니다.";
  return null;
}
export function authError(
  error: { code?: string; message?: string; status?: number } | null,
): string {
  if (!error) return "";
  switch (error.code) {
    case "invalid_credentials":
      return "이메일 또는 비밀번호를 확인해 주세요. 기억나지 않으면 비밀번호 찾기를 이용해 주세요.";
    case "email_not_confirmed":
      return "이메일 확인을 먼저 완료해 주세요.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
    case "same_password":
      return "기존과 다른 새 비밀번호를 입력해 주세요.";
    case "weak_password":
      return "더 긴 비밀번호에 영문·숫자·기호를 함께 사용해 주세요.";
    case "reauthentication_needed":
      return "이메일로 본인 확인이 필요합니다. 아래에서 인증번호를 받아 주세요.";
    case "reauthentication_not_valid":
      return "인증번호가 올바르지 않거나 만료됐습니다.";
    case "otp_expired":
      return "인증 링크가 만료되었거나 이미 사용되었습니다. 새 링크를 받아 주세요.";
    default:
      return "요청을 처리하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.";
  }
}

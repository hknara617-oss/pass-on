import Link from "next/link";
import { Brand } from "./brand";
export function AuthFrame({title,description,children}:{title:React.ReactNode;description?:string;children:React.ReactNode}) {
  return <main className="auth signature-auth"><div className="auth-inner"><Brand large/><header className="auth-heading"><h1>{title}</h1>{description&&<p>{description}</p>}</header>{children}<p className="auth-footer">오늘의 나를, 내일의 너에게.<br/>기록은 언제나 당신의 것입니다.</p></div></main>;
}
export function Status({error,message}:{error?:string;message?:string}) {
  return <>{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="status" role="status">{message}</p>}</>;
}
export function LoginLink(){return <Link className="text-link centered" href="/login">개인 연결로 돌아가기</Link>;}

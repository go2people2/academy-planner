import { redirect } from 'next/navigation';

export default function Home() {
  // 메인 페이지 접속 시 바로 로그인 페이지로 이동시킵니다.
  redirect('/login');
}

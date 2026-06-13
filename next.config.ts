import type { NextConfig } from "next";
import os from "os";

// 💡 서버가 켜질 때 현재 컴퓨터의 Wi-Fi IP 주소를 찾아서 터미널에 예쁘게 출력해줍니다.
const getLocalIp = () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "0.0.0.0";
};

console.log("\n=================================================");
console.log(`📱 학원 내 스마트폰/태블릿 접속 주소:`);
console.log(`✨ http://${getLocalIp()}:3000`);
console.log("=================================================\n");

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  // 💡 HMR(Hot Module Replacement) 크로스 오리진 차단 해제
  // Next.js 16에서는 experimental이 아니라 루트 레벨에 설정합니다.
  allowedDevOrigins: [getLocalIp(), 'localhost', '127.0.0.1'],
} as any; // Type 오류 우회를 위해 as any 추가 (NextConfig type이 완벽히 지원하지 않을 수 있음)

export default nextConfig;
